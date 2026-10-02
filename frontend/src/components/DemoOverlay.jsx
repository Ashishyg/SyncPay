/**
 * DemoOverlay.jsx — Fully functional 2G Network Demo for hackathon judges
 *
 * Three modes:
 * 1. Floating "Demo Mode" button (always visible on dashboard)
 * 2. When activated: shows pending queue, offline/2G simulation, settlement
 * 3. Self-contained — does NOT touch existing payment/QR/wallet code
 *
 * Integration:
 *   - Existing payment flows push tokens via window.__ppAddPendingToken()
 *   - Demo can also create mock tokens for presentation purposes
 */
import { useState, useEffect, useCallback } from 'react';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export function DemoOverlay({ pendingTokens, onSettle, balance }) {
  const [demoActive, setDemoActive] = useState(false);
  const [mode, setMode]            = useState('normal'); // 'normal' | 'offline' | 'settling'
  const [settled, setSettled]      = useState(false);
  const [countdown, setCountdown]  = useState(0);
  const [localTokens, setLocalTokens] = useState([]);
  const [showProof, setShowProof]  = useState(false);
  const [settleLog, setSettleLog]  = useState([]);

  // Merge real pending tokens with local demo tokens
  const allTokens = [...pendingTokens, ...localTokens];

  // Add a demo token for presentation
  const addDemoToken = useCallback(() => {
    const amounts = [2500, 5000, 10000, 15000, 7500];
    const names = ['Vendor A', 'Shop B', 'Canteen C', 'Stall D', 'Service E'];
    const idx = localTokens.length % amounts.length;
    setLocalTokens(prev => [...prev, {
      amount: amounts[idx],
      receiverName: names[idx],
      tokenId: `demo-${Date.now()}`,
      timestamp: Date.now(),
      isDemo: true
    }]);
  }, [localTokens.length]);

  async function simulateOffline() {
    setMode('offline');
    setSettled(false);
    setSettleLog([]);
    setShowProof(false);
  }

  async function simulateSignal() {
    setMode('settling');
    setSettleLog([]);

    // Step 1: Detecting signal
    setSettleLog(prev => [...prev, { text: 'Detecting 2G signal...', type: 'info' }]);
    setCountdown(3);
    await sleep(400);

    // Step 2: Establishing connection
    setSettleLog(prev => [...prev, { text: 'TLS handshake initiated (400ms RTT)', type: 'info' }]);
    setCountdown(2);
    await sleep(400);

    // Step 3: Transmitting payload
    setSettleLog(prev => [...prev, { text: `Transmitting ${allTokens.length} token(s) — ${allTokens.length * 200} bytes total`, type: 'info' }]);
    setCountdown(1);
    await sleep(400);

    // Step 4: Settlement
    setSettleLog(prev => [...prev, { text: 'Server acknowledged. Balances updated.', type: 'success' }]);
    await onSettle();
    setLocalTokens([]);
    setSettled(true);
    setShowProof(true);

    // Return to normal after showing proof
    setTimeout(() => {
      setMode('normal');
    }, 3000);
  }

  function resetDemo() {
    setMode('normal');
    setSettled(false);
    setLocalTokens([]);
    setSettleLog([]);
    setShowProof(false);
    setDemoActive(false);
  }

  // Floating button — always visible if user is on a dashboard page
  if (!demoActive) {
    return (
      <button
        onClick={() => setDemoActive(true)}
        style={styles.fab}
        title="Open Demo Mode"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#F5A623' }}>
          science
        </span>
      </button>
    );
  }

  return (
    <div style={styles.overlay}>
      {/* Backdrop */}
      <div style={styles.backdrop} onClick={() => { if (mode === 'normal' && !allTokens.length) resetDemo(); }} />

      {/* Panel */}
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#F5A623' }}>science</span>
            <span style={styles.headerTitle}>2G Settlement Demo</span>
          </div>
          <button onClick={resetDemo} style={styles.closeBtn}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#627B9E' }}>close</span>
          </button>
        </div>

        {/* Status bar */}
        <div style={{
          ...styles.statusBar,
          background: mode === 'offline'  ? '#FF3D5A' :
                      mode === 'settling' ? '#F5A623' : '#00D9A3'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#080C1A' }}>
            {mode === 'offline'  && 'signal_wifi_off'}
            {mode === 'settling' && 'signal_cellular_alt'}
            {mode === 'normal'   && (settled ? 'check_circle' : 'wifi')}
          </span>
          <span style={styles.statusText}>
            {mode === 'offline'  && 'OFFLINE -- Token queued, waiting for signal'}
            {mode === 'settling' && `2G detected -- settling in ${countdown}...`}
            {mode === 'normal'   && (settled ? 'Settlement complete' : 'Online -- ready')}
          </span>
        </div>

        {/* Scrollable body */}
        <div style={styles.body}>
          {/* Token list */}
          {allTokens.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={styles.sectionTitle}>
                {allTokens.length} pending settlement{allTokens.length > 1 ? 's' : ''}
              </p>
              {allTokens.map((t, i) => (
                <div key={i} style={styles.tokenRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <span style={styles.tokenAmount}>
                      {'\u20B9'}{(t.amount / 100).toFixed(2)}
                    </span>
                    <span style={styles.tokenTo}>
                      {'\u2192'} {t.receiverName}
                    </span>
                    {t.isDemo && <span style={styles.demoBadge}>demo</span>}
                  </div>
                  <div style={{
                    ...styles.tokenStatus,
                    color: settled ? '#00D9A3' : mode === 'settling' ? '#F5A623' : '#FF3D5A'
                  }}>
                    {settled ? 'Settled' : mode === 'settling' ? 'Transmitting...' : 'Pending'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#2A3A5C', marginBottom: 8 }}>inbox</span>
              <p style={{ fontSize: 13, color: '#627B9E', margin: 0 }}>No pending tokens</p>
              <p style={{ fontSize: 11, color: '#3A4A6C', margin: '4px 0 0' }}>
                Make a payment or add a demo token below
              </p>
            </div>
          )}

          {/* Settlement log */}
          {settleLog.length > 0 && (
            <div style={styles.logBox}>
              <p style={{ ...styles.sectionTitle, marginBottom: 6 }}>Settlement Log</p>
              {settleLog.map((log, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10,
                    fontFamily: "'DM Mono', monospace",
                    color: '#3A4A6C',
                    flexShrink: 0,
                    marginTop: 1
                  }}>
                    {new Date().toLocaleTimeString('en-IN', { hour12: false })}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontFamily: "'DM Mono', monospace",
                    color: log.type === 'success' ? '#00D9A3' : '#8A9BC0',
                    lineHeight: 1.4
                  }}>
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Shannon proof card */}
          {(allTokens.length > 0 || showProof) && (
            <div style={styles.proofCard}>
              <div style={{ borderLeft: '3px solid #00D9A3', paddingLeft: 12 }}>
                <p style={styles.proofTitle}>Shannon's Channel Capacity Theorem</p>
                <p style={styles.proofText}>
                  Token size: ~200 bytes (1,600 bits)
                </p>
                <p style={styles.proofText}>
                  2G capacity: 400 kbps (400,000 bits/sec)
                </p>
                <p style={styles.proofText}>
                  Transmit time: <b style={{ color: '#00D9A3' }}>4ms</b> of radio time
                </p>
                <p style={{ ...styles.proofText, marginTop: 6, color: '#8A9BC0' }}>
                  Chrome Slow 2G is more conservative than real 2G.
                  Real 2G carries 10x more capacity than Chrome simulates.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={styles.actions}>
          {mode === 'normal' && !settled && (
            <>
              <button style={styles.btnAdd} onClick={addDemoToken}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                Add Demo Token
              </button>
              {allTokens.length > 0 && (
                <button style={styles.btnRed} onClick={simulateOffline}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>signal_wifi_off</span>
                  Simulate Going Offline
                </button>
              )}
            </>
          )}
          {mode === 'offline' && (
            <button style={styles.btnAmber} onClick={simulateSignal}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>signal_cellular_alt</span>
              Simulate 2G Signal Detected
            </button>
          )}
          {mode === 'settling' && (
            <div style={styles.settlingRow}>
              <div style={styles.spinner} />
              <span style={{ fontSize: 13, color: '#F5A623' }}>
                Transmitting {allTokens.length * 200} bytes over 2G...
              </span>
            </div>
          )}
          {settled && mode === 'normal' && (
            <button style={styles.btnGreen} onClick={() => {
              setSettled(false);
              setSettleLog([]);
              setShowProof(false);
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>replay</span>
              Run Demo Again
            </button>
          )}
        </div>
      </div>

      <style>{css}</style>
    </div>
  );
}

const styles = {
  fab: {
    position: 'fixed',
    bottom: 80,
    right: 16,
    zIndex: 9998,
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(14,21,37,0.95)',
    border: '1.5px solid rgba(245,166,35,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    fontFamily: "'Inter', 'DM Sans', sans-serif",
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  panel: {
    position: 'relative',
    width: '100%',
    maxWidth: 480,
    maxHeight: '85vh',
    background: '#0A101E',
    borderRadius: '20px 20px 0 0',
    border: '1px solid rgba(28,46,74,0.5)',
    borderBottom: 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'demoSlideUp 0.3s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 12px',
    borderBottom: '1px solid rgba(28,46,74,0.3)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#E4ECF7',
    letterSpacing: '0.02em',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    transition: 'background 0.3s ease',
    flexShrink: 0,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 600,
    color: '#080C1A',
    letterSpacing: '0.02em',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#627B9E',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    margin: 0,
  },
  tokenRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#162035',
    borderRadius: 10,
  },
  tokenAmount: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 16,
    fontWeight: 500,
    color: '#E4ECF7',
  },
  tokenTo: {
    fontSize: 12,
    color: '#627B9E',
  },
  demoBadge: {
    fontSize: 9,
    fontWeight: 700,
    color: '#F5A623',
    background: 'rgba(245,166,35,0.1)',
    border: '1px solid rgba(245,166,35,0.2)',
    borderRadius: 4,
    padding: '1px 5px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tokenStatus: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    fontWeight: 500,
    transition: 'color 0.3s ease',
    flexShrink: 0,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 0',
    textAlign: 'center',
  },
  logBox: {
    background: '#0E1525',
    borderRadius: 10,
    padding: '10px 12px',
    border: '1px solid rgba(28,46,74,0.3)',
  },
  proofCard: {
    background: '#0E1525',
    borderRadius: 10,
    padding: '12px 14px',
  },
  proofTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8A9BC0',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    margin: '0 0 6px',
  },
  proofText: {
    fontSize: 11,
    color: '#627B9E',
    lineHeight: 1.5,
    fontFamily: "'DM Mono', monospace",
    margin: '2px 0',
  },
  actions: {
    padding: '12px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    borderTop: '1px solid rgba(28,46,74,0.3)',
    flexShrink: 0,
  },
  btnAdd: {
    padding: '12px',
    background: 'rgba(108,92,231,0.08)',
    border: '1px solid rgba(108,92,231,0.2)',
    borderRadius: 10,
    color: '#C6BFFF',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnRed: {
    padding: '12px',
    background: 'rgba(255,61,90,0.08)',
    border: '1px solid rgba(255,61,90,0.25)',
    borderRadius: 10,
    color: '#FF3D5A',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnAmber: {
    padding: '12px',
    background: 'rgba(245,166,35,0.08)',
    border: '1px solid rgba(245,166,35,0.25)',
    borderRadius: 10,
    color: '#F5A623',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    animation: 'demoPulse 1.5s ease infinite',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnGreen: {
    padding: '12px',
    background: 'rgba(0,217,163,0.08)',
    border: '1px solid rgba(0,217,163,0.25)',
    borderRadius: 10,
    color: '#00D9A3',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  settlingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '12px',
  },
  spinner: {
    width: 18,
    height: 18,
    border: '2px solid rgba(245,166,35,0.2)',
    borderTop: '2px solid #F5A623',
    borderRadius: '50%',
    animation: 'demoSpin 0.8s linear infinite',
    flexShrink: 0,
  },
};

const css = `
  @keyframes demoSpin     { to { transform: rotate(360deg) } }
  @keyframes demoPulse    { 0%, 100% { opacity: 1 } 50% { opacity: 0.6 } }
  @keyframes demoSlideUp  { from { transform: translateY(100%) } to { transform: translateY(0) } }
`;
