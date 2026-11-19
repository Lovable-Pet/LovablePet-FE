import type { ModelViewerElement } from '@google/model-viewer'
import { GridHelper, PerspectiveCamera, Vector3 } from 'three'
import { attachSceneStage, type SceneStageHandle } from '../modelViewerArStage'
import type { StageFrame } from '../placement/arStage'
import type { Vec3 } from '../placement/types'
import type { GazeHost } from '../gaze/gazeStage'
import type { NearHost } from '../nearCamera'
import type { FloorLevel, WalkHost, WalkPathMarks } from '../walk/walkStage'
import { fromDogFrame, userFeet, USER_FEET_RADIUS_M } from '../walk/turnSweep'
import { NO_KEYS, SIM_LOWER_FLOOR_M, startUser, stepUser, userCamera, userLook, type SimKeys, type SimUser } from './simUser'

// 개발용 PC 시뮬레이션(?sim=1)의 한 세션: 화면 안 3D 에서 개를 바닥 원점에 놓고, 가상 사용자의 폰 자리·방향을 AR 의 XR 프레임 대신
// 산책·고개 바라보기·가까움 host 에 넘긴다 (판단 코드는 그대로, 입력만 바뀐다. 노드 시뮬레이션 시험 sim.ts 의 가짜 스테이지와 같은 방식).
// - 바닥은 높이 0 하나 (FloorLevel 는 늘 0). 'L' 은 사용자만 SIM_LOWER_FLOOR_M (0.18 m) 아래 층에 세운다 (폰 높이가 그만큼 낮아진다)
// - 화면 카메라는 그리기 직전에 바꾼다: 1인칭(가상 사용자 눈) 또는 위에서 비스듬히 내려다보는 3인칭
// - 겹쳐 그리는 2D 캔버스: 산책 발자취·겨누는 점·몸 돌리기 쓸고 지나가는 자리 (walkHost.showPath 로 오는 점), 3인칭이면 사용자·발 원·거리

export type SimView = 'first' | 'third'

export interface SimHosts {
  walkHost: WalkHost | null
  gazeHost: GazeHost | null
  nearHost: NearHost | null
}

/** 1인칭 화면 세로 시야각 (°, 휴대폰 세로 카메라쯤) · 3인칭 */
const FIRST_FOV = 62
const THIRD_FOV = 50
const NEAR_CLIP_M = 0.02
const FAR_CLIP_M = 60
/** 한 프레임 최대 (s): 탭이 숨겨졌다 돌아왔을 때 크게 뛰지 않게 */
const MAX_DT_S = 0.1
const GRID_SIZE_M = 20
const GRID_DIVISIONS = 40

export class SimSession {
  readonly handle: SceneStageHandle
  hosts: SimHosts = { walkHost: null, gazeHost: null, nearHost: null }
  user: SimUser
  view: SimView = 'first'
  keys: SimKeys = NO_KEYS
  /** 개 자리·방향 (산책이 옮기면 dogMoved 로 바뀐다) */
  dog = { position: { x: 0, y: 0, z: 0 } as Vec3, yaw: 0 }
  /** 마지막으로 받은 바닥 점 (산책 발자취·쓸고 지나가는 자리) */
  marks: WalkPathMarks | null = null
  /** 마지막 프레임 (테스트·화면 표시) */
  lastFrame: StageFrame | null = null
  private canvas: HTMLCanvasElement | null = null
  private readonly mv: ModelViewerElement
  private readonly walkListeners = new Set<(frame: StageFrame, floor: FloorLevel) => void>()
  private readonly frameListeners = new Set<(frame: StageFrame) => void>()
  private readonly phone = new PerspectiveCamera(FIRST_FOV, 1, NEAR_CLIP_M, FAR_CLIP_M)
  private readonly grid = new GridHelper(GRID_SIZE_M, GRID_DIVISIONS, 0x8a8a8a, 0x4a4a4a)
  private readonly unhookDraw: () => void
  private raf = 0
  private lastTime: number | null = null
  private disposed = false

  private constructor(mv: ModelViewerElement, handle: SceneStageHandle, eye: number) {
    this.mv = mv
    this.handle = handle
    this.user = startUser(eye)
    this.grid.position.set(0, -0.002, 0)
    handle.add(this.grid)
    this.unhookDraw = handle.beforeDraw(() => this.beforeDraw())
  }

  /** 개를 원점에 놓고 리그를 만든다. 내부 모양이 다르면 null. onHosts: 산책 리그처럼 늦게 오는 것까지 생길 때마다 */
  static start(
    mv: ModelViewerElement,
    { eye, gazeEnabled, onHosts }: { eye: number; gazeEnabled: boolean; onHosts: (hosts: SimHosts) => void },
  ): SimSession | null {
    const handle = attachSceneStage(mv)
    if (!handle) return null
    const session = new SimSession(mv, handle, eye)
    const { stage } = handle
    stage.placeDog(session.dog.position, session.dog.yaw)
    const nearRig = stage.createNearRig()
    const gazeRig = gazeEnabled ? stage.createGazeRig() : null
    const frameHost = { subscribe: (listener: (frame: StageFrame) => void) => session.subscribeFrames(listener) }
    session.hosts = {
      walkHost: null,
      gazeHost: gazeRig ? { rig: gazeRig, ...frameHost } : null,
      nearHost: nearRig ? { rig: nearRig, ...frameHost } : null,
    }
    onHosts(session.hosts)
    void stage.createWalkRig().then((rig) => {
      if (!rig || session.disposed) return
      session.hosts = {
        ...session.hosts,
        walkHost: {
          rig,
          dogPose: () => ({ position: { ...session.dog.position }, yaw: session.dog.yaw }),
          subscribe: (listener) => {
            session.walkListeners.add(listener)
            return () => session.walkListeners.delete(listener)
          },
          dogMoved: (position, yaw) => {
            session.dog = { position: { ...position }, yaw }
          },
          showPath: (marks) => {
            session.marks = marks
          },
        },
      }
      onHosts(session.hosts)
    })
    session.raf = requestAnimationFrame((time) => session.tick(time))
    return session
  }

  setCanvas(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas
  }

  /** 드래그·스크립트로 바꾼 사용자 (다음 프레임부터) */
  setUser(user: SimUser) {
    this.user = user
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.walkListeners.clear()
    this.frameListeners.clear()
    this.unhookDraw()
    this.grid.dispose()
    this.handle.dispose()
    const context = this.canvas?.getContext('2d')
    if (context && this.canvas) context.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private subscribeFrames(listener: (frame: StageFrame) => void) {
    this.frameListeners.add(listener)
    return () => {
      this.frameListeners.delete(listener)
    }
  }

  /** 매 화면 프레임: 사용자를 옮기고 XR 프레임처럼 host 들에 넘긴 뒤 다음 프레임도 그리게 한다 */
  private tick(time: number) {
    if (this.disposed) return
    this.raf = requestAnimationFrame((next) => this.tick(next))
    const dt = this.lastTime === null ? 0 : Math.min(MAX_DT_S, (time - this.lastTime) / 1000)
    this.lastTime = time
    this.user = stepUser(this.user, this.keys, dt)
    const camera = userCamera(this.user)
    this.aimPhone(this.phone, camera)
    const frame: StageFrame = {
      time,
      camera,
      tracking: true,
      view: { viewMatrix: this.phone.matrixWorldInverse.elements, projectionMatrix: this.phone.projectionMatrix.elements },
      centerHit: null,
      centerPointHit: null,
      depth: null,
      sensors: { depth: 'off', depthFormat: null, points: 'off' },
    }
    this.lastFrame = frame
    // AR 의 놓은 뒤 프레임처럼: 바닥 층은 개 바닥 하나 (0)
    const floor: FloorLevel = { y: 0, provisional: false }
    for (const listener of [...this.walkListeners]) listener(frame, floor)
    for (const listener of [...this.frameListeners]) listener(frame)
    this.handle.queueRender()
  }

  /** 휴대폰 카메라 = 가상 사용자 눈 (화면 비율은 지금 화면 카메라와 같게) */
  private aimPhone(camera: PerspectiveCamera, at: Vec3) {
    camera.aspect = this.handle.camera.aspect
    camera.fov = FIRST_FOV
    camera.near = NEAR_CLIP_M
    camera.far = FAR_CLIP_M
    camera.updateProjectionMatrix()
    const look = userLook(this.user)
    camera.position.set(at.x, at.y, at.z)
    camera.up.set(0, 1, 0)
    camera.lookAt(at.x + look.x, at.y + look.y, at.z + look.z)
    camera.updateMatrixWorld(true)
  }

  /** 그리기 직전: 화면 카메라를 1인칭·3인칭 자리로, 겹친 캔버스를 그 카메라로 그린다 */
  private beforeDraw() {
    const camera = this.handle.camera
    if (this.view === 'first') {
      this.aimPhone(camera, userCamera(this.user))
    } else {
      const { position } = this.dog
      const cx = (this.user.x + position.x) / 2
      const cz = (this.user.z + position.z) / 2
      const span = Math.hypot(this.user.x - position.x, this.user.z - position.z)
      const height = Math.min(15, Math.max(3, 1.3 * span + 2.5))
      camera.fov = THIRD_FOV
      camera.near = NEAR_CLIP_M
      camera.far = FAR_CLIP_M
      camera.updateProjectionMatrix()
      camera.position.set(cx, height, cz + height * 0.45)
      camera.up.set(0, 1, 0)
      camera.lookAt(cx, 0, cz)
      camera.updateMatrixWorld(true)
    }
    this.drawOverlay(camera)
  }

  private drawOverlay(camera: PerspectiveCamera) {
    const canvas = this.canvas
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const rect = this.mv.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.round(rect.width * dpr)
    const height = Math.round(rect.height * dpr)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    context.clearRect(0, 0, width, height)
    const point = new Vector3()
    const project = (x: number, y: number, z: number) => {
      point.set(x, y, z).project(camera)
      return point.z < 1 && point.z > -1 ? { x: ((point.x + 1) / 2) * width, y: ((1 - point.y) / 2) * height } : null
    }
    const dot = (x: number, y: number, z: number, radius: number, color: string) => {
      const p = project(x, y, z)
      if (!p) return
      context.fillStyle = color
      context.beginPath()
      context.arc(p.x, p.y, radius * dpr, 0, Math.PI * 2)
      context.fill()
    }
    const ring = (cx: number, y: number, cz: number, radius: number, color: string) => {
      context.strokeStyle = color
      context.lineWidth = 2 * dpr
      context.beginPath()
      let started = false
      for (let i = 0; i <= 32; i++) {
        const angle = (i / 32) * Math.PI * 2
        const p = project(cx + Math.cos(angle) * radius, y, cz + Math.sin(angle) * radius)
        if (!p) continue
        if (started) context.lineTo(p.x, p.y)
        else context.moveTo(p.x, p.y)
        started = true
      }
      context.stroke()
    }
    // 산책 발자취(흰 점)·겨누는 점 / 몸 돌리기 쓸고 지나가는 자리 윤곽(흰 점)·사용자 발(분홍)
    const marks = this.marks
    if (marks) {
      for (const p of marks.points) dot(p.x, marks.y, p.z, 2.5, 'rgba(255,255,255,0.9)')
      if (marks.aim) dot(marks.aim.x, marks.y, marks.aim.z, 5, 'rgb(217,70,239)')
    }
    if (this.view !== 'third') return
    const user = this.user
    const floorY = user.lower ? -SIM_LOWER_FLOOR_M : 0
    const camera3 = userCamera(user)
    // 사용자 발 원 (몸 돌리기가 피하는 자리, turnSweep.userFeet) · 폰 자리 · 바라보는 방향
    const feet = fromDogFrame(userFeet(camera3, this.dog.position, this.dog.yaw), this.dog.position, this.dog.yaw)
    ring(feet.x, floorY, feet.z, USER_FEET_RADIUS_M, 'rgba(250,204,21,0.95)')
    dot(user.x, floorY, user.z, 6, 'rgb(250,204,21)')
    const tip = project(user.x + Math.sin(user.heading) * 0.6, floorY, user.z + Math.cos(user.heading) * 0.6)
    const base = project(user.x, floorY, user.z)
    if (tip && base) {
      context.strokeStyle = 'rgb(250,204,21)'
      context.lineWidth = 3 * dpr
      context.beginPath()
      context.moveTo(base.x, base.y)
      context.lineTo(tip.x, tip.y)
      context.stroke()
    }
    // 개 발밑 ~ 사용자 거리
    const dogAt = project(this.dog.position.x, 0, this.dog.position.z)
    if (dogAt && base) {
      context.setLineDash([6 * dpr, 6 * dpr])
      context.strokeStyle = 'rgba(255,255,255,0.6)'
      context.lineWidth = 1.5 * dpr
      context.beginPath()
      context.moveTo(dogAt.x, dogAt.y)
      context.lineTo(base.x, base.y)
      context.stroke()
      context.setLineDash([])
      const distance = Math.hypot(user.x - this.dog.position.x, user.z - this.dog.position.z)
      context.fillStyle = 'white'
      context.font = `${12 * dpr}px monospace`
      context.fillText(`${distance.toFixed(2)} m`, (dogAt.x + base.x) / 2 + 6 * dpr, (dogAt.y + base.y) / 2)
    }
  }
}
