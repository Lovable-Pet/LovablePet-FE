import type { PetListParams, PetNeutered, PetSex, PetSort } from '../apis/dto/pet.dto'

export const SEX_LABEL: Record<PetSex, string> = {
  M: '수컷',
  F: '암컷',
  Q: '성별 미상',
}

export const NEUTERED_LABEL: Record<PetNeutered, string> = {
  Y: '중성화 완료',
  N: '중성화 안 함',
  U: '중성화 미상',
}

export const SORT_LABEL: Record<PetSort, string> = {
  NEWEST: '최근 공고순',
  OLDEST: '오래 기다린 순',
}

export type WeightPresetKey = 'SMALL' | 'MEDIUM' | 'LARGE'

/** 필터의 크기 버튼 → 목록 조회의 minWeight / maxWeight (공고의 지금 체중 기준) */
export const WEIGHT_PRESETS: Record<
  WeightPresetKey,
  { label: string; range: string } & Pick<PetListParams, 'minWeight' | 'maxWeight'>
> = {
  SMALL: { label: '소형', range: '~10kg', maxWeight: 10 },
  MEDIUM: { label: '중형', range: '10~25kg', minWeight: 10, maxWeight: 25 },
  LARGE: { label: '대형', range: '25kg~', minWeight: 25 },
}

/** model.template → 화면 표시용 체형 이름 */
export const TEMPLATE_LABEL: Record<string, string> = {
  jindo: '진도형',
  jindo_puppy: '진도 강아지형',
  maltese: '말티즈형',
  toypoodle: '토이푸들형',
  chihuahua: '치와와형',
  retriever: '리트리버형',
}

export const PUPPY_NOTICE = '지금 크기예요. 아직 어린 아이라 다 자라면 크게 달라질 수 있어요.'
