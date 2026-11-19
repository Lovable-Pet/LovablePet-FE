// model-viewer 는 AR(WebXR) 세션을 optionalFeatures ['hit-test', 'dom-overlay', 'light-estimation'] 로만 요청한다.
// 깊이 센서(depth-sensing)를 함께 받으려고 navigator.xr.requestSession 을 감싼다. mode 가 'immersive-ar' 일 때만 바꾼다.
// - model-viewer 가 넘긴 나머지 옵션(domOverlay 등)은 그대로 둔다
// - depth-sensing 은 optional 이라, 깊이를 못 쓰는 기기에서는 빠진 채로 세션이 열린다
// - 깊이 옵션 때문에 요청이 실패하면 원래 옵션으로 한 번 더 요청한다 (권한 거부는 다시 묻지 않는다)
// - 열린 세션의 enabledFeatures 에서 depth-sensing 을 three.js 에게 숨긴다 (hideDepthFromThree)
// 아이폰(navigator.xr 없음)·Scene Viewer·화면 안 3D 는 이 요청을 하지 않아 바뀌는 것이 없다

/** 화면 가운데·둘레 몇 점만 CPU 에서 읽는다. 형식은 브라우저가 고른다 (luminance-alpha: mm 정수, float32: m) */
const DEPTH_SENSING = {
  usagePreference: ['cpu-optimized'],
  dataFormatPreference: ['luminance-alpha', 'float32'],
}

interface SessionInit {
  optionalFeatures?: string[]
  depthSensing?: unknown
  [option: string]: unknown
}
interface XrSystemLike {
  requestSession(mode: string, init?: SessionInit): Promise<unknown>
}

const isPermissionError = (error: unknown) =>
  error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')

/** 깊이를 받은 세션의 실제 enabledFeatures (three.js 에게는 depth-sensing 을 뺀 목록이 보인다) */
const realFeatures = new WeakMap<object, readonly string[]>()

/**
 * three 0.172 의 WebXRManager 는 session.enabledFeatures 에 'depth-sensing' 이 있으면 매 프레임
 * XRWebGLBinding.getDepthInformation 을 부른다. 그런데 XRWebGLBinding 은 'layers' 를 받았을 때만 만들어서
 * (model-viewer 는 요청하지 않는다) null 에서 예외가 나고, 그 뒤로 XR 그리기 루프가 다시 등록되지 않아 AR 이 멈춘다.
 * 그래서 이 세션 객체에만 depth-sensing 을 뺀 enabledFeatures 를 덮어씌우고, 실제 목록은 따로 둔다.
 * enabledFeatures 를 읽는 곳은 three 의 이 두 군데(layers, depth-sensing)뿐이다
 */
function hideDepthFromThree(session: unknown) {
  if (typeof session !== 'object' || session === null) return
  const features: unknown = (session as { enabledFeatures?: unknown }).enabledFeatures
  if (!Array.isArray(features) || !features.includes('depth-sensing')) return
  const real = Object.freeze(features.filter((feature): feature is string => typeof feature === 'string'))
  realFeatures.set(session, real)
  const visible = Object.freeze(real.filter((feature) => feature !== 'depth-sensing'))
  Object.defineProperty(session, 'enabledFeatures', { configurable: true, get: () => visible })
}

/** 세션이 실제로 받은 기능. 브라우저가 enabledFeatures 를 주지 않으면 undefined */
export function enabledFeaturesOf(session: object): readonly string[] | undefined {
  const real = realFeatures.get(session)
  if (real) return real
  const features: unknown = (session as { enabledFeatures?: unknown }).enabledFeatures
  return Array.isArray(features) ? features.filter((feature): feature is string => typeof feature === 'string') : undefined
}

/** AR 세션을 요청할 때 깊이 센서도 함께 요청하게 한다. 되돌리는 함수를 돌려준다 */
export function requestDepthWithArSessions(): () => void {
  const xr = (navigator as Navigator & { xr?: unknown }).xr
  if (typeof xr !== 'object' || xr === null || typeof (xr as Partial<XrSystemLike>).requestSession !== 'function') {
    return () => {}
  }
  const system = xr as XrSystemLike
  const original = system.requestSession
  const hadOwn = Object.prototype.hasOwnProperty.call(system, 'requestSession')

  const wrapped = (mode: string, init?: SessionInit) => {
    if (mode !== 'immersive-ar') return original.call(system, mode, init)
    const optional = init?.optionalFeatures ?? []
    const withDepth: SessionInit = {
      ...init,
      optionalFeatures: optional.includes('depth-sensing') ? optional : [...optional, 'depth-sensing'],
      depthSensing: init?.depthSensing ?? DEPTH_SENSING,
    }
    return original.call(system, mode, withDepth).then(
      (session) => {
        hideDepthFromThree(session)
        return session
      },
      (error: unknown) => {
        if (isPermissionError(error)) throw error
        if (import.meta.env.DEV) console.warn('[ar] 깊이 센서를 넣은 AR 세션 요청이 실패해 원래 옵션으로 다시 요청한다:', error)
        return original.call(system, mode, init)
      },
    )
  }

  system.requestSession = wrapped
  return () => {
    if (system.requestSession !== wrapped) return
    if (hadOwn) system.requestSession = original
    else delete (system as Partial<XrSystemLike>).requestSession
  }
}
