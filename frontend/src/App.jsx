import { useEffect } from 'react';
import { RouterProvider, createHashRouter, Outlet, Navigate } from 'react-router-dom';
import { useWalletStore } from './store/walletStore';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppShell from './components/AppShell';
import Logo from './components/Logo';
import { startConnectivityWatcher } from './services/syncService';
import { notifySyncComplete } from './services/notificationService';

import Splash from './screens/Splash';
import Register from './screens/Register';
import OTPVerify from './screens/OTPVerify';
import PinSetup from './screens/PinSetup';
import RecoveryPhrase from './screens/RecoveryPhrase';
import Login from './screens/Login';
import Recovery from './screens/Recovery';
import Home from './screens/Home';
import Send from './screens/Send';
import SendConfirm from './screens/SendConfirm';
import QRScreen from './screens/QRScreen';
import Receive from './screens/Receive';
import History from './screens/History';
import TxnDetail from './screens/TxnDetail';
import AddMoney from './screens/AddMoney';
import Withdraw from './screens/Withdraw';
import Merchant from './screens/Merchant';
import SyncScreen from './screens/SyncScreen';
import Notifications from './screens/Notifications';
import Profile from './screens/Profile';
import Settings from './screens/Settings';

import ScanQR from './screens/ScanQR';
import SecureContextBanner from './components/SecureContextBanner';

// Auth screens: centered column with the brand on top
function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-4 py-8 sm:justify-center">
      <div className="w-full max-w-sm">
        <Logo className="mb-8 justify-center" />
        <Outlet />
      </div>
    </div>
  );
}

// Wallet screens need a signed-in user; wait for the profile check before deciding
function RequireAuth({ children }) {
  const { isLoggedIn, profileLoaded } = useWalletStore();
  if (!profileLoaded) return null;
  return isLoggedIn ? children : <Navigate to="/" replace />;
}

// Full-screen layout (no sidebar) — camera/QR screens
function FullScreenLayout() {
  return <div className="min-h-svh bg-background"><Outlet /></div>;
}

const router = createHashRouter([
  // Auth flow — no sidebar
  { element: <AuthLayout />, children: [
    { path: '/', element: <Splash /> },
    { path: '/register', element: <Register /> },
    { path: '/otp', element: <OTPVerify /> },
    { path: '/pin-setup', element: <PinSetup /> },
    { path: '/recovery-phrase', element: <RecoveryPhrase /> },
    { path: '/login', element: <Login /> },
    { path: '/recovery', element: <Recovery /> },
  ]},
  // Full-screen flows — camera, QR, payment confirmations
  { element: <RequireAuth><FullScreenLayout /></RequireAuth>, children: [
    { path: '/receive', element: <Receive /> },
    { path: '/scan', element: <ScanQR /> },
    { path: '/qr', element: <QRScreen /> },
    { path: '/send/qr', element: <QRScreen /> },
  ]},
  // Dashboard — with sidebar
  { element: <RequireAuth><AppShell /></RequireAuth>, children: [
    { path: '/home', element: <Home /> },
    { path: '/send', element: <Send /> },
    { path: '/send/confirm', element: <SendConfirm /> },
    { path: '/history', element: <History /> },
    { path: '/history/:id', element: <TxnDetail /> },
    { path: '/add-money', element: <AddMoney /> },
    { path: '/withdraw', element: <Withdraw /> },
    { path: '/merchant', element: <Merchant /> },
    { path: '/sync', element: <SyncScreen /> },
    { path: '/notifications', element: <Notifications /> },
    { path: '/profile', element: <Profile /> },
    { path: '/settings', element: <Settings /> },
  ]},
]);

export default function App() {
  const { loadUserProfile, loadWalletState, setOnline, updateBalance } = useWalletStore();

  useEffect(() => {
    loadUserProfile();
    loadWalletState();
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // ── Auto-sync: fires when device goes back online ──────────────────
  useEffect(() => {
    const cleanup = startConnectivityWatcher(async (result) => {
      console.log('[Auto-Sync] Completed:', result);
      // Update wallet balance from server response
      if (result.serverWallet) {
        const { getAllTxns } = await import('./services/storageService');
        const all = await getAllTxns();
        const localLocked = all.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
        const localUnconfirmed = all.filter(t => t.status === 'unconfirmed_received').reduce((sum, t) => sum + t.amount, 0);
        await updateBalance({
          confirmed_bal: result.serverWallet.confirmed_bal,
          locked_bal: localLocked,
          // never move the local nonce backwards: unsynced txns may already use higher ones
          nonce: Math.max(useWalletStore.getState().nonce, result.serverWallet.nonce_counter || 0),
          unconfirmed_received: localUnconfirmed,
        });
      }
      await loadWalletState();
      // Push a real notification
      await notifySyncComplete(result.confirmed, result.failed, result.serverWallet?.confirmed_bal);
      // Fire custom event so SyncScreen/Dashboard can refresh
      window.dispatchEvent(new Event('pp-sync-complete'));
    });
    return cleanup;
  }, []);

  return (
    <>
      <TooltipProvider>
        <SecureContextBanner />
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </>
  );
}
