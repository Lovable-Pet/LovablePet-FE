import type { ModelViewerElement } from '@google/model-viewer'

// 강아지 모델의 명령(앉아·엎드려·일어나·손·굴러·짖어·빵)과 탭 반응을 model-viewer 로 재생한다.
// AI 저장소의 anim_preview.html(템플릿 애니메이션 확인 페이지) 흐름을 옮긴 것이다.
// 클립 규칙은 AI 저장소 docs/ANIMATION.md, HANDOFF_ANIMATION.md 5절.
//
// - 자세(루프): standing 서기, sitting 앉기, lying 엎드리기
// - 전환(1회): sit_down, stand_up, lie_down, get_up. 앞 루프의 첫 프레임에서 시작해 뒤 루프의 첫 프레임에서 끝난다
// - 묘기(1회): rollover(엎드린 채), play_dead·bark·tail_wag(서서), shake(앉아서, 루프)
// - 클립이 idle, tail_wag 뿐인 템플릿은 명령 없이 탭 반응만 쓴다

export type Pose = 'stand' | 'sit' | 'down'

export const POSE_LABEL: Record<Pose, string> = { stand: '서 있어요', sit: '앉아 있어요', down: '엎드려 있어요' }

const LOOPS: Record<Pose, string> = { stand: 'standing', sit: 'sitting', down: 'lying' }
const MOVES: Record<string, [Pose, Pose]> = {
  sit_down: ['stand', 'sit'],
  stand_up: ['sit', 'stand'],
  lie_down: ['stand', 'down'],
  get_up: ['down', 'stand'],
}
/** 루프의 첫 프레임에서 정확히 끝나는 클립. 이어지는 루프로 바로 넘긴다 (섞으면 시작 자세가 비친다) */
const ENDS_ON_LOOP = new Set([...Object.keys(MOVES), 'rollover'])
/**
 * 루프끼리 바꿀 때의 크로스페이드. 1회 클립이 끝나면 model-viewer 가 paused 가 되고, 다음 재생에서
 * stopAllAction 을 먼저 불러(ModelScene.playAnimation) 1회 클립 뒤에는 실제로는 섞이지 않고 바로 넘어간다.
 * 팀원 미리보기 페이지도 같다
 */
const FADE_MS = 300

/** 명령이 쓰는 클립. 하나라도 없으면 명령을 보여 주지 않는다 */
const COMMAND_CLIPS = [...Object.values(LOOPS), ...Object.keys(MOVES), 'shake', 'rollover', 'bark', 'play_dead']

type Step = ['to', Pose] | ['play', string, number?] | ['hold', string] | ['tap']

export const COMMANDS = [
  { id: 'sit', label: '앉아', steps: [['to', 'sit']] },
  { id: 'down', label: '엎드려', steps: [['to', 'down']] },
  { id: 'stand', label: '일어나', steps: [['to', 'stand']] },
  { id: 'shake', label: '손', steps: [['to', 'sit'], ['hold', 'shake']] },
  { id: 'rollover', label: '굴러', steps: [['to', 'down'], ['play', 'rollover']] },
  { id: 'bark', label: '짖어', steps: [['to', 'stand'], ['play', 'bark', 2]] },
  { id: 'play_dead', label: '빵!', steps: [['to', 'stand'], ['play', 'play_dead']] },
] as const satisfies readonly { id: string; label: string; steps: readonly Step[] }[]

export type CommandId = (typeof COMMANDS)[number]['id']

export class DogAnimator {
  private readonly mv: ModelViewerElement
  private readonly onPose: (pose: Pose) => void
  private readonly tapClip: string
  private pose: Pose = 'stand'
  /** 새 명령이 들어오면 늘어난다. 진행 중이던 명령은 자기 번호가 아니면 멈춘다 */
  private run = 0
  private chain: Promise<void> = Promise.resolve()
  /** 대기열에 있거나 재생 중인 명령 수 */
  private pending = 0
  private disposed = false
  readonly hasCommands: boolean
  /** 대기 루프. 진도 템플릿은 standing, 다른 템플릿은 idle */
  private readonly idleClip: string

  constructor(mv: ModelViewerElement, options: { tapAnimation: string; playbackRate: number; onPose: (pose: Pose) => void }) {
    this.mv = mv
    this.onPose = options.onPose
    const clips = new Set(mv.availableAnimations)
    this.hasCommands = COMMAND_CLIPS.every((clip) => clips.has(clip))
    this.idleClip = clips.has('standing') ? 'standing' : clips.has('idle') ? 'idle' : (mv.availableAnimations[0] ?? '')
    this.tapClip = clips.has(options.tapAnimation) ? options.tapAnimation : clips.has('tail_wag') ? 'tail_wag' : ''
    // model-viewer 는 timeScale 을 mixer 와 action 양쪽에 넣고(ModelScene.animationTimeScale, playAnimation)
    // three.js 가 둘을 곱한다. 제곱근을 넣어야 실제 배속이 playbackRate 가 된다
    const rate = options.playbackRate > 0 ? options.playbackRate : 1
    mv.timeScale = Math.sqrt(rate)
    void this.start(this.idleClip)
  }

  dispose() {
    this.disposed = true
    this.run++
  }

  /** 명령. 진행 중인 클립은 끝까지 재생하고(중간에 끊으면 자세가 튄다), 가장 마지막 명령만 이어서 한다 */
  command(id: CommandId) {
    if (!this.hasCommands) return
    const command = COMMANDS.find((item) => item.id === id)
    if (!command) return
    this.enqueue(command.steps)
  }

  /**
   * 탭 반응. 서 있을 때만 (꼬리 흔들기 클립은 서기 자세라 앉거나 엎드린 채 틀면 튄다).
   * 자세는 전환 클립이 끝나야 바뀌므로 누른 순간이 아니라 차례가 왔을 때 다시 본다 (perform 의 'tap')
   */
  tap() {
    // 명령이 진행 중이면 무시한다. 받으면 대기 중인 명령이 취소되는데, 차례가 와도 서 있지 않으면 탭도 버려져 둘 다 사라진다
    if (!this.tapClip || this.pending > 0) return
    this.enqueue([['tap']])
  }

  private enqueue(steps: readonly Step[]) {
    const mine = ++this.run
    this.pending++
    this.chain = this.chain.then(() => this.perform(steps, mine)).finally(() => this.pending--)
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
   * updateComplete 를 기다린 뒤 play({repetitions}) 를 해야 횟수가 지켜진다 (docs/ANIMATION.md)
   */
  private async start(clip: string, { times = 0, fade = FADE_MS, reset = false } = {}) {
    if (!clip || this.disposed) return
    const mv = this.mv
    mv.animationCrossfadeDuration = fade
    if (reset) mv.currentTime = 0
    mv.animationName = clip
    await mv.updateComplete
    if (this.disposed) return
    mv.play(times ? { repetitions: times, pingpong: false } : undefined)
  }

  /** 한 번 재생하고 끝나면 true. 모델이 사라지면 false */
  private once(clip: string, times = 1) {
    return new Promise<boolean>((resolve) => {
      const onFinished = () => resolve(!this.disposed)
      this.mv.addEventListener('finished', onFinished, { once: true })
      void this.start(clip, { times })
    })
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

  /** 1회 클립 뒤 자세의 루프로. 루프 첫 프레임에서 끝나는 클립이면 섞지 않는다 */
  private settle(last: string) {
    return this.start(this.loopOf(this.pose), { reset: true, fade: ENDS_ON_LOOP.has(last) ? 0 : FADE_MS })
  }

  private async perform(steps: readonly Step[], mine: number) {
    if (mine !== this.run || this.disposed) return
    let last: string | null = null
    for (const step of steps) {
      if (step[0] === 'tap') {
        if (this.pose !== 'stand') return
        if (!(await this.once(this.tapClip))) return
        last = this.tapClip
        continue
      }
      if (step[0] === 'hold') {
        if (last) await this.settle(last)
        await this.start(step[1])
        return
      }
      const clips = step[0] === 'to' ? this.route(step[1]) : [step[1]]
      const times = step[0] === 'play' ? (step[2] ?? 1) : 1
      for (const clip of clips) {
        if (!(await this.once(clip, times))) return
        if (clip in MOVES) this.setPose(MOVES[clip][1])
        last = clip
        // 더 새로운 명령이 기다리면 여기서 루프로 돌려 두고 넘긴다
        if (mine !== this.run) {
          await this.settle(last)
          return
        }
      }
    }
    if (last) await this.settle(last)
    else await this.start(this.loopOf(this.pose))
  }
}
