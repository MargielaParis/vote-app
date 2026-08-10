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
import { PollTabs } from '@/components/PollTabs.jsx'
import { Field, ChoiceCard } from '@/components/Field.jsx'
import { OptionListEditor } from '@/components/OptionListEditor.jsx'
import { CalendarMonth } from '@/components/CalendarMonth.jsx'
import { AppointmentRangePicker } from '@/components/AppointmentRangePicker.jsx'
import { ConfirmDialog } from '@/components/ConfirmDialog.jsx'
import { EditIcon, LockIcon, TrashIcon, UsersIcon } from '@/components/Icons.jsx'
import { useToast } from '@/lib/toastContext.js'
import { api, ApiError } from '@/lib/api.js'
import { usePoll } from '@/hooks/usePoll.js'
import { setAdminToken, clearAdminToken } from '@/lib/adminSession.js'
import { forgetPoll } from '@/lib/pollHistory.js'
import { toLocalInput, fromLocalInput, formatIsoDate } from '@/lib/datetime.js'
import { pollMetaDescription } from '@shared/meta.js'
import { buildGrid, isRowSelected, masksToSelection } from '@shared/slots.js'

const participantTimeFormat = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function ballotSelections(poll, ballot) {
  if (poll.pollType === POLL_TYPE.APPOINTMENT) {
    const selected = masksToSelection(ballot.slots)
    const grid = buildGrid(poll.appointment)
    return grid.days.flatMap((day) =>
      grid.rows
        .filter((row) => isRowSelected(selected, day.key, row))
        .map((row) => `${day.label}(${day.weekdayKo}) ${row.rangeLabel}`),
    )
  }

  const labels = new Map(
    (poll.options || []).map((option) => [
      option.id,
      poll.pollType === POLL_TYPE.DATE
        ? formatIsoDate(option.date, { withYear: true })
        : option.label,
    ]),
  )
  return (ballot.choices || []).map((id) => labels.get(id) || '삭제된 항목')
}

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
      <PollTabs pollId={id} />
      <div className="card manage-password-card">
        <span className="manage-password-icon">
          <LockIcon size={23} />
        </span>
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
              minLength={LIMITS.PASSWORD_MIN}
              maxLength={LIMITS.PASSWORD_MAX}
              placeholder="비밀번호"
              onChange={(e) => setPassword(e.target.value)}
              required
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
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [ballotToDelete, setBallotToDelete] = useState(null)
  const [activeSection, setActiveSection] = useState(hasBallots ? 'participants' : 'edit')

  const sortedDates = useMemo(() => [...dates].sort(), [dates])

  const toggleDate = (value) => {
    setDates((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else if (next.size < LIMITS.OPTIONS_MAX) next.add(value)
      return next
    })
  }

  const buildPatch = () => {
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

  const save = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await api.patchPoll(id, buildPatch())
      setNewPassword('')
      toast.show(res.warnings?.length ? res.warnings.join(' ') : '저장했습니다.')
      await reload()
    } catch (err) {
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
      forgetPoll(id)
      toast.show('투표를 삭제했습니다.')
      navigate('/', { replace: true })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '삭제하지 못했습니다.'
      setError(message)
      toast.error(message)
      setBusy(false)
    }
  }

  const removeBallot = async () => {
    if (!ballotToDelete) return
    const { voterKey, label } = ballotToDelete
    setBallotToDelete(null)
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

  const lockManagement = async () => {
    clearAdminToken(id)
    await reload()
  }

  const selectSection = (section) => {
    setError('')
    setActiveSection(section)
  }

  return (
    <Layout>
      <PageMeta
        title={`${poll.title} 관리`}
        description={pollMetaDescription(poll)}
        canonicalPath={`/p/${id}`}
      />
      <div className="manage-page-head">
        <div>
          <p className="eyebrow">OWNER CONSOLE</p>
          <h1 className="poll-title">{poll.title} 관리</h1>
          <p>비밀번호를 확인한 사람만 이 화면과 참여자 응답을 볼 수 있습니다.</p>
        </div>
        <button type="button" className="btn btn--sm btn--ghost" onClick={lockManagement}>
          <LockIcon size={15} /> 관리 잠그기
        </button>
      </div>

      <PollTabs pollId={id} />

      <nav className="manage-tabs" aria-label="관리 메뉴" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'edit'}
          className={activeSection === 'edit' ? 'is-active' : ''}
          onClick={() => selectSection('edit')}
        >
          <EditIcon size={17} />
          <span>투표 수정</span>
          {hasBallots && <small>잠김</small>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'participants'}
          className={activeSection === 'participants' ? 'is-active' : ''}
          onClick={() => selectSection('participants')}
        >
          <UsersIcon size={17} />
          <span>참여자</span>
          <small>{data.totalVoters}</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'delete'}
          className={activeSection === 'delete' ? 'is-active' : ''}
          onClick={() => selectSection('delete')}
        >
          <TrashIcon size={16} />
          <span>삭제</span>
        </button>
      </nav>

      {activeSection === 'edit' && (
        <section className="manage-panel" role="tabpanel">
          {hasBallots ? (
            <div className="card manage-locked">
              <span>
                <LockIcon size={25} />
              </span>
              <div>
                <h2 className="card-title">참여자가 있어 수정이 잠겼습니다.</h2>
                <p>
                  첫 응답이 들어온 뒤에는 제목, 항목, 마감과 공개 설정을 바꿀 수 없습니다. 참여자
                  명단 확인과 투표 삭제는 계속 가능합니다.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="notice manage-edit-notice">
                첫 참여자가 생기기 전까지만 수정할 수 있습니다.
              </div>

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
                  <p className="card-sub">항목 이름을 바꾸거나 새 항목을 추가할 수 있습니다.</p>
                  <OptionListEditor items={textOptions} onChange={setTextOptions} disabled={busy} />
                </div>
              )}

              {poll.pollType === POLL_TYPE.DATE && (
                <div className="card">
                  <h2 className="card-title">후보 날짜</h2>
                  <CalendarMonth selected={dates} onToggle={toggleDate} minIso={null} />
                  <div className="badges" style={{ marginTop: 12 }}>
                    {sortedDates.map((date) => (
                      <button
                        key={date}
                        type="button"
                        className="badge badge--accent"
                        onClick={() => toggleDate(date)}
                      >
                        {formatIsoDate(date)} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isAppointment && (
                <div className="card">
                  <h2 className="card-title">기간과 시간</h2>
                  <p className="card-sub">약속 후보 기간과 시간 범위를 다시 설정할 수 있습니다.</p>
                  <AppointmentRangePicker value={appt} onChange={setAppt} disabled={busy} />
                </div>
              )}

              <div className="card">
                <h2 className="card-title">공개와 참여</h2>
                <div className="stack">
                  <Field label="결과 공개 시점">
                    <div className="choice-grid choice-grid--3">
                      {Object.values(RESULT_VISIBILITY).map((value) => (
                        <ChoiceCard
                          key={value}
                          type="radio"
                          name="rv"
                          checked={resultVisibility === value}
                          onChange={() => setResultVisibility(value)}
                          title={RESULT_VISIBILITY_LABEL[value]}
                        />
                      ))}
                    </div>
                  </Field>

                  {!poll.anonymous && (
                    <Field label="이름 공개 범위">
                      <div className="choice-grid choice-grid--2">
                        {Object.values(NAME_DISCLOSURE).map((value) => (
                          <ChoiceCard
                            key={value}
                            type="radio"
                            name="nd"
                            checked={nameDisclosure === value}
                            onChange={() => setNameDisclosure(value)}
                            title={NAME_DISCLOSURE_LABEL[value]}
                          />
                        ))}
                      </div>
                    </Field>
                  )}

                  {!isAppointment && (
                    <Field label="고를 수 있는 개수">
                      <div className="choice-grid choice-grid--2">
                        <ChoiceCard
                          type="radio"
                          name="ms"
                          checked={!multiSelect}
                          onChange={() => setMultiSelect(false)}
                          title="하나만"
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

                  <Field label="관리 비밀번호 변경" hint="비워 두면 그대로 둡니다.">
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

              <div className="row manage-save-row">
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={save}
                  disabled={busy}
                >
                  {busy ? '저장 중…' : '변경 사항 저장'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {activeSection === 'participants' && (
        <section className="manage-panel" role="tabpanel">
          <div className="card">
            <div className="row-between manage-participant-head">
              <div>
                <h2 className="card-title">참여자 명단</h2>
                <p className="card-sub">
                  이름과 선택 내역은 관리 비밀번호를 확인한 사람만 보입니다.
                </p>
              </div>
              <span className="badge badge--accent">{data.totalVoters}명</span>
            </div>

            {data.ballots?.length ? (
              <ul className="manage-participant-list">
                {data.ballots.map((ballot, index) => {
                  const label = poll.anonymous
                    ? `익명 참여자 ${String(index + 1).padStart(2, '0')}`
                    : ballot.name || '(이름 없음)'
                  const selections = ballotSelections(poll, ballot)
                  const visibleSelections = selections.slice(0, 16)
                  return (
                    <li key={ballot.voterKey} className="manage-participant">
                      <div className="manage-participant-copy">
                        <div className="manage-participant-name">
                          <strong>{label}</strong>
                          {ballot.updatedAt > 0 && (
                            <time dateTime={new Date(ballot.updatedAt).toISOString()}>
                              {participantTimeFormat.format(ballot.updatedAt)} 응답
                            </time>
                          )}
                        </div>
                        <div className="manage-participant-choices">
                          {visibleSelections.length ? (
                            <>
                              {visibleSelections.map((selection) => (
                                <span key={selection}>{selection}</span>
                              ))}
                              {selections.length > visibleSelections.length && (
                                <span>+{selections.length - visibleSelections.length}개</span>
                              )}
                            </>
                          ) : (
                            <em>선택 내역 없음</em>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        disabled={busy}
                        onClick={() => setBallotToDelete({ voterKey: ballot.voterKey, label })}
                      >
                        응답 삭제
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="manage-participant-empty">
                <UsersIcon size={25} />
                <strong>아직 참여자가 없습니다.</strong>
                <span>첫 참여자가 생기면 이름과 선택 내역이 여기에 표시됩니다.</span>
              </div>
            )}
          </div>
        </section>
      )}

      {activeSection === 'delete' && (
        <section className="manage-panel" role="tabpanel">
          <div className="card manage-danger-zone">
            <span className="manage-danger-icon">
              <TrashIcon size={24} />
            </span>
            <h2 className="card-title">투표 삭제</h2>
            <p className="card-sub">
              투표와 참여자 응답 {data.totalVoters}건이 즉시 사라집니다. 이 작업은 되돌릴 수
              없습니다.
            </p>
            {error && <div className="notice notice--danger">{error}</div>}
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setDeleteOpen(true)}
              disabled={busy}
            >
              이 투표 삭제
            </button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(ballotToDelete)}
        title="참여자 응답을 삭제할까요"
        message={`${ballotToDelete?.label || '참여자'}의 응답이 사라집니다. 참여자는 다시 투표할 수 있습니다.`}
        confirmLabel="응답 삭제"
        tone="danger"
        onCancel={() => setBallotToDelete(null)}
        onConfirm={removeBallot}
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
