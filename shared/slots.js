/**
 * 약속 잡기 슬롯 좌표계.
 *
 * 저장 해상도는 언제나 30분이다. 생성자가 고르는 슬롯 크기(30/60)는 표시·집계에만 쓰인다.
 * 그래서 기간·시간창·슬롯 크기를 나중에 바꿔도 이미 들어온 표를 손댈 필요가 없다.
 *
 *   하루 = 48버킷(30분) = 48비트 = 6바이트 = base64 8글자
 *   날짜 키 = 'YYMMDD' (투표의 tz 기준 벽시계. 2000~2099년만 다룬다)
 *   마스크 = { '260810': 'AAD//wAA', ... }  (전부 0인 날은 생략)
 */

export const DAY_BUCKETS = 48
export const DAY_BYTES = 6
export const BUCKET_MINUTES = 30
export const MINUTES_PER_DAY = 1440

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

const pad2 = (n) => String(n).padStart(2, '0')

/* ---------- 비트 ---------- */

export function emptyDayBytes() {
  return new Uint8Array(DAY_BYTES)
}

export function bitGet(bytes, i) {
  return (bytes[i >> 3] >> (7 - (i & 7))) & 1
}

export function bitSet(bytes, i, on) {
  const mask = 1 << (7 - (i & 7))
  if (on) bytes[i >> 3] |= mask
  else bytes[i >> 3] &= ~mask
}

export function isAllZero(bytes) {
  for (let i = 0; i < bytes.length; i++) if (bytes[i] !== 0) return false
  return true
}

export function bytesToB64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export function b64ToDayBytes(b64) {
  if (typeof b64 !== 'string') return null
  let raw
  try {
    raw = atob(b64)
  } catch {
    return null
  }
  if (raw.length !== DAY_BYTES) return null
  const out = new Uint8Array(DAY_BYTES)
  for (let i = 0; i < DAY_BYTES; i++) out[i] = raw.charCodeAt(i)
  return out
}

/* ---------- 날짜 ---------- */

// Date.UTC를 달력 계산기로만 쓴다. 로컬 시간대가 개입할 여지가 없다.
export function isoToDayNum(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [, y, mo, d] = m
  const n = Date.UTC(Number(y), Number(mo) - 1, Number(d))
  if (Number.isNaN(n)) return null
  // 2026-02-30 같은 걸 걸러낸다
  const back = new Date(n)
  if (back.getUTCMonth() + 1 !== Number(mo) || back.getUTCDate() !== Number(d)) return null
  return Math.floor(n / 86400000)
}

export function dayNumToIso(n) {
  const dt = new Date(n * 86400000)
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

export function isoToDayKey(iso) {
  return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10)
}

export function dayKeyToIso(key) {
  return `20${key.slice(0, 2)}-${key.slice(2, 4)}-${key.slice(4, 6)}`
}

export const DAY_KEY_RE = /^\d{6}$/

// dayNum 0 === 1970-01-01 === 목요일
export function weekdayIndex(dayNum) {
  return (((dayNum + 4) % 7) + 7) % 7
}

export function weekdayKo(dayNum) {
  return WEEKDAY_KO[weekdayIndex(dayNum)]
}

export function enumerateDays(startIso, endIso) {
  const a = isoToDayNum(startIso)
  const b = isoToDayNum(endIso)
  if (a === null || b === null || b < a) return []
  const out = []
  for (let n = a; n <= b; n++) out.push(n)
  return out
}

/* ---------- 분 ---------- */

export function minuteLabel(minute) {
  return `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`
}

export function bucketOfMinute(minute) {
  return Math.floor(minute / BUCKET_MINUTES)
}

/* ---------- 격자 ---------- */

/**
 * 약속 설정에서 표시용 격자를 만든다. 서버 집계와 클라이언트 렌더가 같은 함수를 쓴다.
 * @returns {{days: Array, rows: Array, slotMinutes: number, slotCount: number}}
 */
export function buildGrid(appt) {
  const { startDate, endDate, startMinute, endMinute, slotMinutes } = appt
  const days = enumerateDays(startDate, endDate).map((dayNum) => {
    const iso = dayNumToIso(dayNum)
    return {
      dayNum,
      iso,
      key: isoToDayKey(iso),
      month: Number(iso.slice(5, 7)),
      date: Number(iso.slice(8, 10)),
      weekday: weekdayIndex(dayNum),
      weekdayKo: weekdayKo(dayNum),
      label: `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`,
    }
  })

  const rows = []
  for (let m = startMinute; m + slotMinutes <= endMinute; m += slotMinutes) {
    const buckets = []
    for (let b = m; b < m + slotMinutes; b += BUCKET_MINUTES) buckets.push(bucketOfMinute(b))
    rows.push({
      minute: m,
      endMinute: m + slotMinutes,
      buckets,
      label: minuteLabel(m),
      rangeLabel: `${minuteLabel(m)}–${minuteLabel(m + slotMinutes)}`,
      isHourStart: m % 60 === 0,
    })
  }

  return { days, rows, slotMinutes, slotCount: days.length * rows.length }
}

/* ---------- 선택 집합 <-> 마스크 ---------- */

export function slotKey(dayKey, bucket) {
  return `${dayKey}|${bucket}`
}

export function parseSlotKey(key) {
  const i = key.indexOf('|')
  return { dayKey: key.slice(0, i), bucket: Number(key.slice(i + 1)) }
}

/** Set<'YYMMDD|bucket'> -> { 'YYMMDD': base64 } */
export function selectionToMasks(selected) {
  const perDay = new Map()
  for (const key of selected) {
    const { dayKey, bucket } = parseSlotKey(key)
    if (!DAY_KEY_RE.test(dayKey) || !(bucket >= 0 && bucket < DAY_BUCKETS)) continue
    let bytes = perDay.get(dayKey)
    if (!bytes) {
      bytes = emptyDayBytes()
      perDay.set(dayKey, bytes)
    }
    bitSet(bytes, bucket, true)
  }
  const out = {}
  for (const dayKey of [...perDay.keys()].sort()) {
    const bytes = perDay.get(dayKey)
    if (!isAllZero(bytes)) out[dayKey] = bytesToB64(bytes)
  }
  return out
}

/** { 'YYMMDD': base64 } -> Set<'YYMMDD|bucket'> */
export function masksToSelection(masks) {
  const out = new Set()
  if (!masks) return out
  for (const [dayKey, b64] of Object.entries(masks)) {
    const bytes = b64ToDayBytes(b64)
    if (!bytes) continue
    for (let b = 0; b < DAY_BUCKETS; b++) if (bitGet(bytes, b)) out.add(slotKey(dayKey, b))
  }
  return out
}

/** 마스크를 바이트 맵으로 (집계용) */
export function decodeMasks(masks) {
  const out = new Map()
  if (!masks) return out
  for (const [dayKey, b64] of Object.entries(masks)) {
    const bytes = b64ToDayBytes(b64)
    if (bytes && !isAllZero(bytes)) out.set(dayKey, bytes)
  }
  return out
}

/**
 * 한 칸(=행)이 가능한가.
 * 60분 슬롯이면 30분 두 조각이 **모두** 켜져 있어야 한다 ("이 한 시간이 통째로 빈다").
 */
export function isRowAvailable(dayBytes, row) {
  if (!dayBytes) return false
  for (const b of row.buckets) if (!bitGet(dayBytes, b)) return false
  return true
}

/** 선택 집합 기준으로 행이 켜져 있는가 (클라이언트 렌더용) */
export function isRowSelected(selected, dayKey, row) {
  for (const b of row.buckets) if (!selected.has(slotKey(dayKey, b))) return false
  return true
}

export function countSelectedBuckets(masks) {
  let n = 0
  for (const bytes of decodeMasks(masks).values()) {
    for (let b = 0; b < DAY_BUCKETS; b++) if (bitGet(bytes, b)) n++
  }
  return n
}

/** 새 격자가 옛 격자를 포함하는가 (편집 시 "확대만" 판정) */
export function gridContains(next, prev) {
  const ns = isoToDayNum(next.startDate)
  const ne = isoToDayNum(next.endDate)
  const ps = isoToDayNum(prev.startDate)
  const pe = isoToDayNum(prev.endDate)
  if (ns === null || ne === null || ps === null || pe === null) return false
  return (
    ns <= ps &&
    ne >= pe &&
    next.startMinute <= prev.startMinute &&
    next.endMinute >= prev.endMinute &&
    next.slotMinutes === prev.slotMinutes
  )
}
