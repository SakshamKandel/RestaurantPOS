// Staged alongside scripts/, electron/, and node_modules/ by the recovery packager.
// Run with the installed KhadkaPOS.exe and ELECTRON_RUN_AS_NODE=1.
const fs = require('fs')
const path = require('path')

function main() {
  const args = process.argv.slice(2)
  if (args.length !== 2 || args.some((arg) => !path.isAbsolute(arg))) {
    throw new Error('Recovery requires an absolute existing database path and an absolute unique receipt path.')
  }
  const [databasePath, receiptPath] = args
  const database = fs.realpathSync(databasePath)
  if (!fs.statSync(database).isFile()) throw new Error('The database path must name an existing file.')
  const helperPath = path.join(__dirname, 'scripts', 'reset-admin-pin.cjs')
  const { DEFAULT_ADMIN_PIN } = require('./electron/auth.cjs')
  if (DEFAULT_ADMIN_PIN !== '8865') {
    throw new Error('This recovery kit does not match the expected Administrator PIN. Contact support.')
  }

  // An exclusive reservation prevents stale receipts from reporting a false success.
  // If receipt creation fails, the helper never opens or changes the database.
  const receipt = fs.openSync(receiptPath, 'wx', 0o600)
  try {
    const previousArgv = process.argv
    process.argv = [process.execPath, helperPath, database, '--reset']
    try {
      require(helperPath)
    } finally {
      process.argv = previousArgv
    }
    if (process.exitCode !== undefined && process.exitCode !== 0) {
      throw new Error('The recovery helper reported a failure. Review the error above.')
    }
    fs.writeFileSync(receipt, 'KHADKAPOS_ADMIN_RECOVERY_COMPLETED\r\n', 'utf8')
    fs.fsyncSync(receipt)
  } finally {
    fs.closeSync(receipt)
  }
}

try {
  main()
} catch (error) {
  console.error(`Recovery launcher failed: ${error.message}`)
  console.error('Keep KhadkaPOS closed and contact support. Never delete the database or its lock files.')
  process.exitCode = 1
}
