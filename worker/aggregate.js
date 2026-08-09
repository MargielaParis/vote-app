import { POLL_TYPE, NAME_DISCLOSURE, RESULT_VISIBILITY } from '@shared/enums.js'
import { buildGrid, decodeMasks, isRowAvailable, dayKeyToIso } from '@shared/slots.js'
import { listBallots, getBallot } from './store.js'
import { fromMetadata, fromStored, sortRecords } from './ballot.js'
import { memoGet, memoSet } from './memo.js'

/** 표 레코드 전체를 읽는다. 메모가 살아 있으면 KV list 를 하지 않는다. */
export async function loadRecords(env, poll) {
  let records = memoGet(poll.id)

  if (!records) {
    const entries = await listBallots(env, poll.id)
    const list = []
    const heavy = []
    for (const entry of entries) {
      const rec = fromMetadata(entry.voterKey, entry.meta, poll.pollType)
      if (rec) list.push(rec)
      else heavy.push(entry)
    }
    if (heavy.length > 0) {
      const fetched = await Promise.all(heavy.map((e) => getBallot(env, poll.id, e.voterKey)))
      fetched.forEach((stored, i) => {
        const rec = fromStored(heavy[i].voterKey, stored, poll.pollType)
        if (rec) list.push(rec)
      })
    }
    records = sortRecords(list)
    memoSet(poll.id, records)
  }
  return records
}

/**
 * 방금 쓴(또는 지운) 표를 목록에 강제로 반영한다.
 *
 * KV 쓰기는 같은 지역에선 즉시 보이지만 다른 지역은 최대 60초 걸린다.
 * list 결과에 내 표가 나타나기를 기다리지 않고 직접 덮어써서
 * "내 표는 항상 즉시 보인다"를 확률이 아니라 보장으로 만든다.
 * 동시에, 다시 list 하지 않으므로 무료 플랜의 list 예산(1000/일)도 아낀다.
 */
export function withOverride(records, override) {
  const rest = records.filter((r) => r.voterKey !== override.voterKey)
  return override.deleted ? rest : sortRecords([...rest, override])
}

export function resultsVisible(poll, { isAdmin, hasVoted }) {
  if (isAdmin) return true
  if (poll.resultVisibility === RESULT_VISIBILITY.AFTER_VOTE) return Boolean(hasVoted)
  if (poll.resultVisibility === RESULT_VISIBILITY.AFTER_DEADLINE) return Date.now() > poll.deadline
  return false
}

function disclosure(poll) {
  const showNames = !poll.anonymous
  return { showNames, showPicks: showNames && poll.nameDisclosure === NAME_DISCLOSURE.FULL }
}

/* ---------- 자유 문항 / 날짜 선택 ---------- */

function computeChoiceResults(poll, records) {
  const { showNames, showPicks } = disclosure(poll)
  const options = poll.options || []
  const counts = new Map(options.map((o) => [o.id, 0]))
  const voters = new Map(options.map((o) => [o.id, []]))

  records.forEach((rec, index) => {
    for (const id of rec.choices || []) {
      // 생성자가 지운 항목은 조용히 무시한다. 표를 다시 쓰지 않기 위한 선택.
      if (!counts.has(id)) continue
      counts.set(id, counts.get(id) + 1)
      voters.get(id).push(index)
    }
  })

  const max = Math.max(0, ...options.map((o) => counts.get(o.id)))
  return {
    type: poll.pollType,
    totalVoters: records.length,
    options: options.map((o) => ({
      id: o.id,
      count: counts.get(o.id),
      leading: max > 0 && counts.get(o.id) === max,
    })),
    optionVoters: showPicks
      ? Object.fromEntries(options.map((o) => [o.id, voters.get(o.id)]))
      : null,
    participants: showNames ? records.map((r) => r.name || '(이름 없음)') : null,
  }
}

/* ---------- 약속 잡기 ---------- */

function bestWindows(grid, counts, topN = 3) {
  const runs = []
  for (const day of grid.days) {
    const row = counts[day.key]
    let i = 0
    while (i < grid.rows.length) {
      const c = row[i]
      if (c === 0) {
        i += 1
        continue
      }
      let j = i
      while (j + 1 < grid.rows.length && row[j + 1] === c) j += 1
      runs.push({
        dayKey: day.key,
        date: day.iso,
        startMinute: grid.rows[i].minute,
        endMinute: grid.rows[j].endMinute,
        count: c,
        slots: j - i + 1,
      })
      i = j + 1
    }
  }
  runs.sort(
    (a, b) =>
      b.count - a.count ||
      b.endMinute - b.startMinute - (a.endMinute - a.startMinute) ||
      a.dayKey.localeCompare(b.dayKey) ||
      a.startMinute - b.startMinute,
  )
  return runs.slice(0, topN)
}

function computeAppointmentResults(poll, records) {
  const { showNames, showPicks } = disclosure(poll)
  const grid = buildGrid(poll.appointment)
  const total = records.length

  const counts = {}
  const cellVoters = {}
  for (const day of grid.days) {
    counts[day.key] = new Array(grid.rows.length).fill(0)
    cellVoters[day.key] = grid.rows.map(() => [])
  }

  records.forEach((rec, index) => {
    const byDay = decodeMasks(rec.masks)
    if (byDay.size === 0) return
    for (const day of grid.days) {
      const bytes = byDay.get(day.key)
      if (!bytes) continue
      for (let ri = 0; ri < grid.rows.length; ri++) {
        if (isRowAvailable(bytes, grid.rows[ri])) {
          counts[day.key][ri] += 1
          cellVoters[day.key][ri].push(index)
        }
      }
    }
  })

  const daySummary = grid.days.map((day) => {
    const row = counts[day.key]
    const best = row.length ? Math.max(...row) : 0
    const allSlots = total > 0 ? row.filter((c) => c === total).length : 0
    return {
      dayKey: day.key,
      date: dayKeyToIso(day.key),
      best,
      allAvailableSlots: allSlots,
      allAvailableMinutes: allSlots * grid.slotMinutes,
    }
  })

  return {
    type: POLL_TYPE.APPOINTMENT,
    totalVoters: total,
    counts,
    cellVoters: showPicks ? cellVoters : null,
    participants: showNames ? records.map((r) => r.name || '(이름 없음)') : null,
    best: bestWindows(grid, counts),
    daySummary,
    maxCount: Math.max(0, ...Object.values(counts).flatMap((row) => row)),
  }
}

export function computeResults(poll, records) {
  return poll.pollType === POLL_TYPE.APPOINTMENT
    ? computeAppointmentResults(poll, records)
    : computeChoiceResults(poll, records)
}
