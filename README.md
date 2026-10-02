# SyncPay — Offline Digital Payment System

## Problem Statement

**Theme 3: FinTech & Financial Inclusion**
**Problem: Last-Mile Banking Without Internet**

Millions of people in rural and remote areas face unreliable or no internet connectivity, limiting access to digital financial services.

The challenge is to build a solution that enables financial transactions without continuous internet using methods such as:

* SMS / USSD
* Offline QR systems
* Bluetooth-based payments

### Goal

To make UPI-like payments accessible in low-connectivity environments and improve financial inclusion.

---

## Solution Overview

SyncPay is an offline-first digital payment system that enables seamless peer-to-peer transactions without requiring WiFi, mobile data, or hotspot connectivity.

The system uses offline QR-based payment exchange, allowing users to send and receive money even in zero-network conditions.

* Users complete a one-time online onboarding (OTP-based authentication)
* All subsequent transactions are performed completely offline
* Transactions are later synchronized and validated when connectivity is restored

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite (PWA) |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Local Storage | IndexedDB (idb) |
| Cryptography | Web Crypto API (Ed25519 + AES-256-GCM) |
| QR Code | qrcode.react + jsQR |
| State Management | Zustand |
| Styling | Tailwind CSS |

---

## Project Structure

```
SyncPay/
├── backend/              # Express server
│   ├── db/               # SQLite database & schema
│   ├── middleware/        # JWT auth middleware
│   ├── services/         # Transaction reconciler
│   ├── index.js          # Main server entry point
│   └── db.js             # Database initialization
├── frontend/             # React + Vite client
│   ├── src/
│   │   ├── components/   # Sidebar, Keypad, Toast, etc.
│   │   ├── screens/      # All app screens (Home, Send, Receive, etc.)
│   │   ├── services/     # API, crypto, sync, storage, wallet services
│   │   ├── store/        # Zustand wallet store
│   │   ├── App.jsx       # Root component with routing
│   │   └── index.css     # Design system tokens
│   ├── vite.config.js    # Vite config with HTTPS & proxy
│   └── index.html
├── .gitignore
└── README.md
```

---

## Setup & Installation

### Prerequisites

* Node.js v18+
* npm

### Backend

```bash
cd backend
npm install
node index.js
```

Server starts on `http://localhost:3000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App starts on `https://localhost:5173` (HTTPS for camera/crypto API access)

### Mobile Testing

Access the app from your phone on the same network:
```
https://<your-laptop-ip>:5173
```

---

## Key Features

* **Internet-Free Transactions** — Perform payments without any network connection

* **Secure One-Time OTP Authentication** — Ensures user identity during onboarding

* **Offline QR Code-Based Payments** — Exchange payment data directly between devices

* **Merchant-Specific Static QR Codes** — Enables offline payments at shops and vendors

* **Instant Payment Experience** — Transactions appear instantly (pending confirmation)

* **Peer-to-Peer Transactions** — Direct user-to-user payments

* **Auto-Sync on Reconnection** — Automatically syncs pending transactions when internet is detected

---

## How It Works

### Transaction Flow

#### 1. Onboarding (Online — One Time)

* User registers using OTP
* Ed25519 keypair is generated and encrypted with user's PIN
* Wallet is initialized on the server

#### 2. Offline Payment

* Sender enters amount → funds are locked locally
* Cryptographically signed QR code is generated
* Receiver scans QR → signature is verified locally
* Transaction stored locally on both devices
* Sender: Locked funds | Receiver: Unconfirmed balance

#### 3. Sync and Validation (Online)

* App detects connectivity
* Pending transactions sent to backend
* Server verifies Ed25519 signatures and nonces
* Balances are updated atomically

Final Status:

* ✅ Confirmed — balance updated on both sides
* ❌ Failed — funds unlocked back to sender

---

## Wallet Model

SyncPay uses a prepaid wallet system:

* Users load money into wallet when online
* Offline transactions use wallet balance
* Funds are **locked** (not deducted) during offline payment
* Final settlement happens after sync with the server

---

## Security Approach

* **Ed25519 digital signatures** — every transaction is cryptographically signed
* **AES-256-GCM encryption** — private keys encrypted with user's PIN
* **Nonce-based replay protection** — prevents duplicate transaction processing
* **Local balance locking** — prevents overspending offline
* **Transaction limits** — ₹500/transaction, ₹2,000/day offline cap
* **Secure local storage** — keys stored in IndexedDB, never transmitted

---

## Limitations

* Offline transactions are not immediately final
* Double spending cannot be fully prevented in offline mode
* Small transaction limits are enforced for safety
* Final validation requires internet sync

---

## Innovation and Impact

SyncPay directly addresses the challenge of last-mile banking without internet by enabling:

* Financial access in rural and remote areas
* Reliable transactions during network outages
* Inclusive and resilient digital payment systems

It bridges the gap between traditional cash systems and modern digital payments.

---

## Regulatory Note

This project is a prototype simulation.

Real-world deployment would require:

* Compliance with regulations from the Reserve Bank of India
* Prepaid Payment Instrument (PPI) licensing
* KYC and fraud prevention systems

---

## Demo Scenario

1. Two users onboard and load wallet (online)
2. Internet is turned off on the sender
3. Sender enters amount → QR code is generated
4. Receiver scans QR → accepts payment (shows as Unconfirmed)
5. Internet is restored on the sender
6. Auto-sync runs → transactions are confirmed on both sides
7. Balances update to reflect the confirmed transfer

---

## Conclusion

SyncPay demonstrates that digital payments can function independently of internet connectivity, making financial services more inclusive, resilient, and accessible.
