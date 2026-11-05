const DAY_MS = 24 * 60 * 60 * 1000

/** 체고(m) → 화면 표시용 cm 정수 */
export const toWithersCm = (withersM: number) => Math.round(withersM * 100)

/** 5.00 → "5kg", 6.5 → "6.5kg". 체중을 모르면 null */
export const formatWeight = (weightKg: number | null) =>
  weightKg === null ? null : `${Number(weightKg.toFixed(1))}kg`

/**
 * 1살 미만인지. API 는 출생연도만 주므로 "올해 태어남"으로 근사한다.
 * (작년 12월생처럼 1살 미만인데 false 가 되는 경우가 있다)
 */
export const isLikelyPuppy = (birthYear: number | null, today = new Date()) =>
  birthYear !== null && birthYear >= today.getFullYear()

/** 'YYYY-MM-DD' 를 로컬 자정으로 읽는다 */
const parseDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 공고 시작일부터 오늘까지 기다린 날 수 (오래 기다린 아이 표시용) */
export const waitingDays = (noticeStart: string, today = new Date()) => {
  const start = parseDate(noticeStart)
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.max(0, Math.round((base.getTime() - start.getTime()) / DAY_MS))
}

/** 상세 화면의 입양 상태 구분 */
export type AdoptionState = 'ADOPTABLE' | 'IN_NOTICE' | 'CLOSED'

/**
 * adoptable=false 는 두 경우가 섞여 있다.
 * - 보호중인데 공고 기간이 아직 안 끝남 → 원래 가족을 찾는 기간 (IN_NOTICE)
 * - 입양·반환 등으로 종료, 공공데이터 목록에서 빠짐 → CLOSED
 */
export const adoptionStateOf = (
  pet: { adoptable: boolean; processState: string; noticeEnd: string },
  today = new Date(),
): AdoptionState => {
  if (pet.adoptable) return 'ADOPTABLE'
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const inNotice = pet.processState === '보호중' && parseDate(pet.noticeEnd) >= todayStart
  return inNotice ? 'IN_NOTICE' : 'CLOSED'
}

/**
 * 나이 원문을 화면 문구로 바꾼다.
 * "2023(년생)" → "2023년생", "2026(60일미만)(년생)" → "2026년생 (60일미만)"
 */
export const formatAge = (ageText: string) => {
  const year = ageText.match(/^(\d{4})/)?.[1]
  if (!year) return ageText
  const extra = [...ageText.matchAll(/\(([^)]+)\)/g)]
    .map((match) => match[1])
    .filter((part) => part !== '년생')
  return extra.length > 0 ? `${year}년생 (${extra.join(', ')})` : `${year}년생`
}

/** 'YYYY-MM-DD' → 'MM.DD' (공고 기간 표시용) */
export const formatMonthDay = (date: string) => {
  const [, month, day] = date.split('-')
  return month && day ? `${month}.${day}` : date
}

/** 전화 걸기 링크용 (숫자·+·- 만 남긴다) */
export const toTelHref = (tel: string) => `tel:${tel.replace(/[^\d+-]/g, '')}`

/** 보호가 끝난 이유가 입양·반환인지 (그 밖의 종료는 사유를 단정하지 않고 중립 문구를 쓴다) */
export const isMetFamily = (processState: string) => processState.includes('입양') || processState.includes('반환')
