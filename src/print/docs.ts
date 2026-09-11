import { formatMoney, type Settings } from '../data/menu'
import type { PlacedOrder } from '../store'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const base = (mm: number, body: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
@page{margin:0}
body{margin:0;padding:4mm 3mm;font-family:'Courier New',monospace;font-size:11px;line-height:1.45;width:${mm - 7}mm;color:#000}
.c{text-align:center}.b{font-weight:700}.row{display:flex;justify-content:space-between}
hr{border:none;border-top:1px dashed #000;margin:3mm 0}
.big{font-size:15px;font-weight:700}.bar{height:9mm;margin-top:4mm;background:repeating-linear-gradient(90deg,#000 0 1.5px,transparent 1.5px 4px)}
</style></head><body>${body}</body></html>`

export function receiptHtml(o: PlacedOrder, s: Settings, copy = false): string {
  const w = Number(s.paperWidth)
  return base(
    w,
    `
${copy ? '<p class="c b">*** COPY ***</p>' : ''}
<p class="c big">${esc(s.restaurantName)}</p>
<p class="c">${esc(s.legalName)}</p>
<p class="c">${esc(s.address)}</p>
<p class="c">${esc(s.phone)} · ${esc(s.taxId)}</p>
<hr>
<div class="row"><span>Order ${o.number}</span><span>${new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
<div class="row"><span>${o.type.replace('-', ' ').toUpperCase()}</span><span>${esc(o.cashier)}</span></div>
<div class="row"><span>Customer</span><span>${esc(o.customer)}</span></div>
<hr>
${o.lines.map((l) => `<div class="row"><span>${l.qty}x ${esc(l.name)}</span><span>${formatMoney(l.qty * l.price)}</span></div>`).join('')}
<hr>
<div class="row"><span>Subtotal</span><span>${formatMoney(o.subtotal)}</span></div>
<div class="row"><span>Sales tax ${(s.taxRate * 100).toFixed(2)}%</span><span>${formatMoney(o.tax)}</span></div>
<div class="row big"><span>TOTAL</span><span>${formatMoney(o.total)}</span></div>
<div class="row"><span>${o.payment.toUpperCase()}</span><span>${formatMoney(o.tendered)}</span></div>
<div class="row"><span>Change</span><span>${formatMoney(o.change)}</span></div>
<hr>
<p class="c">${esc(s.receiptFooter)}</p>
<div class="bar"></div>`,
  )
}

export function kitchenHtml(o: PlacedOrder, s: Settings): string {
  return base(
    Number(s.paperWidth),
    `
<p class="c big">** KITCHEN **</p>
<hr>
<div class="row"><span class="b">Order ${o.number}</span><span>${new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
<div class="row"><span class="b">${o.type.replace('-', ' ').toUpperCase()}</span><span>${esc(o.customer)}</span></div>
<hr>
${o.lines.map((l) => `<div class="row b"><span>${l.qty}x ${esc(l.name)}</span></div>`).join('')}
<hr>
<p class="c">Cashier: ${esc(o.cashier)}</p>`,
  )
}

export function testHtml(role: string, s: Settings): string {
  return base(
    Number(s.paperWidth),
    `
<p class="c big">TEST PRINT</p>
<p class="c">${esc(s.restaurantName)}</p>
<hr>
<div class="row"><span>Role</span><span>${role.toUpperCase()}</span></div>
<div class="row"><span>Printer</span><span>${esc(role === 'kitchen' ? s.kitchenPrinter : s.billingPrinter)}</span></div>
<div class="row"><span>Paper</span><span>${s.paperWidth}mm</span></div>
<div class="row"><span>Time</span><span>${new Date().toLocaleTimeString()}</span></div>
<hr>
<p class="c">Printer OK</p>`,
  )
}

// Drawer kick: blank slip — real RJ11 kick happens via the printer driver
// ("cash drawer open at document start/end") or a future ESC/POS adapter.
export const kickHtml = (s: Settings) => base(Number(s.paperWidth), '<p class="c">·</p>')
