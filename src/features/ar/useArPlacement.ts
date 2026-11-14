import type { ModelViewerElement } from '@google/model-viewer'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { ModelViewerArStage } from './modelViewerArStage'
import { PlacementController, type BlockReason, type PlacementPhase } from './placement/placementController'
import { requestDepthWithArSessions } from './xrDepthRequest'

export interface ArPlacement {
  /** off: AR 밖 (화면 안 3D, 아이폰 Quick Look 포함) */
  phase: PlacementPhase | 'off'
  /**
   * 사용자가 원을 보고 탭해서 놓는 흐름인지.
   * false 면 model-viewer 기본 흐름(바닥을 찾으면 스스로 착지)이다: 내부를 못 찾았거나(버전이 바뀜) hit-test 를 못 쓸 때
   */
  manual: boolean
  /** 바닥(수평면)을 한 번이라도 찾았는지 */
  floorKnown: boolean
  /** blocked 일 때 까닭 (occluded: 바닥 앞에 실제 물체) */
  blockedBy: BlockReason | null
  /** ?debug 일 때 바닥 높이·맞은 점·판정·yaw */
  debugLines: string[]
  /** 화면 탭. 놓을 수 있을 때만 놓고 true (?debug 에서는 빨간 원을 두 번 탭하면 강제로 놓는다) */
  place: () => boolean
  /** 다시 놓기 */
  replace: () => void
  /** 바닥 다시 찾기 (?debug 버튼): 바닥 추정을 처음부터 */
  resetFloor: () => void
}

interface PlacementState {
  phase: PlacementPhase | 'off'
  manual: boolean
  floorKnown: boolean
  blockedBy: BlockReason | null
}

/** ?debug 강제 놓기: 빨간 원에서 이 시간(ms) 안에 두 번 탭 */
const FORCE_DOUBLE_TAP_MS = 400

const OFF: PlacementState = { phase: 'off', manual: false, floorKnown: false, blockedBy: null }

/**
 * WebXR(안드로이드 Chrome) AR 에서 개를 사용자가 놓을 때까지 숨기고, 바닥 원을 보이다가 탭하면 놓는다.
 * 아이폰 Quick Look 은 이 페이지 밖에서 열려 ar-status 가 오지 않고, 화면 안 3D 는 'off' 그대로라 바뀌는 것이 없다
 */
export function useArPlacement(mvRef: RefObject<ModelViewerElement | null>, { debug }: { debug: boolean }): ArPlacement {
  const [state, setState] = useState<PlacementState>(OFF)
  const [debugLines, setDebugLines] = useState<string[]>([])
  const controllerRef = useRef<PlacementController | null>(null)
  // 세션 중에 ?debug 를 바꾸면 다음 세션부터 적용된다
  const debugRef = useRef(debug)
  useEffect(() => {
    debugRef.current = debug
  }, [debug])

  // AR 세션을 열 때 깊이 센서도 요청한다 (이 화면에 있는 동안만)
  useEffect(() => requestDepthWithArSessions(), [])

  useEffect(() => {
    const mv = mvRef.current
    if (!mv) return

    const stop = () => {
      controllerRef.current?.dispose()
      controllerRef.current = null
    }

    /** 직접 놓기를 못 할 때: 개를 보이고 model-viewer 가 스스로 바닥에 놓게 둔다 */
    const fallBack = () => {
      stop()
      setState({
        phase: mv.getAttribute('ar-status') === 'object-placed' ? 'placed' : 'searching',
        manual: false,
        floorKnown: false,
        blockedBy: null,
      })
    }

    // ar-status 는 model-viewer 가 그 자리에서 바로 보내서, React 상태를 거치지 않고 여기서 받아야 첫 프레임 전에 개를 숨길 수 있다
    const onStatus = (event: Event) => {
      const status = (event as CustomEvent<{ status: string }>).detail.status
      if (status === 'session-started') {
        // 다시 들어온 때도 처음부터
        stop()
        setDebugLines([])
        const stage = ModelViewerArStage.attach(mv)
        if (!stage) {
          fallBack()
          return
        }
        const controller = new PlacementController(stage, {
          onChange: ({ phase, floorKnown, blockedBy }) => setState({ phase, manual: true, floorKnown, blockedBy }),
          onUnavailable: (reason) => {
            if (import.meta.env.DEV) console.warn('[ar] 직접 놓기를 못 해 자동 착지로 둔다:', reason)
            if (controllerRef.current === controller) fallBack()
          },
          onDebug: debugRef.current ? setDebugLines : undefined,
        })
        controllerRef.current = controller
        controller.start()
      } else if (status === 'object-placed') {
        // 직접 놓기에서는 우리가 놓을 때 보내는 알림이라 무시한다. 기본 흐름에서는 착지한 것
        if (!controllerRef.current) setState((previous) => (previous.manual ? previous : { ...previous, phase: 'placed' }))
      } else {
        // not-presenting, failed
        stop()
        setState(OFF)
      }
    }

    mv.addEventListener('ar-status', onStatus)
    return () => {
      mv.removeEventListener('ar-status', onStatus)
      stop()
    }
  }, [mvRef])

  // ?debug 에서만: 빨간 원에서 두 번 탭하면 강제로 놓는다 (판정과 상관없이 놓인 모습을 보려고)
  const lastBlockedTapRef = useRef(0)
  const place = useCallback(() => {
    const controller = controllerRef.current
    if (!controller) return false
    if (controller.place()) return true
    if (!debugRef.current) return false
    const now = performance.now()
    if (now - lastBlockedTapRef.current < FORCE_DOUBLE_TAP_MS) {
      lastBlockedTapRef.current = 0
      return controller.place({ force: true })
    }
    lastBlockedTapRef.current = now
    return false
  }, [])
  const replace = useCallback(() => controllerRef.current?.replace(), [])
  const resetFloor = useCallback(() => controllerRef.current?.resetFloor(), [])

  return { ...state, debugLines, place, replace, resetFloor }
}
