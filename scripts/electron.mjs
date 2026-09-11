// Launches the Electron binary with a clean environment.
// Some machines set ELECTRON_RUN_AS_NODE globally, which makes the
// binary run as plain Node and breaks app startup — so we strip it.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electronPath = require('electron')

delete process.env.ELECTRON_RUN_AS_NODE

const child = spawn(electronPath, ['.', ...process.argv.slice(2)], {
  stdio: 'inherit',
})

child.on('close', (code) => process.exit(code ?? 0))
