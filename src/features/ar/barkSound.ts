// 개가 짖을 때 (bark 클립) 입 모양에 맞춰 짖는 소리를 낸다 (Web Audio). AR·화면 안 3D 둘 다. React 없이 단위 시험한다 (훅은 ./useBarkSound.ts).
//
// 소리 파일 (public/sounds/bark/, Ogg Opus 128 kbps 모노, 앞 20 ms 는 조용한 여유)
// - bark_big.ogg (큰 개용, 0.27 s): Mixkit "Medium size angry dog bark" (mixkit-medium-size-angry-dog-bark-54.wav) 의
//   첫 번째 '멍' 을 잘라 끝을 부드럽게 줄이고 끝의 고음을 깎은 것
// - bark_small.ogg (작은 개용, 0.24 s): Mixkit "Happy puppy barks" (mixkit-happy-puppy-barks-741.wav) 의 첫 번째 '깽' 만 잘라낸 것 (숨소리 제외)
// - 잘라 다듬은 wav 를 Ogg Opus 로 바꾸기만 했다 (다시 자르거나 효과를 넣지 않음). 화면에 출처 표시는 하지 않는다
//
// 규칙
// - 템플릿별 소리·기준 높이는 BARK_VOICE 한 곳 (표에 없는 템플릿은 jindo 와 같게). 체고·체중으로 계산하지 않는다
// - 높이는 AudioBufferSourceNode.playbackRate 로 바꾼다 (높이와 길이가 같이 바뀜, 들어 보고 정한 값이 이 방식 기준).
//   짖기 동작이 시작될 때 한 번만 기준 × 0.97~1.03 으로 정하고, 그 짖기 안의 소리는 모두 같은 높이
// - bark 클립(3.0 s)은 여섯 템플릿 모두 jaw_jnt 가 0.43 s·1.23 s 에 벌어지기 시작한다 (가장 크게 0.52 s·1.32 s).
//   소리 파일 앞 20 ms 여유를 빼고 클립 기준 0.41 s·1.21 s 에 예약한다. 클립 재생 속도가 1 이 아니면 그 속도로 나눈다.
//   클립을 여러 번 돌리면 (명령 '짖어' 는 2번) 돌 때마다 두 번씩
// - 짖기가 중간에 끊기면 (다른 명령·탭 등 다른 클립이 시작) 아직 안 난 소리는 취소한다 (나고 있는 소리는 끝까지)
// - 기본 볼륨 0.6. 폰에서 개까지 바닥 거리 1 m 안은 1 배, 멀면 1/거리 로 줄이고 최소 0.35 배. 개가 폰 기준 왼쪽·오른쪽이면 그쪽으로 (StereoPanner)
// - 마이크로 듣는 중에는 소리를 내지 않는다: 듣기를 시작하면 나고 있던 소리·예약을 모두 멈추고, 듣는 동안은 예약하지 않는다
// - 소리 끄기 (위 스피커 버튼) 는 기억한다 (localStorage). 꺼져 있으면 예약하지 않는다
// - 자동재생 제한: AudioContext 는 사용자 탭 안에서 만들거나 다시 켠다 (unlock). 파일은 페이지를 열 때 받아 디코드해 둔다

export type BarkSoundId = 'big' | 'small'

export const BARK_SOUND_URL: Readonly<Record<BarkSoundId, string>> = {
  big: '/sounds/bark/bark_big.ogg',
  small: '/sounds/bark/bark_small.ogg',
}

export interface BarkVoice {
  sound: BarkSoundId
  /** 기준 높이 (playbackRate) */
  rate: number
}

/** 템플릿별 소리와 기준 높이 (사용자가 들어 보고 정한 값) */
export const BARK_VOICE: Readonly<Record<string, BarkVoice>> = {
  retriever: { sound: 'big', rate: 0.8 },
  jindo: { sound: 'big', rate: 0.83 },
  jindo_puppy: { sound: 'big', rate: 0.98 },
  maltese: { sound: 'small', rate: 0.9 },
  toypoodle: { sound: 'small', rate: 0.9 },
  chihuahua: { sound: 'small', rate: 0.9 },
}

/** 표에 없는 템플릿 */
export const DEFAULT_BARK_TEMPLATE = 'jindo'

export function barkVoiceFor(template: string | null | undefined): BarkVoice {
  return (template ? BARK_VOICE[template] : undefined) ?? BARK_VOICE[DEFAULT_BARK_TEMPLATE]
}

/** 한 번의 짖기 안에서 높이 흔들림 (기준 × 1 ± 이만큼) */
export const BARK_PITCH_JITTER = 0.03

/** 짖기 한 번의 높이: 기준 × (0.97~1.03). random 은 [0, 1) */
export function pickBarkPitch(baseRate: number, random: () => number = Math.random): number {
  return baseRate * (1 - BARK_PITCH_JITTER + 2 * BARK_PITCH_JITTER * random())
}

export const BARK_CLIP = 'bark'
/** bark 클립에서 jaw_jnt 가 벌어지기 시작하는 시각 (s, 클립 기준). 목업 GLB 로 단위 시험이 ±30 ms 를 본다 */
export const BARK_JAW_OPEN_S: readonly number[] = [0.43, 1.23]
/** 소리 파일 앞의 조용한 여유 (s) */
export const BARK_SOUND_LEAD_S = 0.02
/** 소리를 틀 시각 (s, 클립 기준): 입이 벌어지는 시각 - 앞 여유 = 0.41, 1.21 */
export const BARK_SOUND_AT_S: readonly number[] = BARK_JAW_OPEN_S.map((at) => Math.round((at - BARK_SOUND_LEAD_S) * 1000) / 1000)
/** 클립 길이를 모를 때 (여섯 템플릿 모두 3.0 s) */
export const BARK_CLIP_S = 3
/** 이만큼 (s) 넘게 지난 소리는 건너뛴다 (조금 늦은 것은 바로 튼다) */
const LATE_SKIP_S = 0.05

/**
 * 지금부터 몇 초 뒤에 틀지. clipTime: 지금 클립 시각 (s), clipRate: 클립 재생 속도, duration: 클립 길이 (s), times: 몇 번 돌리는지.
 * 이미 LATE_SKIP_S 넘게 지난 소리는 빼고, 조금 지난 것은 0
 */
export function barkSoundDelays({
  clipTime = 0,
  clipRate = 1,
  duration = BARK_CLIP_S,
  times = 1,
}: {
  clipTime?: number
  clipRate?: number
  duration?: number
  times?: number
}): number[] {
  const rate = clipRate > 0 ? clipRate : 1
  const length = duration > 0 ? duration : BARK_CLIP_S
  const delays: number[] = []
  for (let lap = 0; lap < Math.max(1, Math.round(times)); lap++) {
    for (const at of BARK_SOUND_AT_S) {
      const delay = (lap * length + at - clipTime) / rate
      if (delay >= -LATE_SKIP_S) delays.push(Math.max(0, delay))
    }
  }
  return delays
}

/** 기본 볼륨 */
export const BARK_VOLUME = 0.6
/** 이 거리 (m) 안은 줄이지 않는다 */
export const BARK_FULL_M = 1
/** 멀어져도 이 배 밑으로는 줄이지 않는다 */
export const BARK_MIN_GAIN = 0.35
/** 좌우: 개가 바로 옆 (90°) 일 때 pan 값 (휴대폰 스피커·이어폰에서 너무 한쪽으로 쏠리지 않게) */
export const BARK_PAN_DEPTH = 0.6

/** 거리 (m) → 배율. 1 m 안 1, 멀면 1/거리, 최소 0.35. 모르면 1 */
export function barkDistanceGain(distance: number | null | undefined): number {
  if (distance === null || distance === undefined || !Number.isFinite(distance) || distance <= BARK_FULL_M) return 1
  return Math.max(BARK_MIN_GAIN, BARK_FULL_M / distance)
}

type Vec3 = { x: number; y: number; z: number }

export interface BarkListener {
  /** 폰에서 개까지 바닥 거리 (m) */
  distance: number
  /** -1 (왼쪽) ~ 1 (오른쪽) */
  pan: number
}

/**
 * 폰(카메라)과 개 자리로 거리·좌우. viewMatrix 는 기준 공간 → 카메라 공간 (열 우선 4x4, -z 가 정면, +x 가 화면 오른쪽).
 * 거리는 바닥 거리 (높이 차 빼고), 좌우는 카메라 기준 방위의 sin × BARK_PAN_DEPTH
 */
export function barkListenerFrom(camera: Vec3, viewMatrix: ArrayLike<number>, dog: Vec3): BarkListener {
  const m = viewMatrix
  const x = m[0] * dog.x + m[4] * dog.y + m[8] * dog.z + m[12]
  const z = m[2] * dog.x + m[6] * dog.y + m[10] * dog.z + m[14]
  const across = Math.hypot(x, z)
  const pan = across > 1e-3 ? Math.max(-1, Math.min(1, (x / across) * BARK_PAN_DEPTH)) : 0
  return { distance: Math.hypot(dog.x - camera.x, dog.z - camera.z), pan }
}

// ── 소리 켜기/끄기 기억 ──

export const BARK_SOUND_STORAGE_KEY = 'lovablepet.ar.barkSound'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
const defaultStorage = (): StorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** 기본 켜짐. 껐던 것만 기억해서 꺼짐 (읽을 수 없으면 켜짐) */
export function readBarkSoundOn(storage: StorageLike | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(BARK_SOUND_STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function writeBarkSoundOn(on: boolean, storage: StorageLike | null = defaultStorage()) {
  try {
    storage?.setItem(BARK_SOUND_STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // 개인 정보 보호 모드 등: 이번 화면에서만
  }
}

// ── Web Audio ──
// 쓰는 것만 적은 모양 (단위 시험은 가짜 AudioContext 를 넣는다)

interface ParamLike {
  value: number
}
interface NodeLike {
  connect(destination: NodeLike): unknown
  disconnect(): void
}
interface SourceLike extends NodeLike {
  buffer: unknown
  playbackRate: ParamLike
  onended: (() => void) | null
  start(when?: number): void
  stop(when?: number): void
}
interface GainLike extends NodeLike {
  gain: ParamLike
}
interface PannerLike extends NodeLike {
  pan: ParamLike
}
export interface AudioContextLike {
  readonly currentTime: number
  readonly state: string
  readonly destination: NodeLike
  resume(): Promise<void>
  close(): Promise<void>
  createBufferSource(): SourceLike
  createGain(): GainLike
  createStereoPanner?: () => PannerLike
}

/** 한 번의 짖기 */
export interface BarkRequest {
  template: string | null | undefined
  /** 지금 클립 시각 (s) */
  clipTime?: number
  clipRate?: number
  duration?: number
  times?: number
  /** 폰에서 개까지 (모르면 1 m·가운데로 본다) */
  listener?: BarkListener | null
}

/** 예약 결과 (개발 기록·시험) */
export type BarkScheduleResult =
  | { scheduled: true; sound: BarkSoundId; pitch: number; delays: number[]; gain: number; pan: number }
  | { scheduled: false; reason: 'off' | 'mic' | 'locked' | 'loading' | 'disposed' }

interface Voice {
  source: SourceLike
  nodes: NodeLike[]
  /** 컨텍스트 시각 (s) */
  at: number
}

export interface BarkPlayerOptions {
  /** 사용자 탭 안에서 부른다. 못 만들면 null */
  createContext?: () => AudioContextLike | null
  /** 파일 받아 디코드 (페이지를 열 때 한 번) */
  loadBuffers?: () => Promise<Record<BarkSoundId, unknown>>
  random?: () => number
}

const browserContext = (): AudioContextLike | null => {
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  if (!Ctor) return null
  try {
    return new Ctor({ latencyHint: 'interactive' }) as unknown as AudioContextLike
  } catch {
    return null
  }
}

/** 두 파일을 받아 OfflineAudioContext 로 디코드 (사용자 탭 없이도 된다. AudioBuffer 는 다른 컨텍스트에서 틀 수 있다) */
export async function loadBarkBuffers(fetcher: typeof fetch = fetch): Promise<Record<BarkSoundId, AudioBuffer>> {
  const Offline =
    window.OfflineAudioContext ?? (window as Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
  if (!Offline) throw new Error('OfflineAudioContext 없음')
  const decoder = new Offline(1, 1, 48000)
  const decode = async (id: BarkSoundId) => {
    const response = await fetcher(BARK_SOUND_URL[id])
    if (!response.ok) throw new Error(`${BARK_SOUND_URL[id]} ${response.status}`)
    const bytes = await response.arrayBuffer()
    // 옛 사파리는 promise 를 돌려주지 않아 콜백으로
    return new Promise<AudioBuffer>((resolve, reject) => {
      const result = decoder.decodeAudioData(bytes, resolve, reject)
      if (result && typeof result.then === 'function') result.then(resolve, reject)
    })
  }
  const [big, small] = await Promise.all([decode('big'), decode('small')])
  return { big, small }
}

export class BarkPlayer {
  private readonly createContext: () => AudioContextLike | null
  private readonly loadBuffers: () => Promise<Record<BarkSoundId, unknown>>
  private readonly random: () => number
  private context: AudioContextLike | null = null
  private buffers: Record<BarkSoundId, unknown> | null = null
  private loading: Promise<void> | null = null
  private voices: Voice[] = []
  private enabled = true
  private micOpen = false
  private active = true
  /** 디코드에 실패 (이 브라우저가 Ogg Opus 를 못 푸는 등). 소리 없이 지나간다 */
  loadError: string | null = null

  constructor(options: BarkPlayerOptions = {}) {
    this.createContext = options.createContext ?? browserContext
    this.loadBuffers = options.loadBuffers ?? (() => loadBarkBuffers())
    this.random = options.random ?? Math.random
  }

  /** 파일을 받아 디코드해 둔다 (한 번) */
  preload(): Promise<void> {
    this.loading ??= this.loadBuffers().then(
      (buffers) => {
        this.buffers = buffers
      },
      (error: unknown) => {
        this.loadError = error instanceof Error ? error.message : String(error)
      },
    )
    return this.loading
  }

  /** 사용자 탭 안에서: AudioContext 를 만들거나 다시 켠다 (자동재생 제한 풀기) */
  unlock() {
    if (!this.active) return
    this.context ??= this.createContext()
    const context = this.context
    if (context && context.state !== 'running' && context.state !== 'closed') void context.resume().catch(() => {})
  }

  /** AudioContext 상태 (시험·개발 기록). 아직 안 만들었으면 'none' */
  get contextState(): string {
    return this.context?.state ?? 'none'
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (!on) this.stopAll()
  }

  /** 마이크로 듣는 중: 켜지면 나고 있던 소리·예약을 모두 멈추고, 듣는 동안은 예약하지 않는다 */
  setMicOpen(open: boolean) {
    this.micOpen = open
    if (open) this.stopAll()
  }

  /** 짖기 한 번: 높이를 한 번 정하고 클립 시각에 맞춰 소리를 예약한다 */
  bark(request: BarkRequest): BarkScheduleResult {
    if (!this.active) return { scheduled: false, reason: 'disposed' }
    if (!this.enabled) return { scheduled: false, reason: 'off' }
    if (this.micOpen) return { scheduled: false, reason: 'mic' }
    const context = this.context
    if (!context || context.state !== 'running') return { scheduled: false, reason: 'locked' }
    const voice = barkVoiceFor(request.template)
    const buffer = this.buffers?.[voice.sound]
    if (!buffer) return { scheduled: false, reason: 'loading' }
    const pitch = pickBarkPitch(voice.rate, this.random)
    const delays = barkSoundDelays(request)
    const listener = request.listener ?? null
    const gain = BARK_VOLUME * barkDistanceGain(listener?.distance)
    const pan = listener?.pan ?? 0
    const now = context.currentTime
    for (const delay of delays) this.schedule(context, buffer, now + delay, pitch, gain, pan)
    return { scheduled: true, sound: voice.sound, pitch, delays, gain, pan }
  }

  /** 아직 안 난 소리만 취소 (짖기가 끊김). 취소한 수 */
  cancelPending(): number {
    const now = this.context?.currentTime ?? 0
    const pending = this.voices.filter((voice) => voice.at > now)
    pending.forEach((voice) => this.stopVoice(voice))
    return pending.length
  }

  /** 나고 있는 소리까지 모두 멈춘다 (마이크·끄기·나가기). 멈춘 수 */
  stopAll(): number {
    const count = this.voices.length
    ;[...this.voices].forEach((voice) => this.stopVoice(voice))
    return count
  }

  /** 예약됐거나 나고 있는 소리 수 (시험) */
  get voiceCount() {
    return this.voices.length
  }

  /** 화면을 떠날 때: 모두 멈추고 컨텍스트를 닫는다 (디코드한 소리는 남겨 다시 쓸 수 있다) */
  deactivate() {
    this.active = false
    this.stopAll()
    const context = this.context
    this.context = null
    if (context && context.state !== 'closed') void context.close().catch(() => {})
  }

  /** 다시 쓴다 (개발 모드 StrictMode 의 effect 두 번 등). 컨텍스트는 다음 탭에서 다시 만든다 */
  activate() {
    this.active = true
  }

  private schedule(context: AudioContextLike, buffer: unknown, at: number, pitch: number, gain: number, pan: number) {
    const source = context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = pitch
    const volume = context.createGain()
    volume.gain.value = gain
    const nodes: NodeLike[] = [source, volume]
    source.connect(volume)
    let last: NodeLike = volume
    if (pan !== 0 && context.createStereoPanner) {
      const panner = context.createStereoPanner()
      panner.pan.value = pan
      volume.connect(panner)
      nodes.push(panner)
      last = panner
    }
    last.connect(context.destination)
    const voice: Voice = { source, nodes, at }
    source.onended = () => this.release(voice)
    this.voices.push(voice)
    source.start(at)
  }

  private stopVoice(voice: Voice) {
    try {
      voice.source.stop()
    } catch {
      // 이미 멈춤
    }
    this.release(voice)
  }

  private release(voice: Voice) {
    const index = this.voices.indexOf(voice)
    if (index < 0) return
    this.voices.splice(index, 1)
    voice.source.onended = null
    voice.nodes.forEach((node) => {
      try {
        node.disconnect()
      } catch {
        // 이미 끊김
      }
    })
  }
}
