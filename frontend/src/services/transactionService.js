import { signTransaction, verifySignature } from './cryptoService';
import { lockFunds } from './walletService';
import { markNonceUsed, isNonceUsed, savePendingTxn } from './storageService';

const QR_TTL_SECONDS = 60;

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c === 'x' ? 0 : 3);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function createSendTransaction({ amount, recipientId, recipientName, privateKey, senderPubKey }) {
  // Step 1: Lock funds (throws if insufficient)
  const { nonce } = await lockFunds(amount);

  const now = Math.floor(Date.now() / 1000);
  const txnId = uuidv4();

  // Step 2: Build signable payload
  const payload = {
    v: 1,
    qrType: 'dynamic',   // ← distinguishes from static merchant QR
    id: txnId,
    from: senderPubKey,
    to: recipientId || null,
    amount,
    nonce,
    ts: now,
    expires: now + QR_TTL_SECONDS
  };

  // Step 3: Sign with private key
  // signTransaction internally does JSON.stringify(payload) -- capture that exact string
  const signature = await signTransaction(payload, privateKey);
  const payloadString = JSON.stringify(payload);

  // Step 4: Mark nonce used locally
  await markNonceUsed(nonce, txnId);

  // Step 5: Save as pending outgoing (include payloadString for backend sync)
  await savePendingTxn({
    id: txnId,
    type: 'sent',
    amount,
    nonce,
    signature,
    payload,
    payloadString,
    from_pub: senderPubKey,
    to_user_id: recipientId || null,
    recipientName: recipientName || 'Unknown',
    status: 'pending',
    created_at: now,
    expires_at: now + QR_TTL_SECONDS
  });

  return {
    qrData: btoa(JSON.stringify({ ...payload, sig: signature })),
    txnId,
    expiresAt: now + QR_TTL_SECONDS
  };
}

export async function receiveTransaction(qrDataB64) {
  const raw = JSON.parse(atob(qrDataB64));
  const { sig, ...payload } = raw;

  const now = Math.floor(Date.now() / 1000);

  if (now > payload.expires) {
    throw new Error('QR_EXPIRED');
  }

  if (payload.amount <= 0 || payload.amount > 50000) {
    throw new Error('INVALID_AMOUNT');
  }

  // Verify signature
  const valid = await verifySignature(payload, sig, payload.from);
  if (!valid) throw new Error('INVALID_SIGNATURE');

  // Check nonce not already used locally
  const used = await isNonceUsed(payload.nonce);
  if (used) throw new Error('NONCE_ALREADY_USED');

  // Mark nonce used on receiver side too
  await markNonceUsed(payload.nonce, payload.id);

  // Save as pending incoming
  await savePendingTxn({
    id: payload.id,
    type: 'received',
    amount: payload.amount,
    nonce: payload.nonce,
    signature: sig,
    payload,
    from_pub: payload.from,
    status: 'unconfirmed_received',
    created_at: payload.ts
  });

  return {
    txnId: payload.id,
    amount: payload.amount,
    fromPubKey: payload.from,
    isValid: true
  };
}

export { QR_TTL_SECONDS };
