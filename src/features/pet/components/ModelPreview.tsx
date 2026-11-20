import '@google/model-viewer'
import type { ModelViewerElement } from '@google/model-viewer'
import { useEffect, useRef, useState } from 'react'
import { PawDots } from '../../../components/LoadingScreen/LoadingScreen'

type Status = 'loading' | 'ready' | 'failed'

/**
 * 홈 캐러셀 카드 뒷면에 띄우는 3D 모델의 정지 그림. 돌리거나 키울 수 없다.
 * 서버가 찍어 둔 미리보기 그림(model.previewUrl)이 없을 때만 쓴다.
 * 그 그림은 이 파일과 같은 설정(camera-orbit, shadow-*, 카드 비율 4:3.1, model-viewer 버전)으로 찍으므로,
 * 여기 값을 바꾸면 백엔드의 preview/index.html 도 같이 바꾸고 그림을 다시 찍어야 한다.
 * 3D 라이브러리가 커서 이 파일은 카드를 처음 뒤집을 때 불러온다 (ArShowcase 의 lazy)
 */
export default function ModelPreview({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<ModelViewerElement>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    const viewer = ref.current
    if (!viewer) return
    const onLoad = () => setStatus('ready')
    const onError = () => setStatus('failed')
    viewer.addEventListener('load', onLoad)
    viewer.addEventListener('error', onError)
    return () => {
      viewer.removeEventListener('load', onLoad)
      viewer.removeEventListener('error', onError)
    }
  }, [])

  return (
    <>
      <model-viewer
        ref={ref}
        src={src}
        alt={alt}
        // 돌려 볼 수 없는 정지 그림으로 쓴다 (서버가 모델 그림을 주면 그 그림으로 바꾼다)
        camera-orbit="35deg 78deg 105%"
        interaction-prompt="none"
        shadow-intensity="1"
        shadow-softness="0.8"
        loading="eager"
        className="pointer-events-none block size-full"
      />
      {status === 'loading' && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <PawDots label="3D 모델을 불러오고 있어요" />
        </span>
      )}
      {status === 'failed' && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-label font-bold text-ink-soft">
          3D 모델을 불러오지 못했어요
        </span>
      )}
    </>
  )
}
