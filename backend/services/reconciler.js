import { getDB } from '../db.js';
import { drawFromAllowance, walletView } from './allowance.js';
import crypto from 'crypto';

export const MAX_TXN_AMOUNT = 50000;      // ₹500 per offline txn (paise)
export const DAILY_OFFLINE_LIMIT = 200000; // ₹2,000 per day (paise)
const IST_OFFSET = 19800;                 // daily limit resets at IST midnight, matching the client
const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');

function verifyTxnSignature(payloadString, signatureB64, pubKeyB64) {
  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.concat([SPKI_ED25519, Buffer.from(pubKeyB64, 'base64')]),
      format: 'der',
      type: 'spki'
    });
    return crypto.verify(null, Buffer.from(payloadString), publicKey, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}

const fail = (id, fail_reason) => ({ id, status: 'failed', fail_reason });

// Reconciles one offline txn for the authenticated user `userId`.
// Every value that moves money (sender, recipient, amount, nonce, id) comes from the
// signed payload. Fields on the client wrapper are ignored, so a tampered sync can't
// change who gets paid or how much.
function reconcileOne(db, userId, txn) {
  const clientId = txn?.id;
  if (typeof txn?.payloadString !== 'string' || typeof txn.signature !== 'string') return fail(clientId, 'MISSING_PAYLOAD');

  let p;
  try { p = JSON.parse(txn.payloadString); } catch { return fail(clientId, 'BAD_PAYLOAD'); }
  if (typeof p?.id !== 'string' || typeof p.from !== 'string' || !Number.isSafeInteger(p.nonce) || p.nonce <= 0 || !Number.isSafeInteger(p.ts)) {
    return fail(clientId, 'BAD_PAYLOAD');
  }

  const sender = db.prepare('SELECT id, pub_key FROM users WHERE pub_key = ?').get(p.from);
  if (!sender) return fail(p.id, 'SENDER_NOT_FOUND');
  if (!verifyTxnSignature(txn.payloadString, txn.signature, sender.pub_key)) return fail(p.id, 'INVALID_SIGNATURE');
  if (!Number.isSafeInteger(p.amount) || p.amount <= 0 || p.amount > MAX_TXN_AMOUNT) return fail(p.id, 'INVALID_AMOUNT');

  // Who gets credited: the recipient the sender signed for (if it's a real user),
  // otherwise whoever scanned the QR and is syncing it now.
  const isSender = userId === sender.id;
  const signedTo = typeof p.to === 'string' && db.prepare('SELECT 1 FROM users WHERE id = ?').get(p.to) ? p.to : null;
  if (!isSender && signedTo && signedTo !== userId) return fail(p.id, 'NOT_RECIPIENT');
  const recipient = isSender ? signedTo : userId;
  if (recipient === sender.id) return fail(p.id, 'SELF_PAYMENT');

  const existing = db.prepare('SELECT from_user_id, to_user_id, amount, nonce, status FROM transactions WHERE id = ?').get(p.id);
  if (existing) {
    if (existing.from_user_id !== sender.id || existing.nonce !== p.nonce) return fail(p.id, 'ID_CONFLICT');
    if (existing.to_user_id === null && recipient) {
      // Receiver claiming a txn the sender already settled. Credit the STORED amount, once.
      const claimed = db.prepare('UPDATE transactions SET to_user_id = ? WHERE id = ? AND to_user_id IS NULL').run(recipient, p.id);
      if (!claimed.changes) return { id: p.id, status: existing.status };
      db.prepare('UPDATE wallets SET confirmed_bal = confirmed_bal + ? WHERE user_id = ?').run(existing.amount, recipient);
      return { id: p.id, status: existing.status, settled: { id: p.id, ts: p.ts, from: sender.id, to: recipient, amount: existing.amount, claimOnly: true } };
    }
    if (isSender || existing.to_user_id === userId) return { id: p.id, status: existing.status };
    return fail(p.id, 'ALREADY_CLAIMED');
  }

  // Nonces only need to be unique per sender. Offline txns reach the server in any
  // order (whoever gets signal first), so a "must be greater than last" rule would
  // reject legitimate payments.
  if (db.prepare('SELECT 1 FROM transactions WHERE from_user_id = ? AND nonce = ?').get(sender.id, p.nonce)) {
    return fail(p.id, 'NONCE_REPLAY');
  }

  // ponytail: day is taken from the signed ts (sender's clock); balance is the hard cap anyway
  const dayStart = p.ts - ((p.ts + IST_OFFSET) % 86400);
  const { spent } = db.prepare('SELECT COALESCE(SUM(amount), 0) AS spent FROM transactions WHERE from_user_id = ? AND created_at >= ? AND created_at < ?')
    .get(sender.id, dayStart, dayStart + 86400);
  if (spent + p.amount > DAILY_OFFLINE_LIMIT) return fail(p.id, 'DAILY_LIMIT_EXCEEDED');

  // Pay from the offline allowance reserve when the payment falls inside one; otherwise (no voucher,
  // or it's already used up by earlier claims) from the sender's free balance.
  if (!drawFromAllowance(db, sender.id, p)) {
    const debit = db.prepare('UPDATE wallets SET confirmed_bal = confirmed_bal - ?, nonce_counter = MAX(nonce_counter, ?) WHERE user_id = ? AND confirmed_bal >= ?')
      .run(p.amount, p.nonce, sender.id, p.amount);
    if (!debit.changes) return fail(p.id, 'INSUFFICIENT_BALANCE');
  }
  if (recipient) db.prepare('UPDATE wallets SET confirmed_bal = confirmed_bal + ? WHERE user_id = ?').run(p.amount, recipient);

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`INSERT INTO transactions (id, from_user_id, to_user_id, amount, nonce, signature, mode, status, created_at, synced_at, expires_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(p.id, sender.id, recipient, p.amount, p.nonce, txn.signature, 'offline_p2p', 'confirmed', p.ts, now, Number.isSafeInteger(p.expires) ? p.expires : p.ts + 60);
  return { id: p.id, status: 'confirmed', settled: { id: p.id, ts: p.ts, from: sender.id, to: recipient, amount: p.amount } };
}

export function reconcileTransactions(userId, transactions) {
  const db = getDB();
  const reconcile = db.transaction(reconcileOne); // each txn is atomic on its own
  const settled = []; // newly settled payments, for notifications
  const results = transactions.map(txn => {
    try {
      const { settled: s, ...r } = reconcile(db, userId, txn);
      if (s) settled.push(s);
      return r;
    } catch (err) {
      console.error(`[Reconciler] ${txn?.id}: ${err.message}`);
      return fail(txn?.id, 'INTERNAL_ERROR');
    }
  });

  results.filter(r => r.status === 'failed').forEach(r => console.log(`[Reconciler] ${r.id} FAILED: ${r.fail_reason}`));
  const wallet = walletView(db.prepare('SELECT confirmed_bal, locked_bal, nonce_counter FROM wallets WHERE user_id = ?').get(userId));
  return { results, wallet, settled };
}
