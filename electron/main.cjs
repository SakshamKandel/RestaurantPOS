const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.argv.includes('--dev')

const storePath = () => path.join(app.getPath('userData'), 'pos-store.json')
const backupDir = () => path.join(app.getPath('userData'), 'backups')

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
  autoUpdater.on('update-available', (info) => {
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

  autoUpdater.on('error', () => {}) // offline or dev mode — silent
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 3600 * 1000)
}

ipcMain.handle('update:install', () => {
  preUpdateBackup()
  autoUpdater.quitAndInstall()
})
ipcMain.handle('update:check', () => autoUpdater.checkForUpdates().catch(() => null))
ipcMain.handle('app:version', () => app.getVersion())

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
