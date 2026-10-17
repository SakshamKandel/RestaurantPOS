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
node scripts/updatetest.cjs   # updater IPC regression checks
node scripts/login-update-test.cjs   # login-screen update controls
node scripts/fixed-admin-auth-test.cjs   # fixed Administrator PIN and staff auth checks
node scripts/firstboot-auth-test.cjs   # fresh/legacy data and staff PIN checks
```

## Staff & the hidden Administrator

- First boot runs a setup wizard — the first account created is a **manager**.
- Staff roles: **manager**, **cashier**, **kitchen**. Managers can administer
  cashiers and kitchen staff only; nobody can edit or reset their own account.
- The hidden **Administrator** account uses the fixed PIN **`8865`** from
  version **0.4.4**. Select **Administrator** at the bottom left of the login
  screen, enter `8865`, and press **Sign in**. This account can manage every
  role, including managers, and never appears in the staff list.
- The Administrator PIN cannot be changed in Staff Management. It is separate
  from every staff PIN, including a manager named Admin. New installations do
  not store an Administrator credential in the database; existing legacy
  `admin_pin` values remain untouched and are ignored during sign-in.
- Staff PINs are **PBKDF2-hashed with per-PIN salts** inside the main process —
  the UI never sees a stored PIN or hash, and repeated wrong attempts trigger
  an escalating lockout.
- Managers can issue **one-time PINs**; the staff member must set a new PIN at
  next login.

### Administrator sign-in and older versions

If an older installation rejects `8865`, update to **0.4.4 or later**, then
restart KhadkaPOS and select **Administrator** at the bottom left. Updating is
enough to restore Administrator access with `8865`; sales, staff PINs, settings,
and other app data are preserved. Updates are available from the login screen
without signing in. Do not delete `pos.db` or clear app data.

The [Administrator recovery ZIP](https://github.com/SakshamKandel/RestaurantPOS/releases/download/v0.4.3/KhadkaPOS-Admin-Recovery.zip)
is a legacy support tool for versions **0.4.3 and earlier** when updating is
not possible. Close KhadkaPOS, extract the complete ZIP, and double-click
**Restore Administrator PIN.cmd**. It uses the installed app's runtime and
verifies a full database backup before restoring the legacy saved PIN to
`8865`. Keep the backup path printed by the tool. Version 0.4.4 and later do
not need this database reset.

For those older versions, support can also use the repository helper on the
client's computer (requires Node.js and this project's installed dependencies):

1. Close KhadkaPOS completely and keep it closed until recovery finishes.
2. From this project folder, check the **client's actual database path**:

   ```powershell
   node scripts/reset-admin-pin.cjs "$env:APPDATA\KhadkaPOS\pos.db"
   ```

3. If the saved PIN differs or is invalid, run the same command with `--reset`:

   ```powershell
   node scripts/reset-admin-pin.cjs "$env:APPDATA\KhadkaPOS\pos.db" --reset
   ```

4. Restart KhadkaPOS, select **Administrator** at the bottom left, enter `8865`,
   and press **Sign in**. Staff and manager PINs are separate.

The default command only checks the PIN; it prints no stored PIN or hash.
`--reset` requires an existing database and makes and verifies a full SQLite
backup beside it before changing only `kv.admin_pin`. Sales, staff PINs, and
other settings stay unchanged. The helper does not create tables or migrate
app data. If the client uses a custom data folder, pass that absolute `pos.db`
path instead. Do not delete `pos.db`, clear app data, or remove database lock
files to recover a PIN.

To rebuild or test this legacy portable tool from source:

```powershell
node scripts/build-admin-recovery.cjs "C:\RecoveryBuild"
node scripts/client-recovery-test.cjs "C:\path\to\KhadkaPOS.exe" "C:\RecoveryBuild\KhadkaPOS-Admin-Recovery"
```

The build directory must not already contain a recovery package. The runtime
tests use only generated temporary databases and never installed app data.

## Features

- **Updates before login** — the login screen shows the current version and
  Check for Updates, download status, and Restart & Update when ready. No PIN
  is needed to update; updating preserves business data and staff PINs.
- **Item modifier settings** — use Modifiers beside each item in Menu
  Management to edit that item's groups, options, extra prices, and selection
  rules. Changes apply only to that item; Cancel discards the draft.
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
- **Report** — date ranges (today/yesterday/7d/30d/month/custom, aware of a
  configurable **business-day cutoff**), net vs gross with period-over-period
  comparison, sales by hour/day/month, tender split, breakdowns **by order
  type, category and staff**, top items by qty/revenue with per-item margin,
  item **cost (COGS) → margin reporting**, **range-scoped CSV export**
- **Shift** — cash drawer float, paid-in/out, blind count, expected-vs-counted
  (split-payment and refund aware)
- **Settings** — restaurant identity, tax classes, order prefix, printer roles
- **Logs** — error files under `%APPDATA%/KhadkaPOS/logs/` — one `.txt` per
  problem area (`printer-errors`, `auth-errors`, `update-errors`,
  `app-errors`), created only when an error actually occurs. View, filter,
  copy or clear them in-app, or open the folder directly.
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
- Failures are appended to per-area error files in
  `%APPDATA%/KhadkaPOS/logs/` (lazily created — no errors, no folder) and
  viewable on the Logs page.

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
                   Report, Settings, Logs, Info, Staff, Shift, Menu
scripts/electron.mjs  Launcher (strips ELECTRON_RUN_AS_NODE)
scripts/dbtest.cjs    Storage/auth layer test
scripts/logtest.cjs   Error-log IPC test (stubbed Electron)
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
