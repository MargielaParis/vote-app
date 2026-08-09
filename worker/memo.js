import { LIMITS } from '@shared/limits.js'

/**
 * 아이솔레이트 내 집계 캐시.
 * caches API는 *.workers.dev에서 무동작이라 HTTP 캐시를 쓸 수 없다.
 * KV list는 무료 플랜에서 하루 1000회뿐이라 새로고침 연타를 여기서 흡수한다.
 */
const cache = new Map()

export function memoGet(pollId) {
  const hit = cache.get(pollId)
  if (!hit) return null
  if (Date.now() - hit.at > LIMITS.RESULT_MEMO_MS) {
    cache.delete(pollId)
    return null
  }
  cache.delete(pollId)
  cache.set(pollId, hit) // LRU: 최근 사용을 뒤로
  return hit.records
}

export function memoSet(pollId, records) {
  cache.delete(pollId)
  cache.set(pollId, { at: Date.now(), records })
  while (cache.size > LIMITS.RESULT_MEMO_ENTRIES) {
    cache.delete(cache.keys().next().value)
  }
}

export function memoInvalidate(pollId) {
  cache.delete(pollId)
}
