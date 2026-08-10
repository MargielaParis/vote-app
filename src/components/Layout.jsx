import { Link } from 'react-router-dom'
import { ArrowRightIcon, WaymarkIcon } from './Icons.jsx'

export function Layout({ children, wide = false }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <WaymarkIcon size={18} />
          </span>
          모두의 투표
        </Link>
        <Link to="/new" className="btn btn--sm topbar-cta">
          새 투표
          <ArrowRightIcon size={14} />
        </Link>
      </header>
      <main className={wide ? 'page page--wide' : 'page'}>{children}</main>
      <footer className="footer">링크를 아는 사람만 참여할 수 있습니다.</footer>
    </div>
  )
}

export function Loading({ label = '불러오는 중' }) {
  return (
    <div className="center-state">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className="center-state">
      <h2 className="poll-title">{title}</h2>
      {children}
    </div>
  )
}
