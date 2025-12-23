# Bitcoin Watch-Only Wallet (PWA)

Minimal watch-only wallet for a single zpub. Generates addresses, checks balances, shows recent activity, and supports PWA install.

## Features
- zpub gate (server-first hash verification; localhost can be whitelisted)
- HD address generation (m/0/i + m/1/i)
- balance + recent transactions (confirmed + mempool)
- QR receive address
- PWA offline cache

## Quick Start
```bash
npm install
npm run dev
```
Open `http://localhost:8080`.

## Build
```bash
npm run build
```

## Gate Verification
The client posts a SHA-256 hash of the zpub and expects:
```json
{ "ok": true }
```
Configure:
- `<meta name="gate-verify-url" content="https://your-domain/verify">`
- or `window.GATE_CONFIG = { verifyUrl: "https://your-domain/verify" }`

## Notes
- Data is stored in localStorage only.
- This app never handles private keys.
