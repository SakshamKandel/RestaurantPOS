// Exercises the logs:* IPC handlers in plain Node by stubbing Electron —
// same trick as dbtest.cjs. Run: node scripts/logtest.cjs
const fs = require('fs'), path = require('path'), os = require('os')

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpos-logs-'))
const handlers = new Map()

const fakeWc = { send() {}, once() {}, on() {}, print() {}, getPrintersAsync: async () => [] }
const fakeWin = { loadURL() {}, loadFile() {}, webContents: fakeWc, close() {} }

const electronStub = {
  app: {
    _paths: { userData: dir },
    getPath(k) { return this._paths[k] ?? dir },
    setPath(k, v) { this._paths[k] = v },
    getVersion: () => '0.0.0-test',
    whenReady: () => Promise.resolve(),
    on() {},
    quit() {},
    relaunch() {},
    exit() {}, // stubbed — real app exits here
  },
  BrowserWindow: function () { return fakeWin },
  ipcMain: { handle: (ch, fn) => handlers.set(ch, fn) },
  dialog: { showSaveDialog: async () => ({ canceled: true }), showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
  protocol: { registerSchemesAsPrivileged() {}, handle() {} },
  net: { fetch: async () => ({}) },
  shell: { openPath: async () => '' },
}
const updaterStub = {
  autoUpdater: {
    on() {},
    checkForUpdates: () => Promise.reject(new Error('no releases feed')),
    quitAndInstall() {},
  },
}
require.cache[require.resolve('electron')] = { exports: electronStub }
require.cache[require.resolve('electron-updater')] = { exports: updaterStub }

process.env.KPOS_USERDATA = dir
require('../electron/main.cjs')

setTimeout(() => {
  // folder must NOT exist before the first error
  console.log('logs dir created eagerly:', fs.existsSync(path.join(dir, 'logs')))

  handlers.get('logs:append')(null, { category: 'printer', message: 'RECEIPT → POS-80 · #DNN001: Spooler rejected the job' })
  handlers.get('logs:append')(null, { category: 'auth', message: 'login failed · account=abc · attempt 4 · locked 30s' })
  handlers.get('logs:append')(null, { category: 'app', message: 'unhandled rejection: boom\n  at foo.ts:1' }) // multi-line folds
  handlers.get('logs:append')(null, { category: 'bogus', message: 'falls back to app log' })
  console.log('empty message ignored:', handlers.get('logs:append')(null, { category: 'app', message: '   ' }))

  const list = handlers.get('logs:list')(null)
  console.log('dir:', list.dir)
  console.log('files:', list.files.map((f) => `${f.name} (${f.size}B)`).join(', '))

  const read = handlers.get('logs:read')(null, 'printer-errors.txt')
  console.log('printer read:', JSON.stringify(read.content))

  const appRead = handlers.get('logs:read')(null, 'app-errors.txt')
  console.log('app read lines:', appRead.content.trim().split('\n').length, '| folded:', appRead.content.includes(' | '))

  console.log('path traversal blocked:', handlers.get('logs:read')(null, '..\\..\\Windows\\win.ini') === null)
  console.log('missing file:', handlers.get('logs:read')(null, 'nope.txt') === null)
  console.log('open returns dir:', handlers.get('logs:open')(null))
  console.log('clear:', handlers.get('logs:clear')(null, 'auth-errors.txt'), '| after clear:', handlers.get('logs:list')(null).files.map((f) => f.name).join(', '))

  // --- db:reset: writes a final backup, deletes pos.db + pos-store.json ---
  const dbFile = path.join(dir, 'pos.db')
  const storeFile = path.join(dir, 'pos-store.json')
  fs.writeFileSync(storeFile, '{}') // mirror normally synced at quit
  console.log('pre-reset pos.db exists:', fs.existsSync(dbFile))
  console.log('db:reset →', handlers.get('db:reset')(null, { actor: 'Admin' }))
  console.log('pos.db deleted:', !fs.existsSync(dbFile), '| mirror deleted:', !fs.existsSync(storeFile))
  const backups = fs.readdirSync(path.join(dir, 'backups')).filter((f) => f.startsWith('pos-backup-'))
  console.log('final backup kept:', backups.length > 0, '| reset logged:', fs.readFileSync(path.join(dir, 'logs', 'app-errors.txt'), 'utf8').includes('factory reset'))

  fs.rmSync(dir, { recursive: true, force: true })
  process.exit(0)
}, 300)
