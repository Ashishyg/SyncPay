/**
 * SecureContextBanner.jsx
 *
 * Shows a one-time setup guide when crypto.subtle is unavailable
 * (HTTP over LAN IP). Gives device-specific instructions:
 *  - Android Chrome → Chrome secure-origin flag
 *  - iPhone Safari  → Install mkcert CA cert (served from /rootCA.pem)
 */
import { useState, useEffect } from 'react';
import { ShieldAlert, Smartphone, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const LAN_IP  = window.location.hostname;
const PORT    = window.location.port;
const ORIGIN  = `http://${LAN_IP}:${PORT}`;
const CA_URL  = `${window.location.origin}/rootCA.pem`;
const isIOS   = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const FLAG_URL = 'chrome://flags/#unsafely-treat-insecure-origin-as-secure';

const IOS_STEPS = [
  { text: 'Download the certificate with the button below and tap “Allow”.' },
  { text: 'Settings → General → VPN & Device Management → “mkcert…” → Install.' },
  { text: 'Settings → General → About → Certificate Trust Settings → enable “mkcert…”.' },
  { text: 'Come back here and tap Done.' },
];
const ANDROID_STEPS = [
  { text: 'Copy this address:', code: ORIGIN },
  { text: 'Open a new tab and visit:', code: FLAG_URL },
  { text: 'Paste the address into the text box and tap Enable.' },
  { text: 'Tap Relaunch, then return here and tap Done.' },
];

export default function SecureContextBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const insecure = !window.isSecureContext && LAN_IP !== 'localhost' && LAN_IP !== '127.0.0.1';
    setShow(insecure && !sessionStorage.getItem('sp_sec_dismissed'));
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('sp_sec_dismissed', '1');
    setShow(false);
  };

  if (!show) return null;
  const steps = isIOS ? IOS_STEPS : ANDROID_STEPS;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-warning/15 text-warning">
            {isIOS ? <Smartphone className="size-5" /> : <ShieldAlert className="size-5" />}
          </div>
          <CardTitle>{isIOS ? 'iPhone setup' : 'One-time setup'}</CardTitle>
          <CardDescription>
            Payments need your browser’s crypto API, which only works on a trusted connection. This takes about 30 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                  <p>{s.text}</p>
                  {s.code && (
                    <button onClick={() => { try { navigator.clipboard.writeText(s.code); } catch { /* ignore */ } }}
                      className="flex w-full items-center gap-2 rounded-md border bg-muted px-2.5 py-1.5 text-left font-mono text-xs break-all">
                      <span className="flex-1">{s.code}</span><Copy className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="space-y-2">
            {isIOS && <Button variant="outline" className="w-full" asChild><a href={CA_URL} download="rootCA.pem">Download certificate</a></Button>}
            <Button className="w-full" onClick={dismiss}>Done</Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={dismiss}>Skip (payments may not work)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
