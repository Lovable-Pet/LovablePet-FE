import { http, HttpResponse } from 'msw'
import type { ApiFailResponse, ApiSuccessResponse } from '../../apis/dto/common.dto'
import type { FavoriteStatus } from '../../apis/dto/favorite.dto'
import type { PetFilterOption, PetPageResponse, PetSummary } from '../../apis/dto/pet.dto'
import { petDetails, toSummary } from '../fixtures/pets'

const now = () => new Date().toISOString().slice(0, 19)

const success = <T>(data: T, path: string): ApiSuccessResponse<T> => ({
  resultType: 'SUCCESS',
  success: { data },
  error: null,
  meta: { timestamp: now(), path },
})

const fail = (status: number, code: string, message: string, path: string) =>
  HttpResponse.json<ApiFailResponse>(
    { resultType: 'FAIL', success: null, error: { code, message, details: null }, meta: { timestamp: now(), path } },
    { status },
  )

const toPage = (all: PetSummary[], page: number, size: number): PetPageResponse => ({
  items: all.slice(page * size, (page + 1) * size),
  page,
  size,
  totalElements: all.length,
  totalPages: Math.ceil(all.length / size),
  hasNext: (page + 1) * size < all.length,
})

const countBy = (values: string[]): PetFilterOption[] =>
  Object.entries(
    values.reduce<Record<string, number>>((acc, value) => ({ ...acc, [value]: (acc[value] ?? 0) + 1 }), {}),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

const numberParam = (url: URL, key: string) => {
  const value = url.searchParams.get(key)
  return value === null || value === '' ? null : Number(value)
}

// 목업 안에서만 유지되는 찜 상태 (최근에 찜한 순). 목업은 항상 로그인한 것으로 본다
const favoriteIds = petDetails.filter((pet) => pet.favorited).map((pet) => pet.id)
const withFavorite = <T extends { id: number }>(pet: T) => ({ ...pet, favorited: favoriteIds.includes(pet.id) })

const adoptablePets = () => petDetails.filter((pet) => pet.adoptable)

export const petHandlers = [
  http.get('/api/pets/filters', ({ request }) => {
    const pets = adoptablePets()
    const regions = countBy(pets.map((pet) => pet.orgName.split(' ')[0]))
    const kinds = countBy(pets.map((pet) => pet.kindName))
    return HttpResponse.json(success({ regions, kinds }, new URL(request.url).pathname))
  }),

  http.get('/api/pets', ({ request }) => {
    const url = new URL(request.url)
    const page = numberParam(url, 'page') ?? 0
    const size = numberParam(url, 'size') ?? 20
    const region = url.searchParams.get('region')
    const kind = url.searchParams.get('kind')
    const minWeight = numberParam(url, 'minWeight')
    const maxWeight = numberParam(url, 'maxWeight')
    const hasModel = url.searchParams.get('hasModel')
    const sort = url.searchParams.get('sort') ?? 'NEWEST'

    const filtered = adoptablePets()
      .filter((pet) => !region || pet.orgName.startsWith(region))
      .filter((pet) => !kind || pet.kindName === kind)
      .filter((pet) => minWeight === null || (pet.weightKg !== null && pet.weightKg >= minWeight))
      .filter((pet) => maxWeight === null || (pet.weightKg !== null && pet.weightKg <= maxWeight))
      .filter((pet) => hasModel === null || String(pet.model !== null) === hasModel)
      .sort((a, b) =>
        sort === 'OLDEST' ? a.noticeStart.localeCompare(b.noticeStart) : b.noticeStart.localeCompare(a.noticeStart),
      )
      .map(toSummary)
      .map(withFavorite)

    return HttpResponse.json(success(toPage(filtered, page, size), url.pathname))
  }),

  http.get('/api/pets/:id', ({ params, request }) => {
    const path = new URL(request.url).pathname
    const pet = petDetails.find((item) => item.id === Number(params.id))
    if (!pet) return fail(404, 'PET_404', '동물을 찾을 수 없습니다.', path)
    return HttpResponse.json(success(withFavorite(pet), path))
  }),

  http.put('/api/pets/:id/favorite', ({ params, request }) => {
    const path = new URL(request.url).pathname
    const petId = Number(params.id)
    if (!petDetails.some((pet) => pet.id === petId)) return fail(404, 'PET_404', '동물을 찾을 수 없습니다.', path)
    if (!favoriteIds.includes(petId)) favoriteIds.unshift(petId)
    return HttpResponse.json(success<FavoriteStatus>({ petId, favorited: true }, path))
  }),

  http.delete('/api/pets/:id/favorite', ({ params, request }) => {
    const petId = Number(params.id)
    const index = favoriteIds.indexOf(petId)
    if (index >= 0) favoriteIds.splice(index, 1)
    return HttpResponse.json(success<FavoriteStatus>({ petId, favorited: false }, new URL(request.url).pathname))
  }),

  http.get('/api/members/me/favorites', ({ request }) => {
    const url = new URL(request.url)
    const page = numberParam(url, 'page') ?? 0
    const size = numberParam(url, 'size') ?? 20
    const favorites = favoriteIds
      .map((id) => petDetails.find((pet) => pet.id === id))
      .filter((pet) => pet !== undefined)
      .map(toSummary)
      .map(withFavorite)
    return HttpResponse.json(success(toPage(favorites, page, size), url.pathname))
  }),
]
