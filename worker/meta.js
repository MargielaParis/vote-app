import { formatPageTitle, pollMetaDescription, SITE_NAME } from '@shared/meta.js'
import { isValidPollId } from './ids.js'
import { getPoll } from './store.js'

const POLL_PAGE_RE = /^\/p\/([^/]+)(?:\/(share|result|manage))?\/?$/

function routeMeta(pathname) {
  const match = pathname.match(POLL_PAGE_RE)
  if (!match || !isValidPollId(match[1])) return null
  return { id: match[1], view: match[2] || 'poll' }
}

function viewTitle(title, view) {
  if (view === 'share') return `${title} 공유`
  if (view === 'result') return `${title} 결과`
  if (view === 'manage') return `${title} 관리`
  return title
}

function setContent(content) {
  return {
    element(element) {
      element.setAttribute('content', content)
    },
  }
}

export async function servePollPage(request, env, url) {
  const response = env.ASSETS
    ? await env.ASSETS.fetch(request)
    : new Response('Not found', { status: 404 })
  const route = routeMeta(url.pathname)

  if (
    request.method !== 'GET' ||
    !route ||
    !response.headers.get('content-type')?.includes('text/html')
  ) {
    return response
  }

  try {
    const poll = await getPoll(env, route.id)
    if (!poll) return response

    const socialTitle = viewTitle(poll.title, route.view)
    const pageTitle = formatPageTitle(socialTitle)
    const description = pollMetaDescription(poll)
    const canonicalUrl = new URL(`/p/${route.id}`, url.origin).toString()

    return new globalThis.HTMLRewriter()
      .on('title', {
        element(element) {
          element.setInnerContent(pageTitle)
        },
      })
      .on('meta[name="description"]', setContent(description))
      .on('meta[property="og:title"]', setContent(socialTitle))
      .on('meta[property="og:description"]', setContent(description))
      .on('meta[property="og:url"]', setContent(canonicalUrl))
      .on('meta[property="og:site_name"]', setContent(SITE_NAME))
      .on('meta[name="twitter:title"]', setContent(socialTitle))
      .on('meta[name="twitter:description"]', setContent(description))
      .transform(response)
  } catch (error) {
    console.error('metadata rewrite failed', error)
    return response
  }
}
