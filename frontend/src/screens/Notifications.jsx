import { useState, useEffect, useCallback } from 'react';
import { getNotifications } from '../services/storageService';
import { ArrowUpRight, ArrowDownLeft, CloudCheck, Wallet, AlertCircle, Info, BellOff } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function Notifications() {
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

  const STYLE = {
    payment_sent: { Icon: ArrowUpRight, className: 'bg-muted text-foreground' },
    payment_received: { Icon: ArrowDownLeft, className: 'bg-success/15 text-success' },
    sync_complete: { Icon: CloudCheck, className: 'bg-primary/10 text-primary' },
    balance_update: { Icon: Wallet, className: 'bg-success/15 text-success' },
    txn_failed: { Icon: AlertCircle, className: 'bg-destructive/15 text-destructive' },
    system: { Icon: Info, className: 'bg-muted text-muted-foreground' },
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" description={notifs.length ? `${notifs.length} event${notifs.length !== 1 ? 's' : ''}` : undefined} back />
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : notifs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <BellOff className="size-10 text-muted-foreground/50" />
            <p className="font-medium">No notifications yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">Payments you send or receive, and sync results, will show up here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {notifs.map(n => {
              const { Icon, className } = STYLE[n.type] || STYLE.system;
              return (
                <div key={n.id} className="flex items-start gap-3 px-4 py-3">
                  <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', className)}><Icon className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.timestamp)}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                  </div>
                  {!n.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
