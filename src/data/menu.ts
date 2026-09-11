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

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=80`

export const MENU_ITEMS: MenuItem[] = [
  // Soup
  { id: 'miso-soup', name: 'Miso Soup', price: 350, category: 'soup', available: true, image: img('photo-1547592166-23ac45744acd'), emoji: '🍲' },
  { id: 'wakame-soup', name: 'Wakame Soup', price: 380, category: 'soup', available: true, image: img('photo-1547592180-85f173990554'), emoji: '🥣' },
  { id: 'tonjiru', name: 'Tonjiru Pork Soup', price: 450, category: 'soup', available: true, image: img('photo-1547592166-23ac45744acd'), emoji: '🍜' },
  { id: 'clear-soup', name: 'Clear Dashi Soup', price: 300, category: 'soup', available: false, image: img('photo-1547592180-85f173990554'), emoji: '🥣' },
  // Ramen
  { id: 'chicken-ramen', name: 'Chicken Ramen', price: 1100, category: 'ramen', available: true, image: img('photo-1569718212165-3a8278d5f624'), emoji: '🍜' },
  { id: 'miso-ramen', name: 'Miso Ramen', price: 1050, category: 'ramen', available: true, image: img('photo-1557872943-16a5ac26437e'), emoji: '🍜' },
  { id: 'tonkotsu-ramen', name: 'Tonkotsu Ramen', price: 1250, category: 'ramen', available: true, image: img('photo-1591814468924-caf88d1232e1'), emoji: '🍜' },
  { id: 'shoyu-ramen', name: 'Shoyu Ramen', price: 1150, category: 'ramen', available: true, image: img('photo-1569718212165-3a8278d5f624'), emoji: '🍜' },
  { id: 'tantan-ramen', name: 'Spicy TanTan', price: 1200, category: 'ramen', available: true, image: img('photo-1557872943-16a5ac26437e'), emoji: '🌶️' },
  { id: 'veggie-ramen', name: 'Veggie Ramen', price: 980, category: 'ramen', available: false, image: img('photo-1591814468924-caf88d1232e1'), emoji: '🥬' },
  // Sushi
  { id: 'tamago-nigiri', name: 'Tamago Nigiri', price: 625, category: 'sushi', available: true, image: img('photo-1611143669185-af224c5e3252'), emoji: '🍣' },
  { id: 'ebi-nigiri', name: 'Ebi Nigiri', price: 700, category: 'sushi', available: true, image: img('photo-1579871494447-9811cf80d66c'), emoji: '🍤' },
  { id: 'tuna-nigiri', name: 'Tuna Nigiri', price: 950, category: 'sushi', available: true, image: img('photo-1553621042-f6e147245754'), emoji: '🍣' },
  { id: 'salmon-nigiri', name: 'Salmon Nigiri', price: 850, category: 'sushi', available: true, image: img('photo-1579871494447-9811cf80d66c'), emoji: '🍣' },
  { id: 'california-roll', name: 'California Roll', price: 780, category: 'sushi', available: true, image: img('photo-1579584425555-c3ce17fd4351'), emoji: '🍱' },
  { id: 'unagi-maki', name: 'Unagi Maki', price: 920, category: 'sushi', available: false, image: img('photo-1617196034796-73dfa7b1fd56'), emoji: '🍣' },
  // Beverages
  { id: 'matcha-latte', name: 'Matcha Latte', price: 400, category: 'beverages', available: true, image: img('photo-1536013455962-2b8e7d8f2c0e'), emoji: '🍵' },
  { id: 'ramune', name: 'Ramune Soda', price: 320, category: 'beverages', available: true, image: img('photo-1437418747212-8d9709afab22'), emoji: '🥤' },
  { id: 'green-tea', name: 'Green Tea', price: 250, category: 'beverages', available: true, image: img('photo-1564890369478-c89ca6d9cde9'), emoji: '🍵' },
  { id: 'yuzu-soda', name: 'Yuzu Soda', price: 420, category: 'beverages', available: true, image: img('photo-1437418747212-8d9709afab22'), emoji: '🍋' },
]

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

export const LINE_ORDERS: LineOrder[] = [
  { number: 'F0027', tag: 'Take Away', item: 'Chicken Ramen', qty: 2, time: '2 mins ago', status: 'waiting' },
  { number: 'F0012', tag: 'Collection', item: 'Miso Ramen', qty: 1, time: 'Just now', status: 'waiting' },
  { number: 'F0034', tag: 'Take Away', item: 'Tempura Udon', qty: 1, time: '4 mins ago', status: 'ready' },
  { number: 'F0041', tag: 'Delivery', item: 'Salmon Nigiri', qty: 3, time: '6 mins ago', status: 'ready' },
  { number: 'F0019', tag: 'Take Away', item: 'Shoyu Ramen', qty: 2, time: '8 mins ago', status: 'served' },
  { number: 'F0050', tag: 'Delivery', item: 'California Roll', qty: 1, time: '10 mins ago', status: 'served' },
]

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

export const STAFF: Staff[] = [
  { id: 's2', name: 'Rina Sato', role: 'manager', pin: '0000', initials: 'RS', color: 'from-violet-400 to-purple-600', active: true, mustChangePin: true },
  { id: 's1', name: 'Gilang Febrian', role: 'cashier', pin: '1234', initials: 'GF', color: 'from-amber-400 to-orange-500', active: true, mustChangePin: false },
  { id: 's3', name: 'Kenji Mori', role: 'kitchen', pin: '5555', initials: 'KM', color: 'from-emerald-400 to-teal-600', active: true, mustChangePin: false },
]

// ---------- Customers ----------

export interface Customer {
  id: string
  name: string
  phone: string
  visits: number
  spent: Cents
}

export const SEED_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Haaland Joy', phone: '+1 (415) 555-0132', visits: 14, spent: 18650 },
  { id: 'c2', name: 'Aiko Tanaka', phone: '+1 (415) 555-0177', visits: 9, spent: 12400 },
  { id: 'c3', name: 'Brian Santos', phone: '+1 (628) 555-0119', visits: 22, spent: 30120 },
  { id: 'c4', name: 'Mina Kobayashi', phone: '+1 (628) 555-0145', visits: 6, spent: 7310 },
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
  restaurantName: 'Tabetei Japanese Kitchen',
  legalName: 'Tabetei Kitchen LLC',
  address: '742 Sunset Blvd, Los Angeles, CA 90046',
  phone: '+1 (323) 555-0147',
  email: 'hello@tabetei.com',
  website: 'www.tabetei.com',
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
