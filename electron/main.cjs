const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')
const { autoUpdater } = require('electron-updater')

// Custom protocol so menu photos stored in userData render in <img> tags
// in both dev (localhost) and packaged (file://) modes.
protocol.registerSchemesAsPrivileged([
  { scheme: 'posimg', privileges: { stream: true, supportFetchAPI: true } },
])

const isDev = process.argv.includes('--dev')

const storePath = () => path.join(app.getPath('userData'), 'pos-store.json')
const backupDir = () => path.join(app.getPath('userData'), 'backups')
const imagesDir = () => path.join(app.getPath('userData'), 'images')

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

/** Jobs left 'pending' at shutdown were never confirmed by the printer — mark failed. */
function migratePendingJobs() {
  try {
    const data = JSON.parse(fs.readFileSync(storePath(), 'utf8'))
    if (!Array.isArray(data.printJobs)) return
    let dirty = false
    data.printJobs = data.printJobs.map((j) => {
      if (j.status === 'pending') {
        dirty = true
        return { ...j, status: 'failed' }
      }
      return j
    })
    if (dirty) fs.writeFileSync(storePath(), JSON.stringify(data))
  } catch {}
}

// --- Durable local store (JSON on disk; swap for SQLite later) ---
ipcMain.handle('store:load', () => {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'))
  } catch {
    return null
  }
})

ipcMain.handle('store:save', (_e, data) => {
  const tmp = storePath() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data))
  fs.renameSync(tmp, storePath())
  rotateBackup(data) // automatic backup on every state save
  return true
})

ipcMain.handle('store:backup', (_e, data) => {
  rotateBackup(data)
  return backupDir()
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
    fs.copyFileSync(storePath(), target)
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
    mainWindow?.webContents.send('update:error', { message: String(err?.message ?? err) })
  })
  autoUpdater.checkForUpdates().catch((e) => ulog(`check failed ${e?.message ?? e}`))
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 3600 * 1000)
}

ipcMain.handle('update:install', () => {
  preUpdateBackup()
  autoUpdater.quitAndInstall()
})
ipcMain.handle('update:check', () =>
  Promise.race([
    autoUpdater.checkForUpdates().catch((e) => {
      ulog(`manual check failed ${e?.message ?? e}`)
      return null
    }),
    new Promise((res) =>
      setTimeout(() => {
        ulog('manual check timed out')
        mainWindow?.webContents.send('update:error', { message: 'timed out' })
        res(null)
      }, 15000),
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
          win.close()
          resolve({ ok, reason: failureReason || null })
        },
      )
    })
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  })
})

app.whenReady().then(() => {
  // Serve uploaded menu photos: posimg://img/<file> → userData/images/<file>
  protocol.handle('posimg', (req) => {
    const name = decodeURIComponent(new URL(req.url).pathname).replace(/^\//, '')
    const file = path.join(imagesDir(), name)
    return net.fetch(pathToFileURL(file).toString())
  })
  migratePendingJobs()
  createWindow()
  setupAutoUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
