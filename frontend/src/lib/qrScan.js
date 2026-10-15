// Shared QR reading for all camera screens.
// Prefers the browser's native BarcodeDetector (Chrome on Android): faster, and much better at
// reading a QR off another phone's screen. Falls back to jsQR (iOS Safari, Firefox, desktop).
import jsQR from 'jsqr';

let detector = null;
try {
  if ('BarcodeDetector' in window) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
} catch { detector = null; }

let busy = false; // detect() is async; skip frames while one is still being read

export async function detectQR(video, canvas) {
  if (busy || !video || video.readyState < 2 || !video.videoWidth) return null;
  busy = true;
  try {
    if (detector) {
      try {
        const [code] = await detector.detect(video);
        return code?.rawValue || null;
      } catch {
        detector = null; // unsupported on this device → use jsQR from now on
      }
    }
    // jsQR is CPU-bound: read a frame scaled to ≤1280px wide
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data || null;
  } finally {
    busy = false;
  }
}

// Rear camera, high resolution and continuous autofocus (ignored where unsupported)
export const CAMERA_CONSTRAINTS = {
  video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: 'continuous' }] },
};
