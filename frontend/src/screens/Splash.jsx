import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { WifiOff, ShieldCheck, RefreshCw } from 'lucide-react';
import { useWalletStore } from '../store/walletStore';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { icon: WifiOff, title: 'Works without internet', desc: 'Pay by QR even with zero signal.' },
  { icon: ShieldCheck, title: 'Signed on your device', desc: 'Every payment is Ed25519-signed.' },
  { icon: RefreshCw, title: 'Settles automatically', desc: 'Syncs the moment you reconnect.' },
];

export default function Splash() {
  const navigate = useNavigate();
  const { isLoggedIn } = useWalletStore();

  // Auto-redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) navigate('/home', { replace: true });
  }, [isLoggedIn]);

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Payments that don’t need a signal</h1>
        <p className="text-sm text-muted-foreground">A UPI-style wallet for places where the network drops out.</p>
      </div>

      <ul className="space-y-3">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <li key={title} className="flex items-start gap-3 rounded-xl border bg-card p-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></div>
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <Button size="lg" className="w-full" onClick={() => navigate('/register')}>Create account</Button>
        <Button size="lg" variant="outline" className="w-full" onClick={() => navigate('/login')}>I already have a wallet</Button>
      </div>
    </div>
  );
}
