import { AlertCircle, Phone, RotateCcw, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PetDetail } from '../../../apis/dto/pet.dto'
import { NEUTERED_LABEL, PUPPY_NOTICE, SEX_LABEL } from '../../../constants/pet'
import { formatAge, formatWeight, isLikelyPuppy, toTelHref } from '../../../utils/pet'
import { AR_TEXT, INFO_LABEL } from '../arText'
import { blockXrSelectRef } from '../blockXrSelect'

/** 'YYYY-MM-DD' → 'YYYY.MM.DD' */
const formatDate = (date: string) => date.replaceAll('-', '.')

/**
 * 이름·체고 알약을 누르면 아래에서 올라오는 정보 시트 (AR 화면 위에 반투명).
 * model-viewer 의 자식으로 둬야 WebXR 화면에도 보이고, 누를 때 XR select 가 되지 않게 막는다.
 * 뒤를 누르거나 닫기를 누르면 닫힌다
 */
export function ArInfoSheet({
  pet,
  withersCm,
  onClose,
  onReplace,
  onResetFloor,
}: {
  pet: PetDetail
  withersCm: number
  onClose: () => void
  /** 다시 놓기 (AR 에서 직접 놓은 뒤에만) */
  onReplace: (() => void) | null
  /** 개발용 ?debug 바닥 다시 찾기 */
  onResetFloor: (() => void) | null
}) {
  const weight = formatWeight(pet.weightKg)
  const rows: { label: string; value: ReactNode }[] = [
    { label: INFO_LABEL.age, value: formatAge(pet.ageText) },
    { label: INFO_LABEL.weight, value: weight ? <span className="font-mono">{weight}</span> : pet.weightText || INFO_LABEL.noWeight },
    { label: INFO_LABEL.sex, value: `${SEX_LABEL[pet.sex]} · ${NEUTERED_LABEL[pet.neutered]}` },
    { label: INFO_LABEL.mark, value: pet.specialMark },
    {
      label: INFO_LABEL.shelter,
      value: (
        <>
          {pet.careName}
          {pet.careTel && (
            <a
              href={toTelHref(pet.careTel)}
              className="mt-1 flex h-11 w-fit items-center gap-1.5 rounded-full bg-white/12 px-3.5 font-mono text-body text-white active:bg-white/20"
            >
              <Phone className="size-4" strokeWidth={2} aria-hidden />
              {pet.careTel}
            </a>
          )}
        </>
      ),
    },
    { label: INFO_LABEL.noticeEnd, value: <span className="font-mono">{formatDate(pet.noticeEnd)}</span> },
  ]

  return (
    <div ref={blockXrSelectRef} className="pointer-events-auto absolute inset-0 flex flex-col justify-end">
      <button type="button" aria-label={AR_TEXT.infoClose} onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/30" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${pet.displayName} ${AR_TEXT.info}`}
        className="relative max-h-[78%] animate-sheet-up overflow-y-auto rounded-t-sheet bg-black/80 px-5 pt-4 pb-[calc(20px+env(safe-area-inset-bottom))] text-on-dark backdrop-blur-md"
      >
        <header className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pt-2">
            <h2 className="text-subtitle font-bold text-white">{pet.displayName}</h2>
            <p className="mt-0.5 text-label text-measure">
              {AR_TEXT.withers} <span className="font-mono">{withersCm}cm</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={AR_TEXT.infoClose}
            className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-white active:bg-white/10"
          >
            <X className="size-5.5" strokeWidth={2} aria-hidden />
          </button>
        </header>

        <dl className="mt-3 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-body">
          {rows.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-on-dark-tertiary">{label}</dt>
              <dd className="text-on-dark">{value || '–'}</dd>
            </div>
          ))}
        </dl>

        {isLikelyPuppy(pet.birthYear) && (
          <p className="mt-3 flex gap-1.5 rounded-input bg-dark-notice px-3 py-2 text-label text-dark-notice-ink">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-measure" strokeWidth={2} aria-hidden />
            {PUPPY_NOTICE}
          </p>
        )}

        {(onReplace || (import.meta.env.DEV && onResetFloor)) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {onReplace && (
              <button
                type="button"
                onClick={onReplace}
                className="flex h-11 items-center gap-1.5 rounded-full bg-white/12 px-4 text-body font-semibold text-white active:bg-white/20"
              >
                <RotateCcw className="size-4" strokeWidth={2.2} aria-hidden />
                {AR_TEXT.replace}
              </button>
            )}
            {/* 개발용 문구는 배포 파일에 들어가지 않게 DEV 안에만 둔다 */}
            {import.meta.env.DEV && onResetFloor && (
              <button
                type="button"
                onClick={onResetFloor}
                className="h-11 rounded-full bg-black/65 px-3 font-mono text-[11px] text-lime-300 active:bg-black/80"
              >
                [dev] 바닥 다시 찾기
              </button>
            )}
          </div>
        )}

        <p className="mt-4 text-caption text-on-dark-tertiary">{AR_TEXT.disclaimer}</p>
      </section>
    </div>
  )
}
