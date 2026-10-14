// Exercise the registered manual-check IPC handler without starting Electron,
// touching app data, contacting an update server, or downloading/installing.
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const source = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf8')
const start = source.indexOf("ipcMain.handle('update:check',")
const end = source.indexOf("ipcMain.handle('app:version',", start)
assert.ok(start >= 0 && end > start, 'manual update-check handler must exist')
const handlerSource = source.slice(start, end)

function harness({ packaged = true, result, failure, pending = false } = {}) {
  let handler
  let checks = 0
  const timers = []
  const logs = []
  const context = {
    ipcMain: {
      handle(channel, fn) {
        assert.equal(channel, 'update:check')
        handler = fn
      },
    },
    app: { isPackaged: packaged, getVersion: () => '0.4.1' },
    autoUpdater: {
      checkForUpdates() {
        checks += 1
        if (pending) return new Promise(() => {})
        return failure ? Promise.reject(failure) : Promise.resolve(result)
      },
      quitAndInstall() {
        assert.fail('checking must never install an update')
      },
    },
    ulog: (message) => logs.push(message),
    logToFile: (area, message) => logs.push(`${area}: ${message}`),
    setTimeout(callback, delay) {
      timers.push({ callback, delay })
      return timers.length
    },
    Promise,
  }
  vm.runInNewContext(handlerSource, context, { filename: 'update-check-handler.cjs' })
  assert.equal(typeof handler, 'function')
  return { invoke: () => handler(), timers, logs, checks: () => checks }
}

// Normalize objects crossing the VM boundary before strict comparison.
const plain = (value) => JSON.parse(JSON.stringify(value))

function checkUpdateEvents() {
  const eventStart = source.indexOf("  autoUpdater.on('update-available',")
  const eventEnd = source.indexOf('  autoUpdater.checkForUpdates().catch', eventStart)
  assert.ok(eventStart >= 0 && eventEnd > eventStart, 'updater event handlers must exist')
  const updater = new EventEmitter()
  const messages = []
  const logs = []
  let state = {}
  let backups = 0
  const threeDays = 3 * 24 * 60 * 60 * 1000
  const context = {
    autoUpdater: updater,
    mainWindow: { webContents: { send: (channel, info) => messages.push({ channel, info: plain(info) }) } },
    app: { getVersion: () => '0.4.1' },
    readUpdateState: () => state,
    writeUpdateState: (next) => { state = next },
    preUpdateBackup: () => { backups += 1 },
    ulog: () => {},
    logToFile: (area, message) => logs.push(`${area}: ${message}`),
    THREE_DAYS: threeDays,
    Date: { now: () => 1000 },
    setTimeout: () => assert.fail('freshly downloaded update must not force an installation'),
  }
  vm.runInNewContext(source.slice(eventStart, eventEnd), context, { filename: 'update-event-handlers.cjs' })

  updater.emit('update-available', { version: '0.4.2' })
  assert.deepEqual(messages.pop(), { channel: 'update:available', info: { version: '0.4.2' } })

  updater.emit('error', new Error('download failed'))
  assert.deepEqual(messages.pop(), { channel: 'update:error', info: { message: 'download failed' } })
  assert.ok(logs.some((message) => message.includes('auto-update error: download failed')))

  updater.emit('update-downloaded', { version: '0.4.2' })
  assert.deepEqual(messages.pop(), {
    channel: 'update:downloaded',
    info: { version: '0.4.2', currentVersion: '0.4.1', forced: false, deadline: 1000 + threeDays },
  })
  assert.equal(backups, 1)
}

async function main() {
  const dev = harness({ packaged: false })
  const devResult = await dev.invoke()
  assert.equal(devResult.status, 'dev')
  assert.equal(devResult.version, '0.4.1')
  assert.equal(dev.checks(), 0)
  assert.equal(dev.timers.length, 0)

  for (const [label, result, expected] of [
    ['latest', { isUpdateAvailable: false, updateInfo: { version: '0.4.1' } }, { status: 'none', version: '0.4.1' }],
    ['newer', { isUpdateAvailable: true, updateInfo: { version: '0.4.2' } }, { status: 'found', version: '0.4.2' }],
    ['older', { isUpdateAvailable: false, updateInfo: { version: '0.4.0' } }, { status: 'none', version: '0.4.1' }],
    ['policy-denied newer', { isUpdateAvailable: false, updateInfo: { version: '0.4.2' } }, { status: 'none', version: '0.4.1' }],
    ['no result', null, { status: 'error', message: 'no result' }],
  ]) {
    const test = harness({ result })
    // No login/session object is supplied: update checks work before login.
    assert.deepEqual(plain(await test.invoke()), expected, label)
    assert.equal(test.checks(), 1, label)
  }

  const offline = harness({ failure: new Error('offline') })
  assert.deepEqual(plain(await offline.invoke()), { status: 'error', message: 'offline' })
  assert.ok(offline.logs.some((message) => message.includes('manual update check failed: offline')))

  const slow = harness({ pending: true })
  const waiting = slow.invoke()
  assert.equal(slow.timers.length, 1)
  assert.equal(slow.timers[0].delay, 45_000)
  slow.timers[0].callback()
  assert.deepEqual(plain(await waiting), {
    status: 'error',
    message: 'slow connection — still trying in the background',
  })

  // Finding metadata must resolve while the updater's download is still pending.
  // Download completion/errors arrive through separate existing updater events.
  const downloading = harness({
    result: {
      isUpdateAvailable: true,
      updateInfo: { version: '0.4.2' },
      downloadPromise: new Promise(() => {}),
    },
  })
  assert.deepEqual(plain(await downloading.invoke()), { status: 'found', version: '0.4.2' })

  checkUpdateEvents()
  console.log('PASS: pre-login update checks (dev, latest, newer, older, policy, error, null, timeout, pending download) and download/error events')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
