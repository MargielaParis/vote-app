import { Link } from 'react-router-dom'
import { Layout, EmptyState } from '@/components/Layout.jsx'
import { PageMeta } from '@/components/PageMeta.jsx'

export default function NotFoundPage() {
  return (
    <Layout>
      <PageMeta title="페이지를 찾을 수 없음" />
      <EmptyState title="없는 주소입니다">
        <p>주소가 잘못되었거나 투표가 삭제되었습니다.</p>
        <Link to="/" className="btn">
          처음으로
        </Link>
      </EmptyState>
    </Layout>
  )
}
