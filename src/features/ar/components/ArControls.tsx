import { Footprints, Heart, Mic, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../../components/utils/cn'
import { AR_TEXT } from '../arText'
import { COMMANDS, POSE_COMMAND, type CommandId, type Pose, type ReserveId } from '../dogAnimator'
import { voiceBubble, type VoicePhase } from '../voiceSession'

/** 묘기 트레이 (3×2). 굴러는 칩에서만 뺀다 (클립·음성 '굴러'는 그대로) */
const TRAY_COMMANDS = COMMANDS.filter((command) => command.id !== 'rollover')

const TRAY_ID = 'ar-trick-tray'

/** 말 걸기 버튼이 쓰는 음성 상태 (useVoiceCommand) */
export interface TalkState {
  /** starting 마이크 여는 중 · listening 열림 (말해도 됨) · hearing 말소리가 들어옴 · idle 안 들음 */
  phase: VoicePhase
  /** 듣는 중에 들린 말 (개발 모드에서만 채워진다) */
  heard: string
  /** 들은 말·오류 말풍선 */
  flash: { id: number; text: string } | null
  toggle: () => void
}

/**
 * AR 화면 아래: [묘기 | 말 걸기 | 산책] 세 버튼과 그 위 묘기 트레이·들은 말 말풍선.
 * 가운데 말 걸기가 가장 크다. 없는 버튼(음성 인식 없음·걷기 클립 없음)은 빼고 남은 버튼을 가운데로 모은다.
 * 명령 클립이 없는 모델은 묘기 자리에 '꼬리 흔들기' 하나.
 * 버튼은 놓기 전·불러오는 중에만 꺼 둔다. 바로 못 하는 입력은 예약되어 그 칩·버튼이 눌린 모양(테두리)으로 남고,
 * 다시 누르면 취소된다. 트레이의 자세 칩 중 지금 자세에는 '지금' 표시
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
  reserved = null,
  pose,
  onCommand,
  onWag,
  wagDisabled,
  walk,
  highlight = null,
}: {
  hasCommands: boolean
  /** 음성 인식이 없으면 null (버튼을 뺀다) */
  talk: TalkState | null
  talkDisabled: boolean
  trayOpen: boolean
  onToggleTray: () => void
  tricksDisabled: boolean
  /** 트레이 안 명령 칩 (불러오는 중·놓기 전) */
  commandsDisabled: boolean
  /** 마지막으로 시작한 명령 (칩 강조) */
  active: CommandId | null
  /** 예약된 명령·산책 (눌린 모양으로 남는다) */
  reserved?: ReserveId | null
  /** 지금 자세 (트레이 자세 칩의 '지금' 표시) */
  pose: Pose
  onCommand: (id: CommandId) => void
  onWag: () => void
  wagDisabled: boolean
  /** 걷기를 못 하는 개·화면 안 3D 는 null */
  walk: { onStart: () => void; disabled: boolean } | null
  /** 발도장 다음 할 일이 이 버튼이면 둘레를 약하게 강조한다 */
  highlight?: 'talk' | 'walk' | null
}) {
  const phase = talk?.phase ?? 'idle'
  const bubble = talk ? voiceBubble(phase, talk.heard, talk.flash?.text) : null

  return (
    <div className="flex flex-col items-center gap-3">
      <p aria-live="polite" className="flex min-h-8 max-w-full items-center justify-center text-center">
        {bubble && (
          <span
            key={phase !== 'idle' ? phase : talk?.flash?.id}
            className="inline-block max-w-full animate-toast-in rounded-2xl bg-black/55 px-3 py-1.5 text-label text-white [overflow-wrap:anywhere]"
          >
            {bubble}
          </span>
        )}
      </p>

      {hasCommands && trayOpen && (
        <div
          id={TRAY_ID}
          role="group"
          aria-label={AR_TEXT.tricksTray}
          className="pointer-events-auto grid w-full animate-rise-in grid-cols-3 gap-2 rounded-card bg-black/45 p-2"
        >
          {TRAY_COMMANDS.map((command) => {
            const isReserved = reserved === command.id
            const isNow = POSE_COMMAND[command.id] === pose
            return (
              <button
                key={command.id}
                type="button"
                disabled={commandsDisabled}
                onClick={() => onCommand(command.id)}
                aria-pressed={isReserved}
                className={cn(
                  'flex h-11 items-center justify-center gap-1 rounded-full px-2 text-body font-semibold transition active:scale-97 disabled:opacity-45',
                  isReserved
                    ? 'bg-measure text-ink ring-2 ring-white ring-offset-2 ring-offset-black/40'
                    : active === command.id
                      ? 'bg-measure text-ink'
                      : 'bg-black/55 text-white',
                )}
              >
                {command.label}
                {isNow && (
                  <span className="rounded-full bg-white/25 px-1.5 text-caption font-medium leading-5">{AR_TEXT.poseNow}</span>
                )}
              </button>
            )
          })}
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
            listening={phase}
            pulse={highlight === 'talk'}
          />
        )}
        {walk && (
          <RoundButton
            label={AR_TEXT.walk}
            icon={<Footprints className="size-6" strokeWidth={2} aria-hidden />}
            onClick={walk.onStart}
            disabled={walk.disabled}
            reserved={reserved === 'walk'}
            pulse={highlight === 'walk'}
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
  listening = 'idle',
  reserved,
  pulse = false,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled: boolean
  big?: boolean
  /** 트레이 같은 펼침 버튼 (aria-expanded) */
  pressed?: boolean
  controls?: string
  /** 말 걸기: starting 이면 흐리게 (마이크 여는 중), listening·hearing 이면 깜빡임 (말해도 됨) */
  listening?: VoicePhase
  /** 예약됨 (산책: 하던 동작이 끝나면 출발). 눌린 모양으로 남는다 */
  reserved?: boolean
  /** 다음 할 일 (둘레 약하게 강조, '동작 줄이기'면 끔) */
  pulse?: boolean
}) {
  const talking = listening !== 'idle'
  const open = listening === 'listening' || listening === 'hearing'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={pressed}
      aria-controls={controls}
      aria-pressed={big ? talking : reserved}
      className="group pointer-events-auto flex w-20 flex-col items-center gap-1 disabled:opacity-45"
    >
      <span
        className={cn(
          'relative flex items-center justify-center rounded-full transition group-active:scale-97',
          big ? 'size-18' : 'size-14',
          big || pressed || talking || reserved ? 'bg-measure text-ink' : 'bg-black/55 text-white',
          // 마이크가 열리기 전: 흐리게 (아직 말하면 빠진다)
          listening === 'starting' && 'opacity-55',
          reserved && 'ring-2 ring-white ring-offset-2 ring-offset-black/40',
          big && !pulse && 'shadow-[0_2px_10px_rgb(0_0_0/0.35)]',
          pulse && !disabled && 'animate-soft-pulse motion-reduce:animate-none',
        )}
      >
        {open && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-measure/60" />}
        {icon}
      </span>
      <span className="text-label font-semibold text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">{label}</span>
    </button>
  )
}
