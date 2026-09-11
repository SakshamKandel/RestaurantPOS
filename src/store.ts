import {
  DEFAULT_SETTINGS,
  MENU_ITEMS,
  SEED_CATEGORIES,
  SEED_CUSTOMERS,
  STAFF,
  type Category,
  type Cents,
  type Customer,
  type MenuItem,
  type Settings,
  type Staff,
} from './data/menu'
import type { PaymentMethod } from './components/OrderPanel'

export type OrderType = 'take-away' | 'collection' | 'delivery'

export interface OrderLineSnap {
  name: string
  qty: number
  price: Cents
  note?: string
}

export type Discount = { type: 'percent' | 'flat'; value: number } | null

export type PlacedStatus = 'new' | 'ready' | 'served' | 'refunded'

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
  status: PlacedStatus
  createdAt: number
  cashier: string
}

export interface HeldOrder {
  id: string
  label: string
  type: OrderType
  customer: string
  lines: { itemId: string; qty: number; note?: string }[]
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
  float: Cents
  counted: Cents | null
  movements: DrawerMovement[]
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
  seq: 935,
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

interface PosBridge {
  loadStore: () => Promise<PosState | null>
  saveStore: (s: PosState) => Promise<boolean>
  backup: (s: PosState) => Promise<string>
  listPrinters?: () => Promise<DetectedPrinter[]>
  printDoc?: (p: { deviceName: string; html: string; paperWidthMm: number }) => Promise<PrintResult>
  pickImage?: () => Promise<string | null>
  appVersion?: () => Promise<string>
  checkUpdates?: () => Promise<unknown>
  installUpdate?: () => Promise<void>
  onUpdateAvailable?: (cb: (i: { version: string }) => void) => void
  onUpdateDownloaded?: (cb: (i: UpdateInfo) => void) => void
  onUpdateChecking?: (cb: () => void) => void
  onUpdateNone?: (cb: (i: { version: string }) => void) => void
  onUpdateError?: (cb: (i: { message: string }) => void) => void
}

const bridge = (window as unknown as { pos?: PosBridge }).pos
const LS_KEY = 'khadkapos'

export async function loadPersisted(): Promise<PosState | null> {
  try {
    if (bridge?.loadStore) return await bridge.loadStore()
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as PosState) : null
  } catch {
    return null
  }
}

export function persist(state: PosState) {
  try {
    if (bridge?.saveStore) void bridge.saveStore(state)
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

export function timeAgo(ts: number): string {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} mins ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}
