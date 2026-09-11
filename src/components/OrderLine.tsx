import { Check, ChefHat } from 'lucide-react'
import { ORDER_FILTERS, type LineOrder, type OrderStatus } from '../data/menu'

const STATUS_STYLE: Record<
  OrderStatus,
  { badge: string; card: string; label: string; next: string | null }
> = {
  waiting: {
    badge: 'bg-violet-500 text-white',
    card: 'bg-violet-50/70 border-violet-100',
    label: 'Waiting',
    next: 'Mark Ready',
  },
  ready: {
    badge: 'bg-sky-500 text-white',
    card: 'bg-sky-50/70 border-sky-100',
    label: 'Ready',
    next: 'Mark Served',
  },
  served: {
    badge: 'bg-emerald-500 text-white',
    card: 'bg-emerald-50/70 border-emerald-100',
    label: 'Served',
    next: null,
  },
}

export interface DisplayOrder extends LineOrder {
  liveId?: string
}

interface Props {
  orders: DisplayOrder[]
  active: OrderStatus | 'all'
  onChange: (f: OrderStatus | 'all') => void
  onAdvance?: (liveId: string) => void
}

export default function OrderLine({ orders, active, onChange, onAdvance }: Props) {
  const countFor = (id: OrderStatus | 'all') =>
    id === 'all' ? orders.length : orders.filter((o) => o.status === id).length

  const visible =
    active === 'all' ? orders : orders.filter((o) => o.status === active)

  return (
    <section className="mt-6">
      <h2 className="text-[16px] font-extrabold tracking-tight">Order Line</h2>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {ORDER_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
              active === f.id
                ? 'border-primary bg-white text-primary shadow-sm'
                : 'border-transparent bg-white text-neutral-500 hover:border-neutral-200'
            }`}
          >
            {f.label}
            <span
              className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] text-white ${f.dot}`}
            >
              {countFor(f.id)}
            </span>
          </button>
        ))}
      </div>

      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
        {visible.map((o) => {
          const s = STATUS_STYLE[o.status]
          return (
            <article
              key={o.number}
              className={`w-[172px] shrink-0 rounded-2xl border p-3.5 shadow-sm ${s.card}`}
            >
              <div className="flex items-baseline justify-between">
                <p className="text-[13px] font-extrabold">Order #{o.number}</p>
                <p className="text-[10px] font-semibold text-neutral-400">
                  {o.tag}
                </p>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <p className="text-[12px] font-semibold text-neutral-700">
                  {o.item}
                </p>
                <p className="text-[11px] font-bold text-neutral-500">
                  {o.qty}x
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] font-medium text-neutral-400">
                  {o.time}
                </p>
                <span
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9.5px] font-bold ${s.badge}`}
                >
                  {o.status === 'ready' && <Check size={10} strokeWidth={3} />}
                  {o.status === 'waiting' && <ChefHat size={10} strokeWidth={2.5} />}
                  {s.label}
                </span>
              </div>
              {o.liveId && s.next && (
                <button
                  onClick={() => onAdvance?.(o.liveId!)}
                  className="mt-2.5 w-full rounded-lg bg-white/80 py-1.5 text-[10.5px] font-bold text-neutral-600 shadow-sm transition-colors hover:bg-white hover:text-primary"
                >
                  {s.next}
                </button>
              )}
            </article>
          )
        })}
        {visible.length === 0 && (
          <p className="py-6 text-[12px] font-semibold text-neutral-400">
            No orders in this lane
          </p>
        )}
      </div>
    </section>
  )
}
