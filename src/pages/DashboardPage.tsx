import { Bell, ChevronDown, History, Search } from 'lucide-react'
import OrderLine, { type DisplayOrder } from '../components/OrderLine'
import MenuSection from '../components/MenuSection'
import {
  type CategoryId,
  type MenuItem,
  type OrderStatus,
  type Staff,
} from '../data/menu'
import type { HeldOrder } from '../store'

interface Props {
  user: Staff
  items: MenuItem[]
  category: CategoryId
  onCategory: (c: CategoryId) => void
  cart: Record<string, number>
  onAdd: (id: string) => void
  onIncrement: (id: string) => void
  onDecrement: (id: string) => void
  lineOrders: DisplayOrder[]
  statusFilter: OrderStatus | 'all'
  onStatusFilter: (f: OrderStatus | 'all') => void
  onAdvanceOrder: (liveId: string) => void
  query: string
  onQuery: (q: string) => void
  held: HeldOrder[]
  onRecall: (id: string) => void
}

export default function DashboardPage({
  user,
  items,
  category,
  onCategory,
  cart,
  onAdd,
  onIncrement,
  onDecrement,
  lineOrders,
  statusFilter,
  onStatusFilter,
  onAdvanceOrder,
  query,
  onQuery,
  held,
  onRecall,
}: Props) {
  return (
    <>
      <header className="flex items-center gap-4 pt-6">
        <label className="flex w-[340px] items-center gap-2.5 rounded-2xl border border-neutral-200/80 bg-white px-4 py-2.5 shadow-sm transition-shadow focus-within:border-primary/40 focus-within:shadow-md">
          <Search size={16} className="shrink-0 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search menu"
            className="w-full bg-transparent text-[13px] font-medium outline-none placeholder:text-neutral-400"
          />
        </label>

        <div className="ml-auto flex items-center gap-4">
          <button className="relative rounded-xl p-2 text-neutral-500 transition-colors hover:bg-white">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-canvas" />
          </button>
          <button className="flex items-center gap-2.5">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-[12px] font-extrabold text-white ${user.color}`}
            >
              {user.initials}
            </span>
            <span className="text-left">
              <span className="block text-[13px] font-extrabold leading-tight">
                {user.name}
              </span>
              <span className="block text-[10.5px] font-medium capitalize text-neutral-400">
                {user.role}
              </span>
            </span>
            <ChevronDown size={14} className="text-neutral-400" />
          </button>
        </div>
      </header>

      <OrderLine
        orders={lineOrders}
        active={statusFilter}
        onChange={onStatusFilter}
        onAdvance={onAdvanceOrder}
      />

      {held.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <History size={14} className="text-neutral-400" />
          <span className="text-[11px] font-bold text-neutral-400">Held:</span>
          {held.map((h) => (
            <button
              key={h.id}
              onClick={() => onRecall(h.id)}
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-100"
            >
              {h.label} · {h.lines.reduce((n, l) => n + l.qty, 0)} items
            </button>
          ))}
        </div>
      )}

      <MenuSection
        items={items}
        activeCategory={category}
        onCategoryChange={onCategory}
        cart={cart}
        onAdd={onAdd}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      />
    </>
  )
}
