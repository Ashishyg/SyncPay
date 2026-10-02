import { openDB } from 'idb';

const DB_NAME = 'syncpay_db';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Key store
      db.createObjectStore('key_store');

      // Wallet state
      db.createObjectStore('wallet_state');

      // Pending transactions
      const txnStore = db.createObjectStore('pending_txns', { keyPath: 'id' });
      txnStore.createIndex('by_status', 'status');
      txnStore.createIndex('by_nonce', 'nonce');

      // Used nonces (replay protection)
      db.createObjectStore('used_nonces', { keyPath: 'nonce' });

      // Notifications cache
      db.createObjectStore('notifications', { keyPath: 'id' });

      // User profile
      db.createObjectStore('user_profile');
    }
  });
}

// Key store operations
export async function saveKeys({ pubKey, encryptedKey, iv, salt }) {
  const db = await getDB();
  const tx = db.transaction('key_store', 'readwrite');
  await tx.store.put(pubKey, 'pub_key');
  await tx.store.put(encryptedKey, 'enc_priv_key');
  await tx.store.put(iv, 'iv');
  await tx.store.put(salt, 'salt');
  await tx.done;
}

export async function getKeys() {
  const db = await getDB();
  const [pubKey, encPrivKey, iv, salt] = await Promise.all([
    db.get('key_store', 'pub_key'),
    db.get('key_store', 'enc_priv_key'),
    db.get('key_store', 'iv'),
    db.get('key_store', 'salt')
  ]);
  return { pubKey, encPrivKey, iv, salt };
}

export async function wipeKeys() {
  const db = await getDB();
  await db.clear('key_store');
  await db.clear('wallet_state');
  await db.clear('pending_txns');
  await db.clear('used_nonces');
  await db.clear('user_profile');
  await db.clear('notifications');
}

// User profile
export async function saveUserProfile(profile) {
  const db = await getDB();
  await db.put('user_profile', profile, 'profile');
}

export async function getUserProfile() {
  const db = await getDB();
  return db.get('user_profile', 'profile');
}

// Wallet state
export async function getWalletState() {
  const db = await getDB();
  return (await db.get('wallet_state', 'state')) || {
    confirmed_bal: 0,
    locked_bal: 0,
    unconfirmed_received: 0,
    nonce: 0,
    daily_spent: 0,
    daily_date: ''
  };
}

export async function saveWalletState(state) {
  const db = await getDB();
  await db.put('wallet_state', state, 'state');
}

// Transaction operations
export async function savePendingTxn(txn) {
  const db = await getDB();
  await db.put('pending_txns', txn);
}

export async function getPendingTxns() {
  const db = await getDB();
  return db.getAllFromIndex('pending_txns', 'by_status', 'pending');
}

export async function getAllTxns() {
  const db = await getDB();
  return db.getAll('pending_txns');
}

export async function getTxnById(id) {
  const db = await getDB();
  return db.get('pending_txns', id);
}

export async function updateTxnStatus(id, status, failReason = null) {
  const db = await getDB();
  const txn = await db.get('pending_txns', id);
  if (txn) {
    txn.status = status;
    txn.fail_reason = failReason;
    await db.put('pending_txns', txn);
  }
}

export async function deletePendingTxn(id) {
  const db = await getDB();
  await db.delete('pending_txns', id);
}

// Nonce management
export async function markNonceUsed(nonce, txnId) {
  const db = await getDB();
  await db.put('used_nonces', { nonce, txn_id: txnId, ts: Date.now() });
}

export async function isNonceUsed(nonce) {
  const db = await getDB();
  const record = await db.get('used_nonces', nonce);
  return !!record;
}

// Notifications
export async function saveNotification(notif) {
  const db = await getDB();
  await db.put('notifications', notif);
}

export async function getNotifications() {
  const db = await getDB();
  return db.getAll('notifications');
}

export async function markNotifRead(id) {
  const db = await getDB();
  const n = await db.get('notifications', id);
  if (n) {
    n.is_read = true;
    await db.put('notifications', n);
  }
}
