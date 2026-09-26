import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Layout } from '../../components/Layout/Layout'
import { Toggle } from '../../components/Toggle/Toggle'

export interface ARPreviewPageProps {
  onBack?: () => void
}

export function ARPreviewPage({ onBack }: ARPreviewPageProps) {
  const [fullScale, setFullScale] = useState(true)

  return (
    <Layout dark>
      <div className="flex items-center px-4 py-4">
        <button type="button" aria-label="back" onClick={onBack}>
          <ChevronLeft className="size-6" />
        </button>
        <h1 className="flex-1 text-center text-[16px] font-bold">AR 미리보기</h1>
        <div className="w-6" />
      </div>

      <div className="flex flex-1 items-center justify-center text-[14px] text-base-300">
        카메라 프리뷰 영역
      </div>

      <div className="flex flex-col gap-5 rounded-t-2xl bg-white px-5 py-5 text-base-950">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold">실물 크기로 배치하기</p>
          <Toggle checked={fullScale} onChange={setFullScale} />
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-base-100 p-3">
          <div className="flex size-12 items-center justify-center rounded-lg bg-base-200 text-xl">
            🐶
          </div>
          <div>
            <p className="text-[14px] font-bold">보리</p>
            <p className="text-[12px] text-base-500">골든 리트리버 · 성견 수컷 (24kg)</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
