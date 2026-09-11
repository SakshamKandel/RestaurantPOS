import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import {
  CATEGORIES,
  formatMoney,
  type CategoryId,
  type MenuItem,
} from '../data/menu'

function DishImage({ item }: { item: MenuItem }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="relative h-28 w-full overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-stone-200">
      {failed ? (
        <span className="flex h-full w-full items-center justify-center text-4xl">
          {item.emoji}
        </span>
      ) : (
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${
            item.available ? '' : 'opacity-60 grayscale'
          }`}
        />
      )}
      <span
        className={`absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[9.5px] font-bold shadow-sm ${
          item.available ? 'text-emerald-600' : 'text-neutral-500'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            item.available ? 'bg-emerald-500' : 'bg-neutral-400'
          }`}
        />
        {item.available ? 'Available' : 'Unavailable'}
      </span>
    </div>
  )
}

interface Props {
  items: MenuItem[]
  activeCategory: CategoryId
  onCategoryChange: (c: CategoryId) => void
  cart: Record<string, number>
  onAdd: (id: string) => void
  onIncrement: (id: string) => void
  onDecrement: (id: string) => void
}

export default function MenuSection({
  items,
  activeCategory,
  onCategoryChange,
  cart,
  onAdd,
  onIncrement,
  onDecrement,
}: Props) {
  return (
    <section className="mt-6 pb-6">
      <h2 className="text-[16px] font-extrabold tracking-tight">Menu</h2>

      <div className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => {
          const Icon = c.icon
          const isActive = c.id === activeCategory
          return (
            <button
              key={c.id}
              onClick={() => onCategoryChange(c.id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-2xl border bg-white px-3.5 py-2.5 transition-all ${
                isActive
                  ? 'border-primary shadow-md shadow-orange-500/10'
                  : 'border-transparent hover:border-neutral-200'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                <Icon size={16} strokeWidth={2.2} />
              </span>
              <span className="text-left">
                <span
                  className={`block text-[12.5px] font-bold ${
                    isActive ? 'text-primary' : 'text-neutral-800'
                  }`}
                >
                  {c.label}
                </span>
                <span className="block text-[10px] font-medium text-neutral-400">
                  {items.filter((i) => i.category === c.id).length} Items
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-3">
        {items.map((item) => {
          const qty = cart[item.id] ?? 0
          return (
            <article
              key={item.id}
              className="rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <DishImage item={item} />
              <div className="mt-3 flex items-baseline justify-between px-0.5">
                <p className="text-[13px] font-bold">{item.name}</p>
                <p className="text-[13px] font-extrabold text-primary">
                  {formatMoney(item.price)}
                </p>
              </div>

              {!item.available ? (
                <button
                  disabled
                  className="mt-2.5 w-full cursor-not-allowed rounded-xl border border-neutral-200 py-2 text-[12px] font-bold text-neutral-300"
                >
                  Sold Out
                </button>
              ) : qty === 0 ? (
                <button
                  onClick={() => onAdd(item.id)}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-200 py-2 text-[12px] font-bold text-neutral-600 transition-colors hover:border-primary hover:bg-primary hover:text-white"
                >
                  <Plus size={14} strokeWidth={2.6} />
                  Add to Cart
                </button>
              ) : (
                <div className="mt-2.5 flex w-full items-center justify-between rounded-xl bg-primary px-2 py-1.5 text-white">
                  <button
                    onClick={() => onDecrement(item.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-white/20"
                    aria-label={`Remove one ${item.name}`}
                  >
                    <Minus size={14} strokeWidth={2.8} />
                  </button>
                  <span className="text-[12.5px] font-extrabold">{qty} in cart</span>
                  <button
                    onClick={() => onIncrement(item.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-white/20"
                    aria-label={`Add one ${item.name}`}
                  >
                    <Plus size={14} strokeWidth={2.8} />
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
