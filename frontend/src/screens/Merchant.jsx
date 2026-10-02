import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { QRCodeSVG } from 'qrcode.react';
import { getMerchantQR, getMerchantCollections } from '../services/apiService';

const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Merchant() {
  const navigate = useNavigate();
  const { user } = useWalletStore();
  const [qrPayload, setQrPayload] = useState('');
  const [collections, setCollections] = useState([]);
  const [totals, setTotals] = useState({ today: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [qrRes, colRes] = await Promise.all([
        getMerchantQR(),
        getMerchantCollections(),
      ]);

      setQrPayload(qrRes.payload);
      setCollections(colRes.payments || []);
      setTotals({ today: colRes.todayTotal || 0, all: colRes.total || 0 });
    } catch {
      // Offline fallback: build payload from local user state
      const fallback = JSON.stringify({
        type: 'merchant_pay',
        userId: user?.userId,
        name: user?.name,
        pubKey: user?.pubKey,
        walletId: user?.walletId || '',
      });
      setQrPayload(fallback);
    }
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
      navigator.clipboard.writeText(qrPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <main className="min-h-screen pb-24 w-full bg-background">
      {/* Top Bar */}
      <header className="fixed top-14 lg:top-0 right-0 lg:left-64 left-0 h-16 lg:h-20 bg-background/80 backdrop-blur-xl border-b border-outline-variant/15 px-4 lg:px-10 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-slate-400">arrow_back</span>
          </button>
          <h2 className="text-xl font-bold text-white tracking-tight">Merchant Mode</h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Static QR</span>
        </div>
      </header>

      <div className="pt-36 lg:pt-28 px-4 lg:px-10 max-w-6xl mx-auto space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 p-6 flex flex-col gap-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Today's Collections</p>
            <p className="text-3xl font-black text-emerald-400 tracking-tight">{fmt(totals.today)}</p>
            <p className="text-xs text-slate-500">{collections.filter(c => c.created_at >= new Date().setHours(0,0,0,0)/1000).length} payments received</p>
          </div>
          <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 p-6 flex flex-col gap-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">All Time</p>
            <p className="text-3xl font-black text-primary tracking-tight">{fmt(totals.all)}</p>
            <p className="text-xs text-slate-500">{collections.length} total payments</p>
          </div>
        </div>

        {/* QR Card */}
        <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-3xl border-t border-l border-outline-variant/15 p-10 flex flex-col items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-40 bg-primary/8 blur-[80px] rounded-full"></div>

          <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-xs">
            <div>
              <p className="text-center text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">Printable · Offline-Ready</p>
              <h3 className="text-center text-2xl font-black text-white tracking-tight">{user?.name || 'My Store'}</h3>
              <p className="text-center text-xs text-slate-500 mt-1">Customers scan this QR to pay you instantly</p>
            </div>

            {/* QR Box */}
            {loading ? (
              <div className="w-56 h-56 rounded-2xl bg-white/5 animate-pulse flex items-center justify-center">
                <span className="text-slate-600 text-sm">Loading QR...</span>
              </div>
            ) : qrPayload ? (
              <div className="bg-white p-5 rounded-2xl shadow-[0_0_60px_rgba(108,92,231,0.25)]" ref={printRef}>
                <QRCodeSVG
                  id="merchant-qr-svg"
                  value={qrPayload}
                  size={200}
                  level="M"
                  fgColor="#1a0050"
                  bgColor="#ffffff"
                />
              </div>
            ) : (
              <div className="w-56 h-56 rounded-2xl bg-white/5 flex items-center justify-center">
                <p className="text-slate-500 text-sm text-center px-4">QR unavailable — please connect to internet</p>
              </div>
            )}

            <p className="text-center text-[10px] font-mono text-slate-600 break-all px-2">{user?.walletId || ''}</p>

            {/* Action Buttons */}
            <div className="flex gap-3 w-full">
              <button onClick={handlePrint} className="flex-1 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-xs uppercase tracking-widest hover:bg-primary/20 transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">print</span> Print
              </button>
              <button onClick={handleDownload} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">download</span> Save
              </button>
              <button onClick={handleShare} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">share</span>
                {copied ? 'Copied!' : 'Share'}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Collections */}
        <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 p-8">
          <h4 className="text-white font-bold text-lg mb-6">Recent Payments</h4>
          {collections.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-5xl text-slate-700 block mb-3">qr_code_scanner</span>
              <p className="text-slate-500 text-sm">No payments yet. Share your QR with customers!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {collections.slice(0, 20).map(p => (
                <div key={p._id} className="flex items-center gap-4 p-3 -mx-3 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-400 text-xl">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{p.sender_name || 'Customer'}</p>
                    <p className="text-xs text-slate-500">{new Date(p.created_at * 1000).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}{p.note ? ` · ${p.note}` : ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-emerald-400">+{fmt(p.amount)}</p>
                    <span className="text-[10px] text-emerald-600 uppercase font-bold">Confirmed</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
