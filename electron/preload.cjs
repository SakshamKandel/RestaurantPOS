// Preload: safe bridge between the POS UI and the desktop shell.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pos', {
  platform: process.platform,
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (state) => ipcRenderer.invoke('store:save', state),
  backup: (state) => ipcRenderer.invoke('store:backup', state),
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  printDoc: (payload) => ipcRenderer.invoke('printers:print', payload),
  printRaw: (payload) => ipcRenderer.invoke('printers:raw', payload),
  pickImage: () => ipcRenderer.invoke('images:pick'),
  integrity: () => ipcRenderer.invoke('store:integrity'),
  login: (id, pin) => ipcRenderer.invoke('auth:login', { id, pin }),
  setPin: (id, pin) => ipcRenderer.invoke('auth:set-pin', { id, pin }),
  exportCsv: (payload) => ipcRenderer.invoke('export:csv', payload),
  // error logs
  logError: (category, message) => ipcRenderer.invoke('logs:append', { category, message }),
  listLogs: () => ipcRenderer.invoke('logs:list'),
  readLog: (name) => ipcRenderer.invoke('logs:read', name),
  clearLog: (name) => ipcRenderer.invoke('logs:clear', name),
  openLogs: () => ipcRenderer.invoke('logs:open'),
  // updates
  appVersion: () => ipcRenderer.invoke('app:version'),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateAvailable: (cb) =>
    ipcRenderer.on('update:available', (_e, info) => cb(info)),
  onUpdateDownloaded: (cb) =>
    ipcRenderer.on('update:downloaded', (_e, info) => cb(info)),
  onUpdateChecking: (cb) => ipcRenderer.on('update:checking', () => cb()),
  onUpdateNone: (cb) =>
    ipcRenderer.on('update:none', (_e, info) => cb(info)),
  onUpdateError: (cb) =>
    ipcRenderer.on('update:error', (_e, info) => cb(info)),
})
