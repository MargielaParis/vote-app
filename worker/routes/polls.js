import { LIMITS } from '@shared/limits.js'
import { json, readJson, forbidden, HttpError } from '../http.js'
import { validateCreate, validatePatch } from '../validate.js'
import { hashPassword, signAdminToken } from '../crypto.js'
import { generatePollId } from '../ids.js'
import { getPoll, putPoll, deletePollCascade } from '../store.js'
import { memoInvalidate } from '../memo.js'
import { allowCreate } from '../ratelimit.js'
import { loadRecords, computeResults, resultsVisible } from '../aggregate.js'
import { publicPoll, publicBallot } from '../present.js'
import { requirePoll, checkAdmin, viewerIdentity, findMyRecord } from '../context.js'

export async function createPoll({ request, env, url }) {
  if (!allowCreate(request.headers.get('cf-connecting-ip'))) {
    throw new HttpError(
      429,
      'too_many',
      '투표를 너무 자주 만들고 있습니다. 잠시 후 다시 시도해 주세요.',
    )
  }

  const body = await readJson(request, LIMITS.BODY_BYTES_MAX)
  const { draft, password } = validateCreate(body)

  let id = null
  for (let i = 0; i < 5; i++) {
    const candidate = generatePollId()
    // KV에는 원자적 create-if-not-exists가 없다. 이 확인은 RNG 버그를 잡는 용도이지
    // 원자성을 보장하지 않는다. 59비트에서 실제 충돌 확률은 무시할 수준이다.
    if (!(await getPoll(env, candidate))) {
      id = candidate
      break
    }
  }
  if (!id) throw new Error('poll id generation failed')

  const now = Date.now()
  const poll = {
    ...draft,
    id,
    rev: 1,
    createdAt: now,
    updatedAt: now,
    pw: await hashPassword(env, password),
  }
  await putPoll(env, poll)
  memoInvalidate(id)

  return json(
    {
      poll: publicPoll(poll),
      adminToken: await signAdminToken(env, id),
      shareUrl: new URL(`/p/${id}`, url.origin).toString(),
    },
    { status: 201 },
  )
}

export async function readPoll({ request, env, params }) {
  const poll = await requirePoll(env, params)
  const isAdmin = await checkAdmin(env, request, poll.id)
  const identity = await viewerIdentity(env, request, poll)

  const records = await loadRecords(env, poll)
  const mine = findMyRecord(records, poll, identity)
  const visible = resultsVisible(poll, { isAdmin, hasVoted: Boolean(mine) })

  return json(
    {
      poll: publicPoll(poll),
      you: publicBallot(mine),
      totalVoters: records.length,
      isAdmin,
      // 관리 화면에서 특정 참여자의 표를 지울 수 있게, 생성자에게만 식별자를 준다.
      ballots: isAdmin ? records.map(publicBallot) : null,
      results: visible ? computeResults(poll, records) : null,
      resultsLocked: visible ? null : poll.resultVisibility,
    },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}

export async function readPollSummary({ env, params }) {
  const poll = await requirePoll(env, params)
  return json(
    {
      poll: {
        id: poll.id,
        title: poll.title,
        pollType: poll.pollType,
        deadline: poll.deadline,
        createdAt: poll.createdAt,
      },
    },
    { headers: { 'cache-control': 'private, max-age=60' } },
  )
}

export async function patchPoll({ request, env, params }) {
  const poll = await requirePoll(env, params)
  if (!(await checkAdmin(env, request, poll.id))) {
    throw forbidden('비밀번호 확인이 필요합니다.')
  }

  const body = await readJson(request, LIMITS.BODY_BYTES_MAX)
  const records = await loadRecords(env, poll)
  const { next, warnings, newPassword } = validatePatch(body, poll, records.length)

  if (newPassword) next.pw = await hashPassword(env, newPassword)
  await putPoll(env, next)
  // 설정만 바뀌고 표는 그대로다. 표 메모를 버리면 다음 조회에서 list 를 한 번 더 쓴다.

  return json({ poll: publicPoll(next), warnings, totalVoters: records.length })
}

export async function removePoll({ request, env, params }) {
  const poll = await requirePoll(env, params)
  if (!(await checkAdmin(env, request, poll.id))) {
    throw forbidden('비밀번호 확인이 필요합니다.')
  }
  const removed = await deletePollCascade(env, poll.id)
  memoInvalidate(poll.id)
  return json({ deleted: true, ballots: removed })
}
