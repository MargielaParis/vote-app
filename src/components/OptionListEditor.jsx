import { useRef } from 'react'
import { LIMITS } from '@shared/limits.js'

/** 항목마다 안정적인 id를 유지한다. 배열 인덱스로 다루면 나중에 편집이 불가능해진다. */
export function OptionListEditor({ items, onChange, disabled }) {
  const inputs = useRef([])

  const setLabel = (i, label) => {
    const next = items.slice()
    next[i] = { ...next[i], label }
    onChange(next)
  }

  const add = () => {
    if (items.length >= LIMITS.OPTIONS_MAX) return
    onChange([...items, { key: crypto.randomUUID(), label: '' }])
    requestAnimationFrame(() => inputs.current[items.length]?.focus())
  }

  const remove = (i) => {
    if (items.length <= LIMITS.OPTIONS_MIN) return
    onChange(items.filter((_, idx) => idx !== i))
  }

  const onKeyDown = (e, i) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (i === items.length - 1) add()
      else inputs.current[i + 1]?.focus()
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {items.map((item, i) => (
        <div className="option-row" key={item.key || item.id}>
          <input
            ref={(el) => (inputs.current[i] = el)}
            className="input"
            value={item.label}
            maxLength={LIMITS.OPTION_LABEL_MAX}
            placeholder={`항목 ${i + 1}`}
            disabled={disabled}
            onChange={(e) => setLabel(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            aria-label={`항목 ${i + 1}`}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => remove(i)}
            disabled={disabled || items.length <= LIMITS.OPTIONS_MIN}
            aria-label={`항목 ${i + 1} 삭제`}
            title="삭제"
          >
            ×
          </button>
        </div>
      ))}
      <div className="row-between">
        <button
          type="button"
          className="btn btn--sm"
          onClick={add}
          disabled={disabled || items.length >= LIMITS.OPTIONS_MAX}
        >
          + 항목 추가
        </button>
        <span className="faint">
          {items.length} / {LIMITS.OPTIONS_MAX}
        </span>
      </div>
    </div>
  )
}
