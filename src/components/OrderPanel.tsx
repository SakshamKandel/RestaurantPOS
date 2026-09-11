import { useEffect, useState } from 'react'
import {
  Banknote,
  CreditCard,
  Minus,
  MoreHorizontal,
  StickyNote,
  Pause,
  Percent,
  Plus,
  Printer,
  ScanLine,
  ShoppingBag,
  Trash2,
  Vault,
  type LucideIcon,
} from 'lucide-react'
import {
  formatMoney,
  modsTotal,
  type Cents,
  type Customer,
  type MenuItem,
  type SelectedMod,
} from '../data/menu'
import type { Discount, OrderType } from '../store'

export type PaymentMethod = 'cash' | 'scan' | 'credit'

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  scan: 'Scan',
  credit: 'Credit',
}

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
  /** lineKey — unique per item+modifier combo. */
  key: string
  item: MenuItem
  qty: number
  note?: string
  mods?: SelectedMod[]
}

interface Props {
  orderNumber: string
  lines: CartLine[]
  subtotal: Cents
  discount: Cents
  tax: Cents
  total: Cents
  paymentMethod: PaymentMethod
  orderType: OrderType
  customerId: string
  customers: Customer[]
  heldCount: number
  discountInput: Discount
  orderNote: string
  onPaymentChange: (m: PaymentMethod) => void
  onTypeChange: (t: OrderType) => void
  onCustomerChange: (id: string) => void
  onLineQty: (id: string, delta: number) => void
  onLineNote: (id: string, note: string) => void
  onRemoveLine: (id: string) => void
  onClear: () => void
  onDiscountChange: (d: Discount) => void
  onOrderNote: (n: string) => void
  onHold: () => void
  onPrint: () => void
  onOrder: () => void
  drawerEnabled: boolean
  onOpenDrawer: () => void
  hasLastOrder: boolean
  onReprintLast: () => void
}

export default function OrderPanel({
  orderNumber,
  lines,
  subtotal,
  discount,
  tax,
  total,
  paymentMethod,
  orderType,
  customerId,
  customers,
  heldCount,
  discountInput,
  orderNote,
  onPaymentChange,
  onTypeChange,
  onCustomerChange,
  onLineQty,
  onLineNote,
  onRemoveLine,
  onClear,
  onDiscountChange,
  onOrderNote,
  onHold,
  onPrint,
  onOrder,
  drawerEnabled,
  onOpenDrawer,
  hasLastOrder,
  onReprintLast,
}: Props) {
  const itemCount = lines.reduce((n, l) => n + l.qty, 0)
  const customer = customers.find((c) => c.id === customerId)
  const [noteLine, setNoteLine] = useState<string | null>(null)
  const [showNote, setShowNote] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [discValue, setDiscValue] = useState('')
  const [discType, setDiscType] = useState<'percent' | 'flat'>('percent')

  useEffect(() => {
    if (!discountInput) {
      setDiscValue('')
    } else {
      setDiscType(discountInput.type)
      setDiscValue(
        discountInput.type === 'percent'
          ? String(discountInput.value)
          : (discountInput.value / 100).toFixed(2),
      )
    }
  }, [discountInput])

  const applyDiscount = () => {
    const v = parseFloat(discValue)
    if (Number.isNaN(v) || v <= 0) return onDiscountChange(null)
    onDiscountChange({ type: discType, value: discType === 'percent' ? v : Math.round(v * 100) })
  }

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
          <div className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            >
              <MoreHorizontal size={17} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 z-30 mt-1 w-48 rounded-2xl border border-neutral-100 bg-white p-2 shadow-xl">
                <button
                  onClick={() => { setMoreOpen(false); onReprintLast() }}
                  disabled={!hasLastOrder}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-bold text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Printer size={14} />
                  Reprint last receipt
                </button>
                <button
                  onClick={() => { setMoreOpen(false); onClear() }}
                  disabled={lines.length === 0}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-bold text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={14} />
                  Clear order
                </button>
              </div>
            )}
          </div>
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
          <div className="flex items-center gap-2">
            {lines.length > 0 && (
              <button
                onClick={onClear}
                className="text-[10.5px] font-bold text-neutral-400 hover:text-red-500"
              >
                Clear
              </button>
            )}
            <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-neutral-100 px-1.5 text-[10.5px] font-bold text-neutral-500">
              {itemCount}
            </span>
          </div>
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
            {lines.map(({ key, item, qty, note, mods }) => (
              <li key={key} className="py-2.5">
                <div className="group flex items-center gap-2">
                  <span className="flex items-center rounded-lg bg-neutral-100">
                    <button
                      onClick={() => onLineQty(key, -1)}
                      className="flex h-6 w-6 items-center justify-center text-neutral-500 hover:text-primary"
                    >
                      <Minus size={11} strokeWidth={3} />
                    </button>
                    <span className="w-5 text-center text-[11.5px] font-bold">{qty}</span>
                    <button
                      onClick={() => onLineQty(key, 1)}
                      className="flex h-6 w-6 items-center justify-center text-neutral-500 hover:text-primary"
                    >
                      <Plus size={11} strokeWidth={3} />
                    </button>
                  </span>
                  <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-neutral-700">
                    <span className="block truncate">{item.name}</span>
                    {mods?.map((m, i) => (
                      <span key={i} className="block truncate text-[10.5px] font-medium text-neutral-400">
                        {m.name}
                        {m.price ? ` +${formatMoney(m.price)}` : ''}
                      </span>
                    ))}
                  </span>
                  <button
                    onClick={() => setNoteLine(noteLine === key ? null : key)}
                    title="Add note (e.g. no onions)"
                    className={`rounded-md p-1 transition-colors ${note || noteLine === key ? 'text-primary' : 'text-neutral-300 hover:text-primary'}`}
                  >
                    <StickyNote size={13} />
                  </button>
                  <button
                    onClick={() => onRemoveLine(key)}
                    className="rounded-md p-1 text-neutral-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                  <span className="w-14 text-right text-[12.5px] font-extrabold">
                    {formatMoney((item.price + modsTotal(mods)) * qty)}
                  </span>
                </div>
                {(noteLine === key || note) && (
                  <input
                    autoFocus={noteLine === key}
                    value={note ?? ''}
                    onChange={(e) => onLineNote(key, e.target.value)}
                    onBlur={() => setNoteLine(null)}
                    placeholder="Note for kitchen (e.g. no onions)"
                    className="mt-1.5 w-full rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[11px] font-medium italic text-neutral-600 outline-none focus:border-primary"
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Order note */}
        <button
          onClick={() => setShowNote(!showNote)}
          className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-neutral-400 hover:text-primary"
        >
          <StickyNote size={12} />
          {orderNote || showNote ? 'Order note for kitchen' : 'Add order note'}
        </button>
        {showNote && (
          <input
            autoFocus
            value={orderNote}
            onChange={(e) => onOrderNote(e.target.value)}
            placeholder="e.g. pack sauces separately"
            className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[11.5px] font-medium outline-none focus:border-primary"
          />
        )}

        {/* Payment summary */}
        <p className="mt-4 text-[13px] font-extrabold">Payment Summary</p>
        <div className="mt-2.5 flex flex-col gap-1.5 text-[12px]">
          <div className="flex justify-between text-neutral-500">
            <span>Subtotal</span>
            <span className="font-bold text-neutral-800">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-neutral-500">
            <span className="flex items-center gap-1.5">
              Discount
              <Percent size={11} className="text-neutral-300" />
            </span>
            <span className="flex items-center gap-1.5">
              <select
                value={discType}
                onChange={(e) => setDiscType(e.target.value as 'percent' | 'flat')}
                className="cursor-pointer rounded-md border border-neutral-200 bg-white px-1 py-0.5 text-[10.5px] font-bold outline-none"
              >
                <option value="percent">%</option>
                <option value="flat">$</option>
              </select>
              <input
                value={discValue}
                onChange={(e) => setDiscValue(e.target.value)}
                onBlur={applyDiscount}
                onKeyDown={(e) => e.key === 'Enter' && applyDiscount()}
                placeholder="0"
                className="w-14 rounded-md border border-neutral-200 px-1.5 py-0.5 text-right text-[11px] font-bold outline-none focus:border-primary"
              />
              <span className="w-12 text-right font-bold text-red-500">
                {discount > 0 ? `-${formatMoney(discount)}` : '—'}
              </span>
            </span>
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
          <button
            onClick={onOpenDrawer}
            title={drawerEnabled ? 'Open cash drawer (no sale)' : 'Cash drawer is off — click to see why'}
            className={`flex w-11 items-center justify-center rounded-xl border border-neutral-200 py-2.5 transition-colors hover:border-neutral-300 hover:bg-neutral-50 ${drawerEnabled ? 'text-neutral-600' : 'text-neutral-300'}`}
          >
            <Vault size={15} />
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
