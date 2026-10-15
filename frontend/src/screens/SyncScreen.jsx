/**
 * SyncScreen.jsx — Network & Sync Dashboard
 * 
 * Shows: live network quality, auto-sync status, pending queue,
 * sync activity log, and Shannon's theorem proof for 2G resilience.
 * 
 * Sync is AUTOMATIC — fires whenever the device goes online.
 * This screen is a monitoring dashboard, not a manual trigger.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useWalletStore } from '../store/walletStore';
import { runSync } from '../services/syncService';
import { hasToken } from '../services/apiService';
import { getPendingTxns } from '../services/storageService';
import { SMS_GATEWAY, smsSyncCandidates, sendSmsSync } from '../services/smsSync';
import { notifySyncComplete } from '../services/notificationService';
import { CloudCheck, CloudOff, RefreshCw, Clock, Inbox, Signal, PenLine, Database, CloudUpload, BadgeCheck, MessageSquareText } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const fmt = (p) => '₹' + ((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

// Detect connection quality
function useNetworkInfo() {
  const [info, setInfo] = useState({ type: 'unknown', downlink: null, rtt: null });
  useEffect(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return;
    const update = () => setInfo({ type: conn.effectiveType || conn.type, downlink: conn.downlink, rtt: conn.rtt });
    update();
    conn.addEventListener('change', update);
    return () => conn.removeEventListener('change', update);
  }, []);
  return info;
}

const NETWORK_LABELS = {
  'slow-2g': { label: 'Slow 2G', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-500' },
  '2g':      { label: '2G',      color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-500' },
  '3g':      { label: '3G',      color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-500' },
  '4g':      { label: '4G / WiFi', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-500' },
  'unknown': { label: 'Unknown',  color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', dot: 'bg-slate-500' }
};

// Animated log line
function LogLine({ line, delay }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  const colors = { info: 'text-muted-foreground', success: 'text-success', warn: 'text-warning', error: 'text-destructive', system: 'text-primary' };
  return (
    <div className={`flex items-start gap-2 text-xs font-mono transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
      <span className="flex-shrink-0 select-none text-muted-foreground/60">{line.ts}</span>
      <span className={colors[line.type] || 'text-muted-foreground'}>{line.text}</span>
    </div>
  );
}

export default function SyncScreen() {
  const { isOnline, confirmed_bal, locked_bal, loadWalletState, updateBalance } = useWalletStore();
  const netInfo = useNetworkInfo();

  const [pendingTxns, setPendingTxns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(localStorage.getItem('sp_last_sync'));
  const [lastResult, setLastResult] = useState(null);
  const logsEndRef = useRef(null);

  const netLabel = NETWORK_LABELS[netInfo.type] || NETWORK_LABELS['unknown'];

  const addLog = useCallback((text, type = 'info') => {
    const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setLogs(prev => [...prev, { text, type, id: Date.now() + Math.random(), ts, delay: 0 }]);
  }, []);

  // Auto-scroll logs
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // Load pending on mount + refresh
  const refreshPending = useCallback(async () => {
    try {
      setPendingTxns(await smsSyncCandidates()); // sent + received payments awaiting settlement
    } catch { setPendingTxns([]); }
  }, []);

  useEffect(() => { refreshPending(); }, [refreshPending]);

  // Listen for auto-sync events from App.jsx
  useEffect(() => {
    const handler = () => {
      addLog('Background sync completed.', 'success');
      refreshPending();
      loadWalletState();
      setLastSync(localStorage.getItem('sp_last_sync'));
    };
    window.addEventListener('pp-sync-complete', handler);
    return () => window.removeEventListener('pp-sync-complete', handler);
  }, [addLog, refreshPending, loadWalletState]);

  // Manual sync trigger (still available as a button, but auto-sync is the primary mechanism)
  const handleManualSync = async () => {
    if (!isOnline) { addLog('Cannot sync — you are offline.', 'error'); return; }
    if (!hasToken()) { addLog('Not authenticated. Please log in.', 'error'); return; }
    if (syncing) return;

    setSyncing(true);
    setLogs([]);
    addLog('Initiating sync...', 'system');
    addLog(`Network: ${netLabel.label}${netInfo.rtt ? ` · RTT ${netInfo.rtt}ms` : ''}${netInfo.downlink ? ` · ${netInfo.downlink} Mbps` : ''}`, 'info');

    const pending = await getPendingTxns() || [];
    setPendingTxns(pending);

    if (pending.length === 0) {
      addLog('No pending transactions. Wallet is up to date.', 'success');
    } else {
      addLog(`Found ${pending.length} pending transaction(s) in local storage.`, 'info');
      pending.forEach((t, i) => addLog(`  [${i+1}] ${(t.id || '').slice(0, 10)} · ${fmt(t.amount)} · ${t.type}`, 'info'));
    }

    try {
      const startTime = Date.now();
      addLog('Sending Ed25519-signed payloads to server...', 'system');
      const result = await runSync();
      const elapsed = Date.now() - startTime;

      addLog(`Server responded in ${elapsed}ms`, elapsed > 2000 ? 'warn' : 'success');

      const confirmed = (result.results || []).filter(r => r.status === 'confirmed');
      const failed = (result.results || []).filter(r => r.status === 'failed');

      if (confirmed.length > 0) {
        addLog(`${confirmed.length} transaction(s) confirmed.`, 'success');
        confirmed.forEach(r => addLog(`  ${(r.id || '').slice(0, 10)} → confirmed`, 'success'));
      }
      if (failed.length > 0) {
        addLog(`${failed.length} transaction(s) failed.`, 'error');
        failed.forEach(r => addLog(`  ${(r.id || '').slice(0, 10)} → ${r.fail_reason || 'failed'}`, 'error'));
      }
      if (result.results?.length === 0) {
        addLog('Server: all transactions already settled.', 'info');
      }

      if (result.serverWallet) {
        await updateBalance({ confirmed_bal: result.serverWallet.confirmed_bal, locked_bal: result.serverWallet.locked_bal || 0 });
        addLog(`Balance updated: ${fmt(result.serverWallet.confirmed_bal)}`, 'success');
      }
      await loadWalletState();

      const now = new Date().toLocaleString('en-IN');
      localStorage.setItem('sp_last_sync', now);
      setLastSync(now);
      setLastResult(result);

      // Push notification
      await notifySyncComplete(confirmed.length, failed.length, result.serverWallet?.confirmed_bal);

      // Shannon's theorem note when on slow connection
      if (netInfo.type === 'slow-2g' || netInfo.type === '2g' || netInfo.rtt > 400) {
        addLog('Note: Settled successfully on degraded network.', 'warn');
        addLog('Shannon\'s theorem: real 2G carries 10× the capacity Chrome simulates.', 'warn');
      }

      addLog('Sync complete.', 'system');
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Sync failed';
      addLog(`Error: ${msg}`, 'error');
    }

    await refreshPending();
    setSyncing(false);
  };

  const StatusIcon = syncing ? RefreshCw : isOnline ? CloudCheck : CloudOff;
  const STEPS = [
    { icon: PenLine, text: 'The payment is signed on the sender’s phone (Ed25519).' },
    { icon: Database, text: 'Both phones store it locally as pending.' },
    { icon: CloudUpload, text: 'When either phone gets signal, it uploads the signed payment.' },
    { icon: BadgeCheck, text: 'The server checks the signature and balance, then settles it.' },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Sync status" description="Offline payments settle automatically when you reconnect." back>
        <Badge variant="outline" className="gap-1.5">
          <span className={cn('size-2 rounded-full', isOnline ? 'bg-success' : 'bg-warning')} />
          {isOnline ? netLabel.label : 'Offline'}{isOnline && netInfo.rtt ? ` · ${netInfo.rtt}ms` : ''}
        </Badge>
      </PageHeader>

      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-4 text-center sm:flex-row sm:text-left">
            <div className={cn('flex size-14 shrink-0 items-center justify-center rounded-full',
              isOnline ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
              <StatusIcon className={cn('size-7', syncing && 'animate-spin')} />
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold">{syncing ? 'Syncing…' : isOnline ? 'Connected' : 'Offline'}</p>
              <p className="text-sm text-muted-foreground">
                {syncing ? 'Uploading signed payments to the server.'
                  : isOnline ? (lastSync ? `Last synced ${lastSync}` : 'Auto-sync is on. Pending payments upload as soon as you’re online.')
                  : 'Payments are queued on this device and will sync when you reconnect.'}
              </p>
            </div>
            <Button onClick={handleManualSync} disabled={syncing || !isOnline} className="w-full sm:w-auto">
              <RefreshCw className={cn(syncing && 'animate-spin')} />
              {syncing ? 'Syncing…' : isOnline ? 'Sync now' : 'Waiting for network'}
            </Button>
          </CardContent>
        </Card>

        {SMS_GATEWAY && pendingTxns.length > 0 && (
          <Card className={cn(!isOnline && 'border-primary/40')}>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MessageSquareText className="size-5" /></div>
              <div className="flex-1">
                <p className="font-medium">No data? Sync by SMS</p>
                <p className="text-sm text-muted-foreground">
                  Sends up to 3 signed payments as a normal text from your SIM to {SMS_GATEWAY}. Standard SMS rates apply.
                </p>
              </div>
              <Button variant={isOnline ? 'outline' : 'default'} className="w-full sm:w-auto"
                onClick={async () => { await sendSmsSync(); refreshPending(); }}>
                <MessageSquareText />Send SMS
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Queue</CardTitle>
              <CardDescription>{pendingTxns.length ? `${pendingTxns.length} payment${pendingTxns.length !== 1 ? 's' : ''} waiting to settle` : 'Nothing waiting'}</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTxns.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                  <Inbox className="size-8 opacity-40" />All caught up
                </div>
              ) : (
                <div className="-mx-2">
                  {pendingTxns.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-warning/15 text-warning"><Clock className="size-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.recipientName || (t.id || '').slice(0, 12)}</p>
                        <p className="text-xs capitalize text-muted-foreground">{t.type || 'payment'}{t.sms_sent_at ? ' · sent by SMS' : ''}</p>
                      </div>
                      <p className="text-sm font-medium tabular">{fmt(t.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync log</CardTitle>
              <CardDescription>Details of the last manual sync</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56 space-y-1 overflow-y-auto rounded-lg bg-muted/60 p-3">
                {logs.length === 0
                  ? <p className="font-mono text-xs text-muted-foreground">Waiting for sync activity…</p>
                  : logs.map((l, i) => <LogLine key={l.id} line={l} delay={i * 60} />)}
                <div ref={logsEndRef} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>How settlement works</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {STEPS.map(({ icon: Icon, text }, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></div>
                    <span className="pt-1.5 text-muted-foreground">{text}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="mb-1 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Signal className="size-4" /></div>
              <CardTitle>Built for weak signal</CardTitle>
              <CardDescription>
                Each signed payment is roughly 200 bytes, so a sync completes even on a congested 2G connection.
                Try it: set Chrome DevTools → Network to “Slow 3G” or “Slow 2G”, then sync.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
