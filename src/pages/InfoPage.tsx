import { DatabaseBackup, HardDrive, Info, Printer, ScrollText, Vault, WifiOff } from 'lucide-react'
import type { Settings } from '../data/menu'
import type { AuditEvent, DetectedPrinter } from '../store'

interface Props {
  settings: Settings
  orderCount: number
  audit: AuditEvent[]
  printers: DetectedPrinter[]
  version: string
  onCheckUpdates: () => void
  onBackup: () => void
}

export default function InfoPage({ settings, orderCount, audit, printers, version, onCheckUpdates, onBackup }: Props) {
  const detected = (name: string) => printers.some((p) => p.name === name)
  const health = [
    { label: 'Local database', detail: `${orderCount} orders · auto-backup on every change`, ok: true, icon: HardDrive },
    { label: 'Kitchen printer', detail: `${settings.kitchenPrinter} · ${settings.kitchenAddress}`, ok: detected(settings.kitchenPrinter), icon: Printer },
    { label: 'Billing printer', detail: `${settings.billingPrinter} · ${settings.billingAddress}`, ok: detected(settings.billingPrinter), icon: Printer },
    { label: 'Cash drawer', detail: settings.cashDrawer ? `RJ11 kick on billing printer · ${settings.paperWidth}mm` : 'Disabled in Settings', ok: settings.cashDrawer, icon: Vault },
    { label: 'Internet', detail: 'Offline mode — selling works regardless', ok: false, icon: WifiOff },
  ]

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="pt-6">
        <h1 className="text-[20px] font-extrabold tracking-tight">Info</h1>
        <p className="text-[12px] font-medium text-neutral-400">
          System status, audit trail and maintenance
        </p>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="KhadkaPOS" className="h-12 w-12 rounded-2xl object-contain shadow-md shadow-blue-500/20" />
            <div>
              <p className="text-[17px] font-extrabold">KhadkaPOS</p>
              <p className="text-[11.5px] font-medium text-neutral-400">
                Version {version || '…'} · Register 01
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2.5 text-[12.5px]">
            <div className="flex justify-between">
              <span className="font-medium text-neutral-500">Store</span>
              <span className="font-bold">{settings.restaurantName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-neutral-500">Legal entity</span>
              <span className="font-bold">{settings.legalName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-neutral-500">Address</span>
              <span className="font-bold">{settings.address}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-neutral-500">Tax ID</span>
              <span className="font-bold">{settings.taxId}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-neutral-500">Sales tax</span>
              <span className="font-bold">{(settings.taxRate * 100).toFixed(2)}% · USD</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-neutral-500">Mode</span>
              <span className="font-bold">Offline-first · desktop</span>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="flex items-center gap-2 text-[13px] font-extrabold">
            <Info size={15} className="text-primary" /> System Health
          </p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {health.map((h) => {
              const Icon = h.icon
              return (
                <li key={h.label} className="flex items-center gap-3 rounded-2xl border border-neutral-100 p-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      h.ok ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'
                    }`}
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold">{h.label}</p>
                    <p className="truncate text-[10.5px] font-medium text-neutral-400">{h.detail}</p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                      h.ok ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    {h.ok ? 'OK' : h.label === 'Internet' ? 'OFFLINE' : 'OFF'}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-5 flex gap-2.5">
            <button
              onClick={onBackup}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-[12.5px] font-bold text-white hover:bg-neutral-700"
            >
              <DatabaseBackup size={15} />
              Backup Now
            </button>
            <button
              onClick={onCheckUpdates}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 py-3 text-[12.5px] font-bold text-neutral-600 hover:border-primary hover:text-primary"
            >
              Check for Updates
            </button>
          </div>
          <p className="mt-3 text-center text-[10.5px] font-medium leading-relaxed text-neutral-400">
            Broken update? Download any previous version from GitHub Releases and install it —
            your data lives in %APPDATA% and stays compatible across versions.
          </p>
        </section>
      </div>

      {/* Audit trail */}
      <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
        <p className="flex items-center gap-2 px-5 pt-4 text-[13px] font-extrabold">
          <ScrollText size={15} className="text-primary" /> Recent Audit Events
        </p>
        <ul className="mt-2 flex max-h-64 flex-col divide-y divide-neutral-50 overflow-y-auto thin-scroll">
          {audit.length === 0 && (
            <li className="py-8 text-center text-[11.5px] font-semibold text-neutral-400">
              No events yet — logins, orders, refunds and drawer opens appear here
            </li>
          )}
          {audit.slice(0, 50).map((e) => (
            <li key={e.id} className="flex items-center justify-between px-5 py-2.5 text-[11.5px]">
              <span>
                <span className="font-mono font-bold text-primary">{e.action}</span>
                <span className="ml-2 font-medium text-neutral-500">{e.detail}</span>
              </span>
              <span className="font-medium text-neutral-400">
                {e.actor} · {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
