import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LIMITS } from '@shared/limits.js'
import { POLL_TYPE } from '@shared/enums.js'
import { buildGrid, masksToSelection, isRowSelected } from '@shared/slots.js'
import { Layout, Loading, EmptyState } from '@/components/Layout.jsx'
import { PageMeta } from '@/components/PageMeta.jsx'
import { Field, ChoiceCard } from '@/components/Field.jsx'
import { PollHeader } from '@/components/PollHeader.jsx'
import { AppointmentGrid } from '@/components/AppointmentGrid.jsx'
import { ResultsView, ResultsLocked } from '@/components/ResultsView.jsx'
import { ShareLink } from '@/components/ShareLink.jsx'
import { useToast } from '@/lib/toastContext.js'
import { usePoll } from '@/hooks/usePoll.js'
import { useNow } from '@/hooks/useNow.js'
import { api, ApiError } from '@/lib/api.js'
import { formatIsoDate } from '@/lib/datetime.js'
import { removePollRole } from '@/lib/pollHistory.js'
import { pollMetaDescription } from '@shared/meta.js'

export default function PollPage() {
  const { id } = useParams()
  const { loading, error, data, merge } = usePoll(id)

  if (loading)
    return (
      <Layout>
        <Loading />
      </Layout>
    )
  if (error) {
    return (
      <Layout>
        <PageMeta title={error.status === 404 ? '없는 투표' : '투표를 불러오지 못함'} />
        <EmptyState title={error.status === 404 ? '없는 투표입니다' : '불러오지 못했습니다'}>
          <p>{error.message}</p>
          <Link to="/" className="btn">
            처음으로
          </Link>
        </EmptyState>
      </Layout>
    )
  }
  return <PollView key={id} id={id} data={data} merge={merge} />
}

function PollView({ id, data, merge }) {
  const toast = useToast()
  const now = useNow()
  const { poll } = data
  const closed = now > poll.deadline
  const isAppointment = poll.pollType === POLL_TYPE.APPOINTMENT

  const grid = useMemo(
    () => (isAppointment ? buildGrid(poll.appointment) : null),
    [poll, isAppointment],
  )

  const [name, setName] = useState(data.you?.name || '')
  const [choices, setChoices] = useState(() => new Set(data.you?.choices || []))
  const [slots, setSlots] = useState(() => masksToSelection(data.you?.slots || {}))
  const [editing, setEditing] = useState(!data.you && !closed)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canEdit = !closed && (poll.allowRevote || !data.you)

  const toggleChoice = (optionId) => {
    setChoices((prev) => {
      if (!poll.multiSelect) return new Set([optionId])
      const next = new Set(prev)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return next
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')

    if (!poll.anonymous && !name.trim()) {
      setError('이름을 입력해 주세요.')
      return
    }
    if (isAppointment ? slots.size === 0 : choices.size === 0) {
      setError(isAppointment ? '가능한 시간을 하나 이상 칠해 주세요.' : '항목을 선택해 주세요.')
      return
    }

    setBusy(true)
    try {
      const body = {}
      if (!poll.anonymous) body.name = name.trim()
      if (isAppointment) body.slots = [...slots]
      else body.choices = [...choices]

      const res = await api.vote(id, body)
      merge({
        you: res.you,
        totalVoters: res.totalVoters,
        results: res.results,
        resultsLocked: res.resultsLocked,
      })
      setEditing(false)
      toast.show(data.you ? '응답을 수정했습니다.' : '참여했습니다.')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '참여하지 못했습니다.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.withdraw(id)
      removePollRole(id, 'voter')
      merge({
        you: null,
        totalVoters: res.totalVoters,
        results: null,
        resultsLocked: res.resultsLocked,
      })
      setChoices(new Set())
      setSlots(new Set())
      setEditing(true)
      toast.show('참여를 취소했습니다.')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '취소하지 못했습니다.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  const shareUrl = `${window.location.origin}/p/${id}`

  return (
    <Layout wide={isAppointment}>
      <PageMeta
        title={poll.title}
        description={pollMetaDescription(poll)}
        canonicalPath={`/p/${id}`}
      />
      <PollHeader poll={poll} totalVoters={data.totalVoters} isAdmin={data.isAdmin} />

      {closed && (
        <div className="notice notice--warn" style={{ marginBottom: 16 }}>
          마감된 투표입니다. 더는 참여하거나 수정할 수 없습니다.
        </div>
      )}

      {editing && canEdit ? (
        <form onSubmit={submit}>
          <div className="card">
            <h2 className="card-title">{data.you ? '응답 수정' : '참여하기'}</h2>
            <p className="card-sub">
              {isAppointment
                ? '가능한 시간을 드래그해서 칠해 주세요.'
                : poll.multiSelect
                  ? '여러 개 고를 수 있습니다.'
                  : '하나만 고를 수 있습니다.'}
            </p>

            <div className="stack">
              {!poll.anonymous && (
                <Field
                  label="이름"
                  hint={
                    data.you
                      ? '이름은 바꿀 수 없습니다. 바꾸려면 참여를 취소한 뒤 다시 참여해 주세요.'
                      : '같은 이름은 한 번만 쓸 수 있습니다.'
                  }
                >
                  <input
                    className="input"
                    value={name}
                    maxLength={LIMITS.NAME_MAX}
                    disabled={Boolean(data.you) || busy}
                    placeholder="이름"
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>
              )}

              {isAppointment ? (
                <AppointmentGrid
                  grid={grid}
                  tz={poll.appointment.tz}
                  selected={slots}
                  onChange={setSlots}
                  disabled={busy}
                />
              ) : (
                <div className="choice-grid">
                  {poll.options.map((option) => (
                    <ChoiceCard
                      key={option.id}
                      type={poll.multiSelect ? 'checkbox' : 'radio'}
                      name="option"
                      checked={choices.has(option.id)}
                      onChange={() => toggleChoice(option.id)}
                      disabled={busy}
                      title={
                        poll.pollType === POLL_TYPE.DATE
                          ? formatIsoDate(option.date, { withYear: true })
                          : option.label
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="notice notice--danger" style={{ marginTop: 14 }}>
                {error}
              </div>
            )}

            <div className="row" style={{ marginTop: 18 }}>
              <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
                {busy ? '보내는 중…' : data.you ? '수정 저장' : '참여하기'}
              </button>
              {data.you && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEditing(false)}
                  disabled={busy}
                >
                  취소
                </button>
              )}
            </div>
          </div>
        </form>
      ) : (
        <MyAnswer
          poll={poll}
          you={data.you}
          grid={grid}
          canEdit={canEdit}
          busy={busy}
          onEdit={() => setEditing(true)}
          onWithdraw={withdraw}
        />
      )}

      {data.results ? (
        <ResultsView poll={poll} results={data.results} />
      ) : (
        <ResultsLocked reason={data.resultsLocked} totalVoters={data.totalVoters} />
      )}

      <div className="card">
        <h2 className="card-title">이 투표 공유하기</h2>
        <p className="card-sub">주소를 아는 사람만 참여할 수 있습니다.</p>
        <ShareLink url={shareUrl} title={poll.title} />
      </div>
    </Layout>
  )
}

function MyAnswer({ poll, you, grid, canEdit, busy, onEdit, onWithdraw }) {
  if (!you) {
    return (
      <div className="card">
        <h2 className="card-title">참여하지 않았습니다</h2>
        <p className="muted">마감되어 더는 참여할 수 없습니다.</p>
      </div>
    )
  }

  const isAppointment = poll.pollType === POLL_TYPE.APPOINTMENT
  const selected = isAppointment ? masksToSelection(you.slots || {}) : null
  const labels = isAppointment
    ? []
    : (you.choices || [])
        .map((cid) => {
          const option = (poll.options || []).find((o) => o.id === cid)
          if (!option) return null
          return poll.pollType === POLL_TYPE.DATE
            ? formatIsoDate(option.date, { withYear: true })
            : option.label
        })
        .filter(Boolean)

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="card-title" style={{ marginBottom: 0 }}>
          내 응답{you.name ? ` · ${you.name}` : ''}
        </h2>
        {canEdit && (
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn--sm" onClick={onEdit} disabled={busy}>
              수정
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={onWithdraw}
              disabled={busy}
            >
              참여 취소
            </button>
          </div>
        )}
      </div>

      {isAppointment ? (
        <SelectedSummary grid={grid} selected={selected} />
      ) : labels.length ? (
        <div className="result-voters">
          {labels.map((l) => (
            <span key={l} className="badge badge--accent">
              {l}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">선택한 항목이 지금은 없습니다.</p>
      )}

      {!canEdit && !poll.allowRevote && (
        <p className="faint" style={{ marginTop: 10 }}>
          이 투표는 한 번만 참여할 수 있어서 수정할 수 없습니다.
        </p>
      )}
    </div>
  )
}

function SelectedSummary({ grid, selected }) {
  const perDay = grid.days
    .map((day) => {
      const rows = grid.rows.filter((row) => isRowSelected(selected, day.key, row))
      return { day, rows }
    })
    .filter((d) => d.rows.length > 0)

  const outside = [...selected].length > 0 && perDay.length === 0

  if (outside) {
    return <p className="muted">고른 시간이 현재 기간 밖에 있습니다. 다시 선택해 주세요.</p>
  }
  if (!perDay.length) return <p className="muted">아직 고른 시간이 없습니다.</p>

  return (
    <ul className="stack" style={{ gap: 8 }}>
      {perDay.map(({ day, rows }) => (
        <li key={day.key} className="row-between day-summary-row">
          <span>{formatIsoDate(day.iso)}</span>
          <span className="faint">
            {mergeRanges(rows)
              .map((r) => `${r.from}–${r.to}`)
              .join(', ')}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** 연속된 칸을 하나의 구간으로 합쳐서 보여준다. */
function mergeRanges(rows) {
  const out = []
  for (const row of rows) {
    const last = out[out.length - 1]
    if (last && last.endMinute === row.minute) {
      last.endMinute = row.endMinute
      last.to = formatMinute(row.endMinute)
    } else {
      out.push({
        startMinute: row.minute,
        endMinute: row.endMinute,
        from: formatMinute(row.minute),
        to: formatMinute(row.endMinute),
      })
    }
  }
  return out
}

function formatMinute(minute) {
  const h = String(Math.floor(minute / 60)).padStart(2, '0')
  const m = String(minute % 60).padStart(2, '0')
  return `${h}:${m}`
}
