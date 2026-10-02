import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useWalletStore();
  const initial = (user?.name || 'U')[0].toUpperCase();

  return (
    <div className="scr" style={{ display: 'flex' }}>
      <div className="tnav"><div className="bk" onClick={() => navigate(-1)}><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div><div className="ntl">Profile</div></div>
      <div className="sb" style={{ padding: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 24px' }}>
          <div style={{ width: 78, height: 78, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 14 }}>{initial}</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{user?.name || 'User'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--fm)', marginTop: 4 }}>{user?.walletId || 'PP·user·xxxx'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, background: 'var(--gbg)', border: '1px solid rgba(0,184,148,.2)', padding: '4px 12px', borderRadius: 20 }}>
            <svg width="12" height="12" fill="none" stroke="var(--green)" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>KYC Verified</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
          {[
            ['Phone', '+91 ' + (user?.phone || '98765 43210')],
            ['Email', user?.email || 'user@example.com'],
            ['Wallet ID', user?.walletId || 'PP·user·xxxx'],
            ['Public key', (user?.pubKey || 'eCf9...3a1b').slice(0, 4) + '...' + (user?.pubKey || '3a1b').slice(-4)],
            ['Member since', new Date(user?.createdAt || Date.now()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })],
          ].map(([k, v], i) => <div key={i} className="inf-r"><div className="inf-k">{k}</div><div className="inf-v" style={{ fontFamily: 'var(--f)' }}>{v}</div></div>)}
        </div>
        <div className="sl">Linked bank accounts</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: 13, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bbg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/></svg>
          </div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>Primary Bank</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>xxxx xxxx {(user?.phone || '4321').slice(-4)} · Savings</div></div>
          <span className="badge bg">Linked</span>
        </div>
        <button className="btn btn-s" style={{ marginTop: 8 }}>+ Link account</button>
      </div>
    </div>
  );
}
