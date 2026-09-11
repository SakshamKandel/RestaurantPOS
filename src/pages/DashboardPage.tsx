import { useState } from 'react'
import { Bell, ChevronDown, History, LogOut, Search, TrendingUp, UserCog } from 'lucide-react'
import OrderLine, { type DisplayOrder } from '../components/OrderLine'
import MenuSection, { type CartMap } from '../components/MenuSection'
import {
  formatMoney,
  type Category,
  type CategoryId,
  type Cents,
  type MenuItem,
  type OrderStatus,
  type Staff,
} from '../data/menu'
import type { HeldOrder } from '../store'

interface Props {
  user: Staff
  items: MenuItem[]
  categories: Category[]
  itemCounts: Record<string, number>
  category: CategoryId
  onCategory: (c: CategoryId) => void
  cart: CartMap
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
  todaySales: Cents
  notifications: { id: string; title: string; sub: string; tone: 'warn' | 'info' }[]
  onSignOut: () => void
  onOpenStaff: () => void
}

export default function DashboardPage({
  user,
  items,
  categories,
  itemCounts,
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
  todaySales,
  notifications,
  onSignOut,
  onOpenStaff,
}: Props) {
  const [bellOpen, setBellOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)

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
          <span className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 shadow-sm">
            <TrendingUp size={15} className="text-emerald-500" />
            <span className="text-[12px] font-bold text-neutral-400">Today</span>
            <span className="text-[13px] font-extrabold">{formatMoney(todaySales)}</span>
          </span>
          <div className="relative">
            <button
              onClick={() => { setBellOpen(!bellOpen); setUserMenu(false) }}
              className="relative rounded-xl p-2 text-neutral-500 transition-colors hover:bg-white"
            >
              <Bell size={18} />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-canvas" />
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-neutral-100 bg-white p-2 shadow-xl">
                <p className="px-3 pt-2 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">
                  Notifications
                </p>
                {notifications.length === 0 && (
                  <p className="px-3 py-4 text-center text-[11.5px] font-medium text-neutral-400">
                    All clear — nothing needs attention
                  </p>
                )}
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 hover:bg-neutral-50">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.tone === 'warn' ? 'bg-amber-500' : 'bg-sky-400'}`} />
                    <span>
                      <span className="block text-[12px] font-bold">{n.title}</span>
                      <span className="block text-[10.5px] font-medium text-neutral-400">{n.sub}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => { setUserMenu(!userMenu); setBellOpen(false) }}
              className="flex items-center gap-2.5"
            >
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
            {userMenu && (
              <div className="absolute right-0 z-30 mt-2 w-52 rounded-2xl border border-neutral-100 bg-white p-2 shadow-xl">
                {(user.role === 'manager' || user.role === 'admin') && (
                  <button
                    onClick={() => { setUserMenu(false); onOpenStaff() }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] font-bold text-neutral-600 hover:bg-neutral-50"
                  >
                    <UserCog size={15} />
                    Manage staff
                  </button>
                )}
                <button
                  onClick={onSignOut}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] font-bold text-red-500 hover:bg-red-50"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            )}
          </div>
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
        categories={categories}
        itemCounts={itemCounts}
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
