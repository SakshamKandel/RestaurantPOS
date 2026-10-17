// Run with: node scripts/unpaid-bill-doc-test.cjs
// Exercises actual document rendering in memory; never opens a database or printer.
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')

class StableDate extends Date {
  toLocaleDateString() { return 'Oct 17, 2026' }
  toLocaleTimeString() { return '10:30 AM' }
  static now() { return 0 }
}

const loaded = new Map()
function loadTypeScript(file) {
  const filename = path.resolve(__dirname, '..', file)
  if (loaded.has(filename)) return loaded.get(filename)
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText
  const localModule = { exports: {} }
  const nativeRequire = createRequire(filename)
  vm.runInNewContext(compiled, {
    module: localModule,
    exports: localModule.exports,
    Date: StableDate,
    require: (name) => name === '../data/menu' ? loadTypeScript('src/data/menu.ts') : nativeRequire(name),
  }, { filename })
  loaded.set(filename, localModule.exports)
  return localModule.exports
}

const { DEFAULT_SETTINGS } = loadTypeScript('src/data/menu.ts')
const { receiptHtml, unpaidBillHtml, kitchenHtml, testHtml } = loadTypeScript('src/print/docs.ts')
const settings = { ...DEFAULT_SETTINGS, billingPaper: '80' }
const bill = {
  number: '#DRAFT001', type: 'take-away', customer: 'Customer <A>',
  lines: [{
    itemId: 'item-1', name: 'Burger & fries', qty: 2, price: 1000,
    mods: [{ group: 'Extras', name: 'Cheese <extra>', price: 150 }],
    note: '<no onions> & mild',
  }],
  subtotal: 2300, discount: 300, tax: 200, total: 2200,
  note: 'Pack <carefully> & label',
  taxBreakdown: [{ name: 'Standard & local', rate: 0.1, amount: 200 }],
  createdAt: 0, cashier: 'Staff & A',
}
const paid = { ...bill, id: 'order-1', payment: 'credit', tendered: 0, change: 0, status: 'new' }
const includes = (html, text) => assert.ok(html.includes(text), `Expected document text: ${text}`)
const excludes = (html, text) => assert.ok(!html.includes(text), `Unexpected document text: ${text}`)
let passed = 0
const test = (name, run) => {
  run()
  passed += 1
  console.log(`PASS ${name}`)
}

test('unpaid bill identifies a draft reference and prints all amounts owed', () => {
  const html = unpaidBillHtml(bill, settings)
  for (const text of [
    'UNPAID BILL', '>Bill reference</span>', '#DRAFT001', '>TAKE AWAY<',
    'Burger &amp; fries', '+ Cheese &lt;extra&gt; $1.50', '2 × $11.50',
    'Subtotal (2 items)', '$23.00', '>Discount</span><span>-$3.00',
    'Tax · Standard &amp; local (10.00%)', '$2.00', '>TOTAL</span><span>$22.00',
    '>Amount due</span><span>$22.00',
  ]) includes(html, text)
  for (const text of ['>Order</span>', 'APPROVED', 'Cash tendered', '>Card</span>', '>Change</span>', 'DUPLICATE COPY']) excludes(html, text)
})

test('unpaid rendering ignores extraneous paid and refunded properties', () => {
  const html = unpaidBillHtml({
    ...paid, status: 'partial-refund', tendered: 3000, change: 800,
    lines: bill.lines.map((line) => ({ ...line, refundedQty: 1 })),
    payments: [{ method: 'cash', amount: 2200, tendered: 3000, change: 800 }],
    refunds: [{ at: 0, amount: 1100 }],
  }, settings)
  for (const text of ['APPROVED', 'Cash tendered', '>Change</span>', 'REFUNDED', '(refunded', '>Refund ']) excludes(html, text)
  includes(html, '>Amount due</span><span>$22.00')
})

test('unpaid customer, item, modifier, notes, reference, tax and settings text are escaped', () => {
  const text = '<img src=x onerror=alert(1)> & value'
  const escaped = '&lt;img src=x onerror=alert(1)&gt; &amp; value'
  const html = unpaidBillHtml({
    ...bill, number: text, customer: text, cashier: text, note: text,
    lines: [{ ...bill.lines[0], name: text, note: text, mods: [{ group: 'Extra', name: text, price: 150 }] }],
    taxBreakdown: [{ name: text, rate: 0.1, amount: 200 }],
  }, {
    ...settings, restaurantName: text, legalName: `Legal ${text}`, address: text,
    phone: text, taxId: text, receiptFooter: text, website: text, email: text,
  })
  excludes(html, '<img')
  excludes(html, text)
  includes(html, escaped)
  assert.ok(html.split(escaped).length >= 14, 'All supplied text locations must be escaped')
})

test('unpaid legacy tax fallback, singular quantity and zero-cost modifiers remain correct', () => {
  const html = unpaidBillHtml({
    ...bill, lines: [{ name: 'Tea', qty: 1, price: 1000, mods: [{ group: 'Sugar', name: 'No sugar', price: 0 }] }],
    taxBreakdown: undefined, discount: 0, subtotal: 1000, total: 1200,
  }, settings)
  includes(html, 'Subtotal (1 item)')
  includes(html, 'Sales tax (9.50%)')
  includes(html, '<div class="note xs">+ No sugar</div>')
  includes(html, '>Amount due</span><span>$12.00')
  excludes(html, '>Discount</span>')
})

test('unpaid bills retain 58 mm and 80 mm thermal page and printable widths', () => {
  for (const [paper, printable, fontSize] of [['58', 52, 10.5], ['80', 74, 11.5]]) {
    const html = unpaidBillHtml(bill, { ...settings, billingPaper: paper })
    includes(html, `size:${paper}mm auto`)
    includes(html, `width:${printable}mm`)
    includes(html, `font-size:${fontSize}px`)
    includes(html, 'word-break:break-word')
    includes(html, 'UNPAID BILL')
  }
})

// SHA-256 baselines captured before sharing the renderer with unpaid bills.
// StableDate isolates these output comparisons from host locale and timezone.
const paidCases = {
  card: [paid, false, 'df1e40e8af3ee22fe4b0698f1aa0a7733e1b619297b57cf141055d7cd1be3974'],
  cash: [{ ...paid, payment: 'cash', tendered: 3000, change: 800 }, false, '46da0c6b5e388c97311cfd076415a39e7da813c10bb15c06e1660fa601f7cc56'],
  split: [{ ...paid, payments: [
    { method: 'cash', amount: 1000, tendered: 1200, change: 200 },
    { method: 'credit', amount: 1200 },
  ] }, false, 'f8a9493548bb1833279b312977efbc59cd12db376f4cd9853d0232edcd0d7b53'],
  refundCopy: [{
    ...paid, status: 'partial-refund', lines: paid.lines.map((line) => ({ ...line, refundedQty: 1 })),
    refunds: [{ id: 'r1', at: 0, actor: 'Staff', lines: [{ index: 0, name: 'Burger', qty: 1, amount: 1100 }], amount: 1100 }],
  }, true, 'c3785ebbe026d62c5cb961345f40078a2ffef1cc31392454a6de7906043a1fb1'],
  fullRefund: [{ ...paid, status: 'refunded', refunds: [{ id: 'r1', at: 0, actor: 'Staff', lines: [], amount: 2200 }] }, false, '0bb9cd413c1126d472a89d47c93fa53a23c79570bd4aa12d2f6ceb432bf5aeb4'],
}
const digest = (html) => crypto.createHash('sha256').update(html).digest('hex')
for (const [name, [order, copy, expected]] of Object.entries(paidCases)) {
  test(`paid ${name} receipt output remains byte-for-byte unchanged`, () => {
    const html = receiptHtml(order, settings, copy)
    assert.equal(digest(html), expected)
    excludes(html, 'UNPAID BILL')
    excludes(html, 'Bill reference')
    excludes(html, 'Amount due')
  })
}

test('kitchen and printer-test document output remains unchanged', () => {
  assert.equal(digest(kitchenHtml(paid, settings)), '18a9899b80d7490de45650cd3d3d0492d5eb83e9322efdbbc34255ee255364e6')
  assert.equal(digest(testHtml('billing', settings)), '9dd3b6752247fd644ef3dc6f8e5d4504fabd93d7e97f00952186d9b68f917ce6')
})

console.log(`${passed} unpaid bill and existing document checks passed.`)
