import { Link, useParams } from 'react-router-dom'
import { Layout } from '@/components/Layout.jsx'
import { ShareLink } from '@/components/ShareLink.jsx'

export default function CreatedPage() {
  const { id } = useParams()
  const url = `${window.location.origin}/p/${id}`

  return (
    <Layout>
      <div className="card" style={{ marginTop: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden="true">
          🎉
        </div>
        <h1 className="poll-title">투표를 만들었습니다</h1>
        <p className="muted" style={{ marginTop: 8, marginBottom: 20 }}>
          이 주소를 아는 사람만 참여할 수 있습니다. 잊지 말고 저장해 두세요.
        </p>
        <ShareLink url={url} />
        <div className="row" style={{ marginTop: 20, justifyContent: 'center' }}>
          <Link to={`/p/${id}`} className="btn btn--primary">
            투표 화면 열기
          </Link>
          <Link to={`/p/${id}/manage`} className="btn">
            관리
          </Link>
        </div>
      </div>

      <div className="notice notice--warn" style={{ marginTop: 16 }}>
        <div className="notice-title">비밀번호를 기억해 주세요</div>
        비밀번호를 잊으면 이 투표를 고치거나 지울 방법이 없습니다. 계정이 없어서 되찾아 드릴 수도
        없습니다.
      </div>
    </Layout>
  )
}
