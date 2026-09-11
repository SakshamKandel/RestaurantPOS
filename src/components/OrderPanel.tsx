import {
  Banknote,
  CreditCard,
  MoreHorizontal,
  Pause,
  Printer,
  ScanLine,
  ShoppingBag,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import {
  formatMoney,
  type Cents,
  type Customer,
  type MenuItem,
} from '../data/menu'
import type { OrderType } from '../store'

export type PaymentMethod = 'cash' | 'scan' | 'credit'

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'credit', label: 'Credit', icon: CreditCard },
]

const ORDER_TYPES: { id: OrderType; label: string }[] = [
  { id: 'take-away', label: 'Take Away' },
  { id: 'collection', label: 'Collection' },
  { id: 'delivery', label: 'Delivery' },
]

export interface CartLine {
  item: MenuItem
  qty: number
}

interface Props {
  orderNumber: string
  lines: CartLine[]
  subtotal: Cents
  tax: Cents
  total: Cents
  paymentMethod: PaymentMethod
  orderType: OrderType
  customerId: string
  customers: Customer[]
  heldCount: number
  onPaymentChange: (m: PaymentMethod) => void
  onTypeChange: (t: OrderType) => void
  onCustomerChange: (id: string) => void
  onRemoveLine: (id: string) => void
  onHold: () => void
  onPrint: () => void
  onOrder: () => void
}

export default function OrderPanel({
  orderNumber,
  lines,
  subtotal,
  tax,
  total,
  paymentMethod,
  orderType,
  customerId,
  customers,
  heldCount,
  onPaymentChange,
  onTypeChange,
  onCustomerChange,
  onRemoveLine,
  onHold,
  onPrint,
  onOrder,
}: Props) {
  const itemCount = lines.reduce((n, l) => n + l.qty, 0)
  const customer = customers.find((c) => c.id === customerId)

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-neutral-200/70 bg-white">
      {/* Customer header */}
      <div className="border-b border-neutral-100 px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-[13px] font-extrabold text-primary">
            {(customer?.name ?? 'W')
              .split(' ')
              .map((w) => w[0])
              .join('')}
          </span>
          <div className="min-w-0 flex-1">
            <select
              value={customerId}
              onChange={(e) => onCustomerChange(e.target.value)}
              className="w-full cursor-pointer truncate bg-transparent text-[14px] font-extrabold outline-none"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] font-medium text-neutral-400">
              Order {orderNumber}
            </p>
          </div>
          <button className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700">
            <MoreHorizontal size={17} />
          </button>
        </div>

        {/* Order type */}
        <div className="mt-3.5 flex rounded-xl bg-neutral-100 p-1">
          {ORDER_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => onTypeChange(t.id)}
              className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors ${
                orderType === t.id
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ordered items */}
      <div className="thin-scroll flex-1 overflow-y-auto px-5">
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[13px] font-extrabold">Ordered Items</p>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-neutral-100 px-1.5 text-[10.5px] font-bold text-neutral-500">
            {itemCount}
          </span>
        </div>

        {lines.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-200 py-8 text-center">
            <ShoppingBag size={22} className="mx-auto text-neutral-300" />
            <p className="mt-2 text-[12px] font-semibold text-neutral-400">
              No items yet — tap a dish to add it
            </p>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
            {lines.map(({ item, qty }) => (
              <li key={item.id} className="group flex items-center gap-2 py-2.5">
                <span className="w-7 text-[11.5px] font-bold text-neutral-400">
                  {qty}x
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-neutral-700">
                  {item.name}
                </span>
                <button
                  onClick={() => onRemoveLine(item.id)}
                  className="rounded-md p-1 text-neutral-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 size={13} />
                </button>
                <span className="w-14 text-right text-[12.5px] font-extrabold">
                  {formatMoney(item.price * qty)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Payment summary */}
        <p className="mt-5 text-[13px] font-extrabold">Payment Summary</p>
        <div className="mt-2.5 flex flex-col gap-1.5 text-[12px]">
          <div className="flex justify-between text-neutral-500">
            <span>Subtotal</span>
            <span className="font-bold text-neutral-800">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-neutral-500">
            <span>Tax</span>
            <span className="font-bold text-neutral-800">{formatMoney(tax)}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-neutral-200 px-3.5 py-2.5">
          <span className="text-[12.5px] font-bold text-neutral-500">Total</span>
          <span className="text-[16px] font-extrabold">{formatMoney(total)}</span>
        </div>

        {/* Payment method */}
        <p className="mt-5 text-[13px] font-extrabold">Payment Method</p>
        <div className="mt-2.5 flex gap-2 pb-2">
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon
            const isActive = paymentMethod === m.id
            return (
              <button
                key={m.id}
                onClick={() => onPaymentChange(m.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-[11px] font-bold transition-colors ${
                  isActive
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                }`}
              >
                <Icon size={14} strokeWidth={2.3} />
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2.5 border-t border-neutral-100 px-5 py-4">
        <div className="flex gap-2.5">
          <button
            onClick={onHold}
            disabled={lines.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 py-2.5 text-[12.5px] font-bold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pause size={15} />
            Hold{heldCount > 0 ? ` (${heldCount})` : ''}
          </button>
          <button
            onClick={onPrint}
            disabled={lines.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 py-2.5 text-[12.5px] font-bold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer size={15} />
            Print
          </button>
        </div>
        <button
          onClick={onOrder}
          disabled={lines.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[13.5px] font-extrabold text-white shadow-lg shadow-orange-500/30 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <ShoppingBag size={16} strokeWidth={2.4} />
          Order · {formatMoney(total)}
        </button>
      </div>
    </aside>
  )
}
