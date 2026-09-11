# KhadkaPOS

Offline-first desktop point-of-sale for a **US takeaway restaurant**.
**React 19 + TypeScript + Vite + Tailwind CSS 4** UI inside an **Electron**
shell, with a durable JSON store behind IPC
(`%APPDATA%/khadkapos/pos-store.json`).

## Run it

```powershell
npm install
npm run dev:app   # desktop app with hot reload (Vite + Electron window)
npm start         # production build + launch packaged-mode window
npm run dist      # build Windows installer (NSIS)
```

## Staff PINs (demo)

| Profile        | Role    | PIN  |
| -------------- | ------- | ---- |
| Gilang Febrian | Cashier | 1234 |
| Rina Sato      | Manager | 9999 |
| Kenji Mori     | Kitchen | 5555 |

Reports and Settings are manager-only; Log Out returns to the PIN screen.

## Features

- **Dashboard** — menu grid, category/search filters, live order-line strip
  (Waiting → Ready → Served), order types: Take Away / Collection / Delivery,
  customer attach, hold & recall parked orders
- **Payment** — cash numpad with quick-tender and change, QR/scan, card;
  thermal-style receipt preview
- **Dual thermal printers** — on every completed order a **kitchen ticket**
  (items + order details) prints on the chef printer and a **receipt** prints
  on the billing printer. Jobs are durable, queued, and retryable from the
  Printers page — a printer failure never cancels a paid sale
- **Printers** — print-queue monitor with job status, kitchen-ticket preview,
  COPY reprints, and retry
- **Customers** — searchable CRM, add profiles, start an order for a customer
- **Transactions** — order history, advance status, reprint (COPY), refund
- **Report** — gross/avg/tax/refunds, sales-by-hour chart, tender split, top items
- **Settings** — restaurant identity, US sales tax rate, order prefix,
  printer roles
- **Info** — health panel (DB, printers, connectivity) + manual backup

## Data safety

- Money is always integer cents — no floating-point currency.
- Every state change is persisted atomically **and** writes a timestamped
  backup to `%APPDATA%/khadkapos/backups/` (last 10 kept automatically).
- Print jobs persist across restarts; a job left mid-flight on shutdown is
  marked `failed` on next launch so it can be retried — never re-printed
  silently.

## Layout

```
electron/          Desktop shell (main process, preload IPC bridge)
src/
  data/menu.ts     Catalog, staff, customers, settings seeds
  store.ts         Persisted state shape + IPC/localStorage persistence
  components/      Sidebar, OrderPanel, OrderLine, MenuSection,
                   LoginScreen, PaymentModal, ReceiptModal
  pages/           Dashboard, Printers, Customers, Transactions,
                   Report, Settings, Info
scripts/electron.mjs  Launcher (strips ELECTRON_RUN_AS_NODE)
```

## Updates & Rollback

- The app checks GitHub Releases for updates on launch and every 6h (only when online � sales work offline).
- When an update downloads, you can **defer it for up to 3 days**; after that it **installs automatically**.
- Before every install, a safety copy of the store is written to `%APPDATA%\khadkapos\backups\pre-update-*.json`.
- **Rollback**: if a release misbehaves, download an older `KhadkaPOS-Setup-x.y.z.exe` from the Releases page and install it. Data lives in `%APPDATA%\khadkapos\` (never deleted on uninstall) and the store only ever *adds* fields, so older versions can read newer data.
- Publishing: bump `version` in package.json ? `npx electron-builder` ? `gh release create vX.Y.Z <setup.exe> <blockmap> <latest.yml>`.
