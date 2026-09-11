import {
  DEFAULT_SETTINGS,
  MENU_ITEMS,
  SEED_CUSTOMERS,
  type Cents,
  type Customer,
  type MenuItem,
  type Settings,
} from './data/menu'
import type { PaymentMethod } from './components/OrderPanel'

export type OrderType = 'take-away' | 'collection' | 'delivery'

export interface OrderLineSnap {
  name: string
  qty: number
  price: Cents
}

export type PlacedStatus = 'new' | 'ready' | 'served' | 'refunded'

export interface PlacedOrder {
  id: string
  number: string
  type: OrderType
  customer: string
  lines: OrderLineSnap[]
  subtotal: Cents
  tax: Cents
  total: Cents
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
  lines: { itemId: string; qty: number }[]
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
  settings: Settings
  seq: number
  shifts: Shift[]
  audit: AuditEvent[]
}

export const initialState: PosState = {
  orders: [],
  held: [],
  customers: SEED_CUSTOMERS,
  printJobs: [],
  menu: MENU_ITEMS,
  settings: DEFAULT_SETTINGS,
  seq: 935,
  shifts: [],
  audit: [],
}

// ---------- Persistence (Electron IPC, localStorage fallback) ----------

interface PosBridge {
  loadStore: () => Promise<PosState | null>
  saveStore: (s: PosState) => Promise<boolean>
  backup: (s: PosState) => Promise<string>
}

const bridge = (window as unknown as { pos?: PosBridge }).pos
const LS_KEY = 'tabetei-pos'

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

export function timeAgo(ts: number): string {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} mins ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}
