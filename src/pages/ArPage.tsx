import '@google/model-viewer'
import type { ModelViewerElement } from '@google/model-viewer'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Box, Camera, ChevronLeft, ChevronRight, Footprints, Mic, Smartphone } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../apis/apiError'
import type { PetDetail, PetModelView } from '../apis/dto/pet.dto'
import { resolveModelUrl } from '../apis/pet'
import { Button } from '../components/Button/Button'
import { buttonStyles } from '../components/Button/buttonStyles'
import { StateView } from '../components/StateView/StateView'
import { PUPPY_NOTICE, SEX_LABEL } from '../constants/pet'
import { ArControls } from '../features/ar/components/ArControls'
import { ArFinishCard } from '../features/ar/components/ArFinishCard'
import { ArFloorHint } from '../features/ar/components/ArFloorHint'
import { ArHitDebug } from '../features/ar/components/ArHitDebug'
import { ArInfoSheet } from '../features/ar/components/ArInfoSheet'
import { ArPawPrints } from '../features/ar/components/ArPawPrints'
import { ArTopBar } from '../features/ar/components/ArTopBar'
import {
  allPawsDone,
  nextPaw,
  PAW_BUTTON,
  PAW_HINT,
  pawOf,
  pawsFor,
  stampPaw,
  type PawEvent,
  type PawId,
} from '../features/ar/arPaws'
import { ArTouchLayer } from '../features/ar/components/ArTouchLayer'
import { HoldRing } from '../features/ar/components/HoldRing'
import { ReactionBubble } from '../features/ar/components/ReactionBubble'
import { VoiceLogDebug } from '../features/ar/components/VoiceLogDebug'
import {
  AR_TEXT,
  FOLLOW_NOTICE,
  INTRO_PUPPY_MS,
  INTRO_STEP_MS,
  INTRO_TEXT,
  NOTICE_TEXT,
  pickHint,
  POSE_HINT,
  REACTION_BY_CLIP,
  SAME_POSE_MS,
  SAME_POSE_TEXT,
  type ReactionKind,
} from '../features/ar/arText'
import {
  DogAnimator,
  POSE_LABEL,
  type CommandId,
  type Pose,
  type ReactSource,
  type RequestResult,
  type ReserveId,
  type TapResult,
} from '../features/ar/dogAnimator'
import { useVoiceCommand } from '../features/ar/useVoiceCommand'
import { STANDING_CLIP, WALK_CLIPS } from '../features/ar/walk/walkSpec'
import { attachPoseLayers, clipQuietEnds, type PoseLayersHandle } from '../features/ar/modelViewerArStage'
import { useArPlacement, type ArOcclusionOptions, type ArPlacement } from '../features/ar/useArPlacement'
import { useArWalk, type ArWalk } from '../features/ar/useArWalk'
import { useArGaze } from '../features/ar/useArGaze'
import { useArNear } from '../features/ar/useArNear'
import { NEAR_HINT_TEXT, type NearTuning } from '../features/ar/nearCamera'
import { GAZE_IN_PRODUCTION, type GazeTuning } from '../features/ar/gaze/gazeSpec'
import type { WalkTuning } from '../features/ar/walk/walkController'
import { LONG_PRESS_MS, useLongPress } from '../features/ar/useLongPress'
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
//   놓은 뒤 '산책'을 누르면 (앉아 있으면 일어난 뒤) 개가 사용자를 따라 걷는다 (useArWalk, 걷기 클립이 있는 모델만). 그동안 명령·음성·개 탭은 숨기거나 막는다.
//   놓은 뒤에는 고개를 돌려 가끔 사용자(휴대폰)를 바라본다 (useArGaze, 지금은 개발 모드만. 제자리 회전 클립이 있으면 오래 옆·뒤에 있는 사용자 쪽으로 돌아선다)
// - WebXR 이 안 되는 안드로이드: Scene Viewer 앱으로 넘어간다 (명령·탭 반응 없음)
// - 아이폰: Quick Look 으로 USDZ 를 연다. USDZ 에는 대기 루프 하나만 있어 명령·탭 반응이 안 된다
// - AR 이 안 되는 기기(데스크톱 등): 화면 안 3D 로 보여 준다. 명령·탭 반응은 된다
//
// 화면 배치 (WebXR 과 화면 안 3D 가 같다. 개가 주인공이라 가운데는 비운다)
// - 위: 닫기 · 이름·체고 알약(누르면 정보 시트: 다시 놓기도 여기) · 따라보기(몸 돌리기가 되는 개만) · 찜. 그 아래 안내 한 줄 (pickHint)
// - 가운데: 개 머리 위 반응 말풍선 ('?', 하트, '멍!', '빵!')
// - 아래: [묘기 | 말 걸기 | 산책]. 묘기는 명령 트레이(3×2)를 펼친다. 명령 클립이 없으면 묘기 자리에 꼬리 흔들기 하나.
//   산책 중에는 '산책 끝' 하나
//
// 입력은 막지 않는다 (버튼을 꺼 두는 것은 놓기 전·불러오는 중뿐, 규칙은 DogAnimator): 반응·짖기·손 줘는 끊고 바로,
// 빵·구르기·자세 전환·몸 돌리기 중이면 예약 (누른 칩·버튼이 눌린 모양으로 남고 위에 '하던 동작을 마치고 할게요', 다시 누르면 취소).
// 아무 일도 안 일어나는 입력은 없다: 앉은 개 톡은 절차적 갸우뚱, 끊지 않는 동작 중 톡은 '?' 말풍선, 같은 자세 명령은 '이미 앉아 있어요'
//
// 크기: GLB 가 이미 미터 단위 실제 크기라 ar-scale="fixed" 로 손가락 확대·축소를 막는다

type ArStatus = 'not-presenting' | 'session-started' | 'object-placed' | 'failed'

/** 휴대폰·태블릿인지 (데스크톱에만 '휴대폰으로 열어 주세요' 를 보인다) */
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

/** 탭과 드래그(카메라 돌리기)를 가르는 거리 */
const TAP_SLOP_PX = 8

/** 배치 전 빨강(놓을 수 없음)이 이만큼(ms) 넘게 이어지면 다시 열어 보라는 줄을 더한다 */
const STUCK_HINT_MS = 10_000
/** 개를 3초 누르면 하는 명령. 짖기는 음성과 묘기 트레이로 */
const HOLD_COMMAND: CommandId = 'play_dead'
/** 끝부분이 첫 프레임 자세로 돌아와 비어 있으면 거기서 끊는 클립 (목업은 갸우뚱만 비어 있다) */
const REACTION_CLIPS = ['head_tilt', 'tail_wag', 'bark']

/** 명령이 받아들여졌는지 (발도장): 바로 · 예약 · 이미 그 자세 · 이미 하는 중 */
const accepted = (result: RequestResult) => result === 'started' || result === 'reserved' || result === 'same' || result === 'running'

/** '따라보기' 토글을 누른 뒤 위 안내 문구를 보이는 시간 (ms) */
const FOLLOW_NOTICE_MS = 3000
/** 발도장을 다 모은 뒤 개가 쉬고 있을 때 이만큼(ms) 있다가 짖고 꼬리를 흔든다 */
const CELEBRATE_DELAY_MS = 500
/** 발도장이 찍힐 때 진동 (ms) */
const PAW_VIBRATE_MS = 30

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
  // 다른 개로 가면 화면 상태(트레이·발도장 등)를 처음부터
  return <ArView key={pet.id} pet={pet} model={pet.model} onBack={goBack} />
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
  /** 걷기 클립(walk_start·walk·walk_stop·standing)이 다 있는지. AR 에서 '산책' 버튼 자리를 정한다 */
  const [hasWalkClips, setHasWalkClips] = useState(false)
  /** 묘기 트레이. 명령을 눌러도 열려 있고, 묘기 버튼을 다시 누르거나 개를 탭하면 닫힌다 */
  const [trayOpen, setTrayOpen] = useState(false)
  /** 이름·체고 알약을 누르면 여는 정보 시트 */
  const [infoOpen, setInfoOpen] = useState(false)
  /** 개 머리 위 반응 말풍선. id 가 바뀌면 다시 띄운다 */
  const [reaction, setReaction] = useState<{ kind: ReactionKind; id: number } | null>(null)
  /** 애니메이터가 클립을 틀 때 (load 때 한 번 만든 애니메이터가 최신 함수를 부르도록 ref, 아래에서 채운다) */
  const clipStartRef = useRef<(clip: string) => void>(() => {})
  /** 개 탭에 반응 클립이 있는지 ('톡' 발도장) */
  const [canTap, setCanTap] = useState(false)
  /** 찍은 발도장 (이 화면 동안만) */
  const [pawsDone, setPawsDone] = useState<ReadonlySet<PawId>>(() => new Set())
  const pawsDoneRef = useRef(pawsDone)
  /** 발도장 찍기. 새로 찍히면 짧게 진동한다 */
  const stamp = useCallback((event: PawEvent) => {
    const next = stampPaw(pawsDoneRef.current, pawOf(event))
    if (next === pawsDoneRef.current) return
    pawsDoneRef.current = next
    setPawsDone(next)
    navigator.vibrate?.(PAW_VIBRATE_MS)
  }, [])
  /** 반응 클립이 실제로 재생될 때 (load 때 만든 애니메이터가 부른다) */
  const onReact = useCallback((source: ReactSource) => stamp({ type: 'react', source }), [stamp])
  const onReactRef = useRef(onReact)
  /** 처음 놓은 순간(AR)·처음 3D 로 본 순간의 인사와 체고 비교 (위 안내 자리에 2초씩), 새끼면 새끼 안내 3초 */
  const [intro, setIntro] = useState<'hello' | 'height' | 'puppy' | null>(null)
  const greetedRef = useRef({ ar: false, preview: false })
  /** 마무리 카드. complete: 발도장을 다 모음 · exit: 닫기를 눌렀을 때 한 번 */
  const [card, setCard] = useState<'complete' | 'exit' | null>(null)
  const cardSeenRef = useRef(false)
  const [celebrated, setCelebrated] = useState(false)
  /** 예약된 명령·산책 (누른 칩·버튼을 눌린 모양으로 두고, 위 안내 '하던 동작을 마치고 할게요') */
  const [reserved, setReserved] = useState<ReserveId | null>(null)
  /** 산책을 눌렀는데 앉거나 엎드려 있어 일어나는 중 ('일어나서 같이 걸을게요') */
  const [walkPrep, setWalkPrep] = useState(false)
  /** 같은 자세 명령 ('이미 앉아 있어요', SAME_POSE_MS 동안) */
  const [samePose, setSamePose] = useState<{ pose: Pose; at: number } | null>(null)
  useEffect(() => {
    if (!samePose) return
    const timer = window.setTimeout(() => setSamePose(null), SAME_POSE_MS)
    return () => window.clearTimeout(timer)
  }, [samePose])
  /** 자세 층 (클립 사이 섞기·절차적 갸우뚱). 내부 모양이 다르면 null */
  const poseLayersRef = useRef<PoseLayersHandle | null>(null)

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
    () => (import.meta.env.DEV ? readGazeOptions(searchParams) : { enabled: GAZE_IN_PRODUCTION, tuning: undefined, follow: true }),
    [searchParams],
  )
  /**
   * 몸 돌려 따라보기 (기본 켜짐, 개발 모드 ?follow=0 이면 꺼짐으로 시작). 끄면 개가 가만히 있어 옆·뒷모습을 둘러볼 수 있다.
   * 산책·다시 놓기에도 그대로 둔다
   */
  const [follow, setFollow] = useState(gazeOptions.follow)
  /** 토글을 누른 직후 3초 동안 위 안내 문구 */
  const [followNotice, setFollowNotice] = useState<{ on: boolean; at: number } | null>(null)
  useEffect(() => {
    if (!followNotice) return
    const timer = window.setTimeout(() => setFollowNotice(null), FOLLOW_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [followNotice])
  const toggleFollow = () => {
    const next = !follow
    setFollow(next)
    setFollowNotice({ on: next, at: Date.now() })
  }
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
      return animator.command(next) === 'started'
    },
    isHidden: near.isHidden,
    follow,
    // 몸 돌리는 동안 명령·산책은 예약하고 끝나면 한다
    onTurning: (turning) => animatorRef.current?.setBlocked(turning),
  })
  const walk = useArWalk(placement.walkHost, { debug, tuning: walkTuning })
  /** 산책 출발 (애니메이터가 서기 루프로 돌려 둔 뒤 부른다) */
  const walkStartRef = useRef(walk.start)
  useEffect(() => {
    walkStartRef.current = walk.start
  })
  useEffect(() => {
    walkStateRef.current = { active: walk.active, standing: walk.phase === 'standing', requestTurn: walk.requestTurn }
  }, [walk.active, walk.phase, walk.requestTurn])
  /** 산책 중: 아래 버튼(묘기·말 걸기)을 '산책 끝' 으로 바꾸고 개 탭을 막는다 */
  const walking = walk.active
  /** 반응 말풍선을 띄운다. 산책 중에는 띄우지 않는다 */
  const showReaction = useCallback(
    (kind: ReactionKind) => {
      if (walking) return
      setReaction((previous) => ({ kind, id: (previous?.id ?? 0) + 1 }))
    },
    [walking],
  )
  useEffect(() => {
    clipStartRef.current = (clip) => {
      const kind = REACTION_BY_CLIP[clip]
      if (kind) showReaction(kind)
    }
  })
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
      setReserved(null)
      setWalkPrep(false)
      // 클립 사이 자세 섞기 (화면 안 3D·AR). 못 쓰면 model-viewer 크로스페이드 그대로 (빈 끝에서 끊지도 않는다)
      const poseLayers = attachPoseLayers(mv)
      poseLayersRef.current = poseLayers
      const animator = new DogAnimator(mv, {
        tapAnimation: behaviorRef.current.tapAnimation,
        playbackRate: behaviorRef.current.playbackRate,
        onPose: setPose,
        onBusy: setAnimBusy,
        onClipStart: (clip) => clipStartRef.current(clip),
        onReact: (source) => onReactRef.current(source),
        onReserve: setReserved,
        poseBlend: poseLayers !== null,
        clipEnds: poseLayers ? clipQuietEnds(mv, REACTION_CLIPS) : undefined,
      })
      animatorRef.current = animator
      setHasCommands(animator.hasCommands)
      setTapIsHeadTilt(animator.tapIsHeadTilt)
      setCanTap(animator.canTap)
      setHasWalkClips([...WALK_CLIPS, STANDING_CLIP].every((clip) => mv.availableAnimations.includes(clip)))
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

  /**
   * 명령. 반응·짖기·손 줘 중이면 끊고 바로, 빵·구르기·자세 전환·몸 돌리기 중이면 예약 (toggle: 같은 칩을 다시 누르면 예약 취소).
   * 이미 그 자세면 '이미 앉아 있어요'. 산책 중에는 받지 않는다 (아래 버튼이 '산책 끝' 하나)
   */
  const runCommand = (commandId: CommandId, { toggle = false }: { toggle?: boolean } = {}): RequestResult => {
    const animator = animatorRef.current
    if (walking || !animator) return 'ignored'
    gaze.userCommand()
    const result = animator.command(commandId, { toggle })
    if (result === 'started') setActiveCommand(commandId)
    if (result === 'same') setSamePose({ pose: animator.state.pose, at: Date.now() })
    return result
  }

  /**
   * 톡·꼬리 흔들기·음성 실패의 결과: 클립이면 그 클립이 말풍선을 띄우고 (onClipStart), 앉거나 엎드려 있으면 절차적 갸우뚱 + '?',
   * 손 줘 중이면 손을 내리고 하트, 빵·구르기·자세 전환·몸 돌리기 중이면 '?' 말풍선만
   */
  const showTapResult = (result: TapResult) => {
    if (result === 'tilt') {
      poseLayersRef.current?.tiltHead()
      showReaction('puzzled')
    } else if (result === 'lowerPaw') showReaction('heart')
    else if (result === 'bubble') showReaction('puzzled')
  }

  /** 개 탭. 어느 반응이든 '톡' 발도장. 묘기 트레이는 닫는다 */
  const tapReaction = () => {
    const animator = animatorRef.current
    if (walking || !animator) return
    setTrayOpen(false)
    gaze.trigger('tap')
    showTapResult(animator.tap())
    stamp({ type: 'tap' })
  }

  /** '꼬리 흔들기' 버튼 (명령 클립이 없는 모델). 늘 꼬리 흔들기 */
  const wagReaction = () => {
    const animator = animatorRef.current
    if (walking || !animator) return
    setActiveCommand(null)
    showTapResult(animator.wag())
  }

  /** 음성 명령을 못 알아들었을 때 ('알아듣지 못했어요' 문구는 말 걸기 쪽에서 띄운다) */
  const puzzledReaction = () => {
    const animator = animatorRef.current
    if (walking || !animator) return
    showTapResult(animator.puzzled())
  }

  /** 개 3초 누르기가 다 참: 빵 ('꾹' 발도장, 예약이어도) */
  const holdDog = () => stamp({ type: 'hold', accepted: accepted(runCommand(HOLD_COMMAND)) })

  /** 인사: 서 있고 꼬리 흔들기가 있으면 한 번 흔들고, 위 안내 자리에 인사 → 체고 비교 */
  const startIntro = () => {
    animatorRef.current?.greet()
    setIntro('hello')
  }
  // 처음 놓는 순간 (다시 놓기 때는 안 한다)
  useEffect(() => {
    if (!dogReady || greetedRef.current.ar) return
    greetedRef.current.ar = true
    animatorRef.current?.greet()
    setIntro('hello')
  }, [dogReady])
  /** 화면 안 3D 로 처음 볼 때도 같은 인사 (한 번) */
  const startPreview = () => {
    setShowGuide(false)
    if (greetedRef.current.preview) return
    greetedRef.current.preview = true
    startIntro()
  }
  /** 아직 어린 유기견 (다 자라면 크기가 달라진다): 등장 연출에서 체고 다음에 한 번 */
  const puppy = isLikelyPuppy(pet.birthYear)
  useEffect(() => {
    if (!intro) return
    const next = intro === 'hello' ? 'height' : intro === 'height' && puppy ? 'puppy' : null
    const timer = window.setTimeout(() => setIntro(next), intro === 'puppy' ? INTRO_PUPPY_MS : INTRO_STEP_MS)
    return () => window.clearTimeout(timer)
  }, [intro, puppy])

  /** 마무리 카드를 띄운다 (한 번 보면 닫기가 바로 나가기) */
  const openCard = (mode: 'complete' | 'exit') => {
    cardSeenRef.current = true
    setCard(mode)
  }
  /** 닫기(X): 마무리 카드를 아직 안 봤으면 한 번 보여 주고, 봤으면 나간다 */
  const closeAr = () => {
    if (cardSeenRef.current) onBack()
    else openCard('exit')
  }

  /** 다시 놓기: 개를 숨기고 바닥 원으로 돌아간다 (예약은 버린다) */
  const replaceDog = () => {
    setActiveCommand(null)
    setTrayOpen(false)
    setInfoOpen(false)
    animatorRef.current?.cancelReserved()
    placement.replace()
  }

  // 개를 누른 채 3초 → 빵(죽은 척, '빵!' 명령과 같다: 서 있지 않으면 일어난 뒤). 그 뒤 손을 떼도 탭 반응은 내지 않는다 (onPointerUp).
  // 예전의 '꼬리 흔들기' 칩 3초(짖기)는 없앴다: 그 칩은 이제 명령 클립이 없는 모델에만 있고, 그런 모델에는 짖기 클립도 없다
  const dogHold = useLongPress<ReactPointerEvent>({
    enabled: hasCommands,
    slopPx: TAP_SLOP_PX,
    canStart: (event) => {
      const mv = mvRef.current
      return event.target === mv && !!mv?.positionAndNormalFromPoint(event.clientX, event.clientY)
    },
    onLongPress: () => holdDog(),
  })

  // 말 걸기 (음성 명령). 놓기 전·산책 중에는 막혀 듣던 것도 조용히 멈춘다. 같은 말을 다시 해도 예약은 그대로 (취소는 칩으로)
  const voice = useVoiceCommand({
    inAr,
    disabled: arLocked || walking,
    onCommand: (id) => stamp({ type: 'voiceCommand', accepted: accepted(runCommand(id)) }),
    onMiss: puzzledReaction,
  })
  // 듣기 시작하면 개가 사용자를 바라본다
  const gazeTriggerRef = useRef(gaze.trigger)
  useEffect(() => {
    gazeTriggerRef.current = gaze.trigger
  })
  useEffect(() => {
    if (voice.listening) gazeTriggerRef.current('mic')
  }, [voice.listening])

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

  /**
   * 산책: 반응·짖기·손 줘 중이면 끊고, 앉거나 엎드려 있으면 일어난 뒤 ('일어나서 같이 걸을게요'), 빵·구르기·자세 전환·몸 돌리기 중이면
   * 예약하고 끝나면 출발한다 (다시 누르면 예약 취소). 스스로 앉은 개도 같다
   */
  const startWalk = () => {
    setTrayOpen(false)
    const animator = animatorRef.current
    if (!animator || !walk.available) return
    gaze.userCommand()
    const result = animator.walk({
      onBegin: (from) => setWalkPrep(from !== 'stand'),
      onReady: () => {
        setWalkPrep(false)
        walkStartRef.current()
      },
      onCancel: () => setWalkPrep(false),
    })
    if (result === 'unreserved') setWalkPrep(false)
  }

  /**
   * '산책' 버튼: AR 에서 걷기 클립이 있는 개만 (화면 안 3D·아이폰은 산책이 없다).
   * 놓기 전에는 자리만 잡아 두고(눌리지 않음), 놓은 뒤에는 늘 눌린다
   */
  const hasWalkButton = inAr && hasWalkClips && (placement.walkHost !== null || !dogReady)
  const walkButton = hasWalkButton ? { onStart: startWalk, disabled: !walk.available } : null

  // 발도장: 이 개·이 화면에서 할 수 있는 것만 보이고, 남은 것 중 첫 번째를 권한다
  const paws = pawsFor({ tap: canTap, hold: hasCommands, talk: hasCommands && voice.supported, walk: hasWalkButton })
  const nextPawId = nextPaw(paws, pawsDone)
  const pawsComplete = allPawsDone(paws, pawsDone)
  // 산책 = 개가 실제로 한 번 걸음 (walk_start 부터)
  useEffect(() => {
    stamp({ type: 'walkPhase', phase: walk.phase })
  }, [walk.phase, stamp])
  const openCardRef = useRef(openCard)
  useEffect(() => {
    openCardRef.current = openCard
  })
  // 다 모으면: 개가 쉴 때(산책·명령·몸 돌리기가 끝난 뒤) 한 번 짖고 꼬리를 흔든 다음 마무리 카드
  useEffect(() => {
    if (!pawsComplete || celebrated || walking || animBusy || gaze.turning) return
    const timer = window.setTimeout(() => {
      setCelebrated(true)
      const done = animatorRef.current?.celebrate() ?? Promise.resolve()
      void done.then(() => {
        if (!cardSeenRef.current) openCardRef.current('complete')
      })
    }, CELEBRATE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [pawsComplete, celebrated, walking, animBusy, gaze.turning])

  /** 위 안내 한 줄 (우선순위는 pickHint) */
  const hint = pickHint({
    placement: arLocked ? placementHint(placement) : null,
    near: near.hint ? NEAR_HINT_TEXT : null,
    walk: walking ? walkHint(walk) : null,
    // 막힌 입력의 까닭: 예약 > 일어나서 산책 > 같은 자세 > 물러나면 돌아봄
    notice: reserved
      ? NOTICE_TEXT.reserved
      : walkPrep
        ? NOTICE_TEXT.standToWalk
        : samePose
          ? SAME_POSE_TEXT[samePose.pose]
          : gaze.stepBack && follow
            ? NOTICE_TEXT.stepBack
            : null,
    intro:
      intro === 'hello'
        ? INTRO_TEXT.hello(pet.kindName)
        : intro === 'height'
          ? INTRO_TEXT.height(withersCm)
          : intro === 'puppy'
            ? PUPPY_NOTICE
            : null,
    follow: followNotice ? FOLLOW_NOTICE[followNotice.on ? 'on' : 'off'] : null,
    paw: nextPawId && !arLocked ? PAW_HINT[nextPawId] : null,
    pose: hasCommands
      ? `${POSE_LABEL[pose]} · ${POSE_HINT.commands}`
      : inAr
        ? POSE_HINT.wagInAr
        : tapIsHeadTilt
          ? POSE_HINT.tapHeadTilt
          : POSE_HINT.tapWag,
  })

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
          onLongPress={holdDog}
          onPlaceTap={placement.place}
          locked={walking}
        />
        {/* ?debug 상자는 오버레이보다 앞(아래)에 둬 버튼·트레이를 가리지 않는다 */}
        {import.meta.env.DEV && <ArHitDebug mvRef={mvRef} arStatus={arStatus} placement={hitDebug} />}
        <ReactionBubble mvRef={mvRef} reaction={reaction} />
        <div
          ref={topOverlayRef}
          className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-3 pt-[calc(12px+env(safe-area-inset-top))]">
          <ArTopBar
            inAr={inAr}
            onClose={closeAr}
            name={pet.displayName}
            withersCm={withersCm}
            onOpenInfo={() => setInfoOpen(true)}
            follow={gaze.canFollow && dogReady ? { on: follow, onToggle: toggleFollow } : null}
            petId={pet.id}
            favorited={pet.favorited}
          />
          <ArPawPrints paws={paws} done={pawsDone} />
          <p aria-live="polite" className="text-center text-body text-on-dark [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
            {hint}
          </p>
          {stuck && (
            <p className="text-center text-label text-on-dark-secondary [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
              {AR_TEXT.stuck}
            </p>
          )}
          {arLocked && placement.phase === 'preparing' && placement.notice !== 'tiltDown' && <MoveSideways />}
          {arFailed && (
            <p role="alert" className="rounded-input bg-overlay px-3 py-2 text-label text-on-dark">
              {AR_TEXT.arFailed}
            </p>
          )}
        </div>

        <div
          ref={bottomOverlayRef}
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
          {walking ? (
            // 산책 중: 아래 버튼 대신 '산책 끝' 하나 (걷는 중이면 다음 걸음 끝에서 멈춘 뒤 끝난다)
            <button
              type="button"
              onClick={walk.end}
              disabled={walk.ending}
              className="pointer-events-auto flex h-12 w-full items-center justify-center gap-2 rounded-full bg-measure text-emphasis font-bold text-ink transition active:scale-97 disabled:opacity-60"
            >
              <Footprints className="size-5" strokeWidth={2.2} aria-hidden />
              {walk.ending ? AR_TEXT.walkEnding : AR_TEXT.walkEnd}
            </button>
          ) : (
            <>
              {import.meta.env.DEV && debug && hasCommands && <VoiceLogDebug />}
              <ArControls
                hasCommands={hasCommands}
                talk={hasCommands && voice.supported ? voice : null}
                talkDisabled={arLocked}
                trayOpen={trayOpen}
                onToggleTray={() => setTrayOpen((open) => !open)}
                tricksDisabled={!loaded || arLocked}
                commandsDisabled={!loaded || arLocked}
                active={activeCommand}
                reserved={reserved}
                pose={pose}
                onCommand={(id) => runCommand(id, { toggle: true })}
                onWag={wagReaction}
                wagDisabled={!loaded || arLocked}
                walk={walkButton}
                highlight={nextPawId && !arLocked ? (PAW_BUTTON[nextPawId] ?? null) : null}
              />
            </>
          )}

          {!inAr &&
            (canAr ? (
              <button
                type="button"
                onClick={startAr}
                className={buttonStyles({ variant: 'measure', size: 'xl', fullWidth: true, className: 'pointer-events-auto' })}
              >
                <Box className="size-5" strokeWidth={2} aria-hidden />
                {AR_TEXT.placeOnFloor}
              </button>
            ) : (
              loaded && (
                <p className="rounded-input bg-overlay px-3 py-2.5 text-center text-label text-on-dark-secondary">
                  {AR_TEXT.noArTouch}
                  {!isTouchDevice() && AR_TEXT.noArDesktop}
                </p>
              )
            ))}
        </div>

        {infoOpen && (
          <ArInfoSheet
            pet={pet}
            withersCm={withersCm}
            onClose={() => setInfoOpen(false)}
            onReplace={canReplace ? replaceDog : null}
            onResetFloor={showFloorReset ? placement.resetFloor : null}
          />
        )}
        {card && (
          <ArFinishCard
            mode={card}
            name={pet.kindName}
            careName={pet.careName}
            careTel={pet.careTel}
            petId={pet.id}
            favorited={pet.favorited}
            onClose={card === 'exit' ? onBack : () => setCard(null)}
          />
        )}
        <HoldRing at={dogHold.press} durationMs={LONG_PRESS_MS} />
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
          onPreview={startPreview}
          // AR 안에서 권한 창이 뜨지 않게 여기서 미리 (음성이 되고 아직 정하지 않았을 때만, 건너뛸 수 있음)
          mic={
            loaded && hasCommands && voice.supported && voice.permission === 'prompt'
              ? { onAllow: () => void voice.askPermission() }
              : null
          }
        />
      )}
    </div>
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
  mic,
}: {
  pet: PetDetail
  withersCm: number
  onBack: () => void
  progress: number
  loaded: boolean
  canAr: boolean
  onStart: () => void
  onPreview: () => void
  /** 마이크 권한을 미리 받는 줄 (음성이 되고 권한을 아직 정하지 않았을 때). 아니면 null */
  mic: { onAllow: () => void } | null
}) {
  const steps = [
    ['밝은 곳에서 바닥을 비춰요', '유기견이 지낼 거실이나 방의 넓고 평평한 바닥이 좋아요.'],
    ['유기견이 바닥에 놓여요', '실제 크기로 고정돼서 가까이 가도 멀어져도 크기는 그대로예요.'],
    ['유기견에게 말을 걸어 보세요', '말 걸기나 묘기를 누르면 움직여요. 소파 옆, 현관 앞에도 놓아 보세요.'],
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
        {mic && (
          <div className="mb-2.5 flex items-center gap-2.5 rounded-input bg-muted py-1 pr-1 pl-3.5">
            <Mic className="size-4.5 shrink-0 text-ink-tertiary" strokeWidth={2} aria-hidden />
            <p className="flex-1 text-label text-ink-secondary">{AR_TEXT.micAsk}</p>
            <button
              type="button"
              onClick={mic.onAllow}
              className="h-11 shrink-0 rounded-full bg-surface px-4 text-label font-semibold text-ink active:scale-97"
            >
              {AR_TEXT.micAllow}
            </button>
          </div>
        )}
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
 * ?closesit=1 (가까이 붙으면 스스로 앉아 올려다봄, 기본 끔) · ?follow=0 ('따라보기' 꺼짐으로 시작). 없거나 숫자가 아니면 기본값
 */
function readGazeOptions(params: URLSearchParams): { enabled: boolean; tuning: GazeTuning; follow: boolean } {
  const read = numberParam(params)
  return {
    enabled: params.get('gaze') !== '0',
    follow: params.get('follow') !== '0',
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
