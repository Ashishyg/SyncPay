import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllTxns } from '../services/storageService';

const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN');

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'received', label: 'Received' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
];

export default function History() {
  const navigate = useNavigate();
  const [txns, setTxns] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTxns();
    const onVisChange = () => { if (document.visibilityState === 'visible') loadTxns(); };
    const onFocus = () => loadTxns();
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('focus', onFocus);
    return () => { document.removeEventListener('visibilitychange', onVisChange); window.removeEventListener('focus', onFocus); };
  }, []);

  const loadTxns = async () => {
    const all = await getAllTxns();
    setTxns(all.sort((a, b) => b.created_at - a.created_at));
  };

  const filtered = txns.filter(t => {
    if (filter === 'sent')     return t.type === 'sent';
    if (filter === 'received') return t.type === 'received';
    if (filter === 'pending')  return t.status === 'pending' || t.status === 'unconfirmed_received';
    if (filter === 'failed')   return t.status === 'failed';
    return true;
  }).filter(t =>
    !search || (t.recipientName || '').toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (status) => {
    if (status === 'confirmed') return 'text-emerald-400';
    if (status === 'failed')    return 'text-error';
    return 'text-tertiary';
  };

  return (
    <main className="min-h-screen pb-20 w-full">
      {/* Top Bar */}
      <header className="fixed top-14 lg:top-0 right-0 lg:left-64 left-0 h-16 lg:h-20 bg-background/80 backdrop-blur-xl border-b border-outline-variant/15 px-4 lg:px-10 flex items-center justify-between z-30">
        <h2 className="text-xl font-bold text-white tracking-tight">Transaction History</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{filtered.length} records</span>
        </div>
      </header>

      <div className="pt-36 lg:pt-28 px-4 lg:px-10 max-w-5xl mx-auto space-y-6">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-600 text-xl">search</span>
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0d0d15]/60 backdrop-blur-xl border border-outline-variant/20 rounded-2xl pl-11 pr-4 py-4 text-white placeholder-slate-700 focus:outline-none focus:border-primary/40 focus:bg-[#0d0d15] transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${
                filter === f.id
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10 hover:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <span className="material-symbols-outlined text-5xl text-slate-700">receipt_long</span>
              <p className="text-slate-500 text-sm">No transactions found</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {filtered.map(tx => (
                <div
                  key={tx.id}
                  onClick={() => navigate(`/history/${tx.id}`)}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-white/3 cursor-pointer transition-colors group"
                >
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                    tx.type === 'sent' ? 'bg-error/10' : 'bg-emerald-500/10'
                  }`}>
                    <span className={`material-symbols-outlined text-xl ${tx.type === 'sent' ? 'text-error' : 'text-emerald-400'}`}>
                      {tx.type === 'sent' ? 'call_made' : 'call_received'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate group-hover:text-primary-fixed-dim transition-colors">
                      {tx.recipientName || (tx.type === 'received' ? 'Received' : 'Sent')}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(tx.created_at * 1000).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                      {' · '}
                      <span className={`font-bold ${statusColor(tx.status)}`}>{tx.status}</span>
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-black ${tx.type === 'sent' ? 'text-white' : 'text-emerald-400'}`}>
                      {tx.type === 'sent' ? '−' : '+'}{fmt(tx.amount)}
                    </p>
                    <p className="text-[10px] text-slate-600 font-mono uppercase mt-0.5">{tx.mode || 'offline'}</p>
                  </div>

                  <span className="material-symbols-outlined text-slate-700 group-hover:text-slate-500 text-base flex-shrink-0 transition-colors">chevron_right</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
