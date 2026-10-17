// Run with: node scripts/fixed-admin-auth-test.cjs
// Executes the real auth IPC handlers and auth primitives in isolated VMs.
// Every database is a mock; Electron startup and installed app data are never used.
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const mainSource = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf8')
const authSource = fs.readFileSync(path.join(__dirname, '../electron/auth.cjs'), 'utf8')
const start = mainSource.indexOf('// --- Auth:')
const end = mainSource.indexOf('// --- Printers:', start)
assert.ok(start >= 0 && end > start, 'Authentication IPC handler block must exist')
const handlerSource = mainSource.slice(start, end)
const plain = (value) => JSON.parse(JSON.stringify(value))

function forbiddenDatabase(savedAdminPin) {
  return new Proxy({ admin_pin: savedAdminPin }, {
    get(_target, key) {
      assert.fail(`Fixed Administrator authentication must not access database property ${String(key)}`)
    },
    set(_target, key) {
      assert.fail(`Fixed Administrator authentication must not change database property ${String(key)}`)
    },
  })
}

function harness(database = forbiddenDatabase()) {
  let now = 1_000_000
  const authModule = { exports: {} }
  vm.runInNewContext(authSource, {
    module: authModule,
    require(name) {
      assert.equal(name, 'crypto', 'Authentication primitives must use only the crypto runtime')
      return crypto
    },
    Buffer,
    Date: { now: () => now },
  }, { filename: 'isolated-auth.cjs' })
  const auth = authModule.exports
  const handlers = new Map()
  const logs = []
  vm.runInNewContext(handlerSource, {
    auth,
    db: database,
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    ulog: (message) => logs.push(message),
    logToFile: (area, message) => logs.push(`${area}: ${message}`),
  }, { filename: 'auth-ipc-handlers.cjs' })
  assert.equal(typeof handlers.get('auth:login'), 'function')
  assert.equal(typeof handlers.get('auth:set-pin'), 'function')
  return {
    auth,
    logs,
    advance: (milliseconds) => { now += milliseconds },
    login: (id, pin) => plain(handlers.get('auth:login')(null, { id, pin })),
    setPin: (id, pin) => plain(handlers.get('auth:set-pin')(null, { id, pin })),
  }
}

function staffDatabase() {
  const rows = new Map()
  const updates = []
  const methods = {
    staffRow: (id) => rows.get(id) ?? null,
    updateStaffRow(id, patch) {
      const current = rows.get(id)
      if (!current) return false
      rows.set(id, { ...current, ...patch })
      updates.push({ id, patch })
      return true
    },
  }
  const database = new Proxy(methods, {
    get(target, key) {
      assert.ok(Object.hasOwn(target, key), `Staff auth must not access unrelated database property ${String(key)}`)
      return target[key]
    },
  })
  return { database, rows, updates }
}

let passed = 0
function test(name, run) {
  run()
  passed += 1
  console.log(`PASS ${name}`)
}

test('Administrator 8865 succeeds without any database access', () => {
  const app = harness()
  assert.equal(app.auth.DEFAULT_ADMIN_PIN, '8865')
  assert.deepEqual(app.login('super-admin', '8865'), { ok: true, mustChangePin: false })
})

test('custom, malformed, empty, and missing saved Administrator data are never read', () => {
  const hash = harness().auth.hashPin('572948')
  for (const stored of [hash, 'pbkdf2$broken', '{invalid JSON', { invalid: true }, '', null, undefined]) {
    const app = harness(forbiddenDatabase(stored))
    assert.deepEqual(app.login('super-admin', '8865'), { ok: true, mustChangePin: false })
  }
})

test('wrong and previously saved custom Administrator PINs are rejected', () => {
  for (const pin of ['0000', '8864', '88650', '572948', '', '886']) {
    const app = harness()
    assert.deepEqual(app.login('super-admin', pin), { ok: false, fails: 1, lockSeconds: 0 })
  }
})

test('Administrator PIN changes are refused without accessing the database', () => {
  const app = harness()
  for (const pin of ['1234', '12345', '123456', '8865', 'abc', '']) {
    assert.equal(app.setPin('super-admin', pin).ok, false)
  }
  assert.deepEqual(app.login('super-admin', '8865'), { ok: true, mustChangePin: false })
})

test('Administrator failure lockouts still escalate and correct login clears failures', () => {
  const app = harness()
  for (const [index, seconds] of [0, 0, 30, 60, 300, 900, 900].entries()) {
    assert.deepEqual(app.login('super-admin', '0000'), { ok: false, fails: index + 1, lockSeconds: seconds })
    if (seconds > 0) {
      assert.deepEqual(app.login('super-admin', '8865'), { ok: false, lockSeconds: seconds })
      app.advance(seconds * 1000 + 1)
    }
  }
  assert.deepEqual(app.login('super-admin', '8865'), { ok: true, mustChangePin: false })
  assert.deepEqual(app.login('super-admin', '0000'), { ok: false, fails: 1, lockSeconds: 0 })
})

test('staff hashed verification, rejection, and one-time PIN flags are preserved', () => {
  const { database, rows, updates } = staffDatabase()
  const app = harness(database)
  const stored = app.auth.hashPin('1234')
  rows.set('cashier', { id: 'cashier', pin: stored, mustChangePin: false })
  rows.set('temporary', { id: 'temporary', pin: app.auth.hashPin('4321'), mustChangePin: true })
  assert.deepEqual(app.login('cashier', '0000'), { ok: false, fails: 1, lockSeconds: 0 })
  assert.deepEqual(app.login('cashier', '1234'), { ok: true, mustChangePin: false })
  assert.deepEqual(app.login('temporary', '4321'), { ok: true, mustChangePin: true })
  assert.deepEqual(app.login('unknown-staff', '8865'), { ok: false, reason: 'no-account' })
  assert.equal(rows.get('cashier').pin, stored, 'Successful login must not rewrite an existing staff hash')
  assert.equal(updates.length, 0)
})

test('legacy staff plaintext PIN still upgrades to a salted hash on successful login', () => {
  const { database, rows, updates } = staffDatabase()
  const app = harness(database)
  rows.set('legacy', { id: 'legacy', pin: '1234', mustChangePin: true })
  assert.deepEqual(app.login('legacy', '1234'), { ok: true, mustChangePin: true })
  assert.equal(updates.length, 1)
  assert.equal(updates[0].id, 'legacy')
  assert.ok(app.auth.isHashed(rows.get('legacy').pin))
  assert.ok(app.auth.verifyPin('1234', rows.get('legacy').pin))
})

test('staff PIN changes still persist a hash and clear the one-time PIN flag', () => {
  const { database, rows, updates } = staffDatabase()
  const app = harness(database)
  rows.set('cashier', { id: 'cashier', pin: app.auth.hashPin('1234'), mustChangePin: true })
  assert.deepEqual(app.setPin('cashier', '4321'), { ok: true })
  assert.equal(updates.length, 1)
  assert.ok(app.auth.isHashed(rows.get('cashier').pin))
  assert.ok(app.auth.verifyPin('4321', rows.get('cashier').pin))
  assert.equal(rows.get('cashier').mustChangePin, false)
  assert.deepEqual(app.login('cashier', '4321'), { ok: true, mustChangePin: false })
  for (const pin of ['', '123', '1234567', 'abcd']) assert.equal(app.setPin('cashier', pin).ok, false)
  assert.equal(updates.length, 1, 'Invalid staff PINs must not write a row')
  assert.deepEqual(app.setPin('unknown-staff', '4321'), { ok: false })
})

console.log(`${passed} fixed Administrator authentication checks passed.`)
