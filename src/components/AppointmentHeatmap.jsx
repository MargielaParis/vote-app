import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { dayKeyToIso } from '@shared/slots.js'
import { formatIsoDate, minuteLabel, timezoneLabel } from '@/lib/datetime.js'

const MIN_COL_PX = 46
const TIME_COL_PX = 48
const STEPS = 5

/** 연속 그라데이션 대신 5단계 이산 램프. 범례를 붙일 수 있고 읽기도 쉽다. */
function heatLevel(count, max) {
  if (count <= 0 || max <= 0) return 0
  return Math.max(1, Math.ceil((count / max) * (STEPS - 1)))
}

const HeatCell = memo(function HeatCell({ level, everyone, hourStart, last, active, label }) {
  return (
    <div
      className={`heat-cell heat-${level}${everyone ? ' is-all' : ''}${hourStart ? ' is-hour' : ''}${
        last ? ' is-last' : ''
      }${active ? ' is-active' : ''}`}
      title={label}
      data-label={label}
    />
  )
})

function useVisibleCount(ref, total) {
  const [count, setCount] = useState(total)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const width = el.clientWidth - TIME_COL_PX
      setCount(Math.min(total, Math.max(3, Math.floor(width / MIN_COL_PX))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, total])
  return count
}

export function AppointmentHeatmap({ grid, tz, results }) {
  const wrapRef = useRef(null)
  const perPage = useVisibleCount(wrapRef, grid.days.length)
  const [page, setPage] = useState(0)
  const [focus, setFocus] = useState(null)

  const pages = Math.max(1, Math.ceil(grid.days.length / perPage))
  const safePage = Math.min(page, pages - 1)
  const days = useMemo(
    () => grid.days.slice(safePage * perPage, safePage * perPage + perPage),
    [grid.days, safePage, perPage],
  )

  const total = results.totalVoters
  const max = results.maxCount || 0
  const cellH = grid.slotMinutes >= 60 ? 30 : 22
  const names = results.participants

  const pick = (dayKey, rowIndex) => {
    const count = results.counts[dayKey]?.[rowIndex] ?? 0
    const idx = results.cellVoters?.[dayKey]?.[rowIndex] || null
    setFocus({
      dayKey,
      rowIndex,
      count,
      available: idx && names ? idx.map((i) => names[i]) : null,
      missing: idx && names ? names.filter((_, i) => !idx.includes(i)) : null,
    })
  }

  return (
    <div className="appt" ref={wrapRef}>
      <div className="row-between appt-toolbar">
        <span className="faint">기준 시간대 {timezoneLabel(tz)}</span>
        <div className="heat-legend" aria-label="색 범례">
          <span className="faint">0명</span>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`heat-swatch heat-${i}`} />
          ))}
          <span className="faint">{total}명</span>
        </div>
      </div>

      {pages > 1 && (
        <div className="row-between appt-pager">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
          >
            ‹ 이전
          </button>
          <span className="faint">
            {days[0].label} – {days[days.length - 1].label} ({safePage + 1}/{pages})
          </span>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setPage(Math.min(pages - 1, safePage + 1))}
            disabled={safePage >= pages - 1}
          >
            다음 ›
          </button>
        </div>
      )}

      <div className="appt-layout" style={{ '--cols': days.length, '--cell-h': `${cellH}px` }}>
        <div className="appt-corner" />
        <div className="appt-daybar">
          {days.map((day) => (
            <div
              key={day.key}
              className={`appt-day is-static${day.weekday === 0 ? ' is-sun' : ''}${
                day.weekday === 6 ? ' is-sat' : ''
              }`}
            >
              <span className="appt-day-dow">{day.weekdayKo}</span>
              <span className="appt-day-num">{day.date}</span>
            </div>
          ))}
        </div>

        <div className="appt-timecol">
          {grid.rows.map((row) => (
            <div key={row.minute} className="appt-time">
              {row.minute % 60 === 0 ? row.label : ''}
            </div>
          ))}
        </div>

        <div className="appt-body heat-body">
          {grid.rows.map((row, ri) =>
            days.map((day, ci) => {
              const count = results.counts[day.key]?.[ri] ?? 0
              return (
                <button
                  key={`${day.key}-${row.minute}`}
                  type="button"
                  className="heat-hit"
                  onClick={() => pick(day.key, ri)}
                  onMouseEnter={() => pick(day.key, ri)}
                  aria-label={`${formatIsoDate(dayKeyToIso(day.key))} ${row.rangeLabel} ${count}명 가능`}
                >
                  <HeatCell
                    level={heatLevel(count, max)}
                    everyone={total > 0 && count === total}
                    hourStart={row.isHourStart}
                    last={ci === days.length - 1}
                    active={focus?.dayKey === day.key && focus?.rowIndex === ri}
                    label={`${count}명`}
                  />
                </button>
              )
            }),
          )}
        </div>
      </div>

      <div className="heat-detail">
        {focus ? (
          <>
            <div className="row-between">
              <strong>
                {formatIsoDate(dayKeyToIso(focus.dayKey))} {grid.rows[focus.rowIndex].rangeLabel}
              </strong>
              <span
                className={focus.count === total && total > 0 ? 'badge badge--accent' : 'badge'}
              >
                {focus.count} / {total}명
              </span>
            </div>
            {focus.available && (
              <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                <div className="row" style={{ gap: 6 }}>
                  <span className="faint" style={{ minWidth: 48 }}>
                    가능
                  </span>
                  {focus.available.length ? (
                    focus.available.map((n, i) => (
                      <span key={`${n}-${i}`} className="chip">
                        {n}
                      </span>
                    ))
                  ) : (
                    <span className="faint">없음</span>
                  )}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <span className="faint" style={{ minWidth: 48 }}>
                    불가능
                  </span>
                  {focus.missing.length ? (
                    focus.missing.map((n, i) => (
                      <span key={`${n}-${i}`} className="chip">
                        {n}
                      </span>
                    ))
                  ) : (
                    <span className="faint">없음</span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <span className="faint">칸을 누르면 누가 가능한지 볼 수 있습니다.</span>
        )}
      </div>
    </div>
  )
}

export function BestWindows({ best, total }) {
  if (!best?.length) return <p className="muted">아직 겹치는 시간이 없습니다.</p>
  return (
    <ol className="stack" style={{ gap: 10 }}>
      {best.map((w, i) => (
        <li key={`${w.dayKey}-${w.startMinute}`} className="result-item">
          <div className="result-head">
            <span className="result-name">
              <span className="best-rank">{i + 1}</span>
              {formatIsoDate(w.date)} {minuteLabel(w.startMinute)}–{minuteLabel(w.endMinute)}
            </span>
            <span className={w.count === total ? 'badge badge--accent' : 'badge'}>
              {w.count === total ? `전원 ${w.count}명` : `${w.count}명`}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function DaySummary({ daySummary, total }) {
  const useful = daySummary.filter((d) => d.best > 0)
  if (!useful.length) return <p className="muted">아직 표시할 날이 없습니다.</p>
  return (
    <ul className="stack" style={{ gap: 8 }}>
      {useful.map((d) => (
        <li key={d.dayKey} className="row-between day-summary-row">
          <span>{formatIsoDate(d.date)}</span>
          <span className="row" style={{ gap: 6 }}>
            {d.allAvailableSlots > 0 ? (
              <span className="badge badge--accent">
                전원 가능{' '}
                {d.allAvailableMinutes >= 60
                  ? `${Math.floor(d.allAvailableMinutes / 60)}시간${d.allAvailableMinutes % 60 ? ` ${d.allAvailableMinutes % 60}분` : ''}`
                  : `${d.allAvailableMinutes}분`}
              </span>
            ) : (
              <span className="badge">최대 {d.best}명</span>
            )}
            <span className="faint">/ {total}명</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
