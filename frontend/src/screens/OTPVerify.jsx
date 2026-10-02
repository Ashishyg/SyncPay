import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { verifyOTP, sendOTP } from '../services/apiService';

export default function OTPVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { name, phone, email } = location.state || {};
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    const t = setInterval(() => setTimer(p => p > 0 ? p - 1 : 0), 1000);
    refs[0].current?.focus();
    return () => clearInterval(t);
  }, []);

  const handleInput = (val, idx) => {
    if (!/^\d?$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 5) refs[idx + 1].current?.focus();
    if (val && idx === 5) {
      const code = [...newOtp.slice(0, 5), val].join('');
      if (code.length === 6) doVerify(code);
    }
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) refs[idx - 1].current?.focus();
  };

  const doVerify = async (code) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== 6) return;
    setLoading(true); setError('');
    try {
      await verifyOTP(phone, otpCode);
      navigate('/pin-setup', { state: { name, phone, email } });
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Try again.');
      setOtp(['', '', '', '', '', '']);
      refs[0].current?.focus();
    }
    setLoading(false);
  };

  const resend = async () => {
    if (timer > 0) return;
    try { await sendOTP(phone); setTimer(30); setError(''); } catch (err) { setError(err.response?.data?.error || 'Failed to resend OTP'); }
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/8 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-10 pb-4 flex-shrink-0 relative z-10">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors">
          <span className="material-symbols-outlined text-slate-400">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold text-white">Verify OTP</h2>
      </header>

      <div className="flex-1 flex flex-col px-6 relative z-10">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-primary text-3xl">smartphone</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Check your SMS</h1>
          <p className="text-slate-400 text-sm">Code sent to <span className="text-white font-bold">{phone || 'your number'}</span></p>
        </div>

        {/* OTP inputs */}
        <div className="flex gap-3 justify-center mb-6">
          {otp.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              maxLength="1"
              type="tel"
              inputMode="numeric"
              value={d}
              onChange={e => handleInput(e.target.value, i)}
              onKeyDown={e => handleKeyDown(e, i)}
              className="w-12 h-14 bg-[#0d0d15]/80 border border-outline-variant/20 rounded-xl text-center text-xl font-bold text-white focus:outline-none focus:border-primary/60 focus:shadow-[0_0_0_3px_rgba(108,92,231,0.15)] transition-all"
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-3 text-sm text-error font-medium">
            <span className="material-symbols-outlined text-base flex-shrink-0">error</span>
            {error}
          </div>
        )}

        {/* Resend */}
        <div className="text-center text-sm text-slate-500 mb-6">
          Didn't receive it?{' '}
          <span
            onClick={resend}
            className={`font-bold ${timer > 0 ? 'text-slate-600 cursor-default' : 'text-primary cursor-pointer hover:underline'}`}
          >
            {timer > 0 ? `Resend (${timer}s)` : 'Resend now'}
          </span>
        </div>

        {/* Info */}
        <div className="bg-white/3 border border-outline-variant/15 rounded-xl px-4 py-3 flex items-start gap-3 mb-6">
          <span className="material-symbols-outlined text-slate-500 text-base flex-shrink-0 mt-0.5">info</span>
          <p className="text-xs text-slate-500 leading-relaxed">
            For development/testing, use OTP <strong className="text-slate-300">123456</strong>.
          </p>
        </div>

        <div className="flex-1" />

        {/* CTA */}
        <button
          onClick={() => doVerify()}
          disabled={loading || otp.join('').length < 6}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary-container to-primary text-white font-black text-base tracking-wide shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition-all mb-8"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              Verifying...
            </span>
          ) : 'Verify & Continue'}
        </button>
      </div>
    </div>
  );
}
