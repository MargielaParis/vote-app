import { useMemo } from 'react'
import { POLL_TYPE, RESULT_VISIBILITY } from '@shared/enums.js'
import { buildGrid } from '@shared/slots.js'
import { ResultBars, ParticipantList } from './ResultBars.jsx'
import { AppointmentHeatmap, BestWindows, DaySummary } from './AppointmentHeatmap.jsx'

const LOCK_MESSAGE = {
  [RESULT_VISIBILITY.AFTER_VOTE]: '투표하면 결과를 볼 수 있습니다.',
  [RESULT_VISIBILITY.AFTER_DEADLINE]: '마감된 뒤에 결과가 공개됩니다.',
  [RESULT_VISIBILITY.CREATOR_ONLY]: '만든 사람만 결과를 볼 수 있습니다.',
}

export function ResultsLocked({ reason, totalVoters }) {
  return (
    <div className="card">
      <h2 className="card-title">결과</h2>
      <div className="notice">
        {LOCK_MESSAGE[reason] || '아직 결과를 볼 수 없습니다.'}
        <br />
        지금까지 <strong>{totalVoters}명</strong>이 참여했습니다.
      </div>
    </div>
  )
}

export function ResultsView({ poll, results }) {
  const grid = useMemo(
    () => (poll.pollType === POLL_TYPE.APPOINTMENT ? buildGrid(poll.appointment) : null),
    [poll],
  )

  if (poll.pollType !== POLL_TYPE.APPOINTMENT) {
    return (
      <>
        <div className="card">
          <div className="row-between" style={{ marginBottom: 14 }}>
            <h2 className="card-title" style={{ marginBottom: 0 }}>
              결과
            </h2>
            <span className="badge">{results.totalVoters}명 참여</span>
          </div>
          {results.totalVoters === 0 ? (
            <p className="muted">아직 참여자가 없습니다.</p>
          ) : (
            <ResultBars poll={poll} results={results} />
          )}
        </div>
        {results.participants && (
          <div className="card">
            <h2 className="card-title">참여자</h2>
            <p className="card-sub">
              {results.optionVoters
                ? '누가 무엇을 골랐는지 위에 함께 표시됩니다.'
                : '누가 무엇을 골랐는지는 공개되지 않습니다.'}
            </p>
            <ParticipantList names={results.participants} />
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="card">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <h2 className="card-title" style={{ marginBottom: 0 }}>
            언제가 좋을까
          </h2>
          <span className="badge">{results.totalVoters}명 참여</span>
        </div>
        <BestWindows best={results.best} total={results.totalVoters} />
      </div>

      <div className="card">
        <h2 className="card-title">겹치는 시간</h2>
        <p className="card-sub">진할수록 가능한 사람이 많습니다. 테두리는 전원 가능입니다.</p>
        <AppointmentHeatmap grid={grid} tz={poll.appointment.tz} results={results} />
      </div>

      <div className="card">
        <h2 className="card-title">날짜별 요약</h2>
        <p className="card-sub">그 날 안에서 모두가 가능한 시간이 얼마나 되는지.</p>
        <DaySummary daySummary={results.daySummary} total={results.totalVoters} />
      </div>

      {results.participants && (
        <div className="card">
          <h2 className="card-title">참여자</h2>
          <ParticipantList names={results.participants} />
        </div>
      )}
    </>
  )
}
