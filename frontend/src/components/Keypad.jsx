export default function Keypad({ onKey, onDelete }) {
  const keys = [
    { n: '1', l: '' }, { n: '2', l: 'ABC' }, { n: '3', l: 'DEF' },
    { n: '4', l: 'GHI' }, { n: '5', l: 'JKL' }, { n: '6', l: 'MNO' },
    { n: '7', l: 'PQRS' }, { n: '8', l: 'TUV' }, { n: '9', l: 'WXYZ' },
    null, { n: '0', l: '' }, 'del'
  ];

  return (
    <div className="kp" style={{ width: '100%', marginBottom: 16 }}>
      {keys.map((k, i) => {
        if (k === null) return <div key={i} className="kk" style={{ background: 'transparent', borderColor: 'transparent', cursor: 'default' }} />;
        if (k === 'del') return (
          <div key={i} className="kk kk-d" onClick={onDelete}>
            <svg viewBox="0 0 24 24"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
          </div>
        );
        return (
          <div key={i} className="kk" onClick={() => onKey(k.n)}>
            <div className="kk-n">{k.n}</div>
            {k.l && <div className="kk-l">{k.l}</div>}
          </div>
        );
      })}
    </div>
  );
}
