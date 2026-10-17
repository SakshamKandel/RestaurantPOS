// Exercise the staged client kit using the real packaged app as its Node host.
// Usage: node scripts/client-recovery-test.cjs [KhadkaPOS.exe] [staged-kit-folder]
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { isDeepStrictEqual } = require('node:util')

const release = path.join(os.homedir(), 'pos-release')
const executable = path.resolve(process.argv[2] || path.join(release, 'win-unpacked', 'KhadkaPOS.exe'))
const kit = path.resolve(process.argv[3] || path.join(release, 'KhadkaPOS-Admin-Recovery'))
const wrapper = path.join(kit, 'run-recovery.cjs')
const successReceipt = 'KHADKAPOS_ADMIN_RECOVERY_COMPLETED\r\n'
const tempParent = fs.realpathSync(os.tmpdir())
const scratch = fs.mkdtempSync(path.join(tempParent, 'khadkapos-client-recovery-test-'))
const scratchReal = fs.realpathSync(scratch)
const isolatedUserData = path.join(scratch, 'isolated app data')
const isolatedAppData = path.join(scratch, 'isolated roaming data')
const environment = {
  ...process.env,
  ELECTRON_RUN_AS_NODE: '1',
  KPOS_USERDATA: isolatedUserData,
  APPDATA: isolatedAppData,
}

function same(actual, expected, message) {
  // Avoid printing staff PIN hashes if a comparison fails.
  assert.ok(isDeepStrictEqual(actual, expected), message)
}

function launch(args) {
  const result = spawnSync(executable, args, {
    cwd: kit,
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
  })
  assert.ok(!result.error, `Packaged Node host failed: ${result.error?.message}`)
  assert.equal(result.signal, null, 'Packaged Node host must finish before the timeout')
  assert.ok(!`${result.stdout}${result.stderr}`.includes('pbkdf2$'), 'Recovery output must not expose PIN hashes')
  return result
}

function receiptSucceeded(file) {
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8') === successReceipt
}

function cleanup() {
  const actual = fs.realpathSync(scratch)
  const relative = path.relative(tempParent, actual)
  assert.ok(actual === scratchReal && relative && !relative.startsWith('..') && !path.isAbsolute(relative),
    'Cleanup must remain inside the owned temporary directory')
  assert.ok(path.basename(actual).startsWith('khadkapos-client-recovery-test-'), 'Unexpected cleanup directory')
  fs.rmSync(actual, { recursive: true, force: true })
}

let Database
let auth

function fixture(name, pin = '54321') {
  const directory = path.join(scratch, name)
  fs.mkdirSync(directory)
  const file = path.join(directory, 'pos.db')
  const db = new Database(file)
  try {
    db.exec('CREATE TABLE kv(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)')
    db.run('INSERT INTO meta VALUES (?,?)', ['schema', '1'])
    db.run('INSERT INTO meta VALUES (?,?)', ['recovery_canary', 'retain this metadata'])
    db.run('INSERT INTO kv VALUES (?,?)', ['settings', JSON.stringify({ name: 'Synthetic Restaurant', tax: 8.25, currency: 'USD' })])
    db.run('INSERT INTO kv VALUES (?,?)', ['seq', '318'])
    db.run('INSERT INTO kv VALUES (?,?)', ['another_setting', JSON.stringify('retain this setting')])
    if (pin !== null) db.run('INSERT INTO kv VALUES (?,?)', ['admin_pin', JSON.stringify(auth.hashPin(pin))])
    for (const collection of ['staff', 'orders', 'held', 'customers', 'print_jobs', 'menu', 'categories', 'shifts', 'audit']) {
      db.exec(`CREATE TABLE t_${collection}(id TEXT PRIMARY KEY,pos INTEGER NOT NULL,data TEXT NOT NULL)`)
      const values = collection === 'staff'
        ? [{ id: 'manager', name: 'Admin', role: 'manager', pin: auth.hashPin('2468') },
          { id: 'cashier', name: 'Cashier', role: 'cashier', pin: auth.hashPin('1357') }]
        : [{ id: `${collection}-1`, total: 1675, protected: collection },
          { id: `${collection}-2`, total: 2800, protected: collection }]
      values.forEach((value, position) => db.run(`INSERT INTO t_${collection} VALUES (?,?,?)`, [value.id, position, JSON.stringify(value)]))
    }
  } finally {
    db.close()
  }
  return file
}

function snapshot(file) {
  const db = new Database(file, { readOnly: true })
  try {
    const schema = db.all("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY type,name")
    const rows = {}
    for (const { name } of schema.filter((entry) => entry.type === 'table')) {
      const quoted = `"${name.replaceAll('"', '""')}"`
      rows[name] = db.all(`SELECT * FROM ${quoted} ORDER BY 1`)
    }
    return { schema, rows }
  } finally {
    db.close()
  }
}

function backups(file) {
  return fs.readdirSync(path.dirname(file))
    .filter((name) => name.startsWith(`${path.basename(file)}.admin-pin-backup-`) && name.endsWith('.db'))
    .map((name) => path.join(path.dirname(file), name))
}

function recover(file, receiptName = 'recovery-completed.txt') {
  const receipt = path.join(path.dirname(file), receiptName)
  return { ...launch([wrapper, file, receipt]), receipt }
}

function succeeded(result, message) {
  assert.equal(result.status, 0, `${message}: ${result.stderr}`)
  assert.ok(receiptSucceeded(result.receipt), `${message}: success receipt must be complete`)
}

function failed(result, message) {
  assert.notEqual(result.status, 0, message)
  assert.ok(!receiptSucceeded(result.receipt), `${message}: failure must not write a success receipt`)
}

try {
  assert.ok(fs.statSync(executable).isFile(), 'Supply the actual packaged KhadkaPOS.exe')
  assert.ok(fs.statSync(wrapper).isFile(), 'Build the staged recovery kit before testing')
  ;({ Database } = require(path.join(kit, 'node_modules', 'node-sqlite3-wasm')))
  auth = require(path.join(kit, 'electron', 'auth.cjs'))
  assert.equal(auth.DEFAULT_ADMIN_PIN, '8865', 'Kit must carry the current authentication module')
  const runtimeResult = launch(['-e', 'process.stdout.write(JSON.stringify({node:process.versions.node,electron:process.versions.electron,mode:process.env.ELECTRON_RUN_AS_NODE}))'])
  assert.equal(runtimeResult.status, 0, runtimeResult.stderr)
  const runtime = JSON.parse(runtimeResult.stdout)
  assert.ok(runtime.electron, 'Use the packaged Electron executable, not a separate Node installation')
  assert.equal(runtime.mode, '1')
  assert.equal(Number(runtime.node.split('.')[0]), 24, 'Validate the actual Electron Node 24 runtime')

  const changed = fixture("client's नेपाली data with spaces")
  const before = snapshot(changed)
  const result = recover(changed)
  succeeded(result, 'Changed Administrator PIN recovery')
  const savedBackups = backups(changed)
  assert.equal(savedBackups.length, 1, 'Changed PIN requires one full backup')
  same(snapshot(savedBackups[0]), before, 'Full backup must contain every original row and schema object')
  assert.ok(result.stdout.includes(savedBackups[0]), 'Recovery must display its verified backup path')
  const after = snapshot(changed)
  const changedRow = after.rows.kv.find((row) => row.key === 'admin_pin')
  const stored = JSON.parse(changedRow.value)
  assert.ok(auth.isHashed(stored) && auth.verifyPin('8865', stored), 'Only Administrator PIN must reset to hashed 8865')
  changedRow.value = before.rows.kv.find((row) => row.key === 'admin_pin').value
  same(after, before, 'All other settings, staff PINs, orders, and metadata must remain identical')

  const defaultPin = fixture('already default', '8865')
  const defaultBytes = fs.readFileSync(defaultPin)
  succeeded(recover(defaultPin), 'Existing default PIN no-op')
  same(fs.readFileSync(defaultPin), defaultBytes, 'Existing default PIN must leave database bytes unchanged')
  assert.equal(backups(defaultPin).length, 0, 'Existing default PIN needs no backup or write')

  const missingPin = fixture('missing admin key', null)
  const missingPinBytes = fs.readFileSync(missingPin)
  succeeded(recover(missingPin), 'Missing saved Administrator key no-op')
  same(fs.readFileSync(missingPin), missingPinBytes, 'Missing Administrator key must not initialize or migrate data')
  assert.equal(backups(missingPin).length, 0)

  const nonexistent = path.join(scratch, 'database does not exist.db')
  failed(recover(nonexistent, 'missing-db-result.txt'), 'Missing database must fail')
  assert.ok(!fs.existsSync(nonexistent), 'Missing database must never be created')

  const wrong = path.join(scratch, 'unrelated database.db')
  let db = new Database(wrong)
  db.exec("CREATE TABLE unrelated(id TEXT PRIMARY KEY,value TEXT); INSERT INTO unrelated VALUES ('retain','unrelated data')")
  db.close()
  const wrongBytes = fs.readFileSync(wrong)
  failed(recover(wrong, 'wrong-db-result.txt'), 'Unrelated database must fail')
  same(fs.readFileSync(wrong), wrongBytes, 'Unrelated database must remain unchanged')
  assert.equal(backups(wrong).length, 0)

  const locked = fixture('database locked by POS')
  const lockedBefore = snapshot(locked)
  db = new Database(locked)
  try {
    db.exec('PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE')
    failed(recover(locked), 'Locked database must fail')
    assert.equal(backups(locked).length, 0)
  } finally {
    if (db.inTransaction) db.exec('ROLLBACK')
    db.close()
  }
  same(snapshot(locked), lockedBefore, 'Lock failure must leave every row unchanged')

  const existingReceipt = path.join(path.dirname(changed), 'receipt already exists.txt')
  fs.writeFileSync(existingReceipt, 'existing support result', { flag: 'wx' })
  const repeatBefore = fs.readFileSync(changed)
  failed(recover(changed, path.basename(existingReceipt)), 'Existing receipt must not be overwritten')
  assert.equal(fs.readFileSync(existingReceipt, 'utf8'), 'existing support result')
  same(fs.readFileSync(changed), repeatBefore, 'Receipt failure must not modify the database')
  assert.equal(backups(changed).length, 1)

  assert.ok(!fs.existsSync(isolatedUserData) && !fs.existsSync(isolatedAppData),
    'Node host and helper must not start POS or initialize global application data')
  console.log(`PASS: staged kit under packaged Electron ${runtime.electron}, Node ${runtime.node}.`)
  console.log('Verified changed/default/missing PIN handling; complete original backup; only admin_pin changes; missing/unrelated/locked DB refusal; receipt safety; Unicode paths; no POS startup or global data initialization.')
} finally {
  cleanup()
}
