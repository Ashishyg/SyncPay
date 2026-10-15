# SyncPay — Offline Digital Payments

**Theme:** FinTech & Financial Inclusion — *last-mile banking without internet.*

SyncPay is a UPI-style wallet that keeps working when the network doesn't. Payments are
signed on the phone and exchanged as QR codes with **no internet on either side**. They settle
on the server as soon as **either** phone gets a connection — over data, or over plain
**SMS** when there's signal but no data.

> Prototype. Top-ups and bank withdrawals are simulated; real deployment would need RBI
> PPI licensing, KYC and fraud controls.

---

## How it works

```
 ONLINE, ONCE          OFFLINE, ANY NUMBER OF TIMES                 WHEN EITHER PHONE GETS SIGNAL
 ─────────────         ───────────────────────────────────          ───────────────────────────────
 Sign up (OTP)   ──►   Sender: amount + PIN ─► signed QR    ──►     App sync (data)  ─┐
 Add money             Receiver: scan ─► verify signature           SMS sync (no data)─┴─► server verifies
                       on-device ─► "₹X incoming"                                        signature, balance,
                                                                                         limits ─► settles
```

1. **Onboarding (online).** Phone number is verified by OTP (WhatsApp, SMS, or a dev mock code).
   An Ed25519 key pair is generated **on the device**; the private key is encrypted with the
   user's 6-digit PIN (PBKDF2 → AES-256-GCM) and stored in IndexedDB. An encrypted backup is
   kept on the server so the wallet can be restored by signing in on a new phone.
2. **Paying (offline).** The sender enters an amount and PIN. The app locks that amount locally
   and shows a QR containing the signed payment (valid for 60 s). The receiver scans it, checks
   the signature on-device, and records it as *unconfirmed*.
3. **Settlement.** Whichever phone syncs first uploads the signed payment. The server verifies
   the signature and nonce, checks balance and limits, and moves the money atomically. The other
   phone picks up the result on its next sync.

### Paying a merchant

The merchant displays a **static QR** (Merchant screen; printable). The customer scans it,
enters an amount and PIN, and the app signs a payment **addressed to that merchant's account**.
The customer shows their payment QR; the merchant taps **Scan customer's payment** to see it
arrive offline. Only that merchant can ever be credited.

### Sync channels

| Channel | When | How |
|---|---|---|
| **App (data)** | Any connection | Automatic on reconnect, on app open, every 20 s on Home |
| **SMS** | Signal but no data | *Sync status → Send SMS* opens the phone's SMS app with up to 3 signed payments; a gateway phone forwards it to the server |
| **WhatsApp** (outbound only) | Server side | OTP codes and "payment settled / received" alerts |

---

## Security model

| Threat | Mitigation |
|---|---|
| Forged or edited payment | Ed25519 signature over the exact payload; amount, recipient and nonce are read **only** from the signed payload |
| Replay / double-settlement | Unique transaction id and per-sender nonce on the server; duplicate syncs are idempotent |
| Someone else claims a payment | A payment addressed to a user can only be credited to that user; an unaddressed one can be claimed once |
| Overspending offline | Local balance locking; ₹500 per payment and ₹2,000/day enforced on the device **and** the server |
| Account takeover | Login and signup require a fresh OTP token (10 min); PIN unlock on the device; 5 wrong PINs wipe local keys |
| Forged SMS webhook | HMAC-SHA256 signature + timestamp from the gateway (`SMS_WEBHOOK_SIGNING_KEY`) |

**Known limitations (by design of offline payments):**
- Offline payments are final only after settlement. A sender who wipes their app can try to
  spend the same balance twice; the second payment fails at settlement. Small limits cap the loss.
- An unaddressed payment QR behaves like cash: whoever scans and syncs it first receives it.
- The server-side key backup is protected by a 6-digit PIN, so a database leak would allow
  offline brute force. A real recovery phrase would remove this.
- WhatsApp integration uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial
  client that is against WhatsApp's terms — the linked number can be banned. Use a spare number.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, PWA (vite-plugin-pwa), React Router (hash) |
| UI | shadcn/ui (Radix + Tailwind CSS v4), lucide icons, Geist font, light/dark |
| State & storage | Zustand, IndexedDB (`idb`) |
| Crypto | Web Crypto API — Ed25519, PBKDF2, AES-256-GCM |
| QR | `qrcode.react` (generate), `jsQR` (scan) |
| Backend | Node.js 20+ / Express 5, SQLite (`better-sqlite3`), JWT, Helmet, rate limiting |
| Messaging | Baileys (WhatsApp), SMS Gateway for Android (SMS sync), Twilio Verify (optional) |

---

## Setup

**Prerequisites:** Node.js 20+.

### Backend

```bash
cd backend
npm install
cp .env.example .env      # then edit
node index.js             # http://localhost:3000
npm test                  # reconciler + SMS tests
```

With no OTP channel configured, the server runs in **mock mode** — the code is always `123456`
(refused when `NODE_ENV=production`).

### Frontend

```bash
cd frontend
npm install               # .npmrc sets legacy-peer-deps (vite-plugin-pwa ↔ Vite 8)
cp .env.example .env      # optional: SMS gateway number
npm run dev               # https://localhost:5173 (self-signed cert — accept the warning)
```

On a phone on the same Wi-Fi, open `https://<laptop-ip>:5173` (Vite prints it as *Network*).
The camera and Web Crypto need HTTPS.

> **Offline demo tip:** `npm run dev` doesn't serve the service worker, so open the app on both
> phones while online, then switch to airplane mode **without reloading**.

### Optional: WhatsApp OTP and alerts

1. In `backend/.env` set `WHATSAPP_ENABLED=true` and restart.
2. Scan the QR printed in the terminal from a **spare** number: WhatsApp → *Linked devices* →
   *Link a device*. The session is saved in `backend/wa_auth/` (git-ignored — keep it secret).
3. OTP codes now go out on WhatsApp, and users get a message whenever a payment settles.

### Optional: SMS sync (no data needed on the user's phone)

You need a spare Android phone with a SIM to act as the gateway.

1. Install **SMS Gateway for Android** ([sms-gate.app](https://sms-gate.app)) on it.
2. In the app, set a webhook **signing key**; put the same value in
   `backend/.env` as `SMS_WEBHOOK_SIGNING_KEY`.
3. Register a webhook for the `sms:received` event pointing at
   `http(s)://<server>:3000/api/sms/inbound` (see the app's docs for the local/cloud API).
4. In `frontend/.env` set `VITE_SMS_GATEWAY_NUMBER` to the gateway phone's number and restart
   the frontend.

Users with pending payments then see **Sync status → No data? Sync by SMS**. The message is
sent from their own SIM; the server identifies them by that number and settles the signed
payments inside it.

---

## Project structure

```
backend/
  index.js               API routes (auth, wallet, sync, SMS webhook, merchant, history)
  env.js                 loads backend/.env
  db.js, db/schema.sql   SQLite setup
  middleware/auth.js     JWT + OTP tokens
  services/
    reconciler.js        settlement: signature, nonce, limits, balance (atomic per payment)
    otp.js               OTP via WhatsApp / Twilio / mock
    whatsapp.js          Baileys connection + send
    sms.js               SMS sync parsing + gateway signature check
  test/                  node:test suites
frontend/src/
  screens/               one file per screen (Home, Send, Receive, Merchant, Sync, …)
  components/            AppShell (navigation), Keypad, TxnRow, Viewfinder, shadcn ui/
  services/              crypto, storage (IndexedDB), wallet, transactions, sync, smsSync, api
  store/walletStore.js   Zustand store
```

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/send-otp` | – | Send OTP; returns the channel used |
| POST | `/api/verify-otp` | – | Verify OTP → short-lived `otpToken` |
| POST | `/api/auth/register` | otpToken | Create user + wallet |
| POST | `/api/auth/login` | otpToken | Session token + encrypted key backup |
| GET | `/api/wallet/balance` | JWT | Balance |
| POST | `/api/wallet/add` | JWT | Simulated top-up (≤ ₹10,000) |
| POST | `/api/wallet/withdraw` | JWT | Simulated bank withdrawal |
| POST | `/api/sync` | JWT | Settle signed offline payments |
| POST | `/api/sms/inbound` | HMAC | SMS gateway webhook → settle payments in the SMS |
| GET | `/api/transactions` | JWT | Settled payments in both directions |
| GET | `/api/merchant/collections` | JWT | Payments received, with today/all-time totals |
