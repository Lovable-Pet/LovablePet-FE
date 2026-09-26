import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Layout } from '../../components/Layout/Layout'
import { Button } from '../../components/Button/Button'
import { Chip } from '../../components/Chip/Chip'
import { Toggle } from '../../components/Toggle/Toggle'

const housingOptions = ['아파트', '단독주택', '원룸/빌라']
const activityOptions = ['오전', '오후', '저녁/밤']

export function OnboardingPage() {
  const [housing, setHousing] = useState(housingOptions[0])
  const [activity, setActivity] = useState(activityOptions[0])
  const [hasOtherPet, setHasOtherPet] = useState(false)
  const [remoteWork, setRemoteWork] = useState(false)

  return (
    <Layout
      footer={
        <div className="px-6 py-4">
          <Button size="lg" className="w-full">
            다음 단계로 이동
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <button type="button" aria-label="back">
          <ChevronLeft className="size-6 text-base-950" />
        </button>
        <h1 className="font-[Sora] text-[18px] font-bold text-base-950">라이프스타일 설문</h1>
      </div>

      <div className="px-6">
        <div className="h-[6px] w-full rounded-full bg-base-200">
          <div className="h-[6px] w-[33%] rounded-full bg-primary-500" />
        </div>
        <p className="mt-2 text-[13px] text-base-500">1 / 3 단계</p>
      </div>

      <div className="flex flex-1 flex-col gap-8 px-6 py-6">
        <div>
          <h2 className="text-[20px] font-bold text-base-950">
            어떤 곳에서 함께 지낼 예정인가요?
          </h2>
          <p className="mt-1 text-[14px] text-base-500">
            반려동물의 활동량 적합도를 계산하는 데 사용돼요.
          </p>
        </div>

        <div>
          <p className="mb-2 text-[15px] font-semibold text-base-950">주거 형태</p>
          <div className="flex gap-2">
            {housingOptions.map((option) => (
              <Chip key={option} selected={housing === option} onClick={() => setHousing(option)}>
                {option}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[15px] font-semibold text-base-950">주로 활동하는 시간대</p>
          <div className="flex gap-2">
            {activityOptions.map((option) => (
              <Chip
                key={option}
                selected={activity === option}
                onClick={() => setActivity(option)}
              >
                {option}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-base-200 p-4">
          <div>
            <p className="text-[14px] font-semibold text-base-950">기존 반려동물 유무</p>
            <p className="text-[12px] text-base-500">함께 지내는 다른 동물이 있어요</p>
          </div>
          <Toggle checked={hasOtherPet} onChange={setHasOtherPet} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-base-200 p-4">
          <div>
            <p className="text-[14px] font-semibold text-base-950">재택 근무 여부</p>
            <p className="text-[12px] text-base-500">분리불안 적합도 계산에 반영돼요</p>
          </div>
          <Toggle checked={remoteWork} onChange={setRemoteWork} />
        </div>
      </div>
    </Layout>
  )
}
