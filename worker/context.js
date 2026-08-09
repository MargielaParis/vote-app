import { bad, notFound } from './http.js'
import { bearerToken, verifyAdminToken } from './crypto.js'
import { isValidPollId, anonVoterKey, ownerFingerprint } from './ids.js'
import { getPoll } from './store.js'

export const VOTER_HEADER = 'x-voter-token'
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/

export function readVoterToken(request) {
  const token = request.headers.get(VOTER_HEADER)
  return token && TOKEN_RE.test(token) ? token : null
}

export function requireVoterToken(request) {
  const token = readVoterToken(request)
  if (!token) {
    throw bad(
      '브라우저 저장소를 사용할 수 없어 투표할 수 없습니다. 시크릿 모드나 저장소 차단 설정을 확인해 주세요.',
    )
  }
  return token
}

export async function requirePoll(env, params) {
  if (!isValidPollId(params.id)) throw bad('잘못된 투표 주소입니다.')
  const poll = await getPoll(env, params.id)
  if (!poll) throw notFound()
  return poll
}

export async function checkAdmin(env, request, pollId) {
  const token = bearerToken(request)
  if (!token) return false
  return verifyAdminToken(env, token, pollId)
}

/** 이 요청자가 어떤 표의 주인인지 식별하는 데 필요한 값들 */
export async function viewerIdentity(env, request, poll) {
  const token = readVoterToken(request)
  if (!token) return { token: null, voterKey: null, owner: null }
  if (poll.anonymous) {
    return { token, voterKey: await anonVoterKey(env, poll.id, token), owner: null }
  }
  return { token, voterKey: null, owner: await ownerFingerprint(env, poll.id, token) }
}

/** 익명이면 voterKey로, 기명이면 브라우저 지문으로 내 표를 찾는다. */
export function findMyRecord(records, poll, identity) {
  if (poll.anonymous) {
    return identity.voterKey ? records.find((r) => r.voterKey === identity.voterKey) || null : null
  }
  return identity.owner ? records.find((r) => r.owner === identity.owner) || null : null
}
