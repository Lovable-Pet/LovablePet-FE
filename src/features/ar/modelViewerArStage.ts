import type { ModelViewerElement } from '@google/model-viewer'
import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, type BufferGeometry } from 'three'
import type { ArStage, RingPose, RingTone, StageFrame } from './placement/arStage'
import type { SurfaceHit, Vec3 } from './placement/types'

// model-viewer 내부를 쓰는 곳은 이 파일 하나다 (배치 로직의 ArStage 를 채우는 어댑터).
// @google/model-viewer 4.1.0 · three 0.172.0 소스 기준 (package.json 에 고정).
// 공개 API 로는 AR 에서 개를 숨기거나, 탭한 자리에 바로 놓거나, 우리 hit-test 를 돌릴 수 없다.
//
// 쓰는 내부
// - 요소의 Symbol('scene') → ModelScene (three 의 Scene, 장면 루트)
//   - pivot: 개 위치·방향. target: 개·바닥 표시 상자(PlacementBox)·그림자의 부모 (target 만 숨기면 셋이 함께 숨는다)
// - 요소 프로토타입의 Symbol('renderer') getter → Renderer (싱글턴)
//   - arRenderer(ARRenderer): currentSession, goalPosition·goalYaw, placementComplete, placementBox, initialHitSource
//   - threeRenderer.xr.getReferenceSpace(): model-viewer 가 쓰는 'local' 기준 공간
// ARRenderer 는 매 프레임 pivot 위치를 goalPosition 쪽으로, 방향을 goalYaw 쪽으로 감쇠시킨다. 그래서 둘을 같이 맞춘다.
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

// ── WebXR (TypeScript DOM 타입에 없다). 여기서 쓰는 것만 ──
type XrSpace = object
interface XrPose {
  transform: { position: DOMPointReadOnly; matrix: Float32Array }
}
interface XrHitTestResult {
  getPose(space: XrSpace): XrPose | null | undefined
}
interface XrHitTestSource {
  cancel(): void
}
interface XrFrame {
  getViewerPose(space: XrSpace): XrPose | null | undefined
  getHitTestResults(source: XrHitTestSource): readonly XrHitTestResult[]
}
interface XrSession {
  requestReferenceSpace(type: 'viewer'): Promise<XrSpace>
  requestHitTestSource?(options: { space: XrSpace; offsetRay?: unknown }): Promise<XrHitTestSource>
  requestAnimationFrame(callback: (time: number, frame: XrFrame) => void): number
  cancelAnimationFrame(handle: number): void
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
  pivot: { position: Vector3Like }
  target: NodeLike & { matrixWorld: { elements: ArrayLike<number> } }
  /** 모델 좌표(target 기준) */
  boundingBox: { min: Vector3Like; max: Vector3Like }
  model: unknown
  yaw: number
  add(object: object): unknown
  /** target 을 감쇠 없이 목표(모델 바닥이 pivot 에 오는 자리)로 옮긴다 */
  jumpToGoal(): void
  setShadowIntensity(intensity: number): void
  setShadowOffset(offset: number): void
  queueShadowRender(): void
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
    isNode(target) &&
    isRecord((target as unknown as Record<string, unknown>).matrixWorld) &&
    isRecord(boundingBox) &&
    isVector(boundingBox.min) &&
    isVector(boundingBox.max) &&
    typeof value.yaw === 'number' &&
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
}

export class ModelViewerArStage implements ArStage {
  readonly dogSize: Vec3
  private readonly scene: ModelSceneLike
  private readonly ar: ArRendererLike
  private readonly session: XrSession
  private readonly space: XrSpace
  private frameHandle: number | null = null
  private centerSource: XrHitTestSource | null = null
  private ring: RingObject | null = null
  private dogPlaced = false
  private fadeTimer: ReturnType<typeof setInterval> | undefined
  private restoreMaterials: (() => void) | null = null
  private disposed = false

  private constructor(
    mv: ModelViewerElement,
    scene: ModelSceneLike,
    ar: ArRendererLike,
    session: XrSession,
    space: XrSpace,
  ) {
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
    session
      .requestReferenceSpace('viewer')
      .then((viewer) => requestHitTestSource({ space: viewer }))
      .then((source) => {
        if (this.disposed) cancelQuietly(source)
        else this.centerSource = source
      })
      .catch((error: unknown) => {
        if (!this.disposed) onUnavailable(error instanceof Error ? error.message : String(error))
      })

    // three.js 의 XR 루프(model-viewer 가 그린다)보다 나중에 등록돼 같은 프레임에서 그 뒤에 돈다.
    // 여기서 옮긴 원은 다음 프레임에 그려진다 (원은 바닥에 붙어 있어 한 프레임 늦어도 티가 안 난다)
    const loop = (time: number, frame: XrFrame) => {
      if (this.disposed) return
      this.frameHandle = session.requestAnimationFrame(loop)
      // 놓은 뒤에 model-viewer 의 첫 바닥 hit-test 가 늦게 생겼으면 끝낸다 (맞으면 개 높이를 바꿔 버린다)
      if (this.dogPlaced && this.ar.initialHitSource) this.stopInitialHitTest()
      const pose = frame.getViewerPose(space)
      if (!pose) return
      const { x, y, z } = pose.transform.position
      onFrame({
        time,
        camera: { x, y, z },
        centerHit: this.centerSource ? firstHit(frame, this.centerSource, space) : null,
      })
    }
    this.frameHandle = session.requestAnimationFrame(loop)
  }

  setRing(pose: RingPose | null) {
    if (this.disposed) return
    if (!pose) {
      if (this.ring) this.ring.group.visible = false
      return
    }
    const ring = this.ensureRing(pose.radius)
    ring.group.position.set(pose.center.x, pose.center.y - RING_SINK_M, pose.center.z)
    if (ring.tone !== pose.tone) {
      ring.tone = pose.tone
      for (const material of ring.materials) material.color.set(RING_COLORS[pose.tone])
    }
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
    scene.yaw = yaw
    ar.goalYaw = yaw
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
    this.revealDog()
  }

  hideDog() {
    if (this.disposed) return
    this.stopFade()
    this.dogPlaced = false
    this.scene.target.visible = false
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
    this.removeRing()
    this.stopFade()
    this.scene.target.visible = true
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
    this.ring = { group, materials, geometries: parts.map(([geometry]) => geometry), radius, tone: 'ok' }
    return this.ring
  }

  private removeRing() {
    const ring = this.ring
    if (!ring) return
    ring.group.removeFromParent()
    for (const geometry of ring.geometries) geometry.dispose()
    for (const material of ring.materials) material.dispose()
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

  /** 투명에서 짧게 페이드인. 재질의 transparent·opacity 는 끝나면 원래대로 돌린다 */
  private revealDog() {
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
