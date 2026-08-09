import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastContext } from '@/lib/toastContext.js'

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const seq = useRef(0)

  const push = useCallback((message, tone) => {
    const id = ++seq.current
    setItems((prev) => [...prev, { id, message, tone }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200)
  }, [])

  const value = useMemo(
    () => ({ show: (m) => push(m, 'info'), error: (m) => push(m, 'error') }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={t.tone === 'error' ? 'toast toast--error' : 'toast'}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
