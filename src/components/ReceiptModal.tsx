import { Printer, X } from 'lucide-react'
import { formatMoney, type Settings } from '../data/menu'
import type { PlacedOrder } from '../store'

interface Props {
  order: PlacedOrder
  settings: Settings
  onPrint: () => void
  onClose: () => void
}

export default function ReceiptModal({ order, settings, onPrint, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[340px] rounded-3xl bg-neutral-100 p-5 shadow-2xl">
        {/* Thermal-style ticket */}
        <div className="rounded-lg bg-white px-5 py-6 font-mono text-[11px] leading-relaxed shadow-sm">
          <div className="text-center">
            <p className="text-[14px] font-bold">{settings.restaurantName}</p>
            <p>{settings.address}</p>
            <p>{settings.phone}</p>
          </div>
          <div className="my-3 border-t border-dashed border-neutral-300" />
          <div className="flex justify-between">
            <span>Order {order.number}</span>
            <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex justify-between">
            <span className="capitalize">{order.type.replace('-', ' ')}</span>
            <span>{order.cashier}</span>
          </div>
          <div className="flex justify-between">
            <span>Customer</span>
            <span>{order.customer}</span>
          </div>
          <div className="my-3 border-t border-dashed border-neutral-300" />
          {order.lines.map((l, i) => (
            <div key={i}>
              <div className="flex justify-between">
                <span>
                  {l.qty}x {l.name}
                </span>
                <span>{formatMoney(l.qty * l.price)}</span>
              </div>
              {l.note && (
                <p className="pl-3 italic text-neutral-500">— {l.note}</p>
              )}
            </div>
          ))}
          <div className="my-3 border-t border-dashed border-neutral-300" />
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{formatMoney(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{formatMoney(order.tax)}</span>
          </div>
          <div className="mt-1 flex justify-between text-[13px] font-bold">
            <span>TOTAL</span>
            <span>{formatMoney(order.total)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="capitalize">{order.payment}</span>
            <span>{formatMoney(order.tendered)}</span>
          </div>
          <div className="flex justify-between">
            <span>Change</span>
            <span>{formatMoney(order.change)}</span>
          </div>
          <div className="my-3 border-t border-dashed border-neutral-300" />
          <p className="text-center">{settings.receiptFooter}</p>
          <div className="mx-auto mt-3 h-8 w-4/5 bg-[repeating-linear-gradient(90deg,#000_0_2px,transparent_2px_5px)]" />
        </div>

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
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[12.5px] font-bold text-white shadow-md shadow-orange-500/25 hover:bg-primary-dark"
          >
            <Printer size={15} />
            Print
          </button>
        </div>
      </div>
    </div>
  )
}
