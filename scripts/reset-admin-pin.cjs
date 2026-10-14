// Offline support recovery. Always name the client's existing database explicitly.
const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { Database } = require('node-sqlite3-wasm')
const { hashPin, verifyPin } = require('../electron/auth.cjs')

const DEFAULT_PIN = '8865'

function integrityCheck(db) {
  const rows = db.all('PRAGMA integrity_check')
  if (rows.length !== 1 || Object.values(rows[0])[0] !== 'ok') {
    throw new Error('Database integrity check failed; no PIN reset performed.')
  }
}

function inspect(db) {
  integrityCheck(db)
  const tables = new Set(db.all("SELECT name FROM sqlite_schema WHERE type='table'").map((r) => r.name))
  if (!['kv', 'meta', 't_staff', 't_orders'].every((name) => tables.has(name))) {
    throw new Error('This is not a supported KhadkaPOS database; no PIN reset performed.')
  }
  if (db.get("SELECT value FROM meta WHERE key='schema'")?.value !== '1') {
    throw new Error('Unsupported database schema; no PIN reset performed.')
  }
  if (db.get("SELECT name FROM sqlite_schema WHERE type='trigger' AND tbl_name='kv'")) {
    throw new Error('Unexpected settings trigger; no PIN reset performed.')
  }
  const row = db.get("SELECT value FROM kv WHERE key='admin_pin'")
  if (!row) return { status: 'missing' }
  try {
    const stored = JSON.parse(row.value)
    if (typeof stored !== 'string' || !stored) return { status: 'invalid' }
    if (stored.startsWith('pbkdf2$')) {
      const format = /^pbkdf2\$([1-9][0-9]{0,6})\$[a-f0-9]{32}\$[a-f0-9]{64}$/i.exec(stored)
      if (!format || Number(format[1]) > 1_000_000) return { status: 'invalid' }
    }
    return { status: verifyPin(DEFAULT_PIN, stored) ? 'default' : 'changed' }
  } catch {
    return { status: 'invalid' }
  }
}

function backup(db, file) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '')
  const backupFile = `${file}.admin-pin-backup-${stamp}-${randomUUID().slice(0, 8)}.db`
  // Reserve an empty, uniquely named file; VACUUM INTO never overwrites a backup.
  fs.closeSync(fs.openSync(backupFile, 'wx', 0o600))
  db.run('VACUUM INTO ?', backupFile)
  const copy = new Database(backupFile, { readOnly: true })
  try {
    integrityCheck(copy)
    if (copy.get("SELECT value FROM kv WHERE key='admin_pin'")?.value !==
        db.get("SELECT value FROM kv WHERE key='admin_pin'")?.value) {
      throw new Error('Backup verification failed; no PIN reset performed.')
    }
  } finally {
    copy.close()
  }
  const fd = fs.openSync(backupFile, 'r+')
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  console.log(`Verified full database backup: ${backupFile}`)
  return backupFile
}

function main() {
  const args = process.argv.slice(2)
  const reset = args.includes('--reset')
  const files = args.filter((arg) => arg !== '--reset')
  if (files.length !== 1 || args.length !== (reset ? 2 : 1) || !path.isAbsolute(files[0])) {
    throw new Error('Usage: node scripts/reset-admin-pin.cjs "C:\\full\\path\\pos.db" [--reset]')
  }
  const file = fs.realpathSync(files[0])
  if (!fs.statSync(file).isFile()) throw new Error('Database path must name an existing file.')
  console.log(`Database: ${file}`)
  console.log('Close KhadkaPOS completely before running recovery and keep it closed until this command finishes.')
  const db = new Database(file, { fileMustExist: true, readOnly: !reset })
  let backupFile
  try {
    if (reset) {
      // Retain the exclusive SQLite lock across both the snapshot and PIN update.
      if (db.get('PRAGMA locking_mode=EXCLUSIVE')?.locking_mode !== 'exclusive') {
        throw new Error('Could not enable exclusive locking; no PIN reset performed.')
      }
      db.exec('PRAGMA synchronous=FULL; BEGIN EXCLUSIVE;')
    }
    const { status } = inspect(db)
    if (reset) db.exec('COMMIT')
    const messages = {
      default: 'Saved Administrator PIN already matches 8865.',
      changed: 'Saved Administrator PIN does not match 8865.',
      invalid: 'Saved Administrator PIN data is invalid.',
      missing: 'No Administrator PIN is saved; this app creates the default 8865 at the next Administrator login.',
    }
    console.log(messages[status])
    if (!reset) {
      console.log('Check only: no PIN or app data changed. Add --reset to restore a changed or invalid PIN.')
      return
    }
    if (status === 'default' || status === 'missing') {
      console.log('No PIN reset needed. Restart KhadkaPOS and try Administrator with 8865.')
      return
    }
    backupFile = backup(db, file)
    db.exec('BEGIN EXCLUSIVE')
    const result = db.run("UPDATE kv SET value=? WHERE key='admin_pin'", JSON.stringify(hashPin(DEFAULT_PIN)))
    if (result.changes !== 1 || inspect(db).status !== 'default') {
      throw new Error('PIN reset verification failed.')
    }
    db.exec('COMMIT')
    console.log('Administrator PIN restored to 8865. Sales, staff PINs, and other settings were unchanged.')
    console.log('Restart KhadkaPOS, sign in as Administrator, then set a new PIN in Staff Management.')
  } catch (error) {
    if (db.inTransaction) db.exec('ROLLBACK')
    if (backupFile) console.error(`Recovery backup retained: ${backupFile}`)
    throw error
  } finally {
    db.close()
  }
}

try { main() } catch (error) {
  console.error(`Recovery failed: ${error.message}`)
  console.error('Keep KhadkaPOS closed and resolve the error before trying again. Never delete the database or its lock files.')
  process.exitCode = 1
}
