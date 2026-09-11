import { useState } from 'react'
import { ChefHat, Eye, FileText, Printer, RotateCcw, Wifi, X } from 'lucide-react'
import type { PrintJob, PlacedOrder, PrinterRole } from '../store'
import type { Settings } from '../data/menu'

const STATUS_BADGE: Record<PrintJob['status'], string> = {
  pending: 'bg-amber-100 text-amber-600',
  printed: 'bg-emerald-100 text-emerald-600',
  failed: 'bg-red-100 text-red-500',
}

interface Props {
  jobs: PrintJob[]
  orders: PlacedOrder[]
  settings: Settings
  onRetry: (id: string) => void
}

export default function PrintersPage({ jobs, orders, settings, onRetry }: Props) {
  const [preview, setPreview] = useState<PlacedOrder | null>(null)

  const printers: { role: PrinterRole; name: string; icon: typeof ChefHat; jobs: string }[] = [
    { role: 'kitchen', name: settings.kitchenPrinter, icon: ChefHat, jobs: 'Kitchen tickets' },
    { role: 'billing', name: settings.billingPrinter, icon: FileText, jobs: 'Customer receipts' },
  ]

  const sorted = [...jobs].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="thin-scroll flex-1 overflow-y-auto px-6 pb-6">
      <header className="pt-6">
        <h1 className="text-[20px] font-extrabold tracking-tight">Printers</h1>
        <p className="text-[12px] font-medium text-neutral-400">
          Thermal print queue — kitchen tickets go to the chef printer, receipts to billing
        </p>
      </header>

      {/* Printer roles */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        {printers.map((p) => {
          const Icon = p.icon
          const pending = jobs.filter((j) => j.role === p.role && j.status === 'pending').length
          const failed = jobs.filter((j) => j.role === p.role && j.status === 'failed').length
          return (
            <div key={p.role} className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Icon size={22} />
              </span>
              <div className="flex-1">
                <p className="text-[13.5px] font-extrabold capitalize">
                  {p.role === 'kitchen' ? 'Chef / Kitchen' : 'Billing / Customer'}
                </p>
                <p className="text-[11px] font-medium text-neutral-400">
                  {p.name} · 80mm · {p.jobs}
                </p>
              </div>
              <div className="text-right">
                <span className="flex items-center gap-1.5 rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-600">
                  <Wifi size={10} /> ONLINE
                </span>
                <p className="mt-1.5 text-[10px] font-bold text-neutral-400">
                  {pending} pending · {failed} failed
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Job queue */}
      <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <p className="text-[13px] font-extrabold">Print Queue</p>
          <p className="text-[11px] font-medium text-neutral-400">
            Jobs persist and retry safely — a printer failure never cancels a paid order
          </p>
        </div>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="border-b border-neutral-100 text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
              <th className="px-5 py-3">Document</th>
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Printer</th>
              <th className="px-5 py-3">Time</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {sorted.map((j) => {
              const order = orders.find((o) => o.number === j.orderNumber)
              return (
                <tr key={j.id} className="transition-colors hover:bg-neutral-50/60">
                  <td className="px-5 py-3.5 text-[12.5px] font-bold">
                    {j.docType}
                    {j.copy && (
                      <span className="ml-2 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold text-neutral-500">
                        COPY
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[12.5px] font-extrabold">{j.orderNumber}</td>
                  <td className="px-5 py-3.5 text-[11.5px] font-bold capitalize text-neutral-500">
                    {j.role === 'kitchen' ? 'Chef' : 'Billing'}
                  </td>
                  <td className="px-5 py-3.5 text-[12px] font-medium text-neutral-500">
                    {new Date(j.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-md px-2 py-1 text-[10px] font-bold capitalize ${STATUS_BADGE[j.status]}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      {order && j.role === 'kitchen' && (
                        <button
                          onClick={() => setPreview(order)}
                          title="Preview kitchen ticket"
                          className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-primary hover:text-primary"
                        >
                          <Eye size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => onRetry(j.id)}
                        title={j.status === 'failed' ? 'Retry job' : 'Reprint'}
                        className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:border-primary hover:text-primary"
                      >
                        {j.status === 'failed' ? <RotateCcw size={13} /> : <Printer size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="py-12 text-center text-[12px] font-semibold text-neutral-400">
            No print jobs yet — complete an order to see the queue
          </p>
        )}
      </div>

      {/* Kitchen ticket preview */}
      {preview && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[340px] rounded-3xl bg-neutral-100 p-5 shadow-2xl">
            <div className="rounded-lg bg-white px-5 py-6 font-mono text-[11px] leading-relaxed shadow-sm">
              <div className="text-center">
                <p className="text-[14px] font-bold">** KITCHEN TICKET **</p>
                <p>{settings.restaurantName}</p>
              </div>
              <div className="my-3 border-t border-dashed border-neutral-300" />
              <div className="flex justify-between">
                <span>Order {preview.number}</span>
                <span>{new Date(preview.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="uppercase">{preview.type.replace('-', ' ')}</span>
                <span>{preview.customer}</span>
              </div>
              <div className="my-3 border-t border-dashed border-neutral-300" />
              {preview.lines.map((l, i) => (
                <div key={i} className="flex justify-between text-[12px] font-bold">
                  <span>{l.qty}x {l.name}</span>
                </div>
              ))}
              <div className="my-3 border-t border-dashed border-neutral-300" />
              <p className="text-center">Chef: {preview.cashier}</p>
            </div>
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
