import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { generateKeypair, deriveKeyFromPIN, encryptPrivateKey } from '../services/cryptoService';
import { saveKeys, saveWalletState, saveUserProfile, wipeKeys } from '../services/storageService';
import { registerUser } from '../services/apiService';
import { useWalletStore } from '../store/walletStore';

const BIP39_WORDS = [
  'abandon','ability','able','about','above','absent','absorb','abstract','absurd','abuse',
  'access','accident','account','accuse','achieve','acid','acoustic','acquire','across','act',
  'action','actor','actress','actual','adapt','add','addict','address','adjust','admit',
  'adult','advance','advice','aerobic','affair','afford','afraid','again','age','agent',
  'agree','ahead','aim','air','airport','aisle','alarm','album','alcohol','alert',
  'alien','all','alley','allow','almost','alone','alpha','already','also','alter',
  'always','amateur','amazing','among','amount','amused','analyst','anchor','ancient','anger',
  'angle','angry','animal','ankle','announce','annual','another','answer','antenna','antique',
  'anxiety','any','apart','apology','appear','apple','approve','april','arch','arctic',
  'area','arena','argue','arm','armed','armor','army','around','arrange','arrest',
  'arrive','arrow','art','artefact','artist','artwork','ask','aspect','assault','asset',
  'assist','assume','asthma','athlete','atom','attack','attend','attitude','attract','auction'
];

function generatePhrase() {
  const words = [];
  for (let i = 0; i < 12; i++) {
    const idx = crypto.getRandomValues(new Uint8Array(1))[0] % BIP39_WORDS.length;
    words.push(BIP39_WORDS[idx]);
  }
  return words;
}

export default function RecoveryPhrase() {
  const navigate = useNavigate();
  const location = useLocation();
  const { name, phone, email, pin } = location.state || {};
  const { setUser, loadWalletState } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const phrase = useMemo(() => generatePhrase(), []);

  // If state is lost (user refreshed or navigated here directly), redirect back
  if (!pin || !phone || !name) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-error text-3xl">error</span>
        </div>
        <h2 className="text-xl font-black text-white mb-2 text-center">Session Expired</h2>
        <p className="text-slate-400 text-sm text-center mb-6">
          Registration data was lost. Please start over.
        </p>
        <button
          onClick={() => navigate('/register', { replace: true })}
          className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-primary-container to-primary text-white font-black"
        >
          Back to Register
        </button>
      </div>
    );
  }

  const finishRegister = async () => {
    setLoading(true); setError('');
    try {
      const { pubKey, privKeyRaw } = await generateKeypair();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const aesKey = await deriveKeyFromPIN(pin, salt);
      const { encryptedKey, iv } = await encryptPrivateKey(privKeyRaw, aesKey);
      
      // Wipe any existing data to ensure clean slate for new user
      await wipeKeys();
      
      const saltB64 = btoa(String.fromCharCode(...salt));
      await saveKeys({ pubKey, encryptedKey, iv, salt: saltB64 });
      
      const regResult = await registerUser({ 
        phone, 
        name, 
        email, 
        pubKey,
        backup: { enc: encryptedKey, iv, salt: saltB64 } 
      });
      await saveWalletState({ confirmed_bal: 0, locked_bal: 0, unconfirmed_received: 0, nonce: 0, daily_spent: 0, daily_date: '' });
      const walletId = regResult.walletId || ('PP·' + (name || 'user').toLowerCase().split(' ')[0] + '·' + pubKey.slice(0, 8));
      await setUser({ name, phone, email, walletId, pubKey, userId: regResult.userId, createdAt: Date.now() });
      await loadWalletState();
      navigate('/home', { replace: true });
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.response?.data?.error || err.message || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/8 blur-[100px] rounded-full pointer-events-none" />

      <header className="flex items-center gap-3 px-6 pt-10 pb-4 flex-shrink-0 relative z-10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors">
          <span className="material-symbols-outlined text-slate-400">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold text-white">Recovery Phrase</h2>
      </header>

      <div className="flex-1 flex flex-col px-6 relative z-10 overflow-y-auto pb-8">
        {/* Warning */}
        <div className="bg-tertiary/10 border border-tertiary/20 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <span className="material-symbols-outlined text-tertiary text-base flex-shrink-0 mt-0.5">warning</span>
          <p className="text-xs text-tertiary leading-relaxed font-medium">
            Write these 12 words in order. Anyone with this phrase can access your wallet. Keep them offline and secret.
          </p>
        </div>

        {/* Word grid */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {phrase.map((w, i) => (
            <div key={i} className="bg-[#0d0d15]/80 border border-outline-variant/15 rounded-xl px-3 py-3 flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-600 w-4 text-right">{i + 1}</span>
              <span className="text-sm font-bold text-white font-mono">{w}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-error font-medium mb-4">
            <span className="material-symbols-outlined text-base flex-shrink-0">error</span>
            {error}
          </div>
        )}

        <button
          onClick={() => navigator.clipboard?.writeText(phrase.join(' '))}
          className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-bold text-sm mb-4 active:scale-[0.98] transition-all"
        >
          Copy words
        </button>

        <div className="flex-1 min-h-4" />

        <button
          onClick={finishRegister}
          disabled={loading}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary-container to-primary text-white font-black text-base tracking-wide shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              Creating wallet...
            </span>
          ) : "I've saved my phrase"}
        </button>
      </div>
    </div>
  );
}
