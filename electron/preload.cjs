// Preload: safe bridge between the POS UI and the desktop shell.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pos', {
  platform: process.platform,
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (state) => ipcRenderer.invoke('store:save', state),
  backup: (state) => ipcRenderer.invoke('store:backup', state),
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  printDoc: (payload) => ipcRenderer.invoke('printers:print', payload),
})
