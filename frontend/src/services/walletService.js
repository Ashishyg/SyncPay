import { getWalletState, saveWalletState } from './storageService';

const OFFLINE_TXN_LIMIT = 50000;    // ₹500 in paise
const DAILY_OFFLINE_LIMIT = 200000; // ₹2000 in paise

// Lock funds immediately when QR is generated.
// Spendable = confirmed_bal - locked_bal
// If spendable < amount → REJECT before QR is ever created.
export async function lockFunds(amount) {
  const state = await getWalletState();
  const spendable = state.confirmed_bal - state.locked_bal;

  if (amount > spendable) {
    throw new Error('INSUFFICIENT_BALANCE');
  }
  if (amount > OFFLINE_TXN_LIMIT) {
    throw new Error('EXCEEDS_OFFLINE_TXN_LIMIT');
  }

  const today = new Date().toISOString().split('T')[0];
  if (state.daily_date !== today) {
    state.daily_spent = 0;
    state.daily_date = today;
  }

  if (state.daily_spent + amount > DAILY_OFFLINE_LIMIT) {
    throw new Error('EXCEEDS_DAILY_LIMIT');
  }

  state.locked_bal += amount;
  state.daily_spent += amount;
  state.nonce += 1;

  await saveWalletState(state);
  return { nonce: state.nonce, spendable_after: spendable - amount };
}

export async function unlockFunds(amount) {
  const state = await getWalletState();
  state.locked_bal = Math.max(0, state.locked_bal - amount);
  state.daily_spent = Math.max(0, state.daily_spent - amount);
  await saveWalletState(state);
}

export async function confirmSentFunds(amount) {
  const state = await getWalletState();
  state.confirmed_bal -= amount;
  state.locked_bal = Math.max(0, state.locked_bal - amount);
  await saveWalletState(state);
}

export async function revertFailedTxn(amount) {
  const state = await getWalletState();
  state.locked_bal = Math.max(0, state.locked_bal - amount);
  await saveWalletState(state);
}

export async function addUnconfirmedReceived(amount) {
  const state = await getWalletState();
  state.unconfirmed_received = (state.unconfirmed_received || 0) + amount;
  await saveWalletState(state);
}

export async function confirmReceivedFunds(amount) {
  const state = await getWalletState();
  state.confirmed_bal += amount;
  state.unconfirmed_received = Math.max(0, (state.unconfirmed_received || 0) - amount);
  await saveWalletState(state);
}

export async function deductWithdrawal(amount) {
  const state = await getWalletState();
  if (state.confirmed_bal < amount) throw new Error('INSUFFICIENT_BALANCE');
  state.confirmed_bal -= amount;
  await saveWalletState(state);
}

export async function addTopUp(amount) {
  const state = await getWalletState();
  state.confirmed_bal += amount;
  await saveWalletState(state);
}

export async function getSpendable() {
  const state = await getWalletState();
  return state.confirmed_bal - state.locked_bal;
}

export { OFFLINE_TXN_LIMIT, DAILY_OFFLINE_LIMIT };
