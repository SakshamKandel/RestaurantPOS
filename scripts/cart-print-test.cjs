// Run with: node scripts/cart-print-test.cjs
// Executes real App printer functions and OrderPanel controls with an isolated
// in-memory state and mocked print bridge. Never starts Electron or prints.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const sourceRoot = path.resolve(__dirname, '../src')
const appFile = path.join(sourceRoot, 'App.tsx')
const appSource = fs.readFileSync(appFile, 'utf8')
const appAst = ts.createSourceFile(appFile, appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const app = appAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'App')
assert.ok(app?.body, 'App component must exist')
const names = ['markJob', 'deviceFor', 'paperFor', 'isDetected', 'roleProblem', 'processJob', 'makeJob', 'retryJob', 'printBill']
const statements = names.map((name) => {
  const statement = app.body.statements.find((node) => ts.isVariableStatement(node) &&
    node.declarationList.declarations.some((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name))
  assert.ok(statement, `Production App function ${name} must exist`)
  return statement.getText(appAst)
})
let orderPanelNode
function findOrderPanel(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(appAst) === 'OrderPanel') orderPanelNode = node
  ts.forEachChild(node, findOrderPanel)
}
findOrderPanel(app)
assert.ok(orderPanelNode, 'App must render OrderPanel')
const propExpression = (name) => {
  const attribute = orderPanelNode.attributes.properties.find((node) => ts.isJsxAttribute(node) && node.name.text === name)
  assert.ok(attribute && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression, `Expected OrderPanel ${name} binding`)
  return attribute.initializer.expression
}
assert.equal(propExpression('printing').getText(appAst), 'printingBill')
const compiledFunctions = ts.transpileModule([
  ...statements,
  `globalThis.printFunctions = { ${names.join(', ')} };`,
  `globalThis.invokeOrderPanelPrint = ${propExpression('onPrint').getText(appAst)};`,
].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS } }).outputText

const modules = new Map()
const mockReact = { ...React, useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect: () => {} }
function load(relative) {
  const file = path.resolve(sourceRoot, relative)
  if (modules.has(file)) return modules.get(file).exports
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  const entry = { exports: {} }
  modules.set(file, entry)
  const localRequire = createRequire(file)
  vm.runInNewContext(compiled.outputText, {
    module: entry, exports: entry.exports,
    require(name) {
      if (name === 'react') return mockReact
      if (!name.startsWith('.')) return localRequire(name)
      const base = path.resolve(path.dirname(file), name)
      assert.notEqual(base, path.join(sourceRoot, 'store'), 'Persistent store must not load in printer regression tests')
      const dependency = [`${base}.ts`, `${base}.tsx`, base].find((candidate) => fs.existsSync(candidate))
      assert.ok(dependency, `Production dependency ${name} must exist`)
      return load(path.relative(sourceRoot, dependency))
    },
  }, { filename: file })
  return entry.exports
}
const docs = load('print/docs.ts')
const { DEFAULT_SETTINGS } = load('data/menu.ts')
const OrderPanel = load('components/OrderPanel.tsx').default
assert.equal(typeof docs.unpaidBillHtml, 'function', 'Production unpaid-bill renderer must exist')
const plain = (value) => JSON.parse(JSON.stringify(value))
const same = (actual, expected, message) => assert.deepEqual(plain(actual), plain(expected), message)
const settle = () => new Promise((resolve) => setImmediate(resolve))

function harness(options = {}) {
  const menuItem = { id: 'burger', name: 'Burger & chips', price: 500, category: 'food', taxClass: 'standard', stock: 9, available: true, emoji: '🍔', image: '' }
  const lines = [{ key: 'burger|Size:Large', item: menuItem, qty: 2, note: 'No onion <please>', mods: [{ group: 'Size', name: 'Large', price: 100 }] }]
  const state = {
    settings: { ...plain(DEFAULT_SETTINGS), billingPrinter: 'Billing Printer', kitchenPrinter: 'Kitchen Printer', billingPaper: '80', kitchenPaper: '58', billingAutoPrint: false, taxRate: 0.1, taxClasses: [{ id: 'standard', name: 'Standard', rate: 0.1 }], orderPrefix: 'T' },
    menu: [menuItem], orders: [], held: [],
    customers: [{ id: 'alice', name: 'Alice', visits: 3, spent: 9000 }],
    shifts: [{ id: 'shift', float: 5000, closedAt: null, movements: [] }],
    seq: 17, printJobs: [], audit: [],
    ...options.state,
  }
  state.settings = { ...state.settings, ...options.settings }
  const calls = { documents: [], raw: [], archives: [], logs: [], messages: [], audits: [], printing: [], renderers: [] }
  let counter = 0
  const forbidden = (name) => () => assert.fail(`Printing an unpaid bill must not call ${name}`)
  const context = {
    state, lines: options.lines ?? lines,
    printers: options.printers ?? [{ name: 'Billing Printer' }, { name: 'Kitchen Printer' }],
    subtotal: 1200, discountCents: 120, tax: 108, total: 1188,
    lineNets: [1080], lineTaxes: [108], taxBreakdown: [{ name: 'Standard', rate: 0.1, amount: 108 }],
    customerId: 'alice', orderType: 'take-away', orderNote: 'Call before delivery & collect',
    user: { name: 'Test Cashier' }, payment: options.payment ?? 'scan',
    cart: { 'burger|Size:Large': { itemId: 'burger', qty: 2, mods: lines[0].mods } },
    billPrintBusy: { current: false }, printingBill: false,
    uid: () => `job-${++counter}`,
    Date: { now: () => 1_790_000_000_000 },
    rateFor: (item) => context.state.settings.taxClasses.find((taxClass) => taxClass.id === item.taxClass)?.rate ?? context.state.settings.taxRate,
    setState: (update) => { context.state = typeof update === 'function' ? update(context.state) : update },
    setPrintingBill: (value) => { calls.printing.push(value); context.printingBill = value },
    flash: (message) => calls.messages.push(message),
    audit: (action, detail) => calls.audits.push({ action, detail }),
    logError: (area, message) => calls.logs.push({ area, message }),
    printDocument(deviceName, html, paperWidthMm) {
      calls.documents.push({ deviceName, html, paperWidthMm })
      return options.send ? options.send() : Promise.resolve({ ok: true, reason: null })
    },
    printRaw(deviceName, bytes) { calls.raw.push({ deviceName, bytes: plain(bytes) }); return Promise.resolve({ ok: true, reason: null }) },
    drawerKickBytes: (pin) => [0x1b, 0x70, pin, 0x19, 0xfa],
    saveReceiptCopy: (...args) => { calls.archives.push(args); return Promise.resolve('mock-receipt.pdf') },
    ...Object.fromEntries(['unpaidBillHtml', 'receiptHtml', 'kitchenHtml', 'testHtml'].map((name) => [name, (...args) => {
      calls.renderers.push({ name, payload: plain(args[0]) })
      return docs[name](...args)
    }])),
    ...Object.fromEntries(['placeOrder', 'enqueueJobs', 'setCart', 'setPayOpen', 'clearCart', 'setReceipt', 'setLastOrder', 'setDiscount', 'setOrderNote'].map((name) => [name, forbidden(name)])),
  }
  vm.runInNewContext(compiledFunctions, context, { filename: 'isolated-cart-print-functions.cjs' })
  return {
    runtime: context, calls,
    ...context.printFunctions,
    clickOrderPanelPrint: () => context.invokeOrderPanelPrint(),
  }
}

const businessState = (app) => {
  const { printJobs: _printJobs, audit: _audit, ...state } = app.runtime.state
  return { state, cart: app.runtime.cart, lines: app.runtime.lines, payment: app.runtime.payment }
}
const assertNoPaymentSideEffects = (app, before) => {
  same(businessState(app), before, 'Printing must preserve cart, sale history, inventory, customers, numbering, and shifts')
  assert.equal(app.calls.raw.length, 0, 'An unpaid bill must not pulse the drawer')
  assert.equal(app.calls.archives.length, 0, 'An unpaid bill must not enter the paid-receipt archive')
}

function panel(app, overrides = {}) {
  const forbidden = () => assert.fail('Print must not trigger another order control')
  return OrderPanel({
    orderNumber: '#T017', lines: app.runtime.lines, subtotal: 1200, discount: 120, tax: 108, total: 1188,
    paymentMethod: app.runtime.payment, orderType: 'take-away', customerId: 'alice', customers: app.runtime.state.customers,
    heldCount: 0, discountInput: { type: 'flat', value: 120 }, orderNote: app.runtime.orderNote,
    onPrint: app.clickOrderPanelPrint, printing: app.runtime.printingBill,
    ...Object.fromEntries(['onPaymentChange', 'onTypeChange', 'onCustomerChange', 'onLineQty', 'onLineNote', 'onRemoveLine', 'onClear', 'onDiscountChange', 'onOrderNote', 'onHold', 'onOrder', 'onOpenDrawer', 'onReprintLast'].map((name) => [name, forbidden])),
    drawerEnabled: true, hasLastOrder: false, ...overrides,
  })
}
function elements(node, predicate, found = []) {
  if (Array.isArray(node)) node.forEach((child) => elements(child, predicate, found))
  else if (React.isValidElement(node)) {
    if (predicate(node)) found.push(node)
    elements(node.props.children, predicate, found)
  }
  return found
}
const text = (node) => Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : ''
const printButton = (tree) => {
  const buttons = elements(tree, (node) => node.type === 'button' && ['Print', 'Printing…'].includes(text(node).trim()))
  assert.equal(buttons.length, 1, 'OrderPanel must expose exactly one current-bill Print button')
  return buttons[0]
}

let passed = 0
async function test(name, run) {
  await run()
  passed += 1
  console.log(`PASS ${name}`)
}

async function main() {
  await test('real OrderPanel Print wiring queues a billing document with current cart details and totals', async () => {
    const app = harness()
    const before = plain(businessState(app))
    const button = printButton(panel(app))
    assert.equal(button.props.disabled, false)
    button.props.onClick()
    await settle()
    assert.equal(app.calls.documents.length, 1)
    const sent = app.calls.documents[0]
    assert.equal(sent.deviceName, 'Billing Printer')
    assert.equal(sent.paperWidthMm, 80)
    for (const detail of ['UNPAID BILL', 'Burger &amp; chips', 'Large', 'No onion &lt;please&gt;', '$12.00', '$1.20', '$1.08', '$11.88', 'Alice']) assert.ok(sent.html.includes(detail), `Bill must show ${detail}`)
    assert.ok(!sent.html.includes('APPROVED'))
    assert.ok(!sent.html.includes(' tendered'))
    const job = app.runtime.state.printJobs[0]
    assert.equal(job.docType, 'UNPAID BILL')
    assert.equal(job.role, 'billing')
    assert.equal(job.status, 'printed')
    assert.equal(job.orderNumber, 'Draft #T017')
    assert.equal(job.bill.discount, 120)
    assert.equal(job.bill.lines[0].tax, 108)
    assert.equal(job.bill.lines[0].net, 1080)
    assert.equal(job.bill.note, 'Call before delivery & collect')
    assert.ok(app.calls.messages.some((message) => message.startsWith('Unpaid bill sent')))
    assertNoPaymentSideEffects(app, before)
  })

  await test('Cash, Scan, and Credit selection never complete payment when printing', async () => {
    for (const payment of ['cash', 'scan', 'credit']) {
      const app = harness({ payment })
      const before = plain(businessState(app))
      printButton(panel(app)).props.onClick()
      await settle()
      assert.equal(app.runtime.state.printJobs[0].status, 'printed')
      assertNoPaymentSideEffects(app, before)
    }
  })

  await test('empty and busy Print controls are disabled, and empty carts do not queue jobs', async () => {
    const empty = harness({ lines: [] })
    assert.equal(printButton(panel(empty)).props.disabled, true)
    await empty.printBill()
    assert.equal(empty.runtime.state.printJobs.length, 0)
    assert.equal(empty.calls.documents.length, 0)
    const busy = harness()
    const tree = panel(busy, { printing: true })
    assert.equal(printButton(tree).props.disabled, true)
    assert.ok(renderToStaticMarkup(tree).includes('Printing…'))
  })

  await test('pending bridge results suppress duplicate clicks and release the busy flag afterward', async () => {
    let resolvePrint
    const pending = new Promise((resolve) => { resolvePrint = resolve })
    const app = harness({ send: () => pending })
    const first = app.printBill()
    assert.equal(app.runtime.state.printJobs[0].status, 'pending')
    assert.equal(app.runtime.billPrintBusy.current, true)
    assert.equal(app.runtime.printingBill, true)
    await app.printBill()
    assert.equal(app.calls.documents.length, 1)
    assert.equal(app.runtime.state.printJobs.length, 1)
    assert.ok(!app.calls.messages.some((message) => message.startsWith('Unpaid bill sent')))
    resolvePrint({ ok: true, reason: null })
    await first
    assert.equal(app.runtime.state.printJobs[0].status, 'printed')
    assert.equal(app.runtime.billPrintBusy.current, false)
    assert.equal(app.runtime.printingBill, false)
    same(app.calls.printing, [true, false])
  })

  await test('failed hardware and bridge paths persist a failed job, show errors, and never claim success', async () => {
    for (const [label, options, reason, sends] of [
      ['unassigned', { settings: { billingPrinter: '' } }, 'No printer assigned', 0],
      ['uninstalled', { printers: [] }, 'not installed', 0],
      ['browser', { send: () => null }, 'desktop app', 1],
      ['spooler rejected', { send: () => Promise.resolve({ ok: false, reason: 'Paper out' }) }, 'Paper out', 1],
      ['bridge rejected', { send: () => Promise.reject(new Error('Printer offline')) }, 'Printer offline', 1],
      ['bridge threw', { send: () => { throw new Error('Bridge failed') } }, 'Bridge failed', 1],
    ]) {
      const app = harness(options)
      const before = plain(businessState(app))
      await app.printBill()
      const job = app.runtime.state.printJobs[0]
      assert.equal(job.status, 'failed', label)
      assert.ok(job.error.includes(reason), label)
      assert.equal(app.calls.documents.length, sends, label)
      assert.ok(app.calls.messages.some((message) => message.startsWith("Can't print bill") && message.includes(reason)), label)
      assert.ok(!app.calls.messages.some((message) => message.startsWith('Unpaid bill sent')), label)
      assert.equal(app.runtime.billPrintBusy.current, false, label)
      assert.equal(app.calls.audits.length, 0, label)
      assertNoPaymentSideEffects(app, before)
    }
  })

  await test('saved bill snapshots survive cart edits and retries after restart and matching-number checkout', async () => {
    const app = harness()
    await app.printBill()
    const original = plain(app.runtime.state.printJobs[0])
    const originalHtml = app.calls.documents[0].html
    app.runtime.lines[0].mods[0].price = 999
    app.runtime.lines[0].item.name = 'Changed menu name'
    app.runtime.taxBreakdown[0].amount = 999
    same(app.runtime.state.printJobs[0], original, 'Cart edits must not mutate queued snapshot values')

    const paid = { ...original.bill, id: 'completed', number: original.orderNumber, total: 999999, lines: [{ name: 'Wrong completed order', price: 999999, qty: 1 }], payment: 'cash', tendered: 999999, change: 0, status: 'new' }
    const restarted = harness({ lines: [], state: { printJobs: [plain(original)], orders: [paid], seq: 18 } })
    restarted.retryJob(original.id)
    await settle()
    assert.equal(restarted.calls.documents.length, 1)
    assert.equal(restarted.calls.documents[0].html, originalHtml)
    assert.equal(restarted.runtime.state.printJobs[0].status, 'printed')
    assert.equal(restarted.calls.renderers[0].name, 'unpaidBillHtml')
    assert.equal(restarted.calls.raw.length, 0)
    assert.equal(restarted.calls.archives.length, 0)
    assert.equal(restarted.runtime.state.orders[0].total, 999999)
    assert.equal(restarted.runtime.state.seq, 18)
  })

  await test('missing bill snapshots fail without dispatching a test page or a paid receipt', async () => {
    const app = harness()
    const job = app.makeJob('UNPAID BILL', 'billing', 'Draft #missing')
    app.runtime.state.printJobs.push(job)
    const result = await app.processJob(job)
    assert.equal(result.ok, false)
    assert.ok(result.reason.includes('snapshot is missing'))
    assert.equal(app.runtime.state.printJobs[0].status, 'failed')
    assert.equal(app.calls.documents.length, 0)
    assert.equal(app.calls.renderers.length, 0)
    app.retryJob(job.id)
    await settle()
    assert.equal(app.calls.documents.length, 0)
  })

  await test('receipt, kitchen, test, and drawer jobs retain their existing dispatch paths', async () => {
    for (const [type, role, renderer] of [
      ['RECEIPT', 'billing', 'receiptHtml'], ['KITCHEN TICKET', 'kitchen', 'kitchenHtml'],
      ['TEST', 'billing', 'testHtml'], ['DRAWER KICK', 'billing', 'testHtml'],
    ]) {
      const app = harness()
      await app.printBill()
      const bill = app.runtime.state.printJobs[0].bill
      const order = { ...plain(bill), id: 'paid', number: '#T017', payment: 'cash', tendered: 2000, change: 812, status: 'new' }
      app.calls.documents.length = 0
      app.calls.renderers.length = 0
      const job = app.makeJob(type, role, order.number, type === 'RECEIPT')
      app.runtime.state.printJobs.push(job)
      const result = await app.processJob(job, order)
      assert.equal(result.ok, true, type)
      assert.ok(app.calls.renderers.some((call) => call.name === renderer), type)
      assert.equal(app.calls.documents.length, type === 'DRAWER KICK' ? 0 : 1, type)
      assert.equal(app.calls.raw.length, type === 'DRAWER KICK' ? 1 : 0, type)
      assert.equal(app.calls.archives.length, type === 'RECEIPT' ? 1 : 0, type)
      assert.equal(app.runtime.state.printJobs.at(-1).status, 'printed', type)
    }
  })

  console.log(`${passed} cart printing checks passed.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
