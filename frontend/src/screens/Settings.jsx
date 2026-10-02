/**
 * Settings.jsx — Based on Stitch "SyncPay Settings" design
 * Obsidian Offline Vault design system
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { wipeKeys } from '../services/storageService';
import { getAllTxns } from '../services/storageService';

const SettingRow = ({ icon, iconColor, iconBg, label, desc, onClick, right }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/3 active:bg-white/5 transition-colors text-left group"
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      <span className={`material-symbols-outlined text-xl ${iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-white">{label}</p>
      {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
    </div>
    {right || <span className="material-symbols-outlined text-slate-700 group-hover:text-slate-500 transition-colors">chevron_right</span>}
  </button>
);

const SectionHeader = ({ label }) => (
  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em] px-5 pt-6 pb-2">{label}</p>
);

const Divider = () => <div className="h-px bg-outline-variant/10 mx-5" />;

const Toggle = ({ on, onChange }) => (
  <button
    onClick={() => onChange(!on)}
    className={`w-12 h-6 rounded-full relative transition-colors duration-200 flex-shrink-0 ${on ? 'bg-primary' : 'bg-white/10'}`}
  >
    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${on ? 'left-6' : 'left-0.5'}`} />
  </button>
);

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useWalletStore();
  const [merchantMode, setMerchantMode] = useState(true);
  const [darkMode] = useState(true); // Always dark
  const [pushAlerts, setPushAlerts] = useState(true);
  const [showWipe, setShowWipe] = useState(false);
  const [wiping, setWiping] = useState(false);

  const initial = (user?.name || 'U')[0].toUpperCase();

  const doLogout = () => {
    localStorage.removeItem('sp_token');
    logout();
    navigate('/login', { replace: true });
  };

  const doWipe = async () => {
    setWiping(true);
    await wipeKeys();
    localStorage.clear();
    logout();
    navigate('/', { replace: true });
  };

  const exportCSV = async () => {
    try {
      const txns = await getAllTxns();
      const rows = [['ID','Amount','Status','Type','Timestamp']];
      txns.forEach(t => rows.push([t.id, (t.amount/100).toFixed(2), t.status, t.type || 'p2p', new Date(t.ts || t.created_at || Date.now()).toISOString()]));
      const csv = rows.map(r => r.join(',')).join('\n');
      const a = document.createElement('a');
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
      a.download = `SyncPay-txns-${Date.now()}.csv`;
      a.click();
    } catch { alert('No transactions found.'); }
  };

  return (
    <main className="min-h-screen pb-24 w-full">
      {/* Header */}
      <header className="fixed top-14 lg:top-0 right-0 lg:left-64 left-0 h-16 lg:h-20 bg-background/80 backdrop-blur-xl border-b border-outline-variant/15 px-4 lg:px-10 flex items-center gap-4 z-30">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5">
          <span className="material-symbols-outlined text-slate-400">arrow_back</span>
        </button>
        <h2 className="text-xl font-bold text-white tracking-tight">Settings</h2>
      </header>

      <div className="pt-36 lg:pt-28 max-w-4xl mx-auto">
        {/* Profile Card */}
        <div className="mx-4 lg:mx-10 mb-6 bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-container to-primary flex items-center justify-center text-white font-black text-2xl flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-white">{user?.name || 'User'}</p>
            <p className="text-sm text-slate-500">{user?.phone || '—'}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">KYC Verified</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="px-4 py-2 rounded-xl bg-white/5 border border-outline-variant/15 text-sm font-bold text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            Edit Profile
          </button>
        </div>

        {/* Settings content — 2-column on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 lg:px-10">
          {/* Left column */}
          <div className="space-y-4">
            {/* Security */}
            <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 overflow-hidden">
              <SectionHeader label="Security" />
              <SettingRow icon="lock" iconColor="text-primary" iconBg="bg-primary/10" label="Change PIN" desc="Update your 6-digit unlock code" onClick={() => alert('PIN change coming soon')} />
              <Divider />
              <SettingRow icon="key" iconColor="text-tertiary" iconBg="bg-tertiary/10" label="Recovery Phrase" desc="View your 12-word backup" onClick={() => navigate('/recovery-phrase')} />
              <Divider />
              <SettingRow icon="qr_code_scanner" iconColor="text-emerald-400" iconBg="bg-emerald-500/10" label="Transfer to Device" desc="Login on phone using QR" onClick={() => navigate('/scan')} />
              <Divider />
              <SettingRow icon="devices" iconColor="text-blue-400" iconBg="bg-blue-500/10" label="Device Management" desc="1 device registered" onClick={() => alert('Device management coming soon')} />
            </div>

            {/* Wallet */}
            <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 overflow-hidden">
              <SectionHeader label="Wallet" />
              <SettingRow
                icon="warning"
                iconColor="text-tertiary"
                iconBg="bg-tertiary/10"
                label="Offline Limits"
                desc="₹500/txn · ₹2,000/day"
                onClick={() => alert('Offline limit configuration coming soon')}
              />
              <Divider />
              <SettingRow
                icon="storefront"
                iconColor="text-primary"
                iconBg="bg-primary/10"
                label="Merchant Mode"
                desc="Enable point-of-sale features"
                onClick={() => setMerchantMode(m => !m)}
                right={<Toggle on={merchantMode} onChange={setMerchantMode} />}
              />
              <Divider />
              <SettingRow icon="download" iconColor="text-emerald-400" iconBg="bg-emerald-500/10" label="Export Transactions" desc="Download as CSV" onClick={exportCSV} />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Preferences */}
            <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 overflow-hidden">
              <SectionHeader label="Preferences" />
              <SettingRow
                icon="dark_mode"
                iconColor="text-slate-300"
                iconBg="bg-slate-500/10"
                label="Dark Mode"
                desc="Always on — Offline Vault"
                onClick={() => {}}
                right={<Toggle on={darkMode} onChange={() => {}} />}
              />
              <Divider />
              <SettingRow
                icon="notifications"
                iconColor="text-primary"
                iconBg="bg-primary/10"
                label="Push Alerts"
                desc="Payment confirmations & sync"
                onClick={() => setPushAlerts(a => !a)}
                right={<Toggle on={pushAlerts} onChange={setPushAlerts} />}
              />
              <Divider />
              <SettingRow icon="sync" iconColor="text-blue-400" iconBg="bg-blue-500/10" label="Background Sync" desc="Auto-sync when online" onClick={() => navigate('/sync')} />
            </div>

            {/* Vault Protection card */}
            <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-tertiary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white mb-1">Vault Protection</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Your wallet keys are stored in IndexedDB with AES-256-GCM encryption. The private key never leaves your device.
                </p>
                <button className="text-xs font-bold text-tertiary uppercase tracking-widest hover:underline">
                  Learn More
                </button>
              </div>
            </div>

            {/* About */}
            <div className="bg-[#0d0d15]/60 backdrop-blur-xl rounded-2xl border-t border-l border-outline-variant/15 overflow-hidden">
              <SectionHeader label="About" />
              <SettingRow icon="info" iconColor="text-slate-400" iconBg="bg-slate-500/10" label="Version" desc="SyncPay v1.0.0 · Offline Vault" onClick={() => {}} right={<span className="text-xs text-slate-600 font-mono">v1.0.0</span>} />
              <Divider />
              <SettingRow icon="code" iconColor="text-slate-400" iconBg="bg-slate-500/10" label="Open Source" desc="Ed25519 · AES-256-GCM · IndexedDB" onClick={() => {}} />
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="grid grid-cols-2 gap-4 px-4 lg:px-10 mt-6">
          <button onClick={doLogout} className="py-4 rounded-2xl bg-white/5 border border-outline-variant/15 text-white font-black hover:bg-white/10 active:scale-[0.98] transition-all">
            Log Out
          </button>
          <button onClick={() => setShowWipe(true)} className="py-4 rounded-2xl bg-error/10 border border-error/20 text-error font-black hover:bg-error/20 active:scale-[0.98] transition-all">
            Delete & Wipe Keys
          </button>
        </div>
      </div>

      {/* Wipe Confirmation Modal */}
      {showWipe && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-sm">
            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-error text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>delete_forever</span>
            </div>
            <h3 className="text-2xl font-black text-white text-center mb-3">Delete Wallet?</h3>
            <p className="text-slate-400 text-sm text-center leading-relaxed mb-8">
              This will permanently erase your keys from this device. You will need your 12-word recovery phrase to restore.
              <strong className="text-error"> This cannot be undone.</strong>
            </p>
            <div className="space-y-3">
              <button onClick={doWipe} disabled={wiping}
                className="w-full py-4 rounded-2xl bg-error text-white font-black disabled:opacity-50 active:scale-[0.98] transition-all">
                {wiping ? 'Wiping...' : 'Yes, Delete Everything'}
              </button>
              <button onClick={() => setShowWipe(false)}
                className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
