import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { getKeys } from '../services/storageService';
import { deriveKeyFromPIN, decryptPrivateKey } from '../services/cryptoService';
import { createSendTransaction } from '../services/transactionService';
import { notifyPaymentSent } from '../services/notificationService';
import Keypad from '../components/Keypad';

const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function SendConfirm() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { amount, recipient } = state || { amount: 0, recipient: { name: '—' } };
  const { isOnline, loadWalletState } = useWalletStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleKey = async (key) => {
    if (processing || pin.length >= 6) return;
    const newPin = pin + key;
    setPin(newPin);
    if (newPin.length === 6) {
      setProcessing(true);
      try {
        const keys = await getKeys();
        const saltBytes = Uint8Array.from(atob(keys.salt), c => c.charCodeAt(0));
        const aesKey = await deriveKeyFromPIN(newPin, saltBytes);
        const privateKey = await decryptPrivateKey(keys.encPrivKey, keys.iv, aesKey);

        const result = await createSendTransaction({
          amount,
          recipientId: recipient.id,
          recipientName: recipient.name,
          privateKey,
          senderPubKey: keys.pubKey
        });

        await loadWalletState();

        // Push real notification
        await notifyPaymentSent(amount, recipient.name);

        navigate('/send/qr', { state: { ...result, amount, recipientName: recipient.name }, replace: true });
      } catch (e) {
        if (e.message === 'INSUFFICIENT_BALANCE') setError('Insufficient spendable balance');
        else if (e.message === 'EXCEEDS_OFFLINE_TXN_LIMIT') setError('Offline limit: ₹500 per txn');
        else if (e.message === 'EXCEEDS_DAILY_LIMIT') setError('Daily offline limit reached (₹2,000)');
        else setError('Wrong PIN. Try again.');
        setTimeout(() => { setPin(''); setError(''); }, 1200);
      }
      setProcessing(false);
    }
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/8 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-10 pb-4 flex-shrink-0 relative z-10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5">
          <span className="material-symbols-outlined text-slate-400">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold text-white">Confirm Payment</h2>
      </header>

      <div className="flex-1 flex flex-col px-6 relative z-10 overflow-y-auto pb-8">
        {/* Summary card */}
        <div className="bg-[#0d0d15]/80 rounded-2xl border-t border-l border-outline-variant/15 divide-y divide-outline-variant/10 mb-6">
          {[
            { label: 'Recipient', value: recipient.name },
            { label: 'Amount', value: fmt(amount), accent: true },
            { label: 'Transaction Fee', value: '₹0.00', green: true },
            { label: 'Mode', badge: isOnline ? 'Online' : 'Offline' },
            { label: 'QR expires in', value: '60 seconds' },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <span className="text-sm text-slate-500">{row.label}</span>
              {row.badge ? (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-tertiary/10 text-tertiary'}`}>
                  {row.badge}
                </span>
              ) : (
                <span className={`text-sm font-bold ${row.accent ? 'text-primary text-lg' : row.green ? 'text-emerald-400' : 'text-white'}`}>
                  {row.value}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Offline warning */}
        {!isOnline && (
          <div className="bg-tertiary/10 border border-tertiary/20 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
            <span className="material-symbols-outlined text-tertiary text-base flex-shrink-0 mt-0.5">warning</span>
            <p className="text-xs text-tertiary leading-relaxed font-medium">
              Offline payment: <strong>₹{(amount / 100).toLocaleString('en-IN')}</strong> will be locked until both devices sync online.
            </p>
          </div>
        )}

        {/* PIN section */}
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-4">Confirm with PIN</p>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-3">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              i < pin.length
                ? error ? 'bg-error border-error scale-110' : 'bg-primary border-primary scale-110'
                : 'bg-transparent border-slate-700'
            }`} />
          ))}
        </div>

        {error && <p className="text-error text-sm font-bold text-center mb-2">{error}</p>}
        {processing && (
          <p className="text-primary text-sm text-center mb-2 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
            Generating QR...
          </p>
        )}

        <Keypad onKey={handleKey} onDelete={handleDelete} />
      </div>
    </div>
  );
}
