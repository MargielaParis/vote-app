const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const pad2 = (n) => String(n).padStart(2, '0')

export function formatDeadline(ms) {
  const d = new Date(ms)
  const h = d.getHours()
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]}) ${ampm} ${h12}:${pad2(d.getMinutes())}`
}

export function formatRemaining(deadlineMs, now = Date.now()) {
  const diff = deadlineMs - now
  if (diff <= 0) return '마감됨'
  const min = Math.floor(diff / 60000)
  if (min < 1) return '1분 미만 남음'
  if (min < 60) return `${min}분 남음`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}시간 ${min % 60}분 남음`
  const days = Math.floor(hours / 24)
  return `${days}일 ${hours % 24}시간 남음`
}

/** epoch ms -> datetime-local 입력값 (브라우저 로컬 벽시계) */
export function toLocalInput(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** datetime-local 입력값 -> epoch ms. 마감 판정은 전역적으로 명확해야 하므로 절대 시각으로 바꾼다. */
export function fromLocalInput(value) {
  if (!value) return NaN
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? NaN : t
}

export function toDateInput(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 'YYYY-MM-DD' -> '8월 10일 (월)' */
export function formatIsoDate(iso, opts = {}) {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return opts.withYear ? `${y}년 ${m}월 ${d}일 (${wd})` : `${m}월 ${d}일 (${wd})`
}

export function minuteLabel(minute) {
  return `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`
}

export function timezoneLabel(tz) {
  try {
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value || ''
    const city = tz.split('/').pop().replace(/_/g, ' ')
    return `${city} ${offset}`.trim()
  } catch {
    return tz
  }
}

export const localTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'
  } catch {
    return 'Asia/Seoul'
  }
}
