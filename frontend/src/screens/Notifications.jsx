import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { getNotifications, saveNotification } from '../services/storageService';

const ICONS = {
  payment_sent: { icon: 'arrow_upward', color: 'text-red-400 bg-red-500/10', border: 'border-red-500/10' },
  payment_received: { icon: 'arrow_downward', color: 'text-emerald-400 bg-emerald-500/10', border: 'border-emerald-500/10' },
  sync_complete: { icon: 'cloud_done', color: 'text-primary bg-primary/10', border: 'border-primary/10' },
  balance_update: { icon: 'account_balance_wallet', color: 'text-emerald-400 bg-emerald-500/10', border: 'border-emerald-500/10' },
  txn_failed: { icon: 'error', color: 'text-error bg-error/10', border: 'border-error/10' },
  system: { icon: 'info', color: 'text-blue-400 bg-blue-500/10', border: 'border-blue-500/10' },
};

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function Notifications() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifs = useCallback(async () => {
    try {
      const all = await getNotifications();
      // Sort newest first
      setNotifs([...all].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    } catch { setNotifs([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNotifs();
    // Listen for new notifications pushed by auto-sync or payment flows
    const handler = () => loadNotifs();
    window.addEventListener('pp-notification', handler);
    const onVis = () => { if (document.visibilityState === 'visible') loadNotifs(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('pp-notification', handler); document.removeEventListener('visibilitychange', onVis); };
  }, [loadNotifs]);

  return (
    <main className="min-h-screen pb-24 w-full">
      {/* Header */}
      <header className="fixed top-14 lg:top-0 right-0 lg:left-64 left-0 h-16 lg:h-20 bg-background/80 backdrop-blur-xl border-b border-outline-variant/15 px-4 lg:px-10 flex items-center gap-4 z-30">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors">
          <span className="material-symbols-outlined text-slate-400">arrow_back</span>
        </button>
        <h2 className="text-xl font-bold text-white tracking-tight">Activity</h2>
        {notifs.length > 0 && (
          <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {notifs.length} event{notifs.length !== 1 ? 's' : ''}
          </span>
        )}
      </header>

      <div className="pt-36 lg:pt-28 px-4 lg:px-10 max-w-2xl mx-auto space-y-3">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span>
            <p className="text-sm text-slate-500">Loading activity...</p>
          </div>
        ) : notifs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-700 text-3xl">notifications_none</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-1">No activity yet</p>
              <p className="text-xs text-slate-500">Notifications will appear here when you send or receive payments, or when transactions sync.</p>
            </div>
          </div>
        ) : (
          notifs.map(n => {
            const style = ICONS[n.type] || ICONS.system;
            return (
              <div key={n.id} className={`bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l ${style.border} border-outline-variant/15 p-4 flex items-start gap-4 ${!n.is_read ? 'ring-1 ring-primary/20' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.color}`}>
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{style.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-white truncate">{n.title}</p>
                    <p className="text-[10px] text-slate-600 flex-shrink-0">{timeAgo(n.timestamp)}</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{n.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
