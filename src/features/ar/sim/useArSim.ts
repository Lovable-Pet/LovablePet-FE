import type { ModelViewerElement } from '@google/model-viewer'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { SimSession, type SimHosts, type SimView } from './simSession'
import { dragUser, NO_KEYS, type SimKeys, type SimUser } from './simUser'

// 개발용 PC 시뮬레이션(?sim=1, 화면 안 3D) 훅. ArPage 가 import.meta.env.DEV 일 때만 이 훅을 쓴다 (배포 빌드에서는 빠진다).
// 키: WASD 이동 · Shift 느리게 · Q/E·마우스 드래그 방향 · R/F 폰 높이 · L 아래 층 · Tab 1인칭/3인칭 · 1~6 개 바꾸기 · H 도움말

export interface ArSim {
  /** 시뮬레이션이 돌고 있다 (개를 원점에 놓음) */
  active: boolean
  walkHost: SimHosts['walkHost']
  gazeHost: SimHosts['gazeHost']
  nearHost: SimHosts['nearHost']
  view: SimView
  help: boolean
  /** 폰 높이 (m, 사용자 바닥 기준) · 아래 층 */
  eye: number
  lower: boolean
  /** 겹쳐 그리는 캔버스 (발자취·쓸고 지나가는 자리·사용자) */
  setCanvas: (canvas: HTMLCanvasElement | null) => void
}

export interface ArSimOptions {
  enabled: boolean
  /** 폰(눈) 높이 처음 값 (m, ?simeye) */
  eye: number
  gazeEnabled: boolean
  /** 숫자 키 1~6 */
  onSwitchDog: (index: number) => void
}

const HOST_NONE: SimHosts = { walkHost: null, gazeHost: null, nearHost: null }
/** 드래그와 탭을 가르는 거리 (ArPage TAP_SLOP_PX 와 같게) */
const DRAG_SLOP_PX = 8
/** 화면 표시(폰 높이 등)를 읽는 간격 (ms) */
const STATUS_MS = 200

const KEY_OF: Record<string, keyof SimKeys> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  ShiftLeft: 'slow',
  ShiftRight: 'slow',
  KeyQ: 'turnLeft',
  KeyE: 'turnRight',
  KeyR: 'up',
  KeyF: 'down',
}

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')

/** 헤드리스 시험용 손잡이 (window.__arSim) */
export interface ArSimTestHandle {
  user(): SimUser
  setUser(partial: Partial<SimUser>): void
  setKeys(partial: Partial<SimKeys>): void
  setView(view: SimView): void
  dog(): SimSession['dog']
  hosts(): { walk: boolean; gaze: boolean; near: boolean }
}

export function useArSim(mvRef: RefObject<ModelViewerElement | null>, options: ArSimOptions): ArSim {
  const { enabled, eye, gazeEnabled } = options
  const sessionRef = useRef<SimSession | null>(null)
  const [hosts, setHosts] = useState<SimHosts>(HOST_NONE)
  const [active, setActive] = useState(false)
  const [status, setStatus] = useState({ view: 'first' as SimView, eye, lower: false })
  const [help, setHelp] = useState(true)
  const switchRef = useRef(options.onSwitchDog)
  useEffect(() => {
    switchRef.current = options.onSwitchDog
  })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const mv = mvRef.current
    if (!enabled || !mv) return
    const session = SimSession.start(mv, { eye, gazeEnabled, onHosts: (next) => setHosts({ ...next }) })
    if (!session) {
      console.warn('[sim] model-viewer 내부 모양이 달라 시뮬레이션을 못 켠다')
      return
    }
    sessionRef.current = session
    session.setCanvas(canvasRef.current)
    setActive(true)
    const keys: SimKeys = { ...NO_KEYS }
    const readStatus = () =>
      setStatus((previous) => {
        const next = { view: session.view, eye: Math.round(session.user.eye * 100) / 100, lower: session.user.lower }
        return previous.view === next.view && previous.eye === next.eye && previous.lower === next.lower ? previous : next
      })
    const onKeyDown = (event: KeyboardEvent) => {
      if (typing(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      const key = KEY_OF[event.code]
      if (key) {
        keys[key] = true
        session.keys = { ...keys }
        return
      }
      if (event.repeat) return
      if (event.code === 'Tab') {
        event.preventDefault()
        session.view = session.view === 'first' ? 'third' : 'first'
      } else if (event.code === 'KeyL') session.setUser({ ...session.user, lower: !session.user.lower })
      else if (event.code === 'KeyH') setHelp((value) => !value)
      else if (/^Digit[1-6]$/.test(event.code)) switchRef.current(Number(event.code.slice(5)))
      else return
      readStatus()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const key = KEY_OF[event.code]
      if (!key) return
      keys[key] = false
      // Shift 를 둘 다 뗐는지는 모른다: 왼쪽·오른쪽 따로 세지 않고 떼면 끈다
      session.keys = { ...keys }
    }
    const onBlur = () => {
      Object.assign(keys, NO_KEYS)
      session.keys = { ...keys }
    }
    // 마우스 드래그: 방향 (가로)·위아래 보기 (세로). 탭과 꾹 누르기는 ArPage 가 따로 본다
    let drag: { x: number; y: number; moving: boolean } | null = null
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === mv) drag = { x: event.clientX, y: event.clientY, moving: false }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!drag) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (!drag.moving && Math.hypot(dx, dy) <= DRAG_SLOP_PX) return
      drag = { x: event.clientX, y: event.clientY, moving: true }
      session.setUser(dragUser(session.user, dx, dy))
    }
    const onPointerUp = () => {
      drag = null
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    mv.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    const timer = window.setInterval(readStatus, STATUS_MS)
    const handle: ArSimTestHandle = {
      user: () => ({ ...session.user }),
      setUser: (partial) => session.setUser({ ...session.user, ...partial }),
      setKeys: (partial) => {
        Object.assign(keys, partial)
        session.keys = { ...keys }
      },
      setView: (view) => {
        session.view = view
      },
      dog: () => ({ position: { ...session.dog.position }, yaw: session.dog.yaw }),
      hosts: () => ({ walk: !!session.hosts.walkHost, gaze: !!session.hosts.gazeHost, near: !!session.hosts.nearHost }),
    }
    ;(window as unknown as { __arSim?: ArSimTestHandle }).__arSim = handle
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      mv.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      window.clearInterval(timer)
      const holder = window as unknown as { __arSim?: ArSimTestHandle }
      if (holder.__arSim === handle) delete holder.__arSim
      session.dispose()
      if (sessionRef.current === session) sessionRef.current = null
      setHosts(HOST_NONE)
      setActive(false)
    }
  }, [enabled, eye, gazeEnabled, mvRef])

  const setCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
    sessionRef.current?.setCanvas(canvas)
  }, [])

  return {
    active,
    walkHost: active ? hosts.walkHost : null,
    gazeHost: active ? hosts.gazeHost : null,
    nearHost: active ? hosts.nearHost : null,
    view: status.view,
    help,
    eye: status.eye,
    lower: status.lower,
    setCanvas,
  }
}
