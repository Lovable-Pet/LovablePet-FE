import { useEffect, useRef } from 'react'
import { Button } from '../Button/Button'
import { PawDots } from '../LoadingScreen/LoadingScreen'

interface LoadMoreProps {
  hasNext: boolean
  isLoading: boolean
  isError?: boolean
  onLoad: () => void
}

/** 목록 끝에 두면 화면에 보일 때 다음 페이지를 부른다 */
export function LoadMore({ hasNext, isLoading, isError = false, onLoad }: LoadMoreProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onLoadRef = useRef(onLoad)
  useEffect(() => {
    onLoadRef.current = onLoad
  }, [onLoad])

  useEffect(() => {
    const node = ref.current
    if (!node || !hasNext || isLoading || isError) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadRef.current()
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNext, isLoading, isError])

  if (!hasNext) return null
  return (
    <div ref={ref} className="flex min-h-16 items-center justify-center py-4">
      {isError ? (
        <Button variant="outline" size="sm" onClick={onLoad}>
          더 불러오지 못했어요. 다시 시도
        </Button>
      ) : (
        isLoading && <PawDots label="더 불러오는 중" />
      )}
    </div>
  )
}
