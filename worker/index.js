import { createRouter } from './router.js'
import { json, errorResponse, HttpError } from './http.js'
import { createPoll, readPoll, patchPoll, removePoll } from './routes/polls.js'
import { castVote, withdrawVote, adminDeleteVote } from './routes/votes.js'
import { readResults } from './routes/results.js'
import { createSession } from './routes/session.js'

const router = createRouter()

router.get('/api/health', () => json({ ok: true, service: 'vote-app', time: Date.now() }))

router.post('/api/polls', createPoll)
router.get('/api/polls/:id', readPoll)
router.patch('/api/polls/:id', patchPoll)
router.delete('/api/polls/:id', removePoll)

router.post('/api/polls/:id/votes', castVote)
router.delete('/api/polls/:id/votes', withdrawVote)
router.delete('/api/polls/:id/votes/:voterKey', adminDeleteVote)

router.get('/api/polls/:id/results', readResults)
router.post('/api/polls/:id/session', createSession)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // run_worker_first 로 /api/* 만 여기로 들어온다. 그 외는 정적 에셋이 처리한다.
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 })
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { allow: 'GET,POST,PATCH,DELETE' } })
    }

    try {
      const matched = router.match(request.method, url.pathname)
      if (!matched) {
        // SPA fallback 으로 흘려보내지 않는다. API 는 언제나 JSON 으로 답한다.
        throw new HttpError(404, 'no_route', '없는 API 주소입니다.')
      }
      if (matched.methodMismatch) {
        throw new HttpError(405, 'method_not_allowed', '허용되지 않은 메서드입니다.')
      }
      return await matched.handler({ request, env, ctx, url, params: matched.params })
    } catch (err) {
      return errorResponse(err)
    }
  },
}
