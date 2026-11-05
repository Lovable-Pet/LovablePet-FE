import { useEffect, useState } from 'react'

/** 지금 시각(ms)을 interval마다 다시 그린다 (지난 시간 표시용). enabled가 false면 멈춘다 */
export function useNow(interval = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(timer)
  }, [interval, enabled])

  return now
}
