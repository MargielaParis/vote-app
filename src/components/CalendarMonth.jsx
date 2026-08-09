import { useMemo, useState } from 'react'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const pad2 = (n) => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`

function todayIso() {
  const t = new Date()
  return iso(t.getFullYear(), t.getMonth() + 1, t.getDate())
}

/** 여러 날짜를 고르는 달력. 날짜 값은 전부 'YYYY-MM-DD' 문자열이다. */
export function CalendarMonth({ selected, onToggle, minIso = todayIso(), maxIso }) {
  const [cursor, setCursor] = useState(() => {
    const first = [...selected][0]
    const base = first ? new Date(`${first}T00:00`) : new Date()
    return { year: base.getFullYear(), month: base.getMonth() + 1 }
  })

  const cells = useMemo(() => {
    const { year, month } = cursor
    const firstDow = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const out = []
    for (let i = 0; i < firstDow; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) out.push(d)
    return out
  }, [cursor])

  const shift = (delta) => {
    setCursor((c) => {
      const next = c.month + delta
      if (next < 1) return { year: c.year - 1, month: 12 }
      if (next > 12) return { year: c.year + 1, month: 1 }
      return { year: c.year, month: next }
    })
  }

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="이전 달">
          ‹
        </button>
        <span>
          {cursor.year}년 {cursor.month}월
        </span>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="다음 달">
          ›
        </button>
      </div>
      <div className="calendar-grid" role="grid">
        {DOW.map((d) => (
          <div key={d} className="calendar-dow">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />
          const value = iso(cursor.year, cursor.month, day)
          const disabled = (minIso && value < minIso) || (maxIso && value > maxIso)
          const on = selected.has(value)
          const isSun = i % 7 === 0
          return (
            <button
              key={value}
              type="button"
              className={`calendar-cell${on ? ' is-on' : ''}${isSun ? ' is-sun' : ''}`}
              disabled={disabled}
              aria-pressed={on}
              onClick={() => onToggle(value)}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
