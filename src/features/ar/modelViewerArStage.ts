import type { ModelViewerElement } from '@google/model-viewer'
import {
  AnimationMixer,
  CircleGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type PerspectiveCamera,
  Vector3,
  type AnimationClip,
  type BufferGeometry,
  type Object3D,
} from 'three'
import {
  YAW_MISMATCH_RAD,
  type ArStage,
  type DepthSampler,
  type DrawnYawCheck,
  type ProbeSet,
  type RingMark,
  type RingPose,
  type RingTone,
  type SensorState,
  type StageFrame,
  type StageSensors,
} from './placement/arStage'
import type { Ray, SurfaceHit, Vec3 } from './placement/types'
import type { StageOccluder } from './depthOcclusion'
import type { WalkPose, WalkRig } from './walk/walkStage'
import type { GazeCommand } from './gaze/gazeController'
import type { GazeRig } from './gaze/gazeStage'
import { GAZE_JAW_CLIPS } from './gaze/gazeSpec'
import { findNeckBones, NeckAim, type BoneLike } from './neckAim'
import { PoseBlend, quietTailStart, type BlendBone, type BlendInfo, type TrackLike } from './poseBlend'
import { HEAD_TILT_DEG, headTiltAmount, HEAD_TILT_S, rollLocal } from './headTilt'
import { buildBodyProxy, type BodyProxy, type ProxyNode } from './bodyProxy'
import type { NearFadeMode, NearRig } from './nearCamera'
import { computeTurnSweep, type SweepCapsule } from './walk/turnSweep'
import {
  modelFeatures,
  parseTurnExtras,
  parseWalkExtras,
  STANDING_CLIP,
  WALK_CLIPS,
  type ExtrasSource,
  type ScaleSource,
  type TurnClipSpec,
  type WalkClip,
  type WalkExtras,
  type WalkModelInfo,
} from './walk/walkSpec'
import { drawnYaw, setPivotYaw, wrapYaw, type PivotLike } from './pivotYaw'
import { enabledFeaturesOf } from './xrDepthRequest'

// model-viewer 내부를 쓰는 곳은 이 파일 하나다 (배치 로직의 ArStage 와 산책의 WalkRig 를 채우는 어댑터).
// @google/model-viewer 4.1.0 · three 0.172.0 소스 기준 (package.json 에 고정).
// 공개 API 로는 AR 에서 개를 숨기거나, 탭한 자리에 바로 놓거나, 우리 hit-test 를 돌리거나, 클립을 프레임 단위로 바꿀 수 없다.
//
// 쓰는 내부
// - 요소의 Symbol('scene') → ModelScene (three 의 Scene, 장면 루트)
//   - pivot: 개 위치·방향. target: 개·바닥 표시 상자(PlacementBox)·그림자의 부모 (target 만 숨기면 셋이 함께 숨는다)
//   - 산책: mixer(AnimationMixer)·animationsByName(클립)·model(glTF 장면: userData 에 scenes[0].extras, children 이 루트 노드)
//   - 자세 층(PoseLayers: 자세 섞기 → 고개 바라보기·턱): renderShadow 를 인스턴스에서 한 번 감싸 그 앞에 뼈를 바꾼다.
//     Renderer.render(화면 안 3D)·ARRenderer.onWebXRFrame 모두 preRender(애니메이션 믹서) → renderShadow → render 순서라
//     그림자와 화면이 같은 자세를 쓴다. 클립이 바뀐 것은 animationName·currentTime(·산책 리그의 drivingClip) 으로 본다
//   - 반응 말풍선(headScreenPoint): getCamera()(AR 중이면 XR 카메라)·model 의 head_jnt·boundingBox. 화면 안 3D 에서도 쓴다
// - 요소 프로토타입의 Symbol('renderer') getter → Renderer (싱글턴)
//   - arRenderer(ARRenderer): currentSession, goalPosition·goalYaw, placementComplete, placementBox, initialHitSource
//   - threeRenderer.xr.getReferenceSpace(): model-viewer 가 쓰는 'local' 기준 공간
// ARRenderer 는 매 프레임 pivot 위치를 goalPosition 쪽으로, 방향을 goalYaw 쪽으로 감쇠시킨다. 그래서 둘을 같이 맞춘다.
// 방향은 scene.yaw 가 아니라 pivot.rotation 을 통째로 넣는다 (scene.yaw 는 |yaw| > 90° 에서 틀리게 그려진다, ./pivotYaw.ts).
// 모양이 다르면(버전이 바뀌면) attach 가 null 을 돌려주고, 부르는 쪽은 model-viewer 기본 흐름(자동 착지)으로 둔다

/** ARRenderer 의 AR_SHADOW_INTENSITY. 내보내지 않는 값이라 같은 값을 적는다 */
const AR_SHADOW_INTENSITY = 0.8
/** 나타날 때 페이드인 시간. 0 이면 바로 보인다 */
const REVEAL_FADE_MS = 300
const FADE_STEP_MS = 16
/**
 * 원을 면보다 이만큼(m) 아래에 그린다. 깊이 검사 없이 맨 위에 그려 보이는 데는 차이가 없고,
 * 바닥에서 위를 보는 그림자 카메라(near 0)에 원이 찍히지 않는다
 */
const RING_SINK_M = 0.004
/** 원 테두리 굵기 (m) */
const RING_BAND_M = 0.02
/** 가운데 점 반지름 (m). 탭하면 개 발밑 가운데가 여기에 온다 */
const RING_DOT_M = 0.015
const RING_FILL_OPACITY = 0.18
const RING_LINE_OPACITY = 0.95
/** 개·그림자보다 나중에 그린다 */
const RING_RENDER_ORDER = 1000
const RING_COLORS: Record<RingTone, number> = {
  ok: 0xfacc15, // --color-measure
  blocked: 0xef4444,
  marker: 0x22d3ee,
}
/** 디버그 점 반지름 (m) */
const MARK_DOT_M = 0.01
/** 디버그 점 색: 이번 프레임 장애물 · 막는 데 센 표본 */
const MARK_COLORS = { weak: 0xffffff, strong: 0xd946ef } as const

// ── WebXR (TypeScript DOM 타입에 없다). 여기서 쓰는 것만 ──
type XrSpace = object
interface XrRigidTransform {
  position: DOMPointReadOnly
  matrix: Float32Array
  inverse: { matrix: Float32Array }
}
interface XrPose {
  transform: XrRigidTransform
  /** 위치를 추적하지 못해 추정한 값이면 true */
  emulatedPosition?: boolean
}
interface XrView {
  transform: XrRigidTransform
  projectionMatrix: Float32Array
}
interface XrViewerPose extends XrPose {
  views: readonly XrView[]
}
interface XrHitTestResult {
  getPose(space: XrSpace): XrPose | null | undefined
}
interface XrHitTestSource {
  cancel(): void
}
/** 깊이 (usage 'cpu-optimized'). 그 프레임 콜백 안에서만 읽힌다 */
interface XrCpuDepthInformation {
  width: number
  height: number
  /** x·y 는 화면 좌표 0~1 (왼쪽 위 원점). 밖이면 RangeError */
  getDepthInMeters(x: number, y: number): number
  /** 가림 시험(개발용)이 텍스처로 올린다: 깊이 버퍼, 값 → m, 정규화 뷰 좌표 → 정규화 깊이 버퍼 좌표 */
  readonly data: ArrayBuffer
  readonly rawValueToMeters: number
  readonly normDepthBufferFromNormView: { matrix: Float32Array }
}
interface XrFrame {
  getViewerPose(space: XrSpace): XrViewerPose | null | undefined
  getHitTestResults(source: XrHitTestSource): readonly XrHitTestResult[]
  /** depth-sensing 이 켜지지 않았으면 예외 */
  getDepthInformation?(view: XrView): XrCpuDepthInformation | null | undefined
}
/** 광선. origin 은 w 1, direction 은 w 0 */
type XrRayConstructor = new (origin: DOMPointInit, direction: DOMPointInit) => object
interface XrSession {
  requestReferenceSpace(type: 'viewer'): Promise<XrSpace>
  requestHitTestSource?(options: {
    space: XrSpace
    offsetRay?: unknown
    /** 기본 ['plane']. 'point' 는 특징점 */
    entityTypes?: string[]
  }): Promise<XrHitTestSource>
  requestAnimationFrame(callback: (time: number, frame: XrFrame) => void): number
  cancelAnimationFrame(handle: number): void
  /** depth-sensing 이 켜지지 않았으면 읽을 때 예외 */
  readonly depthUsage?: string
  readonly depthDataFormat?: string
}

// ── model-viewer 내부 모양 ──
interface Vector3Like {
  x: number
  y: number
  z: number
  set(x: number, y: number, z: number): unknown
}
interface MaterialLike {
  transparent: boolean
  opacity: number
  needsUpdate: boolean
}
interface NodeLike {
  visible: boolean
  isMesh?: boolean
  material?: MaterialLike | MaterialLike[]
  traverse(visit: (node: NodeLike) => void): void
}
interface ModelSceneLike extends NodeLike {
  pivot: PivotLike & { position: Vector3Like }
  target: NodeLike & { matrixWorld: { elements: ArrayLike<number> } }
  /** 모델 좌표(target 기준) */
  boundingBox: { min: Vector3Like; max: Vector3Like }
  model: unknown
  add(object: object): unknown
  /** target 을 감쇠 없이 목표(모델 바닥이 pivot 에 오는 자리)로 옮긴다 */
  jumpToGoal(): void
  setShadowIntensity(intensity: number): void
  setShadowOffset(offset: number): void
  queueShadowRender(): void
  /** 그림자가 필요하면 찍는다. 애니메이션 뒤·그리기 전에 부른다 (자세 층 PoseLayers 가 감싼다) */
  renderShadow?(renderer: unknown): void
  /** 화면 안 3D 에서 다음 프레임도 그리게 한다 (isDirty) */
  queueRender?(): void
  /** 바닥 그림자 (shadow-intensity 가 0 이면 없다). floor 는 그림자 텍스처를 붙인 평면 */
  shadow?: { floor?: { visible: boolean; material: { opacity: number } } } | null
}
interface PlacementBoxLike {
  show: boolean
  offsetHeight: number
  visible: boolean
  material: { opacity: number }
}
interface ArRendererLike {
  currentSession: unknown
  presentedScene: unknown
  goalPosition: Vector3Like
  goalYaw: number
  placementComplete: boolean
  placementBox: PlacementBoxLike | null
  initialHitSource: XrHitTestSource | null
  dispatchEvent(event: { type: 'status'; status: string }): void
}
interface RendererLike {
  arRenderer: ArRendererLike
  threeRenderer: { xr: { getReferenceSpace(): XrSpace | null } }
}

// ── 산책: three 의 AnimationMixer·AnimationAction 중 쓰는 것 ──
interface ClipLike {
  name: string
  duration: number
}
interface ActionLike {
  time: number
  enabled: boolean
  paused: boolean
  play(): unknown
  stop(): unknown
  reset(): unknown
  isScheduled(): boolean
  setEffectiveWeight(weight: number): unknown
}
interface MixerLike {
  clipAction(clip: ClipLike, root?: unknown): ActionLike
  existingAction(clip: ClipLike, root?: unknown): ActionLike | null
  update(deltaTime: number): unknown
}
interface AnimatedSceneLike {
  mixer: MixerLike
  animationsByName: Map<string, ClipLike>
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const hasMethods = (value: Record<string, unknown>, names: readonly string[]) =>
  names.every((name) => typeof value[name] === 'function')
const isVector = (value: unknown): value is Vector3Like =>
  isRecord(value) &&
  typeof value.x === 'number' &&
  typeof value.y === 'number' &&
  typeof value.z === 'number' &&
  typeof value.set === 'function'
const isNode = (value: unknown): value is NodeLike =>
  isRecord(value) && typeof value.visible === 'boolean' && typeof value.traverse === 'function'
const isMaterial = (value: unknown): value is MaterialLike =>
  isRecord(value) && typeof value.transparent === 'boolean' && typeof value.opacity === 'number'

function isModelScene(value: unknown): value is ModelSceneLike {
  if (!isNode(value) || !isRecord(value)) return false
  const { pivot, target, boundingBox } = value
  return (
    isRecord(pivot) &&
    isVector(pivot.position) &&
    isRecord(pivot.rotation) &&
    typeof pivot.rotation.set === 'function' &&
    isRecord(pivot.matrixWorld) &&
    isNode(target) &&
    isRecord((target as unknown as Record<string, unknown>).matrixWorld) &&
    isRecord(boundingBox) &&
    isVector(boundingBox.min) &&
    isVector(boundingBox.max) &&
    hasMethods(value, ['add', 'jumpToGoal', 'setShadowIntensity', 'setShadowOffset', 'queueShadowRender'])
  )
}

function isRenderer(value: unknown): value is RendererLike {
  if (!isRecord(value) || !isRecord(value.arRenderer) || !isRecord(value.threeRenderer)) return false
  const ar = value.arRenderer
  const { xr } = value.threeRenderer
  return (
    isVector(ar.goalPosition) &&
    typeof ar.goalYaw === 'number' &&
    typeof ar.placementComplete === 'boolean' &&
    'placementBox' in ar &&
    'initialHitSource' in ar &&
    typeof ar.dispatchEvent === 'function' &&
    isRecord(xr) &&
    typeof xr.getReferenceSpace === 'function'
  )
}

const isSession = (value: unknown): value is XrSession =>
  isRecord(value) && hasMethods(value, ['requestReferenceSpace', 'requestAnimationFrame', 'cancelAnimationFrame'])

const isClip = (value: unknown): value is ClipLike =>
  isRecord(value) && typeof value.name === 'string' && typeof value.duration === 'number' && value.duration > 0

const isAnimatedScene = (value: unknown): value is AnimatedSceneLike =>
  isRecord(value) &&
  isRecord(value.mixer) &&
  hasMethods(value.mixer, ['clipAction', 'existingAction', 'update']) &&
  value.animationsByName instanceof Map

/** glTF 루트 노드 배율. 루트마다 세 축이 같고 루트끼리도 같으면 그 값, 아니면 null */
function rootScale(model: unknown): number | null {
  if (!isRecord(model) || !Array.isArray(model.children) || model.children.length === 0) return null
  let found: number | null = null
  for (const child of model.children as unknown[]) {
    if (!isRecord(child) || !isRecord(child.scale)) return null
    const { x, y, z } = child.scale
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number' || !(x > 0)) return null
    const same = (a: number, b: number) => Math.abs(a - b) <= 1e-4 * Math.max(a, b)
    if (!same(x, y) || !same(x, z) || (found !== null && !same(found, x))) return null
    found = x
  }
  return found
}

/**
 * GLB 를 다시 받아 JSON 청크의 scenes[scene].extras 를 읽는다 (three 장면 userData 에 extras.walk 가 없을 때).
 * 머리(20바이트)로 JSON 길이를 읽고 그만큼만 받는다. 서버가 Range 를 무시하면 받은 전체에서 읽는다
 */
async function readGlbSceneExtras(url: string): Promise<Record<string, unknown> | null> {
  const fetchRange = async (start: number, end: number) => {
    const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } })
    if (!response.ok) throw new Error(`GLB ${response.status}`)
    return { partial: response.status === 206, buffer: await response.arrayBuffer() }
  }
  const head = await fetchRange(0, 19)
  const headView = new DataView(head.buffer)
  // 'glTF' · 첫 청크 종류 'JSON'
  if (head.buffer.byteLength < 20 || headView.getUint32(0, true) !== 0x46546c67 || headView.getUint32(16, true) !== 0x4e4f534a) {
    return null
  }
  const length = headView.getUint32(12, true)
  const body = head.partial ? await fetchRange(20, 20 + length - 1) : null
  const bytes = body?.partial ? new Uint8Array(body.buffer, 0, length) : new Uint8Array(body?.buffer ?? head.buffer, 20, length)
  const json: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (!isRecord(json) || !Array.isArray(json.scenes)) return null
  const scene: unknown = json.scenes[typeof json.scene === 'number' ? json.scene : 0]
  return isRecord(scene) && isRecord(scene.extras) ? scene.extras : null
}

/**
 * 이름(description)으로 Symbol 키 값을 읽는다. 자기 속성부터 프로토타입 쪽으로 찾는다.
 * 같은 Symbol 을 import 하면 번들이 나뉠 때 다른 값이 될 수 있어 이름으로 찾는다. 같은 이름이 둘 이상이면 포기
 */
function readSymbol(object: object, description: string): unknown {
  for (let owner: object | null = object; owner; owner = Object.getPrototypeOf(owner) as object | null) {
    const keys = Object.getOwnPropertySymbols(owner).filter((key) => key.description === description)
    if (keys.length > 1) return undefined
    if (keys.length === 1) return (object as Record<symbol, unknown>)[keys[0]]
  }
  return undefined
}

/**
 * 세션이 깊이를 CPU 로 주는지. enabledFeatures 가 없는 브라우저는 depthUsage 를 읽어 본다 (꺼져 있으면 예외).
 * 이 세션의 enabledFeatures 는 three 에게 depth-sensing 을 숨긴 목록이라 실제 목록(enabledFeaturesOf)을 본다
 */
function readDepthSupport(session: XrSession): { state: SensorState; format: string | null; dataFormat: string | null } {
  const features = enabledFeaturesOf(session)
  if (features && !features.includes('depth-sensing')) return { state: 'off', format: null, dataFormat: null }
  try {
    const usage = session.depthUsage
    if (usage !== 'cpu-optimized') return { state: 'off', format: usage ?? null, dataFormat: null }
    const dataFormat = session.depthDataFormat ?? null
    return { state: 'on', format: `${usage} · ${dataFormat ?? '?'}`, dataFormat }
  } catch {
    return { state: 'off', format: null, dataFormat: null }
  }
}

function toDepthSampler(info: XrCpuDepthInformation): DepthSampler {
  return {
    width: info.width,
    height: info.height,
    at: (u, v) => {
      if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null
      try {
        const meters = info.getDepthInMeters(u, v)
        // 0 은 값 없음
        return meters > 0 && Number.isFinite(meters) ? meters : null
      } catch {
        return null
      }
    },
  }
}

function cancelQuietly(source: XrHitTestSource) {
  try {
    source.cancel()
  } catch {
    // 세션이 끝났거나 이미 취소됨
  }
}

/** 첫 결과의 위치와 면의 위쪽 방향. 포즈 행렬은 열 우선 4x4: 두 번째 열이 면의 위쪽(y축), 네 번째 열이 위치 */
function firstHit(frame: XrFrame, source: XrHitTestSource, space: XrSpace): SurfaceHit | null {
  const pose = frame.getHitTestResults(source)[0]?.getPose(space)
  if (!pose) return null
  const m = pose.transform.matrix
  return { position: { x: m[12], y: m[13], z: m[14] }, normal: { x: m[4], y: m[5], z: m[6] } }
}

interface RingObject {
  group: Group
  materials: MeshBasicMaterial[]
  geometries: BufferGeometry[]
  radius: number
  tone: RingTone
  /** 디버그 점 (필요한 만큼 늘려 다시 쓴다) */
  marks: Mesh[]
  markGeometry: BufferGeometry
  markMaterials: Record<keyof typeof MARK_COLORS, MeshBasicMaterial>
}

export class ModelViewerArStage implements ArStage {
  readonly dogSize: Vec3
  private readonly mv: ModelViewerElement
  private readonly scene: ModelSceneLike
  private readonly ar: ArRendererLike
  private readonly session: XrSession
  private readonly space: XrSpace
  private frameHandle: number | null = null
  private centerSource: XrHitTestSource | null = null
  /** 화면 가운데 광선의 특징점 hit-test. 못 쓰면 null */
  private pointSource: XrHitTestSource | null = null
  /** 지금 도는 XR 프레임. 프레임 콜백 밖에서는 null (hit-test 결과는 프레임 안에서만 읽힌다) */
  private frame: XrFrame | null = null
  private readonly probeSets = new Set<ProbeSet>()
  private readonly sensors: StageSensors = { depth: 'pending', depthFormat: null, points: 'pending' }
  /** 깊이 형식 ('luminance-alpha' · 'float32'). 가림 시험이 텍스처 형식을 고른다 */
  private depthDataFormat: string | null = null
  /** 가림 시험 (개발용 ?occlusion=1·raw). 없으면 null */
  private occluder: StageOccluder | null = null
  private ring: RingObject | null = null
  /** 보이는 원의 면 높이 (놓기 전 가림 시험의 바닥). 원이 없으면 null */
  private ringFloorY: number | null = null
  private dogPlaced = false
  /** 놓은 뒤 그려진 방향 비교 (디버그) */
  private yawCheck = { frames: 0, mismatchFrames: 0, worst: 0 }
  private fadeTimer: ReturnType<typeof setInterval> | undefined
  private restoreMaterials: (() => void) | null = null
  /** 산책 리그 (고개 바라보기가 산책이 돌리는 클립을 읽는다) */
  private walkRig: ModelViewerWalkRig | null = null
  /** 고개 바라보기. 만들지 않았으면 null */
  private gaze: { rig: GazeRig; unhook: () => void } | null = null
  /** 카메라가 가까울 때 개 몸 캡슐 (모델마다 한 번) */
  private bodyProxy: BodyProxy | null | undefined = undefined
  /** 가까워서 흐리거나 숨긴 동안 원래 값 (1 로 돌아오면 되돌린다) */
  private nearSaved: {
    materials: { material: MaterialLike; transparent: boolean; opacity: number }[]
    floor: { visible: boolean; opacity: number } | null
  } | null = null
  private disposed = false

  /** attach (AR) 나 개발용 attachSceneStage (화면 안 3D 시뮬레이션) 로 만든다 */
  constructor(
    mv: ModelViewerElement,
    scene: ModelSceneLike,
    ar: ArRendererLike,
    session: XrSession,
    space: XrSpace,
  ) {
    this.mv = mv
    this.scene = scene
    this.ar = ar
    this.session = session
    this.space = space
    const { x, y, z } = mv.getDimensions()
    this.dogSize = { x, y, z }
  }

  /** AR(WebXR) 세션이 시작된 뒤('session-started') 부른다. 내부 모양이 다르거나 세션이 없으면 null */
  static attach(mv: ModelViewerElement): ModelViewerArStage | null {
    const scene = readSymbol(mv, 'scene')
    const renderer = readSymbol(mv, 'renderer')
    if (!isModelScene(scene) || !isRenderer(renderer)) return null
    const { arRenderer: ar, threeRenderer } = renderer
    const session = ar.currentSession
    const space = threeRenderer.xr.getReferenceSpace()
    if (!isSession(session) || !space || ar.presentedScene !== scene) return null
    return new ModelViewerArStage(mv, scene, ar, session, space)
  }

  start(onFrame: (frame: StageFrame) => void, onUnavailable: (reason: string) => void) {
    const { session, space } = this
    const requestHitTestSource = session.requestHitTestSource?.bind(session)
    if (!requestHitTestSource) {
      onUnavailable('requestHitTestSource 없음')
      return
    }
    // offsetRay 를 안 주면 viewer 공간 원점에서 앞(-z)으로, 곧 화면 가운데로 나가는 광선이다
    const viewerSpace = session.requestReferenceSpace('viewer')
    viewerSpace
      .then((viewer) => requestHitTestSource({ space: viewer }))
      .then((source) => {
        if (this.disposed) cancelQuietly(source)
        else this.centerSource = source
      })
      .catch((error: unknown) => {
        if (!this.disposed) onUnavailable(error instanceof Error ? error.message : String(error))
      })
    // 같은 광선으로 특징점도 본다. 면으로 인식되지 않은 책상·문은 평면 광선이 통과하지만 무늬 점에는 맞는다.
    // 지원하지 않으면(예외) 조용히 건너뛴다
    viewerSpace
      .then((viewer) => requestHitTestSource({ space: viewer, entityTypes: ['point'] }))
      .then(
        (source) => {
          if (this.disposed) {
            cancelQuietly(source)
            return
          }
          this.pointSource = source
          this.sensors.points = 'on'
        },
        () => {
          this.sensors.points = 'off'
        },
      )

    // 깊이 센서는 세션을 열 때 정해진다 (xrDepthRequest.ts 가 요청을 더한다)
    const depth = readDepthSupport(session)
    this.sensors.depth = depth.state
    this.sensors.depthFormat = depth.format
    this.depthDataFormat = depth.dataFormat

    // three.js 의 XR 루프(model-viewer 가 그린다)보다 나중에 등록돼 같은 프레임에서 그 뒤에 돈다.
    // 여기서 옮긴 원은 다음 프레임에 그려진다 (원은 바닥에 붙어 있어 한 프레임 늦어도 티가 안 난다)
    const loop = (time: number, frame: XrFrame) => {
      if (this.disposed) return
      this.frameHandle = session.requestAnimationFrame(loop)
      // 놓은 뒤에 model-viewer 의 첫 바닥 hit-test 가 늦게 생겼으면 끝낸다 (맞으면 개 높이를 바꿔 버린다)
      if (this.dogPlaced && this.ar.initialHitSource) this.stopInitialHitTest()
      if (this.dogPlaced) this.checkDrawnYaw()
      const pose = frame.getViewerPose(space)
      // 휴대폰 AR 은 화면이 하나다 (view 하나)
      const view = pose?.views[0]
      if (!pose || !view) return
      const { x, y, z } = pose.transform.position
      this.frame = frame
      const depthInfo = this.readDepth(frame, view)
      this.feedOccluder(time, depthInfo, view)
      try {
        onFrame({
          time,
          camera: { x, y, z },
          tracking: !pose.emulatedPosition,
          view: { viewMatrix: view.transform.inverse.matrix, projectionMatrix: view.projectionMatrix },
          centerHit: this.centerSource ? firstHit(frame, this.centerSource, space) : null,
          centerPointHit: this.pointSource ? firstHit(frame, this.pointSource, space) : null,
          depth: depthInfo ? toDepthSampler(depthInfo) : null,
          sensors: this.sensors,
        })
      } finally {
        this.frame = null
      }
    }
    this.frameHandle = session.requestAnimationFrame(loop)
  }

  setRing(pose: RingPose | null) {
    if (this.disposed) return
    if (!pose) {
      if (this.ring) this.ring.group.visible = false
      this.ringFloorY = null
      return
    }
    this.ringFloorY = pose.center.y
    const ring = this.ensureRing(pose.radius)
    ring.group.position.set(pose.center.x, pose.center.y - RING_SINK_M, pose.center.z)
    if (ring.tone !== pose.tone) {
      ring.tone = pose.tone
      for (const material of ring.materials) material.color.set(RING_COLORS[pose.tone])
    }
    this.setMarks(ring, pose.center, pose.marks ?? [])
    ring.group.visible = true
  }

  placeDog(position: Vec3, yaw: number) {
    if (this.disposed) return
    const { scene, ar } = this
    this.stopInitialHitTest()
    // 모델 바닥을 pivot 에 맞추는 이동(target)이 아직 감쇠 중이면 끝까지 옮긴다
    scene.jumpToGoal()
    // 위치·방향을 목표와 같이 맞춰 감쇠(끌려감·돌아감) 없이 바로 그 자리에 둔다
    scene.pivot.position.set(position.x, position.y, position.z)
    ar.goalPosition.set(position.x, position.y, position.z)
    ar.goalYaw = setPivotYaw(scene.pivot, yaw)
    // 처음부터 위치가 목표와 같으면 ARRenderer.moveScene 의 착지 처리가 돌지 않는다. 같은 일을 여기서 한다
    ar.placementComplete = true
    const box = ar.placementBox
    if (box) {
      box.show = false
      box.material.opacity = 0
      box.visible = false
      box.offsetHeight = 0
    }
    scene.setShadowOffset(0)
    scene.setShadowIntensity(AR_SHADOW_INTENSITY)
    // 새 자리에서 그림자를 다시 찍는다
    scene.queueShadowRender()
    this.dogPlaced = true
    this.yawCheck = { frames: 0, mismatchFrames: 0, worst: 0 }
    this.revealDog()
  }

  hideDog() {
    if (this.disposed) return
    this.restoreNear()
    this.stopFade()
    this.dogPlaced = false
    this.scene.target.visible = false
  }

  /**
   * 기준 공간(local)에 고정된 광선마다 hit-test 소스를 하나씩 만든다. 광선 결과는 매 프레임 새로 나온다.
   * 만들기는 비동기라 원이 움직일 때마다 만들지 않고, 부르는 쪽(SpotCheck)이 10cm 넘게 움직였을 때만 부른다
   */
  createProbes(rays: readonly Ray[]): Promise<ProbeSet> {
    const { session, space } = this
    const request = session.requestHitTestSource?.bind(session)
    const XRRayClass = (globalThis as { XRRay?: XrRayConstructor }).XRRay
    if (this.disposed || !request || !XRRayClass) return Promise.reject(new Error('XRRay·requestHitTestSource 없음'))
    const created = rays.map(({ origin, direction }) =>
      request({
        space,
        offsetRay: new XRRayClass({ ...origin, w: 1 }, { ...direction, w: 0 }),
      }),
    )
    return Promise.allSettled(created).then((results) => {
      const sources = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
      if (this.disposed || sources.length !== rays.length) {
        sources.forEach(cancelQuietly)
        const failure = results.find((result) => result.status === 'rejected')
        throw failure?.reason ?? new Error('세션이 끝남')
      }
      const set: ProbeSet = {
        read: () => {
          const { frame } = this
          return sources.map((source) => (frame ? firstHit(frame, source, space) : null))
        },
        cancel: () => {
          if (!this.probeSets.delete(set)) return
          sources.forEach(cancelQuietly)
        },
      }
      this.probeSets.add(set)
      return set
    })
  }

  /**
   * 산책 리그. 걷기 클립 3개와 standing, extras.walk 가 다 있어야 만든다 (하나라도 없으면 null → 산책 버튼을 숨긴다).
   * extras.walk 는 three 장면 userData(GLTFLoader 가 scenes[0].extras 를 넣는다)에서 먼저 읽고, 없으면 GLB JSON 청크를 직접 읽는다.
   * 제자리 회전(turn_*)은 클립과 extras.turn 이 둘 다 있는 것만 쓴다 (extras.walk 와 같은 곳에서 읽는다). 없으면 걸으며 돈다.
   * 크기 배율 s 는 루트 노드 배율(세 축이 같아야), 못 읽으면 모델 높이 ÷ ref_size_m 높이
   */
  async createWalkRig(): Promise<WalkRig | null> {
    const { scene, mv } = this
    if (this.disposed || !isAnimatedScene(scene)) return null
    const clips = new Map<string, ClipLike>()
    for (const name of [STANDING_CLIP, ...WALK_CLIPS]) {
      const clip = scene.animationsByName.get(name)
      if (!isClip(clip)) return null
      clips.set(name, clip)
    }
    const { model } = scene
    const userData = isRecord(model) && isRecord(model.userData) ? model.userData : null
    let extras: WalkExtras | null = userData ? parseWalkExtras(userData.walk) : null
    let turnExtras: unknown = userData?.turn
    let extrasSource: ExtrasSource = 'userData'
    if (!extras && mv.src) {
      extrasSource = 'glb'
      try {
        const sceneExtras = await readGlbSceneExtras(new URL(mv.src, window.location.href).href)
        extras = parseWalkExtras(sceneExtras?.walk)
        turnExtras = sceneExtras?.turn
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[ar] GLB 에서 extras.walk 를 읽지 못함:', error)
      }
    }
    if (!extras || this.disposed) return null
    const root = rootScale(model)
    const scale = root ?? this.dogSize.y / extras.ref_size_m[1]
    const scaleSource: ScaleSource = root !== null ? 'root' : 'size'
    if (!(scale > 0) || !Number.isFinite(scale)) return null
    const durations = Object.fromEntries(WALK_CLIPS.map((name) => [name, clips.get(name)!.duration])) as Record<WalkClip, number>
    // 산책·회전을 쓸 수 있는지는 modelFeatures 하나로 정한다 (옛 GLB 막기, 단위 시험이 같은 함수를 본다)
    const clipNames = [...scene.animationsByName].filter(([, clip]) => isClip(clip)).map(([name]) => name)
    const features = modelFeatures(clipNames, { walk: extras, turn: turnExtras })
    if (!features.walk) return null
    const turnClips = parseTurnExtras(turnExtras)
    const turns: TurnClipSpec[] = []
    for (const name of features.turns) {
      const entry = turnClips[name]
      const clip = scene.animationsByName.get(name)
      if (!entry || !isClip(clip)) continue
      clips.set(name, clip)
      turns.push({ clip: name, angle: (entry.angle_deg * Math.PI) / 180, duration: clip.duration, offset: entry.end_offset_m })
    }
    // 회전 클립마다 개 몸이 쓸고 지나가는 바닥 자리 (몸 돌리기가 사용자 발과 겹치는지)
    if (turns.length) {
      try {
        this.addTurnSweeps(turns, clips)
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[ar] 회전 클립이 쓸고 지나가는 자리를 못 구함:', error)
      }
    }
    const info: WalkModelInfo = { extras, extrasSource, durations, scale, scaleSource, size: { ...this.dogSize }, turns }
    const walkRig = new ModelViewerWalkRig(mv, scene, scene, this.ar, info, clips)
    this.walkRig = walkRig
    // 자세 층이 산책 리그가 돌리는 클립을 읽는다 (그동안은 새로 섞지 않는다)
    const layers = poseLayersFor(mv, scene)
    if (layers) layers.drivingClip = () => (this.walkRig === walkRig ? walkRig.drivingClip : null)
    return walkRig
  }

  /**
   * 고개 바라보기 리그. 목 아래·목 가운데·머리·두 눈·코 뼈가 다 있어야 만든다 (없으면 null → 그 개는 고개를 돌리지 않는다).
   * 자세 층(PoseLayers) 의 바라보기 자리에 넣는다: 믹서와 자세 섞기가 이번 프레임 자세를 쓴 뒤이고, 그림자와 화면이
   * 같은 자세로 그려진다. 산책 리그가 믹서를 직접 돌릴 때(model-viewer 애니메이션 멈춤)도 그 자세 위에 더한다
   */
  createGazeRig(): GazeRig | null {
    if (this.disposed) return null
    if (this.gaze) return this.gaze.rig
    const { scene, mv } = this
    const layers = poseLayersFor(mv, scene)
    if (!layers || !isNode(scene.model)) return null
    const parts = findNeckBones(scene.model as unknown as BoneLike)
    if (!parts) return null
    const aim = new NeckAim(parts, scene.pivot)
    let command: GazeCommand | null = null
    let clip: string | null = null
    // 산책 리그가 돌리는 중이면 그 클립, 아니면 model-viewer 가 돌리는 클립 (자세 층이 넘겨준다)
    const apply = (drawnClip: string | null) => {
      clip = drawnClip
      try {
        // 턱은 지금 그리는 클립이 대기 루프일 때만 (판단 쪽 클립은 한 프레임 늦다: 짖기로 바뀐 첫 프레임에도 입은 그대로)
        return aim.apply(command, clip !== null && GAZE_JAW_CLIPS.has(clip))
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[ar] 고개 바라보기를 끈다:', error)
        command = null
        return false
      }
    }
    layers.gaze = apply
    const rig: GazeRig = {
      sample: () => {
        const sample = aim.sample
        return sample ? { eye: sample.eye, root: sample.root, yaw: sample.yaw, clip } : null
      },
      set: (next) => {
        command = next
      },
    }
    this.gaze = {
      rig,
      unhook: () => {
        aim.restore()
        if (layers.gaze === apply) layers.gaze = null
        scene.queueShadowRender()
      },
    }
    return rig
  }

  /**
   * 이 루프는 model-viewer 가 이번 프레임을 그린 뒤에 돈다. 그래서 지금 pivot 월드 행렬 = 방금 그려진 방향,
   * goalYaw = 지난 프레임에 넣은 방향이다
   */
  private checkDrawnYaw() {
    const drawn = drawnYaw(this.scene.pivot)
    if (drawn === null) return
    const off = Math.abs(wrapYaw(drawn - this.ar.goalYaw))
    const check = this.yawCheck
    check.frames++
    if (off > YAW_MISMATCH_RAD) check.mismatchFrames++
    check.worst = Math.max(check.worst, off)
  }

  dogYawCheck(): DrawnYawCheck | null {
    if (!this.dogPlaced) return null
    return { ...this.yawCheck, drawn: drawnYaw(this.scene.pivot), intended: this.ar.goalYaw }
  }

  dogFootCenter(): Vec3 | null {
    const { min, max } = this.scene.boundingBox
    const e = this.scene.target.matrixWorld.elements
    const x = (min.x + max.x) / 2
    const y = min.y
    const z = (min.z + max.z) / 2
    return {
      x: e[0] * x + e[4] * y + e[8] * z + e[12],
      y: e[1] * x + e[5] * y + e[9] * z + e[13],
      z: e[2] * x + e[6] * y + e[10] * z + e[14],
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.frameHandle !== null) this.session.cancelAnimationFrame(this.frameHandle)
    if (this.centerSource) cancelQuietly(this.centerSource)
    this.centerSource = null
    if (this.pointSource) cancelQuietly(this.pointSource)
    this.pointSource = null
    for (const set of [...this.probeSets]) set.cancel()
    this.occluder?.dispose()
    this.occluder = null
    this.gaze?.unhook()
    this.gaze = null
    this.walkRig = null
    this.restoreNear()
    this.removeRing()
    this.stopFade()
    this.scene.target.visible = true
  }

  /**
   * 가림 시험 (개발용 ?occlusion=1·raw, useArPlacement 가 DEV 에서만 만든다): 깊이만 쓰는 화면 전체 사각형을 장면에 넣고
   * 매 프레임 CPU 깊이를 넘긴다. null 이면 뺀다
   */
  setOccluder(occluder: StageOccluder | null) {
    this.occluder?.dispose()
    this.occluder = null
    this.sensors.occlusion = undefined
    if (this.disposed || !occluder) return
    this.occluder = occluder
    this.scene.add(occluder.mesh)
  }

  /**
   * 이번 프레임 깊이를 가림 시험에 넘긴다 (깊이 버퍼는 이 프레임 안에서만 읽힌다).
   * 깊이를 잰 카메라(이 뷰의 포즈·투영)와 지금 바닥 높이도 같이: 바닥 근처 실제 점은 가리지 않는다
   */
  private feedOccluder(time: number, info: XrCpuDepthInformation | null, view: XrView) {
    const { occluder } = this
    if (!occluder) return
    if (info) {
      try {
        occluder.update({
          time,
          width: info.width,
          height: info.height,
          data: info.data,
          rawValueToMeters: info.rawValueToMeters,
          normDepthBufferFromNormView: info.normDepthBufferFromNormView.matrix,
          format: this.depthDataFormat,
          cameraWorld: view.transform.matrix,
          projectionMatrix: view.projectionMatrix,
          floorY: this.occluderFloorY(),
        })
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[ar] 가림 시험에 깊이를 넘기지 못해 끈다:', error)
        this.setOccluder(null)
        return
      }
    }
    occluder.tick(time)
    this.sensors.occlusion = occluder.status(time)
  }

  /** 가림 시험이 빼는 바닥 높이: 놓은 개의 발(pivot), 놓기 전엔 보이는 원의 면. 모르면 null */
  private occluderFloorY(): number | null {
    if (this.dogPlaced) return this.scene.pivot.position.y
    return this.ringFloorY
  }

  /** 이번 프레임 깊이. 읽다가 예외가 나면 이 세션에서는 깊이를 끈다 */
  private readDepth(frame: XrFrame, view: XrView): XrCpuDepthInformation | null {
    if (this.sensors.depth !== 'on' || !frame.getDepthInformation) return null
    try {
      return frame.getDepthInformation(view) ?? null
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[ar] 깊이를 읽지 못해 끈다:', error)
      this.sensors.depth = 'off'
      return null
    }
  }

  /**
   * model-viewer 가 AR 을 켤 때 한 번 바닥을 찾는 hit-test 를 끝낸다. 늦게 맞으면 개 높이를 그 높이로 바꿔 버린다.
   * 끝낼 때 model-viewer 가 했을 'object-placed' 알림을 대신 보내 요소의 ar-status 가 같은 순서로 바뀌게 한다
   */
  private stopInitialHitTest() {
    const source = this.ar.initialHitSource
    if (!source) return
    cancelQuietly(source)
    this.ar.initialHitSource = null
    this.ar.dispatchEvent({ type: 'status', status: 'object-placed' })
  }

  private ensureRing(radius: number): RingObject {
    if (this.ring?.radius === radius) return this.ring
    this.removeRing()
    const inner = Math.max(0, radius - RING_BAND_M)
    const parts: [BufferGeometry, number, number][] = [
      [new CircleGeometry(inner, 64), RING_FILL_OPACITY, 0],
      [new RingGeometry(inner, radius, 64), RING_LINE_OPACITY, 0],
      [new CircleGeometry(RING_DOT_M, 24), RING_LINE_OPACITY, 1],
    ]
    const group = new Group()
    const materials: MeshBasicMaterial[] = []
    for (const [geometry, opacity, order] of parts) {
      // 세 도형 모두 xy 평면에 그려진다. x축으로 -90° 돌려 바닥에 눕힌다
      geometry.rotateX(-Math.PI / 2)
      const material = new MeshBasicMaterial({
        color: RING_COLORS.ok,
        transparent: true,
        opacity,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      })
      const mesh = new Mesh(geometry, material)
      mesh.renderOrder = RING_RENDER_ORDER + order
      // model-viewer 의 개 맞히기(positionAndNormalFromPoint)는 장면 전체를 본다. 원을 개로 잡지 않게 뺀다
      mesh.userData.noHit = true
      mesh.raycast = () => {}
      group.add(mesh)
      materials.push(material)
    }
    group.visible = false
    // pivot 바깥, 장면 루트에 둔다 (개와 따로 움직인다)
    this.scene.add(group)
    const markGeometry = new CircleGeometry(MARK_DOT_M, 12)
    markGeometry.rotateX(-Math.PI / 2)
    const markMaterial = (color: number) =>
      new MeshBasicMaterial({ color, depthTest: false, depthWrite: false, side: DoubleSide, toneMapped: false })
    this.ring = {
      group,
      materials,
      geometries: parts.map(([geometry]) => geometry),
      radius,
      tone: 'ok',
      marks: [],
      markGeometry,
      markMaterials: { weak: markMaterial(MARK_COLORS.weak), strong: markMaterial(MARK_COLORS.strong) },
    }
    return this.ring
  }

  /** 디버그 점을 원 위에 찍는다 (원 그룹 안, 원 중심 기준). 남는 점은 숨긴다 */
  private setMarks(ring: RingObject, center: Vec3, marks: readonly RingMark[]) {
    while (ring.marks.length < marks.length) {
      const mesh = new Mesh(ring.markGeometry, ring.markMaterials.weak)
      mesh.renderOrder = RING_RENDER_ORDER + 2
      mesh.userData.noHit = true
      mesh.raycast = () => {}
      ring.group.add(mesh)
      ring.marks.push(mesh)
    }
    ring.marks.forEach((mesh, index) => {
      const mark = marks[index]
      mesh.visible = !!mark
      if (!mark) return
      mesh.position.set(mark.position.x - center.x, mark.position.y - center.y, mark.position.z - center.z)
      mesh.material = mark.strong ? ring.markMaterials.strong : ring.markMaterials.weak
    })
  }

  private removeRing() {
    const ring = this.ring
    this.ringFloorY = null
    if (!ring) return
    ring.group.removeFromParent()
    for (const geometry of ring.geometries) geometry.dispose()
    for (const material of ring.materials) material.dispose()
    ring.markGeometry.dispose()
    ring.markMaterials.weak.dispose()
    ring.markMaterials.strong.dispose()
    this.ring = null
  }

  /** 개 모델의 재질. 모델은 다시 불러오면 바뀌어서 그때그때 읽는다 */
  private materials(): MaterialLike[] {
    const { model } = this.scene
    const found = new Set<MaterialLike>()
    if (isNode(model)) {
      model.traverse((node) => {
        if (!node.isMesh) return
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (isMaterial(material)) found.add(material)
        }
      })
    }
    return [...found]
  }

  /**
   * 카메라가 너무 가까울 때 (./nearCamera.ts, 배포 빌드에도): 몸 표면까지 거리와 개·그림자 불투명도.
   * 몸 캡슐은 처음 부를 때 한 번 만든다 (몸통 뼈가 없으면 거리는 null)
   */
  createNearRig(): NearRig | null {
    if (this.disposed) return null
    return {
      distance: (point) => {
        const proxy = this.ensureBodyProxy()
        return proxy && this.dogPlaced ? proxy.distance(point) : null
      },
      setOpacity: (opacity, mode) => this.setDogOpacity(opacity, mode),
    }
  }

  /** 개 몸 캡슐 (모델마다 한 번). 몸통 뼈가 없으면 null */
  private ensureBodyProxy(): BodyProxy | null {
    if (this.bodyProxy === undefined) {
      const { model } = this.scene
      this.bodyProxy = isNode(model) ? buildBodyProxy(model as unknown as ProxyNode) : null
    }
    return this.bodyProxy
  }

  /**
   * 회전 클립마다 쓸고 지나가는 바닥 자리를 turns[].sweep 에 넣는다. 모델을 복제해 (형상·재질은 같이 쓰고 뼈만 새로) 새 믹서로
   * 클립을 41 프레임 재생하고, 몸 캡슐 양 끝을 pivot 기준 (= 회전을 시작할 때의 개 기준, m) 으로 옮겨 바닥에 내린다.
   * 지금 보이는 개의 자세·믹서는 건드리지 않는다
   */
  private addTurnSweeps(turns: TurnClipSpec[], clips: Map<string, ClipLike>) {
    const proxy = this.ensureBodyProxy()
    const model = this.scene.model as Object3D | null
    if (!proxy || !model || typeof model.clone !== 'function') return
    const pivot = this.scene.pivot as unknown as Object3D
    pivot.updateWorldMatrix(true, false)
    model.updateWorldMatrix(true, false)
    const clone = model.clone(true)
    clone.updateMatrixWorld(true)
    const bones = new Map<string, Object3D>()
    clone.traverse((node) => {
      if (!bones.has(node.name)) bones.set(node.name, node)
    })
    // 복제 월드 → 실제 모델 월드 → pivot 기준. pivot 배율을 곱해 m 로
    const toPivot = new Matrix4().copy(pivot.matrixWorld).invert().multiply(model.matrixWorld).multiply(new Matrix4().copy(clone.matrixWorld).invert())
    const pivotScale = new Vector3().setFromMatrixColumn(pivot.matrixWorld, 0).length()
    const radiusScale = proxy.scale
    const capsules = proxy.capsules
      .map((capsule) => ({ a: bones.get(capsule.a.name), b: bones.get(capsule.b.name), radius: capsule.radius }))
      .filter((capsule): capsule is { a: Object3D; b: Object3D; radius: number } => !!capsule.a && !!capsule.b)
    const mixer = new AnimationMixer(clone)
    const point = new Vector3()
    const floor = (node: Object3D) => {
      point.setFromMatrixPosition(node.matrixWorld).applyMatrix4(toPivot)
      return { u: point.x * pivotScale, v: point.z * pivotScale }
    }
    for (const turn of turns) {
      const clip = clips.get(turn.clip)
      if (!clip) continue
      const action = mixer.clipAction(clip as unknown as AnimationClip)
      action.play()
      turn.sweep = computeTurnSweep(
        turn.duration,
        (time) => {
          action.time = time
          mixer.update(0)
          clone.updateMatrixWorld(true)
        },
        () =>
          capsules.map(({ a, b, radius }): SweepCapsule => {
            const pa = floor(a)
            const pb = floor(b)
            return { au: pa.u, av: pa.v, bu: pb.u, bv: pb.v, r: radius * radiusScale }
          }),
      )
      action.stop()
      mixer.uncacheAction(clip as unknown as AnimationClip)
    }
  }

  /**
   * 개와 그림자 불투명도. 1 이면 원래대로, 0 이면 모델과 그림자를 숨긴다. 사이 값은 fade 방식에서만
   * (재질을 transparent 로, depthWrite 는 그대로 둬서 몸 안쪽이 덜 비친다). 다음 렌더부터 보인다
   */
  private setDogOpacity(opacity: number, mode: NearFadeMode) {
    if (this.disposed || !this.dogPlaced) return
    const { model } = this.scene
    if (!isNode(model)) return
    if (!(opacity < 1)) {
      this.restoreNear()
      return
    }
    if (!this.nearSaved) {
      // 놓을 때의 페이드인이 돌고 있으면 끝낸다 (재질 원래 값을 같이 쓰지 않게)
      this.stopFade()
      const floor = this.scene.shadow?.floor
      this.nearSaved = {
        materials: this.materials().map((material) => ({ material, transparent: material.transparent, opacity: material.opacity })),
        floor: floor ? { visible: floor.visible, opacity: floor.material.opacity } : null,
      }
    }
    const saved = this.nearSaved
    const floor = this.scene.shadow?.floor
    if (opacity <= 0 || mode === 'hide') {
      model.visible = false
      if (floor) floor.visible = false
      return
    }
    model.visible = true
    for (const { material, opacity: base } of saved.materials) {
      if (!material.transparent) {
        material.transparent = true
        material.needsUpdate = true
      }
      material.opacity = base * opacity
    }
    if (floor && saved.floor) {
      floor.visible = saved.floor.visible
      floor.material.opacity = saved.floor.opacity * opacity
    }
  }

  private restoreNear() {
    const saved = this.nearSaved
    if (!saved) return
    this.nearSaved = null
    const { model } = this.scene
    if (isNode(model)) model.visible = true
    for (const { material, transparent, opacity } of saved.materials) {
      if (material.transparent !== transparent) {
        material.transparent = transparent
        material.needsUpdate = true
      }
      material.opacity = opacity
    }
    const floor = this.scene.shadow?.floor
    if (floor && saved.floor) {
      floor.visible = saved.floor.visible
      floor.material.opacity = saved.floor.opacity
    }
  }

  /** 투명에서 짧게 페이드인. 재질의 transparent·opacity 는 끝나면 원래대로 돌린다 */
  private revealDog() {
    this.restoreNear()
    this.stopFade()
    const saved =
      REVEAL_FADE_MS > 0
        ? this.materials().map((material) => ({ material, transparent: material.transparent, opacity: material.opacity }))
        : []
    // 보이기 전에 투명으로 바꿔 둬야 한 프레임 번쩍이지 않는다
    for (const { material } of saved) {
      if (!material.transparent) {
        material.transparent = true
        material.needsUpdate = true
      }
      material.opacity = 0
    }
    this.restoreMaterials = () => {
      for (const { material, transparent, opacity } of saved) {
        if (material.transparent !== transparent) {
          material.transparent = transparent
          material.needsUpdate = true
        }
        material.opacity = opacity
      }
    }
    this.scene.target.visible = true
    if (!saved.length) return
    // WebXR 중에는 window 의 requestAnimationFrame 이 돌지 않을 수 있어 타이머로 돌린다. AR 은 매 프레임 다시 그린다
    const start = performance.now()
    this.fadeTimer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / REVEAL_FADE_MS)
      for (const { material, opacity } of saved) material.opacity = opacity * progress
      if (progress < 1) return
      this.stopFade()
    }, FADE_STEP_MS)
  }

  private stopFade() {
    clearInterval(this.fadeTimer)
    this.fadeTimer = undefined
    this.restoreMaterials?.()
    this.restoreMaterials = null
  }
}

/**
 * 산책 리그. 걷는 동안·제자리 회전 동안에는 model-viewer 의 애니메이션을 멈추고(pause: 매 프레임 믹서를 돌리지 않는다)
 * 걷기 클립의 시간·가중치를 직접 넣은 뒤 mixer.update(0) 으로 그 자세를 만든다. 개 위치도 같은 프레임에 옮겨
 * 애니메이션과 이동이 한 프레임도 어긋나지 않는다 (둘 다 다음 렌더에 나온다).
 * - 클립끼리는 크로스페이드 없이 그 프레임에서 바로 바꾼다 (이음매가 같다)
 * - 출발 때만 서기 루프의 지금 자세를 300ms 섞는다 (WalkPose.standingWeight)
 * - 액션을 멈추면(stop) 아무도 안 쓰는 뼈가 기본 자세로 돌아가서, 쓸 액션을 먼저 켜고 남은 것을 끈다
 * - 회전 클립이 끝나면 서기를 켜고 회전 액션을 끈다. 서기에 없는 root translation 은 그 바인딩을 쓰는 액션이 없어져
 *   AnimationMixer 가 처음 값(쉼 위치)으로 되돌린다 (three _deactivateAction → restoreOriginalState)
 */
class ModelViewerWalkRig implements WalkRig {
  readonly info: WalkModelInfo
  private readonly mv: ModelViewerElement
  private readonly scene: ModelSceneLike
  private readonly animated: AnimatedSceneLike
  private readonly ar: ArRendererLike
  private readonly clips: Map<string, ClipLike>
  /** 출발 때 잡아 둔 서기 루프 시간 (섞을 때 그 자세로 멈춰 둔다) */
  private standingTime = 0
  private driving = false
  /** 돌리는 중인 클립 (섞는 중이면 서기가 아닌 쪽). 돌려준 뒤에는 null */
  drivingClip: string | null = null

  constructor(
    mv: ModelViewerElement,
    scene: ModelSceneLike,
    animated: AnimatedSceneLike,
    ar: ArRendererLike,
    info: WalkModelInfo,
    clips: Map<string, ClipLike>,
  ) {
    this.mv = mv
    this.scene = scene
    this.animated = animated
    this.ar = ar
    this.info = info
    this.clips = clips
  }

  takeOver() {
    const standing = this.action(STANDING_CLIP)
    // 서기 루프가 돌고 있으면 그 시간에서 섞는다
    this.standingTime = standing.isScheduled() ? standing.time : 0
    this.mv.pause()
    this.driving = true
    // 다른 액션(앞 명령의 페이드아웃 등)이 남아 섞이지 않게 끈다. 서기를 먼저 켜 둬야 뼈가 기본 자세로 돌아가지 않는다
    this.apply([[STANDING_CLIP, this.standingTime, 1]], true)
  }

  show(pose: WalkPose) {
    if (!this.driving) return
    const weight = Math.min(1, Math.max(0, pose.standingWeight))
    this.apply(
      weight > 0
        ? [
            [STANDING_CLIP, this.standingTime, weight],
            [pose.clip, pose.time, 1 - weight],
          ]
        : [[pose.clip, pose.time, 1]],
    )
  }

  moveDog(position: Vec3, yaw: number) {
    const { scene, ar } = this
    // placeDog 와 같이 목표도 맞춰 감쇠 없이 그 자리·방향에 둔다
    scene.pivot.position.set(position.x, position.y, position.z)
    ar.goalPosition.set(position.x, position.y, position.z)
    ar.goalYaw = setPivotYaw(scene.pivot, yaw)
    scene.queueShadowRender()
  }

  release() {
    if (!this.driving) return
    this.driving = false
    // walk_stop·제자리 회전의 끝 = 서기 루프 첫 프레임. 서기를 0초로 켜고 (남은 액션은 끈다) model-viewer 에 돌려준다
    this.apply([[STANDING_CLIP, 0, 1]])
    this.drivingClip = null
    // 같은 액션이 model-viewer 의 지금 액션이라 섞지 않고 그 자리에서 이어 돈다 (재생 배율도 다시 맞춘다)
    this.mv.play()
  }

  private action(name: string) {
    return this.animated.mixer.clipAction(this.clips.get(name)!, this.scene)
  }

  /** layers 만 켜고 그 시간·가중치로 자세를 만든다. others 면 걷기·서기 밖의 액션도 끈다 */
  private apply(layers: [string, number, number][], others = false) {
    const { mixer, animationsByName } = this.animated
    const used = new Set<ActionLike>()
    for (const [name, time, weight] of layers) {
      const action = this.action(name)
      action.enabled = true
      action.paused = false
      // 남은 페이드(앞 명령의 크로스페이드)도 끝낸다
      action.setEffectiveWeight(weight)
      if (!action.isScheduled()) action.play()
      action.time = time
      used.add(action)
    }
    this.drivingClip = layers[layers.length - 1][0]
    const names = others ? [...animationsByName.keys()] : [STANDING_CLIP, ...WALK_CLIPS, ...this.info.turns.map((turn) => turn.clip)]
    for (const name of names) {
      const clip = animationsByName.get(name)
      const action = clip && mixer.existingAction(clip, this.scene)
      if (action && !used.has(action) && action.isScheduled()) action.stop()
    }
    mixer.update(0)
    this.scene.queueShadowRender()
  }
}

// ── 개발용 PC 시뮬레이션 (?sim=1, ./sim): 화면 안 3D 에서 XR 세션 없이 같은 스테이지 ──

/** 시뮬레이션이 장면에 바라는 것 (그리기 직전 카메라를 가상 사용자 자리로, 바닥 격자를 넣고 빼기) */
export interface SceneStageHandle {
  /** 산책·고개·가까움 리그를 만들고 placeDog 로 개를 놓는 스테이지. start·createProbes 는 부르지 않는다 (프레임은 시뮬레이션이 만든다) */
  stage: ModelViewerArStage
  /** 화면 카메라 (three PerspectiveCamera). 그리기 직전에 바꾼다 */
  camera: PerspectiveCamera
  /** 그리기 직전 (자세 층·바라보기 뒤) 부를 함수. 돌려준 함수로 뺀다 */
  beforeDraw(fn: () => void): () => void
  /** 다음 프레임도 그리게 한다 (화면 안 3D 는 바뀐 프레임만 그린다) */
  queueRender(): void
  add(object: Object3D): void
  remove(object: Object3D): void
  /** 원래대로 (그리기 훅·카메라 목표) */
  dispose(): void
}

const isCamera = (value: unknown): value is PerspectiveCamera =>
  isRecord(value) && (value as { isPerspectiveCamera?: boolean }).isPerspectiveCamera === true

/**
 * 개발용 PC 시뮬레이션 (?sim=1, 화면 안 3D) 이 쓰는 스테이지. ARRenderer 처럼 모델 바닥 가운데를 pivot 에 맞추고 (setTarget),
 * goalPosition·goalYaw 를 받는 가짜 ARRenderer 와 빈 세션으로 ModelViewerArStage 를 만든다 (산책·고개·가까움 리그와 placeDog 는 그대로).
 * 배포 빌드에서는 부르는 곳(./sim)이 없어 빠진다. 내부 모양이 다르면 null
 */
export function attachSceneStage(mv: ModelViewerElement): SceneStageHandle | null {
  const scene = readSymbol(mv, 'scene')
  if (!isModelScene(scene)) return null
  const raw = scene as unknown as Record<string, unknown>
  const camera = raw.camera
  if (!isCamera(camera) || typeof raw.setTarget !== 'function' || typeof scene.renderShadow !== 'function' || typeof scene.queueRender !== 'function') return null
  const target = (scene as unknown as { getTarget(): Vector3 }).getTarget?.()
  const { min, max } = scene.boundingBox
  ;(scene as unknown as { setTarget(x: number, y: number, z: number): void }).setTarget((min.x + max.x) / 2, min.y, (min.z + max.z) / 2)
  scene.jumpToGoal()
  const ar: ArRendererLike = {
    currentSession: null,
    presentedScene: scene,
    goalPosition: new Vector3(),
    goalYaw: 0,
    placementComplete: true,
    placementBox: null,
    initialHitSource: null,
    dispatchEvent: () => {},
  }
  const session = {
    requestReferenceSpace: () => Promise.reject(new Error('시뮬레이션')),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  } as unknown as XrSession
  const stage = new ModelViewerArStage(mv, scene, ar, session, {} as XrSpace)
  const hooks = new Set<() => void>()
  const inner = Object.prototype.hasOwnProperty.call(scene, 'renderShadow') ? scene.renderShadow : null
  const draw = scene.renderShadow.bind(scene)
  scene.renderShadow = (renderer: unknown) => {
    draw(renderer)
    for (const hook of hooks) hook()
  }
  const added = new Set<Object3D>()
  return {
    stage,
    camera,
    beforeDraw: (fn) => {
      hooks.add(fn)
      return () => hooks.delete(fn)
    },
    queueRender: () => scene.queueRender?.(),
    add: (object) => {
      added.add(object)
      scene.add(object)
    },
    remove: (object) => {
      added.delete(object)
      object.removeFromParent()
    },
    dispose: () => {
      hooks.clear()
      for (const object of added) object.removeFromParent()
      added.clear()
      stage.dispose()
      if (inner) scene.renderShadow = inner
      else delete (scene as { renderShadow?: unknown }).renderShadow
      if (target) (scene as unknown as { setTarget(x: number, y: number, z: number): void }).setTarget(target.x, target.y, target.z)
      scene.pivot.position.set(0, 0, 0)
      setPivotYaw(scene.pivot, 0)
      scene.queueRender?.()
    },
  }
}

// ── 자세 층: 렌더 직전에 뼈를 바꾸는 것들 (화면 안 3D·AR 둘 다) ──
// scene.renderShadow 를 인스턴스에서 한 번 감싸 그 앞에 순서대로: 자세 섞기(./poseBlend.ts) → 절차적 갸우뚱(./headTilt.ts) →
// 고개 바라보기·턱(AR, createGazeRig) → 그리기. 갸우뚱은 '그린 자세'(다음 섞기의 출발)에 들어가고, 바라보기는 그 기울기를 남긴다.
// 화면 안 3D 는 장면이 바뀐 프레임에만 그려서 (isDirty), 섞는 동안 애니메이션이 멈춰 있으면 다음 프레임도 그리게 한다.
// 산책·제자리 회전 클립 사이는 산책 리그가 출발 때 서기 자세를 0.3 s 섞고 이음매가 같아 (walk_stop·회전 끝 = 서기 첫 프레임)
// 여기서 다시 섞지 않는다 (그 전에 시작한 섞기는 이어서 줄인다)

/** 시간이 처음으로 돌아가도 처음부터 다시가 아닌 루프 클립 (손 줘는 루프로 들고 있다) */
const LOOPING_CLIPS: ReadonlySet<string> = new Set(['standing', 'sitting', 'lying', 'idle', 'shake', 'walk'])

interface SkinnedLike {
  isSkinnedMesh?: boolean
  skeleton?: { bones: unknown[] }
}

const isBlendBone = (value: unknown): value is BlendBone =>
  isRecord(value) &&
  isRecord(value.quaternion) &&
  typeof value.quaternion.set === 'function' &&
  isVector(value.position) &&
  isRecord(value.scale) &&
  typeof value.scale.x === 'number'

/** 모델의 스킨 뼈 전부 (스킨이 여럿이면 합친다). 모양이 다르면 null */
function skinBonesOf(model: NodeLike): BlendBone[] | null {
  const bones = new Set<unknown>()
  model.traverse((node) => {
    const skinned = node as unknown as SkinnedLike
    if (skinned.isSkinnedMesh && Array.isArray(skinned.skeleton?.bones)) for (const bone of skinned.skeleton.bones) bones.add(bone)
  })
  const list = [...bones]
  return list.length > 0 && list.every(isBlendBone) ? list : null
}

class PoseLayers {
  private readonly mv: ModelViewerElement
  private readonly scene: ModelSceneLike
  /** 자세 섞기를 할지 (화면이 attachPoseLayers 로 켠다) */
  blendOn = false
  /** 산책 리그가 돌리는 클립 (AR 스테이지가 넣는다). 없으면 null */
  drivingClip: () => string | null = () => null
  /** 고개 바라보기·턱 (AR 스테이지가 넣는다). 지금 그리는 클립을 받고, 뼈를 바꿨으면 true */
  gaze: ((clip: string | null) => boolean) | null = null
  private blend: PoseBlend | null = null
  /** blend 를 만든 모델 (모델이 바뀌면 다시 만든다) */
  private model: unknown = undefined
  /** 지난 프레임 클립 · 시간 · 산책 리그가 돌렸는지. 처음이면 undefined */
  private clip: string | null | undefined = undefined
  private time = 0
  private walkDriven = false
  /** 머리 뼈와 바라보는 축 (모델마다 한 번, 없으면 null: 갸우뚱 못 함) */
  private head: { model: unknown; bone: BlendBone; axis: readonly [number, number, number] } | null = null
  /** 절차적 갸우뚱: 시작 시각 (s) · 기울이는 쪽 (+1 / −1, 번갈아) */
  private tilt: { start: number; side: number } | null = null
  private tiltSide = 1

  constructor(mv: ModelViewerElement, scene: ModelSceneLike, original: (renderer: unknown) => void) {
    this.mv = mv
    this.scene = scene
    scene.renderShadow = (renderer: unknown) => {
      this.run()
      original.call(scene, renderer)
    }
  }

  get lastBlend(): BlendInfo | null {
    return this.blend?.last ?? null
  }

  get blending(): boolean {
    return this.blend?.blending ?? false
  }

  /** 절차적 갸우뚱 시작 (섞기를 쓰는 중이고 머리 뼈·바라보는 축이 있을 때). 시작했으면 true */
  tiltHead(): boolean {
    if (!this.blendOn || !this.blend || !this.headParts()) return false
    this.tilt = { start: performance.now() / 1000, side: this.tiltSide }
    this.tiltSide = -this.tiltSide
    this.scene.queueRender?.()
    return true
  }

  /**
   * 다음 그리기에서 섞지 않고 지금 클립 자세로 바로 (첫 만남에 앉은 채 나타나기: 서기 → 앉기 루프를 0.6 s 섞으면 앉는 게 보인다).
   * 하던 섞기·갸우뚱도 그만둔다
   */
  snap() {
    this.blend?.cancel()
    this.clip = undefined
    this.tilt = null
    this.scene.queueRender?.()
  }

  private headParts() {
    const model = this.scene.model
    if (this.head?.model === model) return this.head
    const parts = isNode(model) ? findNeckBones(model as unknown as BoneLike) : null
    const bone = parts?.bones[2]
    this.head = parts && isBlendBone(bone) ? { model, bone, axis: parts.gazeAxis } : null
    return this.head
  }

  /** 섞기 뒤 머리 뼈를 바라보는 축 둘레로 기울인다 (섞기가 매 프레임 클립 값으로 되돌려 둬 쌓이지 않는다). 썼으면 true */
  private applyTilt(now: number): boolean {
    const tilt = this.tilt
    if (!tilt) return false
    const t = now - tilt.start
    if (t >= HEAD_TILT_S) {
      this.tilt = null
      return false
    }
    const head = this.headParts()
    const amount = headTiltAmount(t)
    if (!head || !(amount > 0)) return false
    const q = head.bone.quaternion
    const [x, y, z, w] = rollLocal(q, head.axis, tilt.side * amount * HEAD_TILT_DEG * (Math.PI / 180))
    q.set(x, y, z, w)
    return true
  }

  private run() {
    const { mv, scene } = this
    const walkClip = this.drivingClip()
    const clip = walkClip ?? (mv.animationName || null)
    let wrote = false
    if (this.blendOn) {
      if (scene.model !== this.model) {
        this.model = scene.model
        this.blend = this.createBlend()
        this.clip = undefined
      }
      const blend = this.blend
      if (blend) {
        const walkDriven = walkClip !== null
        const time = walkDriven ? 0 : mv.currentTime
        const switched =
          this.clip !== undefined &&
          !walkDriven &&
          !this.walkDriven &&
          (clip !== this.clip || (clip !== null && !LOOPING_CLIPS.has(clip) && time < this.time - 1e-4))
        try {
          const now = performance.now() / 1000
          wrote = blend.apply(now, switched, switched ? { from: this.clip ?? null, to: clip } : undefined)
          if (this.applyTilt(now)) wrote = true
          blend.markDrawn()
        } catch (error) {
          if (import.meta.env.DEV) console.warn('[ar] 자세 섞기를 끈다:', error)
          this.blend = null
        }
        this.clip = clip
        this.time = time
        this.walkDriven = walkDriven
      }
    }
    if (this.gaze?.(clip)) wrote = true
    this.blend?.commit()
    if (wrote) scene.queueShadowRender()
    // 화면 안 3D: 애니메이션이 멈춰 있어도 섞기·갸우뚱이 끝날 때까지 그린다 (그린 뒤 isDirty 가 풀리므로 그 다음에 건다)
    if ((this.blend?.blending || this.tilt) && mv.paused) queueMicrotask(() => scene.queueRender?.())
  }

  private createBlend(): PoseBlend | null {
    const model = this.scene.model
    if (!isNode(model)) return null
    const bones = skinBonesOf(model)
    if (!bones) return null
    // 스킨 루트의 부모 월드 배율 (glTF 루트 노드 배율 등). 관절 위치 어긋남을 m 로 잰다
    const outer = bones.find((bone) => !bones.includes(bone.parent as BlendBone))?.parent
    const outerScale = () => {
      const elements = isRecord(outer) ? matrixElements(outer.matrixWorld) : null
      return elements ? Math.hypot(elements[0], elements[1], elements[2]) : 1
    }
    return new PoseBlend(bones, { outerScale })
  }
}

const poseLayers = new WeakMap<object, PoseLayers | null>()

/** 장면의 자세 층 (처음 부를 때 renderShadow 를 감싼다). 모양이 다르면 null */
function poseLayersFor(mv: ModelViewerElement, scene: ModelSceneLike): PoseLayers | null {
  if (poseLayers.has(scene)) return poseLayers.get(scene)!
  const original = scene.renderShadow
  const layers = typeof original === 'function' ? new PoseLayers(mv, scene, original) : null
  poseLayers.set(scene, layers)
  return layers
}

/** 화면이 쓰는 자세 층 */
export interface PoseLayersHandle {
  /** 마지막으로 시작한 섞기 (?debug) */
  lastBlend(): BlendInfo | null
  /** 섞는 중인지 */
  blending(): boolean
  /** 절차적 갸우뚱 (앉거나 엎드린 개를 톡). 머리 뼈가 없으면 false */
  tiltHead(): boolean
  /** 다음 그리기에서 섞지 않고 클립 자세로 바로 (DogAnimator.restIn 으로 처음 자세를 바꾼 뒤) */
  snap(): void
}

/**
 * 클립 사이 자세 섞기를 켠다 (화면 안 3D·AR 둘 다, 모델을 불러온 뒤). 내부 모양이 다르면 null:
 * 부르는 쪽은 model-viewer 크로스페이드를 그대로 쓴다
 */
export function attachPoseLayers(mv: ModelViewerElement): PoseLayersHandle | null {
  const scene = readSymbol(mv, 'scene')
  if (!isModelScene(scene)) return null
  const layers = poseLayersFor(mv, scene)
  if (!layers || !isNode(scene.model) || !skinBonesOf(scene.model)) return null
  layers.blendOn = true
  return {
    lastBlend: () => layers.lastBlend,
    blending: () => layers.blending,
    tiltHead: () => layers.tiltHead(),
    snap: () => layers.snap(),
  }
}

interface TrackedClipLike extends ClipLike {
  tracks: TrackLike[]
}
const isTrackedClip = (value: unknown): value is TrackedClipLike =>
  isClip(value) &&
  Array.isArray((value as unknown as Record<string, unknown>).tracks) &&
  ((value as unknown as Record<string, unknown>).tracks as unknown[]).every(
    (track) => isRecord(track) && typeof track.name === 'string' && typeof track.getValueSize === 'function' && isRecord(track.times) && isRecord(track.values),
  )

/**
 * 클립의 빈 끝: 끝부분이 첫 프레임 자세로 돌아와 그대로인 시점 (s) 과 길이. 빈 끝이 없는 클립·없는 클립은 빼고 돌려준다
 * (DogAnimator 가 거기서 끊고 다음으로 간다. 차이는 자세 섞기가 맡는다)
 */
export function clipQuietEnds(mv: ModelViewerElement, names: readonly string[]): Record<string, { end: number; duration: number }> {
  const scene = readSymbol(mv, 'scene')
  const out: Record<string, { end: number; duration: number }> = {}
  if (!isAnimatedScene(scene)) return out
  for (const name of names) {
    const clip = scene.animationsByName.get(name)
    if (!isTrackedClip(clip)) continue
    const end = quietTailStart(clip.tracks, clip.duration)
    // 한두 프레임 남는 것은 그대로 끝까지
    if (end < clip.duration - 0.05) out[name] = { end, duration: clip.duration }
  }
  return out
}

// ── 반응 말풍선: 개 머리 위의 화면 위치 (화면 안 3D·AR 둘 다) ──
// ModelScene.getCamera() 는 AR 중에는 XR 카메라(three 가 매 프레임 맞춘 것), 밖에서는 model-viewer 카메라다

/** 말풍선 자리: 머리 뼈에서 모델 높이의 이만큼 위 */
const BUBBLE_LIFT_RATIO = 0.18
const HEAD_BONE = 'head_jnt'

interface ObjectLike {
  getObjectByName(name: string): unknown
}
const headOf = new WeakMap<object, { getWorldPosition(target: Vector3): Vector3 } | null>()
const headVector = new Vector3()
const viewMatrix = new Matrix4()
const projectionMatrix = new Matrix4()
const targetMatrix = new Matrix4()
/** three 행렬 (model-viewer 쪽 three 와 같은 판인지 instanceof 로 보지 않고 elements 만 읽는다) */
const matrixElements = (value: unknown) => {
  const elements: unknown = isRecord(value) ? value.elements : null
  return isRecord(elements) && elements.length === 16 ? Array.from(elements as unknown as ArrayLike<number>) : null
}

/**
 * 개 머리 위 자리의 화면 위치. x·y 는 0~1 (model-viewer 화면 기준, 왼쪽 위 원점)이고 화면 밖이면 그 밖의 값.
 * 카메라 뒤이거나 내부 모양이 다르면 null. 머리 뼈가 없는 모델은 모델 상자 윗면 가운데에서 잰다
 */
export function headScreenPoint(mv: ModelViewerElement): { x: number; y: number } | null {
  const scene = readSymbol(mv, 'scene')
  if (!isModelScene(scene) || !isRecord(scene) || typeof scene.getCamera !== 'function') return null
  const camera = (scene.getCamera as () => unknown).call(scene)
  const cameraWorld = isRecord(camera) ? matrixElements(camera.matrixWorld) : null
  const projection = isRecord(camera) ? matrixElements(camera.projectionMatrix) : null
  if (!cameraWorld || !projection) return null
  const model = scene.model
  if (!isRecord(model) || typeof model.getObjectByName !== 'function') return null
  if (!headOf.has(model)) {
    const head = (model as unknown as ObjectLike).getObjectByName(HEAD_BONE)
    headOf.set(model, isRecord(head) && typeof head.getWorldPosition === 'function' ? (head as never) : null)
  }
  const { min, max } = scene.boundingBox
  const height = max.y - min.y
  const head = headOf.get(model)
  if (head) head.getWorldPosition(headVector)
  else {
    headVector.x = (min.x + max.x) / 2
    headVector.y = max.y
    headVector.z = (min.z + max.z) / 2
    headVector.applyMatrix4(targetMatrix.fromArray(Array.from(scene.target.matrixWorld.elements)))
  }
  headVector.y += height * BUBBLE_LIFT_RATIO
  headVector.applyMatrix4(viewMatrix.fromArray(cameraWorld).invert())
  // 카메라는 -z 를 본다
  if (headVector.z >= 0) return null
  headVector.applyMatrix4(projectionMatrix.fromArray(projection))
  return { x: (headVector.x + 1) / 2, y: (1 - headVector.y) / 2 }
}
