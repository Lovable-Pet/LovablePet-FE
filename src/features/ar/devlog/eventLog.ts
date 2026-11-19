import { useSyncExternalStore } from 'react'
import type { AnimatorLog } from '../dogAnimator'

// 개발 모드 ?debug 이벤트 기록 (AR·?sim 모두). 클립·자세·고개·몸 돌리기·가까이 앉기·가까움·산책·안내 줄·말풍선·발도장·음성·사용자 거리를
// 시간순으로 메모리에만 최근 EVENT_LOG_KEEP_MS 동안 모은다. 켜져 있을 때(setArEventLogEnabled, ArPage 가 ?debug 일 때)만 쌓는다.
// 부르는 곳이 모두 import.meta.env.DEV 안이라 배포 빌드에는 들어가지 않는다

/** 이만큼(ms) 지난 기록은 버린다 (10분) */
export const EVENT_LOG_KEEP_MS = 10 * 60 * 1000

export interface ArEvent {
  /** performance.now() (ms) */
  t: number
  /** 갈래: 클립·동작·자세·고개·몸 돌리기·가까이 앉기·가까움·산책·안내·말풍선·발도장·음성·사용자 */
  kind: string
  text: string
}

let enabled = false
let events: readonly ArEvent[] = []
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function setArEventLogEnabled(on: boolean) {
  enabled = on
  // 헤드리스 시험이 기록을 읽는다 (window.__arEvents())
  if (typeof window !== 'undefined') (window as unknown as { __arEvents?: () => readonly ArEvent[] }).__arEvents = () => events
}

export function logArEvent(kind: string, text: string) {
  if (!enabled) return
  const t = performance.now()
  const from = events.findIndex((event) => event.t >= t - EVENT_LOG_KEEP_MS)
  events = [...(from > 0 ? events.slice(from) : from < 0 ? [] : events), { t, kind, text }]
  notify()
}

export function clearArEvents() {
  events = []
  notify()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 기록 (오래된 것부터) */
export function useArEvents() {
  return useSyncExternalStore(subscribe, () => events)
}

/** 한 줄. 예: '12.34 클립 head_tilt 시작' (시간은 페이지를 연 뒤 초) */
export const formatArEvent = (event: ArEvent) => `${(event.t / 1000).toFixed(2)} ${event.kind} ${event.text}`

/** 복사용 텍스트 한 덩어리 */
export const formatArEvents = (list: readonly ArEvent[] = events) => list.map(formatArEvent).join('\n')

/** DogAnimator 개발 기록 한 줄 */
export function describeAnimatorLog(event: AnimatorLog): string {
  switch (event.type) {
    case 'end':
      return `${event.clip} 끝${event.quiet ? ' (빈 끝에서)' : ''}`
    case 'cut':
      return `${event.clip} 끊김 → ${event.by}`
    case 'reserve':
      return `예약 ${event.id}`
    case 'unreserve':
      return `예약 취소 ${event.id}`
    case 'runReserved':
      return `예약 실행 ${event.id}`
    case 'release':
      return `${event.clip} 스스로 내림`
  }
}

/** 사용자 거리·방향 한 줄 (1초마다): 개 발밑에서 수평 거리, 개 몸 기준 방향 (+ 왼쪽), 폰 높이 (개 바닥 기준) */
export function describeUser(camera: { x: number; y: number; z: number }, dog: { position: { x: number; y: number; z: number }; yaw: number } | null) {
  if (!dog) return `폰 (${camera.x.toFixed(2)}, ${camera.y.toFixed(2)}, ${camera.z.toFixed(2)})`
  const dx = camera.x - dog.position.x
  const dz = camera.z - dog.position.z
  const bearing = Math.atan2(Math.sin(Math.atan2(dx, dz) - dog.yaw), Math.cos(Math.atan2(dx, dz) - dog.yaw))
  const deg = Math.round((bearing * 180) / Math.PI)
  const side = Math.abs(deg) <= 15 ? '앞' : Math.abs(deg) >= 165 ? '뒤' : deg > 0 ? '왼쪽' : '오른쪽'
  return `${Math.hypot(dx, dz).toFixed(2)} m · 개 기준 ${deg > 0 ? '+' : ''}${deg}° (${side}) · 폰 높이 ${(camera.y - dog.position.y).toFixed(2)} m`
}
