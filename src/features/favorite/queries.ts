import { useInfiniteQuery } from '@tanstack/react-query'
import { favoriteApi } from '../../apis/favorite'

export const FAVORITE_PAGE_SIZE = 20

export const favoriteKeys = {
  all: ['favorites'] as const,
  lists: () => [...favoriteKeys.all, 'list'] as const,
}

/** 내 찜 목록 (최근에 찜한 순). 로그인했을 때만 부른다 */
export const useFavoriteList = (enabled: boolean) =>
  useInfiniteQuery({
    queryKey: favoriteKeys.lists(),
    queryFn: ({ pageParam }) => favoriteApi.getList({ page: pageParam, size: FAVORITE_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    enabled,
  })
