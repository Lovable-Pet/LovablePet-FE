import { http, HttpResponse } from 'msw'
import type {
  FitCheckResponse,
  GenerateModelRequest,
  PetModelAttempt,
  PetModelAttemptList,
  PetSyncResult,
} from '../../apis/dto/admin.dto'
import type { ApiFailResponse, ApiSuccessResponse } from '../../apis/dto/common.dto'
import { petDetails } from '../fixtures/pets'

const now = () => new Date().toISOString().slice(0, 19)

// 성공·실패를 한 핸들러에서 섞어 돌려주므로 본문 타입을 하나로 묶는다
type Body = ApiSuccessResponse<unknown> | ApiFailResponse

const success = <T>(data: T, path: string, status = 200) =>
  HttpResponse.json<Body>(
    { resultType: 'SUCCESS', success: { data }, error: null, meta: { timestamp: now(), path } } satisfies ApiSuccessResponse<T>,
    { status },
  )

const fail = (status: number, code: string, message: string, path: string) =>
  HttpResponse.json<Body>(
    { resultType: 'FAIL', success: null, error: { code, message, details: null }, meta: { timestamp: now(), path } },
    { status },
  )

// 목업은 사진 번호로 결과를 정한다: 0 적합, 1 체형 부적합(force 필요), 2 이상 사진 거부
const fitResult = (photoIndex: number, weightKg: number, photoUrl: string): FitCheckResponse => {
  if (photoIndex === 0)
    return {
      level: 'good', label: '적합', score: 92, reasons: [], notes: ['템플릿: 말티즈 (사진과 모델 비교)'],
      template: 'maltese', photoRejected: [], canGenerate: true, needsForce: false,
      withersM: 0.24, weightKg, photoLevel: 'good', photoUrl,
    }
  if (photoIndex === 1)
    return {
      level: 'poor', label: '부적합', score: 38, reasons: ['털이 길어 템플릿 체형과 많이 달라요', '얼굴이 일부만 보여요'],
      notes: ['템플릿: 말티즈 (사진과 모델 비교)'], template: 'maltese', photoRejected: [], canGenerate: true,
      needsForce: true, withersM: 0.24, weightKg, photoLevel: 'fair', photoUrl,
    }
  return {
    level: 'poor', label: '부적합', score: 0, reasons: ['사람 손이 몸통 털을 많이 가렸어요'], notes: [],
    template: null, photoRejected: ['person_covers'], canGenerate: false, needsForce: false,
    withersM: null, weightKg, photoLevel: null, photoUrl,
  }
}

const DAILY_LIMIT = 30
const attempts: PetModelAttempt[] = []
let nextId = 1
// 목업에서는 생성 등록 후 15초가 지나면 완성으로 바꾼다
const MOCK_GENERATION_MS = 15_000

const settle = (attempt: PetModelAttempt) => {
  if (attempt.status !== 'PENDING' || Date.now() - Date.parse(attempt.createdAt) < MOCK_GENERATION_MS) return attempt
  Object.assign(attempt, {
    status: 'DONE',
    glbUrl: `/models/${attempt.jobId.split('-')[0]}/${attempt.jobId}.glb`,
    tapAnimation: 'tail_wag',
    playbackRate: 1,
    costUsd: 0.075,
    finishedAt: new Date().toISOString(),
  } satisfies Partial<PetModelAttempt>)
  return attempt
}

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

export const adminHandlers = [
  http.post('/api/admin/pets/sync', ({ request }) =>
    success<PetSyncResult>(
      { fetched: 3300, created: 120, updated: 3180, unlisted: 95, skipped: 0, tookMs: 21500 },
      new URL(request.url).pathname,
    ),
  ),

  http.post('/api/admin/pets/:id/model/fit', async ({ params, request }) => {
    const path = new URL(request.url).pathname
    const pet = petDetails.find((item) => item.id === Number(params.id))
    if (!pet) return fail(404, 'PET_404', '동물을 찾을 수 없습니다.', path)
    if (pet.weightKg === null)
      return fail(400, 'GENERATION_400_WEIGHT', '공고 체중을 알 수 없어 실제 크기로 만들 수 없습니다.', path)
    const { photoIndex } = (await request.json()) as { photoIndex: number }
    const photoUrl = pet.photoUrls[photoIndex]
    if (photoUrl === undefined) return fail(400, 'GENERATION_400_PHOTO', '사진 번호가 올바르지 않습니다.', path)
    return success(fitResult(photoIndex, pet.weightKg, photoUrl), path)
  }),

  http.post('/api/admin/pets/:id/model', async ({ params, request }) => {
    const path = new URL(request.url).pathname
    const pet = petDetails.find((item) => item.id === Number(params.id))
    if (!pet) return fail(404, 'PET_404', '동물을 찾을 수 없습니다.', path)
    if (pet.model) return fail(409, 'GENERATION_409_EXISTS', '이미 AR 모델이 있는 동물입니다. 한 번 만든 모델을 계속 씁니다.', path)
    if (attempts.some((item) => item.petId === pet.id && settle(item).status === 'PENDING'))
      return fail(409, 'GENERATION_409_RUNNING', '이 동물의 AR 모델을 만드는 중입니다.', path)
    if (attempts.filter((item) => isToday(item.createdAt)).length >= DAILY_LIMIT)
      return fail(429, 'GENERATION_429_LIMIT', '오늘 AR 생성 횟수를 다 썼습니다. 내일 다시 시도해 주세요.', path)
    if (pet.weightKg === null)
      return fail(400, 'GENERATION_400_WEIGHT', '공고 체중을 알 수 없어 실제 크기로 만들 수 없습니다.', path)

    const { photoIndex, force = false } = (await request.json()) as GenerateModelRequest
    const photoUrl = pet.photoUrls[photoIndex]
    if (photoUrl === undefined) return fail(400, 'GENERATION_400_PHOTO', '사진 번호가 올바르지 않습니다.', path)
    const fit = fitResult(photoIndex, pet.weightKg, photoUrl)
    if (!fit.canGenerate)
      return fail(400, 'GENERATION_400_PHOTO_REJECTED', '적합도 확인에서 거부된 사진입니다. 다른 사진을 골라 주세요.', path)

    const attempt: PetModelAttempt = {
      id: nextId++, petId: pet.id, status: fit.needsForce && !force ? 'UNSUITABLE' : 'PENDING',
      jobId: `${pet.desertionNo}-${Math.random().toString(16).slice(2, 10)}`, photoUrl, weightKg: pet.weightKg,
      forced: force, fitLevel: fit.level, fitScore: fit.score, template: fit.template, reasons: fit.reasons,
      error: null, glbUrl: null, withersM: fit.withersM, tapAnimation: null, playbackRate: null, costUsd: null,
      createdAt: new Date().toISOString(), finishedAt: null,
    }
    attempts.unshift(attempt)
    return success(attempt, path, 202)
  }),

  http.get('/api/admin/pets/:id/model', ({ params, request }) => {
    const latest = attempts.find((item) => item.petId === Number(params.id))
    return success(latest ? settle(latest) : null, new URL(request.url).pathname)
  }),

  http.get('/api/admin/pet-models', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const items = attempts
      .map(settle)
      .filter((item) => !status || item.status === status)
      .slice(0, 100)
    return success<PetModelAttemptList>(
      { items, todayCount: attempts.filter((item) => isToday(item.createdAt)).length, dailyLimit: DAILY_LIMIT },
      url.pathname,
    )
  }),
]
