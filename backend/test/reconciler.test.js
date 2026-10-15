// Run: npm test   (uses a throwaway SQLite file)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `syncpay-test-${Date.now()}.db`);
const { initDB } = await import('../db.js');
const { reconcileTransactions } = await import('../services/reconciler.js');
const db = initDB();

function makeUser(name, balance) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO users (id, phone, name, pub_key) VALUES (?,?,?,?)').run(id, '+91' + Math.random().toString().slice(2, 12), name, pub);
  db.prepare('INSERT INTO wallets (id, user_id, confirmed_bal) VALUES (?,?,?)').run(crypto.randomUUID(), id, balance);
  return { id, pub, privateKey };
}
// Mirrors frontend transactionService.createSendTransaction
function pay(from, amount, nonce, to = 'unknown') {
  const ts = Math.floor(Date.now() / 1000);
  const payload = { v: 1, qrType: 'dynamic', id: crypto.randomUUID(), from: from.pub, to, amount, nonce, ts, expires: ts + 60 };
  const payloadString = JSON.stringify(payload);
  const signature = crypto.sign(null, Buffer.from(payloadString), from.privateKey).toString('base64');
  return { id: payload.id, amount, nonce, payloadString, signature };
}
const bal = (u) => db.prepare('SELECT confirmed_bal FROM wallets WHERE user_id = ?').get(u.id).confirmed_bal;
const sync = (u, ...txns) => reconcileTransactions(u.id, txns).results;

test('sender syncs first, receiver claims the stored amount even if it lies', () => {
  const a = makeUser('A', 10000), b = makeUser('B', 0);
  const t = pay(a, 1000, 1);
  assert.equal(sync(a, t)[0].status, 'confirmed');
  assert.equal(sync(b, { ...t, amount: 9_999_999 })[0].status, 'confirmed');
  assert.equal(bal(a), 9000);
  assert.equal(bal(b), 1000);
});

test('second claimant cannot steal an already-claimed payment', () => {
  const a = makeUser('A', 10000), b = makeUser('B', 0), c = makeUser('C', 0);
  const t = pay(a, 1000, 1);
  sync(b, t);
  assert.equal(sync(c, t)[0].fail_reason, 'ALREADY_CLAIMED');
  assert.equal(bal(c), 0);
});

test('payment signed for a specific user cannot be redirected', () => {
  const a = makeUser('A', 10000), b = makeUser('B', 0), c = makeUser('C', 0);
  const t = pay(a, 1000, 1, b.id);
  assert.equal(sync(c, { ...t, to_user_id: c.id })[0].fail_reason, 'NOT_RECIPIENT');
  assert.equal(sync(a, t)[0].status, 'confirmed');
  assert.equal(bal(b), 1000);
});

test('tampered amount fails signature check', () => {
  const a = makeUser('A', 100000), b = makeUser('B', 0);
  const t = pay(a, 1000, 1);
  const forged = { ...t, payloadString: t.payloadString.replace('"amount":1000', '"amount":40000') };
  assert.equal(sync(b, forged)[0].fail_reason, 'INVALID_SIGNATURE');
  assert.equal(bal(b), 0);
});

test('out-of-order nonces both settle; replay of a nonce fails', () => {
  const a = makeUser('A', 10000), b = makeUser('B', 0);
  const t1 = pay(a, 100, 1), t2 = pay(a, 200, 2);
  assert.equal(sync(b, t2)[0].status, 'confirmed');
  assert.equal(sync(b, t1)[0].status, 'confirmed');
  assert.equal(sync(b, pay(a, 300, 2))[0].fail_reason, 'NONCE_REPLAY');
  assert.equal(bal(b), 300);
});

test('limits and balance are enforced server-side', () => {
  const a = makeUser('A', 1_000_000), b = makeUser('B', 0), poor = makeUser('P', 100);
  assert.equal(sync(b, pay(a, 50001, 1))[0].fail_reason, 'INVALID_AMOUNT');
  sync(b, pay(a, 50000, 2), pay(a, 50000, 3), pay(a, 50000, 4), pay(a, 50000, 5));
  assert.equal(sync(b, pay(a, 100, 6))[0].fail_reason, 'DAILY_LIMIT_EXCEEDED');
  assert.equal(sync(b, pay(poor, 101, 1))[0].fail_reason, 'INSUFFICIENT_BALANCE');
});
