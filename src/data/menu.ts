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

export interface MenuItem {
  id: string
  name: string
  price: Cents
  category: CategoryId
  available: boolean
  image: string
  emoji: string
}

export const MENU_ITEMS: MenuItem[] = []

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

export type Role = 'cashier' | 'kitchen' | 'manager'

export interface Staff {
  id: string
  name: string
  role: Role
  pin: string
  initials: string
  color: string
  active: boolean
  /** True for first-boot accounts — PIN is a one-time password that must be replaced. */
  mustChangePin: boolean
}

/** Fresh installs start with no staff — the manager sets up the admin account
 *  on first boot, then adds the rest of the team in Staff Management. */
export const STAFF: Staff[] = []

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
  taxRate: number
  orderPrefix: string
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
  orderPrefix: 'DNN',
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
  }
}
