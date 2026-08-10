import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LIMITS } from '@shared/limits.js'
import {
  POLL_TYPE,
  POLL_TYPE_LABEL,
  POLL_TYPE_HINT,
  RESULT_VISIBILITY,
  RESULT_VISIBILITY_LABEL,
  NAME_DISCLOSURE,
  NAME_DISCLOSURE_LABEL,
} from '@shared/enums.js'
import { Layout } from '@/components/Layout.jsx'
import { Field, ChoiceCard } from '@/components/Field.jsx'
import { OptionListEditor } from '@/components/OptionListEditor.jsx'
import { CalendarMonth } from '@/components/CalendarMonth.jsx'
import { AppointmentRangePicker } from '@/components/AppointmentRangePicker.jsx'
import {
  AppointmentPollIcon,
  ArrowRightIcon,
  CheckIcon,
  DatePollIcon,
  TextPollIcon,
} from '@/components/Icons.jsx'
import { useToast } from '@/lib/toastContext.js'
import { api, ApiError } from '@/lib/api.js'
import { setAdminToken } from '@/lib/adminSession.js'
import {
  toLocalInput,
  fromLocalInput,
  toDateInput,
  formatIsoDate,
  localTimezone,
} from '@/lib/datetime.js'

const DAY = 86_400_000

function defaultDeadline() {
  const d = new Date(Date.now() + 7 * DAY)
  d.setHours(18, 0, 0, 0)
  return toLocalInput(d.getTime())
}

const VISIBILITY_HINT = {
  [RESULT_VISIBILITY.AFTER_VOTE]: '앞사람 표에 휩쓸리지 않게 합니다.',
  [RESULT_VISIBILITY.AFTER_DEADLINE]: '마감 전에는 참여 인원만 보입니다.',
  [RESULT_VISIBILITY.CREATOR_ONLY]: '결과를 보려면 비밀번호가 필요합니다.',
}

const POLL_TYPE_ICON = {
  [POLL_TYPE.TEXT]: <TextPollIcon />,
  [POLL_TYPE.DATE]: <DatePollIcon />,
  [POLL_TYPE.APPOINTMENT]: <AppointmentPollIcon />,
}

function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0])

  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const threshold = window.innerHeight * 0.32
        let current = ids[0]
        for (const id of ids) {
          const element = document.getElementById(id)
          if (element && element.getBoundingClientRect().top <= threshold) current = id
        }
        setActive(current)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [ids])

  return active
}

function SectionHeading({ number, eyebrow, title, description }) {
  return (
    <div className="create-section-head">
      <span className="create-section-number">{number}</span>
      <div>
        <p className="create-section-label">{eyebrow}</p>
        <h2 className="card-title">{title}</h2>
        {description && <p className="card-sub">{description}</p>}
      </div>
    </div>
  )
}

export default function CreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const [pollType, setPollType] = useState(() => {
    const requested = searchParams.get('type')
    return Object.values(POLL_TYPE).includes(requested) ? requested : POLL_TYPE.TEXT
  })
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [textOptions, setTextOptions] = useState(() => [
    { key: crypto.randomUUID(), label: '' },
    { key: crypto.randomUUID(), label: '' },
  ])
  const [dates, setDates] = useState(() => new Set())
  const [appt, setAppt] = useState(() => ({
    startDate: toDateInput(Date.now()),
    endDate: toDateInput(Date.now() + 6 * DAY),
    startMinute: 540,
    endMinute: 1320,
    slotMinutes: 30,
    tz: localTimezone(),
  }))

  const [anonymous, setAnonymous] = useState(true)
  const [nameDisclosure, setNameDisclosure] = useState(NAME_DISCLOSURE.FULL)
  const [multiSelect, setMultiSelect] = useState(false)
  const [allowRevote, setAllowRevote] = useState(true)
  const [resultVisibility, setResultVisibility] = useState(RESULT_VISIBILITY.AFTER_VOTE)
  const [deadline, setDeadline] = useState(defaultDeadline)
  const [password, setPassword] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sortedDates = useMemo(() => [...dates].sort(), [dates])
  const steps = useMemo(
    () => [
      { id: 'create-type', label: '방식', detail: '투표 유형' },
      { id: 'create-details', label: '내용', detail: '제목과 설명' },
      {
        id: 'create-options',
        label: pollType === POLL_TYPE.APPOINTMENT ? '시간' : '항목',
        detail:
          pollType === POLL_TYPE.TEXT
            ? '선택지 입력'
            : pollType === POLL_TYPE.DATE
              ? '후보 날짜'
              : '기간과 범위',
      },
      { id: 'create-settings', label: '참여', detail: '공개와 수정' },
      { id: 'create-finish', label: '마감', detail: '마감과 관리' },
    ],
    [pollType],
  )
  const stepIds = useMemo(() => steps.map((step) => step.id), [steps])
  const activeSection = useActiveSection(stepIds)
  const activeStep = Math.max(0, steps.findIndex((step) => step.id === activeSection))

  const scrollToStep = (id) => {
    const section = document.getElementById(id)
    if (!section) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  const toggleDate = (value) => {
    setDates((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else if (next.size < LIMITS.OPTIONS_MAX) next.add(value)
      return next
    })
  }

  const buildBody = () => {
    const deadlineMs = fromLocalInput(deadline)
    if (Number.isNaN(deadlineMs)) throw new Error('마감 시각을 확인해 주세요.')

    const body = {
      title: title.trim(),
      description: description.trim(),
      pollType,
      anonymous,
      allowRevote,
      resultVisibility,
      deadline: deadlineMs,
      password,
    }
    if (!anonymous) body.nameDisclosure = nameDisclosure

    if (pollType === POLL_TYPE.APPOINTMENT) {
      body.appointment = appt
    } else {
      body.multiSelect = multiSelect
      body.options =
        pollType === POLL_TYPE.DATE
          ? sortedDates.map((date) => ({ date }))
          : textOptions.map((o) => ({ label: o.label.trim() }))
    }
    return body
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const body = buildBody()
      const res = await api.createPoll(body)
      setAdminToken(res.poll.id, res.adminToken)
      navigate(`/p/${res.poll.id}/share`, { replace: true })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err.message || '만들지 못했습니다.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout wide>
      <div className="create-layout">
        <aside className="create-rail">
          <div className="create-rail-intro">
            <p className="eyebrow">
              <span /> NEW POLL
            </p>
            <h2>다섯 단계면 끝나요.</h2>
            <p>현재 위치를 따라가며 필요한 설정만 채워 주세요.</p>
          </div>
          <nav className="create-steps" aria-label="투표 생성 단계">
            {steps.map((step, index) => {
              const isActive = step.id === activeSection
              const isComplete = index < activeStep
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => scrollToStep(step.id)}
                  className={`${isActive ? 'is-active' : ''}${isComplete ? ' is-complete' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="create-step-dot">
                    {isComplete ? <CheckIcon size={14} /> : String(index + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </span>
                </button>
              )
            })}
          </nav>
          <p className="create-rail-note">
            <span /> 입력 내용은 생성 전까지 서버로 전송되지 않습니다.
          </p>
        </aside>

        <div className="create-main">
          <header className="create-page-head">
            <p className="eyebrow">CREATE &amp; SHARE</p>
            <h1>새 투표 만들기</h1>
            <p>방식과 규칙을 정하면 참여 링크가 바로 만들어집니다.</p>
          </header>

          <form className="create-form" onSubmit={submit} noValidate>
            <section id="create-type" className="card create-card">
              <SectionHeading
                number="01"
                eyebrow="FORMAT"
                title="무엇을 정하나요"
                description="고른 방식에 따라 아래 입력이 달라집니다."
              />
              <div className="choice-grid choice-grid--3">
                {Object.values(POLL_TYPE).map((type) => (
                  <ChoiceCard
                    key={type}
                    type="radio"
                    name="pollType"
                    checked={pollType === type}
                    onChange={() => setPollType(type)}
                    title={POLL_TYPE_LABEL[type]}
                    desc={POLL_TYPE_HINT[type]}
                    icon={POLL_TYPE_ICON[type]}
                  />
                ))}
              </div>
            </section>

            <section id="create-details" className="card create-card">
              <SectionHeading
                number="02"
                eyebrow="DETAILS"
                title="제목과 설명"
                description="참여자가 가장 먼저 보게 되는 내용입니다."
              />
              <div className="stack">
                <Field label="제목" count={`${title.length} / ${LIMITS.TITLE_MAX}`}>
                  <input
                    className="input"
                    value={title}
                    maxLength={LIMITS.TITLE_MAX}
                    placeholder="예) 이번 주 회식 언제 할까요"
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </Field>
                <Field
                  label="설명"
                  hint="선택 사항"
                  count={`${description.length} / ${LIMITS.DESC_MAX}`}
                >
                  <textarea
                    className="textarea"
                    value={description}
                    maxLength={LIMITS.DESC_MAX}
                    placeholder="참여자에게 알려줄 내용이 있으면 적어 주세요."
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
              </div>
            </section>

            {pollType === POLL_TYPE.TEXT && (
              <section id="create-options" className="card create-card">
                <SectionHeading
                  number="03"
                  eyebrow="OPTIONS"
                  title="투표 항목"
                  description="Enter를 누르면 다음 항목으로 넘어갑니다."
                />
                <OptionListEditor items={textOptions} onChange={setTextOptions} disabled={busy} />
              </section>
            )}

            {pollType === POLL_TYPE.DATE && (
              <section id="create-options" className="card create-card">
                <SectionHeading
                  number="03"
                  eyebrow="DATES"
                  title="후보 날짜"
                  description={`달력에서 최소 ${LIMITS.OPTIONS_MIN}개, 최대 ${LIMITS.OPTIONS_MAX}개를 고릅니다.`}
                />
                <CalendarMonth selected={dates} onToggle={toggleDate} />
                <div className="badges" style={{ marginTop: 12 }}>
                  {sortedDates.length === 0 ? (
                    <span className="faint">아직 고른 날짜가 없습니다.</span>
                  ) : (
                    sortedDates.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="badge badge--accent"
                        onClick={() => toggleDate(d)}
                        title="빼기"
                      >
                        {formatIsoDate(d)} ×
                      </button>
                    ))
                  )}
                </div>
              </section>
            )}

            {pollType === POLL_TYPE.APPOINTMENT && (
              <section id="create-options" className="card create-card">
                <SectionHeading
                  number="03"
                  eyebrow="TIME RANGE"
                  title="기간과 시간"
                  description="참여자는 이 범위 안에서 가능한 칸을 드래그로 칠합니다."
                />
                <AppointmentRangePicker value={appt} onChange={setAppt} disabled={busy} />
              </section>
            )}

            <section id="create-settings" className="card create-card">
              <SectionHeading
                number="04"
                eyebrow="PARTICIPATION"
                title="참여 방식"
                description="공개 범위와 응답 수정 여부를 정합니다."
              />

              <div className="stack">
                <Field label="이름">
                  <div className="choice-grid choice-grid--2">
                    <ChoiceCard
                      type="radio"
                      name="anonymous"
                      checked={anonymous}
                      onChange={() => setAnonymous(true)}
                      title="익명"
                      desc="이름 없이 참여합니다."
                    />
                    <ChoiceCard
                      type="radio"
                      name="anonymous"
                      checked={!anonymous}
                      onChange={() => setAnonymous(false)}
                      title="기명"
                      desc="참여할 때 이름을 적습니다."
                    />
                  </div>
                </Field>

                {!anonymous && (
                  <Field label="결과에 이름 공개 범위">
                    <div className="choice-grid choice-grid--2">
                      {Object.values(NAME_DISCLOSURE).map((v) => (
                        <ChoiceCard
                          key={v}
                          type="radio"
                          name="nameDisclosure"
                          checked={nameDisclosure === v}
                          onChange={() => setNameDisclosure(v)}
                          title={NAME_DISCLOSURE_LABEL[v]}
                        />
                      ))}
                    </div>
                  </Field>
                )}

                {pollType !== POLL_TYPE.APPOINTMENT && (
                  <Field label="고를 수 있는 개수">
                    <div className="choice-grid choice-grid--2">
                      <ChoiceCard
                        type="radio"
                        name="multiSelect"
                        checked={!multiSelect}
                        onChange={() => setMultiSelect(false)}
                        title="하나만"
                      />
                      <ChoiceCard
                        type="radio"
                        name="multiSelect"
                        checked={multiSelect}
                        onChange={() => setMultiSelect(true)}
                        title="여러 개"
                      />
                    </div>
                  </Field>
                )}

                <Field label="결과 공개 시점">
                  <div className="choice-grid choice-grid--3">
                    {Object.values(RESULT_VISIBILITY).map((v) => (
                      <ChoiceCard
                        key={v}
                        type="radio"
                        name="resultVisibility"
                        checked={resultVisibility === v}
                        onChange={() => setResultVisibility(v)}
                        title={RESULT_VISIBILITY_LABEL[v]}
                        desc={VISIBILITY_HINT[v]}
                      />
                    ))}
                  </div>
                </Field>

                <Field
                  label="재투표"
                  hint={
                    anonymous
                      ? '익명 투표에서는 브라우저 저장소를 지우면 재투표·철회를 할 수 없습니다.'
                      : '이름을 처음 등록한 브라우저만 자기 표를 고칠 수 있습니다.'
                  }
                >
                  <div className="choice-grid choice-grid--2">
                    <ChoiceCard
                      type="radio"
                      name="allowRevote"
                      checked={allowRevote}
                      onChange={() => setAllowRevote(true)}
                      title="마감 전까지 수정 허용"
                    />
                    <ChoiceCard
                      type="radio"
                      name="allowRevote"
                      checked={!allowRevote}
                      onChange={() => setAllowRevote(false)}
                      title="한 번만 참여"
                    />
                  </div>
                </Field>
              </div>
            </section>

            <section id="create-finish" className="card create-card">
              <SectionHeading
                number="05"
                eyebrow="DEADLINE & SECURITY"
                title="마감과 비밀번호"
                description="마감 시각과 나중에 관리할 때 쓸 비밀번호를 정합니다."
              />
              <div className="stack">
                <Field label="마감 시각">
                  <input
                    type="datetime-local"
                    className="input"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    required
                  />
                </Field>
                <Field label="비밀번호" hint={`${LIMITS.PASSWORD_MIN}자 이상`}>
                  <input
                    type="password"
                    className="input"
                    value={password}
                    minLength={LIMITS.PASSWORD_MIN}
                    maxLength={LIMITS.PASSWORD_MAX}
                    autoComplete="new-password"
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>
                <p className="create-security-note">
                  <span /> 계정이 없어 비밀번호를 잊으면 복구할 수 없습니다.
                </p>
              </div>
            </section>

            {error && <div className="notice notice--danger create-error">{error}</div>}

            <div className="create-submit-panel">
              <div>
                <span>READY TO SHARE</span>
                <strong>링크가 바로 만들어집니다.</strong>
                <small>생성한 뒤 링크를 복사해 참여자에게 보내세요.</small>
              </div>
              <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
                {busy ? '만드는 중…' : '투표 만들기'}
                {!busy && <ArrowRightIcon size={17} />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}
