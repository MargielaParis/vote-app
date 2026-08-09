import { LIMITS } from '@shared/limits.js'
import { POLL_TYPE } from '@shared/enums.js'
import { selectionToMasks, DAY_KEY_RE, DAY_BUCKETS } from '@shared/slots.js'
import { json, readJson, bad, forbidden, conflict, notFound } from '../http.js'
import { validateVote } from '../validate.js'
import { namedVoterKey, identityName, normalizeName, VOTER_KEY_RE } from '../ids.js'
import { putBallot, getBallot, deleteBallot } from '../store.js'
import { toMetadata } from '../ballot.js'
import { memoSet } from '../memo.js'
import { loadRecords, withOverride, computeResults, resultsVisible } from '../aggregate.js'
import { publicBallot } from '../present.js'
import {
  requirePoll,
  requireVoterToken,
  viewerIdentity,
  findMyRecord,
  checkAdmin,
} from '../context.js'

function assertOpen(poll) {
  if (Date.now() > poll.deadline) throw forbidden('마감된 투표입니다.', { closed: true })
}

/** 'YYMMDD|bucket' 문자열들을 30분 절대 격자 마스크로 압축한다. */
function slotsToMasks(rawSlots) {
  const clean = new Set()
  const days = new Set()
  for (const s of rawSlots) {
    const i = s.indexOf('|')
    if (i < 0) continue
    const dayKey = s.slice(0, i)
    const bucket = Number(s.slice(i + 1))
    if (!DAY_KEY_RE.test(dayKey)) continue
    if (!Number.isInteger(bucket) || bucket < 0 || bucket >= DAY_BUCKETS) continue
    days.add(dayKey)
    if (days.size > LIMITS.APPT_DAYS_MAX * 2) throw bad('선택한 날짜 범위가 너무 넓습니다.')
    clean.add(`${dayKey}|${bucket}`)
  }
  return selectionToMasks(clean)
}

export async function castVote({ request, env, params }) {
  const poll = await requirePoll(env, params)
  assertOpen(poll)

  requireVoterToken(request) // 토큰이 없으면 여기서 끊는다
  const body = await readJson(request, LIMITS.BODY_BYTES_MAX)
  const input = validateVote(body, poll)
  const identity = await viewerIdentity(env, request, poll)

  let voterKey
  let name = null
  if (poll.anonymous) {
    voterKey = identity.voterKey
  } else {
    name = normalizeName(input.rawName)
    if (!name) throw bad('이름을 입력해 주세요.')
    voterKey = await namedVoterKey(poll.id, identityName(name))
  }

  const existing = await getBallot(env, poll.id, voterKey)
  if (existing) {
    if (!poll.anonymous && existing.owner && existing.owner !== identity.owner) {
      throw conflict('name_taken', '같은 이름이 이미 있습니다. 다른 이름을 사용해 주세요.')
    }
    if (!poll.allowRevote) {
      throw conflict('already_voted', '이 투표는 한 번만 참여할 수 있습니다.')
    }
  }

  const priorRecords = await loadRecords(env, poll)
  if (!existing && priorRecords.length >= LIMITS.MAX_BALLOTS) {
    throw conflict('poll_full', `이 투표는 최대 ${LIMITS.MAX_BALLOTS}명까지 참여할 수 있습니다.`)
  }

  const now = Date.now()
  const ballot = {
    voterKey,
    name,
    owner: identity.owner,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  if (poll.pollType === POLL_TYPE.APPOINTMENT) ballot.masks = slotsToMasks(input.slots)
  else ballot.choices = input.choices

  await putBallot(env, poll.id, voterKey, ballot, toMetadata(ballot))

  // list 를 다시 돌리지 않고 방금 쓴 표를 직접 반영한다 (KV 연산 1회 절약).
  const records = withOverride(priorRecords, {
    voterKey,
    name,
    owner: identity.owner,
    updatedAt: now,
    choices: ballot.choices || null,
    masks: ballot.masks || null,
  })
  memoSet(poll.id, records)
  const isAdmin = await checkAdmin(env, request, poll.id)
  const visible = resultsVisible(poll, { isAdmin, hasVoted: true })

  return json({
    you: publicBallot(findMyRecord(records, poll, { ...identity, voterKey })),
    totalVoters: records.length,
    results: visible ? computeResults(poll, records) : null,
    resultsLocked: visible ? null : poll.resultVisibility,
  })
}

export async function withdrawVote({ request, env, params }) {
  const poll = await requirePoll(env, params)
  assertOpen(poll)
  requireVoterToken(request)

  if (!poll.allowRevote) {
    throw conflict('revote_disabled', '이 투표는 참여를 취소할 수 없습니다.')
  }

  const identity = await viewerIdentity(env, request, poll)
  const records = await loadRecords(env, poll)
  const mine = findMyRecord(records, poll, identity)
  if (!mine) throw notFound('취소할 표가 없습니다.')

  await deleteBallot(env, poll.id, mine.voterKey)
  const after = withOverride(records, { voterKey: mine.voterKey, deleted: true })
  memoSet(poll.id, after)

  return json({
    you: null,
    totalVoters: after.length,
    results: null,
    resultsLocked: poll.resultVisibility,
  })
}

/** 기기를 바꿔 자기 표를 못 고치는 참여자를 생성자가 풀어주는 경로. */
export async function adminDeleteVote({ request, env, params }) {
  const poll = await requirePoll(env, params)
  if (!(await checkAdmin(env, request, poll.id))) {
    throw forbidden('비밀번호 확인이 필요합니다.')
  }
  if (!VOTER_KEY_RE.test(params.voterKey)) throw bad('잘못된 참여자 식별자입니다.')

  const before = await loadRecords(env, poll)
  if (!before.some((r) => r.voterKey === params.voterKey)) throw notFound('없는 표입니다.')

  await deleteBallot(env, poll.id, params.voterKey)
  const records = withOverride(before, { voterKey: params.voterKey, deleted: true })
  memoSet(poll.id, records)

  return json({
    deleted: true,
    totalVoters: records.length,
    results: computeResults(poll, records),
  })
}
