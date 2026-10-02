import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Keypad from '../components/Keypad';

export default function PinSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const regData = location.state || {};
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [phase, setPhase] = useState('create'); // create | confirm
  const [hint, setHint] = useState('');

  const handleKey = (key) => {
    if (phase === 'create') {
      if (pin.length < 6) {
        const newPin = pin + key;
        setPin(newPin);
        if (newPin.length === 6) {
          setTimeout(() => {
            setPhase('confirm');
            setHint('');
          }, 200);
        }
      }
    } else {
      if (confirmPin.length < 6) {
        const newPin = confirmPin + key;
        setConfirmPin(newPin);
        if (newPin.length === 6) {
          if (newPin === pin) {
            navigate('/recovery-phrase', { state: { ...regData, pin: newPin } });
          } else {
            setHint("PINs don't match. Try again.");
            setTimeout(() => { setConfirmPin(''); setHint(''); }, 800);
          }
        }
      }
    }
  };

  const handleDelete = () => {
    if (phase === 'create') setPin(p => p.slice(0, -1));
    else setConfirmPin(p => p.slice(0, -1));
  };

  const currentPin = phase === 'create' ? pin : confirmPin;

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
        <h2 className="text-lg font-bold text-white">
          {phase === 'create' ? 'Set PIN' : 'Confirm PIN'}
        </h2>
      </header>

      <div className="flex-1 flex flex-col items-center px-6 relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">
            {phase === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
          </h1>
          <p className="text-slate-400 text-sm">
            {phase === 'create'
              ? 'Choose a 6-digit PIN to secure your wallet'
              : 'Re-enter your PIN to confirm'}
          </p>
        </div>

        {/* PIN Dots */}
        <div className="flex gap-4 mb-4">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              i < currentPin.length
                ? hint ? 'bg-error border-error scale-110' : 'bg-primary border-primary scale-110'
                : 'bg-transparent border-slate-700'
            }`} />
          ))}
        </div>

        {hint && (
          <p className="text-error text-sm font-bold text-center mb-2">{hint}</p>
        )}

        <div className="h-4" />

        {/* Keypad */}
        <Keypad onKey={handleKey} onDelete={handleDelete} />
      </div>
    </div>
  );
}
