import { Footprints, Heart, Mic, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../../components/utils/cn'
import { AR_TEXT } from '../arText'
import { COMMANDS, type CommandId } from '../dogAnimator'

/** 묘기 트레이 (3×2). 굴러는 칩에서만 뺀다 (클립·음성 '굴러'는 그대로) */
const TRAY_COMMANDS = COMMANDS.filter((command) => command.id !== 'rollover')

const TRAY_ID = 'ar-trick-tray'

/** 말 걸기 버튼이 쓰는 음성 상태 (useVoiceCommand) */
export interface TalkState {
  listening: boolean
  /** 듣는 중에 들린 말 */
  heard: string
  /** 들은 말·오류 말풍선 */
  flash: { id: number; text: string } | null
  toggle: () => void
}

/**
 * AR 화면 아래: [묘기 | 말 걸기 | 산책] 세 버튼과 그 위 묘기 트레이·들은 말 말풍선.
 * 가운데 말 걸기가 가장 크다. 없는 버튼(음성 인식 없음·걷기 클립 없음)은 빼고 남은 버튼을 가운데로 모은다.
 * 명령 클립이 없는 모델은 묘기 자리에 '꼬리 흔들기' 하나
 */
export function ArControls({
  hasCommands,
  talk,
  talkDisabled,
  trayOpen,
  onToggleTray,
  tricksDisabled,
  commandsDisabled,
  active,
  onCommand,
  onWag,
  wagDisabled,
  walk,
  idleHint,
}: {
  hasCommands: boolean
  /** 음성 인식이 없으면 null (버튼을 뺀다) */
  talk: TalkState | null
  talkDisabled: boolean
  trayOpen: boolean
  onToggleTray: () => void
  tricksDisabled: boolean
  /** 트레이 안 명령 칩 (불러오는 중·놓기 전·몸 돌리는 중) */
  commandsDisabled: boolean
  /** 마지막으로 누른 명령 (칩 강조) */
  active: CommandId | null
  onCommand: (id: CommandId) => void
  onWag: () => void
  wagDisabled: boolean
  /** 걷기를 못 하는 개·화면 안 3D 는 null */
  walk: { onStart: () => void; disabled: boolean } | null
  /** 말풍선이 없을 때 흐린 한 줄 */
  idleHint?: string
}) {
  const bubble = talk?.listening ? (talk.heard ? `“${talk.heard}”` : '듣고 있어요…') : talk?.flash?.text

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex min-h-8 w-full flex-col items-center justify-center text-center">
        <p aria-live="polite" className="max-w-full">
          {bubble && (
            <span
              key={talk?.listening ? 'listening' : talk?.flash?.id}
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

      {hasCommands && trayOpen && (
        <div
          id={TRAY_ID}
          role="group"
          aria-label={AR_TEXT.tricksTray}
          className="pointer-events-auto grid w-full animate-rise-in grid-cols-3 gap-2 rounded-card bg-black/45 p-2"
        >
          {TRAY_COMMANDS.map((command) => (
            <button
              key={command.id}
              type="button"
              disabled={commandsDisabled}
              onClick={() => onCommand(command.id)}
              className={cn(
                'h-11 rounded-full px-2 text-body font-semibold transition active:scale-97 disabled:opacity-45',
                active === command.id ? 'bg-measure text-ink' : 'bg-black/55 text-white',
              )}
            >
              {command.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end justify-center gap-5">
        {hasCommands ? (
          <RoundButton
            label={AR_TEXT.tricks}
            icon={<Sparkles className="size-6" strokeWidth={2} aria-hidden />}
            onClick={onToggleTray}
            disabled={tricksDisabled}
            pressed={trayOpen}
            controls={TRAY_ID}
          />
        ) : (
          <RoundButton
            label={AR_TEXT.wag}
            icon={<Heart className="size-6" strokeWidth={2} aria-hidden />}
            onClick={onWag}
            disabled={wagDisabled}
          />
        )}
        {talk && (
          <RoundButton
            label={AR_TEXT.talk}
            big
            icon={<Mic className="relative size-8" strokeWidth={2} aria-hidden />}
            onClick={talk.toggle}
            disabled={talkDisabled}
            listening={talk.listening}
          />
        )}
        {walk && (
          <RoundButton
            label={AR_TEXT.walk}
            icon={<Footprints className="size-6" strokeWidth={2} aria-hidden />}
            onClick={walk.onStart}
            disabled={walk.disabled}
          />
        )}
      </div>
    </div>
  )
}

function RoundButton({
  label,
  icon,
  onClick,
  disabled,
  big = false,
  pressed,
  controls,
  listening = false,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled: boolean
  big?: boolean
  /** 트레이 같은 펼침 버튼 (aria-expanded) */
  pressed?: boolean
  controls?: string
  /** 말 걸기: 듣는 중 */
  listening?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={pressed}
      aria-controls={controls}
      aria-pressed={big ? listening : undefined}
      className="group pointer-events-auto flex w-20 flex-col items-center gap-1 disabled:opacity-45"
    >
      <span
        className={cn(
          'relative flex items-center justify-center rounded-full transition group-active:scale-97',
          big ? 'size-18' : 'size-14',
          big || pressed || listening ? 'bg-measure text-ink' : 'bg-black/55 text-white',
          big && 'shadow-[0_2px_10px_rgb(0_0_0/0.35)]',
        )}
      >
        {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-measure/60" />}
        {icon}
      </span>
      <span className="text-label font-semibold text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">{label}</span>
    </button>
  )
}
