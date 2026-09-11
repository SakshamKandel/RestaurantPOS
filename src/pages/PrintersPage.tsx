import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChefHat, Eye, FileText, Printer, RotateCcw, Settings2, Vault, X } from 'lucide-react'
import type { DetectedPrinter, PrintJob, PlacedOrder, PrinterRole } from '../store'
import type { Settings } from '../data/menu'
import { kitchenHtml, receiptHtml } from '../print/docs'

const STATUS_BADGE: Record<PrintJob['status'], string> = {
  pending: 'bg-amber-100 text-amber-600',
  printed: 'bg-emerald-100 text-emerald-600',
  failed: 'bg-red-100 text-red-500',
}

interface Props {
  jobs: PrintJob[]
  orders: PlacedOrder[]
  settings: Settings
  printers: DetectedPrinter[]
  onRetry: (id: string) => void
  onRetryAllFailed: () => void
  onClearHistory: () => void
  onOpenSettings: () => void
}

export default function PrintersPage({ jobs, orders, settings, printers, onRetry, onRetryAllFailed, onClearHistory, onOpenSettings }: Props) {
  const [preview, setPreview] = useState<{ title: string; html: string; mm: number } | null>(null)
  const detected = (name: string) => !!name && printers.some((p) => p.name === name)

  const roleState = (role: PrinterRole) => {
    const enabled = role === 'kitchen' ? settings.kitchenEnabled : settings.billingEnabled
    const device = role === 'kitchen' ? settings.kitchenPrinter : settings.billingPrinter
    const paper = role === 'kitchen' ? settings.kitchenPaper : settings.billingPaper
    const ready = enabled && detected(device)
    const label = !enabled ? 'Off' : !device ? 'No printer assigned' : detected(device) ? 'Ready' : 'Not installed'
    const cls = !enabled
      ? 'bg-neutral-100 text-neutral-400'
      : ready
        ? 'bg-emerald-100 text-emerald-600'
        : 'bg-amber-100 text-amber-600'
    return { enabled, device, paper, ready, label, cls }
  }

  const roles = [
    { role: 'kitchen' as PrinterRole, title: 'Kitchen', icon: ChefHat, purpose: 'Chef tickets' },
    { role: 'billing' as PrinterRole, title: 'Billing', icon: FileText, purpose: 'Receipts · drawer pulse' },
  ]

  const billing = roleState('billing')
  const drawer = !settings.cashDrawer
    ? { label: 'Off', cls: 'bg-neutral-100 text-neutral-400' }
    : billing.ready
      ? { label: `Ready · pin ${settings.drawerPin === 0 ? 2 : 5}`, cls: 'bg-emerald-100 text-emerald-600' }
      : { label: 'Needs billing printer', cls: 'bg-amber-100 text-amber-600' }

  const sorted = [...jobs].sort((a, b) => b.createdAt - a.createdAt)
  const failedCount = jobs.filter((j) => j.status === 'failed').length

  const openPreview = (j: PrintJob) => {
    const order = orders.find((o) => o.number === j.orderNumber)
    if (!order) return
    if (j.docType === 'KITCHEN TICKET')
      setPreview({ title: `Kitchen ticket · ${order.number}`, html: kitchenHtml(order, settings), mm: Number(settings.kitchenPaper) })
    else if (j.docType === 'RECEIPT')
      setPreview({ title: `Receipt · ${order.number}`, html: receiptHtml(order, settings, j.copy), mm: Number(settings.billingPaper) })
  }

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="flex items-start justify-between pt-6">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight">Printers</h1>
          <p className="text-[12px] font-medium text-neutral-400">
            Live status of your hardware and every document the POS has tried to print
          </p>
        </div>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[12px] font-bold text-neutral-600 hover:border-primary hover:text-primary"
        >
          <Settings2 size={14} />
          Configure
        </button>
      </header>

      {/* Hardware status */}
      <div className="mt-5 grid grid-cols-3 gap-4">
        {roles.map((r) => {
          const st = roleState(r.role)
          const Icon = r.icon
          const pending = jobs.filter((j) => j.role === r.role && j.status === 'pending').length
          const failed = jobs.filter((j) => j.role === r.role && j.status === 'failed').length
          return (
            <div key={r.role} className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${st.enabled ? 'bg-primary-soft text-primary' : 'bg-neutral-100 text-neutral-400'}`}>
                  <Icon size={20} />
                </span>
                <div className="flex-1">
                  <p className="text-[13.5px] font-extrabold">{r.title}</p>
                  <p className="text-[10.5px] font-medium text-neutral-400">{r.purpose}</p>
                </div>
                <span className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${st.cls}`}>
                  {st.ready ? <CheckCircle2 size={10} /> : st.enabled ? <AlertTriangle size={10} /> : null}
                  {st.label}
                </span>
              </div>
              <div className="mt-3.5 rounded-xl bg-neutral-50 px-3.5 py-2.5">
                <p className="truncate text-[11.5px] font-bold text-neutral-700" title={st.device || undefined}>
                  {st.device || 'No Windows printer assigned'}
                </p>
                <p className="text-[10px] font-medium text-neutral-400">
                  {st.paper}mm paper · {pending} pending · {failed} failed
                </p>
              </div>
            </div>
          )
        })}

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${settings.cashDrawer ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}>
              <Vault size={20} />
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] font-extrabold">Cash drawer</p>
              <p className="text-[10.5px] font-medium text-neutral-400">ESC/POS pulse via billing printer</p>
            </div>
            <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${drawer.cls}`}>{drawer.label}</span>
          </div>
          <div className="mt-3.5 rounded-xl bg-neutral-50 px-3.5 py-2.5">
            <p className="text-[11.5px] font-bold text-neutral-700">
              {settings.cashDrawer ? (settings.drawerOnCash ? 'Opens on cash sales' : 'Manual open only') : 'Not connected'}
            </p>
            <p className="text-[10px] font-medium text-neutral-400">
              {jobs.filter((j) => j.docType === 'DRAWER KICK' && j.status === 'printed').length} pulses sent
            </p>
          </div>
        </div>
      </div>

      {/* Detected printers */}
      <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-extrabold">Installed on this PC</p>
          <p className="text-[10.5px] font-medium text-neutral-400">{printers.length} printer{printers.length === 1 ? '' : 's'}</p>
        </div>
        {printers.length === 0 ? (
          <p className="mt-3 text-[11.5px] font-medium text-neutral-400">
            None found. Install your thermal printer in Windows, then use Configure → rescan.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {printers.map((p) => {
              const roleTags = [
                settings.kitchenPrinter === p.name && 'Kitchen',
                settings.billingPrinter === p.name && 'Billing',
              ].filter(Boolean) as string[]
              return (
                <span
                  key={p.name}
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold ${
                    roleTags.length ? 'border-primary/40 bg-primary-soft text-primary' : 'border-neutral-200 text-neutral-600'
                  }`}
                >
                  <Printer size={12} className={roleTags.length ? 'text-primary' : 'text-neutral-400'} />
                  {p.displayName}
                  {roleTags.map((t) => (
                    <span key={t} className="rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-bold">{t}</span>
                  ))}
                  {p.isDefault && !roleTags.length && (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold text-neutral-500">DEFAULT</span>
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Job queue */}
      <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <div>
            <p className="text-[13px] font-extrabold">Print Queue</p>
            <p className="text-[11px] font-medium text-neutral-400">
              A printer failure never cancels a paid order — fix the printer, then retry here
            </p>
          </div>
          <div className="flex gap-2">
            {failedCount > 0 && (
              <button
                onClick={onRetryAllFailed}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-600"
              >
                <RotateCcw size={12} />
                Retry {failedCount} failed
              </button>
            )}
            {jobs.some((j) => j.status !== 'pending') && (
              <button
                onClick={onClearHistory}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[11px] font-bold text-neutral-500 hover:bg-neutral-50"
              >
                Clear printed
              </button>
            )}
          </div>
        </div>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="border-b border-neutral-100 text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
              <th className="px-5 py-3">Document</th>
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Sent to</th>
              <th className="px-5 py-3">Time</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {sorted.map((j) => {
              const hasOrder = orders.some((o) => o.number === j.orderNumber)
              const previewable = hasOrder && (j.docType === 'KITCHEN TICKET' || j.docType === 'RECEIPT')
              return (
                <tr key={j.id} className="transition-colors hover:bg-neutral-50/60">
                  <td className="px-5 py-3.5 text-[12.5px] font-bold">
                    {j.docType}
                    {j.copy && (
                      <span className="ml-2 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold text-neutral-500">COPY</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[12.5px] font-extrabold">{j.orderNumber}</td>
                  <td className="max-w-[220px] px-5 py-3.5">
                    <p className="truncate text-[11.5px] font-bold text-neutral-600" title={j.device}>
                      {j.device || <span className="text-neutral-400">{j.role === 'kitchen' ? 'Kitchen (unassigned)' : 'Billing (unassigned)'}</span>}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-[12px] font-medium text-neutral-500">
                    {new Date(j.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-md px-2 py-1 text-[10px] font-bold capitalize ${STATUS_BADGE[j.status]}`}>
                      {j.status}
                    </span>
                    {j.status === 'failed' && j.error && (
                      <p className="mt-1 max-w-[240px] text-[10px] font-medium leading-snug text-red-400">{j.error}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      {previewable && (
                        <button
                          onClick={() => openPreview(j)}
                          title="Preview exactly what the printer receives"
                          className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-primary hover:text-primary"
                        >
                          <Eye size={13} />
                        </button>
                      )}
                      {j.status !== 'pending' && (
                        <button
                          onClick={() => onRetry(j.id)}
                          title={j.status === 'failed' ? 'Retry this job' : 'Print again'}
                          className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-primary hover:text-primary"
                        >
                          {j.status === 'failed' ? <RotateCcw size={13} /> : <Printer size={13} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="py-12 text-center text-[12px] font-semibold text-neutral-400">
            No print jobs yet — complete an order or send a test page from Settings
          </p>
        )}
      </div>

      {/* Document preview — renders the same HTML sent to the spooler */}
      {preview && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="rounded-3xl bg-neutral-100 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12.5px] font-extrabold">{preview.title}</p>
              <span className="text-[10.5px] font-bold text-neutral-400">{preview.mm}mm</span>
            </div>
            <iframe
              title="print preview"
              srcDoc={preview.html}
              sandbox=""
              className="rounded-lg bg-white shadow-sm"
              style={{ width: `${preview.mm * 3.9}px`, height: '520px', border: 'none' }}
            />
            <button
              onClick={() => setPreview(null)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white py-2.5 text-[12.5px] font-bold text-neutral-600 hover:bg-neutral-50"
            >
              <X size={15} /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
