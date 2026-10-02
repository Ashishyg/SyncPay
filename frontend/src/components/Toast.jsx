import { useState, useEffect } from 'react';

export default function Toast() {
  return null; // Toast is managed globally via events
}

// Global toast API
let showToastFn = null;

export function ToastContainer() {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    showToastFn = (message) => {
      setMsg(message);
      setVisible(true);
      setTimeout(() => setVisible(false), 2200);
    };
    return () => { showToastFn = null; };
  }, []);

  return <div className={`toast ${visible ? 'show' : ''}`}>{msg}</div>;
}

export function toast(message) {
  if (showToastFn) showToastFn(message);
}
