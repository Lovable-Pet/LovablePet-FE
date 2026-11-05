import { MapPin, Phone } from 'lucide-react'
import { buttonStyles } from '../../../../components/Button/buttonStyles'
import { Button } from '../../../../components/Button/Button'
import { toTelHref } from '../../../../utils/pet'

export interface ShelterCardProps {
  careName: string
  careAddr: string
  careTel: string
  onCopyAddress: () => void
}

export function ShelterCard({ careName, careAddr, careTel, onCopyAddress }: ShelterCardProps) {
  return (
    <section aria-labelledby="shelter-title" className="rounded-card-lg bg-surface p-4">
      <p className="text-label text-ink-caption">보호소</p>
      <h2 id="shelter-title" className="mt-0.5 text-emphasis font-semibold">
        {careName}
      </h2>
      <p className="mt-1 flex items-start gap-1.5 text-body text-ink-secondary">
        <MapPin className="mt-0.75 size-4 shrink-0" strokeWidth={2} aria-hidden />
        {careAddr}
      </p>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <a href={toTelHref(careTel)} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
          <Phone className="size-4" strokeWidth={2} aria-hidden />
          전화하기
        </a>
        <Button variant="outline" size="sm" onClick={onCopyAddress}>
          주소 복사
        </Button>
      </div>
    </section>
  )
}
