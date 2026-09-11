import { useState } from 'react'
import {
  CircleDollarSign,
  Clock3,
  Landmark,
  Lock,
  Minus,
  Plus,
  Unlock,
  Vault,
} from 'lucide-react'
import { formatMoney, type Cents } from '../data/menu'
import type { PlacedOrder, Shift } from '../store'

interface Props {
  shifts: Shift[]
  orders: PlacedOrder[]
  drawerEnabled: boolean
  userName: string
  onOpenShift: (float: Cents) => void
  onCloseShift: () => void
  onMovement: (type: 'paid-in' | 'paid-out' | 'no-sale' | 'count', amount: Cents, reason: string) => void
  /** Returns true only when a pulse was actually sent to the drawer. */
  onOpenDrawer: (reason: string) => boolean
}

const MOVE_LABEL: Record<string, string> = {
  float: 'Opening float',
  'paid-in': 'Paid in',
  'paid-out': 'Paid out',
  'no-sale': 'No-sale open',
  count: 'Cash count',
}

/** Payment components of an order — split-aware, legacy-fallback. */
const paysOf = (o: PlacedOrder) =>
  o.payments?.length ? o.payments : [{ method: o.payment, amount: o.total }]

export default function ShiftPage({
  shifts,
  orders,
  drawerEnabled,
  userName,
  onOpenShift,
  onCloseShift,
  onMovement,
  onOpenDrawer,
}: Props) {
  const current = shifts.find((s) => s.closedAt === null)
  const past = shifts.filter((s) => s.closedAt !== null)

  const [float, setFloat] = useState('200.00')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)

  // X-report numbers for the open shift
  const since = current ? current.openedAt : 0
  const shiftOrders = orders.filter(
    (o) => o.createdAt >= since && o.status !== 'refunded',
  )
  const cashSales = shiftOrders.reduce((s, o) => {
    const pays = o.payments?.length ? o.payments : [{ method: o.payment, amount: o.total }]
    return s + pays.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0)
  }, 0)
  // cash refunds leave the drawer — subtract them from expected cash
  const cashRefunds = orders
    .filter((o) => o.createdAt >= since)
    .reduce((s, o) => {
      const cash = (o.payments?.length ? o.payments : [{ method: o.payment, amount: o.total }]).some(
        (p) => p.method === 'cash',
      )
      return s + (cash ? (o.refunds ?? []).reduce((a, r) => a + r.amount, 0) : 0)
    }, 0)
  const totalSales = shiftOrders.reduce((s, o) => s + o.total, 0)
  const paidIn = (current?.movements ?? [])
    .filter((m) => m.type === 'paid-in')
    .reduce((s, m) => s + m.amount, 0)
  const paidOut = (current?.movements ?? [])
    .filter((m) => m.type === 'paid-out')
    .reduce((s, m) => s + m.amount, 0)
  const expected = (current?.float ?? 0) + cashSales + paidIn - paidOut - cashRefunds
  const counted = current?.movements.filter((m) => m.type === 'count').at(-1)?.amount ?? null
  const variance = counted !== null ? counted - expected : null

  /** Stats for a closed shift — stored snapshot when present, otherwise
   *  derived from the orders inside its open→close window (legacy rows). */
  const statsFor = (s: Shift) => {
    if (s.totalSales !== undefined)
      return {
        orderCount: s.orderCount ?? 0,
        totalSales: s.totalSales,
        cashSales: s.cashSales ?? 0,
        expected: s.expected,
        variance: s.variance,
      }
    const end = s.closedAt ?? Number.MAX_SAFE_INTEGER
    const win = orders.filter(
      (o) => o.createdAt >= s.openedAt && o.createdAt < end && o.status !== 'refunded',
    )
    const totalSales = win.reduce((a, o) => a + o.total, 0)
    const cashSales = win.reduce(
      (a, o) => a + paysOf(o).filter((p) => p.method === 'cash').reduce((x, p) => x + p.amount, 0),
      0,
    )
    const cashRefunds = orders
      .filter((o) => o.createdAt >= s.openedAt && o.createdAt < end)
      .reduce(
        (a, o) =>
          a + (paysOf(o).some((p) => p.method === 'cash') ? (o.refunds ?? []).reduce((x, r) => x + r.amount, 0) : 0),
        0,
      )
    const inOut = s.movements.reduce(
      (a, m) => a + (m.type === 'paid-in' ? m.amount : m.type === 'paid-out' ? -m.amount : 0),
      0,
    )
    const exp = s.float + cashSales + inOut - cashRefunds
    return {
      orderCount: win.length,
      totalSales,
      cashSales,
      expected: exp,
      variance: s.counted !== null ? s.counted - exp : undefined,
    }
  }

  const parseAmount = () => Math.round(parseFloat(amount || '0') * 100)

  const act = (type: 'paid-in' | 'paid-out' | 'count') => {
    const a = parseAmount()
    if (a <= 0) return
    onMovement(type, a, reason || MOVE_LABEL[type])
    setAmount('')
    setReason('')
  }

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="flex items-center justify-between pt-6">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight">Shift & Cash Drawer</h1>
          <p className="text-[12px] font-medium text-neutral-400">
            {drawerEnabled ? 'Drawer connected to billing printer (RJ11 kick)' : 'Cash drawer off — enable it in Settings → Cash Drawer'}
          </p>
        </div>
        <span
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold shadow-sm ${
            current ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-neutral-500'
          }`}
        >
          {current ? <Unlock size={14} /> : <Lock size={14} />}
          {current ? 'Shift Open' : 'Shift Closed'}
        </span>
      </header>

      {!current ? (
        /* ---------- Open shift ---------- */
        <div className="mx-auto mt-10 w-[400px] rounded-3xl bg-white p-7 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Vault size={26} />
          </span>
          <p className="mt-4 text-[16px] font-extrabold">Open your shift</p>
          <p className="mt-1 text-[12px] font-medium text-neutral-400">
            Count the cash float in the drawer before starting sales
          </p>
          <input
            value={float}
            onChange={(e) => setFloat(e.target.value)}
            inputMode="decimal"
            placeholder="Opening float e.g. 200.00"
            className="mt-5 w-full rounded-xl border border-neutral-200 px-4 py-3 text-center text-[16px] font-extrabold outline-none focus:border-primary"
          />
          <button
            onClick={() => onOpenShift(Math.round(parseFloat(float || '0') * 100))}
            disabled={Number.isNaN(parseFloat(float))}
            className="mt-4 w-full rounded-xl bg-primary py-3.5 text-[13.5px] font-extrabold text-white shadow-lg shadow-orange-500/25 hover:bg-primary-dark disabled:opacity-40"
          >
            Open Shift · {userName}
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-4">
          {/* X report */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-3.5">
              {[
                { label: 'Shift Sales', value: formatMoney(totalSales), icon: CircleDollarSign, tint: 'bg-emerald-100 text-emerald-600' },
                { label: 'Cash Sales', value: formatMoney(cashSales), icon: Landmark, tint: 'bg-sky-100 text-sky-600' },
                { label: 'Orders', value: String(shiftOrders.length), icon: Clock3, tint: 'bg-violet-100 text-violet-600' },
                { label: 'Opening Float', value: formatMoney(current.float), icon: Vault, tint: 'bg-amber-100 text-amber-600' },
              ].map((s) => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="rounded-2xl bg-white p-4 shadow-sm">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.tint}`}>
                      <Icon size={15} />
                    </span>
                    <p className="mt-3 text-[16px] font-extrabold">{s.value}</p>
                    <p className="text-[10.5px] font-medium text-neutral-400">{s.label}</p>
                  </div>
                )
              })}
            </div>

            {/* Expected drawer */}
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-[13px] font-extrabold">Drawer Position (X Report)</p>
              <div className="mt-3 flex flex-col gap-2 text-[12.5px]">
                {[
                  ['Opening float', formatMoney(current.float)],
                  ['+ Cash sales', formatMoney(cashSales)],
                  ['+ Paid in', formatMoney(paidIn)],
                  ['− Paid out', `-${formatMoney(paidOut)}`],
                  ...(cashRefunds > 0 ? [['− Cash refunds', `-${formatMoney(cashRefunds)}`] as [string, string]] : []),
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-neutral-500">
                    <span>{l}</span>
                    <span className="font-bold text-neutral-800">{v}</span>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t border-neutral-200 pt-2.5">
                  <span className="font-bold">Expected in drawer</span>
                  <span className="text-[15px] font-extrabold text-primary">{formatMoney(expected)}</span>
                </div>
                {variance !== null && (
                  <div className="flex justify-between">
                    <span className="font-medium">Counted / Variance</span>
                    <span className={`font-extrabold ${variance === 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatMoney(counted!)} / {variance === 0 ? 'balanced' : formatMoney(variance)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Movements */}
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-[13px] font-extrabold">Drawer Movements</p>
              <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
                {current.movements.length === 0 && (
                  <li className="py-6 text-center text-[11.5px] font-semibold text-neutral-400">
                    No movements yet
                  </li>
                )}
                {[...current.movements].reverse().map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2.5 text-[12px]">
                    <span>
                      <span className="font-bold">{MOVE_LABEL[m.type]}</span>
                      <span className="ml-2 font-medium text-neutral-400">{m.reason}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium text-neutral-400">
                        {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {m.actor}
                      </span>
                      <span className="w-16 text-right font-extrabold">
                        {m.amount > 0 ? formatMoney(m.amount) : '—'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-[13px] font-extrabold">Drawer Actions</p>
              <button
                onClick={() => {
                  // movement is recorded only when the drawer actually kicked
                  if (onOpenDrawer(reason || 'No-sale drawer open')) {
                    onMovement('no-sale', 0, reason || 'No-sale drawer open')
                    setReason('')
                  }
                }}
                title={drawerEnabled ? 'Send a drawer pulse (no sale)' : 'Cash drawer is off — click to see why'}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-[12.5px] font-bold transition-colors ${
                  drawerEnabled
                    ? 'border-neutral-200 text-neutral-600 hover:border-primary hover:text-primary'
                    : 'border-neutral-200 text-neutral-400 hover:border-amber-300 hover:text-amber-600'
                }`}
              >
                <Vault size={15} />
                Open Drawer (No Sale)
              </button>

              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="Amount e.g. 50.00"
                className="mt-3 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none focus:border-primary"
              />
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason"
                className="mt-2.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none focus:border-primary"
              />
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <button
                  onClick={() => act('paid-in')}
                  className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 py-2.5 text-[11.5px] font-bold text-white hover:bg-emerald-600"
                >
                  <Plus size={13} /> Paid In
                </button>
                <button
                  onClick={() => act('paid-out')}
                  className="flex items-center justify-center gap-1 rounded-xl bg-amber-500 py-2.5 text-[11.5px] font-bold text-white hover:bg-amber-600"
                >
                  <Minus size={13} /> Paid Out
                </button>
                <button
                  onClick={() => act('count')}
                  className="flex items-center justify-center gap-1 rounded-xl bg-sky-500 py-2.5 text-[11.5px] font-bold text-white hover:bg-sky-600"
                >
                  Count
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-[13px] font-extrabold">End of Day</p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-neutral-400">
                Count the drawer, then close the shift to produce the Z report.
              </p>
              {confirmClose ? (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setConfirmClose(false)}
                    className="flex-1 rounded-xl border border-neutral-200 py-3 text-[12px] font-bold text-neutral-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onCloseShift()
                      setConfirmClose(false)
                    }}
                    className="flex-1 rounded-xl bg-red-500 py-3 text-[12px] font-bold text-white hover:bg-red-600"
                  >
                    Close Shift
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClose(true)}
                  className="mt-3 w-full rounded-xl bg-neutral-900 py-3 text-[12.5px] font-bold text-white hover:bg-neutral-700"
                >
                  Close Shift (Z Report)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Past shifts */}
      {past.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
          <p className="px-5 pt-4 text-[13px] font-extrabold">Shift History</p>
          <table className="mt-1 w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100 text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
                <th className="px-5 py-3">Opened</th>
                <th className="px-5 py-3">Closed</th>
                <th className="px-5 py-3">Operator</th>
                <th className="px-5 py-3">Orders</th>
                <th className="px-5 py-3">Float</th>
                <th className="px-5 py-3">Sales</th>
                <th className="px-5 py-3">Cash Sales</th>
                <th className="px-5 py-3">Expected</th>
                <th className="px-5 py-3">Counted</th>
                <th className="px-5 py-3">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {[...past].reverse().map((s) => {
                const st = statsFor(s)
                return (
                  <tr key={s.id}>
                    <td className="px-5 py-3 text-[12px] font-semibold">
                      {new Date(s.openedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-[12px] font-semibold">
                      {new Date(s.closedAt!).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-[12px] font-medium text-neutral-500">
                      {s.openedBy}{s.closedBy && s.closedBy !== s.openedBy ? ` → ${s.closedBy}` : ''}
                    </td>
                    <td className="px-5 py-3 text-[12px] font-medium text-neutral-500">{st.orderCount}</td>
                    <td className="px-5 py-3 text-[12px] font-bold">{formatMoney(s.float)}</td>
                    <td className="px-5 py-3 text-[12px] font-bold">{formatMoney(st.totalSales)}</td>
                    <td className="px-5 py-3 text-[12px] font-medium text-neutral-500">{formatMoney(st.cashSales)}</td>
                    <td className="px-5 py-3 text-[12px] font-medium text-neutral-500">
                      {st.expected !== undefined ? formatMoney(st.expected) : '—'}
                    </td>
                    <td className="px-5 py-3 text-[12px] font-bold">
                      {s.counted !== null ? formatMoney(s.counted) : '—'}
                    </td>
                    <td className={`px-5 py-3 text-[12px] font-extrabold ${
                      st.variance === undefined ? 'text-neutral-400' : st.variance === 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {st.variance === undefined ? '—' : st.variance === 0 ? 'balanced' : formatMoney(st.variance)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
