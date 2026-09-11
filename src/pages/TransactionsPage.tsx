import { useState } from 'react'
import { Check, Printer, RotateCcw, Search } from 'lucide-react'
import { formatMoney } from '../data/menu'
import type { PlacedOrder } from '../store'

const STATUS_BADGE: Record<PlacedOrder['status'], string> = {
  new: 'bg-violet-100 text-violet-600',
  ready: 'bg-sky-100 text-sky-600',
  served: 'bg-emerald-100 text-emerald-600',
  refunded: 'bg-red-100 text-red-500',
}

interface Props {
  orders: PlacedOrder[]
  onRefund: (id: string) => void
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
        <label className="flex w-[260px] items-center gap-2.5 rounded-2xl border border-neutral-200/80 bg-white px-4 py-2.5 shadow-sm">
          <Search size={15} className="text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order, customer…"
            className="w-full bg-transparent text-[12.5px] font-medium outline-none placeholder:text-neutral-400"
          />
        </label>
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
            {visible.map((o) => (
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
                <td className="px-5 py-3.5 text-[11.5px] font-bold capitalize text-neutral-500">{o.payment}</td>
                <td className="px-5 py-3.5 text-[12.5px] font-extrabold text-primary">
                  {formatMoney(o.total)}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-md px-2 py-1 text-[10px] font-bold capitalize ${STATUS_BADGE[o.status]}`}>
                    {o.status === 'new' ? 'waiting' : o.status}
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
                      onClick={() => onRefund(o.id)}
                      disabled={o.status === 'refunded'}
                      title="Refund order"
                      className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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
