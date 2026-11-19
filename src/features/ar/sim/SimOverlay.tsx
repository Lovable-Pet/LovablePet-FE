import type { SimView } from './simSession'

/**
 * 개발용 PC 시뮬레이션(?sim=1) 화면: 발자취·쓸고 지나가는 자리·(3인칭) 사용자를 그리는 캔버스와 구석의 키 도움말 한 줄 (H 로 숨김).
 * ArPage 에서 import.meta.env.DEV 일 때만 그린다
 */
export function SimOverlay({
  setCanvas,
  help,
  eye,
  lower,
  view,
}: {
  setCanvas: (canvas: HTMLCanvasElement | null) => void
  help: boolean
  eye: number
  lower: boolean
  view: SimView
}) {
  return (
    <>
      <canvas ref={setCanvas} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
      <p className="pointer-events-none absolute left-2 top-[calc(116px+env(safe-area-inset-top))] max-w-[calc(100%-16px)] rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] leading-snug text-amber-200">
        {help
          ? `[sim] WASD 이동 · Shift 느리게 · Q/E·드래그 방향 · R/F 폰 ${eye.toFixed(2)} m · L 아래층 ${lower ? '켬' : '끔'} · Tab ${view === 'first' ? '1인칭' : '3인칭'} · 1~6 개 · H 숨김`
          : '[sim] H 도움말'}
      </p>
    </>
  )
}
