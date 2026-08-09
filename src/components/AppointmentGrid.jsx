import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isRowSelected, slotKey } from '@shared/slots.js'
import { timezoneLabel } from '@/lib/datetime.js'
import { useDragSelect } from '@/hooks/useDragSelect.js'

const MIN_COL_PX = 46
const TIME_COL_PX = 48

// 원시 props 만 받는다. 드래그 중 바뀌지 않은 칸은 React 가 알아서 건너뛴다.
const Cell = memo(function Cell({ on, hourStart, last }) {
  return (
    <div
      className={`appt-cell${on ? ' is-on' : ''}${hourStart ? ' is-hour' : ''}${last ? ' is-last' : ''}`}
      aria-hidden="true"
    />
  )
})

/** 열이 몇 개나 들어가는지 재서, 좁은 화면에서는 날짜를 나눠 보여준다. */
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

export function AppointmentGrid({ grid, tz, selected, onChange, disabled }) {
  const wrapRef = useRef(null)
  const perPage = useVisibleCount(wrapRef, grid.days.length)
  const [page, setPage] = useState(0)

  const pages = Math.max(1, Math.ceil(grid.days.length / perPage))
  const safePage = Math.min(page, pages - 1)
  const days = useMemo(
    () => grid.days.slice(safePage * perPage, safePage * perPage + perPage),
    [grid.days, safePage, perPage],
  )

  const isSelected = useCallback(
    (col, row) => {
      const day = days[col]
      const gridRow = grid.rows[row]
      // 드래그 도중 화면이 줄어 열 수가 바뀔 수 있다
      return day && gridRow ? isRowSelected(selected, day.key, gridRow) : false
    },
    [selected, days, grid.rows],
  )

  const onCommit = useCallback(
    ({ c0, c1, r0, r1, mode }) => {
      const next = new Set(selected)
      for (let c = c0; c <= c1; c++) {
        const day = days[c]
        if (!day) continue
        for (let r = r0; r <= r1; r++) {
          if (!grid.rows[r]) continue
          for (const bucket of grid.rows[r].buckets) {
            const key = slotKey(day.key, bucket)
            if (mode === 'paint') next.add(key)
            else next.delete(key)
          }
        }
      }
      onChange(next)
    },
    [selected, days, grid.rows, onChange],
  )

  const { gridRef, preview, previewCovers, handlers } = useDragSelect({
    cols: days.length,
    rows: grid.rows.length,
    isSelected,
    onCommit,
    disabled,
  })

  const setRange = (dayList, on) => {
    const next = new Set(selected)
    for (const day of dayList) {
      for (const row of grid.rows) {
        for (const bucket of row.buckets) {
          const key = slotKey(day.key, bucket)
          if (on) next.add(key)
          else next.delete(key)
        }
      }
    }
    onChange(next)
  }

  const toggleDay = (day) => {
    if (disabled) return
    setRange([day], !grid.rows.every((row) => isRowSelected(selected, day.key, row)))
  }

  const toggleAll = () => {
    if (disabled) return
    const allOn = grid.days.every((day) =>
      grid.rows.every((row) => isRowSelected(selected, day.key, row)),
    )
    setRange(grid.days, !allOn)
  }

  const cellH = grid.slotMinutes >= 60 ? 30 : 22

  return (
    <div className="appt" ref={wrapRef}>
      <div className="row-between appt-toolbar">
        <span className="faint">
          기준 시간대 {timezoneLabel(tz)} · 드래그하면 칠해지고, 칠해진 칸에서 시작하면 지워집니다
        </span>
        <button type="button" className="btn btn--sm" onClick={toggleAll} disabled={disabled}>
          전체 선택 / 해제
        </button>
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
            <button
              key={day.key}
              type="button"
              className={`appt-day${day.weekday === 0 ? ' is-sun' : ''}${day.weekday === 6 ? ' is-sat' : ''}`}
              onClick={() => toggleDay(day)}
              disabled={disabled}
              title={`${day.label} 전체 선택 / 해제`}
            >
              <span className="appt-day-dow">{day.weekdayKo}</span>
              <span className="appt-day-num">{day.date}</span>
            </button>
          ))}
        </div>

        <div className="appt-timecol">
          {grid.rows.map((row) => (
            <div key={row.minute} className="appt-time">
              {row.minute % 60 === 0 ? row.label : ''}
            </div>
          ))}
        </div>

        <div
          className={`appt-body${disabled ? ' is-disabled' : ''}`}
          ref={gridRef}
          role="group"
          aria-label="가능한 시간 선택"
          {...(disabled ? {} : handlers)}
        >
          {grid.rows.map((row, ri) =>
            days.map((day, ci) => (
              <Cell
                key={`${day.key}-${row.minute}`}
                on={previewCovers(ci, ri) ? preview.mode === 'paint' : isSelected(ci, ri)}
                hourStart={row.isHourStart}
                last={ci === days.length - 1}
              />
            )),
          )}
        </div>
      </div>
    </div>
  )
}
