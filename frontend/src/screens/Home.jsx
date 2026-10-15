import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { getAllTxns } from '../services/storageService';
import { runSync, pullServerHistory } from '../services/syncService';
import { SMS_GATEWAY } from '../services/smsSync';
import { hasToken } from '../services/apiService';
import { OFFLINE_TXN_LIMIT } from '../services/walletService';
import {
  ArrowUpRight, ArrowDownLeft, WifiOff, Lock, Clock, ChevronRight, Inbox, Wallet, PlusCircle, ScanLine, Store, Send, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LineChart from '@/components/LineChart';
import { StatusBadge, txnTime } from '@/components/TxnRow';
import { formatINR, cn } from '@/lib/utils';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Home() {
  const navigate = useNavigate();
  const { confirmed_bal, locked_bal, unconfirmed_received, isOnline, loadWalletState, updateBalance } = useWalletStore();
  const [txns, setTxns] = useState([]);
  const [stats, setStats] = useState({ count: 0, pending: 0, sent: 0, received: 0, dailySent: Array(7).fill(0), dailyReceived: Array(7).fill(0) });
  const [quickAmt, setQuickAmt] = useState('');

  const refresh = async () => { await loadWalletState(); await loadTxns(); };

  // Trigger a sync + wallet update when Home mounts (if online)
  const syncAndRefresh = async () => {
    if (!navigator.onLine || !hasToken()) return;
    try {
      const result = await runSync();
      if (result.serverWallet) {
        const all = await getAllTxns();
        const localLocked = all.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
        const localUnconfirmed = all.filter(t => t.status === 'unconfirmed_received').reduce((sum, t) => sum + t.amount, 0);
        await updateBalance({
          confirmed_bal: result.serverWallet.confirmed_bal,
          locked_bal: localLocked,
          unconfirmed_received: localUnconfirmed,
        });
      }
      await pullServerHistory();
      await loadWalletState();
      await loadTxns();
      if (result.confirmed + result.failed > 0) {
        window.dispatchEvent(new CustomEvent('pp-sync-complete', { detail: result }));
      }
    } catch (e) {
      console.log('[Home] sync-on-mount skipped:', e.message);
    }
  };

  useEffect(() => {
    refresh();
    syncAndRefresh(); // Sync pending txns when dashboard loads
    const onVisChange = () => { if (document.visibilityState === 'visible') { refresh(); syncAndRefresh(); } };
    const onFocus = () => refresh();
    const onSync = () => refresh();
    const onNotif = () => refresh();
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pp-sync-complete', onSync);
    window.addEventListener('pp-notification', onNotif);
    const interval = setInterval(refresh, 5000);
    const serverPoll = setInterval(syncAndRefresh, 20000); // pick up payments settled by the other phone
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pp-sync-complete', onSync);
      window.removeEventListener('pp-notification', onNotif);
      clearInterval(interval);
      clearInterval(serverPoll);
    };
  }, []);

  const loadTxns = async () => {
    const all = await getAllTxns();
    setTxns([...all].sort((a, b) => b.created_at - a.created_at).slice(0, 6));
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime() / 1000;
    let sent = 0, received = 0;
    const dailySent = Array(7).fill(0), dailyReceived = Array(7).fill(0);
    all.forEach(t => {
      if (t.created_at >= startOfMonth) {
        if (t.type === 'sent') sent += t.amount;
        if (t.type === 'received') received += t.amount;
      }
      const daysAgo = Math.floor((todayEnd - t.created_at) / 86400);
      if (daysAgo >= 0 && daysAgo < 7) (t.type === 'sent' ? dailySent : dailyReceived)[6 - daysAgo] += t.amount;
    });
    const pending = all.filter(t => t.status === 'pending' || t.status === 'unconfirmed_received').length;
    setStats({ count: all.length, pending, sent, received, dailySent, dailyReceived });
  };

  const spendable = confirmed_bal - locked_bal;
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    if (i === 6) return 'Today';
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return DAY[d.getDay()];
  });

  // Quick pay: same checks as the Send screen, then the normal PIN → signed QR flow
  const quickPaise = Math.round(parseFloat(quickAmt) * 100) || 0;
  const quickError = !quickPaise ? '' : quickPaise > spendable ? 'More than your spendable balance'
    : quickPaise > OFFLINE_TXN_LIMIT ? `Limit is ${formatINR(OFFLINE_TXN_LIMIT, 0)} per payment` : '';
  const quickPay = () => navigate('/send/confirm', { state: { amount: quickPaise, recipient: { name: 'QR payment', id: 'unknown' } } });

  const BALANCES = [
    { label: 'Wallet balance', value: confirmed_bal, icon: Wallet, path: '/history' },
    { label: 'Locked in QR payments', value: locked_bal, icon: Lock, path: '/sync' },
    { label: 'Incoming, not settled', value: unconfirmed_received || 0, icon: Clock, path: '/sync' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Dashboard</h1>
        <Button onClick={() => navigate('/add-money')}><PlusCircle />Add money</Button>
      </div>

      {!isOnline && (
        <Alert>
          <WifiOff />
          <AlertTitle>You’re offline</AlertTitle>
          <AlertDescription>
            You can still pay and receive by QR. Everything syncs automatically when you reconnect.
            {SMS_GATEWAY && <button className="mt-1 font-medium underline-offset-4 hover:underline" onClick={() => navigate('/sync')}>No data for a while? Sync by SMS →</button>}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Overview */}
        <Card className="bg-linear-to-r from-[oklch(0.87_0_0/0.4)] to-[oklch(0.556_0_0/0.6)] dark:from-[oklch(0.4_0_0/0.4)] dark:to-[oklch(0.25_0_0/0.6)]">
          <CardHeader><h2 className="text-2xl font-bold">Overview</h2></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-between">
              <div className="space-y-1">
                <p className="text-2xl font-semibold tabular">{stats.count}</p>
                <p className="text-muted-foreground">Transactions</p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl bg-muted px-4 py-2">
                <p className="text-xl font-semibold tabular">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-semibold tracking-tight tabular lg:text-4xl">{formatINR(spendable)}</p>
              <p className="text-muted-foreground">Available to spend</p>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="font-medium tabular">{formatINR(stats.received)}</span>
                <Badge variant="secondary" className="bg-success/15 text-success">received this month</Badge>
              </div>
              <Button size="sm" onClick={() => navigate('/send')}><Send />Send</Button>
            </div>
          </CardContent>
        </Card>

        {/* Balances */}
        <Card>
          <CardHeader>
            <CardTitle>Balances</CardTitle>
            <CardAction><Button variant="outline" size="icon-sm" onClick={() => navigate('/history')} aria-label="History"><ChevronRight /></Button></CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {BALANCES.map(({ label, value, icon: Icon, path }) => (
              <button key={label} onClick={() => navigate(path)} className="block w-full rounded-md border px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-muted">
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-foreground"><Icon className="size-4" /></div>
                  {label}
                </div>
                <p className="text-base font-semibold tabular">{formatINR(value)}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Quick pay */}
        <Card>
          <CardHeader>
            <CardDescription>Quick pay · spendable</CardDescription>
            <p className="text-3xl font-semibold tabular">{formatINR(spendable)}</p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="send">
              <TabsList className="w-full">
                <TabsTrigger value="send">Send</TabsTrigger>
                <TabsTrigger value="receive">Receive</TabsTrigger>
              </TabsList>
              <TabsContent value="send" className="space-y-4 pt-3">
                <div className="space-y-2">
                  <Label htmlFor="quick">Amount (₹)</Label>
                  <Input id="quick" type="number" inputMode="numeric" placeholder="0" className="tabular" value={quickAmt} onChange={e => setQuickAmt(e.target.value)} />
                  <div className="flex gap-2">
                    {[50, 100, 200, 500].map(v => (
                      <Button key={v} variant="outline" size="xs" className="flex-1" onClick={() => setQuickAmt(String(v))}>₹{v}</Button>
                    ))}
                  </div>
                  {quickError && <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" />{quickError}</p>}
                </div>
                <Button className="w-full" disabled={!quickPaise || !!quickError} onClick={quickPay}>Create payment QR</Button>
                <p className="text-center text-xs text-muted-foreground">Works offline · anyone who scans can receive</p>
              </TabsContent>
              <TabsContent value="receive" className="space-y-3 pt-3">
                <p className="text-muted-foreground">Scan the sender’s payment QR. The signature is checked on this phone, no internet needed.</p>
                <Button className="w-full" onClick={() => navigate('/receive')}><ScanLine />Scan payment QR</Button>
                <Button variant="outline" className="w-full" onClick={() => navigate('/merchant')}><Store />Show my merchant QR</Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card>
          <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {txns.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <Inbox className="size-8 opacity-40" />No transactions yet
              </div>
            ) : (
              <div className="space-y-5">
                {txns.map(tx => {
                  const sent = tx.type === 'sent';
                  return (
                    <button key={tx.id} onClick={() => navigate(`/history/${tx.id}`)} className="flex w-full items-center text-left">
                      <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', sent ? 'bg-muted' : 'bg-success/15 text-success')}>
                        {sent ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                      </div>
                      <div className="ml-4 min-w-0 space-y-1">
                        <p className="flex items-center gap-2 font-medium leading-none">
                          <span className="truncate">{tx.recipientName || (sent ? 'Payment sent' : 'Payment received')}</span>
                          <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] font-normal">{sent ? 'Sent' : 'Received'}</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">{txnTime(tx.created_at)}</p>
                      </div>
                      <div className="ml-auto flex flex-col items-end gap-1 pl-2">
                        <span className={cn('font-medium tabular', !sent && 'text-success')}>{sent ? '−' : '+'}{formatINR(tx.amount)}</span>
                        {tx.status !== 'confirmed' && <StatusBadge status={tx.status} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => navigate('/history')}>View all</Button>
          </CardContent>
        </Card>

        {/* Balance summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Balance summary</CardTitle>
            <CardAction><Button variant="outline" size="sm" onClick={() => navigate('/sync')}>Sync status</Button></CardAction>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Received this month', value: stats.received, icon: ArrowDownLeft },
                { label: 'Sent this month', value: stats.sent, icon: ArrowUpRight },
                { label: 'Not yet settled', value: locked_bal + (unconfirmed_received || 0), icon: Clock },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="space-y-1 rounded-md border p-4">
                  <p className="flex items-center gap-1.5 text-muted-foreground"><Icon className="size-4" />{label}</p>
                  <p className="text-xl font-semibold tabular">{formatINR(value)}</p>
                </div>
              ))}
            </div>
            <LineChart
              labels={dayLabels}
              ariaLabel="Money received and sent per day over the last 7 days"
              format={(v) => formatINR(v)}
              series={[
                { key: 'received', label: 'Received', values: stats.dailyReceived, color: 'var(--chart-1)' },
                { key: 'sent', label: 'Sent', values: stats.dailySent, color: 'var(--chart-2)', dashed: true },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
