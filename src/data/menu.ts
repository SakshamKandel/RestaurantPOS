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

export const SEED_CATEGORIES: Category[] = [
  { id: 'soup', label: 'Soup', icon: 'soup' },
  { id: 'ramen', label: 'Ramen', icon: 'ramen' },
  { id: 'sushi', label: 'Sushi', icon: 'sushi' },
  { id: 'beverages', label: 'Beverages', icon: 'beverages' },
]

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
  // Hardware
  kitchenPrinter: string
  kitchenAddress: string
  billingPrinter: string
  billingAddress: string
  paperWidth: '58' | '80'
  cashDrawer: boolean
  drawerOnCash: boolean
}

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
  kitchenPrinter: 'Epson TM-T20III Thermal (Kitchen)',
  kitchenAddress: 'USB003 · 192.168.1.40:9100',
  billingPrinter: 'Epson TM-T88V Thermal (Billing)',
  billingAddress: 'USB001 · 192.168.1.41:9100',
  paperWidth: '80',
  cashDrawer: true,
  drawerOnCash: true,
}
