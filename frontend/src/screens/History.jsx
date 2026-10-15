import { useState, useEffect } from 'react';
import { Search, ReceiptText } from 'lucide-react';
import { getAllTxns } from '../services/storageService';
import { pullServerHistory } from '../services/syncService';
import PageHeader from '@/components/PageHeader';
import TxnRow from '@/components/TxnRow';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'received', label: 'Received' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
];

// Group label for a unix-seconds timestamp: Today / Yesterday / 12 Oct 2026
function dayLabel(ts) {
  const d = new Date(ts * 1000);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function History() {
  const [txns, setTxns] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTxns();
    const onVisChange = () => { if (document.visibilityState === 'visible') loadTxns(); };
    const onFocus = () => loadTxns();
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('focus', onFocus);
    return () => { document.removeEventListener('visibilitychange', onVisChange); window.removeEventListener('focus', onFocus); };
  }, []);

  const loadTxns = async () => {
    const show = async () => setTxns((await getAllTxns()).sort((a, b) => b.created_at - a.created_at));
    await show(); // local first (works offline)
    try { if (await pullServerHistory()) await show(); } catch { /* offline or not signed in */ }
  };

  const filtered = txns.filter(t => {
    if (filter === 'sent')     return t.type === 'sent';
    if (filter === 'received') return t.type === 'received';
    if (filter === 'pending')  return t.status === 'pending' || t.status === 'unconfirmed_received';
    if (filter === 'failed')   return t.status === 'failed';
    return true;
  }).filter(t =>
    !search || (t.recipientName || '').toLowerCase().includes(search.toLowerCase())
  );

  const groups = [];
  for (const tx of filtered) {
    const label = dayLabel(tx.created_at);
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1).items.push(tx);
  }

  return (
    <div>
      <PageHeader title="History" description={`${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`} />
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="w-full sm:w-auto">
              {FILTERS.map(f => <TabsTrigger key={f.id} value={f.id}>{f.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <ReceiptText className="size-10 opacity-40" />
              No transactions found
            </CardContent>
          </Card>
        ) : groups.map(g => (
          <div key={g.label}>
            <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">{g.label}</p>
            <Card>
              <CardContent className="px-2">
                {g.items.map(tx => <TxnRow key={tx.id} tx={tx} />)}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
