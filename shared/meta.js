import { POLL_TYPE_LABEL } from './enums.js'

export const SITE_NAME = '모두의 투표'
export const DEFAULT_PAGE_TITLE = `${SITE_NAME} — 링크 하나로 바로 결정`
export const DEFAULT_DESCRIPTION =
  '항목, 날짜, 약속 시간을 로그인 없이 정하고 링크 하나로 공유하세요.'

export function formatPageTitle(title) {
  const normalized = normalizeMetaText(title)
  return normalized ? `${normalized} | ${SITE_NAME}` : DEFAULT_PAGE_TITLE
}

export function normalizeMetaText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncateMetaText(value, maxLength = 160) {
  const normalized = normalizeMetaText(value)
  const characters = [...normalized]
  return characters.length <= maxLength
    ? normalized
    : `${characters.slice(0, maxLength - 1).join('')}…`
}

export function pollMetaDescription(poll) {
  const description = truncateMetaText(poll?.description)
  if (description) return description
  const type = POLL_TYPE_LABEL[poll?.pollType] || '온라인'
  return `${type} 투표에 참여해 주세요. 로그인 없이 링크에서 바로 선택할 수 있습니다.`
}
