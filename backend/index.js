import './env.js'; // must load before modules that read process.env
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { initDB, getDB } from './db.js';
import { reconcileTransactions } from './services/reconciler.js';
import { OTP_CHANNEL, sendOtp, checkOtp, OtpError } from './services/otp.js';
import { startWhatsApp, sendWhatsApp, getWhatsAppStatus } from './services/whatsapp.js';
import { verifyGatewaySignature, parseSyncSms, normalizePhone } from './services/sms.js';
import { authMiddleware, JWT_SECRET, signOtpToken, isValidOtpToken } from './middleware/auth.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '200kb', verify: (req, _res, buf) => { req.rawBody = buf; } })); // rawBody: SMS webhook HMAC

initDB();

if (process.env.WHATSAPP_ENABLED === 'true') startWhatsApp().catch(e => console.error('WhatsApp start failed:', e.message));

const PHONE_RE = /^\+[1-9]\d{1,14}$/;
const isPaise = (n) => Number.isSafeInteger(n) && n > 0;
const MAX_TOPUP = 1000000; // ₹10,000 per simulated top-up
// Ed25519 raw public key = 32 bytes = 44 base64 chars
const isPubKey = (k) => typeof k === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(k);

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many OTP requests. Please try again later.' }
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many verification attempts.' }
});

// ============================
// HEALTH CHECK
// ============================
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: Date.now() }));

// ============================
// OTP: SEND
// ============================
app.post('/api/send-otp', otpRequestLimiter, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!PHONE_RE.test(phoneNumber || '')) {
      return res.status(400).json({ error: 'Invalid phone format. Use E.164 format (e.g., +911234567890)' });
    }
    await sendOtp(phoneNumber);
    res.json({ success: true, channel: OTP_CHANNEL });
  } catch (error) {
    console.error('Send OTP Error:', error.message);
    res.status(error instanceof OtpError ? error.status : 500).json({ error: error instanceof OtpError ? error.message : 'Failed to send OTP' });
  }
});

// ============================
// OTP: VERIFY → short-lived otpToken for register/login
// ============================
app.post('/api/verify-otp', verifyLimiter, async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    if (!PHONE_RE.test(phoneNumber || '') || !/^\d{6}$/.test(otp || '')) {
      return res.status(400).json({ error: 'Valid phone number and 6-digit OTP are required' });
    }
    if (!(await checkOtp(phoneNumber, otp))) return res.status(401).json({ error: 'Invalid or expired OTP. Please try again.' });
    res.json({ success: true, otpToken: signOtpToken(phoneNumber) });
  } catch (error) {
    console.error('Verify OTP Error:', error.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ============================
// AUTH: REGISTER (requires verified OTP)
// ============================
app.post('/api/auth/register', verifyLimiter, (req, res) => {
  try {
    const { phone, name, email, pubKey, backup, otpToken } = req.body;
    if (!PHONE_RE.test(phone || '') || typeof name !== 'string' || !name.trim() || name.length > 100 || !isPubKey(pubKey)) {
      return res.status(400).json({ error: 'Valid phone, name, and pubKey are required' });
    }
    if (!isValidOtpToken(otpToken, phone)) return res.status(401).json({ error: 'Phone not verified. Please verify OTP again.' });

    const db = getDB();
    if (db.prepare('SELECT id FROM users WHERE phone = ? OR pub_key = ?').get(phone, pubKey)) {
      return res.status(409).json({ error: 'Phone already registered. Please log in.' });
    }

    const userId = crypto.randomUUID();
    db.transaction(() => {
      db.prepare(`INSERT INTO users (id, phone, name, email, pub_key, enc_key_bkp, kyc_status) VALUES (?,?,?,?,?,?,?)`).run(
        userId, phone, name.trim(), typeof email === 'string' ? email.slice(0, 200) : null, pubKey, backup ? JSON.stringify(backup) : null, 'verified'
      );
      db.prepare(`INSERT INTO wallets (id, user_id, confirmed_bal, locked_bal, nonce_counter) VALUES (?,?,?,?,?)`).run(
        crypto.randomUUID(), userId, 0, 0, 0
      );
    })();

    const token = jwt.sign({ id: userId, phone, pubKey }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`✅ User registered: ${phone}, userId: ${userId}`);
    res.json({ success: true, token, userId, walletId: 'PP·' + name.trim().toLowerCase().split(' ')[0] + '·' + pubKey.slice(0, 8) });
  } catch (error) {
    console.error('Register Error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ============================
// AUTH: LOGIN (requires verified OTP; returns key backup for new devices)
// ============================
app.post('/api/auth/login', verifyLimiter, (req, res) => {
  try {
    const { phone, otpToken } = req.body;
    if (!PHONE_RE.test(phone || '')) return res.status(400).json({ error: 'Valid phone is required' });
    if (!isValidOtpToken(otpToken, phone)) return res.status(401).json({ error: 'Phone not verified. Please verify OTP again.' });

    const user = getDB().prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) return res.status(404).json({ error: 'User not found. Please register.' });

    const token = jwt.sign({ id: user.id, phone: user.phone, pubKey: user.pub_key }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`✅ User login: ${user.phone}`);
    res.json({
      success: true,
      token,
      userId: user.id,
      name: user.name,
      pubKey: user.pub_key,
      backup: user.enc_key_bkp ? JSON.parse(user.enc_key_bkp) : null
    });
  } catch (error) {
    console.error('Login Error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================
// WALLET: GET BALANCE
// ============================
app.get('/api/wallet/balance', authMiddleware, (req, res) => {
  const wallet = getDB().prepare('SELECT confirmed_bal, locked_bal, nonce_counter, daily_spent, daily_date FROM wallets WHERE user_id = ?').get(req.user.id);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
  res.json({ wallet });
});

// ============================
// WALLET: ADD MONEY (simulated top-up — no real payment gateway yet)
// ============================
app.post('/api/wallet/add', authMiddleware, (req, res) => {
  const { amount } = req.body;
  if (!isPaise(amount) || amount > MAX_TOPUP) return res.status(400).json({ error: 'Invalid amount (max ₹10,000 per top-up)' });

  const db = getDB();
  db.prepare('UPDATE wallets SET confirmed_bal = confirmed_bal + ? WHERE user_id = ?').run(amount, req.user.id);
  const wallet = db.prepare('SELECT confirmed_bal, locked_bal FROM wallets WHERE user_id = ?').get(req.user.id);
  console.log(`💰 Added ₹${amount / 100} to user ${req.user.id}`);
  res.json({ success: true, wallet });
});

// ============================
// WALLET: SYNC (batch reconcile offline transactions)
// ============================
app.post('/api/sync', authMiddleware, (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) return res.json({ results: [], wallet: null });
  if (transactions.length > 100) return res.status(400).json({ error: 'Max 100 transactions per sync' });
  res.json(syncFor(req.user.id, transactions, 'app'));
});

function syncFor(userId, transactions, via) {
  const { results, wallet, settled } = reconcileTransactions(userId, transactions);
  console.log(`🔄 Sync (${via}) for ${userId}: ${results.filter(r => r.status === 'confirmed').length} confirmed, ${results.filter(r => r.status === 'failed').length} failed`);
  notifySettled(settled);
  return { results, wallet };
}

// WhatsApp payment alerts (best effort; no-op if WhatsApp isn't connected)
const rupees = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
function notifySettled(settled) {
  const user = getDB().prepare('SELECT u.name, u.phone, w.confirmed_bal FROM users u JOIN wallets w ON w.user_id = u.id WHERE u.id = ?');
  for (const s of settled) {
    const from = user.get(s.from), to = s.to && user.get(s.to);
    if (to) sendWhatsApp(to.phone, `💰 SyncPay: ${rupees(s.amount)} received from ${from.name}. Balance: ${rupees(to.confirmed_bal)}`);
    if (!s.claimOnly) sendWhatsApp(from.phone, `✅ SyncPay: your payment of ${rupees(s.amount)}${to ? ` to ${to.name}` : ''} has settled. Balance: ${rupees(from.confirmed_bal)}`);
  }
}

// ============================
// SMS SYNC: webhook from the SMS gateway phone (sms-gate.app)
// ============================
app.post('/api/sms/inbound', (req, res) => {
  const key = process.env.SMS_WEBHOOK_SIGNING_KEY;
  if (!key) return res.status(503).json({ error: 'SMS sync not configured' });
  if (!verifyGatewaySignature(req.rawBody, req.get('X-Timestamp'), req.get('X-Signature'), key)) {
    return res.status(401).json({ error: 'Bad signature' });
  }
  const { event, payload } = req.body || {};
  if (event !== 'sms:received') return res.json({ ignored: 'event' });
  const txns = parseSyncSms(payload?.message);
  if (!txns) return res.json({ ignored: 'not a SyncPay message' });

  // The SIM that sent the SMS identifies the account (like a JWT does for /api/sync).
  // Spoofing a number can't redirect money: amounts and recipients come from the signed payloads.
  const user = getDB().prepare('SELECT id FROM users WHERE phone = ?').get(normalizePhone(payload.sender));
  if (!user) return res.json({ ignored: 'unknown sender' });
  if (!txns.length) return res.json({ results: [] });
  res.json(syncFor(user.id, txns, 'sms'));
});

// ============================
// HISTORY: my settled transactions (both directions), incl. ones settled by the other phone
// ============================
app.get('/api/transactions', authMiddleware, (req, res) => {
  const rows = getDB().prepare(`
    SELECT t.id, t.amount, t.created_at, t.from_user_id, t.status, fu.name AS from_name, tu.name AS to_name
    FROM transactions t JOIN users fu ON fu.id = t.from_user_id LEFT JOIN users tu ON tu.id = t.to_user_id
    WHERE t.from_user_id = ? OR t.to_user_id = ?
    ORDER BY t.created_at DESC LIMIT 100`).all(req.user.id, req.user.id);
  res.json({ transactions: rows.map(t => {
    const sent = t.from_user_id === req.user.id;
    return { id: t.id, type: sent ? 'sent' : 'received', amount: t.amount, created_at: t.created_at, status: t.status,
             counterparty: sent ? (t.to_name || 'QR payment') : t.from_name };
  }) });
});

// ============================
// WALLET: WITHDRAW (simulated bank payout)
// ============================
app.post('/api/wallet/withdraw', authMiddleware, (req, res) => {
  const { amount, bankName, accountNo, ifsc } = req.body;
  if (!isPaise(amount)) return res.status(400).json({ error: 'Invalid amount' });
  if (![bankName, accountNo, ifsc].every(v => typeof v === 'string' && v && v.length <= 64)) {
    return res.status(400).json({ error: 'Bank details required' });
  }

  const db = getDB();
  const utr = 'UTR' + Date.now();
  const ok = db.transaction(() => {
    const debit = db.prepare('UPDATE wallets SET confirmed_bal = confirmed_bal - ? WHERE user_id = ? AND confirmed_bal >= ?').run(amount, req.user.id, amount);
    if (!debit.changes) return false;
    db.prepare(`INSERT INTO withdrawals (id, user_id, amount, bank_name, account_no, ifsc, status, utr_number) VALUES (?,?,?,?,?,?,?,?)`).run(
      crypto.randomUUID(), req.user.id, amount, bankName, accountNo, ifsc, 'completed', utr
    );
    return true;
  })();
  if (!ok) return res.status(400).json({ error: 'Insufficient balance' });

  const wallet = db.prepare('SELECT confirmed_bal, locked_bal FROM wallets WHERE user_id = ?').get(req.user.id);
  console.log(`🏦 Withdrawal ₹${amount / 100} by ${req.user.id}, UTR: ${utr}`);
  res.json({ success: true, utr, wallet });
});

// ============================
// MERCHANT: payments received (settled offline payments where I'm the recipient)
// ============================
app.get('/api/merchant/collections', authMiddleware, (req, res) => {
  const db = getDB();
  const payments = db.prepare(`
    SELECT t.id AS _id, t.amount, t.created_at, u.name AS sender_name
    FROM transactions t JOIN users u ON u.id = t.from_user_id
    WHERE t.to_user_id = ? AND t.status = 'confirmed'
    ORDER BY t.created_at DESC LIMIT 50`).all(req.user.id);
  const now = Math.floor(Date.now() / 1000);
  const todayStart = now - ((now + 19800) % 86400); // IST midnight
  const { total, today } = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total,
           COALESCE(SUM(CASE WHEN created_at >= ? THEN amount END), 0) AS today
    FROM transactions WHERE to_user_id = ? AND status = 'confirmed'`).get(todayStart, req.user.id);
  res.json({ payments, total, todayTotal: today });
});

// ============================
// WHATSAPP LINKING PAGE (this computer only): shows the QR to link the sender number
// ============================
app.get('/whatsapp', (req, res) => {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return res.status(403).send('Open this page on the server machine.');
  const { connected, qr, me } = getWhatsAppStatus();
  const body = process.env.WHATSAPP_ENABLED !== 'true'
    ? '<p>WhatsApp is disabled. Set <code>WHATSAPP_ENABLED=true</code> in <code>backend/.env</code> and restart the server.</p>'
    : connected ? `<p class="ok">✅ Connected as +${me}. OTP codes and payment alerts are sent from this number.</p>`
    : qr ? `<p>On the <b>spare</b> phone: WhatsApp → <b>Linked devices</b> → <b>Link a device</b>, then scan:</p><img src="${qr}" alt="WhatsApp linking QR" width="320" height="320"><p class="muted">The code refreshes about every 20 s; this page reloads itself.</p>`
    : '<p>Starting WhatsApp… this page reloads itself.</p>';
  res.type('html').send(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="${connected ? 30 : 3}">
<title>SyncPay · WhatsApp</title><style>body{font:16px system-ui;max-width:560px;margin:40px auto;padding:0 16px;background:#fff;color:#18181b}
img{border:1px solid #ddd;border-radius:12px}
.ok{color:#15803d;font-weight:600}.muted{color:#71717a;font-size:14px}</style><h1>WhatsApp link</h1>${body}`);
});

app.listen(port, () => {
  console.log(`\n🚀 SyncPay backend running on http://localhost:${port}`);
  console.log(`🔐 OTP channel: ${OTP_CHANNEL}${OTP_CHANNEL === 'mock' ? ' (use 123456)' : ''}`);
  console.log(`📩 SMS sync webhook: ${process.env.SMS_WEBHOOK_SIGNING_KEY ? 'enabled at POST /api/sms/inbound' : 'disabled (set SMS_WEBHOOK_SIGNING_KEY)'}\n`);
});
