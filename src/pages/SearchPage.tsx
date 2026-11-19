import { useState, type ReactNode } from 'react'
import { Box, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import type { PetFilterOption } from '../apis/dto/pet.dto'
import { Button } from '../components/Button/Button'
import { Character } from '../components/Character/Character'
import { Chip } from '../components/Chip/Chip'
import { WEIGHT_PRESETS, type WeightPresetKey } from '../constants/pet'
import {
  EMPTY_FILTERS,
  parseBrowseQuery,
  toListParams,
  toSearchParams,
  weightPresetOf,
  type BrowseFilters,
} from '../features/pet/browseQuery'
import { usePetCount, usePetFilters } from '../features/pet/queries'

/** 처음에는 마릿수가 많은 것만 보이고, 나머지는 '더 보기'로 편다 */
const FOLDED_COUNT = 8

// /search — 지역·품종·크기·AR 로 찾기. 고르면 아래 버튼의 마릿수가 바뀌고, 누르면 홈 목록에 적용된다
export function SearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const applied = parseBrowseQuery(searchParams)
  const [draft, setDraft] = useState<BrowseFilters>(applied)
  const [keyword, setKeyword] = useState('')
  const { data: options, isError } = usePetFilters()
  const { data: count } = usePetCount(toListParams({ ...draft, sort: 'NEWEST' }))
  const preset = weightPresetOf(draft)

  const pickPreset = (key: WeightPresetKey) => {
    const { minWeight, maxWeight } = WEIGHT_PRESETS[key]
    setDraft((prev) => (preset === key ? { ...prev, minWeight: undefined, maxWeight: undefined } : { ...prev, minWeight, maxWeight }))
  }

  return (
    <main className="px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-24">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-title">
          어떤 유기견을
          <br />
          찾고 있나요?
        </h1>
        <Character name="searching" size={92} className="-mb-1" />
      </div>

      <label className="mt-4 flex h-12 items-center gap-2.5 rounded-full bg-surface px-4 shadow-soft focus-within:shadow-[inset_0_0_0_2px_var(--color-primary)]">
        <Search className="size-5 shrink-0 text-ink-mute" strokeWidth={2.2} aria-hidden />
        <input
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="지역이나 품종 이름을 적어 보세요"
          aria-label="지역·품종 이름으로 거르기"
          className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-mute"
        />
      </label>

      <Group title="크기" note="공고에 적힌 지금 체중 기준이에요">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(WEIGHT_PRESETS) as WeightPresetKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={preset === key}
              onClick={() => pickPreset(key)}
              className={
                'flex flex-col items-center rounded-tile px-2 py-3.5 transition-[background-color,scale] duration-150 active:scale-[0.96] ' +
                (preset === key ? 'bg-primary text-white' : 'bg-surface text-ink-soft shadow-soft')
              }
            >
              <span className="font-display text-emphasis">{WEIGHT_PRESETS[key].label}견</span>
              <span className="text-caption tabular-nums">{WEIGHT_PRESETS[key].range}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="AR">
        <Chip selected={!!draft.hasModel} onClick={() => setDraft((prev) => ({ ...prev, hasModel: prev.hasModel ? undefined : true }))}>
          <Box className="size-4" strokeWidth={2.2} aria-hidden />
          우리 집에 놓아 볼 수 있는 유기견만
        </Chip>
      </Group>

      {isError && (
        <p role="alert" className="mt-6 rounded-tile bg-pink-soft px-4 py-3 text-label font-bold text-pink-deep">
          지역과 품종 목록을 불러오지 못했어요. 크기로만 고를 수 있어요.
        </p>
      )}

      <OptionGroup
        title="지역"
        unit="곳"
        keyword={keyword}
        options={options?.regions}
        value={draft.region}
        onChange={(region) => setDraft((prev) => ({ ...prev, region }))}
      />
      <OptionGroup
        title="품종"
        unit="종"
        keyword={keyword}
        options={options?.kinds}
        value={draft.kind}
        onChange={(kind) => setDraft((prev) => ({ ...prev, kind }))}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 flex justify-center">
        <div className="pointer-events-auto flex w-full max-w-[480px] gap-2.5 bg-gradient-to-t from-canvas from-60% to-transparent px-5 pt-6 pb-4">
          <Button variant="outline" size="lg" onClick={() => setDraft(EMPTY_FILTERS)}>
            지우기
          </Button>
          <Button
            size="lg"
            full
            disabled={count === 0}
            onClick={() => navigate(`/?${toSearchParams({ ...draft, sort: applied.sort })}`)}
          >
            {count === undefined ? (
              '유기견 보기'
            ) : count === 0 ? (
              '맞는 유기견이 없어요'
            ) : (
              <span className="tabular-nums">{count.toLocaleString()}마리 보기</span>
            )}
          </Button>
        </div>
      </div>
    </main>
  )
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display text-emphasis">{title}</h2>
      {note && <p className="mt-0.5 text-caption text-ink-mute">{note}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

function OptionGroup({
  title,
  unit,
  keyword,
  options,
  value,
  onChange,
}: {
  title: string
  /** '8곳 더 보기'의 단위 */
  unit: string
  /** 검색창에 적은 글자. 있으면 이름에 그 글자가 든 것만 모두 보인다 */
  keyword: string
  options: PetFilterOption[] | undefined
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (!options || options.length === 0) return null

  const trimmed = keyword.trim()
  const matched = trimmed ? options.filter((option) => option.name.includes(trimmed)) : options
  // 접혀 있어도 고른 값은 보이게 한다
  const folded = matched.slice(0, FOLDED_COUNT)
  const picked = value ? options.find((option) => option.name === value) : undefined
  const visible = expanded || trimmed ? matched : picked && !folded.includes(picked) ? [...folded, picked] : folded
  const hiddenCount = matched.length - FOLDED_COUNT

  return (
    <Group title={title}>
      {visible.length === 0 ? (
        <p className="text-label text-ink-mute">'{trimmed}'이 들어간 {title}이 없어요.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((option) => (
            <Chip key={option.name} selected={value === option.name} onClick={() => onChange(value === option.name ? undefined : option.name)}>
              {option.name}
              <span className="font-normal tabular-nums opacity-75">{option.count.toLocaleString()}</span>
            </Chip>
          ))}
          {!trimmed && hiddenCount > 0 && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((prev) => !prev)}
              className="h-10 rounded-full px-3 text-label font-bold text-primary-deep"
            >
              {expanded ? '접기' : `${hiddenCount}${unit} 더 보기`}
            </button>
          )}
        </div>
      )}
    </Group>
  )
}
