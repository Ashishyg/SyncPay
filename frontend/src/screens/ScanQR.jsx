/**
 * ScanQR.jsx — Universal QR Scanner
 *
 * Accessible from the Sidebar "Scan" button on any screen.
 * Detects QR type and routes appropriately:
 *   • merchant_pay  → QRScreen (merchant payment mode)
 *   • dynamic (P2P) → Receive screen verification flow
 *   • Unknown       → Shows raw content with copy option
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';

export default function ScanQR() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const [cameraError, setCameraError] = useState('');
  const [detected, setDetected] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [trackRef, setTrackRef] = useState(null);

  // Start camera
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        setTrackRef(track);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        startScanning();
      } catch (err) {
        setCameraError('Camera access denied. Please allow camera permission and reload.');
      }
    })();
    return () => {
      mounted = false;
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }

  function startScanning() {
    intervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height);
      if (code?.data) handleDetected(code.data);
    }, 150);
  }

  const handleDetected = useCallback((rawData) => {
    if (detected) return;
    setDetected(true);
    clearInterval(intervalRef.current);
    stopCamera();

    // Try to decode
    let payload = null;
    try { payload = JSON.parse(atob(rawData)); } catch {
      try { payload = JSON.parse(rawData); } catch { payload = null; }
    }

    // Route by type
    if (payload?.type === 'merchant_pay') {
      // Static merchant QR → open pay-merchant screen
      navigate('/qr', { state: { mode: 'merchant_pay', merchantPayload: JSON.stringify(payload) } });
    } else if (payload?.qrType === 'dynamic' || payload?.id) {
      // Dynamic P2P QR → open receive/verify screen
      navigate('/receive', { state: { prefillQR: rawData } });
    } else {
      // Unknown — go back with a brief alert
      alert('Unknown QR code. Only SyncPay QR codes can be scanned here.');
      navigate(-1);
    }
  }, [detected, navigate]);

  async function toggleTorch() {
    if (!trackRef) return;
    try {
      await trackRef.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(t => !t);
    } catch { /* torch not supported */ }
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-10 pb-4">
        <button
          onClick={() => { stopCamera(); navigate(-1); }}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-white text-xl">close</span>
        </button>

        <div className="text-center">
          <p className="text-white font-bold text-sm">Scan QR</p>
          <p className="text-white/50 text-xs mt-0.5">Point at any SyncPay QR code</p>
        </div>

        <button
          onClick={toggleTorch}
          className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center ${torchOn ? 'bg-primary/80' : 'bg-black/50'}`}
        >
          <span className="material-symbols-outlined text-white text-xl">flashlight_on</span>
        </button>
      </div>

      {/* Camera */}
      {cameraError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-3xl">no_photography</span>
          </div>
          <p className="text-white text-center text-sm">{cameraError}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-xl bg-white/10 text-white font-bold text-sm"
          >
            Go Back
          </button>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline muted autoPlay
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Dark overlay with cutout */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              {/* Dimmed overlay via box-shadow trick */}
              <div className="w-64 h-64 rounded-2xl border-2 border-white/30"
                style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)' }}>

                {/* Corner markers */}
                <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />

                {/* Scan line animation */}
                <div className="absolute left-2 right-2 top-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-bounce" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 pb-12 pt-6 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-center gap-3">
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <span className="text-white/80 text-xs font-medium">Static QR</span>
            <span className="text-white/40 text-xs">Merchant</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <span className="text-white/80 text-xs font-medium">Dynamic QR</span>
            <span className="text-white/40 text-xs">P2P</span>
          </div>
        </div>
        <p className="text-white/30 text-[11px] text-center px-8">
          This scanner only works with SyncPay QR codes.{'\n'}Google scanner cannot process these.
        </p>
      </div>
    </div>
  );
}
