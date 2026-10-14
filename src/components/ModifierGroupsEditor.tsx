import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import type { ModifierGroup, ModifierOption } from '../data/menu'

interface Props {
  groups: ModifierGroup[]
  onChange: (groups: ModifierGroup[]) => void
}

const uid = () => Math.random().toString(36).slice(2, 9)

export default function ModifierGroupsEditor({ groups, onChange }: Props) {
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const setGroup = (index: number, patch: Partial<ModifierGroup>) =>
    onChange(groups.map((group, i) => i === index ? { ...group, ...patch } : group))
  const setOption = (groupIndex: number, optionIndex: number, patch: Partial<ModifierOption>) =>
    setGroup(groupIndex, {
      options: groups[groupIndex].options.map((option, i) => i === optionIndex ? { ...option, ...patch } : option),
    })

  return (
    <div className="rounded-2xl bg-neutral-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11.5px] font-extrabold text-neutral-500">Modifiers / add-ons</p>
        <button
          type="button"
          onClick={() => onChange([...groups, { id: uid(), name: '', required: false, multi: false, options: [] }])}
          className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-dark"
        >
          <Plus size={13} strokeWidth={3} /> Add group
        </button>
      </div>
      {groups.map((group, groupIndex) => (
        <div key={group.id} className="mt-3 rounded-xl border border-neutral-200 bg-white p-3">
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-[10.5px] font-bold text-neutral-500">
              Group name
              <input
                value={group.name}
                onChange={(e) => setGroup(groupIndex, { name: e.target.value })}
                placeholder="e.g. Size or Extras"
                className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-[12px] font-bold text-neutral-700 outline-none focus:border-primary"
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(groups.filter((_, i) => i !== groupIndex))}
              aria-label={`Remove ${group.name || `group ${groupIndex + 1}`}`}
              title="Remove group"
              className="mb-0.5 rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setGroup(groupIndex, { required: !group.required })}
              aria-pressed={group.required}
              className={`rounded-lg border px-2.5 py-2 text-left ${group.required ? 'border-primary/25 bg-primary-soft text-primary' : 'border-neutral-200 bg-neutral-50 text-neutral-500'}`}
            >
              <span className="block text-[10.5px] font-extrabold">Required {group.required ? '· On' : '· Off'}</span>
              <span className="mt-0.5 block text-[9.5px] font-medium">{group.required ? 'Choose at least one option' : 'Customer can skip this group'}</span>
            </button>
            <button
              type="button"
              onClick={() => setGroup(groupIndex, { multi: !group.multi })}
              aria-pressed={group.multi}
              className={`rounded-lg border px-2.5 py-2 text-left ${group.multi ? 'border-primary/25 bg-primary-soft text-primary' : 'border-neutral-200 bg-neutral-50 text-neutral-500'}`}
            >
              <span className="block text-[10.5px] font-extrabold">Multiple choice {group.multi ? '· On' : '· Off'}</span>
              <span className="mt-0.5 block text-[9.5px] font-medium">{group.multi ? 'Choose more than one option' : 'Choose one option at most'}</span>
            </button>
          </div>
          {group.options.length > 0 && (
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_88px_28px] gap-2 text-[10px] font-bold text-neutral-400">
              <span>Option name</span>
              <span className="text-right">Extra price</span>
              <span />
            </div>
          )}
          {group.options.map((option, optionIndex) => (
            <div key={option.id} className="mt-2 grid grid-cols-[minmax(0,1fr)_88px_28px] items-center gap-2">
              <input
                value={option.name}
                onChange={(e) => setOption(groupIndex, optionIndex, { name: e.target.value })}
                aria-label={`Option ${optionIndex + 1} name in ${group.name || `group ${groupIndex + 1}`}`}
                placeholder="e.g. Large or Extra cheese"
                className="min-w-0 rounded-lg border border-neutral-200 px-2.5 py-2 text-[11.5px] font-medium outline-none focus:border-primary"
              />
              <input
                value={priceDrafts[option.id] ?? (option.price === 0 ? '' : (option.price / 100).toFixed(2))}
                onChange={(e) => {
                  const raw = e.target.value
                  setPriceDrafts((drafts) => ({ ...drafts, [option.id]: raw }))
                  const cents = Math.round(Number(raw.trim() || '0') * 100)
                  setOption(groupIndex, optionIndex, { price: Number.isSafeInteger(cents) ? Math.max(0, cents) : 0 })
                }}
                onBlur={() => setPriceDrafts((drafts) => {
                  const next = { ...drafts }
                  delete next[option.id]
                  return next
                })}
                aria-label={`Extra price for ${option.name || `option ${optionIndex + 1}`}`}
                placeholder="0.00"
                inputMode="decimal"
                type="number"
                min="0"
                step="0.01"
                className="min-w-0 rounded-lg border border-neutral-200 px-2.5 py-2 text-right text-[11.5px] font-medium outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setGroup(groupIndex, { options: group.options.filter((_, i) => i !== optionIndex) })}
                aria-label={`Remove ${option.name || `option ${optionIndex + 1}`}`}
                title="Remove option"
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setGroup(groupIndex, { options: [...group.options, { id: uid(), name: '', price: 0 }] })}
            className="mt-3 flex items-center gap-1 text-[10.5px] font-bold text-neutral-500 hover:text-primary"
          >
            <Plus size={12} strokeWidth={3} /> Add option
          </button>
        </div>
      ))}
      {groups.length === 0 && (
        <p className="mt-2 text-[10.5px] font-medium text-neutral-400">
          Add groups such as Size or Extras, then add the choices for this item.
        </p>
      )}
    </div>
  )
}
