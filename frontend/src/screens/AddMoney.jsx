import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { addMoney as addMoneyAPI } from '../services/apiService';
import { savePendingTxn } from '../services/storageService';
import { applyServerWallet, refreshAllowance } from '../services/walletService';
import { notifyBalanceUpdate } from '../services/notificationService';
import { CheckCircle2, Loader2, AlertCircle, WifiOff, Smartphone, Landmark, CreditCard, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
  const [method, setMethod] = useState(0);

  const doAdd = async () => {
    const amt = Math.round(parseFloat(amount) * 100);
    if (!amt || amt <= 0) return setError('Enter a valid amount');
    // Top-ups must be confirmed by the server; a local-only balance would be spendable offline but never settle
    if (!isOnline) return setError('Internet required to add money');
    setLoading(true); setError('');
    try {
      const result = await addMoneyAPI(amt);
      await applyServerWallet(result.wallet);
      await refreshAllowance().catch(() => {}); // new money can back a fresh offline allowance
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


  if (success) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success"><CheckCircle2 className="size-8" /></div>
        <div>
          <p className="text-3xl font-semibold tabular">{fmt(Math.round(parseFloat(amount) * 100))}</p>
          <p className="mt-1 text-muted-foreground">added to your wallet</p>
        </div>
      </div>
    );
  }

  const ICONS = [Smartphone, Landmark, CreditCard];
  const amt = Math.round(parseFloat(amount) * 100) || 0;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Add money" description="Top up while online, then spend offline." back>
        {!isOnline && <Badge variant="outline" className="gap-1.5"><WifiOff className="size-3" />Offline</Badge>}
      </PageHeader>
      <div className="space-y-4">
        {!isOnline && <Alert><WifiOff /><AlertDescription>Adding money needs an internet connection.</AlertDescription></Alert>}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-muted-foreground">Amount</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-medium text-muted-foreground">₹</span>
              <input
                type="number" inputMode="decimal" aria-label="Amount in rupees"
                value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} placeholder="0"
                style={{ width: `${Math.max(String(amount).length, 1) + 0.25}ch` }}
                className="max-w-full bg-transparent text-center text-5xl font-semibold tracking-tight tabular outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <p className="text-sm text-muted-foreground">Balance <span className="font-medium text-foreground tabular">{fmt(confirmed_bal)}</span> · up to ₹10,000 per top-up</p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK.map(v => (
                <Button key={v} variant="outline" size="sm" className="rounded-full" onClick={() => { setAmount(String(v)); setError(''); }}>₹{v.toLocaleString('en-IN')}</Button>
              ))}
            </div>
            {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Pay with</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {METHODS.map((m, i) => {
              const Icon = ICONS[i];
              const sel = method === i;
              return (
                <button key={m.label} onClick={() => setMethod(i)}
                  className={cn('flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                    sel ? 'border-primary bg-accent' : 'hover:bg-accent/60')}>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                  <div className={cn('flex size-5 items-center justify-center rounded-full border', sel && 'border-primary bg-primary text-primary-foreground')}>
                    {sel && <Check className="size-3" />}
                  </div>
                </button>
              );
            })}
            <p className="pt-1 text-xs text-muted-foreground">Demo build: top-ups are simulated, no real payment is taken.</p>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full" onClick={doAdd} disabled={!amt || loading || !isOnline}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Adding…' : `Add ${amt ? fmt(amt) : 'money'}`}
        </Button>
      </div>
    </div>
  );
}
