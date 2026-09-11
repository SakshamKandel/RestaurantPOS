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

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    title: 'Tabetei POS',
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

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
