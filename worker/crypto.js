import { LIMITS } from '@shared/limits.js'

const encoder = new TextEncoder()
const enc = (s) => encoder.encode(s)

let cachedKeys = null

async function importHmacKey(bytes) {
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

/**
 * APP_SECRET에서 용도별 서브키를 파생한다. 하나의 시크릿을 여러 용도로 그대로 쓰지 않는다.
 * 아이솔레이트 단위로 캐시된다.
 */
export async function getKeys(env) {
  const secret = env.APP_SECRET
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('APP_SECRET is missing or too short. Set it in .dev.vars / wrangler secret.')
  }
  if (cachedKeys && cachedKeys.secret === secret) return cachedKeys.keys

  const base = await importHmacKey(enc(secret))
  const derive = async (label) =>
    importHmacKey(new Uint8Array(await crypto.subtle.sign('HMAC', base, enc(label))))

  const keys = {
    pwd: await derive('vote-app/v1/password'),
    tok: await derive('vote-app/v1/token'),
    vid: await derive('vote-app/v1/voterkey'),
  }
  cachedKeys = { secret, keys }
  return keys
}

export async function hmacBytes(key, message) {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc(message)))
}

export async function sha256Bytes(message) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc(message)))
}

/* ---------- base64url ---------- */

export function b64url(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function b64urlString(text) {
  return b64url(enc(text))
}

export function b64urlToString(str) {
  return new TextDecoder().decode(b64urlDecode(str))
}

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n))
}

/* ---------- 상수 시간 비교 ---------- */

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(a, b)
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/* ---------- 비밀번호 ---------- */

/**
 * PBKDF2를 쓰지 않는다. workerd가 반복 횟수를 10만으로 하드캡하는데 이는 OWASP 권장(60만) 미달이고,
 * 무료 플랜 CPU 예산(요청당 10ms)도 거의 다 먹는다. 대신 Worker 시크릿을 pepper로 쓴다 —
 * APP_SECRET은 KV에 없으므로 KV 덤프만으로는 오프라인 대입이 성립하지 않는다.
 */
export async function hashPassword(env, password) {
  const keys = await getKeys(env)
  const salt = randomBytes(16)
  const hash = await hmacBytes(keys.pwd, `${b64url(salt)}:${password}`)
  return { kdf: 'hmac-sha256-v1', salt: b64url(salt), hash: b64url(hash) }
}

export async function verifyPassword(env, record, password) {
  if (!record || record.kdf !== 'hmac-sha256-v1') return false
  const keys = await getKeys(env)
  const hash = await hmacBytes(keys.pwd, `${record.salt}:${password}`)
  let expected
  try {
    expected = b64urlDecode(record.hash)
  } catch {
    return false
  }
  return timingSafeEqual(hash, expected)
}

/* ---------- 관리 토큰 ---------- */

export async function signAdminToken(env, pollId, ttlSeconds = LIMITS.ADMIN_TOKEN_TTL_SECONDS) {
  const keys = await getKeys(env)
  const payload = JSON.stringify({
    v: 1,
    p: pollId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  })
  const body = b64urlString(payload)
  const sig = b64url(await hmacBytes(keys.tok, body))
  return `${body}.${sig}`
}

export async function verifyAdminToken(env, token, pollId) {
  if (typeof token !== 'string' || !token.includes('.')) return false
  const [body, sig] = token.split('.')
  if (!body || !sig) return false
  const keys = await getKeys(env)
  const expected = await hmacBytes(keys.tok, body)
  let given
  try {
    given = b64urlDecode(sig)
  } catch {
    return false
  }
  if (!timingSafeEqual(expected, given)) return false
  let payload
  try {
    payload = JSON.parse(b64urlToString(body))
  } catch {
    return false
  }
  if (payload.v !== 1 || payload.p !== pollId) return false
  return payload.exp > Math.floor(Date.now() / 1000)
}

export function bearerToken(request) {
  const auth = request.headers.get('authorization') || ''
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
}
