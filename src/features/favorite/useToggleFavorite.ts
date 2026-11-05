import { useMutation, useQueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { ApiError } from '../../apis/apiError'
import type { PetDetail, PetPageResponse } from '../../apis/dto/pet.dto'
import { favoriteApi } from '../../apis/favorite'
import { tokenStorage } from '../../apis/tokenStorage'
import { useFlash } from '../../app/flash'
import { useAuth } from '../auth/useAuth'
import { petKeys } from '../pet/queries'
import { favoriteKeys } from './queries'

interface ToggleVariables {
  petId: number
  /** 바꾼 뒤의 찜 상태 */
  favorited: boolean
}

type PageCache = PetPageResponse | InfiniteData<PetPageResponse> | undefined

// 목록 캐시는 한 페이지(오래 기다린 아이들)와 무한 목록 두 모양이 섞여 있다
const mapPages = (cache: PageCache, mapPage: (page: PetPageResponse) => PetPageResponse): PageCache => {
  if (!cache) return cache
  if ('pages' in cache) return { ...cache, pages: cache.pages.map(mapPage) }
  return mapPage(cache)
}

const setFavorited = (petId: number, favorited: boolean) => (page: PetPageResponse) => ({
  ...page,
  items: page.items.map((pet) => (pet.id === petId ? { ...pet, favorited } : pet)),
})

const removeItem = (petId: number) => (page: PetPageResponse) => {
  const items = page.items.filter((pet) => pet.id !== petId)
  return { ...page, items, totalElements: page.totalElements - (page.items.length - items.length) }
}

/**
 * 찜하기·취소. 화면을 먼저 바꾸고(낙관적 업데이트) 실패하면 되돌린다.
 * 로그인하지 않았으면 요청 없이 로그인 화면으로 보낸다.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const showFlash = useFlash()

  const goLogin = () => {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    navigate(`/login?redirect=${redirect}`)
  }

  const mutation = useMutation({
    mutationFn: ({ petId, favorited }: ToggleVariables) =>
      favorited ? favoriteApi.add(petId) : favoriteApi.remove(petId),

    onMutate: async ({ petId, favorited }) => {
      const targets: QueryKey[] = [petKeys.lists(), petKeys.detail(petId), favoriteKeys.lists()]
      await Promise.all(targets.map((queryKey) => queryClient.cancelQueries({ queryKey })))

      const snapshot = targets.flatMap((queryKey) => queryClient.getQueriesData({ queryKey }))

      queryClient.setQueriesData<PageCache>({ queryKey: petKeys.lists() }, (cache) =>
        mapPages(cache, setFavorited(petId, favorited)),
      )
      queryClient.setQueryData<PetDetail>(petKeys.detail(petId), (pet) => (pet ? { ...pet, favorited } : pet))
      queryClient.setQueriesData<PageCache>({ queryKey: favoriteKeys.lists() }, (cache) =>
        mapPages(cache, favorited ? setFavorited(petId, true) : removeItem(petId)),
      )

      return { snapshot }
    },

    onError: (error, { favorited }, context) => {
      context?.snapshot.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
      // 토큰 재발급까지 실패한 경우는 안내 대신 로그인으로 보낸다.
      // 토큰이 남아 있으면 로그인 화면이 '이미 로그인함'으로 보고 되돌려 보내므로 먼저 지운다
      if (error instanceof ApiError && error.status === 401) {
        tokenStorage.clear()
        goLogin()
        return
      }
      showFlash(favorited ? '찜하지 못했어요. 다시 시도해 주세요.' : '찜을 취소하지 못했어요. 다시 시도해 주세요.')
    },

    // 찜하기는 찜 목록 맨 앞에 새로 들어가야 하므로 다시 불러온다
    onSettled: () => queryClient.invalidateQueries({ queryKey: favoriteKeys.all }),
  })

  const toggle = (petId: number, favorited: boolean) => {
    if (!isLoggedIn) {
      goLogin()
      return
    }
    mutation.mutate({ petId, favorited })
  }

  return { toggle, isPending: mutation.isPending }
}
