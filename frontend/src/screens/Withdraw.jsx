import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { getKeys, savePendingTxn } from '../services/storageService';
import { deriveKeyFromPIN, decryptPrivateKey } from '../services/cryptoService';
import { withdrawMoney } from '../services/apiService';
import { notifyPaymentSent } from '../services/notificationService';
import Keypad from '../components/Keypad';

const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Withdraw() {
  const navigate = useNavigate();
  const { user, confirmed_bal, locked_bal, isOnline, loadWalletState, updateBalance } = useWalletStore();
  const spendable = confirmed_bal - locked_bal;
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const accountNo = 'xxxx' + (user?.phone || '4321').slice(-4);

  const checkWD = (val) => {
    setAmount(val);
    const amt = parseInt(val) * 100;
    if (!val) setError('');
    else if (amt < 10000) setError('Minimum withdrawal is ₹100');
    else if (amt > spendable) setError('Exceeds available balance');
    else setError('');
  };

  const initiate = () => {
    if (!isOnline) return setError('Internet required for withdrawals');
    const amt = parseInt(amount) * 100;
    if (!amt || amt < 10000 || amt > spendable) return;
    setShowPin(true);
  };

  const handlePinKey = async (key) => {
    if (processing || pin.length >= 6) return;
    const newPin = pin + key;
    setPin(newPin);
    if (newPin.length === 6) {
      setProcessing(true);
      try {
        const keys = await getKeys();
        const saltBytes = Uint8Array.from(atob(keys.salt), c => c.charCodeAt(0));
        const aesKey = await deriveKeyFromPIN(newPin, saltBytes);
        await decryptPrivateKey(keys.encPrivKey, keys.iv, aesKey);

        const result = await withdrawMoney({
          amount: parseInt(amount) * 100,
          bankName: 'Primary Bank',
          accountNo,
          ifsc: 'PKPT0000001'
        });

        if (result.wallet) {
          await updateBalance({ confirmed_bal: result.wallet.confirmed_bal, locked_bal: result.wallet.locked_bal });
        }
        // Save to IndexedDB so it shows in History
        await savePendingTxn({
          id: 'wd-' + Date.now(),
          type: 'sent',
          amount: parseInt(amount) * 100,
          recipientName: 'Bank Withdrawal',
          status: 'confirmed',
          mode: 'withdrawal',
          created_at: Math.floor(Date.now() / 1000),
        });
        await loadWalletState();
        await notifyPaymentSent(parseInt(amount) * 100, 'Bank Withdrawal');
        setShowPin(false);
        setSuccess(true);
        setTimeout(() => navigate('/home'), 2000);
      } catch (e) {
        const msg = e.response?.data?.error || e.message || 'Withdrawal failed';
        setPinErr(msg);
        setTimeout(() => { setPin(''); setPinErr(''); }, 1500);
      }
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-8">
        <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-5xl text-emerald-400">account_balance</span>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-white mb-2">Withdrawal Initiated!</h2>
          <p className="text-slate-400 text-sm">{fmt(parseInt(amount) * 100)} will arrive in your bank within 30 minutes</p>
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
        <h2 className="text-xl font-bold text-white tracking-tight">Withdraw to Bank</h2>
      </header>

      <div className="pt-36 lg:pt-28 px-4 lg:px-10 max-w-2xl mx-auto space-y-6">
        {/* Status banners */}
        {!isOnline && (
          <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-error font-medium">
            <span className="material-symbols-outlined text-base flex-shrink-0">wifi_off</span>
            You are offline. Connect to internet to make withdrawals.
          </div>
        )}

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-blue-400 font-medium">
          <span className="material-symbols-outlined text-base flex-shrink-0">info</span>
          Withdrawals are sent to your linked bank within 30 minutes. No charges.
        </div>

        {/* Amount */}
        <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-3xl border-t border-l border-outline-variant/15 p-8 flex flex-col items-center gap-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount to Withdraw</p>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-slate-600">₹</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => checkWD(e.target.value)}
              placeholder="0"
              className="bg-transparent border-none outline-none text-6xl font-black text-white text-center w-48 placeholder-slate-800 tracking-tight"
            />
          </div>
          <p className="text-xs text-slate-500">
            Available: <span className="text-white font-bold">{fmt(spendable)}</span>
            <span className="text-slate-700 mx-2">·</span>
            Min: <span className="text-white font-bold">₹100</span>
          </p>
          {/* Quick amounts */}
          <div className="flex gap-2 flex-wrap justify-center">
            {[500, 1000, 2000, 5000].map(v => (
              <button key={v} onClick={() => checkWD(String(v))}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-bold text-slate-300 hover:bg-primary/10 hover:border-primary/20 hover:text-primary transition-all"
                disabled={v * 100 > spendable}>
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

        {/* Bank account */}
        <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-blue-400 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Primary Bank</p>
            <p className="text-xs text-slate-500">{accountNo} · PKPT0000001</p>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xs font-bold text-emerald-400">Free</p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={initiate}
          disabled={!amount || !!error || !isOnline}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary-container to-primary text-white font-black text-base tracking-wide shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
        >
          Withdraw →
        </button>
      </div>

      {/* PIN Bottom Sheet */}
      {showPin && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-sm">
            <h3 className="text-2xl font-black text-white text-center mb-2">Confirm Withdrawal</h3>
            <p className="text-slate-400 text-sm text-center mb-8">
              Enter PIN to withdraw <strong className="text-white">₹{amount}</strong> to your bank
            </p>

            {/* PIN dots */}
            <div className="flex justify-center gap-4 mb-3">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  i < pin.length
                    ? pinErr ? 'bg-error border-error scale-110' : 'bg-primary border-primary scale-110'
                    : 'bg-transparent border-slate-700'
                }`} />
              ))}
            </div>

            {pinErr && <p className="text-error text-sm font-bold text-center mb-2">{pinErr}</p>}
            {processing && (
              <p className="text-primary text-sm text-center mb-2 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                Processing...
              </p>
            )}

            <Keypad onKey={handlePinKey} onDelete={() => setPin(p => p.slice(0, -1))} />

            <button onClick={() => { setShowPin(false); setPin(''); }} className="w-full mt-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
