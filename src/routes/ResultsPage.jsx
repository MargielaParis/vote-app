import { Link, useParams } from 'react-router-dom'
import { Layout, Loading, EmptyState } from '@/components/Layout.jsx'
import { PollHeader } from '@/components/PollHeader.jsx'
import { ResultsView, ResultsLocked } from '@/components/ResultsView.jsx'
import { usePoll } from '@/hooks/usePoll.js'
import { POLL_TYPE } from '@shared/enums.js'

export default function ResultsPage() {
  const { id } = useParams()
  const { loading, error, data } = usePoll(id)

  if (loading)
    return (
      <Layout>
        <Loading />
      </Layout>
    )
  if (error) {
    return (
      <Layout>
        <EmptyState title={error.status === 404 ? '없는 투표입니다' : '불러오지 못했습니다'}>
          <p>{error.message}</p>
          <Link to="/" className="btn">
            처음으로
          </Link>
        </EmptyState>
      </Layout>
    )
  }

  const { poll } = data
  return (
    <Layout wide={poll.pollType === POLL_TYPE.APPOINTMENT}>
      <PollHeader poll={poll} totalVoters={data.totalVoters} isAdmin={data.isAdmin} />
      {data.results ? (
        <ResultsView poll={poll} results={data.results} />
      ) : (
        <ResultsLocked reason={data.resultsLocked} totalVoters={data.totalVoters} />
      )}
      <div className="row" style={{ marginTop: 16 }}>
        <Link to={`/p/${id}`} className="btn">
          투표 화면으로
        </Link>
      </div>
    </Layout>
  )
}
