import { formatDeadline, formatRemaining } from '@/lib/datetime.js'
import { useNow } from '@/hooks/useNow.js'

export function Countdown({ deadline }) {
  const now = useNow()
  const closed = now > deadline
  return (
    <span className={closed ? 'badge badge--danger' : 'badge'}>
      {closed ? '마감됨' : formatRemaining(deadline, now)}
      <span className="sr-only">, 마감 {formatDeadline(deadline)}</span>
    </span>
  )
}
