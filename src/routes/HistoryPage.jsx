import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '@/components/Layout.jsx'
import { PageMeta } from '@/components/PageMeta.jsx'
import {
  AppointmentPollIcon,
  ArrowRightIcon,
  DatePollIcon,
  DeviceIcon,
  HistoryIcon,
  TextPollIcon,
  TrashIcon,
} from '@/components/Icons.jsx'
import { useToast } from '@/lib/toastContext.js'
import { api, ApiError } from '@/lib/api.js'
import { useNow } from '@/hooks/useNow.js'
import { hasPersistentStorage } from '@/lib/voterToken.js'
import {
  clearPollHistory,
  forgetPoll,
  getPollHistory,
  markPollUnavailable,
  migrateLegacyPollHistory,
  rememberPoll,
  subscribePollHistory,
} from '@/lib/pollHistory.js'
import { POLL_TYPE, POLL_TYPE_LABEL } from '@shared/enums.js'

const TYPE_ICONS = {
  [POLL_TYPE.TEXT]: TextPollIcon,
  [POLL_TYPE.DATE]: DatePollIcon,
  [POLL_TYPE.APPOINTMENT]: AppointmentPollIcon,
}

const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' })

function formatLastOpened(value) {
  return value ? `${dateFormat.format(value)}에 열어봄` : '이전 접속 기록에서 복원됨'
}

function HistoryCard({ entry, onForget, now }) {
  const Icon = TYPE_ICONS[entry.pollType] || HistoryIcon
  const isCreator = entry.roles.includes('creator')
  const isVoter = entry.roles.includes('voter')
  const closed = entry.deadline && entry.deadline < now
  const unavailable = entry.unavailable

  return (
    <article className="history-card">
      <span className="history-card-icon">
        <Icon size={22} />
      </span>
      <div className="history-card-copy">
        <div className="history-card-badges">
          {isCreator && <span className="history-role history-role--creator">만든 투표</span>}
          {isVoter && <span className="history-role">참여함</span>}
          {closed && <span className="history-role history-role--closed">마감</span>}
          {unavailable && <span className="history-role history-role--closed">접근할 수 없음</span>}
        </div>
        <h3>
          {entry.title || (unavailable ? '삭제되었거나 만료된 투표' : '이전 투표 불러오는 중')}
        </h3>
        <p>
          {entry.pollType ? POLL_TYPE_LABEL[entry.pollType] : `투표 ID · ${entry.id}`}
          <span />
          {formatLastOpened(entry.lastOpenedAt)}
        </p>
      </div>
      <div className="history-card-actions">
        {isCreator && !unavailable && (
          <Link to={`/p/${entry.id}/manage`} className="btn btn--sm btn--ghost">
            관리
          </Link>
        )}
        {!unavailable && (
          <Link to={`/p/${entry.id}`} className="btn btn--sm">
            열기 <ArrowRightIcon size={14} />
          </Link>
        )}
        <button
          type="button"
          className="history-remove"
          onClick={() => onForget(entry)}
          title="이 기기의 기록에서 삭제"
          aria-label={`${entry.title || '투표'} 기록 삭제`}
        >
          <TrashIcon size={16} />
        </button>
      </div>
    </article>
  )
}

function HistorySection({ eyebrow, title, entries, onForget, now }) {
  if (!entries.length) return null
  return (
    <section className="history-section">
      <div className="history-section-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span>{String(entries.length).padStart(2, '0')}</span>
      </div>
      <div className="history-list">
        {entries.map((entry) => (
          <HistoryCard key={entry.id} entry={entry} onForget={onForget} now={now} />
        ))}
      </div>
    </section>
  )
}

export default function HistoryPage() {
  const toast = useToast()
  const now = useNow()
  const [entries, setEntries] = useState(getPollHistory)
  const persistent = useMemo(() => hasPersistentStorage(), [])

  useEffect(() => {
    let active = true
    const refresh = () => setEntries(getPollHistory())
    const unsubscribe = subscribePollHistory(refresh)
    const migrated = migrateLegacyPollHistory()
    refresh()

    const resolveLegacyTitles = async () => {
      const unresolved = migrated.filter((entry) => !entry.title && !entry.unavailable)
      for (let index = 0; index < unresolved.length; index += 6) {
        const batch = unresolved.slice(index, index + 6)
        await Promise.all(
          batch.map(async (entry) => {
            try {
              const result = await api.getPollSummary(entry.id)
              if (active) rememberPoll(result.poll, { touch: false })
            } catch (error) {
              if (active && error instanceof ApiError && error.status === 404) {
                markPollUnavailable(entry.id)
              }
            }
          }),
        )
        if (!active) return
      }
    }
    resolveLegacyTitles()

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const created = entries.filter((entry) => entry.roles.includes('creator'))
  const participated = entries.filter(
    (entry) => !entry.roles.includes('creator') && entry.roles.includes('voter'),
  )
  const visited = entries.filter(
    (entry) => !entry.roles.includes('creator') && !entry.roles.includes('voter'),
  )

  const onForget = (entry) => {
    forgetPoll(entry.id)
    toast.show('이 기기의 목록에서 지웠습니다.')
  }

  const clearAll = () => {
    if (!window.confirm('이 기기에 저장된 투표 목록을 모두 지울까요?')) return
    clearPollHistory()
    toast.show('저장된 목록을 모두 지웠습니다.')
  }

  return (
    <Layout wide>
      <PageMeta
        title="내 투표"
        description="이 브라우저에서 만들거나 참여한 투표를 다시 확인하세요."
        canonicalPath="/mine"
      />

      <header className="history-page-head">
        <div>
          <p className="eyebrow">
            <span /> SAVED ON THIS DEVICE
          </p>
          <h1>내 투표</h1>
          <p>이 브라우저에서 만들거나 참여한 투표를 다시 열 수 있습니다.</p>
        </div>
        <div className="history-count">
          <strong>{entries.length}</strong>
          <span>저장된 투표</span>
        </div>
      </header>

      <div className={`history-device-note${persistent ? '' : ' is-warning'}`}>
        <DeviceIcon size={19} />
        <p>
          <strong>
            {persistent ? '이 기기에 안전하게 저장 중' : '브라우저 저장소를 사용할 수 없음'}
          </strong>
          <span>
            {persistent
              ? '로그인 정보나 비밀번호는 저장하지 않습니다. 브라우저 데이터를 지우면 목록도 사라집니다.'
              : '현재 탭을 닫으면 이 목록이 사라질 수 있습니다.'}
          </span>
        </p>
      </div>

      {entries.length ? (
        <>
          <HistorySection
            eyebrow="CREATED"
            title="내가 만든 투표"
            entries={created}
            onForget={onForget}
            now={now}
          />
          <HistorySection
            eyebrow="VOTED"
            title="내가 참여한 투표"
            entries={participated}
            onForget={onForget}
            now={now}
          />
          <HistorySection
            eyebrow="VISITED"
            title="이전에 열어본 투표"
            entries={visited}
            onForget={onForget}
            now={now}
          />
          <div className="history-clear">
            <p>공용 기기라면 사용 후 목록을 지워 주세요.</p>
            <button type="button" className="btn btn--sm btn--ghost" onClick={clearAll}>
              전체 기록 삭제
            </button>
          </div>
        </>
      ) : (
        <div className="card history-empty">
          <span className="history-empty-icon">
            <HistoryIcon size={28} />
          </span>
          <h2>아직 저장된 투표가 없습니다.</h2>
          <p>투표를 만들거나 참여하면 이곳에서 다시 찾을 수 있습니다.</p>
          <Link to="/new" className="btn btn--primary">
            새 투표 만들기 <ArrowRightIcon size={15} />
          </Link>
        </div>
      )}
    </Layout>
  )
}
