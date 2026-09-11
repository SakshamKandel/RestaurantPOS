import { useState } from 'react'
import { Minus, Plus, RotateCcw, X } from 'lucide-react'
import { formatMoney, modsTotal } from '../data/menu'
import { lineRefundAmount, type PlacedOrder } from '../store'

interface Props {
  order: PlacedOrder
  onConfirm: (sel: { index: number; qty: number }[], reason: string) => void
  onClose: () => void
}

/** Pick lines/quantities to refund — full refund is just "select everything". */
export default function RefundModal({ order, onConfirm, onClose }: Props) {
  const [sel, setSel] = useState<number[]>(order.lines.map(() => 0))
  const [reason, setReason] = useState('')
  const refundable = order.lines.map((l) => l.qty - (l.refundedQty ?? 0))
  const amount = sel.reduce((s, q, i) => s + lineRefundAmount(order, i, q), 0)
  const anySel = sel.some((q) => q > 0)
  const allSel = order.lines.every((_, i) => sel[i] === refundable[i] && refundable[i] > 0)

  const setQty = (i: number, q: number) =>
    setSel((s) => s.map((v, j) => (j === i ? Math.max(0, Math.min(refundable[j], q)) : v)))

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="thin-scroll max-h-[85vh] w-[440px] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-extrabold">Refund {order.number}</p>
            <p className="text-[11.5px] font-medium text-neutral-400">
              Order total {formatMoney(order.total)} · choose what goes back
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={17} />
          </button>
        </div>

        <ul className="mt-4 flex flex-col divide-y divide-neutral-100">
          {order.lines.map((l, i) => {
            const max = refundable[i]
            const unit = l.price + modsTotal(l.mods)
            return (
              <li key={i} className={`py-3 ${max === 0 ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold">
                      {l.qty}× {l.name}
                    </span>
                    {(l.mods?.length || l.refundedQty) && (
                      <span className="block truncate text-[10.5px] font-medium text-neutral-400">
                        {l.mods?.map((m) => m.name).join(', ')}
                        {l.refundedQty ? ` · ${l.refundedQty} already refunded` : ''}
                      </span>
                    )}
                  </span>
                  {max > 0 ? (
                    <span className="flex items-center rounded-lg bg-neutral-100">
                      <button onClick={() => setQty(i, sel[i] - 1)} className="flex h-7 w-7 items-center justify-center text-neutral-500 hover:text-primary">
                        <Minus size={12} strokeWidth={3} />
                      </button>
                      <span className="w-6 text-center text-[12px] font-extrabold">{sel[i]}</span>
                      <button onClick={() => setQty(i, sel[i] + 1)} className="flex h-7 w-7 items-center justify-center text-neutral-500 hover:text-primary">
                        <Plus size={12} strokeWidth={3} />
                      </button>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-neutral-400">fully refunded</span>
                  )}
                  <span className="w-16 text-right text-[12.5px] font-extrabold">
                    {formatMoney(unit * l.qty)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>

        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional) — e.g. wrong item, customer returned"
          className="mt-3 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12px] font-medium outline-none focus:border-primary"
        />

        <div className="mt-4 flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
          <span className="text-[12px] font-bold text-neutral-500">Refund amount (incl. tax)</span>
          <span className="text-[16px] font-extrabold text-red-500">{formatMoney(amount)}</span>
        </div>

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={() => setSel(refundable)}
            className="rounded-xl border border-neutral-200 px-3.5 py-3 text-[11.5px] font-bold text-neutral-600 hover:bg-neutral-50"
          >
            {allSel ? 'All selected' : 'Select all'}
          </button>
          <button
            onClick={() => onConfirm(sel.map((qty, index) => ({ index, qty })).filter((s) => s.qty > 0), reason)}
            disabled={!anySel}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-[13px] font-extrabold text-white shadow-md shadow-red-500/25 hover:bg-red-600 disabled:opacity-40"
          >
            <RotateCcw size={15} />
            Refund {formatMoney(amount)}
          </button>
        </div>
      </div>
    </div>
  )
}
