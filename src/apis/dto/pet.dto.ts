// 유기견 조회 DTO. 백엔드 PetController (GET /api/pets, /api/pets/filters, /api/pets/{id}) 기준
// 날짜는 'YYYY-MM-DD' 문자열, BigDecimal 은 number 로 내려온다

/** M 수컷, F 암컷, Q 미상 */
export type PetSex = 'M' | 'F' | 'Q'

/** Y 예, N 아니오, U 미상 */
export type PetNeutered = 'Y' | 'N' | 'U'

/** NEWEST 최근 공고순, OLDEST 오래 기다린 순 */
export type PetSort = 'NEWEST' | 'OLDEST'

export interface PetSummary {
  id: number
  /** 품종 · 관할 지자체 · 체중 (공고에 이름이 없어 서버가 만들어 줌) */
  displayName: string
  kindName: string
  sex: PetSex
  /** 나이 원문 (예: "2024(년생)") */
  ageText: string
  /** 원문을 숫자로 못 바꾸면 null */
  weightKg: number | null
  orgName: string
  careName: string
  thumbnailUrl: string | null
  noticeStart: string
  hasModel: boolean
  /** 입양 가능 목록에선 항상 true, 찜 목록에선 입양·반환되면 false */
  adoptable: boolean
  /** 로그인하지 않았으면 false */
  favorited: boolean
}

export interface PetModelBehavior {
  /** 탭했을 때 재생할 GLB 애니메이션 (idle, tail_wag) */
  tapAnimation: string
  /** AnimationMixer.timeScale */
  playbackRate: number
}

/** 완성된 AR 모델. 완성 전·실패·시도 없음은 모두 상세의 model 이 null */
export interface PetModelView {
  /** API 주소 기준 경로 (예: /models/{desertionNo}/{file}.glb). resolveModelUrl 로 절대 주소로 바꿔 쓴다 */
  glbUrl: string
  /** 체고(m). 표시용 — GLB 에 이미 미터 단위로 적용돼 있어 AR 에서 크기를 다시 조정하지 않는다 */
  withersM: number
  /** jindo, jindo_puppy, maltese, toypoodle, chihuahua, retriever */
  template: string
  behavior: PetModelBehavior
}

export interface PetDetail {
  id: number
  desertionNo: string
  noticeNo: string
  displayName: string
  kindName: string
  /** 털색 원문 (예: "갈색&흰색") */
  color: string
  ageText: string
  birthYear: number | null
  /** 체중 원문 (예: "5.0(Kg)") */
  weightText: string
  weightKg: number | null
  sex: PetSex
  neutered: PetNeutered
  /** 공공데이터 상태: 보호중, 종료(입양), 종료(반환) ... */
  processState: string
  /** 보호중이고 공고 기간이 끝났을 때만 true */
  adoptable: boolean
  noticeStart: string
  /** 이 날이 지나야 입양할 수 있다 */
  noticeEnd: string
  orgName: string
  happenPlace: string
  careName: string
  careTel: string
  careAddr: string
  specialMark: string
  photoUrls: string[]
  /** 아직 없으면 null. weightKg 가 null 인 개는 만들 수 없다 */
  model: PetModelView | null
  favorited: boolean
}

export interface PetListParams {
  /** 관할 지자체 앞부분 (예: "경기도", "경기도 화성시"). filters 의 regions[].name 을 그대로 넣는다 */
  region?: string
  /** 품종, 정확히 일치. filters 의 kinds[].name 을 그대로 넣는다 */
  kind?: string
  minWeight?: number
  maxWeight?: number
  /** true: AR 모델이 있는 개만. 비우면 전체 */
  hasModel?: boolean
  sort?: PetSort
  /** 0부터 */
  page?: number
  /** 최대 100 */
  size?: number
}

export interface PetPageResponse {
  items: PetSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}

export interface PetFilterOption {
  name: string
  count: number
}

/** 입양 가능한 동물 기준 마릿수가 많은 순 */
export interface PetFilterOptions {
  regions: PetFilterOption[]
  kinds: PetFilterOption[]
}
