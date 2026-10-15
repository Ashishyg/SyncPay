import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { parseSyncSms, verifyGatewaySignature, normalizePhone } from '../services/sms.js';

test('parses SP1 messages, ignores everything else', () => {
  const p = '{"v":1,"id":"a","from":"k+/=","amount":100}';
  assert.deepEqual(parseSyncSms(`SP1\r\n${p} c2ln+/==\n${p} c2ln2==`), [
    { payloadString: p, signature: 'c2ln+/==' },
    { payloadString: p, signature: 'c2ln2==' },
  ]);
  assert.equal(parseSyncSms('Hi, your order shipped'), null);
  assert.deepEqual(parseSyncSms('SP1'), []);
});

test('gateway signature: valid, tampered, stale', () => {
  const key = 'k', body = Buffer.from('{"event":"sms:received"}'), ts = 1_000_000;
  const sig = crypto.createHmac('sha256', key).update(body.toString() + ts).digest('hex');
  assert.equal(verifyGatewaySignature(body, ts, sig, key, ts), true);
  assert.equal(verifyGatewaySignature(Buffer.from('{"event":"x"}'), ts, sig, key, ts), false);
  assert.equal(verifyGatewaySignature(body, ts, sig, key, ts + 3600), false);
  assert.equal(verifyGatewaySignature(body, ts, sig, 'wrong', ts), false);
});

test('normalizes Indian numbers to +91 E.164', () => {
  for (const n of ['9876543210', '+91 98765 43210', '919876543210']) assert.equal(normalizePhone(n), '+919876543210');
});
