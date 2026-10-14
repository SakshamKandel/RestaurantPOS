// Run with: node scripts/login-update-test.cjs
// Render the actual component without starting Electron or accessing app data.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const sourcePath = path.resolve(__dirname, '../src/components/LoginUpdatePanel.tsx')
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  fileName: sourcePath,
  compilerOptions: {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  },
})
const componentModule = { exports: {} }
vm.runInNewContext(compiled.outputText, {
  module: componentModule,
  exports: componentModule.exports,
  require: createRequire(sourcePath),
}, { filename: sourcePath })
const LoginUpdatePanel = componentModule.exports.default

const baseProps = {
  version: '0.4.1',
  status: { status: 'idle' },
  downloaded: null,
  onCheck: async () => {},
  onInstall: () => {},
}
const render = (props = {}) => renderToStaticMarkup(React.createElement(LoginUpdatePanel, { ...baseProps, ...props }))
const button = (html, label) => {
  const result = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .find((match) => match[2].includes(label))
  assert.ok(result, `Expected visible ${label} button`)
  return { disabled: /\bdisabled(?:=|\s|$)/.test(result[1]) }
}
let passed = 0
const test = (name, run) => {
  run()
  passed += 1
  console.log(`PASS ${name}`)
}

test('pre-login shows installed version and enables update check', () => {
  const html = render()
  assert.ok(html.includes('Current version: v0.4.1'))
  assert.equal(button(html, 'Check for Updates').disabled, false)
  assert.ok(html.includes('role="status"'))
  assert.ok(!html.includes('Restart &amp; Update'))
})

test('checking shows progress and prevents duplicate checks', () => {
  const html = render({ status: { status: 'checking' } })
  assert.ok(html.includes('Checking for updates…'))
  assert.equal(button(html, 'Check for Updates').disabled, true)
})

test('downloading shows release version and prevents another check', () => {
  const html = render({ status: { status: 'found', version: '0.4.2' } })
  assert.ok(html.includes('Downloading v0.4.2…'))
  assert.equal(button(html, 'Check for Updates').disabled, true)
})

test('latest version allows a later manual check', () => {
  const html = render({ status: { status: 'none' } })
  assert.ok(html.includes('using the latest version.'))
  assert.equal(button(html, 'Check for Updates').disabled, false)
})

test('browser preview keeps the update feature visible and explains availability', () => {
  const html = render({ version: 'dev', status: { status: 'dev' } })
  assert.ok(html.includes('Browser preview'))
  assert.ok(html.includes('Updates are available in the installed app.'))
  assert.equal(button(html, 'Check for Updates').disabled, false)
})

test('errors allow retry without exposing raw backend details', () => {
  const rawMessage = 'Provider failure: token=SECRET-TOKEN at /private/provider/config'
  const html = render({ status: { status: 'error', message: rawMessage } })
  assert.ok(html.includes('Could not check for updates. Please try again.'))
  assert.equal(button(html, 'Check for Updates').disabled, false)
  for (const detail of [rawMessage, 'SECRET-TOKEN', '/private/provider/config']) {
    assert.ok(!html.includes(detail), `Must not render backend detail: ${detail}`)
  }
})

const downloaded = { version: '0.4.2', currentVersion: '0.4.1', forced: false, deadline: 0 }

test('downloaded release keeps restart available independently of the main modal', () => {
  // Dismissing the main modal leaves the downloaded release passed to this panel.
  const html = render({ downloaded, status: { status: 'idle' } })
  assert.ok(html.includes('Update v0.4.2 is ready to install.'))
  assert.equal(button(html, 'Restart &amp; Update').disabled, false)
  assert.equal(button(html, 'Check for Updates').disabled, false)
})

test('downloaded release takes precedence over checking and error status text', () => {
  for (const state of ['checking', 'error']) {
    const html = render({ downloaded, status: { status: state, message: 'SECRET-TOKEN' } })
    assert.ok(html.includes('Update v0.4.2 is ready to install.'))
    assert.equal(button(html, 'Restart &amp; Update').disabled, false)
    assert.ok(!html.includes('Checking for updates…'))
    assert.ok(!html.includes('Could not check for updates.'))
    assert.ok(!html.includes('SECRET-TOKEN'))
  }
})

// Extract App's real updater callback so the race tests exercise production code.
const appPath = path.resolve(__dirname, '../src/App.tsx')
const appSource = fs.readFileSync(appPath, 'utf8')
const appAst = ts.createSourceFile(appPath, appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const checkDeclarations = []
const findCheck = (node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'checkUpdates') {
    checkDeclarations.push(node)
  }
  ts.forEachChild(node, findCheck)
}
findCheck(appAst)
assert.equal(checkDeclarations.length, 1, 'Expected one production checkUpdates callback')
assert.ok(ts.isArrowFunction(checkDeclarations[0].initializer), 'checkUpdates must be an arrow callback')
const checkCode = ts.transpileModule(`module.exports = ${checkDeclarations[0].initializer.getText(appAst)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
}).outputText

const createCheckHarness = ({ online = true } = {}) => {
  let status = { status: 'idle' }
  let bridgeCalls = 0
  let resolveMetadata
  let rejectMetadata
  const metadata = new Promise((resolve, reject) => {
    resolveMetadata = resolve
    rejectMetadata = reject
  })
  const setStatus = (next) => {
    status = typeof next === 'function' ? next(status) : next
  }
  const checkModule = { exports: {} }
  vm.runInNewContext(checkCode, {
    module: checkModule,
    navigator: { onLine: online },
    updateStatus: status,
    setUpdateStatus: setStatus,
    checkForUpdates: () => {
      bridgeCalls += 1
      return metadata
    },
  }, { filename: `${appPath}:checkUpdates` })
  return {
    check: checkModule.exports,
    get status() { return status },
    get bridgeCalls() { return bridgeCalls },
    setStatus,
    resolveMetadata,
    rejectMetadata,
  }
}
const testAsync = async (name, run) => {
  await run()
  passed += 1
  console.log(`PASS ${name}`)
}

const runCheckRegressions = async () => {
  await testAsync('late metadata found result preserves download error and retry', async () => {
    const app = createCheckHarness()
    const check = app.check()
    assert.equal(app.status.status, 'checking')
    assert.equal(app.bridgeCalls, 1)
    app.setStatus({ status: 'error' }) // Simulate a newer download error event.
    app.resolveMetadata({ status: 'found', version: '0.4.2' })
    await check
    assert.equal(app.status.status, 'error')
    assert.equal(button(render({ status: app.status }), 'Check for Updates').disabled, false)
  })

  await testAsync('late metadata timeout preserves an active download', async () => {
    const app = createCheckHarness()
    const check = app.check()
    app.setStatus({ status: 'found', version: '0.4.2' }) // Simulate update-available.
    app.rejectMetadata(new Error('Simulated metadata timeout'))
    await check
    assert.equal(app.status.status, 'found')
    assert.equal(app.status.version, '0.4.2')
    const html = render({ status: app.status })
    assert.ok(html.includes('Downloading v0.4.2…'))
    assert.equal(button(html, 'Check for Updates').disabled, true)
  })

  await testAsync('normal development and browser bridge results show preview availability', async () => {
    for (const result of [{ status: 'dev' }, null]) {
      const app = createCheckHarness()
      const check = app.check()
      app.resolveMetadata(result)
      await check
      assert.equal(app.status.status, 'dev')
      const html = render({ version: 'dev', status: app.status })
      assert.ok(html.includes('Updates are available in the installed app.'))
      assert.equal(button(html, 'Check for Updates').disabled, false)
    }
  })

  await testAsync('offline check avoids the backend bridge and allows retry', async () => {
    const app = createCheckHarness({ online: false })
    await app.check()
    assert.equal(app.bridgeCalls, 0)
    assert.equal(app.status.status, 'error')
    assert.equal(button(render({ status: app.status }), 'Check for Updates').disabled, false)
  })

  await testAsync('metadata rejection restores retry from checking', async () => {
    const app = createCheckHarness()
    const check = app.check()
    assert.equal(app.status.status, 'checking')
    app.rejectMetadata(new Error('Simulated bridge rejection'))
    await check
    assert.equal(app.status.status, 'error')
    assert.equal(button(render({ status: app.status }), 'Check for Updates').disabled, false)
  })

  console.log(`${passed} login update render and callback checks passed.`)
}

runCheckRegressions().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
