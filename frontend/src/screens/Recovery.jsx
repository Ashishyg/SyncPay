import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Phrase-based recovery isn't implemented: the phrase isn't linked to the wallet key.
// Signing in with phone + OTP restores the PIN-encrypted key backup instead.
export default function Recovery() {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><KeyRound className="size-5" /></div>
        <CardTitle>Restore your wallet</CardTitle>
        <CardDescription>
          Sign in with your registered phone number. After verifying the OTP, your encrypted wallet backup is restored and unlocked with your PIN.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button className="w-full" onClick={() => navigate('/login')}>Sign in with phone</Button>
        <Button variant="ghost" className="w-full" onClick={() => navigate(-1)}>Back</Button>
      </CardContent>
    </Card>
  );
}
