import { http } from 'msw'
import type { FavoriteStatus } from '../../apis/dto/favorite.dto'
import type { PetFilterOption, PetPageResponse, PetSummary } from '../../apis/dto/pet.dto'
import { petDetails, toSummary } from '../fixtures/pets'
import { fail, roleOf, success, unauthorized } from '../utils'

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

// 목업 안에서만 유지되는 찜 상태 (최근에 찜한 순)
const favoriteIds = petDetails.filter((pet) => pet.favorited).map((pet) => pet.id)

// 백엔드처럼 로그인하지 않았으면 favorited 는 항상 false
const withFavorite =
  (request: Request) =>
  <T extends { id: number }>(pet: T) => ({
    ...pet,
    favorited: roleOf(request) !== null && favoriteIds.includes(pet.id),
  })

const adoptablePets = () => petDetails.filter((pet) => pet.adoptable)

export const petHandlers = [
  http.get('/api/pets/filters', ({ request }) => {
    const pets = adoptablePets()
    const regions = countBy(pets.map((pet) => pet.orgName.split(' ')[0]))
    const kinds = countBy(pets.map((pet) => pet.kindName))
    return success({ regions, kinds }, request)
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
      .map(withFavorite(request))

    return success(toPage(filtered, page, size), request)
  }),

  http.get('/api/pets/:id', ({ params, request }) => {
    const pet = petDetails.find((item) => item.id === Number(params.id))
    if (!pet) return fail(404, 'PET_404', '동물을 찾을 수 없습니다.', request)
    return success(withFavorite(request)(pet), request)
  }),

  http.put('/api/pets/:id/favorite', ({ params, request }) => {
    if (!roleOf(request)) return unauthorized(request)
    const petId = Number(params.id)
    if (!petDetails.some((pet) => pet.id === petId)) return fail(404, 'PET_404', '동물을 찾을 수 없습니다.', request)
    if (!favoriteIds.includes(petId)) favoriteIds.unshift(petId)
    return success<FavoriteStatus>({ petId, favorited: true }, request)
  }),

  http.delete('/api/pets/:id/favorite', ({ params, request }) => {
    if (!roleOf(request)) return unauthorized(request)
    const petId = Number(params.id)
    const index = favoriteIds.indexOf(petId)
    if (index >= 0) favoriteIds.splice(index, 1)
    return success<FavoriteStatus>({ petId, favorited: false }, request)
  }),

  http.get('/api/members/me/favorites', ({ request }) => {
    if (!roleOf(request)) return unauthorized(request)
    const url = new URL(request.url)
    const page = numberParam(url, 'page') ?? 0
    const size = numberParam(url, 'size') ?? 20
    const favorites = favoriteIds
      .map((id) => petDetails.find((pet) => pet.id === id))
      .filter((pet) => pet !== undefined)
      .map(toSummary)
      .map(withFavorite(request))
    return success(toPage(favorites, page, size), request)
  }),
]
