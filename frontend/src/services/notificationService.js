/**
 * notificationService.js — Push real notifications to IndexedDB
 * 
 * Call pushNotification() from anywhere (auto-sync, payment flows, etc.)
 * The Notifications screen reads from this same store.
 */
import { saveNotification } from './storageService';

const fmt = (p) => '₹' + ((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

/**
 * Push a notification to IndexedDB and fire a DOM event so the
 * Notifications screen can refresh if it's open.
 */
export async function pushNotification({ type, title, body }) {
  const notif = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    body,
    timestamp: Date.now(),
    is_read: false,
  };
  await saveNotification(notif);
  // Fire a custom event so the Notifications screen can pick it up
  window.dispatchEvent(new Event('pp-notification'));
}

// ── Convenience helpers ──────────────────────────────────────────────

export async function notifyPaymentSent(amount, recipientName) {
  await pushNotification({
    type: 'payment_sent',
    title: 'Payment sent',
    body: `${fmt(amount)} sent to ${recipientName}. Transaction queued for settlement.`,
  });
}

export async function notifyPaymentReceived(amount, senderName) {
  await pushNotification({
    type: 'payment_received',
    title: 'Payment received',
    body: `You received ${fmt(amount)} from ${senderName || 'someone'}. Awaiting sync confirmation.`,
  });
}

export async function notifySyncComplete(confirmed, failed, balance) {
  if (confirmed === 0 && failed === 0) return; // Don't notify if nothing happened
  let body = '';
  if (confirmed > 0) body += `${confirmed} transaction${confirmed > 1 ? 's' : ''} confirmed. `;
  if (failed > 0) body += `${failed} failed. `;
  if (balance !== undefined) body += `Balance: ${fmt(balance)}.`;
  await pushNotification({
    type: 'sync_complete',
    title: 'Sync completed',
    body: body.trim(),
  });
}

export async function notifyBalanceUpdate(newBalance) {
  await pushNotification({
    type: 'balance_update',
    title: 'Balance updated',
    body: `Your wallet balance is now ${fmt(newBalance)}.`,
  });
}

export async function notifyTxnFailed(reason) {
  await pushNotification({
    type: 'txn_failed',
    title: 'Transaction failed',
    body: reason || 'A transaction could not be settled. Funds have been restored.',
  });
}
