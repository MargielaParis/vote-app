import { LIMITS } from '@shared/limits.js'
import { lockKey } from './store.js'

/**
 * 실패 시도마다 KV에 쓰면 무료 쓰기 예산(1000/일)이 날아간다.
 * 1차는 아이솔레이트 메모리, 임계치를 넘을 때만 KV에 잠금을 1회 쓴다.
 * 콜로를 넘나드는 공격에는 뚫린다 — 애초에 링크(59비트)를 알아야 시도할 수 있으므로 수용한다.
 */
const local = new Map()

export function noteFailure(pollId) {
  const now = Date.now()
  const cur = local.get(pollId)
  if (!cur || now > cur.resetAt) {
    local.set(pollId, { count: 1, resetAt: now + LIMITS.LOCK_TTL_SECONDS * 1000 })
    if (local.size > 500) local.delete(local.keys().next().value)
    return 1
  }
  cur.count += 1
  return cur.count
}

export function clearFailures(pollId) {
  local.delete(pollId)
}

export async function isLocked(env, pollId) {
  const cur = local.get(pollId)
  if (cur && Date.now() <= cur.resetAt && cur.count >= LIMITS.PW_FAILS_BEFORE_LOCK) return true
  return (await env.VOTES.get(lockKey(pollId))) !== null
}

export async function applyLock(env, pollId) {
  await env.VOTES.put(lockKey(pollId), '1', { expirationTtl: LIMITS.LOCK_TTL_SECONDS })
}

const creates = new Map()

/**
 * 생성 스로틀. 학교·회사처럼 NAT 뒤에서 여러 명이 한 IP를 공유하는 경우가 흔해서
 * 한도를 넉넉히 잡는다 (아이솔레이트 단위, best-effort).
 */
export function allowCreate(ip) {
  if (!ip) return true
  const now = Date.now()
  const cur = creates.get(ip)
  if (!cur || now > cur.resetAt) {
    creates.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 })
    if (creates.size > 500) creates.delete(creates.keys().next().value)
    return true
  }
  cur.count += 1
  return cur.count <= 60
}
