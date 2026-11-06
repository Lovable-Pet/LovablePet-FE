import { useState } from 'react'
import type { PetFilterOption, PetSort } from '../../../apis/dto/pet.dto'
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet'
import { Button } from '../../../components/Button/Button'
import { Chip } from '../../../components/Chip/Chip'
import { Toggle } from '../../../components/Toggle/Toggle'
import { cn } from '../../../components/utils/cn'
import { WEIGHT_PRESETS, type WeightPresetKey } from '../../../constants/pet'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { EMPTY_FILTERS, toListParams, weightPresetOf, type BrowseFilters } from '../browseQuery'
import { usePetCount, usePetFilters } from '../queries'

export interface FilterSheetProps {
  /** 시트를 열 때의 조건 (시트 안에서는 초안으로 고친다) */
  initial: BrowseFilters
  /** 마릿수 집계에 같이 쓰는 지금 정렬 */
  sort: PetSort
  onApply: (filters: BrowseFilters) => void
  onClose: () => void
}

const PRESET_KEYS = Object.keys(WEIGHT_PRESETS) as WeightPresetKey[]

/** 품종은 많을 수 있어서 처음엔 마릿수 많은 순으로 이만큼만 보인다 */
const KIND_PREVIEW_COUNT = 12

const parseWeightInput = (value: string) => {
  if (value.trim() === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

export function FilterSheet({ initial, sort, onApply, onClose }: FilterSheetProps) {
  const [draft, setDraft] = useState<BrowseFilters>(initial)
  const update = (patch: Partial<BrowseFilters>) => setDraft((prev) => ({ ...prev, ...patch }))

  // 초안이 바뀔 때마다 바로 세지 않고 300ms 멈추면 센다
  const debouncedDraft = useDebouncedValue(draft, 300)
  const { data: count } = usePetCount(toListParams({ ...debouncedDraft, sort }))
  const { data: options, isError: optionsError } = usePetFilters()

  const preset = weightPresetOf(draft)

  return (
    <BottomSheet
      title="필터"
      onClose={onClose}
      footer={
        <div className="flex gap-2 px-5 pt-3 pb-7">
          <Button variant="outline-subtle" onClick={() => setDraft(EMPTY_FILTERS)}>
            초기화
          </Button>
          <Button className="flex-1" onClick={() => onApply(draft)}>
            <span>
              <span className="mr-0.5 font-mono">{count?.toLocaleString() ?? '–'}</span>마리 보기
            </span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-7 px-5 pt-1 pb-6">
        <section className="flex items-center justify-between gap-4 rounded-card border border-notice-line bg-notice p-4">
          <div>
            <p className="text-body-lg font-semibold">AR로 볼 수 있는 아이만</p>
            <p className="mt-1 text-label text-ink-tertiary">3D 모델이 준비돼 우리 집에 바로 놓아 볼 수 있어요</p>
          </div>
          <Toggle
            aria-label="AR로 볼 수 있는 아이만"
            checked={draft.hasModel === true}
            onChange={(checked) => update({ hasModel: checked || undefined })}
          />
        </section>

        <section aria-labelledby="filter-size">
          <h2 id="filter-size" className="mb-3 text-body-lg font-bold">
            크기
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_KEYS.map((key) => {
              const item = WEIGHT_PRESETS[key]
              const selected = preset === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    update(
                      selected
                        ? { minWeight: undefined, maxWeight: undefined }
                        : { minWeight: item.minWeight, maxWeight: item.maxWeight },
                    )
                  }
                  className={cn(
                    'flex h-16 flex-col items-center justify-center gap-0.5 rounded-button border transition active:scale-99',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    selected
                      ? 'border-ink bg-ink text-white hover:bg-ink-hover'
                      : 'border-line bg-surface text-ink hover:bg-surface-hover',
                  )}
                >
                  <span className="text-body-lg font-semibold">{item.label}</span>
                  <span className="font-mono text-caption opacity-80">{item.range}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <WeightInput
              label="최소"
              value={draft.minWeight}
              onChange={(minWeight) => update({ minWeight })}
            />
            <span className="text-ink-caption" aria-hidden>
              ~
            </span>
            <WeightInput
              label="최대"
              value={draft.maxWeight}
              onChange={(maxWeight) => update({ maxWeight })}
            />
          </div>
          <p className="mt-2 text-caption text-ink-caption">공고에 적힌 지금 체중 기준이에요.</p>
        </section>

        <OptionGroup
          title="지역"
          options={options?.regions}
          selected={draft.region}
          onSelect={(region) => update({ region })}
          error={optionsError}
        />
        <OptionGroup
          title="품종"
          options={options?.kinds}
          selected={draft.kind}
          onSelect={(kind) => update({ kind })}
          error={optionsError}
          previewCount={KIND_PREVIEW_COUNT}
        />
      </div>
    </BottomSheet>
  )
}

interface WeightInputProps {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}

function WeightInput({ label, value, onChange }: WeightInputProps) {
  // 입력 중인 글자("1.")를 그대로 보여주려고 글자 상태를 따로 둔다
  const [text, setText] = useState(value === undefined ? '' : String(value))
  const [lastValue, setLastValue] = useState(value)
  // 크기 버튼이나 초기화로 값이 바깥에서 바뀌면 글자도 맞춘다
  if (value !== lastValue) {
    setLastValue(value)
    if (parseWeightInput(text) !== value) setText(value === undefined ? '' : String(value))
  }

  return (
    <label className="flex h-11 flex-1 items-center gap-1.5 rounded-input border border-line px-3 text-label text-ink-caption focus-within:outline-2 focus-within:outline-accent">
      {label}
      <input
        type="text"
        inputMode="decimal"
        aria-label={`${label} 체중`}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          const next = parseWeightInput(event.target.value)
          setLastValue(next)
          onChange(next)
        }}
        // 16px: 아이폰에서 입력할 때 화면이 확대되지 않게
        className="w-full min-w-0 flex-1 bg-transparent text-right font-mono text-emphasis font-semibold text-ink outline-none"
      />
      kg
    </label>
  )
}

interface OptionGroupProps {
  title: string
  options: PetFilterOption[] | undefined
  selected: string | undefined
  onSelect: (value: string | undefined) => void
  error: boolean
  previewCount?: number
}

function OptionGroup({ title, options, selected, onSelect, error, previewCount }: OptionGroupProps) {
  const [expanded, setExpanded] = useState(false)
  const titleId = `filter-${title}`

  const all = options ?? []
  const limited = previewCount !== undefined && !expanded && all.length > previewCount
  // 접혀 있어도 고른 항목은 보이게 한다
  const visible = limited
    ? [...all.slice(0, previewCount), ...all.slice(previewCount).filter((option) => option.name === selected)]
    : all

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="mb-3 text-body-lg font-bold">
        {title}
      </h2>
      {error ? (
        <p className="text-label text-ink-caption">{title} 목록을 불러오지 못했어요.</p>
      ) : !options ? (
        <div className="flex flex-wrap gap-2" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className="h-10 w-20 rounded-full skeleton" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((option) => (
            <Chip
              key={option.name}
              selected={selected === option.name}
              count={option.count}
              onClick={() => onSelect(selected === option.name ? undefined : option.name)}
            >
              {option.name}
            </Chip>
          ))}
          {limited && (
            <Chip onClick={() => setExpanded(true)}>
              {title} 더 보기 <span className="font-mono text-caption">+{all.length - visible.length}</span>
            </Chip>
          )}
        </div>
      )}
    </section>
  )
}
