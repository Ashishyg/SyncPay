import { signTransaction, arrayToBase64, verifyText } from './cryptoService';
import { lockFunds } from './walletService';
import { markNonceUsed, savePendingTxn, getTxnById } from './storageService';

const QR_TTL_SECONDS = 60;

// 128-bit random id, base64url (22 chars instead of a 36-char UUID: keeps the QR small)
const newTxnId = () => arrayToBase64(crypto.getRandomValues(new Uint8Array(16))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function createSendTransaction({ amount, recipientId, recipientName, recipientPub, privateKey, senderPubKey }) {
  // Step 1: Lock funds inside the offline allowance (throws if it can't cover the payment)
  const { nonce, voucher } = await lockFunds(amount);

  const now = Math.floor(Date.now() / 1000);
  const txnId = newTxnId();

  // Step 2: Build signable payload (expiry is implicit: ts + QR_TTL_SECONDS)
  const payload = {
    id: txnId,
    from: senderPubKey,
    to: recipientId || null,
    amount,
    nonce,
    ts: now,
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
    to_pub: recipientPub || null,   // lets this phone verify a merchant's receipt later
    recipientName: recipientName || 'Unknown',
    status: 'pending',
    created_at: now,
    expires_at: now + QR_TTL_SECONDS
  });

  // The QR carries the signed payment + the server-signed allowance voucher (outside the
  // payment signature: the receiver checks it separately against the server's key).
  const al = { c: voucher.c, a: voucher.a, b: voucher.b, e: voucher.e, s: voucher.s };
  return {
    qrData: JSON.stringify({ ...payload, sig: signature, al }),
    txnId,
    expiresAt: now + QR_TTL_SECONDS
  };
}

// Receipt = the receiver's signature over "SPRC1|<payment id>|<amount>|<their key>|<time>",
// scanned by the payer as offline proof. Throws Error(<user-facing reason>) if it doesn't check out.
export async function applyReceipt(r) {
  const txn = r?.id && await getTxnById(r.id);
  if (!txn || txn.type !== 'sent') throw new Error('This receipt is for a payment not made from this phone');
  if (txn.amount !== r.amt) throw new Error('Receipt amount doesn’t match the payment');
  if (!(await verifyText(`SPRC1|${r.id}|${r.amt}|${r.by}|${r.ts}`, r.s, r.by))) throw new Error('Receipt signature is not valid');
  // For a merchant payment we know the shop's key: the receipt must come from that shop
  if (txn.to_pub && txn.to_pub !== r.by) throw new Error('Receipt was signed by someone other than the merchant you paid');
  await savePendingTxn({ ...txn, receipt: { by: r.by, ts: r.ts, s: r.s, fromMerchant: !!txn.to_pub } });
  return txn;
}

export { QR_TTL_SECONDS };
