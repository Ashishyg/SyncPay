/**
 * SecureContextBanner.jsx
 *
 * Shows a one-time setup guide when crypto.subtle is unavailable
 * (HTTP over LAN IP). Gives device-specific instructions:
 *  - Android Chrome → Chrome secure-origin flag
 *  - iPhone Safari  → Install mkcert CA cert (served from /rootCA.pem)
 */
import { useState, useEffect } from 'react';

const LAN_IP  = window.location.hostname;
const PORT    = window.location.port;
const ORIGIN  = `http://${LAN_IP}:${PORT}`;
const CA_URL  = `${window.location.origin}/rootCA.pem`;
const isIOS   = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);

export default function SecureContextBanner() {
  const [show, setShow]         = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const insecure    = !window.isSecureContext && LAN_IP !== 'localhost' && LAN_IP !== '127.0.0.1';
    const notDismissed = !sessionStorage.getItem('sp_sec_dismissed');
    setShow(insecure && notDismissed);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('sp_sec_dismissed', '1');
    setDismissed(true);
    setShow(false);
  };

  if (!show || dismissed) return null;

  /* ─── iPhone flow ───────────────────────────────────────────── */
  if (isIOS) {
    return (
      <div className="fixed inset-0 bg-background/98 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-blue-400 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>smartphone</span>
          </div>
          <h2 className="text-2xl font-black text-white text-center mb-2">iPhone Setup</h2>
          <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed">
            Install the SyncPay security certificate to enable payments on iPhone. <strong className="text-white">30 seconds, one-time setup.</strong>
          </p>

          <div className="space-y-3 mb-6">
            {[
              { n: 1, text: 'Tap the button below to download the certificate', action: true },
              { n: 2, text: 'In the download prompt, tap "Allow"' },
              { n: 3, text: 'Go to Settings → General → VPN & Device Management' },
              { n: 4, text: 'Tap "mkcert..." → Tap "Install" → Enter passcode' },
              { n: 5, text: 'Go to Settings → General → About → Certificate Trust Settings' },
              { n: 6, text: 'Toggle ON "mkcert..." under Enable Full Trust' },
              { n: 7, text: 'Come back here and tap "Done" ✓' },
            ].map(step => (
              <div key={step.n} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-black text-blue-400">{step.n}</span>
                </div>
                <p className="text-sm text-slate-300 flex-1">{step.text}</p>
              </div>
            ))}
          </div>

          <a
            href={CA_URL}
            download="rootCA.pem"
            className="w-full block py-4 rounded-2xl bg-blue-500/20 border border-blue-500/30 text-blue-300 font-black text-center mb-3"
          >
            ⬇ Download Certificate
          </a>
          <button onClick={dismiss}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary-container to-primary text-white font-black mb-3">
            Done — Open SyncPay
          </button>
          <button onClick={dismiss}
            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-sm font-bold">
            Skip (payments may not work)
          </button>
        </div>
      </div>
    );
  }

  /* ─── Android / generic Chrome flow ────────────────────────── */
  const flagUrl = 'chrome://flags/#unsafely-treat-insecure-origin-as-secure';

  return (
    <div className="fixed inset-0 bg-background/98 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-tertiary/10 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-tertiary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock_open</span>
        </div>
        <h2 className="text-2xl font-black text-white text-center mb-2">One-Time Setup</h2>
        <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed">
          Enable cryptographic payments by marking this address as trusted in Chrome.
          <strong className="text-white"> Takes 30 seconds, one-time only.</strong>
        </p>

        <div className="space-y-3 mb-6">
          {[
            { n: 1, text: 'Tap to copy this address:', code: ORIGIN },
            { n: 2, text: 'Open a new tab and visit:', code: flagUrl },
            { n: 3, text: 'Paste the address in the text box → tap Enable' },
            { n: 4, text: 'Tap Relaunch (Chrome restarts)' },
            { n: 5, text: 'Return to SyncPay — tap Done below ✓' },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[11px] font-black text-primary">{step.n}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300">{step.text}</p>
                {step.code && (
                  <button
                    onClick={() => { try { navigator.clipboard.writeText(step.code); } catch {} }}
                    className="mt-1 w-full text-left bg-[#0d0d15] border border-outline-variant/20 rounded-lg px-3 py-2 font-mono text-xs text-primary break-all"
                  >
                    {step.code}
                    <span className="text-slate-600 ml-2">(tap to copy)</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button onClick={dismiss}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary-container to-primary text-white font-black mb-3">
          Done — Open SyncPay
        </button>
        <button onClick={dismiss}
          className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-sm font-bold">
          Skip (payments may not work)
        </button>
      </div>
    </div>
  );
}
