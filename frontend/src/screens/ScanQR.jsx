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
import { X, Flashlight, CameraOff } from 'lucide-react';
import Viewfinder from '@/components/Viewfinder';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    <div className="flex h-svh flex-col bg-black text-white">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4">
        <Button variant="ghost" size="icon" className="rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
          onClick={() => { stopCamera(); navigate(-1); }} aria-label="Close"><X /></Button>
        <div className="text-center">
          <p className="font-medium">Scan QR</p>
          <p className="text-xs text-white/70">Payment or merchant QR</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Toggle flashlight" onClick={toggleTorch}
          className={cn('rounded-full text-white hover:text-white', torchOn ? 'bg-primary hover:bg-primary/90' : 'bg-black/40 hover:bg-black/60')}>
          <Flashlight />
        </Button>
      </header>

      {cameraError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-white/10"><CameraOff className="size-6" /></div>
          <p className="text-sm text-white/80">{cameraError}</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      ) : (
        <Viewfinder videoRef={videoRef} canvasRef={canvasRef} scanning={!detected}>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-6 pb-10 pt-12">
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1.5">Payment QR · from a person</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">Merchant QR · at a shop</span>
            </div>
            <p className="text-center text-xs text-white/60">Only SyncPay QR codes work here.</p>
          </div>
        </Viewfinder>
      )}
    </div>
  );
}
