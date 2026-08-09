import { json, forbidden } from '../http.js'
import { loadRecords, computeResults, resultsVisible } from '../aggregate.js'
import { requirePoll, checkAdmin, viewerIdentity, findMyRecord } from '../context.js'

export async function readResults({ request, env, params }) {
  const poll = await requirePoll(env, params)
  const isAdmin = await checkAdmin(env, request, poll.id)
  const identity = await viewerIdentity(env, request, poll)

  const records = await loadRecords(env, poll)
  const mine = findMyRecord(records, poll, identity)

  if (!resultsVisible(poll, { isAdmin, hasVoted: Boolean(mine) })) {
    throw forbidden('아직 결과를 볼 수 없습니다.', { resultsLocked: poll.resultVisibility })
  }

  return json(
    { totalVoters: records.length, results: computeResults(poll, records) },
    { headers: { 'cache-control': 'private, max-age=10' } },
  )
}
