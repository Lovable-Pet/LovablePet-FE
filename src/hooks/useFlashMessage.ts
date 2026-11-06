import { useCallback, useEffect, useRef, useState } from 'react'

/** 토스트 노출 시간 */
export const FLASH_DURATION = 3000

export interface Flash {
  text: string
  /** 같은 문구를 다시 띄워도 등장 애니메이션이 다시 돌게 */
  id: number
}

/** 잠깐 보였다 사라지는 안내 문구 (예: 주소를 복사했어요) */
export function useFlashMessage(duration = FLASH_DURATION) {
  const [flash, setFlash] = useState<Flash | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef(0)

  const show = useCallback(
    (text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      idRef.current += 1
      setFlash({ text, id: idRef.current })
      timerRef.current = setTimeout(() => setFlash(null), duration)
    },
    [duration],
  )

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  return { flash, show }
}
