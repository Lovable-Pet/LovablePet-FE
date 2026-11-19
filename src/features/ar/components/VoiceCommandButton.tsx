import { Mic } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '../../../components/utils/cn'
import type { CommandId } from '../dogAnimator'
import { useVoiceCommand } from '../useVoiceCommand'

/**
 * 마이크 버튼과 들은 말 말풍선. AR 화면 아래 오버레이(명령 칩 바로 위)에 둔다.
 * 오버레이 안이라 WebXR 의 XR select 막기(beforexrselect)가 이 버튼에도 걸린다.
 * 음성 인식이 없는 브라우저에서는 그리지 않는다
 */
export function VoiceCommandButton({
  inAr,
  disabled = false,
  onCommand,
  onMiss,
  onListen,
  idleHint,
}: {
  inAr: boolean
  /** AR 에서 개를 놓기 전. 누를 수 없고, 듣는 중이었으면 조용히 멈춘다 */
  disabled?: boolean
  onCommand: (id: CommandId) => void
  /** 들린 말에서 명령을 못 찾았을 때 ('알아듣지 못했어요' 문구는 여기서 띄운다) */
  onMiss?: () => void
  /** 듣기 시작할 때 (개가 사용자를 바라본다) */
  onListen?: () => void
  /** 듣지 않고 보일 말풍선도 없을 때 마이크 옆에 흐리게 보이는 한 줄 (3초 누르기 안내) */
  idleHint?: string
}) {
  const { supported, listening, heard, flash, toggle } = useVoiceCommand({ inAr, disabled, onCommand, onMiss })
  const onListenRef = useRef(onListen)
  useEffect(() => {
    onListenRef.current = onListen
  })
  useEffect(() => {
    if (listening) onListenRef.current?.()
  }, [listening])
  if (!supported) return null

  const bubble = listening ? (heard ? `“${heard}”` : '듣고 있어요…') : flash?.text

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label="말로 명령하기"
        aria-pressed={listening}
        className={cn(
          'pointer-events-auto relative flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-97 disabled:opacity-45',
          listening ? 'bg-measure text-ink' : 'bg-black/55 text-white',
        )}
      >
        {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-measure/60" />}
        <Mic className="relative size-5" strokeWidth={2} aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p aria-live="polite">
          {bubble && (
            <span
              key={listening ? 'listening' : flash?.id}
              className="inline-block max-w-full animate-toast-in rounded-2xl bg-black/55 px-3 py-1.5 text-label text-white [overflow-wrap:anywhere]"
            >
              {bubble}
            </span>
          )}
        </p>
        {/* 말풍선이 없을 때만. 바뀔 때마다 읽히지 않게 aria-live 밖에 둔다 */}
        {!bubble && idleHint && (
          <p className="text-label text-on-dark-secondary [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">{idleHint}</p>
        )}
      </div>
    </div>
  )
}
