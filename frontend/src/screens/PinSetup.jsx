import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Keypad from '../components/Keypad';
import { PinDots } from '@/components/Keypad';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card>
      <CardHeader className="text-center">
        <p className="text-xs font-medium text-muted-foreground">Step 2 of 3</p>
        <CardTitle className="text-xl">{phase === 'create' ? 'Create a 6-digit PIN' : 'Confirm your PIN'}</CardTitle>
        <CardDescription>
          {phase === 'create' ? 'Your PIN encrypts your wallet key and approves every payment.' : 'Enter the same PIN again.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <PinDots length={currentPin.length} error={!!hint} />
        <p className="min-h-5 text-center text-sm text-destructive">{hint}</p>
        <Keypad onKey={handleKey} onDelete={handleDelete} />
        {phase === 'confirm' && (
          <Button variant="ghost" className="w-full" onClick={() => { setPhase('create'); setPin(''); setConfirmPin(''); }}>Start over</Button>
        )}
      </CardContent>
    </Card>
  );
}
