import { getVoterToken } from './voterToken.js'
import { getAdminToken } from './adminSession.js'

export class ApiError extends Error {
  constructor(status, code, message, detail) {
    super(message)
    this.status = status
    this.code = code
    this.detail = detail
  }
}

async function request(method, path, { body, pollId, withVoter, withAdmin } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (withVoter && pollId) headers['x-voter-token'] = getVoterToken(pollId)
  if (withAdmin && pollId) {
    const token = getAdminToken(pollId)
    if (token) headers.authorization = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network', '네트워크에 연결할 수 없습니다.')
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    /* 본문 없음 */
  }

  if (!res.ok) {
    const err = data?.error || {}
    throw new ApiError(
      res.status,
      err.code || 'unknown',
      err.message || '요청에 실패했습니다.',
      err.detail,
    )
  }
  return data
}

export const api = {
  createPoll: (body) => request('POST', '/api/polls', { body }),

  getPoll: (id) =>
    request('GET', `/api/polls/${id}`, { pollId: id, withVoter: true, withAdmin: true }),

  patchPoll: (id, body) =>
    request('PATCH', `/api/polls/${id}`, { body, pollId: id, withAdmin: true }),

  deletePoll: (id) => request('DELETE', `/api/polls/${id}`, { pollId: id, withAdmin: true }),

  vote: (id, body) =>
    request('POST', `/api/polls/${id}/votes`, {
      body,
      pollId: id,
      withVoter: true,
      withAdmin: true,
    }),

  withdraw: (id) => request('DELETE', `/api/polls/${id}/votes`, { pollId: id, withVoter: true }),

  deleteVoterBallot: (id, voterKey) =>
    request('DELETE', `/api/polls/${id}/votes/${encodeURIComponent(voterKey)}`, {
      pollId: id,
      withAdmin: true,
    }),

  getResults: (id) =>
    request('GET', `/api/polls/${id}/results`, { pollId: id, withVoter: true, withAdmin: true }),

  login: (id, password) => request('POST', `/api/polls/${id}/session`, { body: { password } }),
}
