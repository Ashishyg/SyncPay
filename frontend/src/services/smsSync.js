// SMS sync: for phones with signal but no data. Opens the phone's own SMS app with the
// signed payments pre-filled, addressed to the gateway number. The user taps Send; the
// gateway phone forwards it to the server (POST /api/sms/inbound), which settles them.
// Format must match backend/services/sms.js:  "SP1\n<payloadString> <signature>\n…"
import { getAllTxns, savePendingTxn } from './storageService';

export const SMS_GATEWAY = import.meta.env.VITE_SMS_GATEWAY_NUMBER || '';
const PER_SMS = 3; // ~320 chars each → keeps one message to ~6 SMS segments

export async function smsSyncCandidates() {
  const all = await getAllTxns();
  return all.filter(t => (t.status === 'pending' || t.status === 'unconfirmed_received') && t.payloadString && t.signature);
}

// Returns how many payments were put in the message (0 = nothing to send).
export async function sendSmsSync() {
  const txns = (await smsSyncCandidates()).slice(0, PER_SMS);
  if (!txns.length || !SMS_GATEWAY) return 0;
  const body = ['SP1', ...txns.map(t => `${t.payloadString} ${t.signature}`)].join('\n');
  const sep = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?'; // iOS uses sms:NUM&body=
  const now = Date.now();
  for (const t of txns) await savePendingTxn({ ...t, sms_sent_at: now });
  window.location.href = `sms:${SMS_GATEWAY}${sep}body=${encodeURIComponent(body)}`;
  return txns.length;
}
