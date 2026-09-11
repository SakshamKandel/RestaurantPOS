import { useState } from 'react'
import { Pencil, Phone, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react'
import { formatMoney, type Customer } from '../data/menu'

interface Props {
  customers: Customer[]
  onAdd: (c: Omit<Customer, 'id' | 'visits' | 'spent'>) => void
  onUpdate: (id: string, patch: Partial<Customer>) => void
  onDelete: (id: string) => void
  onNewOrder: (c: Customer) => void
}

export default function CustomersPage({ customers, onAdd, onUpdate, onDelete, onNewOrder }: Props) {
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<{ id: string | null; name: string; phone: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const visible = customers.filter(
    (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
  )

  const submit = () => {
    if (!form || !form.name.trim()) return
    if (form.id) onUpdate(form.id, { name: form.name.trim(), phone: form.phone.trim() })
    else onAdd({ name: form.name.trim(), phone: form.phone.trim() })
    setForm(null)
  }

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
            onClick={() => setForm({ id: null, name: '', phone: '' })}
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
              <th className="px-5 py-3.5 text-right">Actions</th>
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
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onNewOrder(c)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-[11px] font-bold text-neutral-600 transition-colors hover:border-primary hover:text-primary"
                    >
                      <ShoppingBag size={12} />
                      New Order
                    </button>
                    <button
                      onClick={() => setForm({ id: c.id, name: c.name, phone: c.phone })}
                      title="Edit customer"
                      className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-primary hover:text-primary"
                    >
                      <Pencil size={13} />
                    </button>
                    {c.id === 'c5' ? (
                      <span className="w-7" title="Walk-in can't be deleted" />
                    ) : confirmDelete === c.id ? (
                      <button
                        onClick={() => { onDelete(c.id); setConfirmDelete(null) }}
                        onMouseLeave={() => setConfirmDelete(null)}
                        className="rounded-lg bg-red-500 px-2.5 py-1.5 text-[10.5px] font-bold text-white"
                      >
                        Sure?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(c.id)}
                        title="Delete customer"
                        className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-red-300 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
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

      {form && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[380px] rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-extrabold">{form.id ? 'Edit Customer' : 'New Customer'}</p>
              <button onClick={() => setForm(null)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
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
              onClick={submit}
              disabled={!form.name.trim()}
              className="mt-5 w-full rounded-xl bg-primary py-3 text-[13px] font-extrabold text-white shadow-md shadow-orange-500/25 hover:bg-primary-dark disabled:opacity-40"
            >
              {form.id ? 'Save Changes' : 'Save Customer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
