import { Printer, X } from 'lucide-react'
import type { Settings } from '../data/menu'
import type { PlacedOrder } from '../store'
import { receiptHtml } from '../print/docs'

interface Props {
  order: PlacedOrder
  settings: Settings
  onPrint: () => void
  onClose: () => void
}

/** Shows exactly the document the billing printer receives (same HTML). */
export default function ReceiptModal({ order, settings, onPrint, onClose }: Props) {
  const mm = Number(settings.billingPaper)
  const canPrint = settings.billingEnabled && !!settings.billingPrinter
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-3xl bg-neutral-100 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[12.5px] font-extrabold">Receipt · {order.number}</p>
          <span className="text-[10.5px] font-bold text-neutral-400">{mm}mm preview</span>
        </div>
        <iframe
          title="receipt"
          srcDoc={receiptHtml(order, settings)}
          sandbox=""
          className="rounded-lg bg-white shadow-sm"
          style={{ width: `${mm * 3.9}px`, height: '480px', border: 'none' }}
        />
        <div className="mt-4 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white py-2.5 text-[12.5px] font-bold text-neutral-600 hover:bg-neutral-50"
          >
            <X size={15} />
            Close
          </button>
          <button
            onClick={onPrint}
            title={canPrint ? 'Send to the billing printer' : 'Billing printer is off or unassigned — see Settings'}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[12.5px] font-bold text-white shadow-md shadow-orange-500/25 hover:bg-primary-dark"
          >
            <Printer size={15} />
            {canPrint ? 'Print' : 'Print (not set up)'}
          </button>
        </div>
      </div>
    </div>
  )
}
