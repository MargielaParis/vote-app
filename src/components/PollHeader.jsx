import { Link } from 'react-router-dom'
import { POLL_TYPE, POLL_TYPE_LABEL, RESULT_VISIBILITY_LABEL } from '@shared/enums.js'
import { Countdown } from './Countdown.jsx'
import { formatDeadline } from '@/lib/datetime.js'

export function PollHeader({ poll, totalVoters, isAdmin }) {
  return (
    <header style={{ margin: '10px 0 18px' }}>
      <div className="row-between">
        <h1 className="poll-title">{poll.title}</h1>
        {isAdmin && (
          <Link to={`/p/${poll.id}/manage`} className="btn btn--sm">
            관리
          </Link>
        )}
      </div>
      {poll.description && <p className="poll-desc">{poll.description}</p>}
      <div className="badges">
        <span className="badge badge--accent">{POLL_TYPE_LABEL[poll.pollType]}</span>
        <Countdown deadline={poll.deadline} />
        <span className="badge">{totalVoters}명 참여</span>
        <span className="badge">{poll.anonymous ? '익명' : '기명'}</span>
        {poll.pollType !== POLL_TYPE.APPOINTMENT && (
          <span className="badge">{poll.multiSelect ? '여러 개 선택' : '하나만 선택'}</span>
        )}
        <span className="badge">{poll.allowRevote ? '수정 가능' : '한 번만'}</span>
        <span className="badge">{RESULT_VISIBILITY_LABEL[poll.resultVisibility]}</span>
      </div>
      <p className="faint" style={{ marginTop: 8 }}>
        마감 {formatDeadline(poll.deadline)}
      </p>
    </header>
  )
}
