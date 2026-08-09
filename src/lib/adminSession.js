/** 관리 토큰은 탭이 닫히면 사라진다. */
const memory = new Map()
const key = (pollId) => `vote-app:v1:admin:${pollId}`

export function getAdminToken(pollId) {
  try {
    const v = sessionStorage.getItem(key(pollId))
    if (v) return v
  } catch {
    /* 저장소 차단 */
  }
  return memory.get(key(pollId)) || null
}

export function setAdminToken(pollId, token) {
  memory.set(key(pollId), token)
  try {
    sessionStorage.setItem(key(pollId), token)
  } catch {
    /* 메모리만 */
  }
}

export function clearAdminToken(pollId) {
  memory.delete(key(pollId))
  try {
    sessionStorage.removeItem(key(pollId))
  } catch {
    /* 무시 */
  }
}
