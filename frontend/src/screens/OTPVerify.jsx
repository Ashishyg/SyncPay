import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2, MessageSquareText } from 'lucide-react';
import { verifyOTP, sendOTP } from '../services/apiService';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function OTPVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { name, phone, email, mode } = location.state || {};
  const [channel, setChannel] = useState(location.state?.channel || 'mock');

  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setInterval(() => setTimer(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(t);
  }, []);

  const doVerify = async (code = otp) => {
    if (code.length !== 6) return;
    setLoading(true); setError('');
    try {
      const { otpToken } = await verifyOTP(phone, code);
      if (mode === 'login') navigate('/login', { state: { phone, otpToken }, replace: true });
      else navigate('/pin-setup', { state: { name, phone, email, otpToken } });
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Try again.');
      setOtp('');
    }
    setLoading(false);
  };

  const resend = async () => {
    if (timer > 0) return;
    try { setChannel((await sendOTP(phone)).channel); setTimer(30); setError(''); } catch (err) { setError(err.response?.data?.error || 'Failed to resend OTP'); }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className={`mx-auto mb-2 flex size-12 items-center justify-center rounded-full ${channel === 'whatsapp' ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary'}`}>
          <MessageSquareText className="size-6" />
        </div>
        <CardTitle className="text-xl">{channel === 'whatsapp' ? 'Check WhatsApp' : 'Check your messages'}</CardTitle>
        <CardDescription>
          Enter the 6-digit code sent {channel === 'whatsapp' ? 'on WhatsApp ' : ''}to <span className="font-medium text-foreground">{phone || 'your number'}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={otp} autoFocus disabled={loading}
            onChange={v => { setOtp(v); if (v.length === 6) doVerify(v); }}>
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} className="size-11 text-lg" />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
        <Button className="w-full" onClick={() => doVerify()} disabled={loading || otp.length < 6}>
          {loading && <Loader2 className="animate-spin" />}{loading ? 'Verifying…' : 'Verify'}
        </Button>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>Change number</Button>
          <Button variant="ghost" size="sm" disabled={timer > 0} onClick={resend}>
            {timer > 0 ? `Resend in ${timer}s` : 'Resend code'}
          </Button>
        </div>
        {channel === 'mock' && (
          <p className="rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
            Dev mode: the code is <span className="font-mono font-medium text-foreground">123456</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
