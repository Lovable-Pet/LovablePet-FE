import { useState, type CSSProperties } from 'react'

/** 카드 사이 간격 */
const STAGGER_MS = 60
/** 한 번에 받은 목록이 길어도 마지막 카드가 너무 늦게 나오지 않게 여기서 멈춘다 (600ms) */
const STAGGER_MAX_INDEX = 10

export interface EntranceProps {
  className: string
  style: CSSProperties
}

/**
 * 목록 아이템 등장 애니메이션 (아래에서 12px 올라오며, 카드마다 60ms씩).
 *
 * 처음 그릴 때 이미 있던 묶음(캐시에서 바로 보인 목록, 뒤로가기로 돌아온 목록)은 움직이지 않고,
 * 그 뒤에 새로 받은 묶음(첫 응답, 다음 페이지)만 묶음 안 순서대로 올라온다.
 * resetKey(필터 등)가 바뀌면 그때의 묶음 수부터 다시 센다.
 *
 * @param readyCount 지금 화면에 있는 묶음 수 (무한 목록이면 페이지 수)
 */
export function useEntranceStagger(readyCount: number, resetKey: string) {
  const [baseline, setBaseline] = useState({ key: resetKey, count: readyCount })
  if (baseline.key !== resetKey) setBaseline({ key: resetKey, count: readyCount })

  return (groupIndex: number, indexInGroup: number): EntranceProps | undefined => {
    if (groupIndex < baseline.count) return undefined
    return {
      className: 'animate-rise-in',
      style: { animationDelay: `${Math.min(indexInGroup, STAGGER_MAX_INDEX) * STAGGER_MS}ms` },
    }
  }
}
