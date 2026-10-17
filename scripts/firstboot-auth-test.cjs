// Run with: node scripts/firstboot-auth-test.cjs
// Uses only generated temporary databases. Never opens installed app data.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { isDeepStrictEqual } = require('node:util')
const db = require('../electron/db.cjs')
const auth = require('../electron/auth.cjs')

const tempBase = fs.realpathSync(os.tmpdir())
const generatedRoot = fs.mkdtempSync(path.join(tempBase, 'khadkapos-firstboot-auth-'))
const canonicalRoot = fs.realpathSync(generatedRoot)
const isWithin = (parent, child) => {
  const relative = path.relative(parent, child)
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}
const verifyGeneratedRoot = () => {
  assert.ok(isWithin(tempBase, canonicalRoot), 'Test directory must be inside the temporary directory')
  assert.equal(path.dirname(canonicalRoot), tempBase, 'Test directory must be a direct temporary child')
  assert.ok(path.basename(canonicalRoot).startsWith('khadkapos-firstboot-auth-'), 'Expected generated test directory name')
  assert.equal(fs.realpathSync(generatedRoot), canonicalRoot, 'Generated directory must not be redirected')
}
const verifyOwnedPath = (file) => {
  verifyGeneratedRoot()
  const resolved = fs.existsSync(file) ? fs.realpathSync(file) : path.resolve(file)
  assert.ok(isWithin(canonicalRoot, resolved), 'Only generated test files may be reset')
}
const scenarioPaths = (name) => {
  const directory = path.join(generatedRoot, name)
  fs.mkdirSync(directory)
  return { directory, legacy: path.join(directory, 'pos-store.json') }
}
const emptyState = () => ({
  orders: [], held: [], customers: [], printJobs: [], menu: [], categories: [], shifts: [], audit: [], staff: [],
  settings: {}, seq: 1,
})
const noAdministratorKey = Symbol('no administrator key')
const assertNoAdministratorKey = () => {
  assert.ok(db.getKv('admin_pin', noAdministratorKey) === noAdministratorKey,
    'The fixed Administrator PIN must not require or initialize a database credential')
}
const assertLegacyValuePreserved = (expected) => {
  // Compare as a boolean so assertion failures never print credential hashes.
  assert.ok(db.getKv('admin_pin') === expected, 'Ignored legacy Administrator value must remain exactly unchanged')
}
const rawRows = (connection) => {
  const result = {}
  for (const { name } of connection.all("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")) {
    const quoted = `"${name.replaceAll('"', '""')}"`
    result[name] = connection.all(`SELECT * FROM ${quoted} ORDER BY 1`)
  }
  return result
}
const assertRowsPreserved = (connection, expected) => {
  assert.ok(isDeepStrictEqual(rawRows(connection), expected), 'Startup must preserve every existing database row')
}
let passed = 0
const test = (name, run) => {
  try {
    run()
    passed += 1
    console.log(`PASS ${name}`)
  } finally {
    db.close()
  }
}

try {
  verifyGeneratedRoot()
  assert.equal(auth.DEFAULT_ADMIN_PIN, '8865', 'The fixed Administrator PIN must remain consistent')

  test('fresh startup needs no saved Administrator credential and leaves manager setup empty', () => {
    const { directory, legacy } = scenarioPaths('fresh')
    db.open(directory, legacy)
    assertNoAdministratorKey()
    assert.equal(db.load(), null, 'Startup must not create visible staff or skip the setup wizard')
  })

  test('restart does not introduce a saved Administrator credential', () => {
    const { directory, legacy } = scenarioPaths('restart')
    const connection = db.open(directory, legacy)
    assertNoAdministratorKey()
    const originalRows = rawRows(connection)
    db.close()
    const reopened = db.open(directory, legacy)
    assertNoAdministratorKey()
    assertRowsPreserved(reopened, originalRows)
    assert.equal(db.load(), null)
  })

  test('ignored legacy Administrator hash and all business data survive upgrade and restart', () => {
    const { directory, legacy } = scenarioPaths('custom')
    const connection = db.open(directory, legacy)
    const customHash = auth.hashPin('572948')
    db.setKv('admin_pin', customHash)
    db.setKv('support_canary', { keep: true })
    db.commit({
      ...emptyState(),
      orders: [{ id: 'existing-sale', number: '#T001', total: 1800 }],
      staff: [{ id: 'existing-manager', name: 'Admin', role: 'manager', pin: '1234', active: true }],
      customers: [{ id: 'existing-customer', name: 'Customer' }],
      settings: { name: 'Existing Restaurant', taxRate: 0.095 },
      seq: 12,
    })
    const originalRows = rawRows(connection)
    db.close()
    const upgraded = db.open(directory, legacy)
    assertLegacyValuePreserved(customHash)
    assertRowsPreserved(upgraded, originalRows)
    assert.ok(auth.verifyPin('1234', db.staffRow('existing-manager').pin), 'A manager named Admin must retain their separate PIN')
    db.close()
    const restarted = db.open(directory, legacy)
    assertLegacyValuePreserved(customHash)
    assertRowsPreserved(restarted, originalRows)
  })

  test('manager and staff setup hashes staff PINs without creating an Administrator credential', () => {
    const { directory, legacy } = scenarioPaths('setup')
    db.open(directory, legacy)
    assertNoAdministratorKey()
    const manager = { id: 'manager-test', name: 'Test Manager', role: 'manager', pin: '1234', active: true, mustChangePin: false }
    db.commit({ ...emptyState(), staff: [manager] })
    assertNoAdministratorKey()
    const cashier = { id: 'cashier-test', name: 'Test Cashier', role: 'cashier', pin: '4321', active: true, mustChangePin: false }
    db.commit({ ...db.load(), staff: [...db.load().staff, cashier] })
    assertNoAdministratorKey()
    assert.ok(auth.isHashed(db.staffRow(manager.id).pin), 'Manager PIN must be hashed')
    assert.ok(auth.isHashed(db.staffRow(cashier.id).pin), 'Cashier PIN must be hashed')
    assert.ok(auth.verifyPin('1234', db.staffRow(manager.id).pin), 'Manager credential must persist through renderer commits')
    assert.ok(auth.verifyPin('4321', db.staffRow(cashier.id).pin), 'Staff setup must preserve its own credential')
    assert.equal(db.load().staff.length, 2, 'The hidden administrator must remain outside visible staff')
    assert.ok(db.load().staff.every((member) => member.pin === '' && member.hasPin), 'Renderer must receive no stored staff PINs')
    db.close()
    db.open(directory, legacy)
    assertNoAdministratorKey()
    assert.ok(auth.verifyPin('1234', db.staffRow(manager.id).pin), 'Manager PIN must survive restart')
    assert.ok(auth.verifyPin('4321', db.staffRow(cashier.id).pin), 'Cashier PIN must survive restart')
  })

  test('legacy JSON import preserves sales and staff credentials without a saved Administrator PIN', () => {
    const { directory, legacy } = scenarioPaths('legacy')
    fs.writeFileSync(legacy, JSON.stringify({
      ...emptyState(),
      orders: [{ id: 'legacy-sale', number: '#OLD001', total: 850 }],
      staff: [{ id: 'legacy-manager', name: 'Legacy Manager', role: 'manager', pin: '4321', active: true, mustChangePin: false }],
      seq: 42,
    }))
    db.open(directory, legacy)
    assertNoAdministratorKey()
    const state = db.load()
    assert.equal(state.orders[0].id, 'legacy-sale')
    assert.equal(state.orders[0].total, 850)
    assert.equal(state.seq, 42)
    assert.ok(auth.isHashed(db.staffRow('legacy-manager').pin), 'Imported plaintext staff PIN must be hashed')
    assert.ok(auth.verifyPin('4321', db.staffRow('legacy-manager').pin), 'Imported staff PIN must remain usable')
    assert.equal(state.staff[0].pin, '', 'Renderer state must not expose staff credentials')
    db.close()
    db.open(directory, legacy)
    assertNoAdministratorKey()
    assert.equal(db.load().orders.length, 1)
  })

  test('an existing SQLite database needs no Administrator key and preserves staff and settings', () => {
    const { directory, legacy } = scenarioPaths('existing-no-key')
    const connection = db.open(directory, legacy)
    assertNoAdministratorKey()
    db.commit({
      ...emptyState(), seq: 7, settings: { name: 'Keep Existing Settings' },
      staff: [{ id: 'old-cashier', name: 'Cashier', role: 'cashier', pin: '4321', active: true }],
    })
    const originalRows = rawRows(connection)
    db.close()
    const reopened = db.open(directory, legacy)
    assertNoAdministratorKey()
    assertRowsPreserved(reopened, originalRows)
    assert.ok(auth.verifyPin('4321', db.staffRow('old-cashier').pin), 'Existing staff PIN must remain usable')
  })

  test('malformed legacy Administrator data is preserved without affecting startup', () => {
    const { directory, legacy } = scenarioPaths('malformed-legacy-admin')
    const connection = db.open(directory, legacy)
    connection.run('INSERT INTO kv(key,value) VALUES(?,?)', ['admin_pin', 'old-invalid-json'])
    db.commit({ ...emptyState(), orders: [{ id: 'preserved-sale', total: 975 }] })
    const originalRows = rawRows(connection)
    db.close()
    const reopened = db.open(directory, legacy)
    assertRowsPreserved(reopened, originalRows)
    assert.equal(db.load().orders[0].total, 975, 'Ignored legacy credential data must not block loading sales')
  })

  test('explicit factory reset of synthetic stores returns to manager setup without Administrator seeding', () => {
    const { directory, legacy } = scenarioPaths('reset')
    db.open(directory, legacy)
    db.setKv('admin_pin', auth.hashPin('572948'))
    db.commit({ ...emptyState(), staff: [{ id: 'reset-manager', name: 'Reset Manager', role: 'manager', pin: '1234', active: true }] })
    db.syncLegacyJson(legacy)
    const databaseFile = db.file
    assert.equal(path.resolve(databaseFile), path.resolve(directory, 'pos.db'))
    verifyOwnedPath(databaseFile)
    verifyOwnedPath(legacy)
    db.reset(legacy)
    assert.ok(!fs.existsSync(databaseFile), 'Reset must remove only the synthetic SQLite file')
    assert.ok(!fs.existsSync(legacy), 'Reset must remove its synthetic legacy mirror')
    db.open(directory, legacy)
    assertNoAdministratorKey()
    assert.equal(db.load(), null, 'Factory reset must return to manager setup')
  })

  console.log(`${passed} first-boot authentication checks passed.`)
} finally {
  db.close()
  verifyGeneratedRoot()
  fs.rmSync(generatedRoot, { recursive: true, force: true })
}
