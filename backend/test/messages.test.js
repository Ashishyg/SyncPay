import { test } from 'node:test';
import assert from 'node:assert/strict';
import { otpMessage, receivedMessage, settledMessage } from '../services/messages.js';

const ts = Date.UTC(2026, 9, 15, 16, 12) / 1000; // 15 Oct 2026, 9:42 pm IST

test('payment received alert: amount, sender, ref, IST time, balance', () => {
  const m = receivedMessage({ amount: 15000, fromName: 'Riya Sharma', id: 'sf8g9xyY6kfj', ts, balance: 177500 });
  assert.match(m, /\*₹150\.00\* from \*Riya Sharma\*/);
  assert.match(m, /Ref: SF8G9XYY/);
  assert.match(m, /15 Oct 2026, 9:42 pm/i);
  assert.match(m, /Balance: \*₹1,775\.00\*/);
});

test('settled alert: names the receiver, or explains an open QR payment', () => {
  assert.match(settledMessage({ amount: 2500, toName: 'Kirana Store', id: 'x', ts, balance: 0 }), /\*₹25\.00\* to \*Kirana Store\*/);
  assert.match(settledMessage({ amount: 2500, toName: null, id: 'x', ts, balance: 0 }), /paid by QR[\s\S]*next sync/);
});

test('few emojis: at most one per message', () => {
  const emoji = /\p{Extended_Pictographic}/gu;
  for (const m of [otpMessage('482913'), receivedMessage({ amount: 1, fromName: 'A', id: 'x', ts, balance: 1 }), settledMessage({ amount: 1, toName: 'B', id: 'x', ts, balance: 1 })]) {
    assert.ok((m.match(emoji) || []).length <= 1, m);
  }
});
