import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../apis/apiError'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx(없는 공고, 권한 없음 등)는 다시 해도 같으므로 재시도하지 않는다
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
    },
  },
})
