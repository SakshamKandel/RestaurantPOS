// Package the client recovery tool without an installer or a Node.js dependency.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const outputRoot = path.resolve(process.argv[2] || pkg.build.directories.output)
const name = 'KhadkaPOS-Admin-Recovery'
const stage = path.join(outputRoot, name)
const zip = `${stage}.zip`

assert.ok(!fs.existsSync(stage) && !fs.existsSync(zip), 'Recovery output already exists; choose a new output directory to keep it intact.')
const sqliteRoot = path.join(root, 'node_modules', 'node-sqlite3-wasm')
const sqlitePackage = JSON.parse(fs.readFileSync(path.join(sqliteRoot, 'package.json'), 'utf8'))
assert.equal(Object.keys(sqlitePackage.dependencies || {}).length, 0, 'Review new SQLite runtime dependencies before packaging.')

for (const file of ['Restore Administrator PIN.cmd', 'run-recovery.cjs', 'README.txt']) {
  assert.ok(fs.statSync(path.join(root, 'support', 'admin-recovery', file)).isFile(), `Missing launcher file: ${file}`)
}
fs.mkdirSync(stage, { recursive: true })
fs.cpSync(path.join(root, 'support', 'admin-recovery'), stage, { recursive: true })
fs.mkdirSync(path.join(stage, 'scripts'))
fs.mkdirSync(path.join(stage, 'electron'))
fs.mkdirSync(path.join(stage, 'node_modules'))
fs.copyFileSync(path.join(root, 'scripts', 'reset-admin-pin.cjs'), path.join(stage, 'scripts', 'reset-admin-pin.cjs'))
fs.copyFileSync(path.join(root, 'electron', 'auth.cjs'), path.join(stage, 'electron', 'auth.cjs'))
fs.cpSync(sqliteRoot, path.join(stage, 'node_modules', 'node-sqlite3-wasm'), { recursive: true })
fs.writeFileSync(path.join(stage, 'recovery-tool.json'), JSON.stringify({
  name, toolVersion: 1, sourceAppVersion: pkg.version,
  purpose: 'Back up the selected local POS database and restore only Administrator PIN 8865.',
}, null, 2))

execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
  'Compress-Archive -LiteralPath $env:KPOS_RECOVERY_PACK_SOURCE -DestinationPath $env:KPOS_RECOVERY_PACK_ZIP -CompressionLevel Optimal -ErrorAction Stop'], {
  env: { ...process.env, KPOS_RECOVERY_PACK_SOURCE: stage, KPOS_RECOVERY_PACK_ZIP: zip },
  windowsHide: true, stdio: 'pipe',
})
console.log(JSON.stringify({ stage, zip, bytes: fs.statSync(zip).size }))
