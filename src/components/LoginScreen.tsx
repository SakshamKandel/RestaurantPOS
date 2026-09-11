import { useState } from 'react'
import { Delete, KeyRound, Lock, ShieldCheck, Soup } from 'lucide-react'
import type { Staff } from '../data/menu'

const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del']

type Step = 'pin' | 'new-pin' | 'confirm-pin'

interface Props {
  staff: Staff[]
  onLogin: (staff: Staff, newPin?: string) => void
}

export default function LoginScreen({ staff, onLogin }: Props) {
  const [selected, setSelected] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [step, setStep] = useState<Step>('pin')
  const [error, setError] = useState('')

  const active = staff.filter((s) => s.active)

  const push = (key: string) => {
    setError('')
    if (key === 'clear') return setPin('')
    if (key === 'del') return setPin((p) => p.slice(0, -1))
    const next = (pin + key).slice(0, 4)
    setPin(next)
    if (next.length !== 4 || !selected) return

    if (step === 'pin') {
      if (next === selected.pin) {
        if (selected.mustChangePin) {
          setStep('new-pin')
          setPin('')
        } else {
          onLogin(selected)
        }
      } else {
        setError('Wrong PIN, try again')
        window.setTimeout(() => setPin(''), 350)
      }
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

  const titles: Record<Step, [string, string]> = {
    pin: [
      selected ? `Hi, ${selected.name.split(' ')[0]}` : 'Enter your PIN',
      selected?.mustChangePin
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
        {/* Staff picker */}
        <div className="w-[380px] border-r border-neutral-100 p-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <Soup size={20} strokeWidth={2.4} />
            </span>
            <span className="text-[20px] font-extrabold tracking-tight">Khadka</span>
          </div>
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
                disabled={!selected}
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
