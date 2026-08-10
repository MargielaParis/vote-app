import { NavLink } from 'react-router-dom'
import { ChartIcon, CheckIcon, LockIcon } from './Icons.jsx'

const tabClass = ({ isActive }) => `poll-tab${isActive ? ' is-active' : ''}`

export function PollTabs({ pollId }) {
  return (
    <nav className="poll-tabs" aria-label="투표 메뉴">
      <NavLink end to={`/p/${pollId}`} className={tabClass}>
        <CheckIcon size={16} />
        투표
      </NavLink>
      <NavLink to={`/p/${pollId}/result`} className={tabClass}>
        <ChartIcon size={16} />
        결과
      </NavLink>
      <NavLink to={`/p/${pollId}/manage`} className={tabClass}>
        <LockIcon size={15} />
        관리
      </NavLink>
    </nav>
  )
}
