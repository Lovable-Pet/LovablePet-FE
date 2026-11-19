import '@google/model-viewer'
import type { ModelViewerElement } from '@google/model-viewer'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { AlertCircle, Box, Camera, ChevronLeft, ChevronRight, Footprints, RotateCcw, Ruler, Smartphone, X } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../apis/apiError'
import type { PetDetail, PetModelView } from '../apis/dto/pet.dto'
import { resolveModelUrl } from '../apis/pet'
import { Button } from '../components/Button/Button'
import { buttonStyles } from '../components/Button/buttonStyles'
import { StateView } from '../components/StateView/StateView'
import { cn } from '../components/utils/cn'
import { PUPPY_NOTICE, SEX_LABEL } from '../constants/pet'
import { ArFloorHint } from '../features/ar/components/ArFloorHint'
import { ArHitDebug } from '../features/ar/components/ArHitDebug'
import { ArTouchLayer } from '../features/ar/components/ArTouchLayer'
import { HoldRing } from '../features/ar/components/HoldRing'
import { VoiceCommandButton } from '../features/ar/components/VoiceCommandButton'
import { COMMANDS, DogAnimator, POSE_LABEL, type CommandId, type Pose } from '../features/ar/dogAnimator'
import { useArPlacement, type ArOcclusionOptions, type ArPlacement } from '../features/ar/useArPlacement'
import { useArWalk, type ArWalk } from '../features/ar/useArWalk'
import { useArGaze } from '../features/ar/useArGaze'
import { useArNear } from '../features/ar/useArNear'
import { NEAR_HINT_TEXT, type NearTuning } from '../features/ar/nearCamera'
import { GAZE_IN_PRODUCTION, type GazeTuning } from '../features/ar/gaze/gazeSpec'
import type { WalkTuning } from '../features/ar/walk/walkController'
import { LONG_PRESS_MS, useLongPress, type LongPressHandlers } from '../features/ar/useLongPress'
import { PetPhoto } from '../features/pet/components/PetPhoto'
import { usePetDetail } from '../features/pet/queries'
import { useGoBack } from '../hooks/useGoBack'
import { formatWeight, isLikelyPuppy, toWithersCm } from '../utils/pet'
import { LoadingScreen } from '../components/LoadingScreen/LoadingScreen'

// /pets/:petId/ar — 캔버스 06 AR 시작 안내 → 07·08 실제 크기로 놓기
//
// model-viewer 가 기기에 맞는 AR을 고른다 (ar-modes 순서대로)
// - 안드로이드 Chrome: WebXR. 이 페이지 안에서 카메라가 열려 아래 오버레이(명령 버튼)가 그대로 보인다.
//   바닥 원을 보고 탭한 자리에 사용자를 바라보게 놓는다 (useArPlacement). 놓기 전에는 명령·음성·개 탭을 막는다.
//   놓은 뒤 서 있을 때 '산책'을 누르면 개가 사용자를 따라 걷는다 (useArWalk, 걷기 클립이 있는 모델만). 그동안 명령·음성·개 탭은 숨기거나 막는다.
//   놓은 뒤에는 고개를 돌려 가끔 사용자(휴대폰)를 바라본다 (useArGaze, 지금은 개발 모드만. 제자리 회전 클립이 있으면 오래 옆·뒤에 있는 사용자 쪽으로 돌아선다)
// - WebXR 이 안 되는 안드로이드: Scene Viewer 앱으로 넘어간다 (명령·탭 반응 없음)
// - 아이폰: Quick Look 으로 USDZ 를 연다. USDZ 에는 대기 루프 하나만 있어 명령·탭 반응이 안 된다
// - AR 이 안 되는 기기(데스크톱 등): 화면 안 3D 로 보여 준다. 명령·탭 반응은 된다
//
// 크기: GLB 가 이미 미터 단위 실제 크기라 ar-scale="fixed" 로 손가락 확대·축소를 막는다

type ArStatus = 'not-presenting' | 'session-started' | 'object-placed' | 'failed'

/** 휴대폰·태블릿인지 (데스크톱에만 '휴대폰으로 열어 주세요' 를 보인다) */
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

/** 탭과 드래그(카메라 돌리기)를 가르는 거리 */
const TAP_SLOP_PX = 8

/** 배치 전 빨강(놓을 수 없음)이 이만큼(ms) 넘게 이어지면 다시 열어 보라는 줄을 더한다 */
const STUCK_HINT_MS = 10_000

/** active 가 STUCK_HINT_MS 넘게 이어졌는지 (중간에 풀리면 처음부터) */
function useLongActive(active: boolean) {
  const [long, setLong] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setLong(true), STUCK_HINT_MS)
    return () => {
      clearTimeout(timer)
      setLong(false)
    }
  }, [active])
  return active && long
}

/** 산책 중 위 안내 문구 */
function walkHint({ phase, ending, notice }: ArWalk) {
  if (ending) return '멈추는 중이에요'
  // 사용자가 턱·계단으로 다른 층에 섬: 개는 경계 앞에서 멈춘다. 같은 층으로 돌아오면 다시 따라온다
  if (notice === 'otherLevel') return '여기는 따라갈 수 없어요'
  if (notice === 'slowDown') return '천천히 걸어 주세요'
  return phase === 'standing' ? '걸어가면 따라와요' : '따라오고 있어요'
}

/** AR 에서 개를 놓기 전 위 안내 문구 */
function placementHint({ phase, manual, blockedBy, notice }: ArPlacement) {
  // model-viewer 기본 흐름(직접 놓기를 못 할 때)은 바닥을 찾으면 스스로 놓인다
  if (!manual) return '바닥을 천천히 비춰 주세요. 바닥을 찾으면 유기견이 놓여요'
  // 준비 단계에서 움직이기는 했는데 바닥이 계속 안 보일 때 (벽·옷만 비춤)
  if (notice === 'tiltDown') return '바닥이 보이게 휴대폰을 아래로 기울여 주세요'
  // 준비 단계: 추적·바닥·깊이가 맞춰질 때까지 원을 보이지 않는다
  if (phase === 'preparing') return '휴대폰으로 바닥을 비추면서 천천히 좌우로 움직여 주세요'
  // 원 단계에서 깊이가 계속 안 맞으면 자리를 옮기도록
  if (notice === 'moveSteps') return '휴대폰을 들고 한두 걸음 옆으로 움직여 주세요'
  if (phase === 'placeable') return '원을 원하는 곳에 맞추고 화면을 탭하세요'
  // 면으로 인식되지 않은 책상·문 너머 바닥을 겨눈 때
  if (phase === 'blocked' && blockedBy === 'occluded') return '앞에 물건이 있어요. 빈 바닥을 비춰 주세요'
  if (phase === 'blocked') return '여기에는 놓을 수 없어요'
  // 기울이기만 하면 ARCore 가 바닥을 잘 못 찾는다. 위치를 옮기도록 안내한다
  return '휴대폰을 들고 천천히 옆으로 움직이며 바닥을 비춰 주세요'
}

export function ArPage() {
  const { petId } = useParams()
  const id = Number(petId)
  const { data: pet, isPending, isError, error, refetch } = usePetDetail(id)
  // 나갈 때는 뒤로 (상세에서 왔으면 상세로). 주소로 바로 들어왔으면 상세로 바꿔치기
  const goBack = useGoBack(Number.isInteger(id) && id > 0 ? `/pets/${id}` : '/')

  if (!Number.isInteger(id) || id <= 0 || (isError && error instanceof ApiError && error.status === 404)) {
    return (
      <MessageShell onBack={goBack}>
        <StateView
          title="공고를 찾을 수 없어요"
          description="공고가 내려갔거나 주소가 잘못됐어요."
          action={
            <Link to="/" replace className={buttonStyles({ variant: 'dark', size: 'md' })}>
              둘러보기로 가기
            </Link>
          }
        />
      </MessageShell>
    )
  }
  if (isError) {
    return (
      <MessageShell onBack={goBack}>
        <StateView
          tone="error"
          title="공고를 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요."
          action={
            <Button variant="outline" size="md" onClick={() => refetch()}>
              다시 시도
            </Button>
          }
        />
      </MessageShell>
    )
  }
  if (isPending) return <LoadingScreen description="우리 집에 놓을 준비를 하고 있어요" />
  if (!pet.model) {
    return (
      <MessageShell onBack={goBack}>
        <StateView
          title="아직 3D 모델이 없어요"
          description="모델이 준비되면 우리 집에 놓아 볼 수 있어요."
          action={
            <Button variant="dark" size="md" onClick={goBack}>
              상세로 돌아가기
            </Button>
          }
        />
      </MessageShell>
    )
  }
  return <ArView pet={pet} model={pet.model} onBack={goBack} />
}

function ArView({ pet, model, onBack }: { pet: PetDetail; model: PetModelView; onBack: () => void }) {
  const mvRef = useRef<ModelViewerElement>(null)
  const topOverlayRef = useRef<HTMLDivElement>(null)
  const bottomOverlayRef = useRef<HTMLDivElement>(null)
  // load 때 읽는다. effect 의존성에 넣으면 값이 바뀔 때 animator 만 지워지고 load 는 다시 안 와서 버튼이 죽는다
  const behaviorRef = useRef(model.behavior)
  useEffect(() => {
    behaviorRef.current = model.behavior
  }, [model.behavior])
  const animatorRef = useRef<DogAnimator | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const [searchParams] = useSearchParams()

  const [showGuide, setShowGuide] = useState(true)
  const [progress, setProgress] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [canAr, setCanAr] = useState(false)
  const [arStatus, setArStatus] = useState<ArStatus>('not-presenting')
  const [arFailed, setArFailed] = useState(false)
  const [hasCommands, setHasCommands] = useState(false)
  const [tapIsHeadTilt, setTapIsHeadTilt] = useState(false)
  const [pose, setPose] = useState<Pose>('stand')
  /** 명령·반응을 재생하거나 기다리는 중 (산책은 서기 루프만 돌 때 켤 수 있다) */
  const [animBusy, setAnimBusy] = useState(false)
  const [activeCommand, setActiveCommand] = useState<CommandId | null>(null)

  const withersCm = toWithersCm(model.withersM)
  const inAr = arStatus === 'session-started' || arStatus === 'object-placed'
  /** 개발 모드에서 주소에 ?debug 를 붙였을 때 (배포 파일에는 들어가지 않는다) */
  const debug = import.meta.env.DEV && searchParams.has('debug')
  /**
   * 개발 모드에서 실제 물체가 개를 가리는 시험: ?occlusion=1 (바닥 제외·bilinear·섞기) · ?occlusion=raw (d6b8a0e 방식, 견주기용) ·
   * ?ofloor=0.04 (바닥 제외 문턱 m, 0 이면 끔). 다음 AR 세션부터, 배포 파일에는 들어가지 않는다
   */
  const occlusion = useMemo(() => (import.meta.env.DEV ? readOcclusion(searchParams) : null), [searchParams])
  /**
   * 고개 바라보기: 개발 모드에서 기본 켬 (?gaze=0 끔), ?gazemax=70·?gazeup=45 한계, ?gazeon=4.5·?gazeoff=3 바라보기·딴청 평균 초,
   * ?bodyturn=1.5 몸 돌리기 기다리는 기준 초 (뒤쪽은 그 0.4 배, 0 끔), ?gazejaw·?gazejawup 턱, ?closesit=1 가까이 앉기. 배포 빌드는 GAZE_IN_PRODUCTION (지금 끔)이고 옵션은 들어가지 않는다
   */
  const gazeOptions = useMemo(
    () => (import.meta.env.DEV ? readGazeOptions(searchParams) : { enabled: GAZE_IN_PRODUCTION, tuning: undefined }),
    [searchParams],
  )
  const placement = useArPlacement(mvRef, { debug, occlusion, gazeEnabled: gazeOptions.enabled })
  /** AR 에서 개가 바닥에 놓였는지 */
  const dogReady = inAr && placement.phase === 'placed'
  /** AR 에서 개를 놓기 전: 명령 칩·음성·개 탭·3초 누르기를 막는다 */
  const arLocked = inAr && !dogReady
  const canReplace = dogReady && placement.manual
  /** ?debug: 바닥 추정을 처음부터 다시 (잘못 잡힌 바닥 확인용) */
  const showFloorReset = debug && inAr && placement.manual
  /** 배치 전 빨강이 10초 넘게 이어짐 → '닫았다가 다시 열어 주세요' 한 줄 더 (바닥·깊이 상태는 건드리지 않는다) */
  const stuck = useLongActive(arLocked && placement.manual && placement.phase === 'blocked')
  /** 개발 모드에서 ?floor=0.85·?keep=0.1 로 산책 최저선 값을, ?tight=0.15 로 크게 돌 때 반지름을, ?turnspeed=1.3 으로 제자리 회전 빠르기를 바꾼다 (다음 산책부터, 배포 파일에는 들어가지 않는다) */
  const walkTuning = useMemo(() => (import.meta.env.DEV ? readWalkTuning(searchParams) : undefined), [searchParams])
  /**
   * 카메라가 개에 너무 가까우면 안내 문구를 바꾸고 개·그림자를 흐리거나 숨긴다 (배포 빌드에도).
   * 개발 모드에서 ?nearhint=0.35 안내 거리 (m), ?nearfadeat=0.2 흐리기 시작 거리 (m), ?nearfade=fade|hide 방식
   */
  const nearTuning = useMemo(() => (import.meta.env.DEV ? readNearTuning(searchParams) : undefined), [searchParams])
  const near = useArNear(placement.nearHost, { debug, tuning: nearTuning })
  /** 고개 바라보기가 매 프레임 읽는 산책 상태 (산책 훅이 고개 훅보다 뒤라 ref 로 넘긴다) */
  const walkStateRef = useRef<{ active: boolean; standing: boolean; requestTurn: (reason: string) => boolean }>({
    active: false,
    standing: false,
    requestTurn: () => false,
  })
  const gaze = useArGaze(placement.gazeHost, {
    enabled: gazeOptions.enabled,
    offReason: '?gaze=0',
    debug,
    template: model.template,
    tuning: gazeOptions.tuning,
    turnSpeed: walkTuning?.turnSpeed,
    readAnimator: () => animatorRef.current?.state ?? { pose: 'stand', busy: false },
    readWalk: () => walkStateRef.current,
    walkHost: placement.walkHost,
    // ?closesit: 가까이 붙으면 스스로 앉고, 물러나면 일어난다 (명령 칩 표시는 바꾸지 않는다)
    requestPose: (next) => {
      const animator = animatorRef.current
      if (!animator?.hasCommands || walkStateRef.current.active) return false
      animator.command(next)
      return true
    },
    isHidden: near.isHidden,
  })
  const walk = useArWalk(placement.walkHost, {
    canStart: dogReady && pose === 'stand' && !animBusy && !gaze.turning,
    debug,
    tuning: walkTuning,
  })
  useEffect(() => {
    walkStateRef.current = { active: walk.active, standing: walk.phase === 'standing', requestTurn: walk.requestTurn }
  }, [walk.active, walk.phase, walk.requestTurn])
  /** 산책 중: 명령 칩·음성·다시 놓기를 숨기고 개 탭을 막는다 */
  const walking = walk.active
  /** ?debug 상자: 산책 중이면 산책 줄을 위에, 맨 위에 고개 한 줄 */
  const gazeLines = [near.debugLine, gaze.debugLine].filter((line): line is string => !!line)
  const hitDebug = walk.debug
    ? { summary: walk.debug.summary, lines: [...gazeLines, ...walk.debug.lines, ...(placement.debug?.lines ?? [])] }
    : placement.debug && { ...placement.debug, lines: [...gazeLines, ...placement.debug.lines] }

  useEffect(() => {
    const mv = mvRef.current
    if (!mv) return
    const onProgress = (event: Event) => setProgress((event as CustomEvent<{ totalProgress: number }>).detail.totalProgress)
    // AR 모드는 비동기로 정해지고(model-viewer 가 navigator.xr.isSessionSupported 를 기다린 뒤 정함),
    // Scene Viewer 가 없으면 실패 뒤 다음 모드로 바뀐다. 바뀌어도 이벤트가 없어 같은 질의를 기다린 뒤 다시 읽는다
    const refreshCanAr = async () => {
      await mv.updateComplete
      const xr = (navigator as Navigator & { xr?: { isSessionSupported?: (mode: string) => Promise<boolean> } }).xr
      await xr?.isSessionSupported?.('immersive-ar').catch(() => false)
      // model-viewer 쪽 후속 처리가 먼저 돌도록 한 번 더 양보한다
      await new Promise((resolve) => setTimeout(resolve))
      setCanAr(mv.canActivateAR)
    }
    const onLoad = () => {
      setLoaded(true)
      void refreshCanAr()
      animatorRef.current?.dispose()
      // 새 모델은 서기 자세에서 시작한다
      setPose('stand')
      setAnimBusy(false)
      setActiveCommand(null)
      const animator = new DogAnimator(mv, {
        tapAnimation: behaviorRef.current.tapAnimation,
        playbackRate: behaviorRef.current.playbackRate,
        onPose: setPose,
        onBusy: setAnimBusy,
      })
      animatorRef.current = animator
      setHasCommands(animator.hasCommands)
      setTapIsHeadTilt(animator.tapIsHeadTilt)
    }
    // 'webglcontextlost' 도 error 로 오지만 렌더러가 스스로 복구한다. 파일을 못 받았을 때만 실패로 본다
    const onError = (event: Event) => {
      if ((event as CustomEvent<{ type: string }>).detail?.type === 'loadfailure') setLoadFailed(true)
    }
    const onArStatus = (event: Event) => {
      const status = (event as CustomEvent<{ status: ArStatus }>).detail.status
      setArStatus(status)
      if (status === 'failed') setArFailed(true)
      void refreshCanAr()
    }
    // WebXR 화면에서 오버레이(명령 버튼)를 만지면 XR select 도 같이 일어나 개가 돌거나 끌려간다. 오버레이 터치는 막는다
    const blockXrSelect = (event: Event) => event.preventDefault()
    const overlays = [topOverlayRef.current, bottomOverlayRef.current]
    overlays.forEach((overlay) => overlay?.addEventListener('beforexrselect', blockXrSelect))
    mv.addEventListener('progress', onProgress)
    mv.addEventListener('load', onLoad)
    mv.addEventListener('error', onError)
    mv.addEventListener('ar-status', onArStatus)
    return () => {
      mv.removeEventListener('progress', onProgress)
      mv.removeEventListener('load', onLoad)
      mv.removeEventListener('error', onError)
      mv.removeEventListener('ar-status', onArStatus)
      overlays.forEach((overlay) => overlay?.removeEventListener('beforexrselect', blockXrSelect))
      animatorRef.current?.dispose()
      animatorRef.current = null
    }
  }, [])

  const startAr = () => {
    setShowGuide(false)
    setArFailed(false)
    // 버튼을 누른 그 순간에 불러야 브라우저가 카메라를 열어 준다
    if (mvRef.current?.canActivateAR) void mvRef.current.activateAR()
  }

  const runCommand = (commandId: CommandId) => {
    // 산책 중·몸 돌리기 중에는 클립을 산책·회전이 돌린다
    if (walking || gaze.isTurning()) return
    gaze.userCommand()
    setActiveCommand(commandId)
    animatorRef.current?.command(commandId)
  }

  /** 개 탭. head_tilt 가 있으면 갸우뚱, 없으면 꼬리 흔들기 */
  const tapReaction = () => {
    if (walking) return
    gaze.trigger('tap')
    if (gaze.isTurning()) return
    setActiveCommand(null)
    animatorRef.current?.tap()
  }

  /** '꼬리 흔들기' 칩. 늘 꼬리 흔들기 */
  const wagReaction = () => {
    if (walking || gaze.isTurning()) return
    setActiveCommand(null)
    animatorRef.current?.wag()
  }

  /** 음성 명령을 못 알아들었을 때. head_tilt 가 있으면 갸우뚱 ('알아듣지 못했어요' 문구는 마이크 버튼이 띄운다) */
  const puzzledReaction = () => {
    if (!walking && !gaze.isTurning()) animatorRef.current?.puzzled()
  }

  /** 다시 놓기: 개를 숨기고 바닥 원으로 돌아간다 */
  const replaceDog = () => {
    setActiveCommand(null)
    placement.replace()
  }

  // 개를 누른 채 3초 → 짖기. 그 뒤 손을 떼도 탭 반응은 내지 않는다 (onPointerUp)
  const dogHold = useLongPress<ReactPointerEvent>({
    enabled: hasCommands,
    slopPx: TAP_SLOP_PX,
    canStart: (event) => {
      const mv = mvRef.current
      return event.target === mv && !!mv?.positionAndNormalFromPoint(event.clientX, event.clientY)
    },
    onLongPress: () => runCommand('bark'),
  })
  // AR 안에서 개를 직접 누를 수 없을 때 대신: 꼬리 흔들기 칩을 3초 누르면 짖기
  const wagChipHold = useLongPress<ReactPointerEvent>({
    enabled: hasCommands && dogReady,
    slopPx: TAP_SLOP_PX,
    canStart: (event) => !(event.target as Element).closest('button')?.disabled,
    onLongPress: () => runCommand('bark'),
  })

  // 화면 안 3D 에서 개를 탭하면 반응한다. 카메라를 돌린 드래그는 빼고, 개를 맞혔을 때만
  const onPointerDown = (event: ReactPointerEvent) => {
    pointerStart.current = { x: event.clientX, y: event.clientY }
    dogHold.handlers.onPointerDown(event)
  }
  const onPointerUp = (event: ReactPointerEvent) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (dogHold.handlers.onPointerUp(event)) return
    const mv = mvRef.current
    if (!start || !mv || event.target !== mv) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX) return
    if (mv.positionAndNormalFromPoint(event.clientX, event.clientY)) tapReaction()
  }

  if (loadFailed) {
    return (
      <MessageShell onBack={onBack}>
        <StateView
          tone="error"
          title="3D 모델을 불러오지 못했어요"
          description="인터넷 연결을 확인하고 다시 시도해 주세요."
          action={
            <Button variant="outline" size="md" onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          }
        />
      </MessageShell>
    )
  }

  return (
    <div className="relative mx-auto h-dvh w-full max-w-[480px] overflow-hidden overscroll-none bg-ar-camera text-white">
      <model-viewer
        ref={mvRef}
        src={resolveModelUrl(model.glbUrl)}
        ios-src={model.usdzUrl ? resolveModelUrl(model.usdzUrl) : undefined}
        alt={`${pet.kindName} 3D 모델, 체고 ${withersCm}cm`}
        ar
        // usdzUrl 이 없으면 아이폰 AR 을 끈다. 그냥 두면 model-viewer 가 GLB 에서 USDZ 를 즉석으로 만드는데 뼈대 있는 모델은 깨진다
        ar-modes={model.usdzUrl ? 'webxr scene-viewer quick-look' : 'webxr scene-viewer'}
        ar-scale="fixed"
        ar-placement="floor"
        camera-controls
        camera-orbit="35deg 78deg auto"
        // 화면이 스크롤되지 않는 전체 화면이라 세로 드래그도 카메라 기울이기에 쓴다
        touch-action="none"
        interaction-prompt="none"
        shadow-intensity="1"
        shadow-softness="0.8"
        loading="eager"
        className="block size-full bg-ar-camera"
        style={{ '--poster-color': 'transparent' } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={dogHold.handlers.onPointerMove}
        onPointerCancel={dogHold.handlers.onPointerCancel}
      >
        {/* 기본 AR 버튼은 숨기고 아래 '우리 집 바닥에 놓기' 로 연다 */}
        <span slot="ar-button" hidden />
        {/* 기본 진행 막대 대신 안내 화면의 버튼에 퍼센트를 보인다 */}
        <span slot="progress-bar" hidden />

        {/* 아래는 WebXR 화면에도 그대로 겹쳐 보인다 (model-viewer 의 DOM overlay) */}
        {/* AR: 놓기 전 탭은 바닥 원 자리에 놓기, 놓은 뒤에는 개 탭. 이동·회전 터치는 막는다. 오버레이보다 앞에 둬야 칩·버튼이 위에 온다 */}
        <ArFloorHint active={inAr && placement.phase === 'searching' && !placement.floorKnown} />
        <ArTouchLayer
          active={inAr}
          dogReady={dogReady}
          holdEnabled={hasCommands}
          slopPx={TAP_SLOP_PX}
          mvRef={mvRef}
          onTap={tapReaction}
          onLongPress={() => runCommand('bark')}
          onPlaceTap={placement.place}
          locked={walking}
        />
        <div
          ref={topOverlayRef}
          className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-3 pt-[calc(12px+env(safe-area-inset-top))]">
          <div className="flex w-full items-center justify-between">
            {/* WebXR 중에는 model-viewer 의 닫기 버튼을 쓴다 */}
            {inAr ? (
              <span className="size-11" aria-hidden />
            ) : (
              <button
                type="button"
                onClick={onBack}
                aria-label="AR 닫기"
                className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-black/45"
              >
                <X className="size-5.5" strokeWidth={2} aria-hidden />
              </button>
            )}
            <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-measure px-3.5 text-body font-bold whitespace-nowrap text-ink">
              <Ruler className="size-4" strokeWidth={2.2} aria-hidden />
              실제 크기 · 체고 <span className="font-mono">{withersCm}cm</span>
            </span>
            <span className="size-11" aria-hidden />
          </div>
          <p aria-live="polite" className="text-center text-body text-on-dark [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
            {arLocked
              ? placementHint(placement)
              : near.hint
                ? NEAR_HINT_TEXT
                : walking
                ? walkHint(walk)
                : hasCommands
                ? `${POSE_LABEL[pose]} · 명령을 눌러 보세요`
                : inAr
                  ? '아래 버튼을 누르면 꼬리를 흔들어요'
                  : tapIsHeadTilt
                    ? '유기견을 탭하면 고개를 갸우뚱해요'
                    : '유기견을 탭하면 꼬리를 흔들어요'}
          </p>
          {stuck && (
            <p className="text-center text-label text-on-dark-secondary [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
              잘 안 되면 AR을 닫았다가 다시 열어 주세요
            </p>
          )}
          {arLocked && placement.phase === 'preparing' && placement.notice !== 'tiltDown' && <MoveSideways />}
          {isLikelyPuppy(pet.birthYear) && (
            <p className="flex max-w-[340px] gap-1.5 rounded-input bg-dark-notice px-3 py-2 text-label text-dark-notice-ink">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-measure" strokeWidth={2} aria-hidden />
              {PUPPY_NOTICE}
            </p>
          )}
          {arFailed && (
            <p role="alert" className="rounded-input bg-overlay px-3 py-2 text-label text-on-dark">
              AR을 시작하지 못했어요. 화면 안 3D로 보여 드릴게요.
            </p>
          )}
        </div>

        <div
          ref={bottomOverlayRef}
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
          {walking ? (
            // 산책 중: 명령 칩·음성·다시 놓기 대신 '산책 끝' 하나 (걷는 중이면 다음 걸음 끝에서 멈춘 뒤 끝난다)
            <button
              type="button"
              onClick={walk.end}
              disabled={walk.ending}
              className="pointer-events-auto flex h-12 w-full items-center justify-center gap-2 rounded-full bg-measure text-emphasis font-bold text-ink transition active:scale-97 disabled:opacity-60"
            >
              <Footprints className="size-5" strokeWidth={2.2} aria-hidden />
              {walk.ending ? '멈추는 중…' : '산책 끝'}
            </button>
          ) : (
            <>
              {(hasCommands || canReplace || showFloorReset || walk.available) && (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    {hasCommands && (
                      <VoiceCommandButton
                        inAr={inAr}
                        disabled={arLocked}
                        onCommand={runCommand}
                        onMiss={puzzledReaction}
                        onListen={() => gaze.trigger('mic')}
                      />
                    )}
                  </div>
                  {showFloorReset && (
                    <button
                      type="button"
                      onClick={placement.resetFloor}
                      className="pointer-events-auto h-9 shrink-0 rounded-full bg-black/65 px-3 font-mono text-[11px] text-lime-300 active:scale-97"
                    >
                      [dev] 바닥 다시 찾기
                    </button>
                  )}
                  {walk.available && (
                    <button
                      type="button"
                      onClick={walk.start}
                      className="pointer-events-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-measure px-4 text-body font-semibold text-ink transition active:scale-97"
                    >
                      <Footprints className="size-4" strokeWidth={2.2} aria-hidden />
                      산책
                    </button>
                  )}
                  {canReplace && (
                    <button
                      type="button"
                      onClick={replaceDog}
                      className="pointer-events-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-black/55 px-4 text-body font-semibold text-white transition active:scale-97"
                    >
                      <RotateCcw className="size-4" strokeWidth={2.2} aria-hidden />
                      다시 놓기
                    </button>
                  )}
                </div>
              )}
              <CommandBar
                hasCommands={hasCommands}
                pose={pose}
                active={activeCommand}
                disabled={!loaded || arLocked || gaze.turning}
                onCommand={runCommand}
                onWag={wagReaction}
                wagHold={wagChipHold.handlers}
              />
            </>
          )}

          {!inAr && (
            <button
              type="button"
              onClick={onBack}
              className="pointer-events-auto flex items-center gap-3 rounded-card bg-overlay px-3 py-2.5 text-left"
            >
              <span className="block min-w-0 flex-1">
                <span className="block truncate text-body font-semibold">
                  {pet.kindName} · {SEX_LABEL[pet.sex]}
                  {pet.weightKg !== null && <span className="font-mono"> · {formatWeight(pet.weightKg)}</span>}
                </span>
                <span className="mt-0.5 block truncate text-caption text-on-dark-secondary">
                  {pet.careName}에서 기다리고 있어요
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-label font-semibold text-measure">
                만나러 가기
                <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
              </span>
            </button>
          )}

          {!inAr &&
            (canAr ? (
              <button
                type="button"
                onClick={startAr}
                className={buttonStyles({ variant: 'measure', size: 'xl', fullWidth: true, className: 'pointer-events-auto' })}
              >
                <Box className="size-5" strokeWidth={2} aria-hidden />
                우리 집 바닥에 놓기
              </button>
            ) : (
              loaded && (
                <p className="rounded-input bg-overlay px-3 py-2.5 text-center text-label text-on-dark-secondary">
                  이 기기에서는 AR을 열 수 없어 화면 안 3D로 보여 드려요.
                  {!isTouchDevice() && ' 휴대폰으로 열면 우리 집 바닥에 놓을 수 있어요.'}
                </p>
              )
            ))}
        </div>

        <HoldRing at={dogHold.press ?? wagChipHold.press} durationMs={LONG_PRESS_MS} />
        {import.meta.env.DEV && <ArHitDebug mvRef={mvRef} arStatus={arStatus} placement={hitDebug} />}
      </model-viewer>

      {showGuide && (
        <ArGuide
          pet={pet}
          withersCm={withersCm}
          onBack={onBack}
          progress={progress}
          loaded={loaded}
          canAr={canAr}
          onStart={startAr}
          onPreview={() => setShowGuide(false)}
        />
      )}
    </div>
  )
}

/** 명령 버튼. 진도처럼 클립이 다 있는 모델만 명령을 보이고, 아니면 꼬리 흔들기 칩 하나만 */
function CommandBar({
  hasCommands,
  pose,
  active,
  disabled,
  onCommand,
  onWag,
  wagHold,
}: {
  hasCommands: boolean
  pose: Pose
  active: CommandId | null
  disabled: boolean
  onCommand: (id: CommandId) => void
  /** 꼬리 흔들기 칩. 개 탭과 달리 갸우뚱이 있어도 늘 꼬리를 흔든다 */
  onWag: () => void
  /** 꼬리 흔들기 칩을 길게 누를 때 */
  wagHold: LongPressHandlers<ReactPointerEvent>
}) {
  return (
    <div role="group" aria-label="유기견에게 명령하기" className="pointer-events-auto -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
      {hasCommands &&
        COMMANDS.map((command) => (
          <ChipButton
            key={command.id}
            highlighted={active === command.id}
            disabled={disabled}
            onClick={() => onCommand(command.id)}
          >
            {command.label}
          </ChipButton>
        ))}
      {/* 꼬리 흔들기는 서 있을 때만 자연스럽다. AR 에서는 3초 누르면 짖는다 */}
      <span className="contents" {...wagHold}>
        <ChipButton highlighted={false} disabled={disabled || pose !== 'stand'} onClick={onWag}>
          꼬리 흔들기
        </ChipButton>
      </span>
    </div>
  )
}

function ChipButton({
  highlighted,
  disabled,
  onClick,
  children,
}: {
  /** 마지막으로 누른 명령. 켜고 끄는 버튼이 아니라 aria-pressed 는 쓰지 않고, 자세는 위 안내 문구(aria-live)로 읽힌다 */
  highlighted: boolean
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-11 shrink-0 rounded-full px-4 text-body font-semibold transition active:scale-97 disabled:opacity-45',
        highlighted ? 'bg-measure text-ink' : 'bg-black/55 text-white',
      )}
    >
      {children}
    </button>
  )
}

/** 캔버스 06. 모델은 이 화면 뒤에서 미리 불러온다 */
function ArGuide({
  pet,
  withersCm,
  onBack,
  progress,
  loaded,
  canAr,
  onStart,
  onPreview,
}: {
  pet: PetDetail
  withersCm: number
  onBack: () => void
  progress: number
  loaded: boolean
  canAr: boolean
  onStart: () => void
  onPreview: () => void
}) {
  const steps = [
    ['밝은 곳에서 바닥을 비춰요', '유기견이 지낼 거실이나 방의 넓고 평평한 바닥이 좋아요.'],
    ['유기견이 바닥에 놓여요', '실제 크기로 고정돼서 가까이 가도 멀어져도 크기는 그대로예요.'],
    ['유기견에게 말을 걸어 보세요', '앉아, 엎드려 같은 버튼을 누르면 움직여요. 소파 옆, 현관 앞에도 놓아 보세요.'],
  ] as const

  return (
    <div className="absolute inset-0 z-10 flex flex-col overflow-y-auto bg-canvas pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-ink">
      <header className="flex h-14 shrink-0 items-center px-2">
        <button type="button" onClick={onBack} aria-label="뒤로" className="flex size-11 items-center justify-center">
          <ChevronLeft className="size-5.5" strokeWidth={2} aria-hidden />
        </button>
      </header>

      <div className="px-5 pt-1">
        <div className="flex items-center gap-3 rounded-card bg-surface p-2.5">
          <PetPhoto
            src={pet.photoUrls[0] ?? null}
            alt={`${pet.kindName} 공고 사진`}
            className="size-12 shrink-0 rounded-input"
            showPlaceholderLabel={false}
            lazy={false}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-semibold">
              {pet.kindName} · {SEX_LABEL[pet.sex]}
            </p>
            <p className="mt-0.5 text-label text-ink-tertiary">
              체고 <span className="font-mono">{withersCm}cm</span>
              {pet.weightKg !== null && (
                <>
                  {' · '}
                  <span className="font-mono">{formatWeight(pet.weightKg)}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <h1 className="mt-6 text-headline font-bold">
          우리 집 바닥에
          <br />
          실제 크기로 놓아 볼게요
        </h1>

        <ol className="mt-6 flex flex-col gap-4.5">
          {steps.map(([title, body], index) => (
            <li key={title} className="flex gap-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-body font-semibold text-measure">
                {index + 1}
              </span>
              <div>
                <p className="text-emphasis font-semibold">{title}</p>
                <p className="mt-0.5 text-body text-ink-tertiary">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-auto px-5 pt-6 pb-7">
        <div className="mb-3.5 flex gap-2.5 rounded-input bg-muted px-3.5 py-3">
          <Smartphone className="mt-0.5 size-4.5 shrink-0 text-ink-tertiary" strokeWidth={2} aria-hidden />
          <p className="text-label text-ink-secondary">
            아이폰은 놓고 보기까지 돼요. 명령과 탭 반응은 안드로이드 Chrome이나 화면 안 3D에서 볼 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={canAr ? onStart : onPreview}
          disabled={!loaded}
          className={buttonStyles({ variant: 'primary', size: 'xl', fullWidth: true })}
        >
          {loaded ? (
            canAr ? (
              <>
                <Camera className="size-5" strokeWidth={2} aria-hidden />
                카메라 켜고 시작하기
              </>
            ) : (
              <>
                <Box className="size-5" strokeWidth={2} aria-hidden />
                3D로 보기
              </>
            )
          ) : (
            <span aria-live="polite">3D 모델 불러오는 중 {Math.round(progress * 100)}%</span>
          )}
        </button>
        {loaded && canAr && (
          <button
            type="button"
            onClick={onPreview}
            className="mt-1 flex h-11 w-full items-center justify-center text-body text-ink-secondary"
          >
            카메라 없이 3D로 먼저 보기
          </button>
        )}
        <p className="mt-2.5 text-center text-caption text-ink-caption">
          {canAr || !loaded
            ? '카메라 권한이 필요해요'
            : isTouchDevice()
              ? '이 기기에서는 AR을 열 수 없어 화면 안 3D로 보여 드려요'
              : '이 기기에서는 AR을 열 수 없어요. 휴대폰으로 열어 주세요'}
        </p>
      </div>
    </div>
  )
}

/** 준비 단계: 휴대폰을 좌우로 움직이라는 표시 */
function MoveSideways() {
  return (
    <div aria-hidden className="flex items-center gap-1.5 text-on-dark [filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.6))]">
      <ChevronLeft className="size-5" strokeWidth={2.2} />
      <Smartphone className="size-7 motion-safe:animate-sway" strokeWidth={1.8} />
      <ChevronRight className="size-5" strokeWidth={2.2} />
    </div>
  )
}

function MessageShell({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-canvas px-5 pt-[env(safe-area-inset-top)]">
      <header className="-mx-3 flex h-14 items-center">
        <button type="button" onClick={onBack} aria-label="뒤로" className="flex size-11 items-center justify-center">
          <ChevronLeft className="size-5.5" strokeWidth={2} aria-hidden />
        </button>
      </header>
      {children}
    </div>
  )
}

/**
 * 개발용 주소 옵션: ?floor (최저선 비율, 0 이면 끔, 0–1.5) · ?keep (걷는 중 지킬 길 여유 m, 0–1) ·
 * ?tight (크게 돌 때 가장 좁은 반지름, 몸길이 배 0.05–1, 기본 0.25) · ?turnspeed (제자리 회전 재생 배율에 곱함, 0.25–3, 기본 1, 몸 돌리기에도).
 * 없거나 숫자가 아니면 기본값
 */
function readWalkTuning(params: URLSearchParams): WalkTuning {
  const read = numberParam(params)
  return {
    minStopRatio: read('floor', 1.5),
    floorKeepExtra: read('keep', 1),
    tightTurnRatio: read('tight', 1, 0.05),
    turnSpeed: read('turnspeed', 3, 0.25),
  }
}

/**
 * 개발용 고개 바라보기: ?gaze=0 끔 (기본 켬) · ?gazemax (좌우 한계 °, 10–120) · ?gazeup (위 한계 °, 0–80) ·
 * ?gazeon·?gazeoff (바라보기·딴청 평균 초, 0.5–30) · ?bodyturn (몸 돌리기 기다리는 기준 초: 한계를 막 넘었을 때, 뒤쪽 120° 는 그 0.4 배, 0 이면 끔, 0–30) ·
 * ?gazejaw (위로 들었을 때 턱 남기는 비율, 0–1) · ?gazejawup (그 비율까지 줄이는 위 각 °, 1–80) ·
 * ?closesit=1 (가까이 붙으면 스스로 앉아 올려다봄, 기본 끔). 없거나 숫자가 아니면 기본값
 */
function readGazeOptions(params: URLSearchParams): { enabled: boolean; tuning: GazeTuning } {
  const read = numberParam(params)
  return {
    enabled: params.get('gaze') !== '0',
    tuning: {
      yawDeg: read('gazemax', 120, 10),
      upDeg: read('gazeup', 80),
      lookMeanS: read('gazeon', 30, 0.5),
      awayMeanS: read('gazeoff', 30, 0.5),
      bodyTurnS: read('bodyturn', 30),
      jawKeep: read('gazejaw', 1),
      jawFullUpDeg: read('gazejawup', 80, 1),
      closeSit: params.get('closesit') === '1',
    },
  }
}

/** 개발용 가까움: ?nearhint (안내 거리 m, 0.05–1) · ?nearfadeat (흐리기 시작 m, 0.13–0.6) · ?nearfade=fade|hide. 없으면 기본값 */
function readNearTuning(params: URLSearchParams): NearTuning {
  const read = numberParam(params)
  const mode = params.get('nearfade')
  return {
    hintM: read('nearhint', 1, 0.05),
    fadeM: read('nearfadeat', 0.6, 0.13),
    mode: mode === 'fade' || mode === 'hide' ? mode : undefined,
  }
}

/** 주소의 숫자 옵션을 읽는 함수. min~max 밖이거나 숫자가 아니면 undefined */
function numberParam(params: URLSearchParams) {
  return (name: string, max: number, min = 0) => {
    const raw = params.get(name)
    if (raw === null || raw.trim() === '') return undefined
    const value = Number(raw)
    return Number.isFinite(value) && value >= min && value <= max ? value : undefined
  }
}

/** 개발용 가림 시험: ?occlusion=1 · raw 가 아니면 끔. ?ofloor 는 0–0.5 (m), 없거나 숫자가 아니면 기본값 */
function readOcclusion(params: URLSearchParams): ArOcclusionOptions | null {
  const mode = params.get('occlusion')
  if (mode !== '1' && mode !== 'raw') return null
  const raw = params.get('ofloor')
  const value = raw === null || raw.trim() === '' ? NaN : Number(raw)
  return {
    mode: mode === 'raw' ? 'raw' : 'smooth',
    floorIgnore: Number.isFinite(value) && value >= 0 && value <= 0.5 ? value : undefined,
  }
}
