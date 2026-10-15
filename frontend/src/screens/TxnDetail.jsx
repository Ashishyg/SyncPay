import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Copy, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getTxnById } from '../services/storageService';
import PageHeader from '@/components/PageHeader';
import { StatusBadge } from '@/components/TxnRow';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatINR } from '@/lib/utils';

const MODES = { offline_p2p: 'Offline QR', merchant_qr: 'Merchant QR', top_up: 'Top-up', withdrawal: 'Bank withdrawal' };

export default function TxnDetail() {
  const { id } = useParams();
  const [txn, setTxn] = useState(null);

  useEffect(() => { if (id) getTxnById(id).then(setTxn); }, [id]);

  if (!txn) return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Transaction" back />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );

  const isSent = txn.type === 'sent';
  const rows = [
    [isSent ? 'To' : 'From', txn.recipientName || txn.from_pub?.slice(0, 12) || '—'],
    ['Method', MODES[txn.mode] || 'Offline QR'],
    ['Date', new Date(txn.created_at * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })],
    ...(txn.nonce != null ? [['Nonce', String(txn.nonce)]] : []),
    ...(txn.fail_reason ? [['Failure reason', txn.fail_reason.replaceAll('_', ' ').toLowerCase()]] : []),
  ];

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Transaction" back />
      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <div className={cn('flex size-12 items-center justify-center rounded-full', isSent ? 'bg-muted' : 'bg-success/15 text-success')}>
              {isSent ? <ArrowUpRight className="size-6" /> : <ArrowDownLeft className="size-6" />}
            </div>
            <p className={cn('text-4xl font-semibold tracking-tight tabular', !isSent && 'text-success')}>
              {isSent ? '−' : '+'}{formatINR(txn.amount)}
            </p>
            <StatusBadge status={txn.status} />
          </div>
          <Separator />
          <dl className="space-y-3 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
            {txn.signature && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Signature</dt>
                <dd className="flex items-center gap-1 font-medium text-success"><ShieldCheck className="size-4" />Ed25519 signed</dd>
              </div>
            )}
          </dl>
          <Separator />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Transaction ID</p>
              <p className="truncate font-mono text-xs">{txn.id}</p>
            </div>
            <Button variant="outline" size="icon-sm" aria-label="Copy transaction ID"
              onClick={() => { navigator.clipboard?.writeText(txn.id); toast.success('Transaction ID copied'); }}>
              <Copy />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
