import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChefHat,
  FileText,
  Percent,
  Printer,
  RefreshCw,
  Save,
  Vault,
} from 'lucide-react'
import type { DetectedPrinter, PrinterRole } from '../store'
import type { PaperWidth, Settings } from '../data/menu'

interface Props {
  settings: Settings
  printers: DetectedPrinter[]
  onRefreshPrinters: () => void
  onSave: (s: Settings) => void
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
  disabled = false,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
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

/** One printer role: enable · pick device · paper · test. Shows a truthful
 *  readiness badge — "Ready" only when the assigned device is installed. */
function PrinterCard({
  role,
  title,
  purpose,
  icon: Icon,
  enabled,
  device,
  paper,
  printers,
  onEnabled,
  onDevice,
  onPaper,
  onTest,
  extra,
}: {
  role: PrinterRole
  title: string
  purpose: string
  icon: typeof ChefHat
  enabled: boolean
  device: string
  paper: PaperWidth
  printers: DetectedPrinter[]
  onEnabled: (v: boolean) => void
  onDevice: (v: string) => void
  onPaper: (v: PaperWidth) => void
  onTest: () => void
  extra?: React.ReactNode
}) {
  const detected = !!device && printers.some((p) => p.name === device)
  const status = !enabled
    ? { label: 'Off', cls: 'bg-neutral-100 text-neutral-400', Icon: null }
    : !device
      ? { label: 'No printer assigned', cls: 'bg-amber-100 text-amber-600', Icon: AlertTriangle }
      : detected
        ? { label: 'Ready', cls: 'bg-emerald-100 text-emerald-600', Icon: CheckCircle2 }
        : { label: 'Not installed on this PC', cls: 'bg-red-100 text-red-500', Icon: AlertTriangle }

  return (
    <div className={`rounded-2xl border p-4 transition-colors ${enabled ? 'border-neutral-200' : 'border-neutral-100 bg-neutral-50/60'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${enabled ? 'bg-primary-soft text-primary' : 'bg-neutral-100 text-neutral-400'}`}>
          <Icon size={19} />
        </span>
        <div className="flex-1">
          <p className="text-[13px] font-extrabold">{title}</p>
          <p className="text-[10.5px] font-medium text-neutral-400">{purpose}</p>
        </div>
        <span className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${status.cls}`}>
          {status.Icon && <status.Icon size={10} />}
          {status.label}
        </span>
      </div>

      <div className="mt-3.5 flex flex-col gap-2.5">
        <Toggle
          label={`${title} printing`}
          hint={enabled ? 'Documents for this role are sent automatically' : 'Nothing is printed for this role'}
          value={enabled}
          onChange={onEnabled}
        />
        <div className={`grid grid-cols-[1fr_110px] gap-2.5 ${enabled ? '' : 'pointer-events-none opacity-50'}`}>
          <label className="block">
            <span className="text-[11px] font-bold text-neutral-500">Windows printer</span>
            <select
              value={device}
              onChange={(e) => onDevice(e.target.value)}
              className="mt-1 w-full cursor-pointer rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none focus:border-primary"
            >
              <option value="">— Not assigned —</option>
              {/* keep a stale assignment selectable so the user can see what's missing */}
              {device && !detected && (
                <option value={device}>{device} (not installed)</option>
              )}
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.displayName}
                  {p.isDefault ? ' (Windows default)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-neutral-500">Paper</span>
            <select
              value={paper}
              onChange={(e) => onPaper(e.target.value as PaperWidth)}
              className="mt-1 w-full cursor-pointer rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none"
            >
              <option value="80">80 mm</option>
              <option value="58">58 mm</option>
            </select>
          </label>
        </div>
        {extra}
        <button
          onClick={onTest}
          disabled={!enabled || !detected}
          title={!detected ? 'Assign an installed printer first' : `Print a test page on the ${role} printer`}
          className="rounded-xl border border-neutral-200 py-2.5 text-[11.5px] font-bold text-neutral-600 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Print test page
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage({ settings, printers, onRefreshPrinters, onSave, onTestPrint, onOpenDrawer }: Props) {
  // Edit a local draft; nothing is persisted until Save. Typing into a field
  // must not write the store (and a backup file) on every keystroke.
  const [draft, setDraft] = useState<Settings>(settings)
  useEffect(() => setDraft(settings), [settings])
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const billingDetected = !!draft.billingPrinter && printers.some((p) => p.name === draft.billingPrinter)
  const drawerReady = draft.cashDrawer && draft.billingEnabled && billingDetected

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-28">
      <header className="pt-6">
        <h1 className="text-[20px] font-extrabold tracking-tight">Settings</h1>
        <p className="text-[12px] font-medium text-neutral-400">
          Store identity, taxes, printers and cash drawer
        </p>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          {/* Store details */}
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-[13px] font-extrabold">
              <Building2 size={15} className="text-primary" /> Store Details
            </p>
            <p className="mt-0.5 text-[10.5px] font-medium text-neutral-400">Printed on every customer receipt</p>
            <div className="mt-4 grid grid-cols-2 gap-3.5">
              <Field label="Trading name" value={draft.restaurantName} onChange={(v) => set('restaurantName', v)} />
              <Field label="Legal name" value={draft.legalName} onChange={(v) => set('legalName', v)} />
            </div>
            <div className="mt-3.5 flex flex-col gap-3.5">
              <Field label="Address" value={draft.address} onChange={(v) => set('address', v)} />
              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Phone" value={draft.phone} onChange={(v) => set('phone', v)} />
                <Field label="Tax ID / EIN" value={draft.taxId} onChange={(v) => set('taxId', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Email" value={draft.email} onChange={(v) => set('email', v)} />
                <Field label="Website" value={draft.website} onChange={(v) => set('website', v)} />
              </div>
              <Field label="Receipt footer" value={draft.receiptFooter} onChange={(v) => set('receiptFooter', v)} />
            </div>
          </section>

          {/* Tax & numbering */}
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-[13px] font-extrabold">
              <Percent size={15} className="text-primary" /> Tax & Numbering
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3.5">
              <Field
                label="Default tax (%)"
                type="number"
                value={String(Math.round(draft.taxRate * 10000) / 100)}
                onChange={(v) => set('taxRate', Math.min(1, Math.max(0, Number(v) / 100)) || 0)}
              />
              <Field label="Order number prefix" value={draft.orderPrefix} onChange={(v) => set('orderPrefix', v.toUpperCase().slice(0, 5))} />
            </div>

            {/* Per-item tax classes */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-neutral-500">Tax classes (assign per item in Menu)</p>
                <button
                  onClick={() =>
                    set('taxClasses', [
                      ...draft.taxClasses,
                      { id: `tax-${Date.now().toString(36)}`, name: '', rate: 0 },
                    ])
                  }
                  className="text-[10.5px] font-bold text-primary hover:text-primary-dark"
                >
                  + Add class
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {draft.taxClasses.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <input
                      value={t.name}
                      onChange={(e) =>
                        set('taxClasses', draft.taxClasses.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                      }
                      placeholder="Class name"
                      className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-[12px] font-medium outline-none focus:border-primary"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={Math.round(t.rate * 10000) / 100}
                      onChange={(e) =>
                        set('taxClasses', draft.taxClasses.map((x, j) => (j === i ? { ...x, rate: Math.min(1, Math.max(0, Number(e.target.value) / 100)) } : x)))
                      }
                      className="w-20 rounded-lg border border-neutral-200 px-2.5 py-2 text-right text-[12px] font-medium outline-none focus:border-primary"
                    />
                    <span className="w-4 text-[11px] font-bold text-neutral-400">%</span>
                    <button
                      onClick={() => set('taxClasses', draft.taxClasses.filter((_, j) => j !== i))}
                      disabled={draft.taxClasses.length <= 1}
                      className="rounded-lg p-1 text-neutral-300 hover:text-red-500 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-[10.5px] font-medium text-neutral-400">
              Currency USD ($) · menu prices are tax-exclusive · items without a class use the default rate
            </p>
          </section>

          {/* Cash drawer */}
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[13px] font-extrabold">
                <Vault size={15} className="text-primary" /> Cash Drawer
              </p>
              <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                !draft.cashDrawer ? 'bg-neutral-100 text-neutral-400' : drawerReady ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {!draft.cashDrawer ? 'Off' : drawerReady ? 'Ready' : 'Needs billing printer'}
              </span>
            </div>
            <p className="mt-0.5 text-[10.5px] font-medium text-neutral-400">
              The drawer's RJ11 cable plugs into the billing printer; the app sends an ESC/POS pulse through it.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              <Toggle
                label="Cash drawer connected"
                hint="Plugged into the billing printer's drawer-kick port"
                value={draft.cashDrawer}
                onChange={(v) => set('cashDrawer', v)}
              />
              <Toggle
                label="Open on cash payments"
                hint="Pulse the drawer automatically when a cash sale completes"
                value={draft.drawerOnCash}
                onChange={(v) => set('drawerOnCash', v)}
                disabled={!draft.cashDrawer}
              />
              <div className={`grid grid-cols-[1fr_auto] items-end gap-2.5 ${draft.cashDrawer ? '' : 'pointer-events-none opacity-50'}`}>
                <label className="block">
                  <span className="text-[11px] font-bold text-neutral-500">Kick pin</span>
                  <select
                    value={draft.drawerPin}
                    onChange={(e) => set('drawerPin', Number(e.target.value) as 0 | 1)}
                    className="mt-1 w-full cursor-pointer rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-medium outline-none"
                  >
                    <option value={0}>Pin 2 (standard — try this first)</option>
                    <option value={1}>Pin 5 (if pin 2 doesn't open it)</option>
                  </select>
                </label>
                <button
                  onClick={() => onOpenDrawer('Manual test from Settings')}
                  disabled={!drawerReady}
                  title={drawerReady ? 'Send a drawer pulse now' : 'Enable the billing printer and assign an installed device first'}
                  className="rounded-xl border border-neutral-200 px-4 py-2.5 text-[11.5px] font-bold text-neutral-600 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Open drawer now
                </button>
              </div>
              {dirty && draft.cashDrawer && (
                <p className="text-[10px] font-medium text-amber-600">Save settings before testing so the pulse uses your new pin choice.</p>
              )}
            </div>
          </section>
        </div>

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
              {printers.length} installed · rescan
            </button>
          </div>
          <p className="mt-0.5 text-[10.5px] font-medium text-neutral-400">
            Install the printer in Windows first (it must appear in Windows Settings → Printers). Both roles can use the same printer.
          </p>
          {printers.length === 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-[11px] font-medium text-amber-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              No printers found on this PC. Plug in your thermal printer, install its Windows driver, then click rescan.
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3.5">
            <PrinterCard
              role="kitchen"
              title="Kitchen"
              purpose="Chef tickets — items, quantities, notes. No prices."
              icon={ChefHat}
              enabled={draft.kitchenEnabled}
              device={draft.kitchenPrinter}
              paper={draft.kitchenPaper}
              printers={printers}
              onEnabled={(v) => set('kitchenEnabled', v)}
              onDevice={(v) => set('kitchenPrinter', v)}
              onPaper={(v) => set('kitchenPaper', v)}
              onTest={() => onTestPrint('kitchen')}
            />
            <PrinterCard
              role="billing"
              title="Billing"
              purpose="Customer receipts, reprints and the cash-drawer pulse."
              icon={FileText}
              enabled={draft.billingEnabled}
              device={draft.billingPrinter}
              paper={draft.billingPaper}
              printers={printers}
              onEnabled={(v) => set('billingEnabled', v)}
              onDevice={(v) => set('billingPrinter', v)}
              onPaper={(v) => set('billingPaper', v)}
              onTest={() => onTestPrint('billing')}
              extra={
                <Toggle
                  label="Print a receipt for every sale"
                  hint={draft.billingAutoPrint ? 'Receipt prints automatically at payment' : 'Only when you press Print on the receipt screen'}
                  value={draft.billingAutoPrint}
                  onChange={(v) => set('billingAutoPrint', v)}
                  disabled={!draft.billingEnabled}
                />
              }
            />
          </div>
          {dirty && (
            <p className="mt-3 text-[10px] font-medium text-amber-600">
              Test pages use the saved configuration — save first if you changed the printer or paper.
            </p>
          )}
        </section>
      </div>

      {/* Sticky save bar */}
      <div className="fixed right-6 bottom-6 left-[236px] z-20 flex items-center justify-between rounded-2xl border border-neutral-200/80 bg-white/95 px-5 py-3 shadow-xl backdrop-blur">
        <p className="text-[12px] font-bold text-neutral-500">
          {dirty ? 'You have unsaved changes' : 'All changes saved'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setDraft(settings)}
            disabled={!dirty}
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-[12.5px] font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
          >
            Discard
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={!dirty}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[12.5px] font-extrabold text-white shadow-md shadow-orange-500/25 hover:bg-primary-dark disabled:opacity-40 disabled:shadow-none"
          >
            <Save size={14} />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
