import { LIMITS } from '@shared/limits.js'

export const pollKey = (id) => `poll:${id}`
export const ballotPrefix = (id) => `ballot:${id}:`
export const ballotKey = (id, voterKey) => `ballot:${id}:${voterKey}`
export const lockKey = (id) => `lock:${id}`

const ttl = { expirationTtl: LIMITS.KEY_TTL_SECONDS }

export async function getPoll(env, id) {
  return (await env.VOTES.get(pollKey(id), { type: 'json' })) || null
}

export async function putPoll(env, poll) {
  await env.VOTES.put(pollKey(poll.id), JSON.stringify(poll), ttl)
}

export async function putBallot(env, pollId, voterKey, ballot, metadata) {
  await env.VOTES.put(ballotKey(pollId, voterKey), JSON.stringify(ballot), { ...ttl, metadata })
}

export async function getBallot(env, pollId, voterKey) {
  return (await env.VOTES.get(ballotKey(pollId, voterKey), { type: 'json' })) || null
}

export async function deleteBallot(env, pollId, voterKey) {
  await env.VOTES.delete(ballotKey(pollId, voterKey))
}

/** 표 목록. 값은 안 읽고 메타데이터만 가져온다 (list 1회). */
export async function listBallots(env, pollId) {
  const prefix = ballotPrefix(pollId)
  const out = []
  let cursor
  for (;;) {
    const res = await env.VOTES.list({ prefix, cursor, limit: 1000 })
    for (const k of res.keys) {
      out.push({ name: k.name, voterKey: k.name.slice(prefix.length), meta: k.metadata || null })
    }
    if (res.list_complete) break
    cursor = res.cursor
    if (!cursor) break
  }
  return out
}

export async function deletePollCascade(env, pollId) {
  const ballots = await listBallots(env, pollId)
  await Promise.all(ballots.map((b) => env.VOTES.delete(b.name)))
  await env.VOTES.delete(pollKey(pollId))
  return ballots.length
}
