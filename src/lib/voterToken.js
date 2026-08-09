/**
 * 투표별 참여자 토큰.
 * 서버는 이 토큰을 HMAC으로 해싱해서만 저장하므로 KV가 유출돼도 재사용할 수 없다.
 * localStorage → sessionStorage → 메모리 순으로 떨어진다. 저장소가 막혀 있어도
 * 최소한 그 세션 안에서는 투표·수정이 된다.
 */
const memory = new Map()

const key = (pollId) => `vote-app:v1:voter:${pollId}`

function read(name) {
  try {
    const v = localStorage.getItem(name)
    if (v) return v
  } catch {
    /* 저장소 차단 */
  }
  try {
    const v = sessionStorage.getItem(name)
    if (v) return v
  } catch {
    /* 저장소 차단 */
  }
  return memory.get(name) || null
}

function write(name, value) {
  memory.set(name, value)
  try {
    localStorage.setItem(name, value)
    return
  } catch {
    /* 다음으로 */
  }
  try {
    sessionStorage.setItem(name, value)
  } catch {
    /* 메모리만 */
  }
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function getVoterToken(pollId) {
  const name = key(pollId)
  let token = read(name)
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    token = randomToken()
    write(name, token)
  }
  return token
}

export function hasPersistentStorage() {
  try {
    const probe = 'vote-app:v1:probe'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}
