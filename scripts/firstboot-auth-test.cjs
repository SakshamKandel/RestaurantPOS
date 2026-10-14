// Run with: node scripts/firstboot-auth-test.cjs
// Uses only generated temporary databases. Never opens installed app data.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
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
const storedAdminHash = () => db.getKv('admin_pin')
const verifyDefaultSeed = () => {
  const hash = storedAdminHash()
  assert.ok(auth.isHashed(hash), 'Startup must store a hash before any login')
  assert.ok(auth.verifyPin('8865', hash), 'Fresh startup hash must accept the default administrator PIN')
  return hash
}
const assertHashPreserved = (expected) => {
  // Compare as a boolean so assertion failures never print credential hashes.
  assert.ok(storedAdminHash() === expected, 'Existing administrator hash must remain exactly unchanged')
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
  assert.equal(auth.DEFAULT_ADMIN_PIN, '8865', 'The shared fresh-install default must remain consistent')

  test('fresh startup seeds hidden administrator before login and leaves manager setup empty', () => {
    const { directory, legacy } = scenarioPaths('fresh')
    db.open(directory, legacy)
    verifyDefaultSeed()
    assert.equal(db.load(), null, 'A hidden credential must not create visible staff or skip the setup wizard')
  })

  test('restart preserves the exact automatically seeded hash', () => {
    const { directory, legacy } = scenarioPaths('restart')
    db.open(directory, legacy)
    const initialHash = verifyDefaultSeed()
    db.close()
    db.open(directory, legacy)
    assertHashPreserved(initialHash)
    assert.equal(db.load(), null)
  })

  test('changed administrator credential survives restart and existing database upgrade', () => {
    const { directory, legacy } = scenarioPaths('custom')
    db.open(directory, legacy)
    const customHash = auth.hashPin('572948')
    db.setKv('admin_pin', customHash)
    db.commit({ ...emptyState(), orders: [{ id: 'existing-sale', number: '#T001', total: 1800 }] })
    db.close()
    db.open(directory, legacy)
    assertHashPreserved(customHash)
    assert.ok(auth.verifyPin('572948', storedAdminHash()), 'Existing custom credential must still work')
    assert.ok(!auth.verifyPin('8865', storedAdminHash()), 'Default must not replace an existing custom credential')
    assert.equal(db.load().orders[0].total, 1800, 'Existing sales must remain unchanged')
    db.close()
    db.open(directory, legacy)
    assertHashPreserved(customHash)
  })

  test('manager creation and subsequent staff commits preserve the hidden seeded credential', () => {
    const { directory, legacy } = scenarioPaths('setup')
    db.open(directory, legacy)
    const initialHash = verifyDefaultSeed()
    const manager = { id: 'manager-test', name: 'Test Manager', role: 'manager', pin: '1234', active: true, mustChangePin: false }
    db.commit({ ...emptyState(), staff: [manager] })
    assertHashPreserved(initialHash)
    const cashier = { id: 'cashier-test', name: 'Test Cashier', role: 'cashier', pin: '4321', active: true, mustChangePin: false }
    db.commit({ ...db.load(), staff: [...db.load().staff, cashier] })
    assertHashPreserved(initialHash)
    assert.ok(auth.verifyPin('1234', db.staffRow(manager.id).pin), 'Manager credential must persist through renderer commits')
    assert.ok(auth.verifyPin('4321', db.staffRow(cashier.id).pin), 'Staff setup must preserve its own credential')
    assert.equal(db.load().staff.length, 2, 'The hidden administrator must remain outside visible staff')
    db.close()
    db.open(directory, legacy)
    assertHashPreserved(initialHash)
  })

  test('legacy JSON import avoids eager administrator seeding and preserves sales and staff credentials', () => {
    const { directory, legacy } = scenarioPaths('legacy')
    fs.writeFileSync(legacy, JSON.stringify({
      ...emptyState(),
      orders: [{ id: 'legacy-sale', number: '#OLD001', total: 850 }],
      staff: [{ id: 'legacy-manager', name: 'Legacy Manager', role: 'manager', pin: '4321', active: true, mustChangePin: false }],
      seq: 42,
    }))
    db.open(directory, legacy)
    assert.equal(storedAdminHash(), null, 'A migrated installation must retain its lazy administrator fallback')
    const state = db.load()
    assert.equal(state.orders[0].id, 'legacy-sale')
    assert.equal(state.orders[0].total, 850)
    assert.equal(state.seq, 42)
    assert.ok(auth.verifyPin('4321', db.staffRow('legacy-manager').pin), 'Imported staff PIN must remain usable')
    assert.equal(state.staff[0].pin, '', 'Renderer state must not expose staff credentials')
    db.close()
    db.open(directory, legacy)
    assert.equal(storedAdminHash(), null, 'Restart must not treat the migrated database as a fresh install')
    assert.equal(db.load().orders.length, 1)
  })

  test('an existing SQLite database missing the administrator key is not automatically seeded', () => {
    const { directory, legacy } = scenarioPaths('existing-no-key')
    const connection = db.open(directory, legacy)
    // Simulate a prior app version using the connection returned by the public open API.
    connection.run('DELETE FROM kv WHERE key=?', ['admin_pin'])
    db.commit({ ...emptyState(), seq: 7 })
    db.close()
    db.open(directory, legacy)
    assert.equal(storedAdminHash(), null, 'Missing key in an existing database must retain the existing fallback')
    assert.equal(db.load().seq, 7, 'Existing SQLite state must remain unchanged')
  })

  test('explicit factory reset removes synthetic stores and returns to fresh administrator seeding', () => {
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
    verifyDefaultSeed()
    assert.ok(!auth.verifyPin('572948', storedAdminHash()), 'Factory reset must discard the previous custom credential')
    assert.equal(db.load(), null, 'Factory reset must return to manager setup')
  })

  console.log(`${passed} first-boot authentication checks passed.`)
} finally {
  db.close()
  verifyGeneratedRoot()
  fs.rmSync(generatedRoot, { recursive: true, force: true })
}
