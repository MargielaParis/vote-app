import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api.js'
import { rememberPoll } from '@/lib/pollHistory.js'

export function usePoll(id) {
  const [state, setState] = useState({ loading: true, error: null, data: null })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const data = await api.getPoll(id)
      setState({ loading: false, error: null, data })
    } catch (err) {
      setState({ loading: false, error: err, data: null })
    }
  }, [id])

  useEffect(() => {
    let alive = true
    api.getPoll(id).then(
      (data) => alive && setState({ loading: false, error: null, data }),
      (err) => alive && setState({ loading: false, error: err, data: null }),
    )
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    if (!state.data?.poll) return
    rememberPoll(state.data.poll, {
      creator: Boolean(state.data.isAdmin),
      voter: Boolean(state.data.you),
    })
  }, [state.data])

  /** 투표 응답으로 받은 조각을 그대로 반영한다. 다시 조회하지 않으므로 KV 예산도 아낀다. */
  const merge = useCallback((patch) => {
    setState((s) => (s.data ? { ...s, data: { ...s.data, ...patch } } : s))
  }, [])

  return { ...state, reload: load, merge }
}
