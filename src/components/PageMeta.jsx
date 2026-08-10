import { useEffect } from 'react'
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_PAGE_TITLE,
  SITE_NAME,
  formatPageTitle,
  normalizeMetaText,
} from '@shared/meta.js'

const META_TAGS = [
  ['name', 'description'],
  ['property', 'og:title'],
  ['property', 'og:description'],
  ['property', 'og:url'],
  ['name', 'twitter:title'],
  ['name', 'twitter:description'],
]

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.setAttribute('content', content)
}

export function PageMeta({ title, description = DEFAULT_DESCRIPTION, canonicalPath }) {
  useEffect(() => {
    const socialTitle = normalizeMetaText(title) || DEFAULT_PAGE_TITLE
    const pageTitle = title ? formatPageTitle(title) : DEFAULT_PAGE_TITLE
    const pageDescription = normalizeMetaText(description) || DEFAULT_DESCRIPTION
    const canonicalUrl = new URL(canonicalPath || window.location.pathname, window.location.origin)

    document.title = pageTitle
    const content = [
      pageDescription,
      socialTitle,
      pageDescription,
      canonicalUrl.toString(),
      socialTitle,
      pageDescription,
    ]
    META_TAGS.forEach(([attribute, key], index) => setMeta(attribute, key, content[index]))
    setMeta('property', 'og:site_name', SITE_NAME)
  }, [canonicalPath, description, title])

  return null
}
