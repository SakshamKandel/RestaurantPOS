import { useState } from 'react'
import { Phone, Plus, Search, ShoppingBag, X } from 'lucide-react'
import { formatMoney, type Customer } from '../data/menu'

interface Props {
  customers: Customer[]
  onAdd: (c: Omit<Customer, 'id' | 'visits' | 'spent'>) => void
  onNewOrder: (c: Customer) => void
}

export default function CustomersPage({ customers, onAdd, onNewOrder }: Props) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })

  const q = query.trim().toLowerCase()
  const visible = customers.filter(
    (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
  )

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="flex items-center justify-between pt-6">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight">Customers</h1>
          <p className="text-[12px] font-medium text-neutral-400">
            {customers.length} profiles on file
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex w-[260px] items-center gap-2.5 rounded-2xl border border-neutral-200/80 bg-white px-4 py-2.5 shadow-sm">
            <Search size={15} className="text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or phone"
              className="w-full bg-transparent text-[12.5px] font-medium outline-none placeholder:text-neutral-400"
            />
          </label>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12.5px] font-extrabold text-white shadow-md shadow-orange-500/25 hover:bg-primary-dark"
          >
            <Plus size={15} strokeWidth={2.6} />
            Add Customer
          </button>
        </div>
      </header>

      <div className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-100 text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
              <th className="px-5 py-3.5">Customer</th>
              <th className="px-5 py-3.5">Phone</th>
              <th className="px-5 py-3.5">Visits</th>
              <th className="px-5 py-3.5">Total Spent</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {visible.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-neutral-50/60">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-[11.5px] font-extrabold text-primary">
                      {c.name.split(' ').map((w) => w[0]).join('')}
                    </span>
                    <span className="text-[13px] font-bold">{c.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-[12px] font-medium text-neutral-500">
                  <span className="flex items-center gap-1.5">
                    <Phone size={11} className="text-neutral-300" />
                    {c.phone}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-[12.5px] font-bold">{c.visits}</td>
                <td className="px-5 py-3.5 text-[12.5px] font-extrabold text-primary">
                  {formatMoney(c.spent)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => onNewOrder(c)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-[11px] font-bold text-neutral-600 transition-colors hover:border-primary hover:text-primary"
                  >
                    <ShoppingBag size={12} />
                    New Order
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="py-12 text-center text-[12px] font-semibold text-neutral-400">
            No customers match “{query}”
          </p>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[380px] rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-extrabold">New Customer</p>
              <button onClick={() => setAdding(false)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
                <X size={17} />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
                className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[13px] font-medium outline-none focus:border-primary"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone number"
                className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[13px] font-medium outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={() => {
                if (!form.name.trim()) return
                onAdd(form)
                setForm({ name: '', phone: '' })
                setAdding(false)
              }}
              disabled={!form.name.trim()}
              className="mt-5 w-full rounded-xl bg-primary py-3 text-[13px] font-extrabold text-white shadow-md shadow-orange-500/25 hover:bg-primary-dark disabled:opacity-40"
            >
              Save Customer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
