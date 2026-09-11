import { useMemo, useState } from 'react'
import {
  BadgePercent,
  Banknote,
  Coins,
  CreditCard,
  FileDown,
  PiggyBank,
  Receipt,
  RotateCcw,
  ScanLine,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import {
  formatMoney,
  modsTotal,
  type Category,
  type CategoryId,
  type MenuItem,
  type Settings,
} from '../data/menu'
import { exportCsv, type OrderLineSnap, type OrderType, type PlacedOrder } from '../store'

/** Payment components of an order — split-aware, legacy-fallback. */
const paymentsOf = (o: PlacedOrder) =>
  o.payments?.length ? o.payments : [{ method: o.payment, amount: o.total, tendered: o.tendered, change: o.change }]

const TYPE_LABEL: Record<OrderType, string> = {
  'take-away': 'Take Away',
  collection: 'Collection',
  delivery: 'Delivery',
}
const DAY = 86_400_000

type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'all' | 'custom'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
]

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

interface Range {
  from: number
  to: number
  label: string
  days: number
}

/* ------------------------------------------------------------------ */
/*  CSV export — one summary block + tender / type / category / staff   */
/* ------------------------------------------------------------------ */

interface BreakRow {
  label: string
  orders?: number
  units?: number
  net: number
  cogs?: number
}

function reportCsv(
  range: Range,
  inRange: PlacedOrder[],
  refundsInRange: number,
  tenders: { label: string; value: number }[],
  taxRows: { name: string; rate: number; amount: number }[],
  byType: BreakRow[],
  byCat: BreakRow[],
  byStaff: BreakRow[],
  cogs: number,
): string {
  const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const money = (c: number) => (c / 100).toFixed(2)
  const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0)
  const gross = sum(inRange, (o) => o.total)
  const net = gross - refundsInRange
  const out: string[] = []
  out.push('KhadkaPOS Sales Report')
  out.push(`range,${cell(range.label)}`)
  out.push(`generated,${new Date().toISOString()}`)
  out.push('')
  out.push('metric,value')
  out.push(`orders,${inRange.length}`)
  out.push(`gross_sales,${money(gross)}`)
  out.push(`refunds,${money(refundsInRange)}`)
  out.push(`net_sales,${money(net)}`)
  out.push(`tax_collected,${money(sum(inRange, (o) => o.tax))}`)
  out.push(`discounts,${money(sum(inRange, (o) => o.discount))}`)
  out.push(`avg_order,${money(inRange.length ? Math.round(net / inRange.length) : 0)}`)
  if (cogs > 0) {
    out.push(`cogs,${money(cogs)}`)
    out.push(`gross_margin,${money(net - cogs)}`)
    out.push(`margin_pct,${net > 0 ? (((net - cogs) / net) * 100).toFixed(1) : '0'}%`)
  }
  out.push('')
  out.push('tender,amount')
  tenders.forEach((t) => out.push(`${t.label.toLowerCase()},${money(t.value)}`))
  out.push('')
  out.push('tax_class,rate,amount')
  taxRows.forEach((t) => out.push(`${cell(t.name)},${(t.rate * 100).toFixed(2)}%,${money(t.amount)}`))
  out.push('')
  out.push('order_type,orders,net')
  byType.forEach((r) => out.push(`${cell(r.label)},${r.orders ?? 0},${money(r.net)}`))
  out.push('')
  out.push('category,units,net,cogs,margin')
  byCat.forEach((r) =>
    out.push(`${cell(r.label)},${r.units ?? 0},${money(r.net)},${r.cogs !== undefined ? money(r.cogs) : ''},${r.cogs !== undefined ? money(r.net - r.cogs) : ''}`),
  )
  out.push('')
  out.push('staff,orders,net')
  byStaff.forEach((r) => out.push(`${cell(r.label)},${r.orders ?? 0},${money(r.net)}`))
  return out.join('\r\n')
}

/* ------------------------------------------------------------------ */
/*  Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, sub, icon: Icon, tint }: { label: string; value: string; sub?: string; icon: LucideIcon; tint: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tint}`}>
        <Icon size={15} />
      </span>
      <p className="mt-3 text-[17px] font-extrabold">{value}</p>
      <p className="text-[11px] font-medium text-neutral-400">
        {label}
        {sub ? <span className="text-neutral-300"> · {sub}</span> : null}
      </p>
    </div>
  )
}

function Breakdown({ title, icon: Icon, rows, empty }: { title: string; icon: LucideIcon; rows: { label: string; sub?: string; amount: number; extra?: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.amount))
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-[13px] font-extrabold">
        <Icon size={15} className="text-primary" /> {title}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {rows.length === 0 && <p className="py-5 text-center text-[12px] font-semibold text-neutral-400">{empty}</p>}
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-[12px]">
              <span className="truncate font-bold text-neutral-600">{r.label}</span>
              <span className="shrink-0 font-extrabold">
                {formatMoney(r.amount)}
                {r.extra ? <span className="ml-1.5 text-[10px] font-bold text-neutral-400">{r.extra}</span> : null}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(r.amount / max) * 100}%` }} />
              </div>
              {r.sub ? <span className="w-14 text-right text-[10px] font-bold text-neutral-400">{r.sub}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

interface Props {
  orders: PlacedOrder[]
  menu: MenuItem[]
  categories: Category[]
  settings: Settings
}

export default function ReportPage({ orders, menu, categories, settings }: Props) {
  const [preset, setPreset] = useState<Preset>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [trendMode, setTrendMode] = useState<'auto' | 'hours'>('auto')
  const [topBy, setTopBy] = useState<'qty' | 'revenue'>('qty')

  // Business-day cutoff: sales before this hour belong to the previous day.
  const cutoffH = Math.min(23, Math.max(0, settings.businessDayCutoff ?? 0))
  const cutoffMs = cutoffH * 3600_000
  /** Local midnight of the business day a timestamp belongs to. */
  const bizDateOf = (ts: number) => {
    const d = new Date(ts - cutoffMs)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const bizStart = (d: Date) => d.getTime() + cutoffMs
  const todayBiz = bizDateOf(Date.now())

  const range: Range = useMemo(() => {
    const mk = (from: number, to: number, label: string): Range => ({
      from,
      to,
      label,
      days: Math.max(1, Math.round((to - from) / DAY)),
    })
    const t0 = bizStart(todayBiz)
    switch (preset) {
      case 'today':
        return mk(t0, t0 + DAY, cutoffH ? `Today (business day from ${todayBiz.toLocaleDateString([], { month: 'short', day: 'numeric' })})` : 'Today')
      case 'yesterday':
        return mk(t0 - DAY, t0, 'Yesterday')
      case '7d':
        return mk(t0 - 6 * DAY, t0 + DAY, 'Last 7 days')
      case '30d':
        return mk(t0 - 29 * DAY, t0 + DAY, 'Last 30 days')
      case 'month': {
        const m0 = new Date(todayBiz.getFullYear(), todayBiz.getMonth(), 1)
        return mk(bizStart(m0), t0 + DAY, todayBiz.toLocaleDateString([], { month: 'long', year: 'numeric' }))
      }
      case 'all':
        return mk(0, Number.MAX_SAFE_INTEGER, 'All time')
      case 'custom': {
        const f = customFrom ? new Date(`${customFrom}T00:00:00`) : null
        const t = customTo ? new Date(`${customTo}T00:00:00`) : null
        const a = f ?? t
        const b = t ?? f
        if (!a || !b) return mk(0, Number.MAX_SAFE_INTEGER, 'Pick start & end dates')
        const lo = Math.min(a.getTime(), b.getTime())
        const hi = Math.max(a.getTime(), b.getTime())
        const fmt = (ms: number) => new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' })
        return mk(lo + cutoffMs, hi + cutoffMs + DAY, `${fmt(lo)} – ${fmt(hi)}`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customFrom, customTo, cutoffMs])

  const inR = (ts: number) => ts >= range.from && ts < range.to

  // ---- Core aggregates --------------------------------------------------
  const inRange = useMemo(() => orders.filter((o) => inR(o.createdAt)), [orders, range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const valid = useMemo(() => inRange.filter((o) => o.status !== 'refunded'), [inRange])
  const gross = inRange.reduce((s, o) => s + o.total, 0)
  // Refund money is attributed to the day the refund happened, not the sale day.
  const refundsInRange =
    orders.reduce((s, o) => s + (o.refunds ?? []).filter((r) => inR(r.at)).reduce((a, r) => a + r.amount, 0), 0) +
    inRange.filter((o) => o.status === 'refunded' && !o.refunds?.length).reduce((s, o) => s + o.total, 0)
  const net = gross - refundsInRange
  const tax = inRange.reduce((s, o) => s + o.tax, 0)
  const discounts = inRange.reduce((s, o) => s + o.discount, 0)
  const avg = inRange.length ? Math.round(net / inRange.length) : 0

  // Previous equal-length period (for the comparison chip)
  const prev = useMemo(() => {
    if (range.from === 0 || range.to === Number.MAX_SAFE_INTEGER) return null
    const span = range.to - range.from
    const pf = range.from - span
    const pt = range.from
    const pIn = orders.filter((o) => o.createdAt >= pf && o.createdAt < pt)
    const pGross = pIn.reduce((s, o) => s + o.total, 0)
    const pRef =
      orders.reduce((s, o) => s + (o.refunds ?? []).filter((r) => r.at >= pf && r.at < pt).reduce((a, r) => a + r.amount, 0), 0) +
      pIn.filter((o) => o.status === 'refunded' && !o.refunds?.length).reduce((s, o) => s + o.total, 0)
    return { net: pGross - pRef, orders: pIn.length }
  }, [orders, range.from, range.to])
  const netDelta = prev && prev.net > 0 ? (net - prev.net) / prev.net : null

  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu])
  const catLabel = (id: CategoryId | undefined) =>
    (id && categories.find((c) => c.id === id)?.label) || 'Uncategorized'
  const lineCat = (l: OrderLineSnap) => l.category ?? (l.itemId ? menuById.get(l.itemId)?.category : undefined)
  const lineCost = (l: OrderLineSnap) => l.cost ?? (l.itemId ? menuById.get(l.itemId)?.cost : undefined)
  const effQty = (l: OrderLineSnap) => Math.max(0, l.qty - (l.refundedQty ?? 0))
  /** Post-discount, pre-tax net for the effective (unrefunded) units of a line. */
  const lineNet = (o: PlacedOrder, l: OrderLineSnap) => {
    const eff = effQty(l)
    if (eff <= 0) return 0
    const fullNet =
      l.net ??
      Math.round(
        ((l.price + modsTotal(l.mods)) * l.qty * Math.max(0, o.subtotal - o.discount)) / Math.max(1, o.subtotal),
      )
    return Math.round((fullNet * eff) / l.qty)
  }
  /** Order total minus its refunds that happened inside the range. */
  const orderNetInRange = (o: PlacedOrder) =>
    o.total - (o.refunds ?? []).filter((r) => inR(r.at)).reduce((a, r) => a + r.amount, 0)

  // ---- COGS / margin ------------------------------------------------------
  let cogs = 0
  let anyCost = false
  valid.forEach((o) =>
    o.lines.forEach((l) => {
      const c = lineCost(l)
      if (c !== undefined) {
        anyCost = true
        cogs += c * effQty(l)
      }
    }),
  )
  const netForMargin = valid.reduce((s, o) => s + o.lines.reduce((a, l) => a + lineNet(o, l), 0), 0)
  const margin = netForMargin - cogs
  const marginPct = netForMargin > 0 ? (margin / netForMargin) * 100 : 0

  // ---- Tender split --------------------------------------------------------
  const byTender = (m: PlacedOrder['payment']) =>
    valid.reduce((s, o) => s + paymentsOf(o).filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0), 0)
  const tenders = [
    { label: 'Cash', value: byTender('cash'), icon: Banknote },
    { label: 'Scan / QR', value: byTender('scan'), icon: ScanLine },
    { label: 'Card', value: byTender('credit'), icon: CreditCard },
  ]

  // ---- Breakdowns -----------------------------------------------------------
  const groupOrders = (key: (o: PlacedOrder) => string) => {
    const m = new Map<string, { n: number; net: number }>()
    valid.forEach((o) => {
      const k = key(o)
      const e = m.get(k) ?? { n: 0, net: 0 }
      e.n++
      e.net += orderNetInRange(o)
      m.set(k, e)
    })
    return [...m.entries()].sort((a, b) => b[1].net - a[1].net)
  }
  const byType = groupOrders((o) => TYPE_LABEL[o.type] ?? o.type)
  const byStaff = groupOrders((o) => o.cashier || 'Unknown')

  const catMap = new Map<string, { units: number; net: number; cogs: number }>()
  valid.forEach((o) =>
    o.lines.forEach((l) => {
      const eff = effQty(l)
      if (!eff) return
      const label = catLabel(lineCat(l))
      const e = catMap.get(label) ?? { units: 0, net: 0, cogs: 0 }
      e.units += eff
      e.net += lineNet(o, l)
      e.cogs += (lineCost(l) ?? 0) * eff
      catMap.set(label, e)
    }),
  )
  const byCat = [...catMap.entries()].sort((a, b) => b[1].net - a[1].net)

  // ---- Trend chart (per business day, or per month for long ranges) ---------
  const monthly = range.days > 45
  const trend = useMemo(() => {
    const buckets = new Map<number, number>()
    valid.forEach((o) => {
      const d = bizDateOf(o.createdAt)
      const key = monthly ? new Date(d.getFullYear(), d.getMonth(), 1).getTime() : d.getTime()
      buckets.set(key, (buckets.get(key) ?? 0) + orderNetInRange(o))
    })
    const keys = [...buckets.keys()].sort((a, b) => a - b)
    return keys.map((k) => ({
      label: new Date(k).toLocaleDateString([], monthly ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' }),
      amount: buckets.get(k) ?? 0,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, monthly, cutoffMs])

  // ---- Hour-of-day chart ----------------------------------------------------
  const hourVals = new Map<number, number>()
  valid.forEach((o) => {
    const h = new Date(o.createdAt).getHours()
    hourVals.set(h, (hourVals.get(h) ?? 0) + orderNetInRange(o))
  })
  const hs = [...hourVals.keys()]
  const hMin = hs.length ? Math.min(...hs) : 9
  const hMax = hs.length ? Math.max(...hs) : 21
  const hourRange = Array.from({ length: hMax - hMin + 1 }, (_, i) => hMin + i)
  const maxHour = Math.max(1, ...hourRange.map((h) => hourVals.get(h) ?? 0))
  const maxTrend = Math.max(1, ...trend.map((t) => t.amount))
  // Label thinning: at most ~9 axis labels so dense ranges stay readable.
  const chartEvery = (n: number) => Math.max(1, Math.ceil(n / 9))
  const hourEvery = chartEvery(hourRange.length)
  const trendEvery = chartEvery(trend.length)
  const showHours = trendMode === 'hours' || range.days === 1
  const peakHour = hs.length ? hs.reduce((a, b) => (hourVals.get(b)! > hourVals.get(a)! ? b : a)) : null

  // ---- Top items -------------------------------------------------------------
  const itemCount = new Map<string, { qty: number; revenue: number; cogs: number; hasCost: boolean }>()
  valid.forEach((o) =>
    o.lines.forEach((l) => {
      const eff = effQty(l)
      if (!eff) return
      const e = itemCount.get(l.name) ?? { qty: 0, revenue: 0, cogs: 0, hasCost: false }
      e.qty += eff
      e.revenue += lineNet(o, l)
      const c = lineCost(l)
      if (c !== undefined) {
        e.cogs += c * eff
        e.hasCost = true
      }
      itemCount.set(l.name, e)
    }),
  )
  const top = [...itemCount.entries()]
    .sort((a, b) => (topBy === 'qty' ? b[1].qty - a[1].qty : b[1].revenue - a[1].revenue))
    .slice(0, 8)
  const maxTop = Math.max(1, ...top.map(([, v]) => (topBy === 'qty' ? v.qty : v.revenue)))

  const taxRows = (() => {
    const tb = new Map<string, { rate: number; amount: number }>()
    inRange.forEach((o) =>
      (o.taxBreakdown ?? []).forEach((t) => {
        const e = tb.get(t.name) ?? { rate: t.rate, amount: 0 }
        e.amount += t.amount
        tb.set(t.name, e)
      }),
    )
    return [...tb.entries()].map(([name, v]) => ({ name, rate: v.rate, amount: v.amount }))
  })()

  const openCount = valid.filter((o) => o.status !== 'served').length

  const stats = [
    {
      label: 'Net Sales',
      value: formatMoney(net),
      icon: TrendingUp,
      tint: 'bg-emerald-100 text-emerald-600',
      sub: netDelta !== null ? `${netDelta >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(netDelta * 100))}% vs prev.` : undefined,
    },
    { label: 'Orders', value: String(inRange.length), icon: ShoppingBag, tint: 'bg-sky-100 text-sky-600', sub: prev ? `${prev.orders} prev.` : undefined },
    { label: 'Avg. Order', value: formatMoney(avg), icon: Receipt, tint: 'bg-violet-100 text-violet-600' },
    { label: 'Tax Collected', value: formatMoney(tax), icon: BadgePercent, tint: 'bg-amber-100 text-amber-600' },
    { label: 'Discounts', value: formatMoney(discounts), icon: BadgePercent, tint: 'bg-orange-100 text-orange-500' },
    { label: 'Refunded', value: formatMoney(refundsInRange), icon: RotateCcw, tint: 'bg-red-100 text-red-500' },
    { label: 'COGS', value: anyCost ? formatMoney(cogs) : '—', icon: Coins, tint: 'bg-neutral-100 text-neutral-500', sub: anyCost ? undefined : 'set item cost in Menu' },
    {
      label: 'Margin (excl. tax)',
      value: anyCost ? formatMoney(margin) : '—',
      icon: PiggyBank,
      tint: 'bg-emerald-100 text-emerald-600',
      sub: anyCost ? `${marginPct.toFixed(1)}%` : undefined,
    },
  ]

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="flex items-center justify-between pt-6">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight">Sales Report</h1>
          <p className="text-[12px] font-medium text-neutral-400">
            {range.label} · business day ends {cutoffH === 0 ? 'at midnight' : `at ${cutoffH}:00`} · Register 01
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() =>
              void exportCsv(
                `khadkapos-report-${preset === 'custom' ? `${customFrom}_to_${customTo}` : preset}-${new Date().toISOString().slice(0, 10)}.csv`,
                reportCsv(
                  range,
                  inRange,
                  refundsInRange,
                  tenders,
                  taxRows,
                  byType.map(([label, v]) => ({ label, orders: v.n, net: v.net })),
                  byCat.map(([label, v]) => ({ label, units: v.units, net: v.net, cogs: anyCost ? v.cogs : undefined })),
                  byStaff.map(([label, v]) => ({ label, orders: v.n, net: v.net })),
                  cogs,
                ),
              )
            }
            title="Export this report as CSV for accounting"
            className="flex items-center gap-2 self-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-[12.5px] font-extrabold text-neutral-600 shadow-sm transition-colors hover:border-primary hover:text-primary"
          >
            <FileDown size={15} />
            Export CSV
          </button>
          <div className="rounded-2xl bg-white px-5 py-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{range.label}</p>
            <p className="text-[18px] font-extrabold">{formatMoney(net)}</p>
          </div>
          <div className="rounded-2xl bg-primary px-5 py-3 shadow-lg shadow-orange-500/25">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Gross (before refunds)</p>
            <p className="text-[18px] font-extrabold text-white">{formatMoney(gross)}</p>
          </div>
        </div>
      </header>

      {/* Date range picker */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPreset(p.id)
              if (p.id === 'custom') {
                const t = isoDate(todayBiz)
                if (!customFrom) setCustomFrom(t)
                if (!customTo) setCustomTo(t)
              }
            }}
            className={`rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
              preset === p.id
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-neutral-200 bg-white text-neutral-500 hover:border-primary hover:text-primary'
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <span className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-transparent text-[12px] font-bold text-neutral-600 outline-none"
            />
            <span className="text-[11px] font-bold text-neutral-300">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-transparent text-[12px] font-bold text-neutral-600 outline-none"
            />
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-4 gap-3.5">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        {/* Trend chart */}
        <div className="col-span-2 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-extrabold">
              {showHours ? 'Sales by Hour' : monthly ? 'Sales by Month' : 'Sales by Day'}
            </p>
            {range.days > 1 && (
              <div className="flex rounded-lg bg-neutral-100 p-0.5">
                {(['auto', 'hours'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTrendMode(m)}
                    className={`rounded-md px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                      (m === 'hours') === showHours ? 'bg-white text-primary shadow-sm' : 'text-neutral-400'
                    }`}
                  >
                    {m === 'auto' ? (monthly ? 'Months' : 'Days') : 'Hours'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={`mt-4 flex h-44 items-end ${(showHours ? hourRange.length : trend.length) > 10 ? 'gap-1' : 'gap-2'}`}>
            {showHours
              ? hourRange.map((h, i) => {
                  const v = hourVals.get(h) ?? 0
                  return (
                    <div key={h} title={`${h}:00–${h + 1}:00 · ${formatMoney(v)}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                      <span className="h-3 whitespace-nowrap text-[9px] font-bold text-neutral-400">
                        {v > 0 && (i % hourEvery === 0 || h === peakHour) ? formatMoney(v) : ''}
                      </span>
                      <div
                        className={`w-full rounded-t-lg ${v > 0 ? (h === peakHour ? 'bg-amber-500' : 'bg-primary') : 'bg-neutral-100'}`}
                        style={{ height: `${Math.max(4, (v / maxHour) * 100)}%` }}
                      />
                      <span className="whitespace-nowrap text-[9.5px] font-bold text-neutral-400">
                        {i % hourEvery === 0 ? `${h}h` : ''}
                      </span>
                    </div>
                  )
                })
              : trend.map((t, i) => (
                  <div key={t.label} title={`${t.label} · ${formatMoney(t.amount)}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className="h-3 whitespace-nowrap text-[9px] font-bold text-neutral-400">
                      {t.amount > 0 && i % trendEvery === 0 ? formatMoney(t.amount) : ''}
                    </span>
                    <div
                      className={`w-full rounded-t-lg ${t.amount > 0 ? 'bg-primary' : 'bg-neutral-100'}`}
                      style={{ height: `${Math.max(4, (t.amount / maxTrend) * 100)}%` }}
                    />
                    <span className="whitespace-nowrap text-[9.5px] font-bold text-neutral-400">
                      {i % trendEvery === 0 ? t.label : ''}
                    </span>
                  </div>
                ))}
            {!showHours && trend.length === 0 && (
              <p className="w-full self-center text-center text-[12px] font-semibold text-neutral-400">No sales in this range</p>
            )}
            {showHours && hs.length === 0 && (
              <p className="w-full self-center text-center text-[12px] font-semibold text-neutral-400">No sales in this range</p>
            )}
          </div>
          {showHours && peakHour !== null && (
            <p className="mt-2 text-[10.5px] font-medium text-neutral-400">
              Peak hour: {peakHour}:00–{peakHour + 1}:00
            </p>
          )}
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
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-neutral-50 p-3.5 text-center">
              <p className="text-[10.5px] font-bold text-neutral-400">OPEN ORDERS</p>
              <p className="text-[18px] font-extrabold">{openCount}</p>
            </div>
            <div className="rounded-2xl bg-neutral-50 p-3.5 text-center">
              <p className="text-[10.5px] font-bold text-neutral-400">DISCOUNT %</p>
              <p className="text-[18px] font-extrabold">
                {gross > 0 ? `${((discounts / (gross - tax + discounts)) * 100 || 0).toFixed(1)}%` : '0%'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Breakdown
          title="By Order Type"
          icon={ShoppingBag}
          empty="No sales in this range"
          rows={byType.map(([label, v]) => ({ label, sub: `${v.n} orders`, amount: v.net }))}
        />
        <Breakdown
          title="By Category"
          icon={Store}
          empty="No sales in this range"
          rows={byCat.map(([label, v]) => ({ label, sub: `${v.units} sold`, amount: v.net }))}
        />
        <Breakdown
          title="By Staff"
          icon={Users}
          empty="No sales in this range"
          rows={byStaff.map(([label, v]) => ({ label, sub: `${v.n} orders`, amount: v.net }))}
        />
      </div>

      {/* Top items */}
      <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-extrabold">Top Items</p>
          <div className="flex rounded-lg bg-neutral-100 p-0.5">
            {(['qty', 'revenue'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setTopBy(m)}
                className={`rounded-md px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                  topBy === m ? 'bg-white text-primary shadow-sm' : 'text-neutral-400'
                }`}
              >
                {m === 'qty' ? 'By quantity' : 'By revenue'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {top.length === 0 && (
            <p className="py-6 text-center text-[12px] font-semibold text-neutral-400">No sales in this range</p>
          )}
          {top.map(([name, v], i) => (
            <div key={name} className="flex items-center gap-3">
              <span className="w-5 text-[12px] font-extrabold text-neutral-300">{i + 1}</span>
              <span className="w-44 truncate text-[12.5px] font-bold">{name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-primary"
                  style={{ width: `${((topBy === 'qty' ? v.qty : v.revenue) / maxTop) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-[11.5px] font-bold text-neutral-500">{v.qty}x</span>
              <span className="w-16 text-right text-[12px] font-extrabold">{formatMoney(v.revenue)}</span>
              <span className="w-20 text-right text-[11px] font-bold text-emerald-600">
                {v.hasCost ? `${(((v.revenue - v.cogs) / Math.max(1, v.revenue)) * 100).toFixed(0)}% margin` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
