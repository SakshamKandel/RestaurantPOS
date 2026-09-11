import { useState } from 'react'
import { AlertTriangle, CheckCircle2, KeyRound, ShieldCheck, Trash2, X } from 'lucide-react'
import { SUPER_ADMIN, type Staff } from '../data/menu'
import { isDesktop, resetDatabase, verifyLogin } from '../store'

interface Props {
  staff: Staff[]
  onClose: () => void
}

/**
 * Factory-reset gate: needs BOTH a verified manager/Administrator PIN and the
 * literal word RESET typed before the erase button unlocks. On desktop the app
 * relaunches into first-boot setup — the promise never resolves on success.
 */
export default function ResetModal({ staff, onClose }: Props) {
  // Who can authorize: the hidden Administrator or any active manager.
  const authorizers = [SUPER_ADMIN, ...staff.filter((s) => s.active && s.role === 'manager')]
  const [who, setWho] = useState(SUPER_ADMIN.id)
  const [pin, setPin] = useState('')
  const [phrase, setPhrase] = useState('')
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const verify = async () => {
    if (busy || pin.length < 4) return
    setBusy(true)
    setError('')
    const r = await verifyLogin(who, pin, staff)
    setBusy(false)
    if (r.ok) return setVerified(true)
    setPin('')
    setError(
      r.lockSeconds
        ? `Too many attempts — locked for ${r.lockSeconds >= 60 ? `${Math.round(r.lockSeconds / 60)} min` : `${r.lockSeconds}s`}`
        : r.reason === 'no-account'
          ? 'Account not found'
          : `Wrong PIN, try again${r.fails && r.fails >= 2 ? ` (${r.fails} failed)` : ''}`,
    )
  }

  const ready = verified && phrase.trim().toUpperCase() === 'RESET'

  const erase = async () => {
    if (!ready || busy) return
    setBusy(true)
    const name = authorizers.find((a) => a.id === who)?.name ?? who
    const ok = await resetDatabase(name)
    setBusy(false)
    if (!ok) setError('Reset is only available in the desktop app')
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[440px] rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-[15px] font-extrabold">Reset database</p>
              <p className="text-[11.5px] font-medium text-neutral-400">
                Factory reset — this cannot be undone
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={17} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3.5">
          <p className="text-[11.5px] font-bold text-red-500">This permanently deletes:</p>
          <ul className="mt-1.5 list-inside list-disc text-[11px] font-medium leading-relaxed text-red-400">
            <li>All orders, transactions and refunds</li>
            <li>Shifts, drawer movements and the audit trail</li>
            <li>Menu, categories, customers and staff accounts</li>
            <li>Store settings and printer assignments</li>
          </ul>
          <p className="mt-2 text-[10.5px] font-medium text-red-400">
            Kept: the backups folder (a final snapshot is taken automatically), error logs and menu photos.
          </p>
        </div>

        {/* Authorization — a manager or the Administrator must enter their PIN */}
        <div className="mt-4 grid grid-cols-[1fr_130px] gap-2.5">
          <label className="block">
            <span className="text-[11px] font-bold text-neutral-500">Authorized by</span>
            <select
              value={who}
              onChange={(e) => {
                setWho(e.target.value)
                setVerified(false)
                setPin('')
                setError('')
              }}
              className="mt-1 w-full cursor-pointer rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none focus:border-primary"
            >
              {authorizers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.id === SUPER_ADMIN.id ? ' (owner)' : ' — manager'}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-neutral-500">PIN</span>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                setVerified(false)
                setError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && void verify()}
              placeholder="4–6 digits"
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-bold tracking-widest outline-none focus:border-primary"
            />
          </label>
        </div>

        <button
          onClick={() => void verify()}
          disabled={busy || verified || pin.length < 4}
          className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-extrabold transition-colors ${
            verified
              ? 'bg-emerald-100 text-emerald-600'
              : 'bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40'
          }`}
        >
          {verified ? (
            <>
              <CheckCircle2 size={14} />
              {authorizers.find((a) => a.id === who)?.name} authorized
            </>
          ) : (
            <>
              <KeyRound size={14} />
              {busy ? 'Verifying…' : 'Verify PIN'}
            </>
          )}
        </button>
        {error && <p className="mt-2 text-center text-[11px] font-bold text-red-500">{error}</p>}

        <label className="mt-4 block">
          <span className="text-[11px] font-bold text-neutral-500">
            Type <span className="font-mono text-red-500">RESET</span> to confirm
          </span>
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="RESET"
            autoComplete="off"
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 font-mono text-[12.5px] font-bold uppercase outline-none focus:border-red-400"
          />
        </label>

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-neutral-200 py-3 text-[12.5px] font-bold text-neutral-600 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void erase()}
            disabled={!ready || busy || !isDesktop}
            title={!isDesktop ? 'Database reset is only available in the desktop app' : undefined}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-[13px] font-extrabold text-white shadow-md shadow-red-500/25 hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && ready ? (
              'Resetting…'
            ) : (
              <>
                <Trash2 size={15} />
                Erase everything
              </>
            )}
          </button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-medium text-neutral-400">
          <ShieldCheck size={11} />
          The app restarts afterwards into the first-boot setup wizard
        </p>
      </div>
    </div>
  )
}
