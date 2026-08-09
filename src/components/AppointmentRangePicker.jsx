import { LIMITS } from '@shared/limits.js'
import { SLOT_MINUTES_CHOICES } from '@shared/enums.js'
import { buildGrid, isoToDayNum } from '@shared/slots.js'
import { minuteLabel, timezoneLabel } from '@/lib/datetime.js'
import { Field } from './Field.jsx'

const TIME_OPTIONS = Array.from({ length: 49 }, (_, i) => i * 30)

export function AppointmentRangePicker({ value, onChange, disabled }) {
  const set = (patch) => onChange({ ...value, ...patch })

  const days =
    isoToDayNum(value.endDate) !== null && isoToDayNum(value.startDate) !== null
      ? isoToDayNum(value.endDate) - isoToDayNum(value.startDate) + 1
      : 0
  const valid = days > 0 && days <= LIMITS.APPT_DAYS_MAX && value.endMinute > value.startMinute
  const grid = valid ? buildGrid(value) : null

  return (
    <div className="stack">
      <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
        <Field label="시작 날짜">
          <input
            type="date"
            className="input"
            value={value.startDate}
            disabled={disabled}
            onChange={(e) => {
              const startDate = e.target.value
              set({ startDate, endDate: startDate > value.endDate ? startDate : value.endDate })
            }}
          />
        </Field>
        <Field label="종료 날짜">
          <input
            type="date"
            className="input"
            value={value.endDate}
            min={value.startDate}
            disabled={disabled}
            onChange={(e) => set({ endDate: e.target.value })}
          />
        </Field>
      </div>

      <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
        <Field label="하루 시작 시각">
          <select
            className="select"
            value={value.startMinute}
            disabled={disabled}
            onChange={(e) => {
              const startMinute = Number(e.target.value)
              set({
                startMinute,
                endMinute:
                  startMinute >= value.endMinute
                    ? Math.min(1440, startMinute + 60)
                    : value.endMinute,
              })
            }}
          >
            {TIME_OPTIONS.slice(0, -1).map((m) => (
              <option key={m} value={m}>
                {minuteLabel(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="하루 종료 시각">
          <select
            className="select"
            value={value.endMinute}
            disabled={disabled}
            onChange={(e) => set({ endMinute: Number(e.target.value) })}
          >
            {TIME_OPTIONS.filter((m) => m > value.startMinute).map((m) => (
              <option key={m} value={m}>
                {m === 1440 ? '24:00' : minuteLabel(m)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="칸 단위">
        <div className="row" style={{ gap: 8 }}>
          {SLOT_MINUTES_CHOICES.map((m) => (
            <button
              key={m}
              type="button"
              className={value.slotMinutes === m ? 'btn btn--primary btn--sm' : 'btn btn--sm'}
              disabled={disabled}
              onClick={() => set({ slotMinutes: m })}
            >
              {m}분
            </button>
          ))}
        </div>
      </Field>

      <p className="faint">
        {valid
          ? `${days}일 × ${grid.rows.length}칸 = ${grid.slotCount}칸 · 시간대 ${timezoneLabel(value.tz)}`
          : days > LIMITS.APPT_DAYS_MAX
            ? `기간은 최대 ${LIMITS.APPT_DAYS_MAX}일까지입니다. (지금 ${days}일)`
            : '기간과 시간 범위를 확인해 주세요.'}
      </p>
    </div>
  )
}
