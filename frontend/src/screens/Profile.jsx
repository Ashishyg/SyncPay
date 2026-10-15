import { BadgeCheck, Copy, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { useWalletStore } from '../store/walletStore';
import PageHeader from '@/components/PageHeader';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Profile() {
  const { user } = useWalletStore();
  const initial = (user?.name || 'U')[0].toUpperCase();
  const pub = user?.pubKey || '';
  const rows = [
    ['Phone', user?.phone || '—'],
    ['Email', user?.email || '—'],
    ['Wallet ID', user?.walletId || '—'],
    ['Public key', pub ? `${pub.slice(0, 6)}…${pub.slice(-6)}` : '—', pub],
    ...(user?.createdAt ? [['Member since', new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })]] : []),
  ];

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Profile" back />
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
            <Avatar className="size-20"><AvatarFallback className="bg-primary/15 text-2xl font-semibold text-primary">{initial}</AvatarFallback></Avatar>
            <div>
              <p className="text-xl font-semibold">{user?.name || 'User'}</p>
              <p className="font-mono text-xs text-muted-foreground">{user?.walletId}</p>
            </div>
            <Badge variant="secondary" className="gap-1 bg-success/15 text-success"><BadgeCheck className="size-3.5" />Phone verified</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Account details</CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {rows.map(([k, v, copy]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="flex items-center gap-1 truncate font-medium">
                    {v}
                    {copy && (
                      <Button variant="ghost" size="icon-xs" aria-label={`Copy ${k}`}
                        onClick={() => { navigator.clipboard?.writeText(copy); toast.success(`${k} copied`); }}><Copy /></Button>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Bank account</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Landmark className="size-5" /></div>
            <div className="flex-1">
              <p className="text-sm font-medium">Primary bank</p>
              <p className="font-mono text-xs text-muted-foreground">xxxx {(user?.phone || '').slice(-4)} · Savings</p>
            </div>
            <Badge variant="secondary">Demo</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
