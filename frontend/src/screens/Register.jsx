import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOTP } from '../services/apiService';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const doRegister = async () => {
    if (!name.trim() || !phone.trim() || phone.length < 10) return;
    setLoading(true); setError('');
    try {
      const formattedPhone = '+91' + phone.replace(/\s/g, '').slice(-10);
      await sendOTP(formattedPhone);
      navigate('/otp', { state: { name, phone: formattedPhone, email } });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/8 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-10 pb-4 flex-shrink-0 relative z-10">
        <button onClick={() => navigate('/')} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors">
          <span className="material-symbols-outlined text-slate-400">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold text-white">Create Account</h2>
      </header>

      <div className="flex-1 flex flex-col px-6 relative z-10 overflow-y-auto pb-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Join SyncPay</h1>
          <p className="text-slate-400 text-sm">Your offline-first crypto wallet. Takes 2 minutes.</p>
        </div>

        <div className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name</label>
            <input
              type="text"
              placeholder="Riya Sharma"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#0d0d15]/80 border border-outline-variant/20 rounded-2xl px-5 py-4 text-white placeholder-slate-700 focus:outline-none focus:border-primary/40 transition-colors text-base font-medium"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mobile Number</label>
            <div className="bg-[#0d0d15]/80 border border-outline-variant/20 rounded-2xl flex items-center gap-3 px-5 py-4 focus-within:border-primary/40 transition-colors">
              <div className="flex items-center gap-2 pr-4 border-r border-outline-variant/20 flex-shrink-0">
                <span className="text-sm font-bold text-white">+91</span>
              </div>
              <input
                type="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                maxLength={10}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder-slate-700 text-base font-medium tracking-widest"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email (optional)</label>
            <input
              type="email"
              placeholder="riya@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#0d0d15]/80 border border-outline-variant/20 rounded-2xl px-5 py-4 text-white placeholder-slate-700 focus:outline-none focus:border-primary/40 transition-colors text-base font-medium"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-error font-medium">
              <span className="material-symbols-outlined text-base flex-shrink-0">error</span>
              {error}
            </div>
          )}

          {/* Info */}
          <div className="bg-white/3 border border-outline-variant/15 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="material-symbols-outlined text-slate-500 text-base flex-shrink-0 mt-0.5">info</span>
            <p className="text-xs text-slate-500 leading-relaxed">
              An OTP will be sent to your number. For dev/testing, use OTP <strong className="text-slate-300">123456</strong>.
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-8" />

        {/* CTA */}
        <button
          onClick={doRegister}
          disabled={loading || !name.trim() || phone.length < 10}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary-container to-primary text-white font-black text-base tracking-wide shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition-all mt-6"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              Sending OTP...
            </span>
          ) : 'Continue'}
        </button>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account?{' '}
          <span onClick={() => navigate('/login')} className="text-primary font-bold cursor-pointer hover:underline">Sign in</span>
        </p>
      </div>
    </div>
  );
}
