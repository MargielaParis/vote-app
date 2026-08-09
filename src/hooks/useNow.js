import { useEffect, useState } from 'react'

/** 마감 여부처럼 시간에 따라 바뀌는 값을 렌더 중 Date.now() 로 읽지 않기 위한 훅. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
