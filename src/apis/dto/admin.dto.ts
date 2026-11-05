// 관리자 DTO. 백엔드 AdminPetController, AdminPetModelController 기준 (/api/admin/** 는 ADMIN 만, 아니면 COMMON_403)

/** 적합도·사진 품질 */
export type FitLevel = 'good' | 'fair' | 'poor'

/** 사진 거부 사유 코드 */
export type PhotoRejectReason =
  | 'person_covers'
  | 'several_animals'
  | 'text_on_animal'
  | 'clothing'
  | 'object_covers'
  | 'not_a_dog'

export interface FitCheckRequest {
  /** 상세 photoUrls 의 순서 (0부터) */
  photoIndex: number
}

/** 적합도 확인 결과. 5~20초 걸린다 (배포 직후 첫 호출은 30초 넘게) */
export interface FitCheckResponse {
  /** 사진이 거부돼도 poor */
  level: FitLevel | null
  /** 적합 / 주의 / 부적합 */
  label: string | null
  /** 0~100 */
  score: number | null
  /** 사진 거부 사유나 템플릿과 다른 점, 사진 품질 안내 (한국어) */
  reasons: string[]
  /** 참고 (예: "템플릿: 진도 (사진과 모델 비교)") */
  notes: string[]
  /** 사진이 거부되면 null */
  template: string | null
  /** 통과면 [] */
  photoRejected: PhotoRejectReason[]
  /** false 면 사진 거부 → 다른 사진을 고르게 한다 (force 로도 못 만든다) */
  canGenerate: boolean
  /** true 면 템플릿 부적합 → force 로만 만들 수 있다 (그 개처럼 안 보일 수 있다) */
  needsForce: boolean
  /** 예상 체고(m). 사진이 거부되면 null */
  withersM: number | null
  weightKg: number
  photoLevel: FitLevel | null
  photoUrl: string
}

export interface GenerateModelRequest {
  /** 적합도 확인한 사진과 같은 번호 */
  photoIndex: number
  /** 템플릿 부적합이어도 끝까지 만든다. 사진 거부는 force 로도 못 넘는다 */
  force?: boolean
}

/** PENDING 만드는 중 / DONE 완성 / PHOTO_REJECTED 사진 거부 / UNSUITABLE 템플릿 부적합으로 멈춤 / FAILED 실패 */
export type PetModelStatus = 'PENDING' | 'DONE' | 'PHOTO_REJECTED' | 'UNSUITABLE' | 'FAILED'

/** AR 생성 시도 한 건. 생성은 202 로 바로 답하고 1.5~4분 뒤 상태가 바뀐다 */
export interface PetModelAttempt {
  id: number
  petId: number
  status: PetModelStatus
  jobId: string
  photoUrl: string
  weightKg: number
  forced: boolean
  fitLevel: FitLevel | null
  fitScore: number | null
  template: string | null
  /** 사진 거부·부적합 사유 (한국어) */
  reasons: string[] | null
  /** 실패 사유 */
  error: string | null
  /** 완성 전 null */
  glbUrl: string | null
  withersM: number | null
  tapAnimation: string | null
  playbackRate: number | null
  /** USD */
  costUsd: number | null
  createdAt: string
  finishedAt: string | null
}

/** 최근 100건 + 오늘(한국 날짜) 사용량 */
export interface PetModelAttemptList {
  items: PetModelAttempt[]
  todayCount: number
  dailyLimit: number
}

/** 공공데이터 동기화 결과 (10초 안팎) */
export interface PetSyncResult {
  fetched: number
  created: number
  updated: number
  unlisted: number
  skipped: number
  tookMs: number
}
