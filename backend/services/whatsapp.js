// WhatsApp messaging via Baileys (unofficial WhatsApp Web client).
// Used for OTP codes and payment alerts — server-side only, so users need data to *receive* them.
// ⚠ Unofficial + against WhatsApp ToS: the linked number can be banned. Use a spare number.
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';

const AUTH_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'wa_auth'); // session keys: never commit
let sock = null;
let connected = false;
let latestQr = null; // linking QR as a PNG data URL, shown on GET /whatsapp

export const isWhatsAppReady = () => connected;
export const getWhatsAppStatus = () => ({ connected, qr: connected ? null : latestQr, me: sock?.user?.id?.split(':')[0] || null });

export async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.appropriate('SyncPay'),
    logger: pino({ level: 'silent' }),
    markOnlineOnConnect: false,
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.toDataURL(qr, { margin: 2, width: 320 }).then(url => { latestQr = url; });
      console.log('📱 WhatsApp not linked yet: open http://localhost:3000/whatsapp to scan the QR');
    }
    if (connection === 'open') { connected = true; latestQr = null; console.log('✅ WhatsApp connected'); }
    if (connection === 'close') {
      connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log('⚠️  WhatsApp logged out. Delete backend/wa_auth and restart to link again.');
      } else {
        setTimeout(() => startWhatsApp().catch(e => console.error('WhatsApp reconnect failed:', e.message)), 3000);
      }
    }
  });
}

// phone: E.164 like +919876543210. Returns true if handed to WhatsApp.
export async function sendWhatsApp(phone, text) {
  if (!connected) return false;
  try {
    await sock.sendMessage(`${phone.replace(/\D/g, '')}@s.whatsapp.net`, { text });
    return true;
  } catch (e) {
    console.error('WhatsApp send failed:', e.message);
    return false;
  }
}
