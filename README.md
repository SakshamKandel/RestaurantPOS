# Tabetei POS

Offline-first desktop point-of-sale for a Japanese restaurant.
**React 19 + TypeScript + Vite + Tailwind CSS 4** UI inside an **Electron**
shell, with a durable JSON store behind IPC (`%APPDATA%/tabetei-pos/pos-store.json`).

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

- **Dashboard** — menu grid, category/search filters, live order-line strip,
  order types (take away / dine in / delivery), table picker, customer attach,
  hold & recall parked orders
- **Payment** — cash numpad with quick-tender and change, QR/scan, card;
  thermal-style receipt preview; kitchen + billing jobs simulated
- **Kitchen** — KDS kanban: New → Preparing → Ready → Served
- **Reservations** — floor plan with free/reserved/occupied tables, booking form
- **Customers** — searchable CRM, add profiles, start an order for a customer
- **Transactions** — order history, reprint (COPY), refund
- **Report** — gross/avg/tax/refunds, sales-by-hour chart, tender split, top items
- **Settings** — restaurant identity, tax rate, order prefix, printer roles
- **Info** — health panel (DB, printers, connectivity) + one-click backup

## Layout

```
electron/          Desktop shell (main process, preload IPC bridge)
src/
  data/menu.ts     Catalog, staff, customers, reservations, settings seeds
  store.ts         Persisted state shape + IPC/localStorage persistence
  components/      Sidebar, OrderPanel, OrderLine, MenuSection,
                   LoginScreen, PaymentModal, ReceiptModal
  pages/           Dashboard, Kitchen, Reservations, Customers,
                   Transactions, Report, Settings, Info
scripts/electron.mjs  Launcher (strips ELECTRON_RUN_AS_NODE)
```

Money is always integer cents — no floating-point currency, per the PRD.
