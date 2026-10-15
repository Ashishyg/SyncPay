/**
 * QRScreen.jsx
 *
 * TWO MODES:
 * 1. P2P Receive (existing behaviour) — navigated from Send flow with qrData/txnId/expiresAt
 * 2. Merchant Pay — navigated from a QR scan with { mode:'merchant_pay', merchantPayload }
 *    Customer enters amount → /send/confirm (PIN) → signed offline QR addressed to the merchant
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { unlockFunds, OFFLINE_TXN_LIMIT } from '../services/walletService';
import { useWalletStore } from '../store/walletStore';
import { deletePendingTxn } from '../services/storageService';
import { ArrowLeft, Store, BadgeCheck, AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function QRScreen() {
  const navigate   = useNavigate();
  const { state }  = useLocation();
  const { loadWalletState, confirmed_bal, locked_bal } = useWalletStore();

  // ── Mode detection ───────────────────────────────────────────────────
  const isMerchantPay = state?.mode === 'merchant_pay';
  const merchantPayload = isMerchantPay ? (() => {
    try { return JSON.parse(state.merchantPayload); } catch { return null; }
  })() : null;

  // ── P2P state ────────────────────────────────────────────────────────
  const { qrData, txnId, expiresAt, amount: p2pAmount, recipientName } = state || {};
  const [timeLeft, setTimeLeft] = useState(60);

  // ── Merchant Pay state ───────────────────────────────────────────────
  const [merchantAmount, setMerchantAmount] = useState('');
  const [error, setError]                   = useState('');

  // ── P2P timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isMerchantPay) return;
    const interval = setInterval(() => {
      const now  = Math.floor(Date.now() / 1000);
      const left = Math.max(0, (expiresAt || now + 60) - now);
      setTimeLeft(left);
      if (left <= 0) { clearInterval(interval); handleCancel(); }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── P2P cancel ───────────────────────────────────────────────────────
  const handleCancel = async () => {
    await unlockFunds(p2pAmount || 0);
    if (txnId) await deletePendingTxn(txnId);
    await loadWalletState();
    navigate('/home', { replace: true });
  };

  // ── Merchant Pay: validate, then reuse the offline P2P flow ──────────
  // The payment is signed on this phone with `to` = merchant's userId, so it
  // works without internet and only that merchant can ever be credited.
  const handleMerchantPay = () => {
    const amountPaise = Math.round(parseFloat(merchantAmount) * 100);
    if (!amountPaise || amountPaise <= 0) return setError('Enter a valid amount');
    if (amountPaise > OFFLINE_TXN_LIMIT) return setError(`Limit is ${fmt(OFFLINE_TXN_LIMIT)} per payment`);
    const spendable = confirmed_bal - locked_bal;
    if (amountPaise > spendable) return setError(`Insufficient balance. Available: ${fmt(spendable)}`);
    if (!merchantPayload?.userId) return setError('Invalid merchant QR. Please scan again.');
    navigate('/send/confirm', {
      state: { amount: amountPaise, recipient: { id: merchantPayload.userId, name: merchantPayload.name || 'Merchant' } },
    });
  };

  // ── MERCHANT PAY MODE ──────────────────────────────────────────────
  if (isMerchantPay) {
    return (
      <Shell title="Pay merchant" onBack={() => navigate(-1)}>
        <div className="flex-1 space-y-5">
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Store className="size-5" /></div>
              <div>
                <p className="font-medium">{merchantPayload?.name || 'Merchant'}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><BadgeCheck className="size-3.5 text-success" />SyncPay merchant</p>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            <Label htmlFor="mamt">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">₹</span>
              <Input id="mamt" type="number" inputMode="decimal" placeholder="0.00" className="h-12 pl-8 text-xl font-semibold tabular"
                value={merchantAmount} onChange={e => { setMerchantAmount(e.target.value); setError(''); }} />
            </div>
            <p className="text-xs text-muted-foreground">Available <span className="tabular">{fmt(confirmed_bal - locked_bal)}</span></p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[10, 20, 50, 100, 200, 500].map(a => (
              <Button key={a} variant="outline" size="sm" className="rounded-full" onClick={() => { setMerchantAmount(String(a)); setError(''); }}>₹{a}</Button>
            ))}
          </div>
          {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Works offline. The merchant scans your payment QR next.</p>
        <Button size="lg" className="mt-3" onClick={handleMerchantPay} disabled={!merchantAmount}>
          Continue{merchantAmount ? ` · ${fmt(Math.round(parseFloat(merchantAmount) * 100))}` : ''}
        </Button>
      </Shell>
    );
  }

  // ── P2P PAYMENT QR ─────────────────────────────────────────────────
  const urgent = timeLeft < 10;
  return (
    <Shell title="Show this to the receiver" onBack={() => navigate('/home', { replace: true })}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Paying {recipientName && !['Wallet ID', 'QR payment'].includes(recipientName) ? recipientName : 'whoever scans'}</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular">{fmt(p2pAmount || 0)}</p>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-xl shadow-primary/10">
          {qrData
            ? <QRCodeSVG value={qrData} size={260} level="M" fgColor="#18181b" bgColor="#ffffff" />
            : <div className="flex size-[260px] items-center justify-center text-sm text-zinc-500">No QR data</div>}
        </div>

        <div className="w-full max-w-xs space-y-2">
          <Progress value={(timeLeft / 60) * 100} className={cn('h-1.5', urgent && '[&>[data-slot=progress-indicator]]:bg-destructive')} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="font-mono">TXN·{(txnId || '—').slice(0, 8).toUpperCase()}</span>
            <span className={cn('tabular', urgent && 'font-medium text-destructive')}>Expires in {timeLeft}s</span>
          </div>
        </div>

        <p className="flex max-w-xs items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          {fmt(p2pAmount || 0)} is locked from your balance until it settles. It unlocks if the QR expires.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" variant="outline" onClick={handleCancel}>Cancel</Button>
        <Button size="lg" onClick={() => navigate('/home', { replace: true })}>Done</Button>
      </div>
    </Shell>
  );
}

function Shell({ title, onBack, children }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col px-4 pb-8">
      <header className="flex h-14 items-center gap-2">
        <Button variant="ghost" size="icon" className="-ml-2" onClick={onBack} aria-label="Back"><ArrowLeft /></Button>
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>
      {children}
    </div>
  );
}
