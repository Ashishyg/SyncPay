import { getAllTxns, updateTxnStatus, getUserProfile, savePendingTxn } from './storageService';
import { batchSync, hasToken, getBalance, getTransactions } from './apiService';

// Sync lock — prevents concurrent sync calls that cause double-debit
let syncLock = false;

export async function runSync() {
  if (syncLock) {
    console.log('[Sync] Already running — skipping duplicate call');
    return { confirmed: 0, failed: 0, results: [] };
  }
  syncLock = true;

  try {
    if (!hasToken()) throw new Error('Not authenticated — cannot sync');

    // Get pending, failed, and unconfirmed_received txns
    const allTxns = await getAllTxns();
    const pending = allTxns.filter(t => 
      t.status === 'pending' || 
      t.status === 'failed' || 
      t.status === 'unconfirmed_received'
    );

    // Nothing to upload, but still pull the balance: payments addressed to us may have
    // been settled by the other phone's sync (e.g. a customer paying this merchant).
    if (pending.length === 0) return { confirmed: 0, failed: 0, results: [], serverWallet: await getBalance() };

    // Get the current user's ID so we can fill in from_user_id for sent txns
    const profile = await getUserProfile();
    const myUserId = profile?.userId;

    // Build payloads for the server
    const payloads = pending.map(txn => {
      const fromUserId = txn.from_user_id || txn.fromUserId || (txn.type === 'sent' ? myUserId : undefined);

      return {
        id: txn.id,
        type: txn.type, // 'sent' or 'received' — server needs this
        from_user_id: fromUserId,
        to_user_id: txn.to_user_id || txn.toUserId || (txn.type === 'received' ? myUserId : undefined),
        from_pub: txn.from_pub || txn.payload?.from,
        amount: txn.amount,
        nonce: txn.nonce,
        signature: txn.signature,
        payloadString: txn.payloadString || (txn.payload ? JSON.stringify(txn.payload) : undefined),
        mode: txn.mode || 'offline_p2p',
        created_at: txn.created_at,
        expires_at: txn.expires_at
      };
    });

    console.log('[Sync] Sending', payloads.length, 'transactions. User:', myUserId);

    // Send to real server
    const { results, wallet } = await batchSync(payloads);

    console.log('[Sync] Results:', JSON.stringify(results));

    // Process results locally — only update transaction STATUSES
    // Do NOT manipulate local wallet balance here. The server wallet
    // is authoritative and will override via updateBalance() in App.jsx.
    let confirmed = 0, failed = 0;
    for (const r of results) {
      const localTxn = pending.find(t => t.id === r.id);
      if (!localTxn) continue;

      if (r.status === 'confirmed') {
        await updateTxnStatus(r.id, 'confirmed');
        confirmed++;
      } else if (r.status === 'pending') {
        // Still waiting for receiver to sync, keep it pending
      } else {
        console.warn('[Sync] Failed txn:', r.id?.slice(0, 8), 'reason:', r.fail_reason);
        await updateTxnStatus(r.id, 'failed', r.fail_reason);
        failed++;
      }
    }

    return { confirmed, failed, results, serverWallet: wallet };
  } finally {
    syncLock = false;
  }
}

// Copy settled transactions this device doesn't know about (e.g. a payment to us that the
// other phone synced) into local history, so History/Home show them — offline too.
export async function pullServerHistory() {
  if (!navigator.onLine || !hasToken()) return 0;
  const [server, local] = await Promise.all([getTransactions(), getAllTxns()]);
  const known = new Set(local.map(t => t.id));
  const missing = server.filter(t => !known.has(t.id));
  for (const t of missing) {
    await savePendingTxn({
      id: t.id, type: t.type, amount: t.amount, created_at: t.created_at,
      status: 'confirmed', recipientName: t.counterparty, mode: 'offline_p2p', fromServer: true,
    });
  }
  return missing.length;
}

// Auto-sync when online
export function startConnectivityWatcher(onSync) {
  let debounceTimer = null;

  const trySync = () => {
    // Debounce: wait 1s after the LAST 'online' event before syncing
    // This prevents double-fire from rapid online/offline toggles
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (!hasToken()) return;
      try {
        const result = await runSync();
        if (result.confirmed + result.failed > 0) onSync(result);
      } catch (e) {
        console.error('Auto-sync failed:', e.message);
      }
    }, 1500);
  };

  window.addEventListener('online', trySync);
  if (navigator.onLine) trySync(); // initial sync on app load

  return () => {
    window.removeEventListener('online', trySync);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}
