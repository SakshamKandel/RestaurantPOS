import { useState } from 'react'
import { X } from 'lucide-react'
import type { MenuItem, ModifierGroup } from '../data/menu'
import { cloneModifierGroups, modifierSources, suggestModifierSource } from '../modifierAutofill'
import ModifierGroupsEditor from './ModifierGroupsEditor'

interface Props {
  item: MenuItem
  menu: MenuItem[]
  onSave: (groups: ModifierGroup[]) => void
  onClose: () => void
}

export default function ItemModifiersModal({ item, menu, onSave, onClose }: Props) {
  const [groups, setGroups] = useState<ModifierGroup[]>(() =>
    (item.modifiers ?? []).map((group) => ({ ...group, options: group.options.map((option) => ({ ...option })) })),
  )
  const [error, setError] = useState('')
  const [copiedFrom, setCopiedFrom] = useState<{ id: string; name: string } | null>(null)
  const [editorGeneration, setEditorGeneration] = useState(0)
  const sources = modifierSources(menu, item)
  const suggestion = suggestModifierSource(menu, item)

  const copyFrom = (source: MenuItem) => {
    setGroups(cloneModifierGroups(source.modifiers ?? []))
    setCopiedFrom({ id: source.id, name: source.name })
    setEditorGeneration((generation) => generation + 1)
    setError('')
  }

  const startEmpty = () => {
    setGroups([])
    setCopiedFrom(null)
    setEditorGeneration((generation) => generation + 1)
    setError('')
  }

  const save = () => {
    for (const group of groups) {
      if (!group.name.trim()) {
        setError('Enter a name for every modifier group.')
        return
      }
      if (group.options.length === 0) {
        setError(`Add at least one option to "${group.name.trim()}".`)
        return
      }
      if (group.options.some((option) => !option.name.trim())) {
        setError(`Enter a name for every option in "${group.name.trim()}".`)
        return
      }
      if (group.options.some((option) => !Number.isSafeInteger(option.price) || option.price < 0)) {
        setError(`Enter a valid extra price for every option in "${group.name.trim()}".`)
        return
      }
    }
    onSave(groups.map((group) => ({
      ...group,
      name: group.name.trim(),
      options: group.options.map((option) => ({ ...option, name: option.name.trim() })),
    })))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="item-modifiers-title" className="flex max-h-[85vh] w-[560px] max-w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-100 px-6 py-5">
          <div className="min-w-0">
            <h2 id="item-modifiers-title" className="break-words text-[15px] font-extrabold">Modifiers for {item.name}</h2>
            <p className="mt-1 text-[11.5px] font-medium text-neutral-400">These options apply only to this menu item.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modifiers" className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={17} />
          </button>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 rounded-2xl border border-neutral-200 p-3.5">
            {groups.length === 0 && suggestion && (
              <button
                type="button"
                onClick={() => copyFrom(suggestion)}
                className="mb-3 rounded-xl bg-primary-soft px-3 py-2 text-left text-[11.5px] font-extrabold text-primary hover:bg-orange-100"
              >
                Auto-fill from {suggestion.name}
              </button>
            )}
            {sources.length > 0 && (
              <label className="block text-[10.5px] font-bold text-neutral-500">
                Copy modifiers from
                <select
                  value={copiedFrom?.id ?? ''}
                  onChange={(e) => {
                    const source = sources.find((candidate) => candidate.id === e.target.value)
                    if (source) copyFrom(source)
                  }}
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[11.5px] font-medium text-neutral-700 outline-none focus:border-primary"
                >
                  <option value="">Choose an item in this category</option>
                  {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                </select>
              </label>
            )}
            <div className={`flex flex-wrap items-center justify-between gap-2 ${sources.length > 0 ? 'mt-3' : ''}`}>
              {copiedFrom && (
                <p role="status" className="min-w-0 flex-1 text-[10.5px] font-medium text-neutral-500">
                  Copied from {copiedFrom.name} · Changes apply only to this item.
                </p>
              )}
              <button type="button" onClick={startEmpty} className="text-[10.5px] font-bold text-neutral-500 hover:text-primary">
                Start empty
              </button>
            </div>
          </div>
          <ModifierGroupsEditor
            key={editorGeneration}
            groups={groups}
            onChange={(next) => {
              setGroups(next)
              setError('')
            }}
          />
        </div>
        <div className="shrink-0 border-t border-neutral-100 px-6 py-4">
          {error && <p role="alert" className="mb-3 text-[11.5px] font-bold text-red-500">{error}</p>}
          <div className="flex gap-2.5">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-neutral-200 py-3 text-[12.5px] font-bold text-neutral-600 hover:bg-neutral-50">
              Cancel
            </button>
            <button type="button" onClick={save} className="flex-1 rounded-xl bg-primary py-3 text-[12.5px] font-extrabold text-white hover:bg-primary-dark">
              Save modifiers
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
