import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { QRCodeSVG } from 'qrcode.react';
import { getMerchantCollections } from '../services/apiService';
import { Printer, Download, Share2, Check, Inbox, ScanLine } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Merchant() {
  const navigate = useNavigate();
  const { user } = useWalletStore();
  const [qrPayload, setQrPayload] = useState('');
  const [collections, setCollections] = useState([]);
  const [totals, setTotals] = useState({ today: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [askAmount, setAskAmount] = useState(''); // optional: put the amount in the QR
  const askPaise = Math.round(parseFloat(askAmount) * 100) || 0;
  const qrValue = qrPayload && askPaise > 0 ? JSON.stringify({ ...JSON.parse(qrPayload), amount: askPaise }) : qrPayload;
  const [copied, setCopied] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    fetchAll();
  }, []);

  // The static QR only identifies this account, so it's built on-device (works offline).
  // Customers sign payments addressed to user.userId; collections come from the server once synced.
  async function fetchAll() {
    setLoading(true);
    setQrPayload(JSON.stringify({
      type: 'merchant_pay',
      userId: user?.userId,
      name: user?.name,
      pubKey: user?.pubKey,
      walletId: user?.walletId || '',
    }));
    try {
      const colRes = await getMerchantCollections();
      setCollections(colRes.payments || []);
      setTotals({ today: colRes.todayTotal || 0, all: colRes.total || 0 });
    } catch { /* offline: show the QR without totals */ }
    setLoading(false);
  }

  function handlePrint() {
    const svg = document.getElementById('merchant-qr-svg')?.outerHTML;
    if (!svg) return;
    const w = window.open('', '_blank');
    w.document.write(`
      <!DOCTYPE html><html><head>
        <title>SyncPay — ${user?.name || 'Merchant'} QR</title>
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #fff; color: #111; margin: 0; }
          .card { border: 2px solid #111; border-radius: 16px; padding: 32px 40px; text-align: center; max-width: 320px; }
          .brand { font-size: 11px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; color: #6c5ce7; margin-bottom: 8px; }
          h2 { font-size: 22px; font-weight: 800; margin: 12px 0 4px; }
          p  { font-size: 12px; color: #666; margin: 0 0 20px; }
          svg { max-width: 200px; }
          .footer { font-size: 10px; color: #999; margin-top: 16px; }
        </style>
      </head><body>
        <div class="card">
          <div class="brand">⚡ SyncPay</div>
          ${svg}
          <h2>${user?.name || 'Merchant Store'}</h2>
          <p>Scan to pay instantly · No internet needed for sender</p>
          <div class="footer">Powered by SyncPay Offline Payments</div>
        </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  async function handleDownload() {
    const svg = document.getElementById('merchant-qr-svg');
    if (!svg) return;
    const canvas = document.createElement('canvas');
    const size = 400;
    canvas.width = size; canvas.height = size + 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    const svgBlob = new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(user?.name || 'Merchant', size / 2, size + 40);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('Scan to pay via SyncPay', size / 2, size + 65);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = `SyncPay-qr-${(user?.name || 'merchant').toLowerCase().replace(/\s/g, '-')}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  }

  async function handleShare() {
    if (navigator.share && qrPayload) {
      try {
        await navigator.share({ title: `Pay ${user?.name}`, text: `Scan my SyncPay QR to pay me directly.`, url: window.location.href });
      } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(qrValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const todayCount = collections.filter(c => c.created_at >= new Date().setHours(0, 0, 0, 0) / 1000).length;

  return (
    <div>
      <PageHeader title="Merchant" description="Your static QR for accepting payments at a shop or stall." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="text-center">
            <CardTitle>{user?.name || 'My store'}</CardTitle>
            <CardDescription>Customers scan this, enter an amount, and show you a payment QR</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5">
            {loading ? (
              <Skeleton className="size-60 rounded-2xl" />
            ) : qrPayload ? (
              <div className="rounded-2xl border bg-white p-4" ref={printRef}>
                <QRCodeSVG id="merchant-qr-svg" value={qrValue} size={208} level="M" fgColor="#18181b" bgColor="#ffffff" />
              </div>
            ) : (
              <div className="flex size-60 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                QR unavailable. Connect to the internet and try again.
              </div>
            )}
            <p className="break-all text-center font-mono text-xs text-muted-foreground">{user?.walletId || ''}</p>
            <div className="w-full space-y-1.5">
              <Label htmlFor="ask">Ask for an amount <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input id="ask" type="number" inputMode="decimal" placeholder="Customer enters it" className="pl-7 tabular"
                  value={askAmount} onChange={e => setAskAmount(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {askPaise > 0 ? `This QR asks for ${fmt(askPaise)}; the customer just confirms.` : 'Leave empty for a reusable QR where customers type the amount.'}
              </p>
            </div>
            <div className="grid w-full grid-cols-3 gap-2">
              <Button variant="outline" onClick={handlePrint}><Printer />Print</Button>
              <Button variant="outline" onClick={handleDownload}><Download />Save</Button>
              <Button variant="outline" onClick={handleShare}>{copied ? <Check /> : <Share2 />}{copied ? 'Copied' : 'Share'}</Button>
            </div>
            <Button className="w-full" onClick={() => navigate('/receive')}><ScanLine />Scan customer’s payment</Button>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-3">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="mt-1 text-2xl font-semibold tabular">{fmt(totals.today)}</p>
                <p className="text-xs text-muted-foreground">{todayCount} payment{todayCount === 1 ? '' : 's'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">All time</p>
                <p className="mt-1 text-2xl font-semibold tabular">{fmt(totals.all)}</p>
                <p className="text-xs text-muted-foreground">{collections.length} payment{collections.length === 1 ? '' : 's'}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Recent payments</CardTitle></CardHeader>
            <CardContent className="p-2">
              {collections.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <Inbox className="size-8 opacity-40" />No payments yet. Share your QR with customers.
                </div>
              ) : collections.slice(0, 20).map(p => (
                <div key={p._id} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                  <div className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-medium">{(p.sender_name || 'C')[0].toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.sender_name || 'Customer'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(p.created_at * 1000).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}{p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold text-success tabular">+{fmt(p.amount)}</p>
                    <Badge variant="secondary" className="bg-success/15 text-success">Confirmed</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
