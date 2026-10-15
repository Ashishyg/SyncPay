// Offline spending allowance.
// While online, a phone gets a voucher signed by the server: "this key may spend up to `c` paise
// offline, using payment numbers a..b, until e". The amount is RESERVED from the balance (moved to
// wallets.locked_bal), so it can't be withdrawn or spent online. Receivers check the voucher offline;
// at settlement a payment inside the voucher draws from the reserve, so it is guaranteed to settle —
// unless the sender double-spends the same allowance (first to settle wins; the rest fall back to
// the sender's free balance). Bounds offline risk; it can't make double-spending impossible.
import { serverSign, SERVER_PUB } from './serverKey.js';

export const ALLOWANCE_CAP = 200000;        // ₹2,000 (same as the daily offline limit)
export const ALLOWANCE_TTL = 3 * 86400;     // valid 3 days
export const ALLOWANCE_NONCES = 50;         // payment numbers per voucher
export const ALLOWANCE_GRACE = 2 * 86400;   // unspent reserve returns 2 days after expiry (late syncs)
const RENEW_BEFORE = 86400;                 // issue a fresh voucher during its last day

// Exactly what the server signs and phones verify (no JSON: unambiguous, order-free)
export const voucherString = ({ pub, c, a, b, e }) => `SPAL1|${pub}|${c}|${a}|${b}|${e}`;

const toVoucher = (row, pub) => ({ c: row.cap, a: row.nonce_lo, b: row.nonce_hi, e: row.expires_at, s: row.sig, pub });

// Return expired allowances' unspent reserve to the free balance, once late syncs have had time.
export function releaseExpired(db, userId, now) {
  const rows = db.prepare('SELECT id, cap, spent FROM allowances WHERE user_id = ? AND released = 0 AND expires_at + ? < ?')
    .all(userId, ALLOWANCE_GRACE, now);
  for (const r of rows) {
    const left = r.cap - r.spent;
    db.prepare('UPDATE allowances SET released = 1 WHERE id = ?').run(r.id);
    db.prepare('UPDATE wallets SET confirmed_bal = confirmed_bal + ?, locked_bal = locked_bal - ? WHERE user_id = ?').run(left, left, userId);
  }
}

// The current voucher, or a new one when there is none / it's in its last day / it's used up.
// Returns null when the user has no money to reserve.
export function getOrIssueAllowance(db, user, now = Math.floor(Date.now() / 1000)) {
  return db.transaction(() => {
    releaseExpired(db, user.id, now);
    const cur = db.prepare('SELECT * FROM allowances WHERE user_id = ? AND released = 0 AND expires_at > ? ORDER BY expires_at DESC LIMIT 1')
      .get(user.id, now);
    if (cur && cur.expires_at - now > RENEW_BEFORE && cur.spent < cur.cap) return toVoucher(cur, user.pub_key);

    const w = db.prepare('SELECT confirmed_bal, nonce_counter FROM wallets WHERE user_id = ?').get(user.id);
    const cap = Math.min(ALLOWANCE_CAP, w.confirmed_bal);
    if (cap < 100) return cur ? toVoucher(cur, user.pub_key) : null; // less than ₹1 free

    const { maxHi } = db.prepare('SELECT MAX(nonce_hi) AS maxHi FROM allowances WHERE user_id = ?').get(user.id);
    const a = Math.max(w.nonce_counter, maxHi || 0) + 1, b = a + ALLOWANCE_NONCES - 1, e = now + ALLOWANCE_TTL;
    const sig = serverSign(voucherString({ pub: user.pub_key, c: cap, a, b, e }));
    const info = db.prepare('INSERT INTO allowances (user_id, cap, nonce_lo, nonce_hi, expires_at, sig) VALUES (?,?,?,?,?,?)')
      .run(user.id, cap, a, b, e, sig);
    db.prepare('UPDATE wallets SET confirmed_bal = confirmed_bal - ?, locked_bal = locked_bal + ? WHERE user_id = ?').run(cap, cap, user.id);
    return toVoucher({ cap, nonce_lo: a, nonce_hi: b, expires_at: e, sig, id: info.lastInsertRowid }, user.pub_key);
  })();
}

// Settlement: draw from the allowance covering this payment number, if it can still cover it.
// Returns true when the payment was paid from the reserve.
export function drawFromAllowance(db, senderId, p) {
  const al = db.prepare('SELECT id, cap, spent, expires_at FROM allowances WHERE user_id = ? AND released = 0 AND ? BETWEEN nonce_lo AND nonce_hi')
    .get(senderId, p.nonce);
  if (!al || p.ts > al.expires_at || al.spent + p.amount > al.cap) return false;
  db.prepare('UPDATE allowances SET spent = spent + ? WHERE id = ?').run(p.amount, al.id);
  db.prepare('UPDATE wallets SET locked_bal = locked_bal - ?, nonce_counter = MAX(nonce_counter, ?) WHERE user_id = ?').run(p.amount, p.nonce, senderId);
  return true;
}

// What clients see: total money (free + reserved), what's reserved for offline, what can be withdrawn.
export const walletView = (w) => w && ({
  confirmed_bal: w.confirmed_bal + w.locked_bal,
  reserved_bal: w.locked_bal,
  withdrawable: w.confirmed_bal,
  nonce_counter: w.nonce_counter,
});

export { SERVER_PUB };
