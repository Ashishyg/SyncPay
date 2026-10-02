import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { getAllTxns } from '../services/storageService';

const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN');

export default function Send() {
  const navigate = useNavigate();
  const { confirmed_bal, locked_bal, isOnline } = useWalletStore();
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState('');
  const [selected, setSelected] = useState(null);
  const [limitWarn, setLimitWarn] = useState('');
  const [recents, setRecents] = useState([]);

  useEffect(() => { loadRecents(); }, []);

  const loadRecents = async () => {
    const all = await getAllTxns();
    const unique = [];
    const seen = new Set();
    all.filter(t => t.type === 'sent' && t.recipientName).forEach(t => {
      if (!seen.has(t.recipientName)) {
        seen.add(t.recipientName);
        unique.push({ name: t.recipientName, id: t.to_user_id || t.toUserId, phone: 'SyncPay Wallet' });
      }
    });
    setRecents(unique.slice(0, 5));
  };

  const spendable = confirmed_bal - locked_bal;
  const filtered = recents.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const checkAmt = (val) => {
    setAmount(val);
    const amt = parseInt(val) * 100;
    if (amt > spendable) setLimitWarn('Insufficient spendable balance');
    else if (!isOnline && amt > 50000) setLimitWarn('Offline limit is ₹500 per transaction');
    else setLimitWarn('');
  };

  const proceed = () => {
    const amt = parseInt(amount) * 100;
    if (!amount || amt <= 0 || amt > spendable) return;
    if (!isOnline && amt > 50000) return;
    navigate('/send/confirm', { state: { amount: amt, recipient: selected || { name: 'Wallet ID', id: 'unknown' } } });
  };

  return (
    <main className="min-h-screen pb-20 w-full">
      {/* Top Bar */}
      <header className="fixed top-14 lg:top-0 right-0 lg:left-64 left-0 h-16 lg:h-20 bg-background/80 backdrop-blur-xl border-b border-outline-variant/15 px-4 lg:px-10 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5">
            <span className="material-symbols-outlined text-slate-400">arrow_back</span>
          </button>
          <h2 className="text-xl font-bold text-white tracking-tight">Send Money</h2>
        </div>
        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary/10 border border-tertiary/20">
            <span className="w-2 h-2 bg-tertiary rounded-full"></span>
            <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest">Offline</span>
          </div>
        )}
      </header>

      <div className="pt-36 lg:pt-28 px-4 lg:px-10 max-w-3xl mx-auto space-y-8">
        {/* Amount Input */}
        <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-3xl border-t border-l border-outline-variant/15 p-8 flex flex-col items-center gap-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount to Send</p>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-slate-600">₹</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => checkAmt(e.target.value)}
              placeholder="0"
              className="bg-transparent border-none outline-none text-6xl font-black text-white text-center w-56 placeholder-slate-800 tracking-tight"
            />
          </div>
          <p className="text-xs text-slate-500">
            Spendable: <span className="text-white font-bold">{fmt(spendable)}</span>
          </p>

          {/* Quick amounts */}
          <div className="flex gap-2 flex-wrap justify-center">
            {[50, 100, 200, 500].map(v => (
              <button key={v} onClick={() => checkAmt(String(v))}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-bold text-slate-300 hover:bg-primary/10 hover:border-primary/20 hover:text-primary transition-all">
                ₹{v}
              </button>
            ))}
          </div>

          {limitWarn && (
            <div className="w-full bg-tertiary/10 border border-tertiary/20 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-tertiary font-medium">
              <span className="material-symbols-outlined text-base flex-shrink-0">warning</span>
              {limitWarn}
            </div>
          )}
        </div>

        {/* Recipient */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Recipient</p>

          {/* Search */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-600 text-xl">person_search</span>
            <input
              type="text"
              placeholder="Search recent contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0d0d15]/60 backdrop-blur-xl border border-outline-variant/20 rounded-2xl pl-11 pr-4 py-4 text-white placeholder-slate-700 focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          {/* Recent contacts */}
          {filtered.length > 0 ? (
            <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 divide-y divide-outline-variant/10 overflow-hidden">
              {filtered.map(c => (
                <div key={c.id}
                  onClick={() => setSelected(c)}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${selected?.id === c.id ? 'bg-primary/10' : 'hover:bg-white/3'}`}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-container to-primary flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.phone}</p>
                  </div>
                  {selected?.id === c.id && (
                    <span className="material-symbols-outlined text-primary text-xl">check_circle</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-700 block mb-2">group</span>
              <p className="text-slate-500 text-sm">No recent contacts. The payment will go to your entered amount.</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={proceed}
          disabled={!amount || !!limitWarn}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary-container to-primary text-white font-black text-base tracking-wide shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
        >
          Review Payment
        </button>
      </div>
    </main>
  );
}
