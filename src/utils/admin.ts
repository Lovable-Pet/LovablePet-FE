/** 비용 표시 (예: 0.075 → "$0.075") */
export const formatUsd = (usd: number | null) => (usd === null ? '-' : `$${usd.toFixed(3)}`)

/** 걸린 시간 m:ss (예: 161000 → "2:41") */
export const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

/** 요청 시각 MM.DD HH:mm (기기 시간대) */
export const formatDateTime = (iso: string) => {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 시도 하나가 걸린 시간. 끝나지 않았으면 지금까지 */
export const attemptDuration = (createdAt: string, finishedAt: string | null, now = Date.now()) =>
  formatDuration((finishedAt ? Date.parse(finishedAt) : now) - Date.parse(createdAt))
