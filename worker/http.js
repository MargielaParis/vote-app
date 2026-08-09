export class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message)
    this.status = status
    this.code = code
    this.extra = extra
  }
}

export const bad = (msg, extra) => new HttpError(400, 'invalid', msg, extra)
export const notFound = (msg = '없는 투표입니다.') => new HttpError(404, 'not_found', msg)
export const forbidden = (msg, extra) => new HttpError(403, 'forbidden', msg, extra)
export const conflict = (code, msg, extra) => new HttpError(409, code, msg, extra)

export function json(data, init = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store')
  headers.set('x-content-type-options', 'nosniff')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function errorResponse(err) {
  if (err instanceof HttpError) {
    return json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.extra ? { detail: err.extra } : {}),
        },
      },
      { status: err.status },
    )
  }
  console.error('unhandled', err && err.stack ? err.stack : err)
  return json(
    { error: { code: 'internal', message: '서버 오류가 발생했습니다.' } },
    { status: 500 },
  )
}

const encoder = new TextEncoder()

export async function readJson(request, maxBytes) {
  const declared = request.headers.get('content-length')
  if (declared && Number(declared) > maxBytes) {
    throw new HttpError(413, 'body_too_large', '요청 본문이 너무 큽니다.')
  }
  const text = await request.text()
  if (encoder.encode(text).byteLength > maxBytes) {
    throw new HttpError(413, 'body_too_large', '요청 본문이 너무 큽니다.')
  }
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw bad('잘못된 요청 형식입니다.')
  }
}
