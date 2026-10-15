// SMS sync: a phone with signal but no data texts its signed payments to a gateway number.
// The gateway is an Android phone running "SMS Gateway for Android" (sms-gate.app), which
// forwards each received SMS to POST /api/sms/inbound as a signed webhook.
//
// Message format (built by the app, sent from the user's own SIM):
//   SP1
//   <payloadString> <signature>
//   <payloadString> <signature>
// payloadString is the exact signed JSON (no spaces); signature is base64 (no spaces).
import crypto from 'crypto';

export const SMS_PREFIX = 'SP1';
const MAX_SKEW_SECONDS = 300;

// sms-gate.app signs: hex HMAC-SHA256(rawBody + X-Timestamp) with the webhook signing key.
export function verifyGatewaySignature(rawBody, timestamp, signature, key, now = Math.floor(Date.now() / 1000)) {
  if (!rawBody || !timestamp || !signature || !key) return false;
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_SECONDS) return false; // replay window
  const expected = crypto.createHmac('sha256', key).update(Buffer.concat([Buffer.from(rawBody), Buffer.from(String(timestamp))])).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature).toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function parseSyncSms(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines[0] !== SMS_PREFIX) return null;
  return lines.slice(1, 11).map(line => {
    const i = line.lastIndexOf(' ');
    return i > 0 ? { payloadString: line.slice(0, i), signature: line.slice(i + 1) } : null;
  }).filter(Boolean);
}

// Gateway senders arrive as "+919876543210", "919876543210" or "9876543210"; users are stored as +91XXXXXXXXXX.
export function normalizePhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) return '+91' + d;
  return '+' + d;
}
