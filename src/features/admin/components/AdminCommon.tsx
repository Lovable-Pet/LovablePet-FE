import type { PetModelStatus } from '../../../apis/dto/admin.dto'
import { Badge } from '../../../components/Badge/Badge'
import { StateView } from '../../../components/StateView/StateView'
import { MODEL_STATUS_LABEL, MODEL_STATUS_TONE } from '../../../constants/admin'

/** 생성 상태 딱지 */
export function StatusBadge({ status }: { status: PetModelStatus }) {
  return <Badge tone={MODEL_STATUS_TONE[status]}>{MODEL_STATUS_LABEL[status]}</Badge>
}

/** 오늘 만든 횟수 / 하루 한도 */
export function UsageMeter({ todayCount, dailyLimit }: { todayCount: number; dailyLimit: number }) {
  const ratio = dailyLimit > 0 ? Math.min(1, todayCount / dailyLimit) : 0
  const full = todayCount >= dailyLimit
  return (
    <div className="rounded-card bg-pink-soft p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-label font-bold text-ink-soft">오늘 만든 횟수</p>
        <p className="text-body tabular-nums">
          <span className="text-heading font-extrabold">{todayCount}</span> / {dailyLimit}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="오늘 사용량"
        aria-valuemin={0}
        aria-valuemax={dailyLimit}
        aria-valuenow={todayCount}
        className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-surface"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${full ? 'bg-primary-deep' : 'bg-primary'}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {full && <p className="mt-2 text-caption font-bold text-pink-deep">오늘 한도를 다 썼어요. 내일 다시 만들 수 있어요.</p>}
    </div>
  )
}

/** 서버가 관리자가 아니라고 답했을 때 */
export function ForbiddenView() {
  return (
    <StateView
      tone="error"
      title="관리자만 볼 수 있어요"
      description="관리자 계정으로 다시 로그인해 주세요."
    />
  )
}
