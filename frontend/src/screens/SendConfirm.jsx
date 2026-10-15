import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { getKeys } from '../services/storageService';
import { deriveKeyFromPIN, decryptPrivateKey } from '../services/cryptoService';
import { createSendTransaction } from '../services/transactionService';
import { notifyPaymentSent } from '../services/notificationService';
import Keypad from '../components/Keypad';
import { Loader2, WifiOff } from 'lucide-react';
import { PinDots } from '@/components/Keypad';
import PageHeader from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function SendConfirm() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { amount, recipient } = state || { amount: 0, recipient: { name: '—' } };
  const { isOnline, loadWalletState } = useWalletStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleKey = async (key) => {
    if (processing || pin.length >= 6) return;
    const newPin = pin + key;
    setPin(newPin);
    if (newPin.length === 6) {
      setProcessing(true);
      try {
        const keys = await getKeys();
        const saltBytes = Uint8Array.from(atob(keys.salt), c => c.charCodeAt(0));
        const aesKey = await deriveKeyFromPIN(newPin, saltBytes);
        const privateKey = await decryptPrivateKey(keys.encPrivKey, keys.iv, aesKey);

        const result = await createSendTransaction({
          amount,
          recipientId: recipient.id,
          recipientName: recipient.name,
          privateKey,
          senderPubKey: keys.pubKey
        });

        await loadWalletState();

        // Push real notification
        await notifyPaymentSent(amount, recipient.name);

        navigate('/send/qr', { state: { ...result, amount, recipientName: recipient.name }, replace: true });
      } catch (e) {
        if (e.message === 'INSUFFICIENT_BALANCE') setError('Insufficient spendable balance');
        else if (e.message === 'EXCEEDS_OFFLINE_TXN_LIMIT') setError('Offline limit: ₹500 per txn');
        else if (e.message === 'EXCEEDS_DAILY_LIMIT') setError('Daily offline limit reached (₹2,000)');
        else setError('Wrong PIN. Try again.');
        setTimeout(() => { setPin(''); setError(''); }, 1200);
      }
      setProcessing(false);
    }
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  const rows = [
    ['To', recipient.id && recipient.id !== 'unknown' ? recipient.name : 'Whoever scans the QR'],
    ['Fee', '₹0.00'],
    ['Mode', <Badge key="m" variant="secondary">{isOnline ? 'Online' : 'Offline'}</Badge>],
    ['QR valid for', '60 seconds'],
  ];

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Confirm payment" back />
      <div className="space-y-5">
        <Card>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">You’re sending</p>
              <p className="text-4xl font-semibold tracking-tight tabular">{fmt(amount)}</p>
            </div>
            <Separator />
            <dl className="space-y-2.5 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {!isOnline && (
          <Alert><WifiOff /><AlertDescription>This amount is locked on your phone until either device syncs online.</AlertDescription></Alert>
        )}

        <div className="space-y-5 pt-2">
          <p className="text-center text-sm font-medium">Enter your PIN to generate the QR</p>
          <PinDots length={pin.length} error={!!error} />
          <div className="flex min-h-5 items-center justify-center gap-2 text-sm">
            {error ? <span className="text-destructive">{error}</span>
              : processing && <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Signing payment…</span>}
          </div>
          <Keypad onKey={handleKey} onDelete={handleDelete} disabled={processing} />
        </div>
      </div>
    </div>
  );
}
