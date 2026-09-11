import { Banknote, CreditCard, Receipt, ScanLine, ShoppingBag, TrendingUp } from 'lucide-react'
import { formatMoney } from '../data/menu'
import type { PlacedOrder } from '../store'

interface Props {
  orders: PlacedOrder[]
}

export default function ReportPage({ orders }: Props) {
  const valid = orders.filter((o) => o.status !== 'refunded')
  const gross = valid.reduce((s, o) => s + o.total, 0)
  const tax = valid.reduce((s, o) => s + o.tax, 0)
  const refunded = orders.filter((o) => o.status === 'refunded').reduce((s, o) => s + o.total, 0)
  const avg = valid.length ? Math.round(gross / valid.length) : 0

  const byTender = (m: PlacedOrder['payment']) =>
    valid.filter((o) => o.payment === m).reduce((s, o) => s + o.total, 0)

  // sales by hour
  const hours = new Map<number, number>()
  valid.forEach((o) => {
    const h = new Date(o.createdAt).getHours()
    hours.set(h, (hours.get(h) ?? 0) + o.total)
  })
  const hourRange = Array.from({ length: 13 }, (_, i) => i + 9) // 9:00–21:00
  const maxHour = Math.max(1, ...hourRange.map((h) => hours.get(h) ?? 0))

  // top items
  const itemCount = new Map<string, { qty: number; revenue: number }>()
  valid.forEach((o) =>
    o.lines.forEach((l) => {
      const e = itemCount.get(l.name) ?? { qty: 0, revenue: 0 }
      itemCount.set(l.name, { qty: e.qty + l.qty, revenue: e.revenue + l.qty * l.price })
    }),
  )
  const top = [...itemCount.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5)
  const maxQty = Math.max(1, ...top.map(([, v]) => v.qty))

  const stats = [
    { label: 'Gross Sales', value: formatMoney(gross), icon: TrendingUp, tint: 'bg-emerald-100 text-emerald-600' },
    { label: 'Orders', value: String(valid.length), icon: ShoppingBag, tint: 'bg-sky-100 text-sky-600' },
    { label: 'Avg. Order', value: formatMoney(avg), icon: Receipt, tint: 'bg-violet-100 text-violet-600' },
    { label: 'Tax Collected', value: formatMoney(tax), icon: Receipt, tint: 'bg-amber-100 text-amber-600' },
    { label: 'Refunded', value: formatMoney(refunded), icon: Receipt, tint: 'bg-red-100 text-red-500' },
  ]

  const tenders = [
    { label: 'Cash', value: byTender('cash'), icon: Banknote },
    { label: 'Scan / QR', value: byTender('scan'), icon: ScanLine },
    { label: 'Card', value: byTender('credit'), icon: CreditCard },
  ]

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="pt-6">
        <h1 className="text-[20px] font-extrabold tracking-tight">Today's Report</h1>
        <p className="text-[12px] font-medium text-neutral-400">
          {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} · Register 01
        </p>
      </header>

      <div className="mt-5 grid grid-cols-5 gap-3.5">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-2xl bg-white p-4 shadow-sm">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.tint}`}>
                <Icon size={15} />
              </span>
              <p className="mt-3 text-[17px] font-extrabold">{s.value}</p>
              <p className="text-[11px] font-medium text-neutral-400">{s.label}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        {/* Sales by hour */}
        <div className="col-span-2 rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-[13px] font-extrabold">Sales by Hour</p>
          <div className="mt-4 flex h-40 items-end gap-2">
            {hourRange.map((h) => {
              const v = hours.get(h) ?? 0
              return (
                <div key={h} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[9px] font-bold text-neutral-400">
                    {v > 0 ? formatMoney(v) : ''}
                  </span>
                  <div
                    className={`w-full rounded-t-lg ${v > 0 ? 'bg-primary' : 'bg-neutral-100'}`}
                    style={{ height: `${Math.max(4, (v / maxHour) * 100)}%` }}
                  />
                  <span className="text-[9.5px] font-bold text-neutral-400">{h}h</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tender split */}
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-[13px] font-extrabold">Tender Totals</p>
          <div className="mt-4 flex flex-col gap-3">
            {tenders.map((t) => {
              const Icon = t.icon
              const pct = gross ? Math.round((t.value / gross) * 100) : 0
              return (
                <div key={t.label}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 font-bold text-neutral-600">
                      <Icon size={14} className="text-neutral-400" />
                      {t.label}
                    </span>
                    <span className="font-extrabold">{formatMoney(t.value)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 rounded-2xl bg-neutral-50 p-3.5 text-center">
            <p className="text-[10.5px] font-bold text-neutral-400">OPEN ORDERS</p>
            <p className="text-[18px] font-extrabold">
              {valid.filter((o) => o.status !== 'served').length}
            </p>
          </div>
        </div>
      </div>

      {/* Top items */}
      <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-[13px] font-extrabold">Top Items</p>
        <div className="mt-4 flex flex-col gap-3">
          {top.length === 0 && (
            <p className="py-6 text-center text-[12px] font-semibold text-neutral-400">
              No sales yet today
            </p>
          )}
          {top.map(([name, v], i) => (
            <div key={name} className="flex items-center gap-3">
              <span className="w-5 text-[12px] font-extrabold text-neutral-300">{i + 1}</span>
              <span className="w-44 truncate text-[12.5px] font-bold">{name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-primary"
                  style={{ width: `${(v.qty / maxQty) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-[11.5px] font-bold text-neutral-500">{v.qty}x</span>
              <span className="w-16 text-right text-[12px] font-extrabold">{formatMoney(v.revenue)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
