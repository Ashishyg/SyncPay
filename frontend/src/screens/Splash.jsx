import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { useEffect } from 'react';

export default function Splash() {
  const navigate = useNavigate();
  const { isLoggedIn } = useWalletStore();

  // Auto-redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) navigate('/home', { replace: true });
  }, [isLoggedIn]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-tertiary/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-10 relative z-10">
        {/* Logo */}
        <div className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-primary-container to-primary flex items-center justify-center mb-8 shadow-[0_16px_48px_rgba(108,92,231,0.4)]">
          <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>credit_card</span>
        </div>

        <h1 className="text-4xl font-black text-white tracking-tighter mb-3 text-center">SyncPay</h1>
        <p className="text-slate-400 text-sm text-center leading-relaxed max-w-[280px]">
          Pay anyone, anywhere — even without internet. Secured by Ed25519 cryptography.
        </p>

        {/* Dots */}
        <div className="flex gap-2 mt-8">
          <div className="w-7 h-1.5 rounded-full bg-gradient-to-r from-primary-container to-primary" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
        </div>

        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.15em] mt-4">
          Works Offline · Ed25519 Secured · Made in India
        </p>
      </div>

      {/* Buttons */}
      <div className="px-6 pb-10 space-y-3 relative z-10">
        <button
          onClick={() => navigate('/register')}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary-container to-primary text-white font-black text-base tracking-wide shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
        >
          Create Account
        </button>
        <button
          onClick={() => navigate('/login')}
          className="w-full py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm tracking-wide hover:bg-white/10 active:scale-[0.98] transition-all"
        >
          Sign in to existing wallet
        </button>
      </div>
    </div>
  );
}
