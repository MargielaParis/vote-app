import { Link } from 'react-router-dom'
import { Layout } from '@/components/Layout.jsx'
import { POLL_TYPE, POLL_TYPE_LABEL, POLL_TYPE_HINT } from '@shared/enums.js'

const TYPES = [
  { type: POLL_TYPE.TEXT, icon: '📝' },
  { type: POLL_TYPE.DATE, icon: '📅' },
  { type: POLL_TYPE.APPOINTMENT, icon: '🗓️' },
]

export default function HomePage() {
  return (
    <Layout>
      <section style={{ padding: '32px 0 28px' }}>
        <h1 className="hero-title">
          투표를 만들고,
          <br />
          링크만 보내세요.
        </h1>
        <p className="hero-sub">
          가입도 로그인도 없습니다. 만들면 주소가 하나 나오고, 그 주소를 아는 사람만 참여할 수
          있습니다.
        </p>
        <div className="row" style={{ marginTop: 22 }}>
          <Link to="/new" className="btn btn--primary btn--lg">
            투표 만들기
          </Link>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">세 가지 방식</h2>
        <p className="card-sub">무엇을 정해야 하는지에 따라 고르면 됩니다.</p>
        <ul className="stack">
          {TYPES.map(({ type, icon }) => (
            <li key={type} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 20, lineHeight: 1.4 }} aria-hidden="true">
                {icon}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{POLL_TYPE_LABEL[type]}</strong>
                <br />
                <span className="muted" style={{ fontSize: 14 }}>
                  {POLL_TYPE_HINT[type]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">정할 수 있는 것들</h2>
        <p className="card-sub">투표를 만들 때 하나씩 고르게 됩니다.</p>
        <ul className="stack" style={{ gap: 10, fontSize: 14.5 }}>
          <li>
            <strong>익명 / 기명</strong> — 기명이면 참여할 때 이름을 적습니다.
          </li>
          <li>
            <strong>하나만 / 여러 개</strong> — 고를 수 있는 항목 수.
          </li>
          <li>
            <strong>결과 공개 시점</strong> — 투표한 뒤 · 마감된 뒤 · 나만 보기.
          </li>
          <li>
            <strong>재투표</strong> — 마감 전까지 마음을 바꿀 수 있게 할지.
          </li>
          <li>
            <strong>비밀번호</strong> — 나중에 고치거나 지울 때 필요합니다.
          </li>
        </ul>
      </div>
    </Layout>
  )
}
