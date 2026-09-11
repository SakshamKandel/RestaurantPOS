const fs = require('fs'), path = require('path'), os = require('os')
const db = require('../electron/db.cjs'), auth = require('../electron/auth.cjs')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpos-'))
const legacy = path.join(dir, 'pos-store.json')
fs.writeFileSync(legacy, JSON.stringify({ orders: [{ id: 'o1', number: '#DNN001', total: 100 }], staff: [{ id: 's1', name: 'Admin', role: 'manager', pin: '1234', active: true, mustChangePin: false }], customers: [], held: [], printJobs: [], menu: [], categories: [], shifts: [], audit: [], settings: { taxRate: 0.095 }, seq: 2 }))
db.open(dir, legacy)
const st = db.load()
console.log('imported orders:', st.orders.length, '| staff pin hidden:', JSON.stringify(st.staff[0].pin), 'hasPin:', st.staff[0].hasPin, '| legacy renamed:', fs.existsSync(legacy.replace('.json', '.migrated.json')))
console.log('stored pin is plaintext (legacy):', db.staffRow('s1').pin)
// login upgrades to hash
console.log('verify 1234:', auth.verifyPin('1234', db.staffRow('s1').pin), '| verify 0000:', auth.verifyPin('0000', db.staffRow('s1').pin))
db.updateStaffRow('s1', { pin: auth.hashPin('1234') })
console.log('after upgrade hashed:', auth.isHashed(db.staffRow('s1').pin), '| verify 1234:', auth.verifyPin('1234', db.staffRow('s1').pin))
// diff commit: add order, add staff with plaintext pin (should hash), keep existing staff with pin ''
const next = { ...st, orders: [...st.orders, { id: 'o2', number: '#DNN002', total: 200 }], seq: 3, staff: [...st.staff, { id: 's2', name: 'Bob', role: 'cashier', pin: '5555', active: true, mustChangePin: false }] }
db.commit(next)
const re = db.load()
console.log('after commit orders:', re.orders.length, 'seq:', re.seq, '| s1 hash kept:', auth.verifyPin('1234', db.staffRow('s1').pin), '| s2 hashed:', auth.isHashed(db.staffRow('s2').pin), auth.verifyPin('5555', db.staffRow('s2').pin))
// delete
db.commit({ ...re, orders: re.orders.filter(o => o.id !== 'o1') })
console.log('after delete orders:', db.load().orders.map(o => o.id))
// throttle
for (let i = 0; i < 4; i++) auth.recordFailure('x')
console.log('locked after 4 fails (s):', auth.lockedFor('x'))

// new feature fields round-trip: modifiers, tax breakdown, split payments, refunds, stock
const rich = db.load()
rich.menu.push({ id: 'm1', name: 'Momo', price: 800, category: 'c', available: true, image: '', emoji: '🥟', stock: 10, lowStockAt: 3, taxClass: 'std', modifiers: [{ id: 'g1', name: 'Size', required: true, multi: false, options: [{ id: 'o', name: 'Large', price: 200 }] }] })
rich.settings.taxClasses = [{ id: 'std', name: 'Standard', rate: 0.095 }, { id: 'exempt', name: 'Exempt', rate: 0 }]
rich.orders.push({
  id: 'o3', number: '#DNN003', type: 'take-away', customer: 'Walk-in',
  lines: [{ itemId: 'm1', name: 'Momo', qty: 2, price: 800, mods: [{ group: 'Size', name: 'Large', price: 200 }], taxRate: 0.095, net: 2000, tax: 190, refundedQty: 1 }],
  subtotal: 2000, discount: 0, tax: 190, total: 2190,
  payments: [{ method: 'cash', amount: 1000, tendered: 1000, change: 0 }, { method: 'credit', amount: 1190 }],
  refunds: [{ id: 'r1', at: Date.now(), actor: 'Admin', lines: [{ index: 0, name: 'Momo', qty: 1, amount: 1095 }], amount: 1095 }],
  taxBreakdown: [{ name: 'Standard', rate: 0.095, amount: 190 }],
  payment: 'cash', tendered: 1000, change: 0, status: 'partial-refund', createdAt: Date.now(), cashier: 'Admin',
})
db.commit(rich)
const rt = db.load()
const ro = rt.orders.find((o) => o.id === 'o3')
console.log('mods round-trip:', JSON.stringify(ro.lines[0].mods), '| payments:', ro.payments.length, '| refund:', ro.refunds[0].amount, '| stock:', rt.menu[0].stock, '| taxClasses:', rt.settings.taxClasses.length)

console.log('integrity:', db.integrity())
db.close()
fs.rmSync(dir, { recursive: true, force: true })
