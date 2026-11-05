import { AlertCircle, Box, Clock } from 'lucide-react'
import { Link } from 'react-router'
import type { PetDetail, PetModelView } from '../../../../apis/dto/pet.dto'
import { buttonStyles } from '../../../../components/Button/buttonStyles'
import { PUPPY_NOTICE, TEMPLATE_LABEL } from '../../../../constants/pet'
import { formatMonthDay, isLikelyPuppy, isMetFamily, toTelHref, toWithersCm } from '../../../../utils/pet'
import { toSearchParams } from '../../browseQuery'
import { MeasureRuler } from './MeasureRuler'

/** 5.00 → "5", 6.5 → "6.5" */
const weightNumber = (weightKg: number) => String(Number(weightKg.toFixed(1)))

export interface SizeCardProps {
  pet: PetDetail
  /** CLOSED(입양·반환 등으로 종료)면 크기 카드 대신 E 카드 */
  closed: boolean
}

/**
 * 상세의 크기 카드. 캔버스 05의 상태별로 고른다
 * - E 보호 종료 → ClosedCard
 * - C 체중 없음 → NoWeightCard
 * - B 모델 없음 → NoModelCard
 * - 그 외 → 실제 크기 카드 (A 1살 미만이면 안내 추가)
 */
export function SizeCard({ pet, closed }: SizeCardProps) {
  if (closed) return <ClosedCard pet={pet} />
  if (pet.weightKg === null) return <NoWeightCard pet={pet} />
  if (pet.model === null) return <NoModelCard pet={pet} weightKg={pet.weightKg} />
  return <RealSizeCard pet={pet} model={pet.model} weightKg={pet.weightKg} />
}

function RealSizeCard({ pet, model, weightKg }: { pet: PetDetail; model: PetModelView; weightKg: number }) {
  const withersCm = toWithersCm(model.withersM)
  const weight = weightNumber(weightKg)

  return (
    <section aria-labelledby="size-title" className="rounded-sheet bg-ink p-5 text-white">
      <div className="flex items-center justify-between">
        <h2 id="size-title" className="text-body-lg font-semibold text-on-dark">
          이 아이의 실제 크기
        </h2>
        <span className="text-caption text-on-dark-tertiary">지금 체중 기준</span>
      </div>

      <dl className="mt-3.5 flex items-end gap-6">
        <div>
          <dt className="text-label text-on-dark-tertiary">체고 (땅~어깨)</dt>
          <dd className="mt-0.5 font-mono text-[44px] leading-12 font-semibold tracking-[-0.03em] text-measure">
            {withersCm}
            <span className="ml-0.5 text-[20px]">cm</span>
          </dd>
        </div>
        <div>
          <dt className="text-label text-on-dark-tertiary">체중</dt>
          <dd className="mt-0.5 mb-1.5 font-mono text-[22px] font-semibold">
            {weight}
            <span className="ml-0.5 text-body">kg</span>
          </dd>
        </div>
        <div>
          <dt className="text-label text-on-dark-tertiary">체형</dt>
          <dd className="mt-0.5 mb-1.5 text-emphasis font-semibold">{TEMPLATE_LABEL[model.template] ?? '기본형'}</dd>
        </div>
      </dl>

      <MeasureRuler valueCm={withersCm} />

      <p className="mt-3.5 text-label text-on-dark-secondary">
        공고 체중 {weight}kg에서 계산한 지금 크기예요. 3D 모델이 이 크기 그대로 우리 집 바닥에 놓여요.
      </p>

      {isLikelyPuppy(pet.birthYear) && (
        <div className="mt-3.5 flex gap-2 rounded-input bg-dark-notice p-3">
          <AlertCircle className="mt-px size-4.5 shrink-0 text-measure" strokeWidth={2} aria-hidden />
          <p className="text-label text-dark-notice-ink">{PUPPY_NOTICE}</p>
        </div>
      )}

      <Link
        to={`/pets/${pet.id}/ar`}
        className={buttonStyles({ variant: 'measure', fullWidth: true, className: 'mt-4' })}
      >
        <Box className="size-5" strokeWidth={2} aria-hidden />
        우리 집에 놓아 보기
      </Link>

      <details className="group mt-3">
        <summary className="flex min-h-8 cursor-pointer items-center text-label text-on-dark-secondary">
          3D 모델은 어떻게 만들었나요?
        </summary>
        <p className="mt-1 text-label text-on-dark-tertiary">
          몸 형태는 체형별 기본 모델을 쓰고, 털색·무늬만 공고 사진에서 읽어 입혔어요. 그래서 크기는 정확하지만 귀
          모양이나 털 길이는 실제와 조금 다를 수 있어요.
        </p>
      </details>
    </section>
  )
}

/** B: 모델 없음 */
function NoModelCard({ pet, weightKg }: { pet: PetDetail; weightKg: number }) {
  return (
    <section aria-labelledby="size-title" className="rounded-sheet border border-line bg-surface p-5">
      <h2 id="size-title" className="text-body-lg font-semibold">
        이 아이의 크기
      </h2>
      <dl className="mt-3">
        <dt className="text-label text-ink-caption">체중</dt>
        <dd className="mt-0.5 font-mono text-[28px] leading-9 font-semibold">
          {weightNumber(weightKg)}
          <span className="ml-0.5 text-body-lg">kg</span>
        </dd>
      </dl>
      <p className="mt-3 text-label text-ink-tertiary">
        이 아이는 아직 AR로 볼 수 없어요. 체중만으로는 실제 크기가 잘 그려지지 않으니, 보호소에 키를 물어보는 것도
        좋아요.
      </p>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <a href={toTelHref(pet.careTel)} className={buttonStyles({ variant: 'outline', size: 'md' })}>
          보호소 문의
        </a>
        <Link
          to={`/?${toSearchParams({ hasModel: true, sort: 'NEWEST' })}`}
          className={buttonStyles({ variant: 'dark', size: 'md' })}
        >
          AR 가능한 아이 보기
        </Link>
      </div>
    </section>
  )
}

/** C: 체중 정보 없음 */
function NoWeightCard({ pet }: { pet: PetDetail }) {
  return (
    <section aria-labelledby="size-title" className="rounded-sheet border border-line bg-surface p-5">
      <h2 id="size-title" className="text-body-lg font-semibold">
        이 아이의 실제 크기
      </h2>
      <p className="mt-2.5 text-body-lg text-ink-secondary">공고에 체중이 적혀 있지 않아 실제 크기를 계산할 수 없어요.</p>
      <p className="mt-1.5 text-label text-ink-caption">
        공고 원문: <span className="font-mono">{pet.weightText || '미상'}</span>
      </p>
      <a
        href={toTelHref(pet.careTel)}
        className={buttonStyles({ variant: 'outline', size: 'md', fullWidth: true, className: 'mt-3.5' })}
      >
        보호소에 체중 물어보기
      </a>
    </section>
  )
}

/** E: 입양·반환 등으로 보호가 끝남. 비슷한 크기 아이들 보기는 하단 바에 있다 */
function ClosedCard({ pet }: { pet: PetDetail }) {
  return (
    <section className="rounded-sheet border border-line bg-surface p-5 text-center">
      <h2 className="text-subtitle font-bold">
        {isMetFamily(pet.processState) ? '이 아이는 가족을 만났어요' : '보호가 끝난 아이예요'}
      </h2>
      <p className="mt-1.5 text-body text-ink-tertiary">
        찜 목록에는 그대로 남아 있어요.
        <br />
        비슷한 크기의 다른 아이를 만나 보세요.
      </p>
    </section>
  )
}

/** D: 공고 기간 중 (보호중, noticeEnd 전). 크기 카드 위에 같이 보인다 */
export function InNoticeBanner({ noticeEnd }: { noticeEnd: string }) {
  return (
    <section className="flex gap-2.5 rounded-card-lg border border-notice-line bg-notice p-4">
      <Clock className="mt-px size-5 shrink-0 text-accent-ink" strokeWidth={2} aria-hidden />
      <div>
        <p className="text-body-lg font-semibold text-notice-ink">원래 가족을 찾는 기간이에요</p>
        <p className="mt-1 text-label text-notice-ink">
          <span className="font-mono">{formatMonthDay(noticeEnd)}</span> 공고가 끝나면 입양을 신청할 수 있어요. 그
          전에도 크기는 미리 확인해 둘 수 있어요.
        </p>
      </div>
    </section>
  )
}
