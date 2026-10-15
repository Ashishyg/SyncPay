import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatINR } from '@/lib/utils';

const STATUS = {
  confirmed: { label: 'Confirmed', className: 'bg-success/15 text-success' },
  pending: { label: 'Pending', className: 'bg-warning/15 text-warning' },
  unconfirmed_received: { label: 'Unconfirmed', className: 'bg-warning/15 text-warning' },
  failed: { label: 'Failed', className: 'bg-destructive/15 text-destructive' },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, className: '' };
  return <Badge variant="secondary" className={cn('border-0 font-medium', s.className)}>{s.label}</Badge>;
}

export function txnTime(created_at) {
  if (!created_at) return '';
  const d = new Date(created_at * 1000);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function TxnRow({ tx }) {
  const navigate = useNavigate();
  const sent = tx.type === 'sent';
  const Icon = sent ? ArrowUpRight : ArrowDownLeft;
  return (
    <button
      onClick={() => navigate(`/history/${tx.id}`)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-accent/60"
    >
      <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', sent ? 'bg-muted text-foreground' : 'bg-success/15 text-success')}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tx.recipientName || (sent ? 'Payment sent' : 'Payment received')}</p>
        <p className="text-xs text-muted-foreground">{txnTime(tx.created_at)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <p className={cn('text-sm font-semibold tabular', !sent && 'text-success')}>
          {sent ? '−' : '+'}{formatINR(tx.amount)}
        </p>
        {tx.status !== 'confirmed' && <StatusBadge status={tx.status} />}
      </div>
    </button>
  );
}
