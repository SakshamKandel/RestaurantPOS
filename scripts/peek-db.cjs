// Inspect a pos.db file: integrity + table row counts.
const { Database } = require('../node_modules/node-sqlite3-wasm')
const file = process.argv[2]
const db = new Database(file)
console.log('integrity:', Object.values(db.get('PRAGMA integrity_check'))[0])
for (const r of db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 't_%' OR name='kv' OR name='meta'")) {
  const n = db.get(`SELECT COUNT(*) c FROM ${r.name}`).c
  console.log(`${r.name}: ${n} rows`)
}
db.close()
