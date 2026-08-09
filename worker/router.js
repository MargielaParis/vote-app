/** 의존성 없는 경로 매처. `/api/polls/:id/votes` 형태만 지원한다. */
export function createRouter() {
  const routes = []

  const add = (method, pattern, handler) => {
    routes.push({ method, segments: pattern.split('/').filter(Boolean), handler })
  }

  return {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    patch: (p, h) => add('PATCH', p, h),
    delete: (p, h) => add('DELETE', p, h),
    match(method, pathname) {
      const parts = pathname.split('/').filter(Boolean)
      let methodMismatch = false
      for (const route of routes) {
        if (route.segments.length !== parts.length) continue
        const params = {}
        let ok = true
        for (let i = 0; i < parts.length; i++) {
          const seg = route.segments[i]
          if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i])
          else if (seg !== parts[i]) {
            ok = false
            break
          }
        }
        if (!ok) continue
        if (route.method !== method) {
          methodMismatch = true
          continue
        }
        return { handler: route.handler, params }
      }
      return methodMismatch ? { methodMismatch: true } : null
    },
  }
}
