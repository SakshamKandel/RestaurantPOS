import { useState } from 'react'
import { Delete, Lock, Soup } from 'lucide-react'
import { STAFF, type Staff } from '../data/menu'

const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del']

interface Props {
  onLogin: (staff: Staff) => void
}

export default function LoginScreen({ onLogin }: Props) {
  const [staff, setStaff] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const push = (key: string) => {
    setError(false)
    if (key === 'clear') return setPin('')
    if (key === 'del') return setPin((p) => p.slice(0, -1))
    const next = (pin + key).slice(0, 4)
    setPin(next)
    if (next.length === 4 && staff) {
      if (next === staff.pin) onLogin(staff)
      else {
        setError(true)
        window.setTimeout(() => setPin(''), 350)
      }
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-canvas">
      <div className="flex w-[720px] overflow-hidden rounded-3xl bg-white shadow-2xl shadow-neutral-300">
        {/* Staff picker */}
        <div className="w-[380px] border-r border-neutral-100 p-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <Soup size={20} strokeWidth={2.4} />
            </span>
            <span className="text-[20px] font-extrabold tracking-tight">Tabetei</span>
          </div>
          <p className="mt-1.5 text-[12px] font-medium text-neutral-400">
            Select your profile to clock in
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {STAFF.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setStaff(s)
                  setPin('')
                  setError(false)
                }}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                  staff?.id === s.id
                    ? 'border-primary bg-primary-soft'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-extrabold text-white ${s.color}`}
                >
                  {s.initials}
                </span>
                <span>
                  <span className="block text-[13.5px] font-bold">{s.name}</span>
                  <span className="block text-[11px] font-medium capitalize text-neutral-400">
                    {s.role}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* PIN pad */}
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
            <Lock size={18} />
          </span>
          <p className="mt-3 text-[14px] font-extrabold">
            {staff ? `Hi, ${staff.name.split(' ')[0]}` : 'Enter your PIN'}
          </p>
          <p className="text-[11px] font-medium text-neutral-400">
            {staff ? 'Type your 4-digit PIN' : 'Choose a profile first'}
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
            <p className="mt-2 text-[11px] font-bold text-red-500">
              Wrong PIN, try again
            </p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {PAD.map((k) => (
              <button
                key={k}
                disabled={!staff}
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
