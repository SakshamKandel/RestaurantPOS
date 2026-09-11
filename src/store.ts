import {
  DEFAULT_SETTINGS,
  MENU_ITEMS,
  SEED_CATEGORIES,
  SEED_CUSTOMERS,
  STAFF,
  SUPER_ADMIN,
  type Category,
  type SelectedMod,
  type Cents,
  type Customer,
  type MenuItem,
  type Settings,
  type Staff,
} from './data/menu'
import type { PaymentMethod } from './components/OrderPanel'

export type OrderType = 'take-away' | 'collection' | 'delivery'

export interface OrderLineSnap {
  /** Menu item id — used for stock deduction/restoration. */
  itemId?: string
  name: string
  qty: number
  /** Base unit price; modifier prices are in `mods`. */
  price: Cents
  note?: string
  mods?: SelectedMod[]
  /** Tax class id at time of sale (fallback = store default rate). */
  taxClass?: string
  /** Rate applied at time of sale — survives later rate edits. */
  taxRate?: number
  /** Category id at time of sale — survives menu edits/deletes. */
  category?: string
  /** Unit cost (COGS) in cents at time of sale. */
  cost?: Cents
  /** Post-discount line net (the tax base), exact cents. */
  net?: Cents
  /** Line tax amount in cents. */
  tax?: Cents
  /** Units refunded so far (partial refunds). */
  refundedQty?: number
}

export type Discount = { type: 'percent' | 'flat'; value: number } | null

/** One component of a (possibly split) payment. */
export interface PaymentRecord {
  method: PaymentMethod
  amount: Cents
  tendered?: Cents // cash only
  change?: Cents // cash only
}

/** A refund event — lines reference order.lines by index. */
export interface RefundRecord {
  id: string
  at: number
  actor: string
  lines: { index: number; name: string; qty: number; amount: Cents }[]
  /** Total money returned, including the tax share. */
  amount: Cents
  reason?: string
}

export type PlacedStatus = 'new' | 'ready' | 'served' | 'refunded' | 'partial-refund'

/** Refundable amount (net + its tax share) for `qty` units of order line `i`.
 *  Uses the per-line net/tax stored at sale time; approximates for legacy orders. */
export function lineRefundAmount(o: PlacedOrder, i: number, qty: number): Cents {
  const l = o.lines[i]
  if (!l || qty <= 0) return 0
  const gross = (l.price + (l.mods?.reduce((s, m) => s + m.price, 0) ?? 0)) * l.qty
  const net = l.net ?? Math.round((gross * Math.max(0, o.subtotal - o.discount)) / Math.max(1, o.subtotal))
  const effRate = o.subtotal - o.discount > 0 ? o.tax / (o.subtotal - o.discount) : 0
  const lt = l.tax ?? Math.round(net * (l.taxRate ?? effRate))
  return Math.round(((net + lt) * qty) / l.qty)
}

export interface PlacedOrder {
  id: string
  number: string
  type: OrderType
  customer: string
  lines: OrderLineSnap[]
  subtotal: Cents
  discount: Cents
  tax: Cents
  total: Cents
  note?: string
  payment: PaymentMethod
  tendered: Cents
  change: Cents
  /** Split payments; absent on pre-split orders → payment/tendered/change apply. */
  payments?: PaymentRecord[]
  refunds?: RefundRecord[]
  /** Per-class tax amounts, e.g. [{name:'Standard',rate:0.095,amount:120}]. */
  taxBreakdown?: { name: string; rate: number; amount: Cents }[]
  status: PlacedStatus
  createdAt: number
  cashier: string
}

export interface HeldOrder {
  id: string
  label: string
  type: OrderType
  customer: string
  lines: { itemId: string; qty: number; note?: string; mods?: SelectedMod[] }[]
  createdAt: number
}

export type PrinterRole = 'kitchen' | 'billing'

export type DocType = 'KITCHEN TICKET' | 'RECEIPT' | 'DRAWER KICK' | 'TEST'

export interface PrintJob {
  id: string
  orderNumber: string
  docType: DocType
  role: PrinterRole
  status: 'pending' | 'printed' | 'failed'
  copy: boolean
  createdAt: number
  /** Spooler / driver failure text, or why the job could not be sent. */
  error?: string
  /** Windows device the job was (or will be) sent to. */
  device?: string
}

// ---------- Cash drawer & shift ----------

export type MovementType = 'float' | 'paid-in' | 'paid-out' | 'no-sale' | 'count'

export interface DrawerMovement {
  id: string
  type: MovementType
  amount: Cents
  reason: string
  at: number
  actor: string
}

export interface Shift {
  id: string
  openedAt: number
  closedAt: number | null
  openedBy: string
  /** Who closed it — may differ from the opener on a handover. */
  closedBy?: string
  float: Cents
  counted: Cents | null
  movements: DrawerMovement[]
  /** Z-report snapshot written at close — persists in history. */
  orderCount?: number
  totalSales?: Cents
  cashSales?: Cents
  cashRefunds?: Cents
  expected?: Cents
  /** counted − expected; undefined when the drawer was never counted. */
  variance?: Cents
}

// ---------- Audit trail ----------

export interface AuditEvent {
  id: string
  at: number
  actor: string
  action: string
  detail: string
}

export interface PosState {
  orders: PlacedOrder[]
  held: HeldOrder[]
  customers: Customer[]
  printJobs: PrintJob[]
  menu: MenuItem[]
  categories: Category[]
  settings: Settings
  seq: number
  shifts: Shift[]
  audit: AuditEvent[]
  staff: Staff[]
}

export const initialState: PosState = {
  orders: [],
  held: [],
  customers: SEED_CUSTOMERS,
  printJobs: [],
  menu: MENU_ITEMS,
  categories: SEED_CATEGORIES,
  settings: DEFAULT_SETTINGS,
  seq: 1,
  shifts: [],
  audit: [],
  staff: STAFF,
}

// ---------- Persistence (Electron IPC, localStorage fallback) ----------

export interface DetectedPrinter {
  name: string
  displayName: string
  description: string
  isDefault: boolean
}

export interface PrintResult {
  ok: boolean
  reason: string | null
}

export interface UpdateInfo {
  version: string
  currentVersion: string
  forced: boolean
  deadline: number
}

// ---------- Error logs (files under userData/logs, written by the main process) ----------

export type LogCategory = 'printer' | 'auth' | 'update' | 'app'

export interface LogFileInfo {
  name: string
  size: number
  mtime: number
}

export interface LogList {
  dir: string
  files: LogFileInfo[]
}

export interface LogContent {
  name: string
  size: number
  /** true when only the last 256 KB of the file was returned. */
  truncated: boolean
  content: string
}

interface PosBridge {
  loadStore: () => Promise<PosState | null>
  saveStore: (s: PosState) => Promise<boolean>
  backup: (s: PosState) => Promise<string>
  listPrinters?: () => Promise<DetectedPrinter[]>
  printDoc?: (p: { deviceName: string; html: string; paperWidthMm: number }) => Promise<PrintResult>
  printRaw?: (p: { deviceName: string; bytes: number[] }) => Promise<PrintResult>
  pickImage?: () => Promise<string | null>
  appVersion?: () => Promise<string>
  checkUpdates?: () => Promise<{ status: 'none' | 'found' | 'error' | 'dev'; version?: string; message?: string } | null>
  installUpdate?: () => Promise<void>
  onUpdateAvailable?: (cb: (i: { version: string }) => void) => void
  onUpdateDownloaded?: (cb: (i: UpdateInfo) => void) => void
  onUpdateChecking?: (cb: () => void) => void
  onUpdateNone?: (cb: (i: { version: string }) => void) => void
  onUpdateError?: (cb: (i: { message: string }) => void) => void
  integrity?: () => Promise<{ result: string; file: string }>
  resetDb?: (actor: string) => Promise<boolean>
  login?: (id: string, pin: string) => Promise<LoginResult>
  setPin?: (id: string, pin: string) => Promise<{ ok: boolean; reason?: string }>
  exportCsv?: (p: { suggestedName: string; csv: string }) => Promise<string | null>
  saveReceipt?: (p: { orderNumber: string; html: string; paperWidthMm: number; copy: boolean }) => Promise<string | null>
  openReceipts?: (orderNumber?: string) => Promise<string>
  logError?: (category: string, message: string) => Promise<boolean>
  listLogs?: () => Promise<LogList>
  readLog?: (name: string) => Promise<LogContent | null>
  clearLog?: (name: string) => Promise<boolean>
  openLogs?: () => Promise<string>
}

export interface LoginResult {
  ok: boolean
  mustChangePin?: boolean
  /** Seconds until this account may try again (brute-force lockout). */
  lockSeconds?: number
  fails?: number
  reason?: string
}

const bridge = (window as unknown as { pos?: PosBridge }).pos
const LS_KEY = 'khadkapos'

/** True when running inside Electron — PINs live only in the main process. */
export const isDesktop = !!bridge?.loadStore

/**
 * Verify a PIN. On desktop this is checked against the salted hash in SQLite
 * with lockout; the browser preview falls back to the plaintext in state.
 */
export async function verifyLogin(id: string, pin: string, fallbackStaff: Staff[]): Promise<LoginResult> {
  if (bridge?.login) return bridge.login(id, pin)
  if (id === SUPER_ADMIN.id) return { ok: pin === SUPER_ADMIN.pin }
  const s = fallbackStaff.find((m) => m.id === id)
  return s ? { ok: s.pin === pin, mustChangePin: s.mustChangePin } : { ok: false, reason: 'no-account' }
}

export const setPinSecure = (id: string, pin: string) =>
  bridge?.setPin?.(id, pin) ?? Promise.resolve({ ok: true })

export const dbIntegrity = () => bridge?.integrity?.() ?? Promise.resolve({ result: 'n/a (browser)', file: 'localStorage' })

/**
 * Factory reset — writes a last-chance backup, deletes pos.db + the JSON
 * mirror, then relaunches into first-boot setup. Desktop only; the returned
 * promise never resolves on success because the process exits first.
 */
export const resetDatabase = (actor: string) =>
  bridge?.resetDb?.(actor) ?? Promise.resolve(false)

export const exportCsv = (suggestedName: string, csv: string) =>
  bridge?.exportCsv?.({ suggestedName, csv }) ??
  Promise.resolve(
    (() => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }))
      a.download = suggestedName
      a.click()
      return suggestedName
    })(),
  )

export async function loadPersisted(): Promise<PosState | null> {
  try {
    if (bridge?.loadStore) return await bridge.loadStore()
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as PosState) : null
  } catch (e) {
    logError('app', `store load IPC failed: ${(e as Error)?.message ?? e}`)
    return null
  }
}

export function persist(state: PosState) {
  try {
    if (bridge?.saveStore)
      void bridge
        .saveStore(state)
        .catch((e) => logError('app', `store save IPC failed: ${e?.message ?? e}`))
    else localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    /* persistence is best-effort in preview mode */
  }
}

export function backupNow(state: PosState): Promise<string | null> {
  if (bridge?.backup) return bridge.backup(state)
  localStorage.setItem(`${LS_KEY}-backup`, JSON.stringify(state))
  return Promise.resolve('localStorage backup')
}

export async function detectPrinters(): Promise<DetectedPrinter[]> {
  try {
    return (await bridge?.listPrinters?.()) ?? []
  } catch {
    return []
  }
}

export function printDocument(
  deviceName: string,
  html: string,
  paperWidthMm: number,
): Promise<PrintResult> | null {
  if (!bridge?.printDoc) return null
  return bridge.printDoc({ deviceName, html, paperWidthMm })
}

/** Send raw ESC/POS bytes (e.g. drawer pulse) straight to the Windows spooler. */
export function printRaw(deviceName: string, bytes: number[]): Promise<PrintResult> | null {
  if (!bridge?.printRaw) return null
  return bridge.printRaw({ deviceName, bytes })
}

/** ESC p m t1 t2 — pulse the drawer solenoid on pin m for t1*2ms, off t2*2ms. */
export const drawerKickBytes = (pin: 0 | 1): number[] => [0x1b, 0x70, pin, 0x19, 0xfa]

export const appVersion = () => bridge?.appVersion?.() ?? Promise.resolve('dev')
export const checkForUpdates = () => bridge?.checkUpdates?.() ?? Promise.resolve(null)
export const installUpdate = () => bridge?.installUpdate?.()
export const onUpdateAvailable = (cb: (i: { version: string }) => void) =>
  bridge?.onUpdateAvailable?.(cb)
export const onUpdateDownloaded = (cb: (i: UpdateInfo) => void) =>
  bridge?.onUpdateDownloaded?.(cb)
export const onUpdateChecking = (cb: () => void) => bridge?.onUpdateChecking?.(cb)
export const onUpdateNone = (cb: (i: { version: string }) => void) =>
  bridge?.onUpdateNone?.(cb)
export const onUpdateError = (cb: (i: { message: string }) => void) =>
  bridge?.onUpdateError?.(cb)

/** File picker → copies photo into app data, returns posimg:// URL (or null). */
export const pickImage = () => bridge?.pickImage?.() ?? Promise.resolve(null)

// ---------- Receipt archive ----------

/** Render a receipt's HTML to PDF under userData/receipts — returns the file
 *  path, or null in the browser preview / on failure. Never throws. */
export const saveReceiptCopy = (orderNumber: string, html: string, paperWidthMm: number, copy: boolean) =>
  bridge?.saveReceipt?.({ orderNumber, html, paperWidthMm, copy }) ?? Promise.resolve(null)

/** Reveal an order's saved PDF in Explorer — opens the folder itself when no
 *  file exists yet. Returns the path shown. */
export const openReceiptsFolder = (orderNumber?: string) =>
  bridge?.openReceipts?.(orderNumber) ?? Promise.resolve('')

// ---------- Error logs ----------

/** Fire-and-forget: append one line to logs/<category>-errors.txt. Never throws. */
export function logError(category: LogCategory, message: string) {
  try {
    console.error(`[${category}]`, message)
    void bridge?.logError?.(category, message)
  } catch {
    /* logging must never break the app */
  }
}

export const listLogs = (): Promise<LogList> =>
  bridge?.listLogs?.() ?? Promise.resolve({ dir: '', files: [] })
export const readLog = (name: string) => bridge?.readLog?.(name) ?? Promise.resolve(null)
export const clearLog = (name: string) => bridge?.clearLog?.(name) ?? Promise.resolve(false)
export const openLogsFolder = () => bridge?.openLogs?.() ?? Promise.resolve('')

export function timeAgo(ts: number): string {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} mins ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}
