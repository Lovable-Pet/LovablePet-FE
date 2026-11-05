import { useEffect, useRef } from 'react'
import { Button } from '../Button/Button'

interface LoadMoreProps {
  hasNextPage: boolean
  isFetching: boolean
  isError: boolean
  onLoadMore: () => void
}

/** 목록 끝이 화면에 들어오면 다음 페이지를 부른다 */
export function LoadMore({ hasNextPage, isFetching, isError, onLoadMore }: LoadMoreProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage || isFetching || isError) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore()
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetching, isError, onLoadMore])

  if (!hasNextPage) return null

  return (
    <div ref={sentinelRef} className="flex justify-center pt-6">
      {isError ? (
        <Button variant="outline" size="sm" onClick={onLoadMore}>
          더 불러오지 못했어요 · 다시 시도
        </Button>
      ) : (
        <p className="text-label text-ink-caption" aria-live="polite">
          {isFetching ? '더 불러오는 중…' : ''}
        </p>
      )}
    </div>
  )
}
