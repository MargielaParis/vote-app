import { LIMITS } from '@shared/limits.js'
import { json, readJson, HttpError } from '../http.js'
import { verifyPassword, signAdminToken } from '../crypto.js'
import { isLocked, applyLock, noteFailure, clearFailures } from '../ratelimit.js'
import { requirePoll } from '../context.js'

export async function createSession({ request, env, params }) {
  const poll = await requirePoll(env, params)

  if (await isLocked(env, poll.id)) {
    throw new HttpError(
      429,
      'locked',
      '비밀번호를 여러 번 틀렸습니다. 5분 뒤에 다시 시도해 주세요.',
    )
  }

  const body = await readJson(request, 4096)
  const password = typeof body.password === 'string' ? body.password : ''

  if (!(await verifyPassword(env, poll.pw, password))) {
    const fails = noteFailure(poll.id)
    if (fails >= LIMITS.PW_FAILS_BEFORE_LOCK) await applyLock(env, poll.id)
    throw new HttpError(401, 'bad_password', '비밀번호가 맞지 않습니다.')
  }

  clearFailures(poll.id)
  return json({ adminToken: await signAdminToken(env, poll.id) })
}
