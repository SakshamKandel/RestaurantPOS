import { useEffect, useState } from 'react'
import { Delete, KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { SUPER_ADMIN, type Staff } from '../data/menu'
import type { LoginResult } from '../store'
import logoIcon from '../assets/icon.png'

const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del']

type Step = 'pin' | 'new-pin' | 'confirm-pin'

interface Props {
  staff: Staff[]
  /** Verify against the main process (hash + lockout). */
  onVerify: (id: string, pin: string) => Promise<LoginResult>
  onLogin: (staff: Staff, newPin?: string) => void
  onSetup: (name: string, pin: string) => void
}

export default function LoginScreen({ staff, onVerify, onLogin, onSetup }: Props) {
  const [selected, setSelected] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [step, setStep] = useState<Step>('pin')
  const [error, setError] = useState('')
  const [name, setName] = useState('Admin')
  const [busy, setBusy] = useState(false)
  const [lockUntil, setLockUntil] = useState(0)
  const [, tick] = useState(0)

  // re-render every second while locked so the countdown is live
  useEffect(() => {
    if (lockUntil <= Date.now()) return
    const t = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [lockUntil])
  const lockLeft = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000))

  const active = staff.filter((s) => s.active)
  const adminMode = selected?.id === SUPER_ADMIN.id
  const isSetup = active.length === 0 && !adminMode

  const reject = (msg: string) => {
    setError(msg)
    window.setTimeout(() => setPin(''), 350)
  }

  const pickAdmin = () => {
    setSelected(SUPER_ADMIN)
    setPin('')
    setNewPin('')
    setStep('pin')
    setError('')
  }

  /** Check the entered PIN with the main process; handles lockout messaging. */
  const verify = async (who: Staff, entered: string) => {
    setBusy(true)
    try {
      const r = await onVerify(who.id, entered)
      if (r.ok) return r
      if (r.lockSeconds) {
        setLockUntil(Date.now() + r.lockSeconds * 1000)
        reject(`Too many attempts — locked for ${r.lockSeconds >= 60 ? `${Math.round(r.lockSeconds / 60)} min` : `${r.lockSeconds}s`}`)
      } else {
        reject(r.reason === 'no-account' ? 'Account not found' : `Wrong PIN, try again${r.fails && r.fails >= 2 ? ` (${r.fails} failed)` : ''}`)
      }
      return null
    } finally {
      setBusy(false)
    }
  }

  const push = (key: string) => {
    if (busy) return
    setError('')
    if (key === 'clear') return setPin('')
    if (key === 'del') return setPin((p) => p.slice(0, -1))
    const next = (pin + key).slice(0, 4)
    setPin(next)
    if (next.length !== 4) return

    if (adminMode) {
      if (lockLeft) return reject(`Locked — try again in ${lockLeft}s`)
      void verify(SUPER_ADMIN, next).then((r) => r && onLogin(SUPER_ADMIN))
      return
    }

    if (isSetup) {
      // First-boot: create PIN, then confirm
      if (step !== 'confirm-pin') {
        setNewPin(next)
        setStep('confirm-pin')
        setPin('')
      } else if (next === newPin) {
        onSetup(name.trim() || 'Admin', newPin)
      } else {
        setError('PINs did not match — start over')
        setStep('pin')
        setNewPin('')
        window.setTimeout(() => setPin(''), 350)
      }
      return
    }

    if (!selected) return
    if (step === 'pin') {
      if (lockLeft) return reject(`Locked — try again in ${lockLeft}s`)
      void verify(selected, next).then((r) => {
        if (!r) return
        if (r.mustChangePin) {
          setStep('new-pin')
          setPin('')
        } else {
          onLogin(selected)
        }
      })
    } else if (step === 'new-pin') {
      setNewPin(next)
      setStep('confirm-pin')
      setPin('')
    } else {
      if (next === newPin) {
        onLogin(selected, newPin)
      } else {
        setError('PINs did not match — start over')
        setStep('new-pin')
        setNewPin('')
        window.setTimeout(() => setPin(''), 350)
      }
    }
  }

  const titles: Record<Step, [string, string]> = isSetup
    ? {
        pin: ['Create admin PIN', 'Set a 4-digit PIN for this account'],
        'new-pin': ['Create admin PIN', 'Set a 4-digit PIN for this account'],
        'confirm-pin': ['Confirm PIN', 'Type the same PIN once more'],
      }
    : {
        pin: [
          adminMode ? 'Administrator' : selected ? `Hi, ${selected.name.split(' ')[0]}` : 'Enter your PIN',
          adminMode
            ? 'Enter the owner PIN'
            : selected?.mustChangePin
              ? 'First login — enter your one-time PIN'
              : selected
                ? 'Type your 4-digit PIN'
                : 'Choose a profile first',
        ],
        'new-pin': ['Set your PIN', 'Create a new 4-digit PIN (one-time PIN expires)'],
        'confirm-pin': ['Confirm PIN', 'Type the same PIN once more'],
      }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-canvas">
      <div className="flex w-[720px] overflow-hidden rounded-3xl bg-white shadow-2xl shadow-neutral-300">
        {/* Left panel — staff picker, or first-boot admin setup */}
        <div className="relative w-[380px] border-r border-neutral-100 p-8 pb-14">
          <div className="flex items-center gap-2.5">
            <img src={logoIcon} alt="KhadkaPOS" className="h-10 w-10 object-contain" />
            <span className="text-[20px] font-extrabold tracking-tight">Khadka</span>
          </div>

          {isSetup ? (
            <>
              <p className="mt-6 text-[15px] font-extrabold">Welcome to KhadkaPOS</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-400">
                Set up the admin (manager) account. You can add the rest of your
                staff afterwards from Staff Management.
              </p>
              <label className="mt-6 block">
                <span className="text-[11px] font-bold text-neutral-500">Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Admin"
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] font-bold outline-none focus:border-primary"
                />
              </label>
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[11px] font-bold text-amber-600">
                <ShieldCheck size={14} />
                Role: Manager — full access
              </div>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-[12px] font-medium text-neutral-400">
                Select your profile to clock in
              </p>
              <div className="mt-6 flex flex-col gap-2">
                {active.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelected(s)
                      setPin('')
                      setNewPin('')
                      setStep('pin')
                      setError('')
                    }}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                      selected?.id === s.id
                        ? 'border-primary bg-primary-soft'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-extrabold text-white ${s.color}`}
                    >
                      {s.initials}
                    </span>
                    <span className="flex-1">
                      <span className="block text-[13.5px] font-bold">{s.name}</span>
                      <span className="block text-[11px] font-medium capitalize text-neutral-400">
                        {s.role}
                      </span>
                    </span>
                    {s.mustChangePin && (
                      <span className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[9.5px] font-bold text-amber-600">
                        <ShieldCheck size={10} /> SETUP
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Discreet owner access — recovery path if a manager forgets their PIN */}
          <button
            onClick={pickAdmin}
            className={`absolute bottom-5 left-8 flex items-center gap-1.5 text-[10.5px] font-bold transition-colors ${
              adminMode ? 'text-neutral-700' : 'text-neutral-300 hover:text-neutral-500'
            }`}
          >
            <ShieldCheck size={11} />
            Administrator
          </button>
        </div>

        {/* PIN pad */}
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
            {step === 'pin' ? <Lock size={18} /> : <KeyRound size={18} />}
          </span>
          <p className="mt-3 text-[14px] font-extrabold">{titles[step][0]}</p>
          <p className="text-center text-[11px] font-medium text-neutral-400">
            {titles[step][1]}
          </p>

          <div className="mt-4 flex gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full transition-colors ${
                  error
                    ? 'bg-red-400'
                    : i < pin.length
                      ? 'bg-primary'
                      : 'bg-neutral-200'
                }`}
              />
            ))}
          </div>
          {error && (
            <p className="mt-2 text-[11px] font-bold text-red-500">{error}</p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {PAD.map((k) => (
              <button
                key={k}
                disabled={busy || lockLeft > 0 || (!isSetup && !selected)}
                onClick={() => push(k)}
                className="flex h-13 w-16 items-center justify-center rounded-2xl bg-neutral-50 text-[17px] font-bold text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-40"
              >
                {k === 'del' ? (
                  <Delete size={18} />
                ) : k === 'clear' ? (
                  <span className="text-[12px] font-bold text-neutral-400">CLR</span>
                ) : (
                  k
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
