import { useState } from 'react'
import { FolderCog, ImagePlus, Package, Pencil, Plus, Search, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import { pickImage } from '../store'
import {
  formatMoney,
  ICONS,
  ICON_NAMES,
  type Category,
  type CategoryId,
  type IconName,
  type MenuItem,
  type ModifierGroup,
  type TaxClass,
} from '../data/menu'

const uid = () => Math.random().toString(36).slice(2, 9)

interface ItemForm {
  id: string | null
  name: string
  price: string
  cost: string
  category: CategoryId
  available: boolean
  image: string
  emoji: string
  taxClass: string // '' = store default rate
  stock: string // '' = not tracked
  lowStockAt: string
  modifiers: ModifierGroup[]
}

const emptyForm = (category: CategoryId): ItemForm => ({
  id: null,
  name: '',
  price: '',
  cost: '',
  category,
  available: true,
  image: '',
  emoji: '🍽️',
  taxClass: '',
  stock: '',
  lowStockAt: '5',
  modifiers: [],
})

interface Props {
  menu: MenuItem[]
  categories: Category[]
  taxClasses: TaxClass[]
  onSave: (item: MenuItem) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  onSaveCategory: (c: Category) => void
  onDeleteCategory: (id: string) => void
  /** Adjust tracked stock for an item (inventory). */
  onStock?: (id: string, delta: number, reason: string) => void
}

export default function MenuPage({ menu, categories, taxClasses, onSave, onDelete, onToggle, onSaveCategory, onDeleteCategory, onStock }: Props) {
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
      cost: m.cost === undefined ? '' : (m.cost / 100).toFixed(2),
      category: m.category,
      available: m.available,
      image: m.image,
      emoji: m.emoji,
      taxClass: m.taxClass ?? '',
      stock: m.stock === undefined ? '' : String(m.stock),
      lowStockAt: String(m.lowStockAt ?? 5),
      modifiers: (m.modifiers ?? []).map((g) => ({ ...g, options: g.options.map((o) => ({ ...o })) })),
    })

  const submit = () => {
    if (!form || !form.name.trim() || !form.price) return
    const cents = Math.round(parseFloat(form.price) * 100)
    if (Number.isNaN(cents) || cents < 0) return
    const costCents = form.cost.trim() === '' ? undefined : Math.round(parseFloat(form.cost) * 100)
    const cost = costCents === undefined || Number.isNaN(costCents) || costCents < 0 ? undefined : costCents
    const stock = form.stock.trim() === '' ? undefined : Math.max(0, Math.round(parseInt(form.stock, 10) || 0))
    onSave({
      id: form.id ?? `item-${Date.now()}`,
      name: form.name.trim(),
      price: cents,
      cost,
      category: form.category,
      // tracked stock hitting 0 auto-marks sold out
      available: stock === 0 ? false : form.available,
      image: form.image.trim(), // '' → emoji tile; never fetch a placeholder from the internet
      emoji: form.emoji.trim() || '🍽️',
      taxClass: form.taxClass || undefined,
      stock,
      lowStockAt: stock === undefined ? undefined : Math.max(0, parseInt(form.lowStockAt, 10) || 0),
      modifiers: form.modifiers
        .filter((g) => g.name.trim() && g.options.length)
        .map((g) => ({ ...g, name: g.name.trim(), options: g.options.filter((o) => o.name.trim()) })),
    })
    setForm(null)
  }

  const setGroup = (gi: number, patch: Partial<ModifierGroup>) =>
    setForm((f) => f && ({ ...f, modifiers: f.modifiers.map((g, i) => (i === gi ? { ...g, ...patch } : g)) }))

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
            onClick={() => {
              if (!categories.length) return setCatManager(true)
              setForm(emptyForm(catFilter === 'all' ? categories[0].id : catFilter))
            }}
            title={categories.length ? 'Add a menu item' : 'Create a category first'}
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
              <th className="px-5 py-3.5">Stock</th>
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
                  {m.stock === undefined ? (
                    <span className="text-[11px] font-medium text-neutral-300">—</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span
                        className={`text-[12.5px] font-extrabold ${
                          m.stock === 0 ? 'text-red-500' : m.stock <= (m.lowStockAt ?? 5) ? 'text-amber-600' : 'text-neutral-700'
                        }`}
                      >
                        {m.stock}
                      </span>
                      {onStock && (
                        <span className="flex items-center rounded-md bg-neutral-100">
                          <button onClick={() => onStock(m.id, -1, 'manual adjust')} className="px-1.5 py-0.5 text-neutral-500 hover:text-primary" title="Stock −1"><span className="text-[12px] font-extrabold">−</span></button>
                          <button onClick={() => onStock(m.id, 1, 'manual adjust')} className="px-1.5 py-0.5 text-neutral-500 hover:text-primary" title="Stock +1"><Plus size={11} strokeWidth={3} /></button>
                        </span>
                      )}
                      {m.stock <= (m.lowStockAt ?? 5) && m.stock > 0 && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">LOW</span>
                      )}
                    </span>
                  )}
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
          <div className="thin-scroll max-h-[88vh] w-[480px] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
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
                <input
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="Cost (optional)"
                  title="Unit cost — powers the margin report"
                  inputMode="decimal"
                  className="w-32 rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[13px] font-medium outline-none focus:border-primary"
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

              {/* Tax class */}
              <div className="flex items-center gap-3">
                <label className="w-24 shrink-0 text-[11.5px] font-bold text-neutral-500">Tax class</label>
                <select
                  value={form.taxClass}
                  onChange={(e) => setForm({ ...form, taxClass: e.target.value })}
                  className="flex-1 cursor-pointer rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none"
                >
                  <option value="">Default rate</option>
                  {taxClasses.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({(t.rate * 100).toFixed(2)}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock */}
              <div className="flex items-center gap-3">
                <label className="flex w-24 shrink-0 items-center gap-1.5 text-[11.5px] font-bold text-neutral-500">
                  <Package size={13} /> Stock
                </label>
                <input
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/\D/g, '') })}
                  placeholder="— not tracked"
                  inputMode="numeric"
                  className="flex-1 rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none focus:border-primary"
                />
                <input
                  value={form.lowStockAt}
                  onChange={(e) => setForm({ ...form, lowStockAt: e.target.value.replace(/\D/g, '') })}
                  placeholder="Low at"
                  title="Warn when stock drops to this level"
                  inputMode="numeric"
                  disabled={form.stock.trim() === ''}
                  className="w-20 rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none focus:border-primary disabled:opacity-40"
                />
              </div>

              {/* Modifier groups */}
              <div className="rounded-2xl bg-neutral-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11.5px] font-extrabold text-neutral-500">Modifiers / add-ons</p>
                  <button
                    onClick={() =>
                      setForm({
                        ...form,
                        modifiers: [
                          ...form.modifiers,
                          { id: uid(), name: '', required: false, multi: false, options: [] },
                        ],
                      })
                    }
                    className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-dark"
                  >
                    <Plus size={13} strokeWidth={3} /> Add group
                  </button>
                </div>
                {form.modifiers.map((g, gi) => (
                  <div key={g.id} className="mt-3 rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={g.name}
                        onChange={(e) => setGroup(gi, { name: e.target.value })}
                        placeholder="Group (e.g. Size, Extras)"
                        className="flex-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[12px] font-bold outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => setGroup(gi, { required: !g.required })}
                        title="Customer must pick at least one option"
                        className={`rounded-lg px-2 py-1.5 text-[10px] font-bold ${g.required ? 'bg-primary-soft text-primary' : 'bg-neutral-100 text-neutral-400'}`}
                      >
                        Req
                      </button>
                      <button
                        onClick={() => setGroup(gi, { multi: !g.multi })}
                        title="Multi-select vs pick-one"
                        className={`rounded-lg px-2 py-1.5 text-[10px] font-bold ${g.multi ? 'bg-primary-soft text-primary' : 'bg-neutral-100 text-neutral-400'}`}
                      >
                        Multi
                      </button>
                      <button
                        onClick={() => setForm({ ...form, modifiers: form.modifiers.filter((_, i) => i !== gi) })}
                        className="rounded-lg p-1.5 text-neutral-300 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {g.options.map((o, oi) => (
                      <div key={o.id} className="mt-2 flex items-center gap-2">
                        <input
                          value={o.name}
                          onChange={(e) =>
                            setGroup(gi, { options: g.options.map((x, i) => (i === oi ? { ...x, name: e.target.value } : x)) })
                          }
                          placeholder="Option name"
                          className="flex-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11.5px] font-medium outline-none focus:border-primary"
                        />
                        <input
                          value={o.price === 0 ? '' : (o.price / 100).toString()}
                          onChange={(e) => {
                            const v = Math.round(parseFloat(e.target.value || '0') * 100)
                            setGroup(gi, { options: g.options.map((x, i) => (i === oi ? { ...x, price: Number.isNaN(v) ? 0 : Math.max(0, v) } : x)) })
                          }}
                          placeholder="+0.00"
                          inputMode="decimal"
                          className="w-20 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-right text-[11.5px] font-medium outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => setGroup(gi, { options: g.options.filter((_, i) => i !== oi) })}
                          className="rounded-lg p-1 text-neutral-300 hover:text-red-500"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setGroup(gi, { options: [...g.options, { id: uid(), name: '', price: 0 }] })}
                      className="mt-2 flex items-center gap-1 text-[10.5px] font-bold text-neutral-400 hover:text-primary"
                    >
                      <Plus size={12} strokeWidth={3} /> Add option
                    </button>
                  </div>
                ))}
                {form.modifiers.length === 0 && (
                  <p className="mt-2 text-[10.5px] font-medium text-neutral-400">
                    e.g. Size (Small/Large), Extras (extra cheese +$1.50)
                  </p>
                )}
              </div>
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
