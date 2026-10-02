import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { addMoney as addMoneyAPI } from '../services/apiService';
import { addTopUp } from '../services/walletService';
import { savePendingTxn } from '../services/storageService';
import { notifyBalanceUpdate } from '../services/notificationService';

const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const QUICK = [500, 1000, 2000, 5000];

const METHODS = [
  { icon: 'account_balance_wallet', label: 'UPI Transfer', desc: 'Instant · No charges', color: 'text-primary bg-primary/10' },
  { icon: 'account_balance',        label: 'Net Banking',  desc: 'NEFT/IMPS · 1–2 hours', color: 'text-blue-400 bg-blue-500/10' },
  { icon: 'credit_card',            label: 'Debit Card',   desc: 'Visa / RuPay / Mastercard', color: 'text-emerald-400 bg-emerald-500/10' },
];

export default function AddMoney() {
  const navigate = useNavigate();
  const { confirmed_bal, isOnline, loadWalletState } = useWalletStore();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const doAdd = async () => {
    const amt = Math.round(parseFloat(amount) * 100);
    if (!amt || amt <= 0) return setError('Enter a valid amount');
    setLoading(true); setError('');
    try {
      if (isOnline) {
        const result = await addMoneyAPI(amt);
        if (result.wallet) {
          const { updateBalance } = useWalletStore.getState();
          await updateBalance({ confirmed_bal: result.wallet.confirmed_bal, locked_bal: result.wallet.locked_bal });
        }
      } else {
        await addTopUp(amt);
      }
      // Save to IndexedDB so it shows in History and Dashboard
      await savePendingTxn({
        id: 'topup-' + Date.now(),
        type: 'received',
        amount: amt,
        recipientName: 'Top Up',
        status: 'confirmed',
        mode: 'top_up',
        created_at: Math.floor(Date.now() / 1000),
      });
      await loadWalletState();
      const { confirmed_bal: newBal } = useWalletStore.getState();
      await notifyBalanceUpdate(newBal);
      setSuccess(true);
      setTimeout(() => navigate('/home'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to add money');
    }
    setLoading(false);
  };

  const balancePct = Math.min(100, (confirmed_bal / 1000000) * 100);

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-8">
        <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-5xl text-emerald-400">check_circle</span>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-white mb-2">Money Added!</h2>
          <p className="text-slate-400">{fmt(Math.round(parseFloat(amount) * 100))} added to your wallet</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-20 w-full">
      {/* Header */}
      <header className="fixed top-14 lg:top-0 right-0 lg:left-64 left-0 h-16 lg:h-20 bg-background/80 backdrop-blur-xl border-b border-outline-variant/15 px-4 lg:px-10 flex items-center gap-4 z-30">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5">
          <span className="material-symbols-outlined text-slate-400">arrow_back</span>
        </button>
        <h2 className="text-xl font-bold text-white tracking-tight">Add Money</h2>
        {!isOnline && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary/10 border border-tertiary/20">
            <span className="w-2 h-2 bg-tertiary rounded-full"></span>
            <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest">Offline</span>
          </div>
        )}
      </header>

      <div className="pt-36 lg:pt-28 px-4 lg:px-10 max-w-2xl mx-auto space-y-6">
        {/* Amount Card */}
        <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-3xl border-t border-l border-outline-variant/15 p-8 flex flex-col items-center gap-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enter Amount</p>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-slate-600">₹</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => { setAmount(e.target.value); setError(''); }}
              placeholder="0"
              className="bg-transparent border-none outline-none text-6xl font-black text-white text-center w-48 placeholder-slate-800 tracking-tight"
            />
          </div>
          <p className="text-xs text-slate-500">Current balance: <span className="text-white font-bold">{fmt(confirmed_bal)}</span></p>

          {/* Quick amounts */}
          <div className="flex gap-2 flex-wrap justify-center">
            {QUICK.map(v => (
              <button key={v} onClick={() => { setAmount(String(v)); setError(''); }}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-bold text-slate-300 hover:bg-primary/10 hover:border-primary/20 hover:text-primary transition-all">
                ₹{v.toLocaleString()}
              </button>
            ))}
          </div>

          {error && (
            <div className="w-full bg-error/10 border border-error/20 rounded-xl px-4 py-3 text-sm text-error font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>{error}
            </div>
          )}
        </div>

        {/* Wallet usage bar */}
        <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Wallet Limit</p>
            <p className="text-xs text-white font-bold">{fmt(confirmed_bal)} / ₹10,000</p>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary-container to-primary rounded-full transition-all duration-500"
              style={{ width: `${balancePct}%` }} />
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Payment Method</p>
          <div className="space-y-2">
            {METHODS.map((m, i) => (
              <button key={i} onClick={doAdd} disabled={!amount || loading}
                className="w-full flex items-center gap-4 p-4 bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 hover:bg-white/3 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${m.color}`}>
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{m.icon}</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-white">{m.label}</p>
                  <p className="text-xs text-slate-500">{m.desc}</p>
                </div>
                {loading ? (
                  <span className="material-symbols-outlined text-slate-600 animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors">chevron_right</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
