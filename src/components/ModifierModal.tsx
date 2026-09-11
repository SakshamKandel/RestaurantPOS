import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { formatMoney, type MenuItem, type SelectedMod } from '../data/menu'

interface Props {
  item: MenuItem
  onConfirm: (mods: SelectedMod[]) => void
  onClose: () => void
}

/** Picker shown when an item with modifier groups is added to the cart. */
export default function ModifierModal({ item, onConfirm, onClose }: Props) {
  const groups = item.modifiers ?? []
  // groupId → Set of option names (single-select groups hold at most one)
  const [sel, setSel] = useState<Record<string, Set<string>>>({})

  const toggle = (groupId: string, multi: boolean, opt: string) =>
    setSel((s) => {
      const cur = new Set(s[groupId] ?? [])
      if (cur.has(opt)) cur.delete(opt)
      else if (multi) cur.add(opt)
      else {
        cur.clear()
        cur.add(opt)
      }
      return { ...s, [groupId]: cur }
    })

  const missing = groups.filter((g) => g.required && !(sel[g.id]?.size))

  const mods: SelectedMod[] = useMemo(
    () =>
      groups.flatMap((g) =>
        g.options
          .filter((o) => sel[g.id]?.has(o.name))
          .map((o) => ({ group: g.name, name: o.name, price: o.price })),
      ),
    [groups, sel],
  )
  const extra = mods.reduce((s, m) => s + m.price, 0)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="thin-scroll max-h-[85vh] w-[420px] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[15px] font-extrabold">{item.name}</p>
            <p className="text-[11.5px] font-medium text-neutral-400">
              {formatMoney(item.price)} · choose options
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={17} />
          </button>
        </div>

        {groups.map((g) => (
          <div key={g.id} className="mt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">
              {g.name}
              <span className="ml-1.5 normal-case tracking-normal text-neutral-300">
                {g.required ? 'required' : 'optional'} · {g.multi ? 'pick any' : 'pick one'}
              </span>
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {g.options.map((o) => {
                const on = sel[g.id]?.has(o.name)
                return (
                  <button
                    key={o.id}
                    onClick={() => toggle(g.id, g.multi, o.name)}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-[12.5px] font-bold transition-colors ${
                      on ? 'border-primary bg-primary-soft text-primary' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`flex h-4 w-4 items-center justify-center border ${g.multi ? 'rounded' : 'rounded-full'} ${
                          on ? 'border-primary bg-primary text-white' : 'border-neutral-300'
                        }`}
                      >
                        {on && <Check size={10} strokeWidth={3.5} />}
                      </span>
                      {o.name}
                    </span>
                    {o.price !== 0 && (
                      <span className={on ? 'text-primary' : 'text-neutral-400'}>
                        +{formatMoney(o.price)}
                      </span>
                    )}
                  </button>
                )
              })}
              {g.options.length === 0 && (
                <p className="text-[11px] font-medium text-neutral-300">No options configured</p>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={() => onConfirm(mods)}
          disabled={missing.length > 0}
          className="mt-5 w-full rounded-xl bg-primary py-3 text-[13px] font-extrabold text-white shadow-md shadow-orange-500/25 hover:bg-primary-dark disabled:opacity-40"
        >
          {missing.length > 0
            ? `Pick ${missing.map((g) => g.name).join(', ')}`
            : `Add to order · ${formatMoney(item.price + extra)}`}
        </button>
      </div>
    </div>
  )
}
