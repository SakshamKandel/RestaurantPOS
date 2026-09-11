import { useState } from 'react'
import { Banknote, CreditCard, Delete, Plus, ScanLine, Split, Trash2, X, type LucideIcon } from 'lucide-react'
import { formatMoney, type Cents } from '../data/menu'
import type { PaymentRecord } from '../store'
import type { PaymentMethod } from './OrderPanel'

const METHODS: { id: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'scan', label: 'Scan / QR', icon: ScanLine },
  { id: 'credit', label: 'Card', icon: CreditCard },
]

const QUICK: { label: string; cents: Cents }[] = [
  { label: 'Exact', cents: -1 },
  { label: '$5', cents: 500 },
  { label: '$10', cents: 1000 },
  { label: '$20', cents: 2000 },
  { label: '$50', cents: 5000 },
  { label: '$100', cents: 10000 },
]

const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del']

interface Props {
  total: Cents
  method: PaymentMethod
  onMethodChange: (m: PaymentMethod) => void
  onClose: () => void
  onComplete: (payment: PaymentMethod, tendered: Cents, change: Cents, payments: PaymentRecord[]) => void
}

export default function PaymentModal({
  total,
  method,
  onMethodChange,
  onClose,
  onComplete,
}: Props) {
  const [tendered, setTendered] = useState<Cents>(0)
  const [digits, setDigits] = useState('')
  const [splitMode, setSplitMode] = useState(false)
  const [parts, setParts] = useState<PaymentRecord[]>([])

  const paid = parts.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, total - paid)
  const cashShort = method === 'cash' && tendered < remaining
  // non-cash parts: the amount charged; blank numpad = full remaining
  const entered = Math.round(parseFloat(digits || '0') * 100)
  const cardAmount = entered > 0 ? Math.min(entered, remaining) : remaining
  const change = method === 'cash' ? Math.max(0, tendered - remaining) : 0

  const pushDigit = (k: string) => {
    let d = digits
    if (k === 'del') d = d.slice(0, -1)
    else d = (d + k).slice(0, 7)
    setDigits(d)
    setTendered(Math.round(parseFloat(d || '0') * 100))
  }

  const addPart = () => {
    if (remaining <= 0) return
    if (method === 'cash') {
      if (tendered <= 0) return
      const applied = Math.min(tendered, remaining)
      setParts([...parts, { method: 'cash', amount: applied, tendered, change: tendered - applied }])
    } else {
      if (cardAmount <= 0) return
      setParts([...parts, { method, amount: cardAmount }])
    }
    setTendered(0)
    setDigits('')
  }

  const finish = () => {
    if (!splitMode) {
      const one: PaymentRecord =
        method === 'cash'
          ? { method: 'cash', amount: total, tendered, change: tendered - total }
          : { method, amount: total }
      onComplete(method, method === 'cash' ? tendered : total, method === 'cash' ? tendered - total : 0, [one])
      return
    }
    const payments = parts
    const first = payments[0]?.method ?? method
    const totalChange = payments.reduce((s, p) => s + (p.change ?? 0), 0)
    const totalTendered = payments.reduce((s, p) => s + (p.tendered ?? p.amount), 0)
    onComplete(first, totalTendered, totalChange, payments)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[760px] overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <p className="text-[15px] font-extrabold">Take Payment</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSplitMode(!splitMode); setParts([]); setTendered(0); setDigits('') }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-bold transition-colors ${
                splitMode ? 'bg-primary-soft text-primary' : 'bg-neutral-100 text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Split size={14} />
              Split payment
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Left: method + tendered */}
          <div className="w-[320px] border-r border-neutral-100 p-6">
            <div className="flex gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon
                const active = method === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => { onMethodChange(m.id); setTendered(0); setDigits('') }}
                    className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl border py-3 text-[11px] font-bold transition-colors ${
                      active ? 'border-primary bg-primary-soft text-primary' : 'border-neutral-200 text-neutral-500'
                    }`}
                  >
                    <Icon size={18} />
                    {m.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
              <div className="flex justify-between text-[12px] text-neutral-500">
                <span>Amount due</span>
                <span className="font-extrabold text-ink">{formatMoney(total)}</span>
              </div>
              {splitMode && (
                <div className="mt-2 flex justify-between text-[12px] text-neutral-500">
                  <span>Paid so far</span>
                  <span className="font-extrabold text-emerald-600">{formatMoney(paid)}</span>
                </div>
              )}
              <div className="mt-3 flex justify-between text-[12px] text-neutral-500">
                <span>{splitMode ? (method === 'cash' ? 'Tendered' : 'Charging') : 'Tendered'}</span>
                <span className="font-extrabold text-ink">
                  {formatMoney(method === 'cash' ? tendered : splitMode ? cardAmount : total)}
                </span>
              </div>
              <div className="mt-3 flex justify-between border-t border-neutral-200 pt-3">
                <span className="text-[12.5px] font-bold text-neutral-500">{splitMode ? 'Remaining' : 'Change'}</span>
                <span className={`text-[18px] font-extrabold ${splitMode ? (remaining === 0 ? 'text-emerald-600' : 'text-ink') : method === 'cash' && tendered >= total ? 'text-emerald-600' : 'text-neutral-300'}`}>
                  {formatMoney(splitMode ? remaining : method === 'cash' && tendered >= total ? change : 0)}
                </span>
              </div>
            </div>

            {/* Split parts */}
            {splitMode && parts.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {parts.map((p, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-[12px]">
                    <span className="font-bold capitalize text-neutral-600">
                      {METHODS.find((m) => m.id === p.method)?.label ?? p.method}
                      {p.change ? <span className="ml-1 text-[10px] font-medium text-neutral-400">(change {formatMoney(p.change)})</span> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-extrabold">{formatMoney(p.amount)}</span>
                      <button
                        onClick={() => setParts(parts.filter((_, j) => j !== i))}
                        className="rounded p-0.5 text-neutral-300 hover:text-red-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {splitMode && remaining > 0 && (
              <button
                onClick={addPart}
                disabled={method === 'cash' ? tendered <= 0 : cardAmount <= 0}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 py-3 text-[12.5px] font-extrabold text-primary transition-colors hover:bg-primary-soft disabled:opacity-40"
              >
                <Plus size={15} strokeWidth={2.6} />
                Add {METHODS.find((m) => m.id === method)?.label} · {formatMoney(method === 'cash' ? Math.min(tendered, remaining) : cardAmount)}
              </button>
            )}

            <button
              onClick={finish}
              disabled={splitMode ? remaining !== 0 : cashShort}
              className="mt-4 w-full rounded-2xl bg-primary py-3.5 text-[14px] font-extrabold text-white shadow-lg shadow-orange-500/30 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {splitMode
                ? remaining === 0
                  ? `Complete order (${parts.length} payments)`
                  : `${formatMoney(remaining)} still due`
                : cashShort
                  ? `Need ${formatMoney(total - tendered)} more`
                  : `Complete ${formatMoney(total)}`}
            </button>
          </div>

          {/* Right: numpad (cash tendered, or split amount for card/scan) */}
          <div className="flex-1 p-6">
            {method === 'cash' || splitMode ? (
              <>
                <div className="flex gap-2">
                  {QUICK.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => {
                        if (q.cents === -1) {
                          setTendered(remaining)
                          setDigits(String(remaining / 100))
                        } else {
                          setTendered((t) => t + q.cents)
                          setDigits((d) => String((Math.round(parseFloat(d || '0') * 100) + q.cents) / 100))
                        }
                      }}
                      className="flex-1 rounded-xl border border-neutral-200 py-2 text-[12px] font-bold text-neutral-600 transition-colors hover:border-primary hover:text-primary"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  {PAD.map((k) => (
                    <button
                      key={k}
                      onClick={() => pushDigit(k)}
                      className="flex h-14 items-center justify-center rounded-2xl bg-neutral-50 text-[17px] font-bold text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
                    >
                      {k === 'del' ? <Delete size={18} /> : k}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-center text-[11px] font-medium text-neutral-400">
                  {method === 'cash'
                    ? 'Type the cash tendered or use quick buttons'
                    : 'Type the amount to charge on this method'}
                </p>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-neutral-50 py-16">
                {method === 'scan' ? (
                  <ScanLine size={40} className="text-neutral-300" />
                ) : (
                  <CreditCard size={40} className="text-neutral-300" />
                )}
                <p className="mt-4 text-[13px] font-bold text-neutral-500">
                  {method === 'scan' ? 'Show the QR code to the customer' : 'Insert or tap card on the terminal'}
                </p>
                <p className="mt-1 text-[11px] text-neutral-400">
                  Amount {formatMoney(total)} · press Complete when approved
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
