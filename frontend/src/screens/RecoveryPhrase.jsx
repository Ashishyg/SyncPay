import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, KeyRound, Loader2, ShieldCheck, CloudUpload } from 'lucide-react';
import { generateKeypair, deriveKeyFromPIN, encryptPrivateKey } from '../services/cryptoService';
import { saveKeys, saveWalletState, wipeKeys } from '../services/storageService';
import { registerUser } from '../services/apiService';
import { useWalletStore } from '../store/walletStore';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Final registration step: generate the signing key on-device and create the account.
// (Previously showed a 12-word "recovery phrase" that wasn't linked to the key, so it was removed.)
const POINTS = [
  { icon: KeyRound, text: 'A signing key is generated on this device.' },
  { icon: ShieldCheck, text: 'It is encrypted with your PIN before it is stored.' },
  { icon: CloudUpload, text: 'An encrypted backup lets you restore it by signing in with your phone.' },
];

export default function RecoveryPhrase() {
  const navigate = useNavigate();
  const location = useLocation();
  const { name, phone, email, pin, otpToken } = location.state || {};
  const { setUser, loadWalletState } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If state is lost (user refreshed or navigated here directly), redirect back
  if (!pin || !phone || !name) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Session expired</CardTitle>
          <CardDescription>Your sign-up details were lost. Please start again.</CardDescription>
        </CardHeader>
        <CardContent><Button className="w-full" onClick={() => navigate('/register', { replace: true })}>Back to sign up</Button></CardContent>
      </Card>
    );
  }

  const finishRegister = async () => {
    setLoading(true); setError('');
    try {
      const { pubKey, privKeyRaw } = await generateKeypair();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const aesKey = await deriveKeyFromPIN(pin, salt);
      const { encryptedKey, iv } = await encryptPrivateKey(privKeyRaw, aesKey);

      // Wipe any existing data to ensure clean slate for new user
      await wipeKeys();

      const saltB64 = btoa(String.fromCharCode(...salt));
      await saveKeys({ pubKey, encryptedKey, iv, salt: saltB64 });

      const regResult = await registerUser({
        phone,
        name,
        email,
        pubKey,
        otpToken,
        backup: { enc: encryptedKey, iv, salt: saltB64 }
      });
      await saveWalletState({ confirmed_bal: 0, locked_bal: 0, unconfirmed_received: 0, nonce: 0, daily_spent: 0, daily_date: '' });
      const walletId = regResult.walletId || ('PP·' + (name || 'user').toLowerCase().split(' ')[0] + '·' + pubKey.slice(0, 8));
      await setUser({ name, phone, email, walletId, pubKey, userId: regResult.userId, createdAt: Date.now() });
      await loadWalletState();
      navigate('/home', { replace: true });
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.response?.data?.error || err.message || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium text-muted-foreground">Step 3 of 3</p>
        <CardTitle className="text-xl">Create your wallet</CardTitle>
        <CardDescription>Here’s how your wallet is secured, {name.split(' ')[0]}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-3">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></div>
              <span className="pt-1.5 text-muted-foreground">{text}</span>
            </li>
          ))}
        </ul>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Don’t share your PIN. Anyone with your phone and PIN can make payments from this wallet.
        </p>
        {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
        <Button className="w-full" onClick={finishRegister} disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}{loading ? 'Creating wallet…' : 'Create wallet'}
        </Button>
      </CardContent>
    </Card>
  );
}
