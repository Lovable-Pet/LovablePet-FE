import type { PetSex } from '../../../apis/dto/pet.dto'
import { cn } from '../../../components/utils/cn'
import { SEX_LABEL } from '../../../constants/pet'

/** 성별 기호 (암컷 분홍, 수컷 파랑). 미상이면 그리지 않는다 */
export function SexSymbol({ sex, className }: { sex: PetSex; className?: string }) {
  if (sex === 'Q') return null
  return (
    <span
      role="img"
      aria-label={SEX_LABEL[sex]}
      className={cn('shrink-0 font-sans font-extrabold', sex === 'F' ? 'text-primary' : 'text-sky-deep', className)}
    >
      {sex === 'F' ? '♀' : '♂'}
    </span>
  )
}
