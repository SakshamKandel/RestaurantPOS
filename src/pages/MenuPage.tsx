import { useState } from 'react'
import { FolderCog, ImagePlus, Pencil, Plus, Search, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import { pickImage } from '../store'
import {
  formatMoney,
  ICONS,
  ICON_NAMES,
  type Category,
  type CategoryId,
  type IconName,
  type MenuItem,
} from '../data/menu'

interface ItemForm {
  id: string | null
  name: string
  price: string
  category: CategoryId
  available: boolean
  image: string
  emoji: string
}

const emptyForm: ItemForm = {
  id: null,
  name: '',
  price: '',
  category: 'sushi',
  available: true,
  image: '',
  emoji: '🍽️',
}

interface Props {
  menu: MenuItem[]
  categories: Category[]
  onSave: (item: MenuItem) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  onSaveCategory: (c: Category) => void
  onDeleteCategory: (id: string) => void
}

export default function MenuPage({ menu, categories, onSave, onDelete, onToggle, onSaveCategory, onDeleteCategory }: Props) {
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState<CategoryId | 'all'>('all')
  const [form, setForm] = useState<ItemForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [catManager, setCatManager] = useState(false)
  const [catForm, setCatForm] = useState<{ id: string | null; label: string; icon: IconName } | null>(null)

  const q = query.trim().toLowerCase()
  const visible = menu.filter(
    (m) =>
      (catFilter === 'all' || m.category === catFilter) &&
      m.name.toLowerCase().includes(q),
  )

  const catLabel = (id: CategoryId) => categories.find((c) => c.id === id)?.label ?? id
  const catItemCount = (id: CategoryId) => menu.filter((m) => m.category === id).length

  const openEdit = (m: MenuItem) =>
    setForm({
      id: m.id,
      name: m.name,
      price: (m.price / 100).toFixed(2),
      category: m.category,
      available: m.available,
      image: m.image,
      emoji: m.emoji,
    })

  const submit = () => {
    if (!form || !form.name.trim() || !form.price) return
    const cents = Math.round(parseFloat(form.price) * 100)
    if (Number.isNaN(cents) || cents < 0) return
    onSave({
      id: form.id ?? `item-${Date.now()}`,
      name: form.name.trim(),
      price: cents,
      category: form.category,
      available: form.available,
      image: form.image.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=640&q=80',
      emoji: form.emoji.trim() || '🍽️',
    })
    setForm(null)
  }

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="flex items-center justify-between pt-6">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight">Menu Management</h1>
          <p className="text-[12px] font-medium text-neutral-400">
            {menu.length} items · {menu.filter((m) => m.available).length} available
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCatManager(true)}
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-[12.5px] font-extrabold text-neutral-600 hover:border-primary hover:text-primary"
          >
            <FolderCog size={15} />
            Categories
          </button>
          <label className="flex w-[240px] items-center gap-2.5 rounded-2xl border border-neutral-200/80 bg-white px-4 py-2.5 shadow-sm">
            <Search size={15} className="text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items"
              className="w-full bg-transparent text-[12.5px] font-medium outline-none placeholder:text-neutral-400"
            />
          </label>
          <button
            onClick={() => setForm(emptyForm)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12.5px] font-extrabold text-white shadow-md shadow-orange-500/25 hover:bg-primary-dark"
          >
            <Plus size={15} strokeWidth={2.6} />
            Add Item
          </button>
        </div>
      </header>

      {/* Category filter */}
      <div className="mt-4 flex gap-2">
        {[{ id: 'all' as const, label: 'All' }, ...categories].map((c) => (
          <button
            key={c.id}
            onClick={() => setCatFilter(c.id)}
            className={`rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
              catFilter === c.id
                ? 'border-primary bg-white text-primary shadow-sm'
                : 'border-transparent bg-white text-neutral-500 hover:border-neutral-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-100 text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
              <th className="px-5 py-3.5">Item</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Price</th>
              <th className="px-5 py-3.5">Availability</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {visible.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-neutral-50/60">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 text-lg">
                      {m.image ? (
                        <img src={m.image} alt="" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                      ) : (
                        m.emoji
                      )}
                    </span>
                    <span className="text-[13px] font-bold">{m.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-md bg-neutral-100 px-2 py-1 text-[10.5px] font-bold text-neutral-500">
                    {catLabel(m.category)}
                  </span>
                </td>
                <td className="px-5 py-3 text-[12.5px] font-extrabold text-primary">
                  {formatMoney(m.price)}
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => onToggle(m.id)}
                    className={`flex items-center gap-1.5 text-[11.5px] font-bold ${m.available ? 'text-emerald-600' : 'text-neutral-400'}`}
                  >
                    {m.available ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    {m.available ? 'Available' : 'Sold out'}
                  </button>
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => openEdit(m)}
                      className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-primary hover:text-primary"
                    >
                      <Pencil size={13} />
                    </button>
                    {confirmDelete === m.id ? (
                      <button
                        onClick={() => { onDelete(m.id); setConfirmDelete(null) }}
                        onMouseLeave={() => setConfirmDelete(null)}
                        className="rounded-lg bg-red-500 px-2.5 py-1.5 text-[10.5px] font-bold text-white"
                      >
                        Sure?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(m.id)}
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
            No items match your filters
          </p>
        )}
      </div>

      {/* Add / Edit modal */}
      {form && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[400px] rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-extrabold">
                {form.id ? 'Edit Item' : 'New Menu Item'}
              </p>
              <button onClick={() => setForm(null)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
                <X size={17} />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Item name"
                className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[13px] font-medium outline-none focus:border-primary"
              />
              <div className="flex gap-3">
                <input
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="Price (e.g. 9.50)"
                  inputMode="decimal"
                  className="flex-1 rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[13px] font-medium outline-none focus:border-primary"
                />
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as CategoryId })}
                  className="flex-1 cursor-pointer rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[13px] font-medium outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="Image URL (optional)"
                  className="flex-1 rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[13px] font-medium outline-none focus:border-primary"
                />
                <button
                  onClick={async () => {
                    const url = await pickImage()
                    if (url) setForm((f) => (f ? { ...f, image: url } : f))
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3.5 text-[11.5px] font-bold text-neutral-600 transition-colors hover:border-primary hover:text-primary"
                >
                  <ImagePlus size={15} />
                  Upload
                </button>
              </div>
              {form.image && (
                <img src={form.image} alt="" className="h-20 w-20 rounded-xl object-cover" />
              )}
              <input
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                placeholder="Emoji fallback (optional)"
                className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[13px] font-medium outline-none focus:border-primary"
              />
              <button
                onClick={() => setForm({ ...form, available: !form.available })}
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-[12.5px] font-bold ${
                  form.available ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-neutral-200 text-neutral-500'
                }`}
              >
                Available for sale
                {form.available ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              </button>
            </div>
            <button
              onClick={submit}
              disabled={!form.name.trim() || !form.price}
              className="mt-5 w-full rounded-xl bg-primary py-3 text-[13px] font-extrabold text-white shadow-md shadow-orange-500/25 hover:bg-primary-dark disabled:opacity-40"
            >
              {form.id ? 'Save Changes' : 'Add to Menu'}
            </button>
          </div>
        </div>
      )}

      {/* Category manager modal */}
      {catManager && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[440px] rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-extrabold">Food Categories</p>
              <button onClick={() => { setCatManager(false); setCatForm(null) }} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
                <X size={17} />
              </button>
            </div>

            <ul className="mt-4 flex flex-col divide-y divide-neutral-100">
              {categories.map((c) => {
                const Icon = ICONS[c.icon] ?? ICONS.soup
                const count = catItemCount(c.id)
                return (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
                      <Icon size={16} />
                    </span>
                    <span className="flex-1 text-[13px] font-bold">
                      {c.label}
                      <span className="ml-2 text-[10.5px] font-medium text-neutral-400">{count} items</span>
                    </span>
                    <button
                      onClick={() => setCatForm({ id: c.id, label: c.label, icon: c.icon })}
                      className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 hover:border-primary hover:text-primary"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteCategory(c.id)}
                      disabled={count > 0}
                      title={count > 0 ? 'Move items out first' : 'Delete category'}
                      className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                )
              })}
            </ul>

            {/* Add / edit category */}
            <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
              <p className="text-[11.5px] font-extrabold text-neutral-500">
                {catForm?.id ? 'Edit Category' : 'New Category'}
              </p>
              <div className="mt-2.5 flex gap-2">
                <input
                  value={catForm?.label ?? ''}
                  onChange={(e) => setCatForm({ id: catForm?.id ?? null, label: e.target.value, icon: catForm?.icon ?? 'soup' })}
                  placeholder="Category name"
                  className="flex-1 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[12.5px] font-medium outline-none focus:border-primary"
                />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {ICON_NAMES.map((n) => {
                  const Icon = ICONS[n]
                  return (
                    <button
                      key={n}
                      onClick={() => setCatForm({ id: catForm?.id ?? null, label: catForm?.label ?? '', icon: n })}
                      title={n}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                        catForm?.icon === n ? 'border-primary bg-primary-soft text-primary' : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                      }`}
                    >
                      <Icon size={15} />
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => {
                  if (!catForm?.label.trim()) return
                  onSaveCategory({
                    id: catForm.id ?? catForm.label.trim().toLowerCase().replace(/\s+/g, '-'),
                    label: catForm.label.trim(),
                    icon: catForm.icon,
                  })
                  setCatForm(null)
                }}
                disabled={!catForm?.label.trim()}
                className="mt-3 w-full rounded-xl bg-primary py-2.5 text-[12.5px] font-extrabold text-white hover:bg-primary-dark disabled:opacity-40"
              >
                {catForm?.id ? 'Save Category' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
