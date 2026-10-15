# SyncPay — Offline Digital Payments

**Theme:** FinTech & Financial Inclusion — *last-mile banking without internet.*

SyncPay is a UPI-style wallet that keeps working when the network doesn't. Payments are
signed on the phone and exchanged as QR codes with **no internet on either side**. They settle
on the server automatically as soon as **either** phone gets a connection.

> Prototype. Top-ups and bank withdrawals are simulated; real deployment would need RBI
> PPI licensing, KYC and fraud controls.

---

## How it works

```
 ONLINE, ONCE          OFFLINE, ANY NUMBER OF TIMES                 WHEN EITHER PHONE GETS SIGNAL
 ─────────────         ───────────────────────────────────          ───────────────────────────────
 Sign up (OTP)   ──►   Sender: amount + PIN ─► signed QR    ──►     App syncs ─► server verifies
 Add money             Receiver: scan ─► verify signature                        signature, balance,
                       on-device ─► "₹X incoming"                                limits ─► settles
```

1. **Onboarding (online).** Phone number is verified by OTP (WhatsApp, or a mock code in dev).
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

- **Amount in the QR:** the merchant can type an amount under their QR; the customer's screen
  then shows it fixed and they just confirm.
- **Receipt:** after accepting, the receiver can tap **Give receipt** (PIN) to show a QR signed
  with their wallet key. The payer scans it (**Scan the receiver's receipt**) and the payment is
  marked "Signed by <merchant>". A receipt from anyone other than the merchant who was paid,
  for a different amount, or with a bad signature is rejected.

### Offline allowance

Offline payments are backed by a **server-signed allowance**. While online, each phone gets a
voucher: *"this wallet may spend up to ₹X offline, using payment numbers A–B, until <date>"*,
signed with the server's own Ed25519 key. The server **reserves** that amount (up to ₹2,000,
valid 3 days), so it can't be withdrawn or spent online.

- Every payment QR carries the voucher. The receiver checks it **offline** against the server's
  public key (cached on first sign-in): genuine, not expired, covering this payment number and
  amount, and not already used up with this receiver.
- At settlement a payment inside the voucher is paid from the reserve, so it **settles even if
  the sender's other money is gone**. If the sender double-spends the same allowance, the first
  claim to settle wins and the rest fall back to their free balance.
- Unspent reserve returns 2 days after the voucher expires (time for late syncs). A new voucher
  is issued automatically when the old one is used up or in its last day.

### Sync channels

| Channel | When | How |
|---|---|---|
| **App (data)** | Any connection | Automatic on reconnect, on app open, every 20 s on Home |
| **WhatsApp** (outbound only) | Server side | OTP codes and "payment settled / received" alerts |

---

## Security model

| Threat | Mitigation |
|---|---|
| Forged or edited payment | Ed25519 signature over the exact payload; amount, recipient and nonce are read **only** from the signed payload |
| Replay / double-settlement | Unique transaction id and per-sender nonce on the server; duplicate syncs are idempotent |
| Someone else claims a payment | A payment addressed to a user can only be credited to that user; an unaddressed one can be claimed once |
| Overspending offline | Server-signed offline allowance with the money reserved; ₹500 per payment and ₹2,000/day enforced on the device **and** the server |
| Unbacked offline payment | Receiver verifies the allowance voucher offline and warns when a payment isn't backed |
| Stolen session on another phone | **Settings → Sign out other devices** invalidates every other session token |
| Account takeover | Login and signup require a fresh OTP token (10 min); PIN unlock on the device; 5 wrong PINs wipe local keys |

**Known limitations (by design of offline payments):**
- Offline payments are final only after settlement. The allowance bounds and backs offline
  spending, but a sender who wipes their app can still double-spend **the same allowance** with
  two receivers; only the first claim is guaranteed. Preventing that outright needs secure
  hardware (e.g. a phone's secure element), which a web app can't use.
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
| Messaging | Baileys (WhatsApp OTP + payment alerts) |

---

## Setup

**Prerequisites:** Node.js 20+.

### Backend

```bash
cd backend
npm install
cp .env.example .env      # then edit
node index.js             # http://localhost:3000
npm test                  # settlement + allowance tests
```

On first start the server creates its **allowance signing key** in `backend/keys/`
(git-ignored). **Back it up and keep it secret**: a new key makes outstanding vouchers
unverifiable, and anyone with it could forge allowances.

With no OTP channel configured, the server runs in **mock mode** — the code is always `123456`
(refused when `NODE_ENV=production`).

### Frontend

```bash
cd frontend
npm install               # .npmrc sets legacy-peer-deps (vite-plugin-pwa ↔ Vite 8)
npm run dev               # https://localhost:5173 (self-signed cert — accept the warning)
```

On a phone on the same Wi-Fi, open `https://<laptop-ip>:5173` (Vite prints it as *Network*).
The camera and Web Crypto need HTTPS.

### Production build (installable, opens offline)

```bash
cd frontend
npm run serve             # builds, then serves dist/ on https://<host>:4173 with /api proxied
```

The build includes a service worker that caches the whole app on first visit, so after that
it opens with **no network at all**, and browsers offer **Install app / Add to Home Screen**
(icons in `frontend/public/`). API responses are never cached — balances always come from
the server or the device's own records.

> ⚠️ Service workers need a **trusted** HTTPS certificate. The dev self-signed certificate is
> fine on the laptop, but phones refuse to install the service worker behind it (even after
> "Proceed anyway"). For phones, either host it with a real certificate (e.g. a VPS with
> Let's Encrypt) or put an [mkcert](https://github.com/FiloSottile/mkcert) certificate in
> `frontend/certs/` and install mkcert's root CA on the phone.
>
> `npm run dev` doesn't run the service worker at all: with it, open the app while online and
> go offline **without reloading**.

### Optional: WhatsApp OTP and alerts

1. In `backend/.env` set `WHATSAPP_ENABLED=true` and restart.
2. On the server machine open `http://localhost:3000/whatsapp` and scan the QR from a **spare**
   number: WhatsApp → *Linked devices* → *Link a device*. The session is saved in
   `backend/wa_auth/` (git-ignored — keep it secret) and reconnects on restart.
3. OTP codes now go out on WhatsApp, and users get a message whenever a payment settles.

---

## Project structure

```
backend/
  index.js               API routes (auth, wallet, sync, merchant, history, WhatsApp link page)
  env.js                 loads backend/.env
  db.js, db/schema.sql   SQLite setup
  middleware/auth.js     JWT + OTP tokens
  services/
    reconciler.js        settlement: signature, nonce, limits, balance (atomic per payment)
    allowance.js         offline allowance vouchers: issue, reserve, draw, release
    serverKey.js         server Ed25519 key (signs vouchers)
    otp.js               OTP via WhatsApp (or mock in dev)
    whatsapp.js          Baileys connection + send
  test/                  node:test suites
frontend/src/
  screens/               one file per screen (Home, Send, Receive, Merchant, Sync, …)
  components/            AppShell (navigation), Keypad, TxnRow, Viewfinder, shadcn ui/
  services/              crypto, storage (IndexedDB), wallet, transactions, sync, api
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
| POST | `/api/allowance` | JWT | Current offline allowance voucher (issues/renews and reserves) |
| GET | `/api/server-key` | – | Server public key phones use to check vouchers offline |
| PUT | `/api/auth/backup` | JWT | Replace the encrypted key backup (after a PIN change) |
| POST | `/api/auth/logout-others` | JWT | Sign out every other device; returns a fresh token |
| GET | `/api/transactions` | JWT | Settled payments in both directions |
| GET | `/api/merchant/collections` | JWT | Payments received, with today/all-time totals |
