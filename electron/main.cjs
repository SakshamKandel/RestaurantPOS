const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')
const { autoUpdater } = require('electron-updater')
const db = require('./db.cjs')
const auth = require('./auth.cjs')

// Custom protocol so menu photos stored in userData render in <img> tags
// in both dev (localhost) and packaged (file://) modes.
protocol.registerSchemesAsPrivileged([
  { scheme: 'posimg', privileges: { stream: true, supportFetchAPI: true } },
])

const isDev = process.argv.includes('--dev')
// Test hook: point the whole app at a scratch data dir (never used in normal runs)
if (process.env.KPOS_USERDATA) app.setPath('userData', process.env.KPOS_USERDATA)

const storePath = () => path.join(app.getPath('userData'), 'pos-store.json')
const backupDir = () => path.join(app.getPath('userData'), 'backups')
const imagesDir = () => path.join(app.getPath('userData'), 'images')
const logsDir = () => path.join(app.getPath('userData'), 'logs')

// --- Error logs: one txt file per problem area under userData/logs.
//     The folder and files are created lazily — only when an error actually
//     happens — so a healthy install never has a logs directory. ---
const LOG_FILES = {
  printer: 'printer-errors.txt',
  auth: 'auth-errors.txt',
  update: 'update-errors.txt',
  app: 'app-errors.txt',
}

function logToFile(category, message) {
  try {
    fs.mkdirSync(logsDir(), { recursive: true })
    const name = LOG_FILES[category] ?? LOG_FILES.app
    const line = `[${new Date().toISOString()}] ${String(message).replace(/\s*[\r\n]+\s*/g, ' | ').trim().slice(0, 2000)}\n`
    fs.appendFileSync(path.join(logsDir(), name), line, 'utf8')
  } catch {
    /* logging must never break the app */
  }
}

const MAX_BACKUPS = 10

/** Timestamped backup written on every save — POS never loses the last N states. */
function rotateBackup(data) {
  try {
    fs.mkdirSync(backupDir(), { recursive: true })
    const file = path.join(
      backupDir(),
      `pos-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    )
    fs.writeFileSync(file, JSON.stringify(data))

    // Prune old backups, keep newest MAX_BACKUPS
    const files = fs
      .readdirSync(backupDir())
      .filter((f) => f.startsWith('pos-backup-'))
      .sort()
    while (files.length > MAX_BACKUPS) {
      fs.unlinkSync(path.join(backupDir(), files.shift()))
    }
  } catch {
    /* backup must never block a sale */
  }
}

let mainWindow = null

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    title: 'KhadkaPOS',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#f3f1ee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
  mainWindow = win
}

const ts = () => new Date().toISOString().replace(/[:.]/g, '-')

// --- Durable local store: SQLite (WAL, transactional). JSON backups kept for
//     human-readable recovery and cross-version compatibility. ---
let lastBackupAt = 0
const BACKUP_MIN_INTERVAL = 60_000 // at most one rotating backup per minute

ipcMain.handle('store:load', () => {
  try {
    const state = db.load()
    if (!state) return null
    // jobs left 'pending' at shutdown were never confirmed by the printer
    state.printJobs = (state.printJobs ?? []).map((j) =>
      j.status === 'pending' ? { ...j, status: 'failed', error: 'App closed before the printer confirmed' } : j,
    )
    return state
  } catch (e) {
    ulog(`store load failed ${e?.message ?? e}`)
    logToFile('app', `store load failed: ${e?.message ?? e}`)
    return null
  }
})

ipcMain.handle('store:save', (_e, data) => {
  try {
    db.commit(data)
    if (Date.now() - lastBackupAt > BACKUP_MIN_INTERVAL) {
      lastBackupAt = Date.now()
      rotateBackup(db.exportJson())
    }
    return true
  } catch (e) {
    logToFile('app', `store save failed: ${e?.message ?? e}`)
    return false
  }
})

ipcMain.handle('store:backup', () => {
  rotateBackup(db.exportJson())
  lastBackupAt = Date.now()
  return backupDir()
})

ipcMain.handle('store:integrity', () => ({ result: db.integrity(), file: db.file }))

// --- CSV export via native save dialog ---
ipcMain.handle('export:csv', async (_e, { suggestedName, csv }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Export CSV',
    defaultPath: path.join(app.getPath('documents'), suggestedName),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  })
  if (res.canceled || !res.filePath) return null
  fs.writeFileSync(res.filePath, '\ufeff' + csv, 'utf8') // BOM so Excel opens UTF-8 correctly
  return res.filePath
})

// --- Error log files: list / read (tail-bounded) / clear / open folder ---
const LOG_TAIL_BYTES = 256 * 1024 // viewer reads at most the last 256 KB

ipcMain.handle('logs:append', (_e, payload) => {
  const { category, message } = payload ?? {}
  if (typeof message !== 'string' || !message.trim()) return false
  logToFile(typeof category === 'string' ? category : 'app', message)
  return true
})

ipcMain.handle('logs:list', () => {
  try {
    if (!fs.existsSync(logsDir())) return { dir: logsDir(), files: [] }
    const files = fs
      .readdirSync(logsDir())
      .filter((f) => /\.(txt|log)$/i.test(f))
      .map((f) => {
        try {
          const st = fs.statSync(path.join(logsDir(), f))
          return { name: f, size: st.size, mtime: st.mtimeMs }
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime)
    return { dir: logsDir(), files }
  } catch {
    return { dir: logsDir(), files: [] }
  }
})

ipcMain.handle('logs:read', (_e, name) => {
  try {
    const file = path.join(logsDir(), path.basename(String(name)))
    if (!fs.existsSync(file)) return null
    const size = fs.statSync(file).size
    const base = path.basename(file)
    if (size <= LOG_TAIL_BYTES)
      return { name: base, size, truncated: false, content: fs.readFileSync(file, 'utf8') }
    const fd = fs.openSync(file, 'r')
    try {
      const buf = Buffer.alloc(LOG_TAIL_BYTES)
      fs.readSync(fd, buf, 0, LOG_TAIL_BYTES, size - LOG_TAIL_BYTES)
      return { name: base, size, truncated: true, content: buf.toString('utf8') }
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }
})

ipcMain.handle('logs:clear', (_e, name) => {
  try {
    fs.unlinkSync(path.join(logsDir(), path.basename(String(name))))
    return true
  } catch {
    return false
  }
})

ipcMain.handle('logs:open', () => {
  try {
    fs.mkdirSync(logsDir(), { recursive: true })
    void shell.openPath(logsDir())
  } catch {}
  return logsDir()
})

// --- Auth: PINs are verified in the main process; renderer never sees hashes ---
const ADMIN_ID = 'super-admin'
const ADMIN_DEFAULT_PIN = '8865'

function adminHash() {
  let h = db.getKv('admin_pin')
  if (!h) {
    h = auth.hashPin(ADMIN_DEFAULT_PIN)
    db.setKv('admin_pin', h)
  }
  return h
}

ipcMain.handle('auth:login', (_e, { id, pin }) => {
  const locked = auth.lockedFor(id)
  if (locked) return { ok: false, lockSeconds: locked }
  const stored = id === ADMIN_ID ? adminHash() : db.staffRow(id)?.pin
  if (!stored) return { ok: false, reason: 'no-account' }
  if (!auth.verifyPin(pin, stored)) {
    const { fails, lockSeconds } = auth.recordFailure(id)
    ulog(`login fail id=${id} fails=${fails}`)
    logToFile('auth', `login failed · account=${id} · attempt ${fails}${lockSeconds ? ` · locked ${lockSeconds}s` : ''}`)
    return { ok: false, fails, lockSeconds }
  }
  auth.clearFailures(id)
  // transparently upgrade a legacy plaintext PIN to a hash on successful login
  if (id !== ADMIN_ID && !auth.isHashed(stored)) db.updateStaffRow(id, { pin: auth.hashPin(pin) })
  const row = id === ADMIN_ID ? null : db.staffRow(id)
  return { ok: true, mustChangePin: !!row?.mustChangePin }
})

ipcMain.handle('auth:set-pin', (_e, { id, pin }) => {
  if (!/^\d{4,6}$/.test(String(pin))) return { ok: false, reason: 'PIN must be 4–6 digits' }
  if (id === ADMIN_ID) {
    db.setKv('admin_pin', auth.hashPin(pin))
    return { ok: true }
  }
  return { ok: db.updateStaffRow(id, { pin: auth.hashPin(pin), mustChangePin: false }) }
})

// --- Printers: enumerate installed Windows printers ---
ipcMain.handle('printers:list', async (e) => {
  const printers = await e.sender.getPrintersAsync()
  return printers.map((p) => ({
    name: p.name,
    displayName: p.displayName ?? p.name,
    description: p.description ?? '',
    isDefault: !!p.isDefault,
  }))
})

// --- Printers: silent print via Windows spooler (ESC/POS-like HTML) ---

// --- Auto-update (GitHub Releases) with 3-day defer-then-force policy ---
const THREE_DAYS = 3 * 24 * 3600 * 1000
const updateStatePath = () => path.join(app.getPath('userData'), 'update-state.json')

function readUpdateState() {
  try {
    return JSON.parse(fs.readFileSync(updateStatePath(), 'utf8'))
  } catch {
    return {}
  }
}
function writeUpdateState(s) {
  try {
    fs.writeFileSync(updateStatePath(), JSON.stringify(s), 'utf8')
  } catch {}
}

const ulog = (m) => {
  try {
    fs.appendFileSync(
      path.join(app.getPath('userData'), 'update-debug.log'),
      `${new Date().toISOString()} ${m}\n`,
    )
  } catch {}
}

function preUpdateBackup() {
  try {
    const target = path.join(
      backupDir(),
      `pre-update-v${app.getVersion()}-${ts()}.json`,
    )
    fs.mkdirSync(backupDir(), { recursive: true })
    fs.writeFileSync(target, JSON.stringify(db.exportJson()))
    // also a byte-exact copy of the SQLite file for direct restore
    db.integrity() // checkpoints WAL into the main file first
    fs.copyFileSync(db.file, target.replace(/\.json$/, '.db'))
  } catch {}
}

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = false // we decide when to install

function setupAutoUpdater() {
  autoUpdater.logger = {
    info: (m) => ulog(`info ${m}`),
    warn: (m) => ulog(`warn ${m}`),
    error: (m) => ulog(`error ${m}`),
    debug: (m) => ulog(`debug ${m}`),
  }

  autoUpdater.on('update-available', (info) => {
    ulog(`update-available ${info.version}`)
    const st = readUpdateState()
    if (st.version !== info.version)
      writeUpdateState({ version: info.version, firstSeen: Date.now() })
    mainWindow?.webContents.send('update:available', { version: info.version })
  })

  autoUpdater.on('update-downloaded', (info) => {
    const st = readUpdateState()
    const firstSeen = st.version === info.version ? st.firstSeen : Date.now()
    if (st.version !== info.version)
      writeUpdateState({ version: info.version, firstSeen })
    const deadline = firstSeen + THREE_DAYS
    const forced = Date.now() >= deadline
    preUpdateBackup() // safety snapshot of the store before any install
    mainWindow?.webContents.send('update:downloaded', {
      version: info.version,
      currentVersion: app.getVersion(),
      forced,
      deadline,
    })
    if (forced) setTimeout(() => autoUpdater.quitAndInstall(), 4000)
  })

  autoUpdater.on('checking-for-update', () => {
    ulog('checking-for-update')
    mainWindow?.webContents.send('update:checking')
  })
  autoUpdater.on('update-not-available', () => {
    ulog('update-not-available')
    mainWindow?.webContents.send('update:none', { version: app.getVersion() })
  })
  autoUpdater.on('error', (err) => {
    ulog(`error ${err?.message ?? err}`)
    logToFile('update', `auto-update error: ${err?.message ?? err}`)
    mainWindow?.webContents.send('update:error', { message: String(err?.message ?? err) })
  })
  autoUpdater.checkForUpdates().catch((e) => {
    ulog(`check failed ${e?.message ?? e}`)
    logToFile('update', `update check failed: ${e?.message ?? e}`)
  })
  setInterval(
    () =>
      autoUpdater
        .checkForUpdates()
        .catch((e) => logToFile('update', `update check failed: ${e?.message ?? e}`)),
    6 * 3600 * 1000,
  )
}

ipcMain.handle('update:install', () => {
  preUpdateBackup()
  autoUpdater.quitAndInstall()
})
ipcMain.handle('update:check', () =>
  Promise.race([
    autoUpdater
      .checkForUpdates()
      .then((r) => {
        if (!r) return { status: 'error', message: 'no result' }
        const latest = r.updateInfo?.version
        const isNewer = latest && latest !== app.getVersion()
        ulog(`manual check result latest=${latest} newer=${isNewer}`)
        return isNewer
          ? { status: 'found', version: latest }
          : { status: 'none', version: app.getVersion() }
      })
      .catch((e) => {
        ulog(`manual check failed ${e?.message ?? e}`)
        logToFile('update', `manual update check failed: ${e?.message ?? e}`)
        return { status: 'error', message: String(e?.message ?? e) }
      }),
    new Promise((res) =>
      setTimeout(() => {
        ulog('manual check slow (>45s) — still waiting in background')
        res({ status: 'error', message: 'slow connection — still trying in the background' })
      }, 45000),
    ),
  ]),
)
ipcMain.handle('app:version', () => app.getVersion())

// --- Menu photos: pick a file → copy into userData/images → posimg:// URL ---
ipcMain.handle('images:pick', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose menu item photo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    properties: ['openFile'],
  })
  if (res.canceled || !res.filePaths[0]) return null
  fs.mkdirSync(imagesDir(), { recursive: true })
  const name = `${Date.now()}-${path.basename(res.filePaths[0]).replace(/[^\w.\-]/g, '_')}`
  fs.copyFileSync(res.filePaths[0], path.join(imagesDir(), name))
  return `posimg://img/${encodeURIComponent(name)}`
})

ipcMain.handle('printers:print', (_e, { deviceName, html, paperWidthMm }) => {
  return new Promise((resolve) => {
    const win = new BrowserWindow({ show: false })
    const timer = setTimeout(() => {
      try { win.close() } catch {}
      resolve({ ok: false, reason: 'Printer did not respond within 20s' })
    }, 20000)
    win.webContents.once('did-finish-load', () => {
      win.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName,
          margins: { marginType: 'none' },
          pageSize: { width: paperWidthMm * 1000, height: 300000 }, // microns
        },
        (ok, failureReason) => {
          clearTimeout(timer)
          win.close()
          resolve({ ok, reason: ok ? null : failureReason || 'Spooler rejected the job' })
        },
      )
    })
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  })
})

// --- Raw ESC/POS bytes → Windows spooler (RAW datatype) via winspool.drv ---
// Used for the cash-drawer pulse (ESC p m t1 t2). HTML printing goes through the
// driver and can't emit control bytes, so we P/Invoke the spooler from PowerShell.
const RAW_PRINT_PS = `
$Printer = $env:KPOS_PRINTER
$Base64 = $env:KPOS_BYTES
$sig = @'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DOCINFOW { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string src, out IntPtr h, IntPtr pd);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern int StartDocPrinter(IntPtr h, int level, ref DOCINFOW di);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int n, out int w);
  public static string Send(string printer, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return "OpenPrinter failed (" + Marshal.GetLastWin32Error() + ")";
    try {
      var di = new DOCINFOW { pDocName = "KhadkaPOS raw", pDataType = "RAW" };
      if (StartDocPrinter(h, 1, ref di) == 0) return "StartDocPrinter failed (" + Marshal.GetLastWin32Error() + ")";
      StartPagePrinter(h);
      int written;
      bool ok = WritePrinter(h, bytes, bytes.Length, out written);
      EndPagePrinter(h); EndDocPrinter(h);
      return ok && written == bytes.Length ? "OK" : "WritePrinter failed (" + Marshal.GetLastWin32Error() + ")";
    } finally { ClosePrinter(h); }
  }
}
'@
Add-Type -TypeDefinition $sig -ErrorAction Stop
[RawPrinter]::Send($Printer, [Convert]::FromBase64String($Base64))
`

ipcMain.handle('printers:raw', (_e, { deviceName, bytes }) => {
  return new Promise((resolve) => {
    const { execFile } = require('child_process')
    const b64 = Buffer.from(bytes).toString('base64')
    // Values travel via env vars: -Command re-tokenises its arguments, so a
    // printer name with spaces would be split (and it avoids any quoting issues).
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', RAW_PRINT_PS],
      { timeout: 15000, windowsHide: true, env: { ...process.env, KPOS_PRINTER: deviceName, KPOS_BYTES: b64 } },
      (err, stdout, stderr) => {
        const out = String(stdout || '').trim()
        if (err) return resolve({ ok: false, reason: (stderr || err.message || 'raw print failed').toString().split('\n')[0].trim() })
        resolve(out === 'OK' ? { ok: true, reason: null } : { ok: false, reason: out || 'raw print failed' })
      },
    )
  })
})

app.whenReady().then(() => {
  // Serve uploaded menu photos: posimg://img/<file> → userData/images/<file>
  protocol.handle('posimg', (req) => {
    const name = decodeURIComponent(new URL(req.url).pathname).replace(/^\//, '')
    const file = path.join(imagesDir(), name)
    return net.fetch(pathToFileURL(file).toString())
  })
  try {
    db.open(app.getPath('userData'), storePath()) // imports pos-store.json once, then uses pos.db
  } catch (e) {
    logToFile('app', `database open failed: ${e?.message ?? e}`)
  }
  createWindow()
  setupAutoUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('before-quit', () => db.close(storePath())) // syncs pos-store.json for downgrade compat

// Last-resort capture: anything that escapes normal handling still lands in a file.
process.on('uncaughtException', (e) =>
  logToFile('app', `uncaught exception: ${e?.stack ?? e?.message ?? e}`),
)
app.on('render-process-gone', (_e, _wc, details) =>
  logToFile('app', `renderer process gone: ${details?.reason ?? 'unknown'}`),
)
