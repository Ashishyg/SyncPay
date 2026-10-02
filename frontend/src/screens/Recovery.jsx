import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Recovery() {
  const navigate = useNavigate();
  const [words, setWords] = useState(Array(12).fill(''));

  const handleWord = (idx, val) => {
    const newWords = [...words];
    newWords[idx] = val;
    setWords(newWords);
  };

  const doRecovery = () => {
    const filled = words.filter(w => w.trim()).length;
    if (filled < 12) return;
    navigate('/pin-setup', { state: { name: 'Recovered User', phone: '0000000000', email: '', recovery: true } });
  };

  return (
    <div className="scr" style={{ display: 'flex' }}>
      <div className="tnav"><div className="bk" onClick={() => navigate(-1)}><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div><div className="ntl">Recover Wallet</div></div>
      <div className="sb" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>Enter your 12-word recovery phrase to restore your wallet and create a new PIN.</div>
        <div className="pgrid">
          {words.map((w, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: 4, left: 8, fontSize: 9, color: 'var(--text3)', fontWeight: 700 }}>{i + 1}</div>
              <input className="if" value={w} onChange={e => handleWord(i, e.target.value)} style={{ padding: '14px 8px 6px', fontSize: 12, textAlign: 'center', fontFamily: 'var(--fm)' }} placeholder="word" />
            </div>
          ))}
        </div>
        <button className="btn btn-p" onClick={doRecovery} disabled={words.filter(w => w.trim()).length < 12}>Restore Wallet →</button>
      </div>
    </div>
  );
}
