import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '@/components/Layout.jsx'
import { PageMeta } from '@/components/PageMeta.jsx'
import { POLL_TYPE, POLL_TYPE_LABEL, POLL_TYPE_HINT } from '@shared/enums.js'
import {
  AppointmentPollIcon,
  ArrowRightIcon,
  CheckIcon,
  DatePollIcon,
  LinkIcon,
  TextPollIcon,
} from '@/components/Icons.jsx'

const TYPES = [
  { type: POLL_TYPE.TEXT, Icon: TextPollIcon, index: '01' },
  { type: POLL_TYPE.DATE, Icon: DatePollIcon, index: '02' },
  { type: POLL_TYPE.APPOINTMENT, Icon: AppointmentPollIcon, index: '03' },
]

const FEATURES = [
  ['익명 / 기명', '필요할 때만 이름을 받습니다.'],
  ['하나 / 여러 개', '선택 가능한 항목 수를 정합니다.'],
  ['결과 공개', '투표 뒤, 마감 뒤, 생성자만 중에서 고릅니다.'],
  ['재투표', '마감 전 응답 수정을 허용할 수 있습니다.'],
  ['비밀번호', '계정 없이도 투표를 고치고 지울 수 있습니다.'],
]

const FLOW_STEPS = [
  { label: '투표 만들기', detail: '항목과 규칙 설정', Icon: TextPollIcon },
  { label: '링크 공유', detail: '로그인 없이 참여', Icon: LinkIcon },
  { label: '결과 확인', detail: '한눈에 결정 완료', Icon: CheckIcon },
]

function HeroFlow() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setActive((current) => (current + 1) % 3), 2200)
    return () => window.clearInterval(timer)
  }, [paused])

  return (
    <div className="hero-flow" onPointerLeave={() => setPaused(false)}>
      <svg className="flow-lines" viewBox="0 0 440 390" preserveAspectRatio="none">
        <path className={active === 0 ? 'is-active' : ''} d="M112 112 C190 35 277 44 328 93" />
        <path className={active === 1 ? 'is-active' : ''} d="M330 132 C354 205 321 278 249 312" />
        <path className={active === 2 ? 'is-active' : ''} d="M207 313 C132 294 90 236 96 164" />
      </svg>
      {FLOW_STEPS.map(({ label, detail, Icon }, index) => (
        <button
          key={label}
          type="button"
          className={`flow-node flow-node--${['create', 'share', 'decide'][index]}${
            active === index ? ' is-active' : ''
          }`}
          onClick={() => setActive(index)}
          onPointerEnter={() => {
            setPaused(true)
            setActive(index)
          }}
          onFocus={() => {
            setPaused(true)
            setActive(index)
          }}
          onBlur={() => setPaused(false)}
          aria-label={`${index + 1}단계: ${label}, ${detail}`}
        >
          <span className="flow-number">0{index + 1}</span>
          <Icon />
          <strong>{label}</strong>
          <small>{detail}</small>
        </button>
      ))}
      <div className="flow-status" aria-hidden="true">
        <span>ACTIVE STEP</span>
        <strong>0{active + 1} / 03</strong>
      </div>
      <span className="flow-particle flow-particle--1" />
      <span className="flow-particle flow-particle--2" />
      <span className="flow-particle flow-particle--3" />
    </div>
  )
}

export default function HomePage() {
  return (
    <Layout wide>
      <PageMeta canonicalPath="/" />
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">
            <span /> 가입 없이 · 링크 하나로 · 바로 결정
          </p>
          <h1 className="hero-title">
            투표를 만들고,
            <br />
            링크만 보내세요.
          </h1>
          <p className="hero-sub">
            주소를 아는 사람만 참여합니다. 항목, 날짜, 모두가 가능한 시간까지 빠르게 정하세요.
          </p>
          <div className="hero-actions">
            <Link to="/new" className="btn btn--primary btn--lg">
              투표 만들기
              <ArrowRightIcon size={17} />
            </Link>
            <a href="#poll-types" className="btn btn--ghost btn--lg">
              방식 둘러보기
            </a>
          </div>
          <p className="hero-proof">
            <CheckIcon size={15} /> 계정 없음
            <span />
            <CheckIcon size={15} /> 설치 없음
            <span />
            <CheckIcon size={15} /> 무료
          </p>
        </div>
        <HeroFlow />
      </section>

      <section className="home-section" id="poll-types">
        <div className="section-heading">
          <p className="eyebrow">CHOOSE A FORMAT</p>
          <h2>무엇을 정할까요?</h2>
          <p>상황에 맞는 방식 하나를 고르면 나머지는 차근차근 안내합니다.</p>
        </div>
        <div className="type-grid">
          {TYPES.map(({ type, Icon, index }) => (
            <Link key={type} to={`/new?type=${type}`} className="type-tile">
              <div className="type-tile-head">
                <span className="type-icon">
                  <Icon />
                </span>
                <span className="type-index">{index}</span>
              </div>
              <h3>{POLL_TYPE_LABEL[type]}</h3>
              <p>{POLL_TYPE_HINT[type]}</p>
              <span className="type-link">
                시작하기 <ArrowRightIcon size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section home-settings">
        <div className="section-heading">
          <p className="eyebrow">FLEXIBLE BY DEFAULT</p>
          <h2>필요한 규칙만 고르세요.</h2>
          <p>복잡한 설정은 숨기지 않되, 읽고 선택하기 쉽게 정리했습니다.</p>
        </div>
        <ol className="feature-list">
          {FEATURES.map(([title, desc], index) => (
            <li key={title}>
              <span className="feature-index">{String(index + 1).padStart(2, '0')}</span>
              <span>
                <strong>{title}</strong>
                <small>{desc}</small>
              </span>
              <CheckIcon size={18} />
            </li>
          ))}
        </ol>
      </section>
    </Layout>
  )
}
