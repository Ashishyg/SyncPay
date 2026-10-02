import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { addUnconfirmedReceived } from '../services/walletService';
import { verifySignature } from '../services/cryptoService';
import { savePendingTxn, isNonceUsed, markNonceUsed } from '../services/storageService';
import { notifyPaymentReceived } from '../services/notificationService';
import jsQR from 'jsqr';

export default function Receive() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loadWalletState } = useWalletStore();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanInterval = useRef(null);
  const prefillHandled = useRef(false);

  const [scanning, setScanning] = useState(true);
  const [cameraError, setCameraError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [scannedTxn, setScannedTxn] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null); // { valid, reason }

  // Start camera
  useEffect(() => {
    let mounted = true;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        setCameraError('Camera access denied. Please grant camera permission to scan QR codes.');
        console.error('Camera error:', err);
      }
    };
    startCamera();
    return () => {
      mounted = false;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (scanInterval.current) clearInterval(scanInterval.current);
    };
  }, []);

  // Handle prefilled QR data from ScanQR screen
  useEffect(() => {
    if (location.state?.prefillQR && !prefillHandled.current) {
      prefillHandled.current = true;
      handleQRDetected(location.state.prefillQR);
    }
  }, [location.state]);

  // Scan video frames for QR codes
  useEffect(() => {
    if (!scanning) return;
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

      if (code && code.data) {
        handleQRDetected(code.data);
      }
    }, 150); // scan ~7 times per second

    return () => { if (scanInterval.current) clearInterval(scanInterval.current); };
  }, [scanning]);

  const handleQRDetected = useCallback(async (rawData) => {
    setScanning(false); // Stop scanning
    setVerifying(true);

    try {
      // QR value is base64-encoded JSON from transactionService.js
      // Decode: atob(rawData) -> JSON string -> parse
      let decoded;
      try {
        decoded = JSON.parse(atob(rawData));
      } catch (_) {
        // Fallback: try parsing as raw JSON
        try { decoded = JSON.parse(rawData); } catch { decoded = null; }
      }

      // ── MERCHANT QR: route to payment flow ──────────────────────────
      if (decoded?.type === 'merchant_pay') {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        navigate('/qr', { state: { mode: 'merchant_pay', merchantPayload: JSON.stringify(decoded) } });
        return;
      }

      // ── P2P QR: existing flow ───────────────────────────────────────
      // Map QR field names to internal field names
      const { sig, ...payloadObj } = decoded || {};
      const txn = {
        ...payloadObj,
        from_pub: decoded?.from,
        signature: sig,
        created_at: decoded?.ts,
        expires_at: decoded?.expires,
        payloadString: JSON.stringify(payloadObj),
      };
      setScannedTxn(txn);

      // Validate fields
      if (!txn.id || !txn.amount || !txn.signature || !txn.from_pub || !txn.nonce) {
        setVerifyResult({ valid: false, reason: 'Invalid QR payload -- missing fields' });
        setShowModal(true);
        setVerifying(false);
        return;
      }

      // Check expiry
      const now = Math.floor(Date.now() / 1000);
      if (txn.expires_at && now > txn.expires_at) {
        setVerifyResult({ valid: false, reason: 'Transaction expired' });
        setShowModal(true);
        setVerifying(false);
        return;
      }

      // Check nonce replay
      const used = await isNonceUsed(txn.nonce);
      if (used) {
        setVerifyResult({ valid: false, reason: 'Nonce already used -- possible double spend' });
        setShowModal(true);
        setVerifying(false);
        return;
      }

      // Verify Ed25519 signature
      // Pass the original payload OBJECT (without sig) to verifySignature.
      // verifySignature internally does JSON.stringify(payloadObj) which matches
      // what signTransaction did on the sender side, preserving key order.
      const sigValid = await verifySignature(payloadObj, txn.signature, txn.from_pub);

      if (sigValid) {
        setVerifyResult({ valid: true, reason: 'Signature verified' });
      } else {
        setVerifyResult({ valid: false, reason: 'Invalid Ed25519 signature' });
      }
    } catch (e) {
      setScannedTxn(null);
      setVerifyResult({ valid: false, reason: 'Could not parse QR data: ' + e.message });
    }

    setShowModal(true);
    setVerifying(false);
  }, []);

  const acceptPayment = async () => {
    if (!scannedTxn || !verifyResult?.valid) return;

    // Mark nonce as used
    await markNonceUsed(scannedTxn.nonce, scannedTxn.id);

    // Save as unconfirmed received (include payloadString for backend sync)
    await savePendingTxn({
      id: scannedTxn.id,
      type: 'received',
      from_pub: scannedTxn.from_pub,
      to_user_id: user?.userId,
      amount: scannedTxn.amount,
      nonce: scannedTxn.nonce,
      signature: scannedTxn.signature,
      payloadString: scannedTxn.payloadString,
      status: 'unconfirmed_received',
      mode: 'offline_p2p',
      created_at: scannedTxn.created_at,
      expires_at: scannedTxn.expires_at,
      recipientName: scannedTxn.from_name || 'Unknown'
    });

    await addUnconfirmedReceived(scannedTxn.amount);
    await loadWalletState();
    await notifyPaymentReceived(scannedTxn.amount, scannedTxn.from_name || 'Someone');
    setShowModal(false);
    navigate('/home');
  };

  const rejectAndRescan = () => {
    setShowModal(false);
    setScannedTxn(null);
    setVerifyResult(null);
    setScanning(true);
  };

  const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN');

  return (
    <div className="scr" style={{ display: 'flex' }}>
      <div className="tnav" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'rgba(0,0,0,.5)', borderBottom: 'none' }}>
        <div className="bk" style={{ background: 'rgba(0,0,0,.4)', border: 'none' }} onClick={() => navigate(-1)}><svg viewBox="0 0 24 24" style={{ stroke: '#fff' }}><polyline points="15 18 9 12 15 6"/></svg></div>
        <div className="ntl" style={{ color: '#fff' }}>Scan QR to Receive</div>
      </div>

      {/* Camera view */}
      <div style={{ flex: 1, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <video ref={videoRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted autoPlay />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div className="sfr"><div className="sc tl"/><div className="sc tr"/><div className="sc bl"/><div className="sc br"/>{scanning && <div className="sline"/>}</div>
        {cameraError && <div style={{ position: 'absolute', bottom: 60, left: 20, right: 20, background: 'rgba(255,0,0,.15)', border: '1px solid rgba(255,0,0,.3)', borderRadius: 'var(--r2)', padding: 12, fontSize: 12, color: '#ff7675', fontWeight: 600, textAlign: 'center' }}>{cameraError}</div>}
        {verifying && <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', fontSize: 13, color: '#fff', fontWeight: 700, background: 'rgba(0,0,0,.6)', padding: '8px 18px', borderRadius: 20 }}>Verifying signature...</div>}
        <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 12, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>
          {scanning ? 'Point camera at sender\'s QR code' : 'QR detected'}
        </div>
      </div>

      {/* Bottom info */}
      <div style={{ background: 'var(--bg2)', padding: 18, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div className="sl" style={{ marginBottom: 0 }}>Your Wallet ID</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '11px 14px' }}>
          <div style={{ width: 46, height: 46, background: '#6c5ce7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>QR</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{user?.name || 'User'}</div><div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--fm)' }}>{user?.walletId || 'PP·user·xxxx'}</div></div>
        </div>
      </div>

      {/* Payment Received Modal */}
      <div className={`mover ${showModal ? 'show' : ''}`}>
        <div className="msheet">
          <div className="mhandle" />
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              {verifyResult?.valid ? (
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gbg)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--rbg)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
              )}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
              {verifyResult?.valid ? `${fmt(scannedTxn?.amount || 0)} incoming` : 'Verification Failed'}
            </div>
            {scannedTxn?.from_name && <div style={{ fontSize: 13, color: 'var(--text2)' }}>From <span style={{ fontWeight: 700, color: 'var(--text)' }}>{scannedTxn.from_name}</span></div>}
            <div style={{ marginTop: 10 }}>
              <span className={`badge ${verifyResult?.valid ? 'ba' : 'br'}`}>
                {verifyResult?.valid ? (
                  <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Unconfirmed — offline</>
                ) : (
                  <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> {verifyResult?.reason || 'Invalid'}</>
                )}
              </span>
            </div>
          </div>
          {verifyResult?.valid && (
            <>
              <div style={{ background: 'var(--abg)', border: '1px solid rgba(253,203,110,.2)', borderRadius: 'var(--r2)', padding: 11, marginBottom: 16, fontSize: 12, color: 'var(--amber)', fontWeight: 600, lineHeight: 1.7 }}>
                Payment is signed but unconfirmed until both devices sync. For amounts above ₹100, wait for sync before handing over goods.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
                <div className="inf-r"><div className="inf-k">Signature</div><div className="inf-v" style={{ color: 'var(--green)', fontFamily: 'var(--f)', fontWeight: 700 }}>✓ Valid Ed25519</div></div>
                <div className="inf-r"><div className="inf-k">Nonce</div><div className="inf-v" style={{ color: 'var(--green)', fontFamily: 'var(--f)', fontWeight: 700 }}>First use ✓</div></div>
                <div className="inf-r"><div className="inf-k">Amount</div><div className="inf-v">{fmt(scannedTxn?.amount || 0)}</div></div>
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="btn btn-s" style={{ flex: 1 }} onClick={rejectAndRescan}>{verifyResult?.valid ? 'Reject' : 'Scan Again'}</button>
            {verifyResult?.valid && <button className="btn btn-p" style={{ flex: 1 }} onClick={acceptPayment}>Accept {fmt(scannedTxn?.amount || 0)}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
