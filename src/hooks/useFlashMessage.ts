import { useCallback, useEffect, useRef, useState } from 'react'

/** 잠깐 보였다 사라지는 안내 문구 (예: 주소를 복사했어요) */
export function useFlashMessage(duration = 2000) {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(
    (next: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setMessage(next)
      timerRef.current = setTimeout(() => setMessage(null), duration)
    },
    [duration],
  )

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  return { message, show }
}
