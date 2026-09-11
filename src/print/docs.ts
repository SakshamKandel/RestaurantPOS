import { formatMoney, type Settings } from '../data/menu'
import type { PlacedOrder } from '../store'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const TYPE_LABEL: Record<string, string> = {
  'take-away': 'TAKE AWAY',
  collection: 'COLLECTION',
  delivery: 'DELIVERY',
}
const PAY_LABEL: Record<string, string> = { cash: 'Cash', card: 'Card', scan: 'QR / Scan' }

const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

/** Shared thermal stylesheet. Widths are tuned for 58 mm (32 cols) and 80 mm
 *  (48 cols) receipt paper; everything is black-on-white for thermal heads. */
const base = (mm: number, body: string) => {
  const w = mm - 6 // printable width after margins
  const fs = mm === 58 ? 10.5 : 11.5
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{margin:0;size:${mm}mm auto}
*{box-sizing:border-box}
body{margin:0;padding:3mm;width:${w}mm;font-family:'Consolas','Courier New',monospace;font-size:${fs}px;line-height:1.4;color:#000;background:#fff;-webkit-print-color-adjust:exact}
.c{text-align:center}.r{text-align:right}.b{font-weight:700}.u{text-transform:uppercase}
.xs{font-size:${fs - 2}px}.sm{font-size:${fs - 1}px}.lg{font-size:${fs + 4}px}.xl{font-size:${fs + 8}px}
.row{display:flex;justify-content:space-between;gap:3mm}
.row>span:first-child{flex:1;min-width:0;word-break:break-word}
.row>span:last-child{white-space:nowrap}
hr{border:0;border-top:1px dashed #000;margin:2mm 0}
hr.solid{border-top:1.5px solid #000}
.item{display:flex;gap:2mm;margin:0.6mm 0}
.item .q{width:6mm;flex:none;font-weight:700}
.item .n{flex:1;min-width:0;word-break:break-word}
.item .p{flex:none;white-space:nowrap}
.note{padding-left:8mm;font-style:italic}
.tot{display:flex;justify-content:space-between;font-weight:700;font-size:${fs + 5}px;margin:1mm 0}
.badge{display:inline-block;border:1.5px solid #000;padding:0.5mm 3mm;font-weight:700;letter-spacing:0.5px}
.box{border:1.5px solid #000;padding:1.5mm 2mm;margin:1.5mm 0}
.kv{display:grid;grid-template-columns:auto 1fr;gap:0 3mm}
.kv span:nth-child(odd){color:#000}
.mt{margin-top:2mm}.mb{margin-bottom:2mm}
.footer{margin-top:3mm;padding-top:2mm;border-top:1px dashed #000}
.cut{height:6mm}
</style></head><body>${body}<div class="cut"></div></body></html>`
}

/* ------------------------------------------------------------------ */
/*  Customer receipt                                                    */
/* ------------------------------------------------------------------ */
export function receiptHtml(o: PlacedOrder, s: Settings, copy = false): string {
  const w = Number(s.billingPaper)
  const items = o.lines
    .map(
      (l) => `
<div class="item"><span class="q">${l.qty}</span><span class="n">${esc(l.name)}</span><span class="p">${formatMoney(l.qty * l.price)}</span></div>${
        l.qty > 1 ? `<div class="note xs">${l.qty} × ${formatMoney(l.price)}</div>` : ''
      }${l.note ? `<div class="note xs">* ${esc(l.note)}</div>` : ''}`,
    )
    .join('')
  const qty = o.lines.reduce((n, l) => n + l.qty, 0)
  const isCash = o.payment === 'cash'
  const header = [s.legalName && s.legalName !== s.restaurantName ? s.legalName : '', s.address, s.phone]
    .filter(Boolean)
    .map((t) => `<p class="c sm">${esc(t)}</p>`)
    .join('')

  return base(
    w,
    `
${copy ? '<p class="c"><span class="badge">DUPLICATE COPY</span></p><br>' : ''}
<p class="c b lg u">${esc(s.restaurantName)}</p>
${header}
${s.taxId ? `<p class="c xs">${esc(s.taxId)}</p>` : ''}
<hr class="solid">
<div class="row"><span>${fmtDate(o.createdAt)}</span><span>${fmtTime(o.createdAt)}</span></div>
<div class="row"><span>Order</span><span class="b">${esc(o.number)}</span></div>
<div class="row"><span>Served by</span><span>${esc(o.cashier)}</span></div>
${o.customer && o.customer !== 'Walk-in' ? `<div class="row"><span>Customer</span><span>${esc(o.customer)}</span></div>` : ''}
<p class="c mt"><span class="badge">${TYPE_LABEL[o.type] ?? o.type.toUpperCase()}</span></p>
<hr>
<div class="item xs b"><span class="q">QTY</span><span class="n">ITEM</span><span class="p">AMOUNT</span></div>
<hr>
${items}
<hr>
<div class="row"><span>Subtotal (${qty} item${qty === 1 ? '' : 's'})</span><span>${formatMoney(o.subtotal)}</span></div>
${o.discount ? `<div class="row"><span>Discount</span><span>-${formatMoney(o.discount)}</span></div>` : ''}
<div class="row"><span>Sales tax (${(s.taxRate * 100).toFixed(2)}%)</span><span>${formatMoney(o.tax)}</span></div>
<hr class="solid">
<div class="tot"><span>TOTAL</span><span>${formatMoney(o.total)}</span></div>
<hr class="solid">
<div class="row"><span>${PAY_LABEL[o.payment] ?? o.payment}${isCash ? ' tendered' : ''}</span><span>${formatMoney(isCash ? o.tendered : o.total)}</span></div>
${isCash ? `<div class="row b"><span>Change</span><span>${formatMoney(o.change)}</span></div>` : '<div class="row"><span>Status</span><span>APPROVED</span></div>'}
${o.note ? `<div class="box xs"><span class="b">Note:</span> ${esc(o.note)}</div>` : ''}
<div class="footer c">
  <p class="b">${esc(s.receiptFooter)}</p>
  ${s.website || s.email ? `<p class="xs">${esc([s.website, s.email].filter(Boolean).join(' · '))}</p>` : ''}
  <p class="xs mt">${esc(o.number)} · ${fmtDate(o.createdAt)} ${fmtTime(o.createdAt)}</p>
</div>`,
  )
}

/* ------------------------------------------------------------------ */
/*  Kitchen ticket — big, no prices, one item per line                 */
/* ------------------------------------------------------------------ */
export function kitchenHtml(o: PlacedOrder, s: Settings): string {
  const w = Number(s.kitchenPaper)
  const items = o.lines
    .map(
      (l) => `
<div class="item lg"><span class="q">${l.qty}</span><span class="n b">${esc(l.name)}</span></div>${
        l.note ? `<div class="note b">&gt;&gt; ${esc(l.note).toUpperCase()}</div>` : ''
      }`,
    )
    .join('')
  const qty = o.lines.reduce((n, l) => n + l.qty, 0)

  return base(
    w,
    `
<p class="c b xl">${esc(o.number)}</p>
<p class="c"><span class="badge lg">${TYPE_LABEL[o.type] ?? o.type.toUpperCase()}</span></p>
<hr class="solid">
<div class="row"><span>${fmtDate(o.createdAt)}</span><span class="b">${fmtTime(o.createdAt)}</span></div>
${o.customer && o.customer !== 'Walk-in' ? `<div class="row"><span>Customer</span><span class="b">${esc(o.customer)}</span></div>` : ''}
<div class="row"><span>Cashier</span><span>${esc(o.cashier)}</span></div>
<hr class="solid">
${items}
<hr class="solid">
${o.note ? `<div class="box b">ORDER NOTE:<br>${esc(o.note).toUpperCase()}</div>` : ''}
<div class="row b"><span>ITEMS</span><span>${qty}</span></div>
<p class="c xs mt">${esc(s.restaurantName)} · kitchen copy</p>`,
  )
}

/* ------------------------------------------------------------------ */
/*  Test page — alignment ruler so paper width can be verified          */
/* ------------------------------------------------------------------ */
export function testHtml(role: string, s: Settings): string {
  const kitchen = role === 'kitchen'
  const paper = kitchen ? s.kitchenPaper : s.billingPaper
  const cols = paper === '58' ? 32 : 48
  const ruler = Array.from({ length: cols }, (_, i) => ((i + 1) % 10 === 0 ? String(((i + 1) / 10) % 10) : '·')).join('')
  return base(
    Number(paper),
    `
<p class="c b lg">KHADKAPOS TEST PAGE</p>
<p class="c">${esc(s.restaurantName)}</p>
<hr class="solid">
<div class="kv">
  <span>Role</span><span class="b">${kitchen ? 'KITCHEN' : 'BILLING'}</span>
  <span>Printer</span><span>${esc(kitchen ? s.kitchenPrinter : s.billingPrinter)}</span>
  <span>Paper</span><span>${paper} mm · ${cols} cols</span>
  <span>Printed</span><span>${fmtDate(Date.now())} ${fmtTime(Date.now())}</span>
</div>
<hr>
<p class="xs" style="letter-spacing:0">${ruler}</p>
<p class="xs">|&lt;-- left edge ${' '.repeat(Math.max(0, cols - 36))} right edge --&gt;|</p>
<hr>
<p class="c sm">Both edges visible? Width is correct.</p>
<p class="c sm">Right side cut off? Switch to ${paper === '58' ? '80' : '58'} mm in Settings.</p>
<hr class="solid">
<p class="c b">PRINTER OK</p>`,
  )
}
