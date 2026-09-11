// SQLite persistence (node-sqlite3-wasm: real on-disk SQLite, WAL, transactions,
// no native compile). The renderer still works with one PosState object; here we
// diff it against the last committed snapshot and write only changed rows.
const fs = require('fs')
const path = require('path')
const { Database } = require('node-sqlite3-wasm')
const { hashPin, isHashed } = require('./auth.cjs')

const COLLECTIONS = ['orders', 'held', 'customers', 'printJobs', 'menu', 'categories', 'shifts', 'audit', 'staff']
const SCALARS = ['settings', 'seq'] // stored in kv as JSON

let db = null
let snapshot = null // last committed state, for diffing
let dbFile = ''

function open(userData, legacyJson) {
  dbFile = path.join(userData, 'pos.db')
  const fresh = !fs.existsSync(dbFile)
  db = new Database(dbFile)
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    ${COLLECTIONS.map(
      (c) => `CREATE TABLE IF NOT EXISTS ${tbl(c)} (id TEXT PRIMARY KEY, pos INTEGER NOT NULL, data TEXT NOT NULL);`,
    ).join('\n')}
    CREATE INDEX IF NOT EXISTS idx_orders_pos ON t_orders(pos);
    CREATE INDEX IF NOT EXISTS idx_audit_pos ON t_audit(pos);
  `)
  if (!db.get(`SELECT value FROM meta WHERE key='schema'`)) db.run(`INSERT INTO meta VALUES ('schema','1')`)

  // One-time import of the pre-SQLite JSON store. The file is NOT renamed:
  // it's kept and re-synced at quit so a downgrade to a JSON-based version
  // still finds its data (rollback support).
  if (fresh && legacyJson && fs.existsSync(legacyJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(legacyJson, 'utf8'))
      commit(data, /*force*/ true)
      setKv('migrated_from_json', new Date().toISOString())
    } catch (e) {
      console.error('legacy import failed', e)
    }
  }
  snapshot = load()
  return db
}

const tbl = (c) => `t_${c.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())}`

/** Read the whole state back. Staff PINs are never returned to the renderer. */
function load() {
  if (!db) return null
  const state = {}
  for (const c of COLLECTIONS) {
    const rows = db.all(`SELECT data FROM ${tbl(c)} ORDER BY pos ASC`)
    state[c] = rows.map((r) => JSON.parse(r.data))
  }
  for (const k of SCALARS) {
    const r = db.get(`SELECT value FROM kv WHERE key=?`, [k])
    if (r) state[k] = JSON.parse(r.value)
  }
  // Presence of any table row means a store exists (even if empty collections)
  const any = COLLECTIONS.some((c) => state[c].length) || SCALARS.some((k) => k in state)
  if (!any) return null
  state.staff = state.staff.map(stripPin)
  return state
}

const stripPin = (s) => ({ ...s, pin: '', hasPin: !!s.pin })

/** Raw staff row including hash — main-process only (auth). */
function staffRow(id) {
  if (!db) return null
  const r = db.get(`SELECT data FROM t_staff WHERE id=?`, [id])
  return r ? JSON.parse(r.data) : null
}
function updateStaffRow(id, patch) {
  const cur = staffRow(id)
  if (!db || !cur) return false
  const next = { ...cur, ...patch }
  db.run(`UPDATE t_staff SET data=? WHERE id=?`, [JSON.stringify(next), id])
  if (snapshot) snapshot.staff = snapshot.staff.map((s) => (s.id === id ? stripPin(next) : s))
  return true
}

function getKv(key, fallback = null) {
  if (!db) return fallback
  const r = db.get(`SELECT value FROM kv WHERE key=?`, [key])
  return r ? JSON.parse(r.value) : fallback
}
function setKv(key, value) {
  if (!db) return
  db.run(`INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [
    key,
    JSON.stringify(value),
  ])
}

/**
 * Persist a full renderer state. Only rows whose JSON changed are written.
 * Staff rows: a non-empty plaintext `pin` coming from the renderer (new account
 * or reset) is hashed here; an empty pin means "keep the stored hash".
 */
function commit(state, force = false) {
  if (!db) return
  db.exec('BEGIN')
  try {
    for (const c of COLLECTIONS) {
      const incoming = Array.isArray(state[c]) ? state[c] : []
      const prev = force || !snapshot ? [] : snapshot[c] ?? []
      const prevById = new Map(prev.map((r, i) => [r.id, { r, i }]))
      const seen = new Set()
      incoming.forEach((row, i) => {
        let toStore = row
        if (c === 'staff') {
          const existing = staffRow(row.id)
          const pin = row.pin && !isHashed(row.pin) ? hashPin(row.pin) : row.pin || existing?.pin || ''
          const { hasPin: _h, ...rest } = row
          toStore = { ...rest, pin }
        }
        seen.add(row.id)
        const p = prevById.get(row.id)
        const cmpRow = c === 'staff' ? stripPin(toStore) : toStore
        const cmpPrev = p?.r
        if (!p || p.i !== i || JSON.stringify(cmpPrev) !== JSON.stringify(cmpRow) || (c === 'staff' && row.pin)) {
          db.run(`INSERT INTO ${tbl(c)}(id,pos,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET pos=excluded.pos, data=excluded.data`, [
            row.id,
            i,
            JSON.stringify(toStore),
          ])
        }
      })
      for (const id of prevById.keys()) if (!seen.has(id)) db.run(`DELETE FROM ${tbl(c)} WHERE id=?`, [id])
      if (force) {
        // full import: also clear anything not in incoming
        const ids = incoming.map((r) => r.id)
        if (ids.length) db.run(`DELETE FROM ${tbl(c)} WHERE id NOT IN (${ids.map(() => '?').join(',')})`, ids)
        else db.run(`DELETE FROM ${tbl(c)}`)
      }
    }
    for (const k of SCALARS) {
      if (!(k in state)) continue
      const v = JSON.stringify(state[k])
      if (force || !snapshot || JSON.stringify(snapshot[k]) !== v) setKv(k, state[k])
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  snapshot = {
    ...Object.fromEntries(COLLECTIONS.map((c) => [c, (state[c] ?? []).map((r) => (c === 'staff' ? stripPin(r) : r))])),
    ...Object.fromEntries(SCALARS.filter((k) => k in state).map((k) => [k, state[k]])),
  }
}

/** Consistent JSON snapshot for backups / export (includes staff hashes, never plaintext). */
function exportJson() {
  const state = {}
  if (!db) return state
  for (const c of COLLECTIONS) state[c] = db.all(`SELECT data FROM ${tbl(c)} ORDER BY pos`).map((r) => JSON.parse(r.data))
  for (const k of SCALARS) {
    const r = db.get(`SELECT value FROM kv WHERE key=?`, [k])
    if (r) state[k] = JSON.parse(r.value)
  }
  return state
}

/** Integrity check + WAL checkpoint; returns 'ok' or the failure text. */
function integrity() {
  try {
    const r = db.get('PRAGMA integrity_check')
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    return r ? Object.values(r)[0] : 'unknown'
  } catch (e) {
    return String(e.message ?? e)
  }
}

/** Write the legacy JSON mirror so older versions can still boot with current data. */
function syncLegacyJson(legacyJson) {
  try {
    const tmp = legacyJson + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(exportJson()))
    fs.renameSync(tmp, legacyJson)
  } catch {}
}

function close(legacyJson) {
  try {
    if (db && legacyJson) syncLegacyJson(legacyJson)
    db?.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    db?.close()
  } catch {}
  db = null
}

/**
 * Factory reset: close the DB and delete pos.db (+ WAL/SHM sidecars) and the
 * legacy JSON mirror. Backups, images and logs are untouched. The app is
 * expected to relaunch immediately after — load()/commit() become no-ops.
 */
function reset(legacyJson) {
  const file = dbFile
  try {
    db?.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    db?.close()
  } catch {}
  db = null
  snapshot = null
  dbFile = ''
  for (const f of [file, `${file}-wal`, `${file}-shm`, legacyJson]) {
    try {
      if (f) fs.unlinkSync(f)
    } catch {}
  }
}

module.exports = { open, load, commit, exportJson, integrity, close, reset, syncLegacyJson, staffRow, updateStaffRow, getKv, setKv, get file() { return dbFile } }
