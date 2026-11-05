import { useEffect, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { tokenStorage } from '../apis/tokenStorage'
import { adminKeys } from '../features/admin/queries'
import { favoriteKeys } from '../features/favorite/queries'
import { petKeys } from '../features/pet/queries'
import { FlashProvider } from './FlashProvider'
import { queryClient } from './queryClient'

/**
 * 로그인·로그아웃·계정 바뀜이면 favorited 가 달라지므로 동물 목록을 다시 불러오고,
 * 계정마다 다른 찜 목록·관리자 데이터는 비운다 (다음 계정에 앞 계정 데이터가 잠깐이라도 보이지 않게)
 */
function useResetOnAuthChange() {
  useEffect(() => {
    let previous = tokenStorage.getAccessToken() ? tokenStorage.getRole() : null
    return tokenStorage.subscribe(() => {
      const current = tokenStorage.getAccessToken() ? tokenStorage.getRole() : null
      // 토큰 재발급은 같은 계정이라 다시 부르지 않는다
      if (current === previous) return
      previous = current
      queryClient.removeQueries({ queryKey: favoriteKeys.all })
      queryClient.removeQueries({ queryKey: adminKeys.all })
      queryClient.invalidateQueries({ queryKey: petKeys.all })
    })
  }, [])
}

export function AppProviders({ children }: { children: ReactNode }) {
  useResetOnAuthChange()
  return (
    <QueryClientProvider client={queryClient}>
      <FlashProvider>{children}</FlashProvider>
    </QueryClientProvider>
  )
}
