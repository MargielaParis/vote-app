import { LIMITS, POLL_ID_RE } from '@shared/limits.js'
import { getKeys, hmacBytes, sha256Bytes, b64url, randomBytes } from './crypto.js'

const ALPHABET = LIMITS.POLL_ID_ALPHABET
const REJECT_AT = Math.floor(256 / ALPHABET.length) * ALPHABET.length // 240

/** 거부 샘플링. 바이트에 그냥 %30을 하면 모듈로 편향이 생긴다. */
export function generatePollId() {
  const out = []
  while (out.length < LIMITS.POLL_ID_LEN) {
    const buf = randomBytes(32)
    for (let i = 0; i < buf.length && out.length < LIMITS.POLL_ID_LEN; i++) {
      if (buf[i] < REJECT_AT) out.push(ALPHABET[buf[i] % ALPHABET.length])
    }
  }
  return out.join('')
}

export function isValidPollId(id) {
  return typeof id === 'string' && POLL_ID_RE.test(id)
}

// 제어문자 제거. 이름에 섞여 들어오는 걸 막는 게 목적이라 제어문자 매칭이 의도적이다.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

/** 표시용 이름 (원래 대소문자 유지) */
export function normalizeName(raw) {
  return String(raw).normalize('NFKC').replace(CONTROL_CHARS, '').trim().replace(/\s+/g, ' ')
}

/**
 * 동일인 판정용 이름. 공백을 전부 지운다 —
 * "김기연"과 "김 기연"이 서로 다른 참여자로 잡히는 걸 막기 위해서다.
 */
export function identityName(raw) {
  return normalizeName(raw).replace(/\s+/g, '').toLowerCase()
}

export async function anonVoterKey(env, pollId, token) {
  const keys = await getKeys(env)
  const bytes = await hmacBytes(keys.vid, `voter|${pollId}|${token}`)
  return `a:${b64url(bytes).slice(0, 22)}`
}

export async function namedVoterKey(pollId, identity) {
  const bytes = await sha256Bytes(`name|${pollId}|${identity}`)
  return `n:${b64url(bytes).slice(0, 22)}`
}

/**
 * 기명 투표에서 "이 이름을 처음 등록한 브라우저" 표식.
 * 토큰 원문을 저장하지 않으므로 KV가 유출돼도 남의 표를 사칭할 수 없다.
 */
export async function ownerFingerprint(env, pollId, token) {
  if (!token) return null
  const keys = await getKeys(env)
  const bytes = await hmacBytes(keys.vid, `owner|${pollId}|${token}`)
  return b64url(bytes).slice(0, 22)
}

export const VOTER_KEY_RE = /^[an]:[A-Za-z0-9_-]{22}$/
