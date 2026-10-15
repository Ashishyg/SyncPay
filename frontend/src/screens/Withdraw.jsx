import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { getKeys, savePendingTxn } from '../services/storageService';
import { deriveKeyFromPIN, decryptPrivateKey } from '../services/cryptoService';
import { withdrawMoney } from '../services/apiService';
import { notifyPaymentSent } from '../services/notificationService';
import Keypad from '../components/Keypad';
import { Loader2, AlertCircle, WifiOff, Landmark, Info } from 'lucide-react';
import { PinDots } from '@/components/Keypad';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success"><Landmark className="size-8" /></div>
        <div>
          <p className="text-2xl font-semibold">Withdrawal started</p>
          <p className="mt-1 text-muted-foreground"><span className="tabular">{fmt(parseInt(amount) * 100)}</span> will reach your bank within 30 minutes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Withdraw" description="Move wallet balance to your bank account." back />
      <div className="space-y-4">
        {!isOnline && <Alert variant="destructive"><WifiOff /><AlertDescription>You’re offline. Withdrawals need an internet connection.</AlertDescription></Alert>}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-muted-foreground">Amount</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-medium text-muted-foreground">₹</span>
              <input
                type="number" inputMode="numeric" aria-label="Amount in rupees"
                value={amount} onChange={e => checkWD(e.target.value)} placeholder="0"
                style={{ width: `${Math.max(String(amount).length, 1) + 0.25}ch` }}
                className="max-w-full bg-transparent text-center text-5xl font-semibold tracking-tight tabular outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <p className="text-sm text-muted-foreground">Available <span className="font-medium text-foreground tabular">{fmt(spendable)}</span> · min ₹100</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[500, 1000, 2000, 5000].map(v => (
                <Button key={v} variant="outline" size="sm" className="rounded-full" disabled={v * 100 > spendable} onClick={() => checkWD(String(v))}>
                  ₹{v.toLocaleString('en-IN')}
                </Button>
              ))}
            </div>
            {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Landmark className="size-5" /></div>
            <div className="flex-1">
              <p className="text-sm font-medium">Primary bank</p>
              <p className="font-mono text-xs text-muted-foreground">{accountNo} · PKPT0000001</p>
            </div>
            <Badge variant="secondary" className="bg-success/15 text-success">No fee</Badge>
          </CardContent>
        </Card>

        <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />Demo build: the bank payout is simulated.
        </p>

        <Button size="lg" className="w-full" onClick={initiate} disabled={!amount || !!error || !isOnline}>Withdraw</Button>
      </div>

      <Dialog open={showPin} onOpenChange={open => { if (!open && !processing) { setShowPin(false); setPin(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="text-center">
            <DialogTitle>Confirm withdrawal</DialogTitle>
            <DialogDescription>Enter your PIN to withdraw <span className="font-medium text-foreground tabular">₹{amount}</span> to your bank.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <PinDots length={pin.length} error={!!pinErr} />
            <div className="flex min-h-5 items-center justify-center text-sm">
              {pinErr ? <span className="text-destructive">{pinErr}</span>
                : processing && <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Processing…</span>}
            </div>
            <Keypad onKey={handlePinKey} onDelete={() => setPin(p => p.slice(0, -1))} disabled={processing} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
