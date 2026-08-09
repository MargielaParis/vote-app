import { LIMITS } from '@shared/limits.js'
import { POLL_TYPE } from '@shared/enums.js'

const encoder = new TextEncoder()

/**
 * 표를 KV 메타데이터로 압축한다. 결과 집계는 list() 응답의 메타데이터만 읽으므로
 * 투표자 수와 상관없이 KV 연산 1회로 끝난다.
 * 메타데이터 한도는 1024바이트. 넘치면 big 플래그만 남기고 집계기가 그 표만 get()으로 가져온다.
 */
export function toMetadata(ballot) {
  const meta = { v: 1, t: ballot.updatedAt }
  if (ballot.name) meta.n = ballot.name
  if (ballot.owner) meta.w = ballot.owner
  if (ballot.masks) meta.d = ballot.masks
  else meta.o = ballot.choices || []

  if (encoder.encode(JSON.stringify(meta)).byteLength > LIMITS.METADATA_SOFT_MAX) {
    const small = { v: 1, t: meta.t, big: true }
    if (meta.n) small.n = meta.n
    if (meta.w) small.w = meta.w
    return small
  }
  return meta
}

/** @returns 표 레코드, 또는 값을 직접 읽어야 하면 null */
export function fromMetadata(voterKey, meta, pollType) {
  if (!meta || meta.v !== 1 || meta.big) return null
  const appt = pollType === POLL_TYPE.APPOINTMENT
  return {
    voterKey,
    name: meta.n || null,
    owner: meta.w || null,
    updatedAt: meta.t || 0,
    choices: appt ? null : meta.o || [],
    masks: appt ? meta.d || {} : null,
  }
}

export function fromStored(voterKey, stored, pollType) {
  if (!stored) return null
  const appt = pollType === POLL_TYPE.APPOINTMENT
  return {
    voterKey,
    name: stored.name || null,
    owner: stored.owner || null,
    updatedAt: stored.updatedAt || 0,
    choices: appt ? null : stored.choices || [],
    masks: appt ? stored.masks || {} : null,
  }
}

export function sortRecords(list) {
  return list.sort((a, b) => a.updatedAt - b.updatedAt || a.voterKey.localeCompare(b.voterKey))
}
