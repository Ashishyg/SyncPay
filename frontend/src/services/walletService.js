import { getWalletState, saveWalletState, getAllTxns } from './storageService';
import { requestAllowance, hasToken } from './apiService';

const OFFLINE_TXN_LIMIT = 50000;    // ₹500 in paise
const DAILY_OFFLINE_LIMIT = 200000; // ₹2000 in paise

const nowSec = () => Math.floor(Date.now() / 1000);

// Offline money left on this phone: the server-backed allowance minus payments already made with it.
export const allowanceLeft = (s) =>
  s?.allowance && s.allowance.e > nowSec() ? Math.max(0, s.allowance.c - (s.allowance_used || 0)) : 0;

// Lock funds when a payment QR is created. Offline payments must fit inside the allowance voucher
// (amount and payment number), so the receiver can check it's backed by reserved money.
export async function lockFunds(amount) {
  const state = await getWalletState();
  const al = state.allowance;
  if (!al || al.e <= nowSec()) throw new Error('NO_ALLOWANCE');
  if (amount > OFFLINE_TXN_LIMIT) throw new Error('EXCEEDS_OFFLINE_TXN_LIMIT');
  if (amount > allowanceLeft(state)) throw new Error('INSUFFICIENT_ALLOWANCE');

  const today = new Date().toISOString().split('T')[0];
  if (state.daily_date !== today) {
    state.daily_spent = 0;
    state.daily_date = today;
  }
  if (state.daily_spent + amount > DAILY_OFFLINE_LIMIT) throw new Error('EXCEEDS_DAILY_LIMIT');

  const nonce = Math.max(state.nonce || 0, al.a - 1) + 1; // payment numbers come from the voucher's range
  if (nonce > al.b) throw new Error('ALLOWANCE_EXHAUSTED');

  state.locked_bal = (state.locked_bal || 0) + amount;
  state.daily_spent += amount;
  state.allowance_used = (state.allowance_used || 0) + amount;
  state.nonce = nonce;
  await saveWalletState(state);
  return { nonce, voucher: al };
}

export async function unlockFunds(amount) {
  const state = await getWalletState();
  state.locked_bal = Math.max(0, (state.locked_bal || 0) - amount);
  state.daily_spent = Math.max(0, (state.daily_spent || 0) - amount);
  state.allowance_used = Math.max(0, (state.allowance_used || 0) - amount);
  await saveWalletState(state);
}

export async function addUnconfirmedReceived(amount) {
  const state = await getWalletState();
  state.unconfirmed_received = (state.unconfirmed_received || 0) + amount;
  await saveWalletState(state);
}

// Server wallet → local state. The server is the authority on money; "locked" and "incoming"
// are this phone's own unsettled payments. The local payment number never moves backwards.
export async function applyServerWallet(w) {
  if (!w) return;
  const [state, all] = await Promise.all([getWalletState(), getAllTxns()]);
  const sum = (status) => all.filter(t => t.status === status).reduce((s, t) => s + t.amount, 0);
  state.confirmed_bal = w.confirmed_bal;
  state.reserved_bal = w.reserved_bal ?? 0;
  state.withdrawable = w.withdrawable ?? w.confirmed_bal;
  state.locked_bal = sum('pending');
  state.unconfirmed_received = sum('unconfirmed_received');
  state.nonce = Math.max(state.nonce || 0, w.nonce_counter || 0);
  await saveWalletState(state);
}

// Fetch (or renew) the offline allowance voucher while online. Also caches the server's public key,
// which this phone needs to check other people's vouchers when it receives a payment offline.
export async function refreshAllowance() {
  if (!navigator.onLine || !hasToken()) return null;
  const { voucher, wallet, serverPub } = await requestAllowance();
  if (serverPub) localStorage.setItem('sp_server_pub', serverPub);
  await applyServerWallet(wallet);
  const [state, all] = await Promise.all([getWalletState(), getAllTxns()]);
  if (voucher) {
    state.allowance = voucher;
    state.allowance_used = all
      .filter(t => t.type === 'sent' && t.status !== 'failed' && t.nonce >= voucher.a && t.nonce <= voucher.b)
      .reduce((s, t) => s + t.amount, 0);
    state.nonce = Math.max(state.nonce || 0, voucher.a - 1);
  } else {
    state.allowance = null;
    state.allowance_used = 0;
  }
  await saveWalletState(state);
  return voucher;
}

export { OFFLINE_TXN_LIMIT, DAILY_OFFLINE_LIMIT };
