import { useState } from 'react';
import { toast } from 'sonner';
import { getKeys, saveKeys } from '@/services/storageService';
import { unlockKey, reencryptKey } from '@/services/cryptoService';
import { updateKeyBackup } from '@/services/apiService';
import Keypad, { PinDots } from '@/components/Keypad';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STEPS = {
  current: ['Enter your current PIN', 'To unlock your wallet key.'],
  next: ['Choose a new PIN', '6 digits. It encrypts your wallet key and approves payments.'],
  confirm: ['Confirm the new PIN', 'Enter the same 6 digits again.'],
};

// Change PIN = re-encrypt the signing key under the new PIN. The server's encrypted backup is updated
// FIRST, so a failure can't leave the phone and the backup on different PINs.
export default function ChangePinDialog({ open, onOpenChange }) {
  const [step, setStep] = useState('current');
  const [pins, setPins] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setStep('current'); setPins({ current: '', next: '', confirm: '' }); setError(''); setBusy(false); };
  const close = () => { reset(); onOpenChange(false); };
  const fail = (msg, backTo) => {
    setError(msg);
    setTimeout(() => { setError(''); setPins(p => ({ ...p, [backTo]: '', ...(backTo === 'next' ? { confirm: '' } : {}) })); setStep(backTo); }, 1100);
  };

  const onKey = async (k) => {
    if (busy || pins[step].length >= 6) return;
    const value = pins[step] + k;
    const all = { ...pins, [step]: value };
    setPins(all);
    if (value.length < 6) return;

    if (step === 'current') {
      setBusy(true);
      try { await unlockKey(await getKeys(), value); setStep('next'); } catch { fail('Wrong PIN. Try again.', 'current'); }
      setBusy(false);
    } else if (step === 'next') {
      if (value === all.current) return fail('Pick a PIN different from the current one.', 'next');
      setStep('confirm');
    } else {
      if (value !== all.next) return fail('PINs don’t match. Choose the new PIN again.', 'next');
      setBusy(true);
      try {
        const updated = await reencryptKey(await getKeys(), all.current, all.next);
        await updateKeyBackup({ enc: updated.encryptedKey, iv: updated.iv, salt: updated.salt });
        await saveKeys(updated);
        toast.success('PIN changed');
        close();
      } catch (e) {
        setBusy(false);
        fail(e.response ? 'Couldn’t update your backup. Check your connection.' : 'Something went wrong. Try again.', 'current');
      }
    }
  };

  const [title, desc] = STEPS[step];
  return (
    <Dialog open={open} onOpenChange={o => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-center">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <PinDots length={pins[step].length} error={!!error} />
          <p className="min-h-5 text-center text-sm text-destructive">{error || (busy ? 'Working…' : '')}</p>
          <Keypad onKey={onKey} onDelete={() => setPins(p => ({ ...p, [step]: p[step].slice(0, -1) }))} disabled={busy} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
