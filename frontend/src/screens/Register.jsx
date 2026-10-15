import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOTP } from '../services/apiService';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
      const { channel } = await sendOTP(formattedPhone);
      navigate('/otp', { state: { name, phone: formattedPhone, email, channel } });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium text-muted-foreground">Step 1 of 3</p>
        <CardTitle className="text-xl">Create your wallet</CardTitle>
        <CardDescription>Takes about two minutes. You only need internet for this step.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); doRegister(); }}>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" placeholder="Riya Sharma" autoComplete="name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile number</Label>
            <div className="flex gap-2">
              <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">+91</div>
              <Input id="phone" type="tel" inputMode="numeric" placeholder="98765 43210" className="tabular"
                value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="email" type="email" placeholder="riya@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" className="w-full" disabled={loading || !name.trim() || phone.length < 10}>
            {loading && <Loader2 className="animate-spin" />}{loading ? 'Sending code…' : 'Continue'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have a wallet?{' '}
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => navigate('/login')}>Sign in</button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
