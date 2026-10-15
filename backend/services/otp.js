// OTP delivery. Channel is picked once at startup:
//   WHATSAPP_ENABLED=true            → our own 6-digit code sent over WhatsApp (free, Baileys)
//   TWILIO_VERIFY_SID=VA...          → Twilio Verify SMS
//   neither (dev only)               → fixed mock code 123456
import crypto from 'crypto';
import twilio from 'twilio';
import { getDB } from '../db.js';
import { isWhatsAppReady, sendWhatsApp } from './whatsapp.js';

export const MOCK_OTP = '123456';
const OTP_TTL = 300;      // 5 minutes
const MAX_ATTEMPTS = 5;   // per code

export const OTP_CHANNEL = process.env.WHATSAPP_ENABLED === 'true' ? 'whatsapp'
  : process.env.TWILIO_VERIFY_SID?.startsWith('VA') ? 'sms'
  : 'mock';
if (OTP_CHANNEL === 'mock' && process.env.NODE_ENV === 'production') {
  throw new Error('Configure WhatsApp or Twilio Verify for OTP in production (mock OTP is dev-only)');
}

const verifyService = OTP_CHANNEL === 'sms'
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN).verify.v2.services(process.env.TWILIO_VERIFY_SID)
  : null;

const hashCode = (phone, code) => crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex');

export class OtpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function sendOtp(phone) {
  if (OTP_CHANNEL === 'sms') return void await verifyService.verifications.create({ to: phone, channel: 'sms' });
  if (OTP_CHANNEL === 'mock') return void console.log(`⚠️ MOCK OTP (${MOCK_OTP}) for ${phone}`);

  if (!isWhatsAppReady()) throw new OtpError(503, 'WhatsApp is not connected on the server yet. Try again shortly.');
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  getDB().prepare(`INSERT INTO otp_sessions (phone, otp_hash, expires_at, attempts) VALUES (?,?,?,0)
                   ON CONFLICT(phone) DO UPDATE SET otp_hash = excluded.otp_hash, expires_at = excluded.expires_at, attempts = 0`)
    .run(phone, hashCode(phone, code), Math.floor(Date.now() / 1000) + OTP_TTL);
  const sent = await sendWhatsApp(phone, `${code} is your SyncPay verification code. It expires in 5 minutes. Don't share it with anyone.`);
  if (!sent) throw new OtpError(502, 'Could not send the code on WhatsApp. Is this number on WhatsApp?');
}

export async function checkOtp(phone, code) {
  if (OTP_CHANNEL === 'sms') return (await verifyService.verificationChecks.create({ to: phone, code })).status === 'approved';
  if (OTP_CHANNEL === 'mock') return code === MOCK_OTP;

  const db = getDB();
  const row = db.prepare('SELECT otp_hash, expires_at, attempts FROM otp_sessions WHERE phone = ?').get(phone);
  if (!row || row.expires_at < Math.floor(Date.now() / 1000) || row.attempts >= MAX_ATTEMPTS) return false;
  db.prepare('UPDATE otp_sessions SET attempts = attempts + 1 WHERE phone = ?').run(phone);
  const ok = crypto.timingSafeEqual(Buffer.from(row.otp_hash), Buffer.from(hashCode(phone, code)));
  if (ok) db.prepare('DELETE FROM otp_sessions WHERE phone = ?').run(phone); // single use
  return ok;
}
