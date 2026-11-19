import { bypass, http, HttpResponse } from 'msw'
import type { ApiResponse } from '../../apis/dto/common.dto'
import type { FavoriteStatus } from '../../apis/dto/favorite.dto'
import type { PetDetail, PetPageResponse, PetSummary } from '../../apis/dto/pet.dto'
import { toSummary } from '../fixtures/pets'
import { roleOf, success, unauthorized } from '../utils'
import { authHandlers } from './auth'

// '로그인만 목업' 모드 (VITE_ENABLE_MOCK=auth)
// - 로그인·가입·카카오·재발급·로그아웃은 목업이 답한다 (./auth)
// - 유기견 목록·상세·필터는 실제 백엔드로 보낸다
// - 실제 백엔드는 목업 토큰을 모르므로 Authorization 을 떼고 보낸다.
//   그러면 찜을 쓸 수 없으니 찜만 이 파일의 메모리에 두고, 실제 응답의 favorited 를 여기 값으로 고쳐 준다
// - 관리자 API(/api/admin/**)는 실제 계정이 필요해 이 모드에서는 쓸 수 없다 (401 → 로그아웃된다)

/** 목업 안에서만 유지되는 찜 (최근에 찜한 순). 새로고침하면 비워진다 */
const favoriteIds: number[] = []

/** 목업 토큰을 떼고 실제 백엔드로 보낸다 */
const toRealBackend = (request: Request) => {
  const headers = new Headers(request.headers)
  headers.delete('Authorization')
  return fetch(bypass(new Request(request, { headers })))
}

const fetchRealPet = async (petId: number, request: Request) => {
  const response = await fetch(bypass(new URL(`/api/pets/${petId}`, request.url).toString()))
  const body = (await response.json()) as ApiResponse<PetDetail>
  return body.resultType === 'SUCCESS' ? body.success.data : null
}

export const authOnlyHandlers = [
  ...authHandlers,

  http.put('/api/members/me/favorites/:id', ({ params, request }) => {
    if (!roleOf(request)) return unauthorized(request)
    const petId = Number(params.id)
    if (!favoriteIds.includes(petId)) favoriteIds.unshift(petId)
    return success<FavoriteStatus>({ petId, favorited: true }, request)
  }),

  http.delete('/api/members/me/favorites/:id', ({ params, request }) => {
    if (!roleOf(request)) return unauthorized(request)
    const petId = Number(params.id)
    const index = favoriteIds.indexOf(petId)
    if (index >= 0) favoriteIds.splice(index, 1)
    return success<FavoriteStatus>({ petId, favorited: false }, request)
  }),

  // 찜한 번호로 실제 공고를 하나씩 받아 목록을 만든다
  http.get('/api/members/me/favorites', async ({ request }) => {
    if (!roleOf(request)) return unauthorized(request)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 0)
    const size = Number(url.searchParams.get('size') ?? 20)
    const pageIds = favoriteIds.slice(page * size, (page + 1) * size)
    const pets = await Promise.all(pageIds.map((id) => fetchRealPet(id, request)))
    const items: PetSummary[] = pets
      .filter((pet) => pet !== null)
      .map((pet) => ({ ...toSummary(pet), favorited: true }))
    return success<PetPageResponse>(
      {
        items,
        page,
        size,
        totalElements: favoriteIds.length,
        totalPages: Math.ceil(favoriteIds.length / size),
        hasNext: (page + 1) * size < favoriteIds.length,
      },
      request,
    )
  }),

  // 실제 목록·상세 응답에 목업 찜 상태를 입힌다 (로그인했을 때만)
  http.get('/api/pets', async ({ request }) => {
    const response = await toRealBackend(request)
    if (!roleOf(request) || !response.ok) return response
    const body = (await response.json()) as ApiResponse<PetPageResponse>
    if (body.resultType === 'SUCCESS') {
      body.success.data.items = body.success.data.items.map((pet) => ({ ...pet, favorited: favoriteIds.includes(pet.id) }))
    }
    return HttpResponse.json(body, { status: response.status })
  }),

  http.get('/api/pets/:id', async ({ params, request }) => {
    const response = await toRealBackend(request)
    // /api/pets/filters 도 이 경로에 걸린다
    if (!roleOf(request) || !response.ok || !/^\d+$/.test(String(params.id))) return response
    const body = (await response.json()) as ApiResponse<PetDetail>
    if (body.resultType === 'SUCCESS') body.success.data.favorited = favoriteIds.includes(body.success.data.id)
    return HttpResponse.json(body, { status: response.status })
  }),

  // 그 밖의 API 는 토큰만 떼고 그대로 실제 백엔드로
  http.all('/api/*', ({ request }) => toRealBackend(request)),
]
