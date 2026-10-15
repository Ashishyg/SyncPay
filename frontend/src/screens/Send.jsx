import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { allowanceLeft } from '../services/walletService';
import { getAllTxns } from '../services/storageService';
import { Search, CheckCircle2, Users, AlertTriangle, WifiOff } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN');

export default function Send() {
  const navigate = useNavigate();
  const wallet = useWalletStore();
  const { isOnline } = wallet;
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState('');
  const [selected, setSelected] = useState(null);
  const [limitWarn, setLimitWarn] = useState('');
  const [recents, setRecents] = useState([]);

  useEffect(() => { loadRecents(); }, []);

  const loadRecents = async () => {
    const all = await getAllTxns();
    const unique = [];
    const seen = new Set();
    all.filter(t => t.type === 'sent' && t.recipientName).forEach(t => {
      if (!seen.has(t.recipientName)) {
        seen.add(t.recipientName);
        unique.push({ name: t.recipientName, id: t.to_user_id || t.toUserId, phone: 'SyncPay Wallet' });
      }
    });
    setRecents(unique.slice(0, 5));
  };

  const spendable = allowanceLeft(wallet); // offline payments draw on the server-backed allowance
  const filtered = recents.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const checkAmt = (val) => {
    setAmount(val);
    const amt = parseInt(val) * 100;
    if (amt > spendable) setLimitWarn(spendable ? 'More than your offline allowance left' : 'No offline allowance yet: add money while online');
    else if (!isOnline && amt > 50000) setLimitWarn('Offline limit is ₹500 per transaction');
    else setLimitWarn('');
  };

  const proceed = () => {
    const amt = parseInt(amount) * 100;
    if (!amount || amt <= 0 || amt > spendable) return;
    if (!isOnline && amt > 50000) return;
    navigate('/send/confirm', { state: { amount: amt, recipient: selected || { name: 'QR payment', id: 'unknown' } } });
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Send money" description="The receiver scans your QR — no internet needed on either phone." back>
        {!isOnline && <Badge variant="outline" className="gap-1.5"><WifiOff className="size-3" />Offline</Badge>}
      </PageHeader>

      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-muted-foreground">Amount</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-medium text-muted-foreground">₹</span>
              <input
                type="number" inputMode="numeric" autoFocus aria-label="Amount in rupees"
                value={amount} onChange={e => checkAmt(e.target.value)} placeholder="0"
                style={{ width: `${Math.max(String(amount).length, 1) + 0.25}ch` }}
                className="max-w-full bg-transparent text-center text-5xl font-semibold tracking-tight tabular outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <p className="text-sm text-muted-foreground">Offline allowance left <span className="font-medium text-foreground tabular">{fmt(spendable)}</span></p>
            <div className="flex flex-wrap justify-center gap-2">
              {[50, 100, 200, 500].map(v => (
                <Button key={v} variant="outline" size="sm" className="rounded-full" onClick={() => checkAmt(String(v))}>₹{v}</Button>
              ))}
            </div>
            {limitWarn && <Alert variant="destructive"><AlertTriangle /><AlertDescription>{limitWarn}</AlertDescription></Alert>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recipient <span className="font-normal text-muted-foreground">(optional)</span></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search recent contacts" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {filtered.length > 0 ? (
              <div className="-mx-2 space-y-0.5">
                {filtered.map(c => {
                  const isSel = selected?.id === c.id;
                  return (
                    <button key={c.id} onClick={() => setSelected(isSel ? null : c)}
                      className={cn('flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors', isSel ? 'bg-accent' : 'hover:bg-accent/60')}>
                      <Avatar className="size-9"><AvatarFallback className="bg-primary/10 text-primary">{c.name[0].toUpperCase()}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                      </div>
                      {isSel && <CheckCircle2 className="size-5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                <Users className="size-6 opacity-50" />
                No recent contacts. Anyone who scans your QR can receive it.
              </div>
            )}
          </CardContent>
        </Card>

        <Button size="lg" className="w-full" onClick={proceed} disabled={!amount || !!limitWarn}>Review payment</Button>
      </div>
    </div>
  );
}
