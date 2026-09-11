import { useState } from 'react'
import { KeyRound, Pencil, Plus, ShieldCheck, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { assignableRoles, canManage, type Role, type Staff } from '../data/menu'

interface StaffForm {
  id: string | null
  name: string
  role: Role
  pin: string
}

const emptyForm: StaffForm = { id: null, name: '', role: 'cashier', pin: '' }

const ROLE_BADGE: Record<Role, string> = {
  admin: 'bg-neutral-800 text-white',
  manager: 'bg-violet-100 text-violet-600',
  cashier: 'bg-sky-100 text-sky-600',
  kitchen: 'bg-emerald-100 text-emerald-600',
}

interface Props {
  staff: Staff[]
  currentUserId: string
  currentRole: Role
  onAdd: (s: Omit<Staff, 'id' | 'initials' | 'color' | 'active' | 'mustChangePin'>) => void
  onUpdate: (id: string, patch: Partial<Staff>) => void
  onResetPin: (id: string) => string
  onToggleActive: (id: string) => void
}

export default function StaffPage({ staff, currentUserId, currentRole, onAdd, onUpdate, onResetPin, onToggleActive }: Props) {
  const [form, setForm] = useState<StaffForm | null>(null)
  const [tempPin, setTempPin] = useState<{ name: string; pin: string } | null>(null)
  const roles = assignableRoles(currentRole)
  // Nobody administers their own account; managers only handle front-line staff.
  const mayManage = (s: Staff) => s.id !== currentUserId && canManage(currentRole, s.role)
  const isAdmin = currentRole === 'admin'

  const submit = () => {
    if (!form) return
    if (form.id) {
      onUpdate(form.id, { name: form.name.trim(), role: form.role })
    } else {
      if (!/^\d{4}$/.test(form.pin)) return
      onAdd({ name: form.name.trim(), role: form.role, pin: form.pin })
    }
    setForm(null)
  }

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="flex items-center justify-between pt-6">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight">Staff Management</h1>
          <p className="text-[12px] font-medium text-neutral-400">
            {staff.filter((s) => s.active).length} active · {staff.length} total accounts
            {isAdmin ? ' · owner access' : ' · managers can only administer cashiers and kitchen staff'}
          </p>
        </div>
        <button
          onClick={() => setForm({ ...emptyForm, role: roles[0] ?? 'cashier' })}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12.5px] font-extrabold text-white shadow-md shadow-orange-500/25 hover:bg-primary-dark"
        >
          <Plus size={15} strokeWidth={2.6} />
          Add Staff
        </button>
      </header>

      <div className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-100 text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
              <th className="px-5 py-3.5">Staff</th>
              <th className="px-5 py-3.5">Role</th>
              <th className="px-5 py-3.5">PIN</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {staff.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-neutral-50/60">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-[11.5px] font-extrabold text-white ${s.color}`}>
                      {s.initials}
                    </span>
                    <span className="text-[13px] font-bold">
                      {s.name}
                      {s.id === currentUserId && (
                        <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold text-neutral-400">YOU</span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-md px-2 py-1 text-[10px] font-bold capitalize ${ROLE_BADGE[s.role]}`}>
                    {s.role}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {s.mustChangePin ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <ShieldCheck size={12} /> One-time PIN pending
                    </span>
                  ) : (
                    <span className="font-mono text-[12px] font-bold tracking-[0.3em] text-neutral-400">••••</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => mayManage(s) && onToggleActive(s.id)}
                    disabled={!mayManage(s)}
                    title={s.id === currentUserId ? "You can't deactivate yourself" : !canManage(currentRole, s.role) ? 'Only the administrator can change managers' : undefined}
                    className={`flex items-center gap-1.5 text-[11.5px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
                      s.active ? 'text-emerald-600' : 'text-neutral-400'
                    }`}
                  >
                    {s.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    {s.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-5 py-3.5">
                  {mayManage(s) ? (
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setForm({ id: s.id, name: s.name, role: s.role, pin: '' })}
                        title="Edit name / role"
                        className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-primary hover:text-primary"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => {
                          const pin = onResetPin(s.id)
                          setTempPin({ name: s.name, pin })
                        }}
                        title="Reset PIN — issues a one-time PIN"
                        className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-amber-300 hover:text-amber-600"
                      >
                        <KeyRound size={13} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-right text-[10px] font-medium text-neutral-300">
                      {s.id === currentUserId ? 'Forgot your PIN? Ask the administrator' : 'Administrator only'}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal */}
      {form && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[400px] rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-extrabold">{form.id ? 'Edit Staff' : 'Add Staff'}</p>
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
              <div className={`grid gap-2 ${roles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {roles.map((r) => (
                  <button
                    key={r}
                    onClick={() => setForm({ ...form, role: r })}
                    className={`rounded-xl border py-2.5 text-[12px] font-bold capitalize transition-colors ${
                      form.role === r ? 'border-primary bg-primary-soft text-primary' : 'border-neutral-200 text-neutral-500'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {!form.id && (
                <input
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="Set 4-digit PIN"
                  inputMode="numeric"
                  maxLength={4}
                  className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-center text-[15px] font-extrabold tracking-[0.4em] outline-none focus:border-primary"
                />
              )}
            </div>
            <button
              onClick={submit}
              disabled={!form.name.trim() || (!form.id && !/^\d{4}$/.test(form.pin))}
              className="mt-5 w-full rounded-xl bg-primary py-3 text-[13px] font-extrabold text-white shadow-md shadow-orange-500/25 hover:bg-primary-dark disabled:opacity-40"
            >
              {form.id ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </div>
      )}

      {/* One-time PIN reveal */}
      {tempPin && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[340px] rounded-3xl bg-white p-6 text-center shadow-2xl">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <KeyRound size={22} />
            </span>
            <p className="mt-3 text-[15px] font-extrabold">One-time PIN issued</p>
            <p className="mt-1 text-[11.5px] font-medium text-neutral-400">
              Give this to {tempPin.name}. They must set a new PIN at next login — this is shown once.
            </p>
            <p className="mt-4 rounded-2xl bg-neutral-900 py-4 font-mono text-[26px] font-extrabold tracking-[0.5em] text-white">
              {tempPin.pin}
            </p>
            <button
              onClick={() => setTempPin(null)}
              className="mt-4 w-full rounded-xl bg-primary py-3 text-[13px] font-extrabold text-white hover:bg-primary-dark"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
