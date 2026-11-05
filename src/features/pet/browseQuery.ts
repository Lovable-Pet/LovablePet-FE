import type { PetListParams, PetSort } from '../../apis/dto/pet.dto'
import { WEIGHT_PRESETS, type WeightPresetKey } from '../../constants/pet'

/** 필터 시트에서 고르는 조건 */
export interface BrowseFilters {
  region?: string
  kind?: string
  minWeight?: number
  maxWeight?: number
  /** true면 AR 모델이 있는 아이만 */
  hasModel?: boolean
}

/** 둘러보기 화면의 URL 쿼리 전체 (필터 + 정렬) */
export interface BrowseQuery extends BrowseFilters {
  sort: PetSort
}

export const EMPTY_FILTERS: BrowseFilters = {}

const parseNumber = (value: string | null) => {
  if (value === null || value.trim() === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

const parseText = (value: string | null) => (value && value.trim() !== '' ? value : undefined)

/** URL 쿼리 → 둘러보기 조건. 모르는 값은 버린다 */
export const parseBrowseQuery = (params: URLSearchParams): BrowseQuery => ({
  region: parseText(params.get('region')),
  kind: parseText(params.get('kind')),
  minWeight: parseNumber(params.get('minWeight')),
  maxWeight: parseNumber(params.get('maxWeight')),
  hasModel: params.get('hasModel') === 'true' ? true : undefined,
  sort: params.get('sort') === 'OLDEST' ? 'OLDEST' : 'NEWEST',
})

/** 둘러보기 조건 → URL 쿼리. 기본값(전체, 최근 공고순)은 넣지 않는다 */
export const toSearchParams = (query: BrowseQuery) => {
  const params = new URLSearchParams()
  if (query.region) params.set('region', query.region)
  if (query.kind) params.set('kind', query.kind)
  if (query.minWeight !== undefined) params.set('minWeight', String(query.minWeight))
  if (query.maxWeight !== undefined) params.set('maxWeight', String(query.maxWeight))
  if (query.hasModel) params.set('hasModel', 'true')
  if (query.sort === 'OLDEST') params.set('sort', 'OLDEST')
  return params
}

/** 둘러보기 조건 → 목록 API 파라미터 (hasModel은 켰을 때만 보낸다) */
export const toListParams = ({ sort, ...filters }: BrowseQuery): PetListParams => ({
  region: filters.region,
  kind: filters.kind,
  minWeight: filters.minWeight,
  maxWeight: filters.maxWeight,
  hasModel: filters.hasModel ? true : undefined,
  sort,
})

/** 체중 범위가 크기 버튼(소형·중형·대형)과 같으면 그 버튼 */
export const weightPresetOf = ({ minWeight, maxWeight }: BrowseFilters): WeightPresetKey | null => {
  const found = (Object.keys(WEIGHT_PRESETS) as WeightPresetKey[]).find((key) => {
    const preset = WEIGHT_PRESETS[key]
    return preset.minWeight === minWeight && preset.maxWeight === maxWeight
  })
  return found ?? null
}

/** 적용된 필터 칩에 쓰는 체중 문구 (예: "중형 · 10~25kg", "5~12kg") */
export const weightLabelOf = (filters: BrowseFilters) => {
  const { minWeight, maxWeight } = filters
  if (minWeight === undefined && maxWeight === undefined) return null
  const preset = weightPresetOf(filters)
  if (preset) return `${WEIGHT_PRESETS[preset].label} · ${WEIGHT_PRESETS[preset].range}`
  return `${minWeight ?? ''}~${maxWeight ?? ''}kg`
}

/** '필터 N'의 N: 지역·품종·체중 중 고른 것의 수 (AR은 따로 칩이 있어 세지 않는다) */
export const activeFilterCount = (filters: BrowseFilters) =>
  [
    filters.region,
    filters.kind,
    filters.minWeight !== undefined || filters.maxWeight !== undefined ? 'weight' : undefined,
  ].filter(Boolean).length

/** 이 체중이 들어가는 크기 버튼 (입양 완료 카드의 '비슷한 크기 아이들 보기'에 쓴다) */
export const weightPresetForKg = (weightKg: number): WeightPresetKey => {
  const found = (Object.keys(WEIGHT_PRESETS) as WeightPresetKey[]).find((key) => {
    const { minWeight = 0, maxWeight = Infinity } = WEIGHT_PRESETS[key]
    return weightKg >= minWeight && weightKg < maxWeight
  })
  return found ?? 'LARGE'
}

/** 이 체중과 비슷한 크기 아이들 둘러보기 주소와 범위 문구 (체중을 모르면 null) */
export const similarSizeLinkOf = (weightKg: number | null) => {
  if (weightKg === null) return null
  const preset = WEIGHT_PRESETS[weightPresetForKg(weightKg)]
  const params = toSearchParams({ minWeight: preset.minWeight, maxWeight: preset.maxWeight, sort: 'NEWEST' })
  return { to: `/?${params}`, range: preset.range }
}
