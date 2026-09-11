// PIN hashing + login throttling. Lives in the main process so the renderer
// never handles plaintext PINs after login and cannot read hashes.
const crypto = require('crypto')

const ITER = 120_000
const KEYLEN = 32

/** scrypt-strength via PBKDF2-SHA256 (built-in, no native deps). Format: pbkdf2$iter$salt$hash */
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(String(pin), salt, ITER, KEYLEN, 'sha256').toString('hex')
  return `pbkdf2$${ITER}$${salt}$${hash}`
}

function verifyPin(pin, stored) {
  if (!stored) return false
  if (!stored.startsWith('pbkdf2$')) return String(pin) === String(stored) // legacy plaintext
  const [, iter, salt, hash] = stored.split('$')
  const test = crypto.pbkdf2Sync(String(pin), salt, Number(iter), KEYLEN, 'sha256')
  const want = Buffer.from(hash, 'hex')
  return test.length === want.length && crypto.timingSafeEqual(test, want)
}

const isHashed = (s) => typeof s === 'string' && s.startsWith('pbkdf2$')

/* ---- Brute-force throttle: per account, escalating lockout ---- */
const attempts = new Map() // id -> { fails, until }
const LOCK_STEPS = [0, 0, 0, 30, 60, 300, 900] // seconds after Nth failure

function lockedFor(id) {
  const a = attempts.get(id)
  if (!a || a.until <= Date.now()) return 0
  return Math.ceil((a.until - Date.now()) / 1000)
}

function recordFailure(id) {
  const a = attempts.get(id) ?? { fails: 0, until: 0 }
  a.fails += 1
  const secs = LOCK_STEPS[Math.min(a.fails, LOCK_STEPS.length - 1)]
  a.until = secs ? Date.now() + secs * 1000 : 0
  attempts.set(id, a)
  return { fails: a.fails, lockSeconds: secs }
}

const clearFailures = (id) => attempts.delete(id)

module.exports = { hashPin, verifyPin, isHashed, lockedFor, recordFailure, clearFailures }
