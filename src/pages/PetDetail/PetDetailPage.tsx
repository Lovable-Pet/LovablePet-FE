import { AlertTriangle } from 'lucide-react'
import { Layout } from '../../components/Layout/Layout'
import { Badge } from '../../components/Badge/Badge'
import { Button } from '../../components/Button/Button'

const traits = ['매우 활발함', '사람을 좋아함', '종합백신 완료', '사회성 우수']

export interface PetDetailPageProps {
  onViewAR?: () => void
}

export function PetDetailPage({ onViewAR }: PetDetailPageProps) {
  return (
    <Layout
      footer={
        <div className="px-5 py-4">
          <Button size="lg" className="w-full" onClick={onViewAR}>
            AR로 미리보기
          </Button>
        </div>
      }
    >
      <div className="flex h-[280px] items-center justify-center bg-base-100 text-6xl">🐶</div>

      <div className="flex-1 px-5 py-5">
        <h1 className="text-[24px] font-bold text-base-950">보리</h1>
        <p className="mt-1 text-[14px] text-base-500">골든 리트리버 · 2세 · 수컷 (중성화)</p>

        <hr className="my-5 border-base-200" />

        <div className="flex items-center gap-4 rounded-xl bg-primary-50 p-4">
          <div className="flex size-16 items-center justify-center rounded-full border-4 border-primary-500 text-[16px] font-bold text-primary-500">
            94%
          </div>
          <div>
            <p className="text-[15px] font-bold text-base-950">최적의 동반자 조합!</p>
            <p className="text-[13px] text-base-600">
              회원님의 넓은 주거 환경과 저녁 활동 성향에 94% 완벽히 일치합니다.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning-500 bg-warning-50 p-4">
          <AlertTriangle className="size-6 shrink-0 text-warning-500" />
          <div>
            <p className="text-[14px] font-semibold text-base-950">주의가 필요한 항목</p>
            <p className="text-[13px] text-base-600">
              경미한 분리불안 있음 — 재택근무 혹은 다인 가구 권장
            </p>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[15px] font-bold text-base-950">성격 및 건강 정보</p>
          <div className="flex flex-wrap gap-2">
            {traits.map((trait) => (
              <Badge key={trait} color="neutral" variant="outlined" size="sm">
                {trait}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
