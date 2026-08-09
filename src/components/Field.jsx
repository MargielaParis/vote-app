import { useId } from 'react'

export function Field({ label, hint, error, count, children }) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      {children}
      <div className="row-between">
        {error ? (
          <span className="field-error">{error}</span>
        ) : hint ? (
          <span className="field-hint">{hint}</span>
        ) : (
          <span />
        )}
        {count && <span className="char-count">{count}</span>}
      </div>
    </div>
  )
}

/** 라디오/체크박스 카드. 라벨 전체가 클릭 영역이다. */
export function ChoiceCard({ type, name, checked, onChange, title, desc, disabled }) {
  const id = useId()
  return (
    <label className={checked ? 'choice is-on' : 'choice'} htmlFor={id}>
      <input
        id={id}
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="choice-body">
        <span className="choice-name">{title}</span>
        {desc && <span className="choice-desc">{desc}</span>}
      </span>
    </label>
  )
}
