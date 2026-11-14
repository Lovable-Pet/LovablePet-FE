import { Mic } from 'lucide-react'
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
  onCommand,
  onMiss,
}: {
  inAr: boolean
  onCommand: (id: CommandId) => void
  /** 들린 말에서 명령을 못 찾았을 때 ('알아듣지 못했어요' 문구는 여기서 띄운다) */
  onMiss?: () => void
}) {
  const { supported, listening, heard, flash, toggle } = useVoiceCommand({ inAr, onCommand, onMiss })
  if (!supported) return null

  const bubble = listening ? (heard ? `“${heard}”` : '듣고 있어요…') : flash?.text

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-label="말로 명령하기"
        aria-pressed={listening}
        className={cn(
          'pointer-events-auto relative flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-97',
          listening ? 'bg-measure text-ink' : 'bg-black/55 text-white',
        )}
      >
        {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-measure/60" />}
        <Mic className="relative size-5" strokeWidth={2} aria-hidden />
      </button>
      <p aria-live="polite" className="min-w-0 flex-1">
        {bubble && (
          <span
            key={listening ? 'listening' : flash?.id}
            className="inline-block max-w-full animate-toast-in rounded-2xl bg-black/55 px-3 py-1.5 text-label text-white [overflow-wrap:anywhere]"
          >
            {bubble}
          </span>
        )}
      </p>
    </div>
  )
}
