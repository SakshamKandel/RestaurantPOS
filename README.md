# KhadkaPOS

Offline-first desktop point-of-sale for a **US takeaway restaurant**.
**React 19 + TypeScript + Vite + Tailwind CSS 4** UI inside an **Electron**
shell, with a real **SQLite** database behind IPC
(`%APPDATA%/KhadkaPOS/pos.db`, WAL mode, transactional writes).
A legacy JSON mirror (`pos-store.json`) and rotating backups are kept for
disaster recovery and downgrade compatibility.

## Run it

```powershell
npm install
npm run dev:app   # desktop app with hot reload (Vite + Electron window)
npm start         # production build + launch packaged-mode window
npm run dist      # build Windows installer (NSIS)
node scripts/dbtest.cjs   # storage + auth layer test
```

## Staff & the hidden Administrator

- First boot runs a setup wizard — the first account created is a **manager**.
- Staff roles: **manager**, **cashier**, **kitchen**. Managers can administer
  cashiers and kitchen staff only; nobody can edit or reset their own account.
- A hidden **Administrator** account (default PIN `8865`, change it in Staff
  Management) can manage every role including managers — it's the recovery
  path when a manager forgets their PIN. It never appears in the staff list.
- PINs are **PBKDF2-hashed with per-PIN salts** inside the main process — the
  UI never sees a stored PIN or hash, and repeated wrong attempts trigger an
  escalating lockout.
- Managers can issue **one-time PINs**; the staff member must set a new PIN at
  next login.

## Features

- **Dashboard** — menu grid, category/search filters, live order-line strip
  (Waiting → Ready → Served), order types: Take Away / Collection / Delivery,
  customer attach, hold & recall parked orders
- **Modifiers / add-ons** — per-item option groups (Size, Extras…), required
  or optional, single- or multi-select, per-option pricing. Each modifier
  combination is its own cart line; choices print on the kitchen ticket and
  the receipt.
- **Payment** — cash numpad with quick-tender and change, QR/scan, card, and
  **split payments** (mix cash + card + scan on one order); every component is
  stored and printed.
- **Per-item tax classes** — named rates in Settings → Tax (e.g. Standard,
  Exempt), assigned per item in Menu; receipts show the per-class breakdown.
- **Inventory** — optional stock tracking per item, automatic sold-out at 0,
  low-stock warnings on the menu card and in notifications, stock restored on
  refunds.
- **Refunds** — full or **partial** (per line / per quantity) with per-line
  tax-aware amounts, refund records, stock restore, audit trail.
- **Dual thermal printers** — kitchen ticket on the chef printer, receipt on
  the billing printer, on every completed order. Jobs are durable, queued and
  retryable from the Printers page — a printer failure never cancels a sale.
- **Customers** — searchable CRM, add profiles, start an order for a customer
- **Transactions** — order history, advance status, reprint (COPY), refunds,
  **CSV export** (accounting-friendly, one row per order line)
- **Report** — net/avg/tax/refunds, sales-by-hour chart, tender split,
  top items, **Z-report CSV export**
- **Shift** — cash drawer float, paid-in/out, blind count, expected-vs-counted
  (split-payment and refund aware)
- **Settings** — restaurant identity, tax classes, order prefix, printer roles
- **Info** — health panel (DB integrity check, printers, connectivity) +
  manual backup

## Data safety

- Money is always integer cents — no floating-point currency.
- SQLite (WAL) writes are **transactional**; `PRAGMA integrity_check` runs on
  the Info page. Debounced saves batch rapid UI changes into one commit.
- Timestamped JSON backups in `%APPDATA%/KhadkaPOS/backups/` (last 10).
- `pos-store.json` is kept in sync at quit so installing an older version
  keeps working (rollback).
- Print jobs persist across restarts; a job left mid-flight on shutdown is
  marked `failed` on next launch so it can be retried — never re-printed
  silently.

## Layout

```
electron/          Desktop shell: main process, preload bridge,
                   db.cjs (SQLite), auth.cjs (PIN hashing + lockout)
src/
  data/menu.ts     Catalog, staff, customers, settings types & seeds
  store.ts         Persisted state shape + IPC/localStorage persistence
  components/      Sidebar, OrderPanel, OrderLine, MenuSection,
                   LoginScreen, PaymentModal, ModifierModal, RefundModal,
                   ReceiptModal
  pages/           Dashboard, Printers, Customers, Transactions,
                   Report, Settings, Info, Staff, Shift, Menu
scripts/electron.mjs  Launcher (strips ELECTRON_RUN_AS_NODE)
scripts/dbtest.cjs    Storage/auth layer test
scripts/peek-db.cjs   Inspect a pos.db (integrity + row counts)
```

## Updates & Rollback

- The app checks GitHub Releases for updates on launch and every 6h (only
  when online — sales work offline).
- When an update downloads, you can **defer it for up to 3 days**; after that
  it **installs automatically**.
- Before every install, a safety snapshot (`pre-update-*.json` + a byte-exact
  `.db` copy) is written to `%APPDATA%\KhadkaPOS\backups\`.
- **Rollback**: download an older `KhadkaPOS-Setup-x.y.z.exe` from Releases
  and install it. Data lives in `%APPDATA%\KhadkaPOS\` (never deleted on
  uninstall); the DB only ever *adds* fields, and the JSON mirror lets
  pre-SQLite versions read current data.
- Publishing: bump `version` in package.json → `npm run dist` →
  `gh release create vX.Y.Z <setup.exe> <blockmap> <latest.yml>`.

## Code signing (removes the SmartScreen warning)

The installer ships unsigned by default — Windows will show "Windows protected
your PC" until the certificate builds reputation. To sign releases, set the
standard electron-builder env vars before `npm run dist`:

```powershell
$env:CSC_LINK = 'C:\path\to\certificate.pfx'      # or base64 of the .pfx
$env:CSC_KEY_PASSWORD = 'your-cert-password'
npm run dist
```

Signed builds also stamp the binary with SHA-256 and an RFC-3161 timestamp
(configured in `package.json → build.win`).
