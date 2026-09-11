import { Building2, Percent, Printer, Save } from 'lucide-react'
import type { Settings } from '../data/menu'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  onSaved: () => void
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-neutral-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none focus:border-primary"
      />
    </label>
  )
}

export default function SettingsPage({ settings, onChange, onSaved }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    onChange({ ...settings, [k]: v })

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="pt-6">
        <h1 className="text-[20px] font-extrabold tracking-tight">Settings</h1>
        <p className="text-[12px] font-medium text-neutral-400">
          Restaurant identity, taxes and devices
        </p>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-[13px] font-extrabold">
            <Building2 size={15} className="text-primary" /> Restaurant Identity
          </p>
          <div className="mt-4 flex flex-col gap-3.5">
            <Field label="Trading name" value={settings.restaurantName} onChange={(v) => set('restaurantName', v)} />
            <Field label="Address" value={settings.address} onChange={(v) => set('address', v)} />
            <Field label="Phone" value={settings.phone} onChange={(v) => set('phone', v)} />
            <Field label="Receipt footer" value={settings.receiptFooter} onChange={(v) => set('receiptFooter', v)} />
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-[13px] font-extrabold">
              <Percent size={15} className="text-primary" /> Tax & Numbering
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3.5">
              <Field
                label="US sales tax (%)"
                type="number"
                value={String(settings.taxRate * 100)}
                onChange={(v) => set('taxRate', Math.max(0, Number(v) / 100) || 0)}
              />
              <Field label="Order prefix" value={settings.orderPrefix} onChange={(v) => set('orderPrefix', v)} />
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-[13px] font-extrabold">
              <Printer size={15} className="text-primary" /> Printer Roles
            </p>
            <div className="mt-4 flex flex-col gap-3.5">
              <Field label="Kitchen / chef printer" value={settings.kitchenPrinter} onChange={(v) => set('kitchenPrinter', v)} />
              <Field label="Billing / customer printer" value={settings.billingPrinter} onChange={(v) => set('billingPrinter', v)} />
            </div>
            <p className="mt-3 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-[11px] font-medium leading-relaxed text-neutral-400">
              Kitchen tickets route to the chef printer; customer receipts route to
              the billing printer. Jobs queue durably and can be retried.
            </p>
          </section>
        </div>
      </div>

      <button
        onClick={onSaved}
        className="mt-5 flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-[13px] font-extrabold text-white shadow-lg shadow-orange-500/25 hover:bg-primary-dark"
      >
        <Save size={15} />
        Save Settings
      </button>
    </div>
  )
}
