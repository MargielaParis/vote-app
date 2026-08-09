import { POLL_TYPE } from '@shared/enums.js'
import { formatIsoDate } from '@/lib/datetime.js'

export function ResultBars({ poll, results }) {
  const total = results.totalVoters
  const max = Math.max(1, ...results.options.map((o) => o.count))
  const byId = new Map((poll.options || []).map((o) => [o.id, o]))
  const names = results.participants

  return (
    <ul className="result-list">
      {results.options.map((row) => {
        const option = byId.get(row.id)
        if (!option) return null
        const label =
          poll.pollType === POLL_TYPE.DATE
            ? formatIsoDate(option.date, { withYear: true })
            : option.label
        const voters = results.optionVoters?.[row.id]
        const percent = total > 0 ? Math.round((row.count / total) * 100) : 0
        return (
          <li
            key={row.id}
            className={row.leading && row.count > 0 ? 'result-item is-leading' : 'result-item'}
          >
            <div className="result-head">
              <span className="result-name">{label}</span>
              <span className="result-count">
                {row.count}표 · {percent}%
              </span>
            </div>
            <div className="result-bar">
              <span style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
            {voters && voters.length > 0 && names && (
              <div className="result-voters">
                {voters.map((i) => (
                  <span key={i} className="chip">
                    {names[i]}
                  </span>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function ParticipantList({ names }) {
  if (!names) return null
  return (
    <div className="result-voters" style={{ marginTop: 4 }}>
      {names.length === 0 ? (
        <span className="faint">아직 참여자가 없습니다.</span>
      ) : (
        names.map((n, i) => (
          <span key={`${n}-${i}`} className="chip">
            {n}
          </span>
        ))
      )}
    </div>
  )
}
