import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTxnById } from '../services/storageService';

const fmt = (p) => '₹' + (p / 100).toLocaleString('en-IN');

export default function TxnDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [txn, setTxn] = useState(null);

  useEffect(() => { if (id) getTxnById(id).then(setTxn); }, [id]);

  if (!txn) return (
    <div className="scr" style={{ display: 'flex' }}>
      <div className="tnav"><div className="bk" onClick={() => navigate(-1)}><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div><div className="ntl">Transaction Detail</div></div>
      <div className="sb" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
    </div>
  );

  const isSent = txn.type === 'sent';

  return (
    <div className="scr" style={{ display: 'flex' }}>
      <div className="tnav">
        <div className="bk" onClick={() => navigate(-1)}><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div>
        <div className="ntl">Transaction Detail</div>
        <div className="nact"><svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></div>
      </div>
      <div className="sb" style={{ padding: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 24px' }}>
          <div style={{ marginBottom: 14 }}>
            {isSent ? (
              <svg width="40" height="40" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            ) : (
              <svg width="40" height="40" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>
            )}
          </div>
          <div style={{ fontSize: 36, fontWeight: 300, letterSpacing: '-.02em', color: isSent ? 'var(--red)' : 'var(--green)' }}>{isSent ? '-' : '+'}{fmt(txn.amount)}</div>
          <div style={{ marginTop: 8 }}>
            <span className={`badge ${txn.status === 'confirmed' ? 'bg' : txn.status === 'failed' ? 'br' : 'ba'}`}>
              {txn.status === 'confirmed' ? (
                <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Confirmed</>
              ) : txn.status === 'failed' ? (
                <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Failed</>
              ) : (
                <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pending</>
              )}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            ['Type', isSent ? 'Sent' : 'Received'],
            ['To/From', txn.recipientName || txn.from_pub?.slice(0, 12) || '—'],
            ['Transaction ID', txn.id?.slice(0, 16) + '...'],
            ['Nonce', String(txn.nonce)],
            ['Signature', txn.signature ? '✓ Ed25519 signed' : '—'],
            ['Created', new Date(txn.created_at * 1000).toLocaleString()],
            ['Status', txn.status],
            ...(txn.fail_reason ? [['Fail reason', txn.fail_reason]] : []),
          ].map(([k, v], i) => (
            <div key={i} className="inf-r"><div className="inf-k">{k}</div><div className="inf-v" style={{ fontFamily: k === 'Signature' ? 'var(--f)' : 'var(--fm)', color: k === 'Signature' ? 'var(--green)' : undefined }}>{v}</div></div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
          <button className="btn btn-s">Report</button>
          <button className="btn btn-s">Share receipt</button>
        </div>
      </div>
    </div>
  );
}
