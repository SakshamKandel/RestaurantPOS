import { Building2, Percent, Printer, RefreshCw, Save, Vault } from 'lucide-react'
import type { DetectedPrinter, PrinterRole } from '../store'
import type { Settings } from '../data/menu'

interface Props {
  settings: Settings
  printers: DetectedPrinter[]
  onRefreshPrinters: () => void
  onChange: (s: Settings) => void
  onSaved: () => void
  onTestPrint: (role: PrinterRole) => void
  onOpenDrawer: (reason: string) => void
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

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
        value ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200'
      }`}
    >
      <span>
        <span className={`block text-[12.5px] font-bold ${value ? 'text-emerald-700' : 'text-neutral-600'}`}>
          {label}
        </span>
        <span className="block text-[10.5px] font-medium text-neutral-400">{hint}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? 'bg-emerald-500' : 'bg-neutral-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

function PrinterPicker({
  label,
  nameValue,
  addrValue,
  printers,
  onName,
  onAddr,
}: {
  label: string
  nameValue: string
  addrValue: string
  printers: DetectedPrinter[]
  onName: (v: string) => void
  onAddr: (v: string) => void
}) {
  const detected = printers.some((p) => p.name === nameValue)
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
          {label}
          {detected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Detected" />}
        </span>
        <select
          value={detected ? nameValue : '__manual'}
          onChange={(e) => {
            if (e.target.value !== '__manual') onName(e.target.value)
          }}
          className="mt-1 w-full cursor-pointer rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none focus:border-primary"
        >
          <option value="__manual" disabled>
            {printers.length ? '— Select detected printer —' : '— No printers detected —'}
          </option>
          {printers.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName}
              {p.isDefault ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </label>
      <Field label="Name / address / port" value={detected ? addrValue : nameValue} onChange={detected ? onAddr : onName} />
    </div>
  )
}

export default function SettingsPage({ settings, printers, onRefreshPrinters, onChange, onSaved, onTestPrint, onOpenDrawer }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    onChange({ ...settings, [k]: v })

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="pt-6">
        <h1 className="text-[20px] font-extrabold tracking-tight">Settings</h1>
        <p className="text-[12px] font-medium text-neutral-400">
          Store identity, taxes, printers and cash drawer
        </p>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-4">
        {/* Store details */}
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-[13px] font-extrabold">
            <Building2 size={15} className="text-primary" /> Store Details
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3.5">
            <Field label="Trading name" value={settings.restaurantName} onChange={(v) => set('restaurantName', v)} />
            <Field label="Legal name" value={settings.legalName} onChange={(v) => set('legalName', v)} />
          </div>
          <div className="mt-3.5 flex flex-col gap-3.5">
            <Field label="Address" value={settings.address} onChange={(v) => set('address', v)} />
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Phone" value={settings.phone} onChange={(v) => set('phone', v)} />
              <Field label="Tax ID / EIN" value={settings.taxId} onChange={(v) => set('taxId', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Email" value={settings.email} onChange={(v) => set('email', v)} />
              <Field label="Website" value={settings.website} onChange={(v) => set('website', v)} />
            </div>
            <Field label="Receipt footer" value={settings.receiptFooter} onChange={(v) => set('receiptFooter', v)} />
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {/* Tax & numbering */}
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
            <p className="mt-3 text-[10.5px] font-medium text-neutral-400">
              Currency: USD ($) · Prices tax-exclusive
            </p>
          </section>

          {/* Printers */}
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[13px] font-extrabold">
                <Printer size={15} className="text-primary" /> Thermal Printers
              </p>
              <button
                onClick={onRefreshPrinters}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10.5px] font-bold text-neutral-500 hover:border-primary hover:text-primary"
              >
                <RefreshCw size={11} />
                {printers.length} detected
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3.5">
              <PrinterPicker
                label="Kitchen printer"
                nameValue={settings.kitchenPrinter}
                addrValue={settings.kitchenAddress}
                printers={printers}
                onName={(v) => set('kitchenPrinter', v)}
                onAddr={(v) => set('kitchenAddress', v)}
              />
              <PrinterPicker
                label="Billing printer"
                nameValue={settings.billingPrinter}
                addrValue={settings.billingAddress}
                printers={printers}
                onName={(v) => set('billingPrinter', v)}
                onAddr={(v) => set('billingAddress', v)}
              />
              <div className="flex items-center gap-3">
                <label className="block flex-1">
                  <span className="text-[11px] font-bold text-neutral-500">Paper width</span>
                  <select
                    value={settings.paperWidth}
                    onChange={(e) => set('paperWidth', e.target.value as '58' | '80')}
                    className="mt-1 w-full cursor-pointer rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none"
                  >
                    <option value="80">80 mm</option>
                    <option value="58">58 mm</option>
                  </select>
                </label>
                <button
                  onClick={() => onTestPrint('kitchen')}
                  className="mt-4 flex-1 rounded-xl border border-neutral-200 py-2.5 text-[11.5px] font-bold text-neutral-600 hover:border-primary hover:text-primary"
                >
                  Test Kitchen
                </button>
                <button
                  onClick={() => onTestPrint('billing')}
                  className="mt-4 flex-1 rounded-xl border border-neutral-200 py-2.5 text-[11.5px] font-bold text-neutral-600 hover:border-primary hover:text-primary"
                >
                  Test Billing
                </button>
              </div>
            </div>
          </section>

          {/* Cash drawer */}
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-[13px] font-extrabold">
              <Vault size={15} className="text-primary" /> Cash Drawer
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              <Toggle
                label="Cash drawer connected"
                hint="RJ11 drawer kick port on the billing printer"
                value={settings.cashDrawer}
                onChange={(v) => set('cashDrawer', v)}
              />
              <Toggle
                label="Open on cash payments"
                hint="Pulse the drawer automatically when a cash sale completes"
                value={settings.drawerOnCash}
                onChange={(v) => set('drawerOnCash', v)}
              />
              <button
                onClick={() => onOpenDrawer('Manual test from Settings')}
                disabled={!settings.cashDrawer}
                className="rounded-xl border border-neutral-200 py-2.5 text-[11.5px] font-bold text-neutral-600 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Open Drawer Now
              </button>
            </div>
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
