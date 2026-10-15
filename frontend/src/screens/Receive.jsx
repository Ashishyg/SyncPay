import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { addUnconfirmedReceived } from '../services/walletService';
import { verifySignature, verifyText, signText, unlockKey } from '../services/cryptoService';
import { savePendingTxn, isNonceUsed, markNonceUsed, getAllTxns, getKeys } from '../services/storageService';
import { notifyPaymentReceived } from '../services/notificationService';
import { detectQR, CAMERA_CONSTRAINTS } from '@/lib/qrScan';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, CameraOff, ShieldCheck, Clock, ShieldAlert, ReceiptText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Keypad, { PinDots } from '@/components/Keypad';
import Viewfinder from '@/components/Viewfinder';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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
  const [verifyResult, setVerifyResult] = useState(null); // { valid, reason, backing }
  const [accepted, setAccepted] = useState(false);
  const [receiptStage, setReceiptStage] = useState(null);  // null | 'pin' | 'qr'
  const [receiptPin, setReceiptPin] = useState('');
  const [receiptErr, setReceiptErr] = useState('');
  const [receiptQr, setReceiptQr] = useState('');

  // Start camera
  useEffect(() => {
    let mounted = true;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
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
    scanInterval.current = setInterval(async () => {
      const data = await detectQR(videoRef.current, canvasRef.current);
      if (data && scanInterval.current) { // ignore a late result after we already stopped
        clearInterval(scanInterval.current);
        scanInterval.current = null;
        handleQRDetected(data);
      }
    }, 150); // scan ~7 times per second

    return () => { if (scanInterval.current) clearInterval(scanInterval.current); };
  }, [scanning]);

  // Offline allowance check: the voucher proves the sender's server reserved this money for offline use.
  // Returns { level: 'backed' | 'none' | 'unknown', cap } or { reject: '<reason>' }.
  const checkAllowance = async (txn, now) => {
    const al = txn.al;
    if (!al) return { level: 'none' };
    const serverPub = localStorage.getItem('sp_server_pub');
    if (!serverPub) return { level: 'unknown' }; // this phone hasn't been online since install
    const genuine = await verifyText(`SPAL1|${txn.from_pub}|${al.c}|${al.a}|${al.b}|${al.e}`, al.s, serverPub);
    if (!genuine) return { reject: 'The offline allowance on this payment is not genuine' };
    if (now > al.e) return { reject: 'The sender’s offline allowance has expired' };
    if (txn.nonce < al.a || txn.nonce > al.b) return { reject: 'This payment is outside the sender’s allowance' };
    // Total this phone has accepted from the same allowance (catches a double-spend aimed at us)
    const seen = (await getAllTxns())
      .filter(t => t.type === 'received' && t.from_pub === txn.from_pub && t.nonce >= al.a && t.nonce <= al.b)
      .reduce((sum, t) => sum + t.amount, 0);
    if (seen + txn.amount > al.c) return { reject: 'This sender has already used up their offline allowance with you' };
    return { level: 'backed', cap: al.c };
  };

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
      // sig = the sender's signature over the rest; al = the server-signed allowance voucher (not signed by the sender)
      const { sig, al, ...payloadObj } = decoded || {};
      const txn = {
        ...payloadObj,
        al,
        from_pub: decoded?.from,
        signature: sig,
        created_at: decoded?.ts,
        expires_at: decoded?.expires ?? (decoded?.ts ? decoded.ts + 60 : undefined), // QR is valid for 60 s
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

      // A payment signed for a specific account (e.g. a merchant) can only be claimed by that account
      const me = useWalletStore.getState().user?.userId;
      if (txn.to && txn.to !== 'unknown' && txn.to !== me) {
        setVerifyResult({ valid: false, reason: 'This payment is addressed to a different account' });
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
      const used = await isNonceUsed(`${txn.from_pub}:${txn.nonce}`);
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

      if (!sigValid) {
        setVerifyResult({ valid: false, reason: 'Invalid Ed25519 signature' });
      } else {
        const backing = await checkAllowance(txn, now);
        setVerifyResult(backing.reject
          ? { valid: false, reason: backing.reject }
          : { valid: true, reason: 'Signature verified', backing });
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
    await markNonceUsed(`${scannedTxn.from_pub}:${scannedTxn.nonce}`, scannedTxn.id);

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
    setAccepted(true);
  };

  // Receipt: this phone signs "I received payment <id> of <amount>"; the payer scans it as offline proof.
  const handleReceiptKey = async (key) => {
    if (receiptPin.length >= 6) return;
    const pin = receiptPin + key;
    setReceiptPin(pin);
    if (pin.length < 6) return;
    try {
      const keys = await getKeys();
      const privateKey = await unlockKey(keys, pin);
      const ts = Math.floor(Date.now() / 1000);
      const s = await signText(`SPRC1|${scannedTxn.id}|${scannedTxn.amount}|${keys.pubKey}|${ts}`, privateKey);
      setReceiptQr(JSON.stringify({ rc: 1, id: scannedTxn.id, amt: scannedTxn.amount, by: keys.pubKey, ts, s }));
      setReceiptStage('qr');
    } catch {
      setReceiptErr('Wrong PIN. Try again.');
      setTimeout(() => { setReceiptPin(''); setReceiptErr(''); }, 1000);
    }
  };

  const rejectAndRescan = () => {
    setShowModal(false);
    setScannedTxn(null);
    setVerifyResult(null);
    setScanning(true);
  };

  const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN');

  return (
    <div className="flex h-svh flex-col bg-black">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-4 text-white">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft /></Button>
        <div>
          <p className="font-medium">Receive payment</p>
          <p className="text-sm text-white/70">Scan the sender’s payment QR</p>
        </div>
      </header>

      <Viewfinder videoRef={videoRef} canvasRef={canvasRef} scanning={scanning}>
        <div className="absolute inset-x-4 bottom-6 flex justify-center">
          {cameraError ? (
            <Alert variant="destructive" className="max-w-sm"><CameraOff /><AlertDescription>{cameraError}</AlertDescription></Alert>
          ) : verifying ? (
            <Badge className="gap-2 bg-black/70 px-3 py-1.5 text-white"><Loader2 className="size-3.5 animate-spin" />Verifying signature…</Badge>
          ) : (
            <Badge className="bg-black/60 px-3 py-1.5 text-white/90">{scanning ? 'Looking for a SyncPay QR…' : 'QR detected'}</Badge>
          )}
        </div>
      </Viewfinder>

      <div className="border-t bg-background p-4">
        <p className="mb-2 text-xs text-muted-foreground">Receiving into</p>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{(user?.name || 'U')[0].toUpperCase()}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.name || 'User'}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{user?.walletId || '—'}</p>
          </div>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={open => { if (!open) (accepted ? navigate('/home') : rejectAndRescan()); }}>
        <DialogContent className="sm:max-w-sm">
          {accepted ? (
            receiptStage === 'qr' ? (
              <>
                <DialogHeader className="items-center text-center">
                  <DialogTitle>Show this receipt to the payer</DialogTitle>
                  <DialogDescription>They scan it to get signed proof that you received {fmt(scannedTxn?.amount || 0)}.</DialogDescription>
                </DialogHeader>
                <div className="flex justify-center"><div className="rounded-2xl border bg-white p-3"><QRCodeSVG value={receiptQr} size={240} level="L" fgColor="#000000" bgColor="#ffffff" /></div></div>
                <DialogFooter><Button className="w-full" onClick={() => navigate('/home')}>Done</Button></DialogFooter>
              </>
            ) : receiptStage === 'pin' ? (
              <>
                <DialogHeader className="items-center text-center">
                  <DialogTitle>Enter your PIN</DialogTitle>
                  <DialogDescription>Your PIN signs the receipt with your wallet key.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-1">
                  <PinDots length={receiptPin.length} error={!!receiptErr} />
                  <p className="min-h-5 text-center text-sm text-destructive">{receiptErr}</p>
                  <Keypad onKey={handleReceiptKey} onDelete={() => setReceiptPin(p => p.slice(0, -1))} />
                </div>
              </>
            ) : (
              <>
                <DialogHeader className="items-center text-center">
                  <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-success/15 text-success"><CheckCircle2 className="size-7" /></div>
                  <DialogTitle className="text-2xl tabular">{fmt(scannedTxn?.amount || 0)} accepted</DialogTitle>
                  <DialogDescription>It settles automatically when either phone is online.</DialogDescription>
                </DialogHeader>
                <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
                  <Button variant="outline" onClick={() => navigate('/home')}>Done</Button>
                  <Button onClick={() => setReceiptStage('pin')}><ReceiptText />Give receipt</Button>
                </DialogFooter>
              </>
            )
          ) : (
          <>
          <DialogHeader className="items-center text-center">
            <div className={cn('mb-2 flex size-14 items-center justify-center rounded-full',
              verifyResult?.valid ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')}>
              {verifyResult?.valid ? <CheckCircle2 className="size-7" /> : <XCircle className="size-7" />}
            </div>
            <DialogTitle className="text-2xl tabular">
              {verifyResult?.valid ? `${fmt(scannedTxn?.amount || 0)} incoming` : 'Can’t accept this QR'}
            </DialogTitle>
            <DialogDescription>
              {verifyResult?.valid
                ? (scannedTxn?.from_name ? `From ${scannedTxn.from_name}` : 'Signature checked on this device')
                : verifyResult?.reason || 'Invalid QR'}
            </DialogDescription>
          </DialogHeader>
          {verifyResult?.valid && (
            <div className="space-y-3">
              <dl className="space-y-2 rounded-lg border p-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Signature</dt><dd className="flex items-center gap-1 font-medium text-success"><ShieldCheck className="size-4" />Valid Ed25519</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Replay check</dt><dd className="font-medium text-success">First use</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Backing</dt>
                  {verifyResult.backing?.level === 'backed'
                    ? <dd className="flex items-center gap-1 text-right font-medium text-success"><ShieldCheck className="size-4 shrink-0" />Reserved by SyncPay</dd>
                    : <dd className="flex items-center gap-1 text-right font-medium text-warning"><ShieldAlert className="size-4 shrink-0" />{verifyResult.backing?.level === 'unknown' ? 'Can’t check offline' : 'Not backed'}</dd>}
                </div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd className="flex items-center gap-1 font-medium text-warning"><Clock className="size-4" />Unconfirmed</dd></div>
              </dl>
              <p className="text-xs text-muted-foreground">
                {verifyResult.backing?.level === 'backed'
                  ? 'The sender’s server has reserved this money for offline payments, so it will settle, unless they spend the same allowance elsewhere first.'
                  : verifyResult.backing?.level === 'unknown'
                    ? 'Go online once so this phone can check offline allowances. Until then, wait for settlement before handing over goods.'
                    : 'This payment isn’t backed by an offline allowance and may fail if the sender lacks funds. Wait for settlement before handing over goods.'}
              </p>
            </div>
          )}
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className={cn(!verifyResult?.valid && 'col-span-2')} onClick={rejectAndRescan}>
              {verifyResult?.valid ? 'Reject' : 'Scan again'}
            </Button>
            {verifyResult?.valid && <Button onClick={acceptPayment}>Accept</Button>}
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
