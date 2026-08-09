import { Link } from 'react-router-dom'
import { Layout, EmptyState } from '@/components/Layout.jsx'

export default function NotFoundPage() {
  return (
    <Layout>
      <EmptyState title="없는 주소입니다">
        <p>주소가 잘못되었거나 투표가 삭제되었습니다.</p>
        <Link to="/" className="btn">
          처음으로
        </Link>
      </EmptyState>
    </Layout>
  )
}
