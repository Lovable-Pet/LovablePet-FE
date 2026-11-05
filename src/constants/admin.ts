import type { FitLevel, PetModelStatus, PhotoRejectReason } from '../apis/dto/admin.dto'

export const MODEL_STATUS_LABEL: Record<PetModelStatus, string> = {
  PENDING: '만드는 중',
  DONE: '완성',
  PHOTO_REJECTED: '사진 거부',
  UNSUITABLE: '체형 부적합',
  FAILED: '실패',
}

export const FIT_LEVEL_LABEL: Record<FitLevel, string> = {
  good: '적합',
  fair: '주의',
  poor: '부적합',
}

export const PHOTO_QUALITY_LABEL: Record<FitLevel, string> = {
  good: '좋음',
  fair: '보통',
  poor: '나쁨',
}

export const PHOTO_REJECT_LABEL: Record<PhotoRejectReason, string> = {
  person_covers: '사람 손이나 몸이 가림',
  several_animals: '여러 마리가 함께 있음',
  text_on_animal: '글자가 동물 위에 있음',
  clothing: '옷을 입고 있음',
  object_covers: '물건이 가림',
  not_a_dog: '개가 아님',
}

/** 생성 상태 조회 간격. 생성은 1.5~4분 걸린다 */
export const MODEL_POLL_INTERVAL_MS = 5_000
