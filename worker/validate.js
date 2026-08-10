import { LIMITS } from '@shared/limits.js'
import {
  POLL_TYPE,
  POLL_TYPES,
  RESULT_VISIBILITIES,
  NAME_DISCLOSURES,
  SLOT_MINUTES_CHOICES,
} from '@shared/enums.js'
import { buildGrid, isoToDayNum, BUCKET_MINUTES, MINUTES_PER_DAY } from '@shared/slots.js'
import { bad, conflict } from './http.js'

/* ---------- 원시 검사기 ---------- */

function assertNoUnknown(body, allowed, where) {
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw bad(`${where}에 알 수 없는 항목이 있습니다: ${key}`)
  }
}

function reqString(v, label, min, max) {
  if (typeof v !== 'string') throw bad(`${label}을(를) 입력해 주세요.`)
  const s = v.trim()
  if (s.length < min) throw bad(`${label}을(를) 입력해 주세요.`)
  if (s.length > max) throw bad(`${label}은(는) ${max}자까지 입력할 수 있습니다.`)
  return s
}

function optString(v, label, max) {
  if (v === undefined || v === null || v === '') return ''
  if (typeof v !== 'string') throw bad(`${label} 형식이 올바르지 않습니다.`)
  const s = v.trim()
  if (s.length > max) throw bad(`${label}은(는) ${max}자까지 입력할 수 있습니다.`)
  return s
}

function reqBool(v, label) {
  if (typeof v !== 'boolean') throw bad(`${label} 설정이 올바르지 않습니다.`)
  return v
}

function enumOf(v, allowed, label) {
  if (!allowed.includes(v)) throw bad(`${label} 설정이 올바르지 않습니다.`)
  return v
}

function reqInt(v, label) {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw bad(`${label} 값이 올바르지 않습니다.`)
  return v
}

export function validDeadline(v) {
  const ms = reqInt(v, '마감 시각')
  const now = Date.now()
  if (ms <= now) throw bad('마감 시각은 현재보다 뒤여야 합니다.')
  if (ms > now + LIMITS.DEADLINE_MAX_AHEAD_MS) throw bad('마감 시각은 1년 이내로 정해 주세요.')
  return ms
}

function validTimezone(v) {
  if (v === undefined || v === null || v === '') return 'Asia/Seoul'
  if (typeof v !== 'string' || v.length > 64) throw bad('시간대가 올바르지 않습니다.')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: v })
  } catch {
    throw bad('시간대가 올바르지 않습니다.')
  }
  return v
}

/* ---------- 항목 ---------- */

const OPTION_FIELDS = new Set(['id', 'label', 'date'])

export function validOptions(pollType, raw, startSeq, keepIds = new Set()) {
  if (!Array.isArray(raw)) throw bad('항목 목록이 올바르지 않습니다.')
  if (raw.length < LIMITS.OPTIONS_MIN) throw bad(`항목은 최소 ${LIMITS.OPTIONS_MIN}개 필요합니다.`)
  if (raw.length > LIMITS.OPTIONS_MAX) throw bad(`항목은 최대 ${LIMITS.OPTIONS_MAX}개까지입니다.`)

  let seq = startSeq
  const usedIds = new Set()
  const seen = new Set()
  const out = []

  for (const item of raw) {
    const obj =
      typeof item === 'string'
        ? pollType === POLL_TYPE.DATE
          ? { date: item }
          : { label: item }
        : item
    if (!obj || typeof obj !== 'object') throw bad('항목 형식이 올바르지 않습니다.')
    assertNoUnknown(obj, OPTION_FIELDS, '항목')

    let id = null
    if (typeof obj.id === 'string' && keepIds.has(obj.id) && !usedIds.has(obj.id)) id = obj.id
    if (!id) {
      do {
        id = `o${seq++}`
      } while (keepIds.has(id) || usedIds.has(id))
    }
    usedIds.add(id)

    if (pollType === POLL_TYPE.DATE) {
      const date = reqString(obj.date, '날짜', 10, 10)
      if (isoToDayNum(date) === null) throw bad(`날짜가 올바르지 않습니다: ${date}`)
      if (seen.has(date)) throw bad(`같은 날짜가 중복됩니다: ${date}`)
      seen.add(date)
      out.push({ id, date })
    } else {
      const label = reqString(obj.label, '항목', 1, LIMITS.OPTION_LABEL_MAX)
      if (seen.has(label)) throw bad(`같은 항목이 중복됩니다: ${label}`)
      seen.add(label)
      out.push({ id, label })
    }
  }

  if (pollType === POLL_TYPE.DATE) out.sort((a, b) => a.date.localeCompare(b.date))
  return { options: out, nextOptionSeq: seq }
}

/* ---------- 약속 잡기 ---------- */

const APPT_FIELDS = new Set([
  'startDate',
  'endDate',
  'startMinute',
  'endMinute',
  'slotMinutes',
  'tz',
])

export function validAppointment(raw) {
  if (!raw || typeof raw !== 'object') throw bad('약속 기간 설정이 필요합니다.')
  assertNoUnknown(raw, APPT_FIELDS, '약속 설정')

  const startDate = reqString(raw.startDate, '시작 날짜', 10, 10)
  const endDate = reqString(raw.endDate, '종료 날짜', 10, 10)
  const a = isoToDayNum(startDate)
  const b = isoToDayNum(endDate)
  if (a === null || b === null) throw bad('날짜가 올바르지 않습니다.')
  if (b < a) throw bad('종료 날짜는 시작 날짜보다 뒤여야 합니다.')
  if (b - a + 1 > LIMITS.APPT_DAYS_MAX) {
    throw bad(`기간은 최대 ${LIMITS.APPT_DAYS_MAX}일까지 지정할 수 있습니다.`)
  }

  const startMinute = reqInt(raw.startMinute, '시작 시각')
  const endMinute = reqInt(raw.endMinute, '종료 시각')
  const slotMinutes = enumOf(raw.slotMinutes, SLOT_MINUTES_CHOICES, '슬롯 크기')

  if (startMinute % BUCKET_MINUTES !== 0 || endMinute % BUCKET_MINUTES !== 0) {
    throw bad('시간은 30분 단위로 지정해 주세요.')
  }
  if (startMinute < 0 || endMinute > MINUTES_PER_DAY || endMinute <= startMinute) {
    throw bad('종료 시각은 시작 시각보다 뒤여야 합니다.')
  }
  if (endMinute - startMinute < slotMinutes) {
    throw bad('시간 범위가 슬롯 하나보다 짧습니다.')
  }

  const appt = {
    startDate,
    endDate,
    startMinute,
    endMinute,
    slotMinutes,
    tz: validTimezone(raw.tz),
  }
  const grid = buildGrid(appt)
  if (grid.slotCount > LIMITS.APPT_SLOTS_MAX) {
    throw bad(`칸이 너무 많습니다 (${grid.slotCount}). 기간이나 시간 범위를 줄여 주세요.`)
  }
  return appt
}

/* ---------- 생성 ---------- */

const CREATE_FIELDS = new Set([
  'title',
  'description',
  'pollType',
  'anonymous',
  'multiSelect',
  'allowRevote',
  'resultVisibility',
  'nameDisclosure',
  'deadline',
  'password',
  'options',
  'appointment',
])

export function validateCreate(body) {
  if (!body || typeof body !== 'object') throw bad('요청 본문이 필요합니다.')
  assertNoUnknown(body, CREATE_FIELDS, '요청')

  const pollType = enumOf(body.pollType, POLL_TYPES, '투표 유형')
  const anonymous = reqBool(body.anonymous, '익명 여부')

  const draft = {
    title: reqString(body.title, '제목', 1, LIMITS.TITLE_MAX),
    description: optString(body.description, '설명', LIMITS.DESC_MAX),
    pollType,
    anonymous,
    allowRevote: reqBool(body.allowRevote, '재투표 허용'),
    resultVisibility: enumOf(body.resultVisibility, RESULT_VISIBILITIES, '결과 공개 시점'),
    nameDisclosure: anonymous
      ? null
      : enumOf(body.nameDisclosure, NAME_DISCLOSURES, '이름 공개 범위'),
    deadline: validDeadline(body.deadline),
  }

  if (pollType === POLL_TYPE.APPOINTMENT) {
    draft.multiSelect = true
    draft.appointment = validAppointment(body.appointment)
    draft.options = null
    draft.nextOptionSeq = 1
  } else {
    draft.multiSelect = reqBool(body.multiSelect, '복수 선택')
    const { options, nextOptionSeq } = validOptions(pollType, body.options, 1)
    draft.options = options
    draft.nextOptionSeq = nextOptionSeq
    draft.appointment = null
  }

  const password = reqString(body.password, '비밀번호', LIMITS.PASSWORD_MIN, LIMITS.PASSWORD_MAX)
  return { draft, password }
}

/* ---------- 투표 ---------- */

const VOTE_FIELDS = new Set(['name', 'choices', 'slots'])

export function validateVote(body, poll) {
  if (!body || typeof body !== 'object') throw bad('요청 본문이 필요합니다.')
  assertNoUnknown(body, VOTE_FIELDS, '요청')

  const out = {}
  if (!poll.anonymous) {
    out.rawName = reqString(body.name, '이름', 1, LIMITS.NAME_MAX)
  } else if (body.name !== undefined && body.name !== null && body.name !== '') {
    throw bad('익명 투표에는 이름을 보낼 수 없습니다.')
  }

  if (poll.pollType === POLL_TYPE.APPOINTMENT) {
    if (!Array.isArray(body.slots)) throw bad('선택한 시간이 필요합니다.')
    if (body.slots.length > LIMITS.APPT_SLOTS_MAX * 2) throw bad('선택한 칸이 너무 많습니다.')
    for (const s of body.slots) {
      if (typeof s !== 'string' || s.length > 12) throw bad('시간 형식이 올바르지 않습니다.')
    }
    out.slots = body.slots
  } else {
    if (!Array.isArray(body.choices)) throw bad('선택한 항목이 필요합니다.')
    const valid = new Set((poll.options || []).map((o) => o.id))
    const chosen = [...new Set(body.choices)]
    for (const id of chosen) {
      if (typeof id !== 'string' || !valid.has(id)) throw bad('없는 항목을 선택했습니다.')
    }
    if (chosen.length === 0) throw bad('항목을 선택해 주세요.')
    if (!poll.multiSelect && chosen.length > 1) throw bad('하나만 선택할 수 있습니다.')
    out.choices = chosen
  }
  return out
}

/* ---------- 수정 ---------- */

const PATCH_FIELDS = new Set([
  'rev',
  'title',
  'description',
  'deadline',
  'resultVisibility',
  'allowRevote',
  'nameDisclosure',
  'anonymous',
  'multiSelect',
  'options',
  'appointment',
  'password',
])

/**
 * @returns {{ next: object, warnings: string[], newPassword: string|null }}
 */
export function validatePatch(body, poll, ballotCount) {
  if (!body || typeof body !== 'object') throw bad('요청 본문이 필요합니다.')
  assertNoUnknown(body, PATCH_FIELDS, '요청')

  if (ballotCount > 0) {
    throw conflict(
      'poll_locked',
      `이미 ${ballotCount}명이 참여해 투표를 수정할 수 없습니다. 참여자 명단과 투표 삭제는 계속 사용할 수 있습니다.`,
    )
  }

  const rev = reqInt(body.rev, '수정 버전')
  if (rev !== poll.rev) {
    throw conflict('stale_rev', '다른 곳에서 먼저 수정되었습니다. 새로고침 후 다시 시도해 주세요.')
  }

  const next = { ...poll }
  const warnings = []

  if (body.title !== undefined) next.title = reqString(body.title, '제목', 1, LIMITS.TITLE_MAX)
  if (body.description !== undefined) {
    next.description = optString(body.description, '설명', LIMITS.DESC_MAX)
  }
  if (body.deadline !== undefined) next.deadline = validDeadline(body.deadline)
  if (body.resultVisibility !== undefined) {
    next.resultVisibility = enumOf(body.resultVisibility, RESULT_VISIBILITIES, '결과 공개 시점')
  }
  if (body.allowRevote !== undefined) next.allowRevote = reqBool(body.allowRevote, '재투표 허용')

  if (body.anonymous !== undefined && body.anonymous !== poll.anonymous) {
    next.anonymous = reqBool(body.anonymous, '익명 여부')
  }

  if (next.anonymous) {
    next.nameDisclosure = null
  } else {
    const given = body.nameDisclosure !== undefined ? body.nameDisclosure : poll.nameDisclosure
    next.nameDisclosure = enumOf(given, NAME_DISCLOSURES, '이름 공개 범위')
  }

  if (body.multiSelect !== undefined && body.multiSelect !== poll.multiSelect) {
    if (poll.pollType === POLL_TYPE.APPOINTMENT) {
      throw bad('약속 잡기는 복수 선택 설정을 바꿀 수 없습니다.')
    }
    const wanted = reqBool(body.multiSelect, '복수 선택')
    next.multiSelect = wanted
  }

  if (body.options !== undefined) {
    if (poll.pollType === POLL_TYPE.APPOINTMENT) throw bad('약속 잡기에는 항목 목록이 없습니다.')
    const keepIds = new Set((poll.options || []).map((o) => o.id))
    const { options, nextOptionSeq } = validOptions(
      poll.pollType,
      body.options,
      poll.nextOptionSeq || 1,
      keepIds,
    )
    const nextIds = new Set(options.map((o) => o.id))
    const removed = [...keepIds].filter((id) => !nextIds.has(id))
    if (removed.length > 0) warnings.push(`항목 ${removed.length}개를 삭제했습니다.`)
    next.options = options
    next.nextOptionSeq = nextOptionSeq
  }

  if (body.appointment !== undefined) {
    if (poll.pollType !== POLL_TYPE.APPOINTMENT) throw bad('이 투표에는 기간 설정이 없습니다.')
    next.appointment = validAppointment(body.appointment)
  }

  let newPassword = null
  if (body.password !== undefined) {
    newPassword = reqString(body.password, '비밀번호', LIMITS.PASSWORD_MIN, LIMITS.PASSWORD_MAX)
  }

  next.rev = poll.rev + 1
  next.updatedAt = Date.now()
  return { next, warnings, newPassword }
}
