import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { getKeys, wipeKeys, getUserProfile, saveKeys, saveUserProfile } from '../services/storageService';
import { deriveKeyFromPIN, decryptPrivateKey } from '../services/cryptoService';
import { loginUser, getBalance, sendOTP } from '../services/apiService';
import Keypad from '../components/Keypad';
import jsQR from 'jsqr';
import { Lock, QrCode, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { PinDots } from '@/components/Keypad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { incrementPinAttempt, resetPinAttempts, isLocked, pinAttempts, loadWalletState, updateBalance, setUser } = useWalletStore();
  
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanInterval = useRef(null);

  useEffect(() => {
    getUserProfile().then(p => {
      if (p && p.phone) setPhone(p.phone.replace('+91', '').trim());
    });
    // Back from the OTP screen with a verified otpToken → finish server login
    if (location.state?.otpToken) completeLogin(location.state.phone, location.state.otpToken);
  }, []);

  // Camera handling for Import QR
  const startScanner = async () => {
    setScanning(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      scanInterval.current = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) handleImportQR(code.data);
      }, 200);
    } catch (err) {
      setScanning(false);
      setError('Camera permission required for sync.');
    }
  };

  const stopScanner = () => {
    setScanning(false);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (scanInterval.current) clearInterval(scanInterval.current);
  };

  const handleImportQR = async (data) => {
    try {
      const payload = JSON.parse(data);
      if (payload.t !== 'sp_transfer' || !payload.k || !payload.p) return;
      
      stopScanner();
      
      // Save keys and profile
      await saveKeys({
        pubKey: payload.k.pub,
        encryptedKey: payload.k.enc,
        iv: payload.k.iv,
        salt: payload.k.salt
      });
      
      await saveUserProfile({
        name: payload.p.name,
        phone: payload.p.phone,
        userId: payload.p.userId
      });
      
      setPhone(payload.p.phone.replace('+91', '').trim());
      setStep(2); // Jump to PIN entry
      setError('Wallet imported! Enter PIN to unlock.');
      setTimeout(() => setError(''), 3000);
    } catch (e) {
      console.warn('Invalid transfer QR');
    }
  };

  const handlePhoneSubmit = async () => {
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid 10-digit phone number');
      return;
    }
    setError('');
    const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;

    // Offline: unlock the wallet already on this device with the PIN
    if (!navigator.onLine) {
      const [keys, profile] = await Promise.all([getKeys(), getUserProfile()]);
      if (keys.pubKey && profile?.phone === fullPhone) return setStep(2);
      return setError('You are offline. Connect to the internet to sign in on this device.');
    }

    try {
      const { channel } = await sendOTP(fullPhone);
      navigate('/otp', { state: { phone: fullPhone, mode: 'login', channel } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    }
  };

  const completeLogin = async (fullPhone, otpToken) => {
    setPhone(fullPhone.replace('+91', ''));
    try {
      const response = await loginUser({ phone: fullPhone, otpToken });
      // Store server wallet data for use after PIN verification
      if (response.wallet) {
        window.__spLoginWallet = response.wallet;
      }
      window.__spLoginResponse = response;

      const keys = await getKeys();
      if (!keys.pubKey && response.backup) {
        // Automatically restore backup from server for new device
        await saveKeys({
          pubKey: response.pubKey,
          encryptedKey: response.backup.enc,
          iv: response.backup.iv,
          salt: response.backup.salt
        });
        const walletId = 'PP·' + (response.name || 'user').toLowerCase().split(' ')[0] + '·' + (response.pubKey || '').slice(0, 8);
        await saveUserProfile({
          name: response.name,
          phone: fullPhone,
          userId: response.userId,
          walletId,
          pubKey: response.pubKey,
        });
      } else if (!keys.pubKey) {
        setError('No wallet keys found on this device. Please register.');
        return;
      } else if (keys.pubKey !== response.pubKey) {
        // Don't mix another account's keys/unsynced payments with this login
        localStorage.removeItem('sp_token');
        setError('This device holds a different wallet. Sync and wipe it from Settings first.');
        return;
      }
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  const handleKey = async (key) => {
    if (isLocked) return;
    if (pin.length < 6) {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === 6) {
        try {
          const keys = await getKeys();
          if (!keys.pubKey) { setError('No wallet found.'); setTimeout(() => { setPin(''); setError(''); setStep(1); }, 1500); return; }
          const saltBytes = Uint8Array.from(atob(keys.salt), c => c.charCodeAt(0));
          const aesKey = await deriveKeyFromPIN(newPin, saltBytes);
          await decryptPrivateKey(keys.encPrivKey, keys.iv, aesKey);
          
          // PIN correct — set up user profile
          const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;
          const loginResp = window.__spLoginResponse;
          
          let profile = await getUserProfile();
          if (!profile || !profile.userId) {
            // Build profile from server response
            const walletId = 'PP·' + (loginResp?.name || 'user').toLowerCase().split(' ')[0] + '·' + (keys.pubKey || '').slice(0, 8);
            profile = {
              name: loginResp?.name || 'User',
              phone: fullPhone,
              userId: loginResp?.userId,
              walletId,
              pubKey: keys.pubKey,
            };
            await setUser(profile);
          } else {
            await setUser(profile); // also clears the signed-out flag
          }

          // Update balance from server wallet data (stored during step 1)
          const serverWallet = window.__spLoginWallet;
          if (serverWallet) {
            await updateBalance({
              confirmed_bal: serverWallet.confirmed_bal || 0,
              locked_bal: serverWallet.locked_bal || 0,
            });
          } else {
            // Try fetching fresh balance
            try {
              const freshWallet = await getBalance();
              if (freshWallet) {
                await updateBalance({ 
                  confirmed_bal: freshWallet.confirmed_bal, 
                  locked_bal: freshWallet.locked_bal,
                  nonce: Math.max(useWalletStore.getState().nonce, freshWallet.nonce_counter || 0)
                });
              }
            } catch (apiErr) { console.warn('Offline mode login — using local balance'); }
          }
          
          // Cleanup temp vars
          delete window.__spLoginWallet;
          delete window.__spLoginResponse;
          
          resetPinAttempts();
          await loadWalletState();
          navigate('/home', { replace: true });
        } catch (e) {
          if (e.message === 'PHONE_MISMATCH') {
             setError('Phone mismatch.');
             setTimeout(() => { setPin(''); setError(''); setStep(1); }, 2000);
             return;
          }
          const locked = incrementPinAttempt();
          if (locked) { await wipeKeys(); setError('Locked. Keys wiped.'); }
          else { setError(`Wrong PIN.`); setTimeout(() => { setPin(''); setError(''); }, 1000); }
        }
      }
    }
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  if (isLocked) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><Lock className="size-6" /></div>
          <CardTitle>Wallet locked</CardTitle>
          <CardDescription>Too many wrong PIN attempts. The keys on this device were wiped — sign in again to restore them.</CardDescription>
        </CardHeader>
        <CardContent><Button className="w-full" onClick={() => navigate('/recovery')}>Restore wallet</Button></CardContent>
      </Card>
    );
  }

  const resetApp = async () => {
    if (!window.confirm('Wipe all local data and reset the app?')) return;
    localStorage.clear();
    try {
      const { wipeKeys } = await import('../services/storageService');
      await wipeKeys();
    } catch { /* ignore */ }
    window.location.href = '/';
  };
  const isInfo = error.includes('imported');

  return (
    <>
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Enter your registered mobile number. We’ll send you a one-time code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile number</Label>
              <div className="flex gap-2">
                <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">+91</div>
                <Input id="phone" type="tel" inputMode="numeric" placeholder="98765 43210" className="tabular"
                  value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={e => e.key === 'Enter' && phone.length >= 10 && handlePhoneSubmit()} />
                <Button variant="outline" size="icon" onClick={startScanner} aria-label="Import wallet from QR"><QrCode /></Button>
              </div>
            </div>
            {error && (
              <Alert variant={isInfo ? 'default' : 'destructive'}>
                {isInfo ? <CheckCircle2 /> : <AlertCircle />}
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button className="w-full" onClick={handlePhoneSubmit} disabled={phone.length < 10}>Continue</Button>
            <p className="text-center text-sm text-muted-foreground">
              New to SyncPay? <button className="font-medium text-primary hover:underline" onClick={() => navigate('/register')}>Create an account</button>
            </p>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Enter your PIN</CardTitle>
            <CardDescription>Unlock the wallet for +91 {phone}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PinDots length={pin.length} error={!!error && !isInfo} />
            <div className="min-h-5 text-center text-sm">
              {error ? <span className={isInfo ? 'text-success' : 'text-destructive'}>{error}</span>
                : pinAttempts > 0 && <span className="text-warning">{5 - pinAttempts} attempts remaining</span>}
            </div>
            <Keypad onKey={handleKey} onDelete={handleDelete} />
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => { setStep(1); setPin(''); }}>Use another number</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/recovery')}>Forgot PIN?</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 text-center">
        <Button variant="link" size="sm" className="text-muted-foreground" onClick={resetApp}>Reset app on this device</Button>
      </div>

      {scanning && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center gap-2 p-4">
            <Button variant="ghost" size="icon" onClick={stopScanner} aria-label="Close"><X /></Button>
            <div>
              <p className="font-medium">Import wallet</p>
              <p className="text-sm text-muted-foreground">Scan the transfer QR from your other device.</p>
            </div>
          </div>
          <div className="relative mx-4 mb-4 flex-1 overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-56 rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            </div>
          </div>
          <Button variant="outline" className="mx-4 mb-6" onClick={stopScanner}>Cancel</Button>
        </div>
      )}
    </>
  );
}
