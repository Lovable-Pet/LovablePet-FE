import type { ModelViewerElement } from '@google/model-viewer'

// 강아지 모델의 명령(앉아·엎드려·일어나·손 줘·굴러·짖어·빵)과 탭 반응을 model-viewer 로 재생한다.
// AI 저장소의 anim_preview.html(템플릿 애니메이션 확인 페이지) 흐름을 옮긴 것이다.
// 클립 규칙은 AI 저장소 docs/ANIMATION.md, HANDOFF_ANIMATION.md 5절.
//
// - 자세(루프): standing 서기, sitting 앉기, lying 엎드리기
// - 전환(1회): sit_down, stand_up, lie_down, get_up. 앞 루프의 첫 프레임에서 시작해 뒤 루프의 첫 프레임에서 끝난다
// - 묘기(1회): rollover(엎드린 채), play_dead·bark·tail_wag·head_tilt(서서), shake(앉아서, 루프로 들고 있다가 SHAKE_HOLD_S 뒤 내림)
// - 클립이 idle, tail_wag 뿐인 템플릿은 명령 없이 탭 반응만 쓴다
//
// 입력이 막히지 않게 (버튼을 꺼 두지 않는다):
// - 끊을 수 있는 클립 (INTERRUPTIBLE_CLIPS: 꼬리·갸우뚱·인사·짖기·손 줘) 은 새 명령·산책·톡이 오면 그 자리에서 끊고 넘어간다.
//   클립 사이는 자세 층(../modelViewerArStage.ts)이 섞는다
// - 끊지 않는 클립 (빵·구르기·자세 전환) 과 몸 돌리기(setBlocked) 동안 들어온 명령·산책은 예약하고 끝나면 한다 (가장 마지막 입력만).
//   같은 버튼을 다시 누르면 (toggle) 예약 취소
// - 앉거나 엎드린 개에게 명령·산책: 필요한 전환을 알아서 하고 실행한다
// - 같은 자세 명령 (앉아 있는데 '앉아') 은 'same' (부르는 쪽이 '이미 앉아 있어요')
// - 개 탭: 서 있으면 클립 반응 (반응 중에 다시 톡 하면 갸우뚱 ↔ 꼬리 흔들기 번갈아), 앉거나 엎드려 있으면 'tilt'
//   (부르는 쪽이 절차적 갸우뚱), 손 줘 중이면 손을 내리고 'lowerPaw', 끊지 않는 클립 중이면 'bubble' (말풍선만)
// - 클립 끝이 첫 프레임 자세로 돌아와 비어 있으면 (clipEnds: 갸우뚱 3.5~3.9 s / 4.3 s) 거기서 끊고 다음으로

export type Pose = 'stand' | 'sit' | 'down'

export const POSE_LABEL: Record<Pose, string> = { stand: '서 있어요', sit: '앉아 있어요', down: '엎드려 있어요' }

const LOOPS: Record<Pose, string> = { stand: 'standing', sit: 'sitting', down: 'lying' }
const MOVES: Record<string, [Pose, Pose]> = {
  sit_down: ['stand', 'sit'],
  stand_up: ['sit', 'stand'],
  lie_down: ['stand', 'down'],
  get_up: ['down', 'stand'],
}
/** 갸우뚱. 탭과 음성 실패 반응. standing 첫 프레임에서 시작해 정확히 그 프레임에서 끝난다 */
const HEAD_TILT = 'head_tilt'
/** 루프의 첫 프레임에서 정확히 끝나는 클립 (자세 층이 없을 때 크로스페이드 없이 루프로) */
const ENDS_ON_LOOP = new Set([...Object.keys(MOVES), 'rollover', HEAD_TILT])
/**
 * 자세 섞기(../modelViewerArStage.ts 의 자세 층)를 못 쓸 때만 쓰는 model-viewer 크로스페이드 (루프끼리 바꿀 때).
 * 1회 클립이 끝나면 model-viewer 가 paused 가 되고, 다음 재생에서 stopAllAction 을 먼저 불러(ModelScene.playAnimation)
 * 1회 클립 뒤에는 실제로는 섞이지 않고 바로 넘어간다. 자세 층이 있으면 0 으로 두고 모든 연결을 자세 층이 섞는다 (두 번 섞지 않게)
 */
const FADE_MS = 300

/** 끊을 수 있는 클립: 새 명령·산책·톡이 오면 그 자리에서 끊는다. 나머지(빵·구르기·자세 전환)는 끝까지 하고 새 입력은 예약 */
export const INTERRUPTIBLE_CLIPS: ReadonlySet<string> = new Set(['tail_wag', HEAD_TILT, 'bark', 'shake'])
/** 손 줘를 들고 있다가 스스로 내리는 시간 (s). 그 전에 다른 입력이 오면 바로 내린다 */
export const SHAKE_HOLD_S = 6

/** 명령이 쓰는 클립. 하나라도 없으면 명령을 보여 주지 않는다 */
const COMMAND_CLIPS = [...Object.values(LOOPS), ...Object.keys(MOVES), 'shake', 'rollover', 'bark', 'play_dead']

/** 반응을 부른 곳 */
export type ReactSource = 'tap' | 'wag' | 'puzzled' | 'greet'

type Step = ['to', Pose] | ['play', string, number?] | ['hold', string] | ['react', string, ReactSource]

export const COMMANDS = [
  { id: 'sit', label: '앉아', steps: [['to', 'sit']] },
  { id: 'down', label: '엎드려', steps: [['to', 'down']] },
  { id: 'stand', label: '일어나', steps: [['to', 'stand']] },
  { id: 'shake', label: '손 줘', steps: [['to', 'sit'], ['hold', 'shake']] },
  { id: 'rollover', label: '굴러', steps: [['to', 'down'], ['play', 'rollover']] },
  { id: 'bark', label: '짖어', steps: [['to', 'stand'], ['play', 'bark', 2]] },
  { id: 'play_dead', label: '빵!', steps: [['to', 'stand'], ['play', 'play_dead']] },
] as const satisfies readonly { id: string; label: string; steps: readonly Step[] }[]

export type CommandId = (typeof COMMANDS)[number]['id']

/** 자세 명령이 가는 자세 (트레이의 '지금' 표시·같은 자세 안내) */
export const POSE_COMMAND: Partial<Record<CommandId, Pose>> = { sit: 'sit', down: 'down', stand: 'stand' }

/** 예약할 수 있는 입력 (누른 버튼·칩을 눌린 모양으로 둔다) */
export type ReserveId = CommandId | 'walk'

/**
 * 명령·산책 결과. started 바로 시작 (끊을 수 있는 클립은 끊음) · reserved 예약 (끝나면 한다) · unreserved 같은 것을 다시 눌러 예약 취소 ·
 * running 같은 것이 이미 진행 중 · same 이미 그 자세 · ignored 명령 클립 없음
 */
export type RequestResult = 'started' | 'reserved' | 'unreserved' | 'running' | 'same' | 'ignored'

/** 탭·음성 실패 결과. clip 반응 클립 · tilt 절차적 갸우뚱을 할 차례 · lowerPaw 손을 내림 · bubble 말풍선만 */
export type TapResult = 'clip' | 'tilt' | 'lowerPaw' | 'bubble'

/**
 * 개발 기록(?debug 이벤트 기록)에 넘기는 일. end 클립 끝 (quiet: 빈 끝에서 끊음) · cut 끊고 다른 것으로 · reserve 예약 ·
 * unreserve 예약 취소 · runReserved 예약 실행 · release 손 줘를 스스로 내림
 */
export type AnimatorLog =
  | { type: 'end'; clip: string; quiet: boolean }
  | { type: 'cut'; clip: string; by: string }
  | { type: 'reserve' | 'unreserve' | 'runReserved'; id: string }
  | { type: 'release'; clip: string }

/** 클립의 빈 끝: end (s) 부터 첫 프레임 자세와 거의 같다 (../modelViewerArStage.ts clipQuietEnds) */
export interface ClipEnd {
  end: number
  duration: number
}

interface Job {
  id: ReserveId | ReactSource | 'celebrate' | 'lowerPaw'
  steps: readonly Step[]
  /** 끝났거나 (true) 다른 입력에 밀려 버려졌을 때 (false). 한 번 */
  settle?: (done: boolean) => void
  /** 실제로 시작할 때 (바로 또는 예약이 풀려서). 그때 자세를 받는다 */
  onBegin?: (pose: Pose) => void
  /** 끝나고 루프가 돌기 시작한 뒤 (산책 출발) */
  onReady?: () => void
}

interface Playing {
  clip: string
  token: number
  interruptible: boolean
  /** 손 줘처럼 루프로 들고 있음 (finished 가 없다) */
  hold: boolean
  timer?: ReturnType<typeof setTimeout>
}

const REACT_IDS = new Set<Job['id']>(['tap', 'wag', 'puzzled', 'greet'])
const isReserveId = (id: Job['id']): id is ReserveId => id === 'walk' || COMMANDS.some((command) => command.id === id)

export class DogAnimator {
  private readonly mv: ModelViewerElement
  private readonly onPose: (pose: Pose) => void
  private readonly onBusy?: (busy: boolean) => void
  /** 클립을 틀 때마다 (반응 말풍선) */
  private readonly onClipStart?: (clip: string) => void
  /** 반응 클립이 실제로 재생될 때 */
  private readonly onReact?: (source: ReactSource) => void
  /** 예약이 바뀔 때 (누른 버튼 모양·안내) */
  private readonly onReserve?: (id: ReserveId | null) => void
  /** 개 탭 */
  private readonly tapClip: string
  /** '꼬리 흔들기' 칩·인사 */
  private readonly wagClip: string
  /** 음성 명령을 못 알아들었을 때. head_tilt 가 없으면 '' */
  private readonly puzzledClip: string
  /** model-viewer 크로스페이드 (ms). 자세 층이 섞으면 0 */
  private readonly fadeMs: number
  /** 실제 재생 배속 (빈 끝을 시간으로 끊을 때) */
  private readonly rate: number
  private readonly clipEnds: Readonly<Record<string, ClipEnd>>
  private readonly onFinished: () => void
  private pose: Pose = 'stand'
  /** 진행 중인 명령·반응과 그 다음 단계 */
  private job: Job | null = null
  private stepIndex = 0
  /** 지금 재생 중인 1회 클립·들고 있는 손 줘. 루프만 돌면 null */
  private playing: Playing | null = null
  /** 끊지 않는 클립·몸 돌리기가 끝나면 할 것 (가장 마지막 입력만) */
  private reserved: Job | null = null
  /** 몸 돌리기 중 (산책 리그가 클립을 돌린다) */
  private blocked = false
  private token = 0
  /** 가장 최근 start (늦게 끝난 start 가 새 클립의 재생 횟수를 덮지 않게) */
  private startToken = 0
  /** 마지막으로 끝난 1회 클립 (자세 층이 없을 때 루프로 갈 크로스페이드) */
  private lastClip: string | null = null
  private busy = false
  /** 마지막으로 알린 resting (처음은 루프만 도는 쉬는 상태) */
  private wasResting = true
  private readonly onResting?: (resting: boolean) => void
  private readonly onLog?: (event: AnimatorLog) => void
  private disposed = false
  readonly hasCommands: boolean
  /** 개를 탭하면 갸우뚱하는지 (안내 문구용) */
  readonly tapIsHeadTilt: boolean
  /** 대기 루프. 진도 템플릿은 standing, 다른 템플릿은 idle */
  private readonly idleClip: string

  constructor(
    mv: ModelViewerElement,
    options: {
      tapAnimation: string
      playbackRate: number
      onPose: (pose: Pose) => void
      /** 명령·반응을 재생하거나 예약이 있는지가 바뀔 때 */
      onBusy?: (busy: boolean) => void
      /** 클립을 틀 때마다 (루프 포함) */
      onClipStart?: (clip: string) => void
      /** 반응 클립이 실제로 재생될 때 */
      onReact?: (source: ReactSource) => void
      /** 예약이 바뀔 때 */
      onReserve?: (id: ReserveId | null) => void
      /**
       * 쉬는 상태(자세 루프만 돌고 명령·반응·손 줘 들기·예약·몸 돌리기가 없음)가 바뀔 때.
       * busy 와 달리 손 줘를 들고 있는 동안도 쉬지 않는 것으로 본다 (발도장 다음 안내·마무리 축하)
       */
      onResting?: (resting: boolean) => void
      /** 개발 기록용 (부르는 쪽이 개발 모드 ?debug 에서만 준다) */
      onLog?: (event: AnimatorLog) => void
      /** 자세 층이 클립 사이를 섞으면 true (model-viewer 크로스페이드를 끈다) */
      poseBlend?: boolean
      /** 클립의 빈 끝 (거기서 끊고 다음으로). 없으면 끝까지 */
      clipEnds?: Readonly<Record<string, ClipEnd>>
    },
  ) {
    this.mv = mv
    this.fadeMs = options.poseBlend ? 0 : FADE_MS
    this.onPose = options.onPose
    this.onBusy = options.onBusy
    this.onClipStart = options.onClipStart
    this.onReact = options.onReact
    this.onReserve = options.onReserve
    this.onResting = options.onResting
    this.onLog = options.onLog
    this.clipEnds = options.clipEnds ?? {}
    const clips = new Set(mv.availableAnimations)
    this.hasCommands = COMMAND_CLIPS.every((clip) => clips.has(clip))
    this.idleClip = clips.has('standing') ? 'standing' : clips.has('idle') ? 'idle' : (mv.availableAnimations[0] ?? '')
    const hasHeadTilt = clips.has(HEAD_TILT)
    // 탭은 서버 tapAnimation 보다 head_tilt 를 먼저 본다. 지금 저장된 펫과 목업은 모두 tapAnimation 이 tail_wag 이고,
    // AI 저장소도 head_tilt 가 있는 템플릿은 탭을 head_tilt 로 주도록 바뀐다
    const serverTapClip = clips.has(options.tapAnimation) ? options.tapAnimation : clips.has('tail_wag') ? 'tail_wag' : ''
    this.tapClip = hasHeadTilt ? HEAD_TILT : serverTapClip
    this.wagClip = clips.has('tail_wag') ? 'tail_wag' : ''
    this.puzzledClip = hasHeadTilt ? HEAD_TILT : ''
    this.tapIsHeadTilt = this.tapClip === HEAD_TILT
    // model-viewer 는 timeScale 을 mixer 와 action 양쪽에 넣고(ModelScene.animationTimeScale, playAnimation)
    // three.js 가 둘을 곱한다. 제곱근을 넣어야 실제 배속이 playbackRate 가 된다
    this.rate = options.playbackRate > 0 ? options.playbackRate : 1
    mv.timeScale = Math.sqrt(this.rate)
    // finished 는 믹서 update 안에서 온다 (three AnimationAction._updateTime). 그 안에서 다음 클립을 틀면
    // (currentTime = 0 → mixer.setTime) 믹서가 다시 들어가 한 프레임 낡은 자세가 남는다: 마이크로태스크로 미룬다
    this.onFinished = () => {
      const playing = this.playing
      if (playing && !playing.hold) queueMicrotask(() => this.clipDone(playing.token))
    }
    mv.addEventListener('finished', this.onFinished)
    void this.start(this.idleClip)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    clearTimeout(this.playing?.timer)
    this.playing = null
    this.mv.removeEventListener('finished', this.onFinished)
    const { job, reserved } = this
    this.job = null
    this.reserved = null
    job?.settle?.(false)
    reserved?.settle?.(false)
  }

  /** 지금 자세와 명령·반응을 재생하거나 예약이 있는지 (고개 바라보기가 매 프레임 읽는다) */
  get state(): { pose: Pose; busy: boolean } {
    return { pose: this.pose, busy: this.busy }
  }

  /** 예약된 명령·산책 */
  get reservedId(): ReserveId | null {
    return this.reserved && isReserveId(this.reserved.id) ? this.reserved.id : null
  }

  /** 개 탭에 반응 클립이 있는지 (없으면 '톡' 발도장을 뺀다) */
  get canTap() {
    return this.tapClip !== ''
  }

  /** 꼬리 흔들기 클립이 있는지 */
  get canWag() {
    return this.wagClip !== ''
  }

  /** 음성 실패에 갸우뚱(head_tilt)이 있는지 */
  get canPuzzle() {
    return this.puzzledClip !== ''
  }

  /**
   * 명령. 끊을 수 있는 클립이면 끊고 바로, 끊지 않는 클립·몸 돌리기 중이면 예약 (toggle 이면 같은 예약을 다시 눌러 취소).
   * 이미 그 자세면 'same' (반응 중이어도 반응은 그대로)
   */
  command(id: CommandId, { toggle = false }: { toggle?: boolean } = {}): RequestResult {
    if (!this.hasCommands || this.disposed) return 'ignored'
    const command = COMMANDS.find((item) => item.id === id)
    if (!command) return 'ignored'
    const target = POSE_COMMAND[id]
    if (
      target &&
      this.pose === target &&
      !this.blocked &&
      !this.reserved &&
      !this.playing?.hold &&
      (this.job === null || REACT_IDS.has(this.job.id))
    ) {
      return 'same'
    }
    if (this.job?.id === id) return 'running'
    return this.request({ id, steps: command.steps }, toggle)
  }

  /**
   * 산책 준비: 서 있지 않으면 일어난 뒤, 서기 루프가 돌기 시작하면 onReady (산책 출발).
   * 끊지 않는 클립·몸 돌리기 중이면 예약. 실제로 시작할 때 onBegin(그때 자세), 다른 입력에 밀려 버려지면 onCancel
   */
  walk(
    { onBegin, onReady, onCancel }: { onBegin?: (pose: Pose) => void; onReady: () => void; onCancel?: () => void },
    { toggle = true }: { toggle?: boolean } = {},
  ): RequestResult {
    if (this.disposed) return 'ignored'
    if (this.job?.id === 'walk') return 'running'
    return this.request(
      { id: 'walk', steps: this.hasCommands ? [['to', 'stand']] : [], onBegin, onReady, settle: (done) => !done && onCancel?.() },
      toggle,
    )
  }

  /** 예약을 지운다 (예약이 없으면 아무것도 안 한다) */
  cancelReserved() {
    if (this.reserved) this.setReserved(null)
  }

  /**
   * 몸 돌리기 (산책 리그가 클립을 돌림) 시작·끝. 그동안 명령·산책은 예약하고 끝나면 한다.
   * 몸 돌리기는 개가 쉴 때만 시작한다 (고개 바라보기가 busy 를 본다)
   */
  setBlocked(blocked: boolean) {
    if (this.blocked === blocked || this.disposed) return
    this.blocked = blocked
    if (!blocked && this.reserved && (!this.playing || this.playing.interruptible)) {
      const job = this.reserved
      this.setReserved(null, false)
      this.begin(job)
      return
    }
    this.syncBusy()
  }

  /** 개 탭. 무엇을 했는지 돌려준다 (tilt·lowerPaw·bubble 은 부르는 쪽이 갸우뚱·말풍선을 띄운다) */
  tap(): TapResult {
    if (this.disposed || this.blocked || (this.playing && !this.playing.interruptible)) return 'bubble'
    // 손 줘 중: 손을 내리고 앉기 루프로
    if (this.playing?.hold) {
      this.begin({ id: 'lowerPaw', steps: [] })
      return 'lowerPaw'
    }
    // 반응 클립은 서기 자세 클립이라 앉거나 엎드려 있으면 클립 대신 절차적 갸우뚱
    if (this.pose !== 'stand') return 'tilt'
    const clip = this.nextTapClip()
    if (!clip) return 'bubble'
    this.begin({ id: 'tap', steps: [['react', clip, 'tap']] })
    return 'clip'
  }

  /** '꼬리 흔들기' 버튼 (명령 클립이 없는 모델). 늘 tail_wag, 반응 중이면 끊고 다시 */
  wag(): TapResult {
    if (this.disposed || !this.wagClip || this.blocked || (this.playing && !this.playing.interruptible)) return 'bubble'
    if (this.pose !== 'stand') return 'tilt'
    this.begin({ id: 'wag', steps: [['react', this.wagClip, 'wag']] })
    return 'clip'
  }

  /** 처음 놓았을 때 인사. 서서 쉬고 있고 tail_wag 가 있을 때 한 번. 흔들었으면 true (onClipStart 는 이 안에서 바로 온다) */
  greet(): boolean {
    if (!this.idle || this.pose !== 'stand' || !this.wagClip) return false
    this.begin({ id: 'greet', steps: [['react', this.wagClip, 'greet']] })
    return true
  }

  /** 쉬는 상태: 자세 루프만 돌고 명령·반응·손 줘 들기·예약·몸 돌리기가 없다 */
  get resting() {
    return this.idle
  }

  /** 음성 명령을 못 알아들었을 때. 쉬고 있으면 갸우뚱 (앉거나 엎드려 있으면 'tilt'), 아니면 말풍선만 */
  puzzled(): TapResult {
    if (this.disposed || !this.idle) return 'bubble'
    if (this.pose !== 'stand') return 'tilt'
    if (!this.puzzledClip) return 'bubble'
    this.begin({ id: 'puzzled', steps: [['react', this.puzzledClip, 'puzzled']] })
    return 'clip'
  }

  /**
   * 발도장을 다 모았을 때: 일어나서 한 번 짖고 꼬리를 흔든다. 끝나거나 다른 입력에 밀리면 풀린다 (명령 클립이 없으면 꼬리만)
   */
  celebrate(): Promise<void> {
    const steps: Step[] = this.hasCommands ? [['to', 'stand'], ['play', 'bark', 1]] : []
    if (this.wagClip) steps.push(['react', this.wagClip, 'greet'])
    if (!steps.length || this.disposed) return Promise.resolve()
    return new Promise((resolve) => {
      this.request({ id: 'celebrate', steps, settle: () => resolve() })
    })
  }

  /** 아무것도 안 하고 쉬는 중 (루프만, 예약·몸 돌리기 없음) */
  private get idle() {
    return !this.job && !this.playing && !this.reserved && !this.blocked
  }

  /** 반응 중에 다시 톡: 갸우뚱 ↔ 꼬리 흔들기 번갈아 (둘 다 있을 때) */
  private nextTapClip() {
    const now = this.playing?.clip
    if (now === HEAD_TILT && this.wagClip) return this.wagClip
    if (now === this.wagClip && this.wagClip && this.puzzledClip) return HEAD_TILT
    return this.tapClip
  }

  private request(job: Job, toggle = false): RequestResult {
    if (this.disposed) return 'ignored'
    if (this.blocked || (this.playing && !this.playing.interruptible)) {
      if (toggle && this.reserved && this.reserved.id === job.id) {
        this.setReserved(null)
        return 'unreserved'
      }
      this.setReserved(job)
      return 'reserved'
    }
    this.begin(job)
    return 'started'
  }

  /** 하던 것을 버리고 (끊을 수 있는 클립은 그 자리에서) job 을 시작한다 */
  private begin(job: Job) {
    const old = this.job
    if (this.playing) this.onLog?.({ type: 'cut', clip: this.playing.clip, by: job.id })
    clearTimeout(this.playing?.timer)
    this.playing = null
    this.job = job
    this.stepIndex = 0
    old?.settle?.(false)
    this.syncBusy()
    job.onBegin?.(this.pose)
    this.advance()
  }

  private advance() {
    const job = this.job
    if (!job || this.disposed) return
    while (this.stepIndex < job.steps.length) {
      const step = job.steps[this.stepIndex]
      if (step[0] === 'to') {
        const next = this.route(step[1])[0]
        if (next) return this.play(next, 1)
        this.stepIndex++
        continue
      }
      this.stepIndex++
      if (step[0] === 'play') return this.play(step[1], step[2] ?? 1)
      if (step[0] === 'react') {
        // 반응 클립은 서기 자세 클립이라 서 있을 때만 (차례가 왔을 때 다시 본다)
        if (this.pose !== 'stand' || !step[1]) continue
        this.onReact?.(step[2])
        return this.play(step[1], 1)
      }
      return this.hold(step[1])
    }
    this.finish()
  }

  /** 1회 클립. 끝나면 (finished 또는 빈 끝 타이머) clipDone */
  private play(clip: string, times: number) {
    const token = ++this.token
    const playing: Playing = { clip, token, interruptible: INTERRUPTIBLE_CLIPS.has(clip), hold: false }
    this.playing = playing
    // 늘 처음부터 (앞에서 끊긴 같은 클립이 그 시간에서 이어 돌지 않게)
    void this.start(clip, { times, reset: true })
    const end = this.clipEnds[clip]
    if (end && end.end < end.duration) {
      playing.timer = setTimeout(() => this.clipDone(token, true), (((times - 1) * end.duration + end.end) / this.rate) * 1000)
    }
  }

  /** 손 줘: 루프로 들고 있다가 SHAKE_HOLD_S 뒤 앉기 루프로. 명령은 여기서 끝 (바쁘지 않음, 끊을 수 있음) */
  private hold(clip: string) {
    const token = ++this.token
    const playing: Playing = { clip, token, interruptible: true, hold: true }
    this.playing = playing
    void this.start(clip, { reset: true })
    playing.timer = setTimeout(() => {
      if (this.playing?.token !== token || this.disposed) return
      this.playing = null
      this.onLog?.({ type: 'release', clip })
      void this.start(this.loopOf(this.pose), { reset: true })
      this.syncBusy()
    }, SHAKE_HOLD_S * 1000)
    const job = this.job
    this.job = null
    this.syncBusy()
    job?.settle?.(true)
  }

  private clipDone(token: number, quiet = false) {
    const playing = this.playing
    if (!playing || playing.token !== token || this.disposed) return
    this.onLog?.({ type: 'end', clip: playing.clip, quiet })
    clearTimeout(playing.timer)
    this.playing = null
    this.lastClip = playing.clip
    if (playing.clip in MOVES) this.setPose(MOVES[playing.clip][1])
    // 예약이 있으면 하던 순서를 버리고 예약으로 (가장 마지막 입력만)
    const reserved = this.reserved
    if (reserved && !this.blocked) {
      this.setReserved(null, false)
      this.begin(reserved)
      return
    }
    this.advance()
  }

  /** 순서를 다 했다: 자세의 루프로 (다른 클립에서 오면 처음부터) */
  private finish() {
    const job = this.job
    this.job = null
    const loop = this.loopOf(this.pose)
    const switching = this.mv.animationName !== loop
    const ready = this.start(loop, {
      reset: switching,
      fade: switching && this.lastClip && ENDS_ON_LOOP.has(this.lastClip) ? 0 : this.fadeMs,
    })
    this.syncBusy()
    job?.settle?.(true)
    const onReady = job?.onReady
    if (onReady) {
      void ready.then(() => {
        if (!this.disposed && !this.job && !this.playing) onReady()
      })
    }
  }

  private setReserved(job: Job | null, settleOld = true) {
    const old = this.reserved
    this.reserved = job
    if (old && old !== job && settleOld) old.settle?.(false)
    if (job) this.onLog?.({ type: 'reserve', id: job.id })
    else if (old) this.onLog?.({ type: settleOld ? 'unreserve' : 'runReserved', id: old.id })
    this.onReserve?.(job && isReserveId(job.id) ? job.id : null)
    this.syncBusy()
  }

  private syncBusy() {
    const busy = this.job !== null || this.reserved !== null
    if (busy !== this.busy) {
      this.busy = busy
      if (!this.disposed) this.onBusy?.(busy)
    }
    const resting = this.idle
    if (resting !== this.wasResting) {
      this.wasResting = resting
      if (!this.disposed) this.onResting?.(resting)
    }
  }

  private setPose(pose: Pose) {
    this.pose = pose
    this.onPose(pose)
  }

  private loopOf(pose: Pose) {
    return this.hasCommands ? LOOPS[pose] : this.idleClip
  }

  /**
   * model-viewer 는 animationName 을 바꾸면 다음 업데이트에서 무한 반복으로 덮어쓴다.
   * updateComplete 를 기다린 뒤 play({repetitions}) 를 해야 횟수가 지켜진다 (docs/ANIMATION.md).
   * reset 이면 처음부터 (mixer.setTime(0): 지금 액션들의 시간을 0 으로)
   */
  private async start(clip: string, { times = 0, fade = this.fadeMs, reset = false } = {}) {
    if (!clip || this.disposed) return
    const mv = this.mv
    const mine = ++this.startToken
    mv.animationCrossfadeDuration = Math.min(fade, this.fadeMs)
    if (reset) mv.currentTime = 0
    mv.animationName = clip
    this.onClipStart?.(clip)
    await mv.updateComplete
    if (this.disposed || mine !== this.startToken) return
    mv.play(times ? { repetitions: times, pingpong: false } : undefined)
  }

  /** 지금 자세에서 `to` 까지 가장 짧은 전환 순서 */
  private route(to: Pose) {
    const seen: Partial<Record<Pose, string[]>> = { [this.pose]: [] }
    const todo: Pose[] = [this.pose]
    while (todo.length) {
      const at = todo.shift()!
      if (at === to) return seen[at]!
      for (const [clip, [from, next]] of Object.entries(MOVES)) {
        if (from === at && !(next in seen)) {
          seen[next] = [...seen[at]!, clip]
          todo.push(next)
        }
      }
    }
    return []
  }
}
