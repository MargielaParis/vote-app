import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LIMITS } from '@shared/limits.js'
import {
  POLL_TYPE,
  RESULT_VISIBILITY,
  RESULT_VISIBILITY_LABEL,
  NAME_DISCLOSURE,
  NAME_DISCLOSURE_LABEL,
} from '@shared/enums.js'
import { Layout, Loading, EmptyState } from '@/components/Layout.jsx'
import { PageMeta } from '@/components/PageMeta.jsx'
import { Field, ChoiceCard } from '@/components/Field.jsx'
import { OptionListEditor } from '@/components/OptionListEditor.jsx'
import { CalendarMonth } from '@/components/CalendarMonth.jsx'
import { AppointmentRangePicker } from '@/components/AppointmentRangePicker.jsx'
import { ConfirmDialog } from '@/components/ConfirmDialog.jsx'
import { useToast } from '@/lib/toastContext.js'
import { api, ApiError } from '@/lib/api.js'
import { usePoll } from '@/hooks/usePoll.js'
import { setAdminToken, clearAdminToken } from '@/lib/adminSession.js'
import { toLocalInput, fromLocalInput, formatIsoDate } from '@/lib/datetime.js'
import { pollMetaDescription } from '@shared/meta.js'

export default function ManagePage() {
  const { id } = useParams()
  const { loading, error, data, reload } = usePoll(id)

  if (loading && !data)
    return (
      <Layout>
        <Loading />
      </Layout>
    )
  if (error) {
    return (
      <Layout>
        <PageMeta title={error.status === 404 ? '없는 투표' : '관리를 불러오지 못함'} />
        <EmptyState title={error.status === 404 ? '없는 투표입니다' : '불러오지 못했습니다'}>
          <p>{error.message}</p>
          <Link to="/" className="btn">
            처음으로
          </Link>
        </EmptyState>
      </Layout>
    )
  }

  if (!data.isAdmin) return <PasswordGate id={id} title={data.poll.title} onDone={reload} />
  return <ManageView key={data.poll.rev} id={id} data={data} reload={reload} />
}

function PasswordGate({ id, title, onDone }) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await api.login(id, password)
      setAdminToken(id, res.adminToken)
      await onDone()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '확인하지 못했습니다.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <PageMeta title={`${title} 관리`} canonicalPath={`/p/${id}`} />
      <div className="card" style={{ marginTop: 24 }}>
        <h1 className="card-title">비밀번호 확인</h1>
        <p className="card-sub">
          {title
            ? `"${title}"을(를) 관리하려면 비밀번호가 필요합니다.`
            : '만들 때 정한 비밀번호를 입력해 주세요.'}
        </p>
        <form onSubmit={submit} className="stack">
          <Field error={error}>
            <input
              type="password"
              className="input"
              value={password}
              autoFocus
              autoComplete="current-password"
              maxLength={LIMITS.PASSWORD_MAX}
              placeholder="비밀번호"
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? '확인 중…' : '확인'}
          </button>
        </form>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <Link to={`/p/${id}`} className="btn btn--ghost">
          ← 투표 화면으로
        </Link>
      </div>
    </Layout>
  )
}

function ManageView({ id, data, reload }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { poll } = data
  const isAppointment = poll.pollType === POLL_TYPE.APPOINTMENT
  const hasBallots = data.totalVoters > 0

  const [title, setTitle] = useState(poll.title)
  const [description, setDescription] = useState(poll.description || '')
  const [deadline, setDeadline] = useState(() => toLocalInput(poll.deadline))
  const [resultVisibility, setResultVisibility] = useState(poll.resultVisibility)
  const [allowRevote, setAllowRevote] = useState(poll.allowRevote)
  const [nameDisclosure, setNameDisclosure] = useState(poll.nameDisclosure || NAME_DISCLOSURE.FULL)
  const [multiSelect, setMultiSelect] = useState(poll.multiSelect)
  const [newPassword, setNewPassword] = useState('')

  const [textOptions, setTextOptions] = useState(() =>
    (poll.options || []).map((o) => ({ id: o.id, key: o.id, label: o.label || '' })),
  )
  const [dates, setDates] = useState(() => new Set((poll.options || []).map((o) => o.date)))
  const dateIds = useMemo(
    () => new Map((poll.options || []).map((o) => [o.date, o.id])),
    [poll.options],
  )
  const [appt, setAppt] = useState(() => ({ ...poll.appointment }))

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmState, setConfirmState] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const sortedDates = useMemo(() => [...dates].sort(), [dates])

  const toggleDate = (value) => {
    setDates((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else if (next.size < LIMITS.OPTIONS_MAX) next.add(value)
      return next
    })
  }

  const buildPatch = (confirmDestructive) => {
    const deadlineMs = fromLocalInput(deadline)
    if (Number.isNaN(deadlineMs)) throw new Error('마감 시각을 확인해 주세요.')

    const body = {
      rev: poll.rev,
      title: title.trim(),
      description: description.trim(),
      deadline: deadlineMs,
      resultVisibility,
      allowRevote,
    }
    if (!poll.anonymous) body.nameDisclosure = nameDisclosure
    if (confirmDestructive) body.confirmDestructive = true

    if (isAppointment) {
      body.appointment = appt
    } else {
      body.multiSelect = multiSelect
      body.options =
        poll.pollType === POLL_TYPE.DATE
          ? sortedDates.map((date) => ({ id: dateIds.get(date), date }))
          : textOptions.map((o) => ({ id: o.id, label: o.label.trim() }))
    }
    if (newPassword) body.password = newPassword
    return body
  }

  const save = async (confirmDestructive = false) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await api.patchPoll(id, buildPatch(confirmDestructive))
      setNewPassword('')
      toast.show(res.warnings?.length ? res.warnings.join(' ') : '저장했습니다.')
      await reload()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'destructive') {
        setConfirmState({ message: err.message })
        return
      }
      const message = err instanceof ApiError ? err.message : err.message || '저장하지 못했습니다.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  const removePoll = async () => {
    setDeleteOpen(false)
    setBusy(true)
    try {
      await api.deletePoll(id)
      clearAdminToken(id)
      toast.show('투표를 삭제했습니다.')
      navigate('/', { replace: true })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '삭제하지 못했습니다.'
      setError(message)
      toast.error(message)
      setBusy(false)
    }
  }

  const removeBallot = async (voterKey, label) => {
    setBusy(true)
    try {
      await api.deleteVoterBallot(id, voterKey)
      toast.show(`${label || '표'}을(를) 지웠습니다.`)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '지우지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <PageMeta
        title={`${poll.title} 관리`}
        description={pollMetaDescription(poll)}
        canonicalPath={`/p/${id}`}
      />
      <div className="row-between" style={{ margin: '10px 0 18px' }}>
        <h1 className="poll-title">투표 관리</h1>
        <Link to={`/p/${id}`} className="btn btn--sm">
          투표 화면
        </Link>
      </div>

      {hasBallots && (
        <div className="notice" style={{ marginBottom: 16 }}>
          이미 <strong>{data.totalVoters}명</strong>이 참여했습니다. 투표 유형·익명 여부·복수 선택
          해제는 더 이상 바꿀 수 없습니다.
        </div>
      )}

      <div className="card">
        <h2 className="card-title">기본 정보</h2>
        <div className="stack">
          <Field label="제목" count={`${title.length} / ${LIMITS.TITLE_MAX}`}>
            <input
              className="input"
              value={title}
              maxLength={LIMITS.TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="설명" count={`${description.length} / ${LIMITS.DESC_MAX}`}>
            <textarea
              className="textarea"
              value={description}
              maxLength={LIMITS.DESC_MAX}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="마감 시각" hint="앞당기거나 미룰 수 있습니다.">
            <input
              type="datetime-local"
              className="input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {poll.pollType === POLL_TYPE.TEXT && (
        <div className="card">
          <h2 className="card-title">항목</h2>
          <p className="card-sub">
            항목을 지우면 그 항목을 골랐던 응답은 집계에서 빠집니다. 참여자 수는 그대로입니다.
          </p>
          <OptionListEditor items={textOptions} onChange={setTextOptions} disabled={busy} />
        </div>
      )}

      {poll.pollType === POLL_TYPE.DATE && (
        <div className="card">
          <h2 className="card-title">후보 날짜</h2>
          <CalendarMonth selected={dates} onToggle={toggleDate} minIso={null} />
          <div className="badges" style={{ marginTop: 12 }}>
            {sortedDates.map((d) => (
              <button
                key={d}
                type="button"
                className="badge badge--accent"
                onClick={() => toggleDate(d)}
              >
                {formatIsoDate(d)} ×
              </button>
            ))}
          </div>
        </div>
      )}

      {isAppointment && (
        <div className="card">
          <h2 className="card-title">기간과 시간</h2>
          <p className="card-sub">
            범위를 줄여도 참여자가 고른 시간은 지워지지 않습니다. 다시 넓히면 그대로 되살아납니다.
          </p>
          <AppointmentRangePicker value={appt} onChange={setAppt} disabled={busy} />
        </div>
      )}

      <div className="card">
        <h2 className="card-title">공개와 참여</h2>
        <div className="stack">
          <Field label="결과 공개 시점">
            <div className="choice-grid choice-grid--3">
              {Object.values(RESULT_VISIBILITY).map((v) => (
                <ChoiceCard
                  key={v}
                  type="radio"
                  name="rv"
                  checked={resultVisibility === v}
                  onChange={() => setResultVisibility(v)}
                  title={RESULT_VISIBILITY_LABEL[v]}
                />
              ))}
            </div>
          </Field>

          {!poll.anonymous && (
            <Field label="이름 공개 범위">
              <div className="choice-grid choice-grid--2">
                {Object.values(NAME_DISCLOSURE).map((v) => (
                  <ChoiceCard
                    key={v}
                    type="radio"
                    name="nd"
                    checked={nameDisclosure === v}
                    onChange={() => setNameDisclosure(v)}
                    title={NAME_DISCLOSURE_LABEL[v]}
                  />
                ))}
              </div>
            </Field>
          )}

          {!isAppointment && (
            <Field
              label="고를 수 있는 개수"
              hint={
                hasBallots && poll.multiSelect
                  ? '표가 있어 "하나만"으로 되돌릴 수 없습니다.'
                  : undefined
              }
            >
              <div className="choice-grid choice-grid--2">
                <ChoiceCard
                  type="radio"
                  name="ms"
                  checked={!multiSelect}
                  onChange={() => setMultiSelect(false)}
                  title="하나만"
                  disabled={hasBallots && poll.multiSelect}
                />
                <ChoiceCard
                  type="radio"
                  name="ms"
                  checked={multiSelect}
                  onChange={() => setMultiSelect(true)}
                  title="여러 개"
                />
              </div>
            </Field>
          )}

          <Field label="재투표">
            <div className="choice-grid choice-grid--2">
              <ChoiceCard
                type="radio"
                name="ar"
                checked={allowRevote}
                onChange={() => setAllowRevote(true)}
                title="마감 전까지 수정 허용"
              />
              <ChoiceCard
                type="radio"
                name="ar"
                checked={!allowRevote}
                onChange={() => setAllowRevote(false)}
                title="한 번만 참여"
              />
            </div>
          </Field>

          <Field label="비밀번호 변경" hint="비워 두면 그대로 둡니다.">
            <input
              type="password"
              className="input"
              value={newPassword}
              minLength={LIMITS.PASSWORD_MIN}
              maxLength={LIMITS.PASSWORD_MAX}
              autoComplete="new-password"
              placeholder="새 비밀번호"
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {error && <div className="notice notice--danger">{error}</div>}

      <div className="row" style={{ marginTop: 18 }}>
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={() => save(false)}
          disabled={busy}
        >
          {busy ? '저장 중…' : '변경 사항 저장'}
        </button>
      </div>

      {data.ballots?.length > 0 && (
        <div className="card">
          <h2 className="card-title">참여자 관리</h2>
          <p className="card-sub">
            기기를 바꿔서 자기 응답을 못 고치는 사람이 있으면, 그 표를 지워 주면 다시 참여할 수
            있습니다.
          </p>
          <ul className="stack" style={{ gap: 8 }}>
            {data.ballots.map((b, i) => (
              <li key={b.voterKey} className="row-between day-summary-row">
                <span>{poll.anonymous ? `익명 ${i + 1}` : b.name || '(이름 없음)'}</span>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  disabled={busy}
                  onClick={() =>
                    removeBallot(b.voterKey, poll.anonymous ? `익명 ${i + 1}` : b.name)
                  }
                >
                  표 지우기
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card" style={{ borderColor: 'var(--danger-border)' }}>
        <h2 className="card-title">투표 삭제</h2>
        <p className="card-sub">투표와 모든 응답이 즉시 사라집니다. 되돌릴 수 없습니다.</p>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => setDeleteOpen(true)}
          disabled={busy}
        >
          이 투표 삭제
        </button>
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title="정말 이대로 저장할까요"
        message={confirmState?.message}
        confirmLabel="그래도 저장"
        tone="danger"
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          setConfirmState(null)
          save(true)
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="투표를 삭제할까요"
        message={`"${poll.title}"과(와) 응답 ${data.totalVoters}건이 모두 사라집니다.`}
        confirmLabel="삭제"
        tone="danger"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={removePoll}
      />
    </Layout>
  )
}
