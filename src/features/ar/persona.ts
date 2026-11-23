// 보호소 메모(공고 특징 PetDetail.specialMark)를 단어 규칙으로 세 갈래로 나눈다. 앱 안에서만 (LLM·외부 호출 없음).
// AR 첫 만남의 처음 자세·인사 꼬리 횟수와 위 안내 한 줄에만 쓴다 (탭·명령·음성·산책·시선 등은 성격과 무관).
//
// 순서: 부정 표현을 먼저 지운다 ('공격성 없음'·'무서워 하지 않음' 등) → 조심 단어·반가움 단어를 각각 찾는다 →
// 둘 다 있으면 default ('겁 조금 · 사람 잘 따름' 같은 섞인 메모: 한쪽으로 정하면 정보 시트의 메모와 어긋난다),
// 조심만 있으면 wary, 반가움만 있으면 friendly, 둘 다 없으면 default (순함·얌전·정보 없음).
// 실제 공고(보호 중 2,895마리)로 본 비율: wary 22.7% · friendly 12.4% · default 64.8%

export type Persona = 'wary' | 'friendly' | 'default'

export interface PersonaResult {
  persona: Persona
  /** 찾은 단어 (본문에서 찾은 그대로, 조심 단어 다음 반가움 단어, 중복 없음). 섞여서 default 여도 넣는다 (?debug 확인용) */
  matched: string[]
}

/**
 * 부정 표현: '공격성 없음'·'입질은 없음'·'경계심 없음'·'겁은 전혀 없음'·'입질 안 함'·'무서워 하지 않으며'·'두려워하지 않음'
 * (뒤에 붙은 말까지 한 덩어리)
 */
const NEGATED = /(공격성|입질|경계심?|겁)\s?(은|이|도)?\s?((전혀|별로)\s?)?(없|안\s?함)\S*|(무서|두려)워\s?하지\s?않\S*/g

/** 조심 단어 (낮가 는 낯가 오타, 무섭 은 무서 와 다른 글자라 따로). 까칠·민감은 털 상태('눈물자국 살짝까칠')로 많이 써서 뺐다 */
const WARY = /겁|소심|무서|무섭|두려|움츠|경계|낯을|낯가|낮가|예민|적응\s?중|낯설|긴장|공격|입질|사나|으르렁|무는|물기/g

/**
 * 반가움 단어 (괘활 은 쾌활 오타, '손 잘 탐' 은 탐 이 한 글자라 따로).
 * 밝은·밝고 는 털·목줄 색('밝은 황갈색')으로 많이 써서 뺐다
 */
const FRIENDLY =
  /잘\s?따|따라다|친화|애교|사람\s?을?\s?(엄청|많이|너무|정말)?\s?좋아|붙임성|사교|친근|손\s?을?\s?잘\s?[타탐]|손길에\s?익숙|반김|안기|안겨|활발|발랄|쾌활|괘활|명랑|장난|에너지|호기심|해맑/g

const found = (text: string, pattern: RegExp) => [...new Set([...text.matchAll(pattern)].map((match) => match[0]))]

export function classifyPersona(specialMark: string | null | undefined): PersonaResult {
  const text = (specialMark ?? '').replace(NEGATED, ' ')
  const wary = found(text, WARY)
  const friendly = found(text, FRIENDLY)
  const matched = [...wary, ...friendly]
  if (wary.length && friendly.length) return { persona: 'default', matched }
  if (wary.length) return { persona: 'wary', matched }
  if (friendly.length) return { persona: 'friendly', matched }
  return { persona: 'default', matched }
}

/** 개발용 ?persona=wary|friendly|default (판별 결과를 덮어쓴다). 다른 값이면 null */
export function readPersona(value: string | null): Persona | null {
  return value === 'wary' || value === 'friendly' || value === 'default' ? value : null
}
