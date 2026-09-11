import { useState } from 'react'
import { Check, FileDown, Printer, RotateCcw, Search } from 'lucide-react'
import { formatMoney, modsTotal } from '../data/menu'
import { exportCsv, type PlacedOrder } from '../store'
import { PAYMENT_LABEL } from '../components/OrderPanel'

const STATUS_BADGE: Record<PlacedOrder['status'], string> = {
  new: 'bg-violet-100 text-violet-600',
  ready: 'bg-sky-100 text-sky-600',
  served: 'bg-emerald-100 text-emerald-600',
  refunded: 'bg-red-100 text-red-500',
  'partial-refund': 'bg-amber-100 text-amber-600',
}

/** Accounting-friendly CSV: one row per order line, money in decimal units. */
function ordersCsv(orders: PlacedOrder[]): string {
  const cell = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = [
    'order', 'date', 'time', 'type', 'status', 'cashier', 'customer',
    'item', 'qty', 'unit_price', 'modifiers', 'line_total', 'line_tax',
    'subtotal', 'discount', 'tax', 'total', 'payments', 'tendered', 'change', 'refunded',
  ]
  const rows = orders.flatMap((o) => {
    const pays = o.payments?.length
      ? o.payments
      : [{ method: o.payment, amount: o.total, tendered: o.tendered, change: o.change }]
    const refunded = (o.refunds ?? []).reduce((s, r) => s + r.amount, 0)
    const d = new Date(o.createdAt)
    const base = [
      o.number,
      d.toLocaleDateString('en-CA'),
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      o.type,
      o.status,
      o.cashier,
      o.customer === 'Walk-in' ? '' : o.customer,
    ]
    const tail = [
      (o.subtotal / 100).toFixed(2),
      (o.discount / 100).toFixed(2),
      (o.tax / 100).toFixed(2),
      (o.total / 100).toFixed(2),
      pays.map((p) => `${p.method}:${(p.amount / 100).toFixed(2)}`).join(' '),
      (o.tendered / 100).toFixed(2),
      (o.change / 100).toFixed(2),
      refunded ? (refunded / 100).toFixed(2) : '0.00',
    ]
    return o.lines.map((l) => {
      const unit = l.price + modsTotal(l.mods)
      return [
        ...base,
        l.name,
        l.qty,
        (unit / 100).toFixed(2),
        (l.mods ?? []).map((m) => `${m.name} +${(m.price / 100).toFixed(2)}`).join(' '),
        ((unit * l.qty) / 100).toFixed(2),
        l.tax !== undefined ? (l.tax / 100).toFixed(2) : '',
        ...tail,
      ].map(cell).join(',')
    })
  })
  return [head.join(','), ...rows].join('\r\n')
}

interface Props {
  orders: PlacedOrder[]
  onRefund: (o: PlacedOrder) => void
  onReprint: (o: PlacedOrder) => void
  onAdvance: (id: string) => void
}

export default function TransactionsPage({ orders, onRefund, onReprint, onAdvance }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const visible = orders
    .filter(
      (o) =>
        o.number.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.cashier.toLowerCase().includes(q),
    )
    .sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="flex items-center justify-between pt-6">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight">Transactions</h1>
          <p className="text-[12px] font-medium text-neutral-400">
            {orders.length} orders this session
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex w-[240px] items-center gap-2.5 rounded-2xl border border-neutral-200/80 bg-white px-4 py-2.5 shadow-sm">
            <Search size={15} className="text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order, customer…"
              className="w-full bg-transparent text-[12.5px] font-medium outline-none placeholder:text-neutral-400"
            />
          </label>
          <button
            onClick={() =>
              void exportCsv(
                `khadkapos-orders-${new Date().toISOString().slice(0, 10)}.csv`,
                ordersCsv(visible),
              )
            }
            disabled={!visible.length}
            title="Save the filtered orders as CSV for accounting"
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-[12.5px] font-extrabold text-neutral-600 shadow-sm transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
          >
            <FileDown size={15} />
            Export CSV
          </button>
        </div>
      </header>

      <div className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-100 text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
              <th className="px-5 py-3.5">Order</th>
              <th className="px-5 py-3.5">Time</th>
              <th className="px-5 py-3.5">Customer</th>
              <th className="px-5 py-3.5">Type</th>
              <th className="px-5 py-3.5">Items</th>
              <th className="px-5 py-3.5">Payment</th>
              <th className="px-5 py-3.5">Total</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {visible.map((o) => {
              const refundedAmt = (o.refunds ?? []).reduce((s, r) => s + r.amount, 0)
              return (
                <tr key={o.id} className="transition-colors hover:bg-neutral-50/60">
                  <td className="px-5 py-3.5 text-[12.5px] font-extrabold">{o.number}</td>
                  <td className="px-5 py-3.5 text-[12px] font-medium text-neutral-500">
                    {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3.5 text-[12.5px] font-semibold">{o.customer}</td>
                  <td className="px-5 py-3.5 text-[11.5px] font-bold capitalize text-neutral-500">
                    {o.type.replace('-', ' ')}
                  </td>
                  <td className="px-5 py-3.5 text-[12px] font-medium text-neutral-500">
                    {o.lines.reduce((n, l) => n + l.qty, 0)}
                  </td>
                  <td className="px-5 py-3.5 text-[11.5px] font-bold capitalize text-neutral-500">
                    {o.payments && o.payments.length > 1
                      ? o.payments.map((p) => PAYMENT_LABEL[p.method]).join(' + ')
                      : PAYMENT_LABEL[o.payment] ?? o.payment}
                  </td>
                  <td className="px-5 py-3.5 text-[12.5px] font-extrabold text-primary">
                    {formatMoney(o.total)}
                    {refundedAmt > 0 && (
                      <span className="ml-1.5 text-[10px] font-bold text-red-400">
                        -{formatMoney(refundedAmt)}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-md px-2 py-1 text-[10px] font-bold capitalize ${STATUS_BADGE[o.status]}`}>
                      {o.status === 'new' ? 'waiting' : o.status === 'partial-refund' ? 'partial refund' : o.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      {(o.status === 'new' || o.status === 'ready') && (
                        <button
                          onClick={() => onAdvance(o.id)}
                          title={o.status === 'new' ? 'Mark ready' : 'Mark served'}
                          className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-emerald-300 hover:text-emerald-600"
                        >
                          <Check size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => onReprint(o)}
                        title="Reprint receipt (COPY)"
                        className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-primary hover:text-primary"
                      >
                        <Printer size={13} />
                      </button>
                      <button
                        onClick={() => onRefund(o)}
                        disabled={o.status === 'refunded'}
                        title="Refund — pick items and quantities"
                        className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <RotateCcw size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="py-12 text-center text-[12px] font-semibold text-neutral-400">
            No transactions yet — completed orders appear here
          </p>
        )}
      </div>
    </div>
  )
}
