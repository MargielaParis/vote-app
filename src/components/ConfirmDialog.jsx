import { useEffect, useRef } from 'react'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  tone,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <div className="dialog-body">
        <h2 className="dialog-title">{title}</h2>
        {message && <p className="muted">{message}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
