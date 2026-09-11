import {
  CakeSlice,
  Coffee,
  CupSoda,
  Drumstick,
  Fish,
  IceCreamBowl,
  Leaf,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

/** Money is always integer minor units (cents) — never floats. */
export type Cents = number

export const TAX_RATE = 0.1

export function formatMoney(cents: Cents): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export type CategoryId = string

/** Named icons so categories stay serializable in the persisted store. */
export type IconName =
  | 'soup' | 'ramen' | 'sushi' | 'beverages' | 'salad' | 'dessert'
  | 'coffee' | 'pizza' | 'sandwich' | 'drumstick' | 'leaf' | 'cake'

export const ICONS: Record<IconName, LucideIcon> = {
  soup: Soup,
  ramen: UtensilsCrossed,
  sushi: Fish,
  beverages: CupSoda,
  salad: Salad,
  dessert: IceCreamBowl,
  coffee: Coffee,
  pizza: Pizza,
  sandwich: Sandwich,
  drumstick: Drumstick,
  leaf: Leaf,
  cake: CakeSlice,
}

export const ICON_NAMES = Object.keys(ICONS) as IconName[]

export interface Category {
  id: CategoryId
  label: string
  icon: IconName
}

/** Fresh installs start with no categories — the manager creates their own
 *  in Menu → Categories before adding items. */
export const SEED_CATEGORIES: Category[] = []

// ---------- Modifiers / add-ons ----------

export interface ModifierOption {
  id: string
  name: string
  /** Price adjustment in cents — can be 0. */
  price: Cents
}

export interface ModifierGroup {
  id: string
  name: string // e.g. "Size", "Extras"
  required: boolean // at least one option must be picked
  multi: boolean // multi-select (checkboxes) vs single-select (radio)
  options: ModifierOption[]
}

/** A modifier choice snapped onto an order line — flattened for display. */
export interface SelectedMod {
  group: string
  name: string
  price: Cents
}

export interface MenuItem {
  id: string
  name: string
  price: Cents
  category: CategoryId
  available: boolean
  image: string
  emoji: string
  modifiers?: ModifierGroup[]
  /** Tax class id into Settings.taxClasses; absent = default rate. */
  taxClass?: string
  /** Unit cost (COGS) in cents — powers the margin report. */
  cost?: Cents
  /** Stock tracking: undefined = not tracked (unlimited). */
  stock?: number
  lowStockAt?: number
}

export const MENU_ITEMS: MenuItem[] = []

/** Stable key for a cart line: the same item with different modifiers is a
 *  different line, so a "Large" never merges into a "Small". */
export const lineKey = (itemId: string, mods?: SelectedMod[]) =>
  mods?.length
    ? `${itemId}|${mods.map((m) => `${m.group}:${m.name}`).sort().join(',')}`
    : itemId

/** Sum of modifier price adjustments on one line (per unit). */
export const modsTotal = (mods?: SelectedMod[]) =>
  mods?.reduce((s, m) => s + m.price, 0) ?? 0

export type OrderStatus = 'waiting' | 'ready' | 'served'

export interface LineOrder {
  number: string
  tag: string
  item: string
  qty: number
  time: string
  status: OrderStatus
}

export const ORDER_FILTERS: { id: OrderStatus | 'all'; label: string; dot: string }[] = [
  { id: 'all', label: 'All', dot: 'bg-primary' },
  { id: 'waiting', label: 'Waiting', dot: 'bg-violet-500' },
  { id: 'ready', label: 'Ready', dot: 'bg-sky-500' },
  { id: 'served', label: 'Served', dot: 'bg-emerald-500' },
]

export const LINE_ORDERS: LineOrder[] = []

// ---------- Staff & roles ----------

/** 'admin' is the hidden owner account — never stored in the staff list. */
export type Role = 'cashier' | 'kitchen' | 'manager' | 'admin'

export interface Staff {
  id: string
  name: string
  role: Role
  /** Plaintext only transiently (new account / reset) until the next save
   *  hashes it in the main process; '' afterwards. See `hasPin`. */
  pin: string
  hasPin?: boolean
  initials: string
  color: string
  active: boolean
  /** True for first-boot accounts — PIN is a one-time password that must be replaced. */
  mustChangePin: boolean
}

/** Fresh installs start with no staff — the manager sets up the admin account
 *  on first boot, then adds the rest of the team in Staff Management. */
export const STAFF: Staff[] = []

/** Hidden owner account. Not in the staff list — reached from the
 *  "Administrator" link on the login screen. Can manage managers and staff,
 *  and is the recovery path when a manager forgets their PIN.
 *  On desktop the real PIN is a salted hash in SQLite (default 8865, changeable
 *  from the Staff page); `pin` here is only the browser-preview fallback. */
export const SUPER_ADMIN: Staff = {
  id: 'super-admin',
  name: 'Administrator',
  role: 'admin',
  pin: '8865',
  initials: 'SA',
  color: 'from-neutral-700 to-neutral-900',
  active: true,
  mustChangePin: false,
}

/** Who may administer whom. Admin outranks managers; managers only handle
 *  front-line staff; nobody administers themselves. */
export const canManage = (actor: Role, target: Role) =>
  actor === 'admin' ? target !== 'admin' : actor === 'manager' ? target === 'cashier' || target === 'kitchen' : false

/** Roles an actor is allowed to assign when creating/editing accounts. */
export const assignableRoles = (actor: Role): Role[] =>
  actor === 'admin' ? ['cashier', 'kitchen', 'manager'] : actor === 'manager' ? ['cashier', 'kitchen'] : []

/** Managers and the hidden admin share the manager UI surface. */
export const isManagerial = (r: Role) => r === 'manager' || r === 'admin'

// ---------- Customers ----------

export interface Customer {
  id: string
  name: string
  phone: string
  visits: number
  spent: Cents
}

export const SEED_CUSTOMERS: Customer[] = [
  { id: 'c5', name: 'Walk-in', phone: '-', visits: 0, spent: 0 },
]

// ---------- Settings ----------

export interface Settings {
  // Store identity
  restaurantName: string
  legalName: string
  address: string
  phone: string
  email: string
  website: string
  taxId: string
  receiptFooter: string
  // Tax & numbering
  taxRate: number // fallback/default rate for items without a taxClass
  taxClasses: TaxClass[] // per-item tax classes (item.taxClass → id)
  orderPrefix: string
  /** Hour (0–6) when the business day rolls over for reporting; e.g. 4 =
   *  sales before 4am count toward the previous day. 0 = calendar days. */
  businessDayCutoff: number
  // Hardware — printer names are Windows device names ('' = not assigned).
  // Both roles may point at the same physical printer (single-printer shops).
  kitchenEnabled: boolean
  kitchenPrinter: string
  kitchenPaper: PaperWidth
  billingEnabled: boolean
  billingPrinter: string
  billingPaper: PaperWidth
  billingAutoPrint: boolean // print a receipt for every sale vs. on demand
  cashDrawer: boolean // drawer plugged into the billing printer's RJ11 port
  drawerOnCash: boolean
  drawerPin: 0 | 1 // ESC/POS pulse pin: 0 = pin 2 (most drawers), 1 = pin 5
}

export type PaperWidth = '58' | '80'

/** A named tax rate — items reference it via MenuItem.taxClass. */
export interface TaxClass {
  id: string
  name: string
  rate: number
}

export const DEFAULT_TAX_CLASSES: TaxClass[] = [
  { id: 'std', name: 'Standard', rate: 0.095 },
  { id: 'exempt', name: 'Exempt / Zero-rated', rate: 0 },
]

export const DEFAULT_SETTINGS: Settings = {
  restaurantName: 'Khadka Kitchen',
  legalName: 'Khadka Kitchen LLC',
  address: '742 Sunset Blvd, Los Angeles, CA 90046',
  phone: '+1 (323) 555-0147',
  email: 'hello@Khadka.com',
  website: 'www.Khadka.com',
  taxId: 'EIN 12-3456789',
  receiptFooter: 'Thank you, please come again!',
  taxRate: 0.095, // US sales tax (CA combined rate); editable per state
  taxClasses: DEFAULT_TAX_CLASSES,
  orderPrefix: 'DNN',
  businessDayCutoff: 0,
  kitchenEnabled: true,
  kitchenPrinter: '',
  kitchenPaper: '80',
  billingEnabled: true,
  billingPrinter: '',
  billingPaper: '80',
  billingAutoPrint: true,
  cashDrawer: false,
  drawerOnCash: true,
  drawerPin: 0,
}

/** Bring a stored settings object (possibly from an older version) up to the
 *  current schema. Only ever adds/renames fields — never drops user data. */
export function migrateSettings(input: Partial<Settings>): Settings {
  const raw = input as Partial<Settings> & { paperWidth?: PaperWidth }
  const legacyPaper = raw.paperWidth ?? '80'
  const isFake = (n: unknown) => typeof n === 'string' && /^Epson TM-T(20III|88V) Thermal/.test(n)
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    // pre-0.4 stores carried demo printer names that never existed on the PC
    kitchenPrinter: isFake(raw.kitchenPrinter) ? '' : (raw.kitchenPrinter ?? ''),
    billingPrinter: isFake(raw.billingPrinter) ? '' : (raw.billingPrinter ?? ''),
    kitchenPaper: raw.kitchenPaper ?? legacyPaper,
    billingPaper: raw.billingPaper ?? legacyPaper,
    taxClasses:
      Array.isArray(raw.taxClasses) && raw.taxClasses.length
        ? raw.taxClasses
        : DEFAULT_TAX_CLASSES.map((c) => ({ ...c, rate: c.id === 'std' ? (raw.taxRate ?? c.rate) : c.rate })),
  }
}
