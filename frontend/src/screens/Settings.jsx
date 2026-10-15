import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Download, RefreshCw, Store, Gauge, ShieldCheck, ChevronRight, LogOut, Trash2, User, Loader2, KeyRound, MonitorSmartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useWalletStore } from '../store/walletStore';
import { wipeKeys, getAllTxns } from '../services/storageService';
import { logoutOtherDevices } from '../services/apiService';
import ChangePinDialog from '@/components/ChangePinDialog';
import PageHeader from '@/components/PageHeader';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function Row({ icon: Icon, label, desc, onClick, right }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left', onClick && 'transition-colors hover:bg-accent/60')}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      {right ?? (onClick && <ChevronRight className="size-4 text-muted-foreground" />)}
    </Comp>
  );
}

function Section({ title, children }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="divide-y p-0">{children}</CardContent>
    </Card>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, theme, toggleTheme } = useWalletStore();
  const [showWipe, setShowWipe] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const needOnline = (fn) => () => (navigator.onLine ? fn() : toast.error('This needs an internet connection'));
  const signOutOthers = async () => {
    try {
      await logoutOtherDevices(); // also stores this device's fresh session token
      toast.success('Signed out of all other devices');
    } catch {
      toast.error('Couldn’t sign out other devices. Try again.');
    }
  };
  const [wiping, setWiping] = useState(false);
  const initial = (user?.name || 'U')[0].toUpperCase();

  const doLogout = () => {
    localStorage.removeItem('sp_token');
    logout();
    navigate('/login', { replace: true });
  };

  const doWipe = async () => {
    setWiping(true);
    await wipeKeys();
    localStorage.clear();
    logout();
    navigate('/', { replace: true });
  };

  const exportCSV = async () => {
    const txns = await getAllTxns();
    if (!txns.length) return toast('No transactions to export');
    const rows = [['ID', 'Amount', 'Status', 'Type', 'Timestamp']];
    txns.forEach(t => rows.push([t.id, (t.amount / 100).toFixed(2), t.status, t.type || 'p2p', new Date((t.created_at || 0) * 1000).toISOString()]));
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map(r => r.join(',')).join('\n'));
    a.download = `SyncPay-txns-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-center gap-4">
            <Avatar className="size-12"><AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">{initial}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{user?.name || 'User'}</p>
              <p className="text-sm text-muted-foreground">{user?.phone || '—'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/profile')}><User />Profile</Button>
          </CardContent>
        </Card>

        <Section title="Preferences">
          <Row icon={Moon} label="Dark mode" right={<Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} aria-label="Dark mode" />} />
          <Row icon={RefreshCw} label="Sync status" desc="Pending payments and network" onClick={() => navigate('/sync')} />
        </Section>

        <Section title="Wallet">
          <Row icon={Gauge} label="Offline limits" desc="₹500 per payment · ₹2,000 per day" />
          <Row icon={Store} label="Merchant QR" desc="Accept payments at a shop" onClick={() => navigate('/merchant')} />
          <Row icon={Download} label="Export transactions" desc="Download as CSV" onClick={exportCSV} />
        </Section>

        <Section title="Security">
          <Row icon={KeyRound} label="Change PIN" desc="Re-encrypts your wallet key and updates your backup" onClick={needOnline(() => setShowPin(true))} />
          <Row icon={MonitorSmartphone} label="Sign out other devices" desc="Ends every other session on your account" onClick={needOnline(signOutOthers)} />
          <Row icon={ShieldCheck} label="Key protection" desc="Your signing key is encrypted with your PIN (AES-256-GCM) and never leaves this device unencrypted." />
        </Section>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="outline" onClick={doLogout}><LogOut />Sign out</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setShowWipe(true)}><Trash2 />Wipe device</Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">SyncPay v1.0.0</p>
      </div>

      <ChangePinDialog open={showPin} onOpenChange={setShowPin} />

      <Dialog open={showWipe} onOpenChange={setShowWipe}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Wipe this device?</DialogTitle>
            <DialogDescription>
              This erases your keys and local history from this device. You can restore your wallet by signing in with your phone,
              but any offline payments that haven’t synced yet will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWipe(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doWipe} disabled={wiping}>
              {wiping && <Loader2 className="animate-spin" />}Wipe device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
