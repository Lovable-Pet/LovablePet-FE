import {
  AlwaysDepth,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  FloatType,
  Matrix4,
  Mesh,
  NearestFilter,
  RedFormat,
  RGFormat,
  ShaderMaterial,
  UnsignedByteType,
} from 'three'

// 가림 시험 (개발용 주소 옵션 ?occlusion=1 · ?occlusion=raw 에서만. 배포 파일에는 들어가지 않는다: useArPlacement 가 DEV 에서만 불러온다).
// 실제 물체(벽 모서리·소파·책상 다리)가 개보다 앞에 있으면 개를 가린다.
// 매 프레임 읽는 CPU 깊이(cpu-optimized)를 텍스처로 올리고, 개보다 먼저 '깊이만 쓰는' 화면 전체 사각형을 그린다.
// 화면 픽셀마다 실제 물체까지 거리를 깊이 버퍼에 써 두면, 실제 물체가 더 가까운 곳에서 개가 깊이 테스트에 져서 안 그려진다.
//
// 두 방식 공통
// - 화면 픽셀 → 정규화 뷰 좌표(왼쪽 위 원점) → normDepthBufferFromNormView → 깊이 버퍼 좌표. 깊이는 카메라 정면 축 거리 (m)
// - 그 거리 + OCCLUSION_BIAS_M 를 XR 뷰의 투영 행렬로 창 깊이(0~1)로 바꿔 gl_FragDepth 에 쓴다 (색은 쓰지 않는다)
// - 깊이는 우리 프레임 콜백(model-viewer 가 그린 뒤)에서만 읽혀, 그린 결과는 한 프레임 늦은 깊이다
// - model-viewer 의 그림자 패스는 장면 전체를 overrideMaterial 로 그린다. 사각형 꼭짓점은 position 을 모두 0 으로 둬
//   그 패스에서는 넓이가 0 이라 아무것도 안 그려지고, 이 셰이더는 uv 로 화면 전체를 덮는다
//
// raw (?occlusion=raw, d6b8a0e 방식 그대로, 견주기용): 깊이 값을 그대로 올리고 칸 안은 한 값(Nearest). 바닥은 BIAS 로만 버틴다
// smooth (?occlusion=1)
// - 바닥 제외: 실제 점의 월드 높이가 바닥 + 문턱(OCCLUSION_FLOOR_IGNORE_M, ?ofloor) 아래면 가리지 않는다.
//   높이는 깊이를 잰 그 프레임의 카메라(XR 뷰 포즈·투영 역행렬)로 푼다. 그리는 프레임(다음 프레임)의 카메라로 풀면
//   휴대폰을 숙이거나 드는 동안(프레임당 2°면 2m 앞 바닥이 7cm) 높이가 틀어져 바닥이 다시 올라온다.
//   대가: 문턱보다 낮은 물체(문턱·신발·전선)와 물체 맨 아래 문턱 높이 띠는 개를 가리지 않는다
// - 계단 줄이기: CPU 에서 m 단위 실수로 바꿔 올리고, 셰이더가 둘레 4칸을 직접 읽어 bilinear 로 잇는다
//   (실수 텍스처 선형 필터 확장에 기대지 않는다). 깊이 0(없음) 칸은 빼고 남은 칸 가중치로 나눈다
// - 지글거림 줄이기: 칸마다 지난 값과 섞는다 (새 값 OCCLUSION_BLEND_NEW). 많이 바뀐 칸은 새 값 그대로라 움직이는 경계에 잔상이 없다

/** 실제 물체 깊이를 이만큼(m) 뒤로 밀어 쓴다 (바닥 잡음에 개 발·그림자가 가려지지 않게) */
export const OCCLUSION_BIAS_M = 0.05
/** 깊이가 이만큼(ms) 안 오면 가리지 않는다 (지난 깊이로 엉뚱한 곳을 가리지 않게) */
export const OCCLUSION_STALE_MS = 500
/** smooth: 실제 점이 바닥 + 이만큼(m) 아래면 가리지 않는다 (?ofloor 로 바꾼다, 0 이면 끔) */
export const OCCLUSION_FLOOR_IGNORE_M = 0.06
/** smooth: 칸마다 새 깊이 비율 (나머지는 지난 값) */
export const OCCLUSION_BLEND_NEW = 0.6
/** smooth: 새 깊이가 지난 값과 이만큼(m) 넘게 다르면 섞지 않고 새 값 그대로 */
export const OCCLUSION_BLEND_JUMP_M = 0.1
/** 개·그림자보다 먼저 그린다 */
const OCCLUSION_RENDER_ORDER = -1000
/** 바닥이라 빠진 칸 비율(디버그)은 이만큼 올릴 때마다 한 번 센다 */
const FLOOR_SHARE_EVERY = 6

/** smooth: 바닥 제외·bilinear·섞기 · raw: d6b8a0e 방식 (Nearest, 바닥 제외·섞기 없음) */
export type OcclusionMode = 'smooth' | 'raw'

export interface OccluderOptions {
  mode?: OcclusionMode
  /** smooth 의 바닥 제외 문턱 (m). 0 이면 바닥을 빼지 않는다 */
  floorIgnore?: number
}

/** 한 프레임의 CPU 깊이 (XRCPUDepthInformation 에서 그 프레임 안에 꺼낸 것) */
export interface CpuDepthFrame {
  time: number
  width: number
  height: number
  /** 깊이 버퍼. 그 프레임 안에서만 유효해 update 에서 바로 복사한다 */
  data: ArrayBuffer
  rawValueToMeters: number
  /** 정규화 뷰 좌표 → 정규화 깊이 버퍼 좌표 (열 우선 4x4) */
  normDepthBufferFromNormView: ArrayLike<number>
  /** float32: 4바이트 실수 · 그 밖(luminance-alpha 등): 2바이트 정수 */
  format: string | null
  /** 깊이를 잰 카메라: 그 프레임 XR 뷰의 포즈 (카메라 → 기준 공간, 열 우선 4x4) */
  cameraWorld: ArrayLike<number>
  /** 그 뷰의 투영 행렬 (열 우선 4x4) */
  projectionMatrix: ArrayLike<number>
  /** 지금 바닥 높이 (기준 공간 y: 놓은 개의 발, 놓기 전엔 원). 모르면 null 이고 바닥을 빼지 않는다 */
  floorY: number | null
}

/** 어댑터(ModelViewerArStage)가 장면에 넣고 매 프레임 깊이를 넘긴다 */
export interface StageOccluder {
  readonly mesh: Mesh
  update(depth: CpuDepthFrame): void
  /** 매 프레임: 깊이가 오래 안 왔으면 가리지 않는다 */
  tick(time: number): void
  /** 디버그 줄 */
  status(time: number): string[]
  dispose(): void
}

/**
 * smooth 의 칸 하나 섞기. 새 값이 없으면(0·NaN) 0, 지난 값이 없거나 OCCLUSION_BLEND_JUMP_M 넘게 다르면 새 값,
 * 아니면 새 값 OCCLUSION_BLEND_NEW + 지난 값 나머지
 */
export function blendDepth(previous: number, fresh: number): number {
  if (!(fresh > 0) || !Number.isFinite(fresh)) return 0
  if (!(previous > 0) || Math.abs(fresh - previous) > OCCLUSION_BLEND_JUMP_M) return fresh
  return previous + (fresh - previous) * OCCLUSION_BLEND_NEW
}

/**
 * 깊이로 실제 점의 월드 높이 (셰이더의 바닥 제외와 같은 식, CPU 쪽은 디버그 비율에 쓴다).
 * view 는 정규화 뷰 좌표(왼쪽 위 원점), meters 는 카메라 정면 축 거리. 앞을 안 보는 광선이면 null
 */
export function depthPointHeight(
  viewX: number,
  viewY: number,
  meters: number,
  cameraWorld: ArrayLike<number>,
  projectionInverse: ArrayLike<number>,
): number | null {
  const m = projectionInverse
  const nx = viewX * 2 - 1
  const ny = 1 - viewY * 2
  // 앞 평면(ndc z = -1) 위의 점을 카메라 공간으로
  const x = m[0] * nx + m[4] * ny - m[8] + m[12]
  const y = m[1] * nx + m[5] * ny - m[9] + m[13]
  const z = m[2] * nx + m[6] * ny - m[10] + m[14]
  const w = m[3] * nx + m[7] * ny - m[11] + m[15]
  if (w === 0) return null
  const rayZ = z / w
  if (!(rayZ < 0)) return null
  const scale = meters / -rayZ
  const px = (x / w) * scale
  const py = (y / w) * scale
  const pz = -meters
  const c = cameraWorld
  return c[1] * px + c[5] * py + c[9] * pz + c[13]
}

const VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`

/** d6b8a0e 그대로 */
const RAW_FRAGMENT = /* glsl */ `
uniform sampler2D depthMap;
uniform bool floatDepth;
uniform float rawToMeters;
uniform mat4 depthFromView;
uniform vec4 viewport;
uniform float projZ;
uniform float projW;
uniform float bias;

void main() {
  vec2 view = (gl_FragCoord.xy - viewport.xy) / viewport.zw;
  view.y = 1.0 - view.y;
  vec2 uv = (depthFromView * vec4(view, 0.0, 1.0)).xy;
  vec4 texel = texture2D(depthMap, uv);
  // 2바이트 정수는 RG 두 칸에 (아래 바이트, 위 바이트)
  float raw = floatDepth ? texel.r : texel.r * 255.0 + texel.g * 65280.0;
  float meters = raw * rawToMeters;
  if (meters <= 0.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragDepth = 1.0;
    return;
  }
  float d = meters + bias;
  // 보기 공간 z = -d 를 투영: clip.z = projZ * (-d) + projW, clip.w = d
  float ndc = (projZ * -d + projW) / d;
  gl_FragDepth = clamp(ndc * 0.5 + 0.5, 0.0, 1.0);
}`

/** 깊이는 m 단위 실수 (0 은 없음). texelFetch 로 둘레 4칸을 읽어 직접 잇는다 */
const SMOOTH_FRAGMENT = /* glsl */ `
uniform sampler2D depthMap;
uniform mat4 depthFromView;
uniform vec4 viewport;
uniform float projZ;
uniform float projW;
uniform float bias;
uniform bool floorOn;
uniform float floorLimit;
uniform mat4 depthCameraWorld;
uniform mat4 depthProjectionInverse;

float cell(ivec2 at, ivec2 size) {
  return texelFetch(depthMap, clamp(at, ivec2(0), size - 1), 0).r;
}

void main() {
  // 뷰포트 안 0~1 (아래 왼쪽 원점)
  vec2 screen = (gl_FragCoord.xy - viewport.xy) / viewport.zw;
  vec2 uv = (depthFromView * vec4(screen.x, 1.0 - screen.y, 0.0, 1.0)).xy;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragDepth = 1.0;
    return;
  }
  ivec2 size = textureSize(depthMap, 0);
  // 칸 가운데가 정수 자리에 오게
  vec2 p = uv * vec2(size) - 0.5;
  vec2 base = floor(p);
  vec2 f = p - base;
  ivec2 at = ivec2(base);
  vec4 d = vec4(cell(at, size), cell(at + ivec2(1, 0), size), cell(at + ivec2(0, 1), size), cell(at + ivec2(1, 1), size));
  // 깊이 없는 칸은 가중치 0
  vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y) * step(1e-4, d);
  float total = w.x + w.y + w.z + w.w;
  if (total <= 1e-6) {
    gl_FragDepth = 1.0;
    return;
  }
  float meters = dot(w, d) / total;
  if (floorOn) {
    // 깊이를 잰 카메라로 이 픽셀 광선을 풀어 실제 점의 월드 높이를 구한다
    vec4 near = depthProjectionInverse * vec4(screen * 2.0 - 1.0, -1.0, 1.0);
    vec3 ray = near.xyz / near.w;
    if (ray.z < 0.0) {
      float height = (depthCameraWorld * vec4(ray * (meters / -ray.z), 1.0)).y;
      if (height < floorLimit) {
        gl_FragDepth = 1.0;
        return;
      }
    }
  }
  float z = meters + bias;
  float ndc = (projZ * -z + projW) / z;
  gl_FragDepth = clamp(ndc * 0.5 + 0.5, 0.0, 1.0);
}`

interface CameraLike {
  projectionMatrix?: { elements: ArrayLike<number> }
  /** XR 뷰 카메라만 있다 (프레임 버퍼 픽셀) */
  viewport?: { x: number; y: number; z: number; w: number }
}

export class DepthOccluder implements StageOccluder {
  readonly mesh: Mesh
  readonly mode: OcclusionMode
  /** 바닥 제외 문턱 (m). 0 이면 끔 (raw 는 늘 없음) */
  readonly floorIgnore: number
  private readonly geometry: BufferGeometry
  private readonly material: ShaderMaterial
  private texture: DataTexture | null = null
  /** raw: 깊이 값 그대로 (2바이트 정수는 바이트 둘) · smooth: 섞은 깊이 (m, 0 은 없음) */
  private cells: Uint8Array | Float32Array | null = null
  private width = 0
  private height = 0
  /** f: 4바이트 실수 · i: 2바이트 정수 */
  private kind = ''
  private lastAt = -Infinity
  private frames = 0
  private uploadMs = 0
  /** 깊이 칸 하나가 화면에서 몇 픽셀인지 (가로, 세로) */
  private cellPx: [number, number] | null = null
  private floorY: number | null = null
  /** 깊이 있는 칸 중 바닥이라 빠진 칸 비율 (디버그). 바닥을 모르거나 끄면 null */
  private floorShare: number | null = null
  private readonly scratch = new Matrix4()

  constructor({ mode = 'smooth', floorIgnore = OCCLUSION_FLOOR_IGNORE_M }: OccluderOptions = {}) {
    this.mode = mode
    this.floorIgnore = mode === 'smooth' && floorIgnore > 0 ? floorIgnore : 0
    const geometry = new BufferGeometry()
    // position 은 모두 0 (그림자 패스처럼 overrideMaterial 로 그리면 넓이 0), 화면 위치는 uv 로
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(18), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 2))
    const common = {
      depthMap: { value: null },
      depthFromView: { value: new Float32Array(16) },
      viewport: { value: new Float32Array([0, 0, 1, 1]) },
      projZ: { value: -1 },
      projW: { value: -0.2 },
      bias: { value: OCCLUSION_BIAS_M },
    }
    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: mode === 'raw' ? RAW_FRAGMENT : SMOOTH_FRAGMENT,
      uniforms:
        mode === 'raw'
          ? { ...common, floatDepth: { value: false }, rawToMeters: { value: 0 } }
          : {
              ...common,
              floorOn: { value: false },
              floorLimit: { value: 0 },
              depthCameraWorld: { value: new Float32Array(16) },
              depthProjectionInverse: { value: new Float32Array(16) },
            },
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      depthFunc: AlwaysDepth,
      side: DoubleSide,
    })
    const mesh = new Mesh(geometry, material)
    mesh.renderOrder = OCCLUSION_RENDER_ORDER
    mesh.frustumCulled = false
    mesh.visible = false
    mesh.userData.noHit = true
    mesh.raycast = () => {}
    // XR 뷰 카메라로 그릴 때만 그 뷰의 투영·뷰포트를 넣는다 (그림자 패스는 넓이 0 이라 상관없다)
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      const { projectionMatrix, viewport } = camera as CameraLike
      if (!projectionMatrix || !viewport) return
      const uniforms = material.uniforms
      const e = projectionMatrix.elements
      uniforms.projZ.value = e[10]
      uniforms.projW.value = e[14]
      const area = uniforms.viewport.value as Float32Array
      area[0] = viewport.x
      area[1] = viewport.y
      area[2] = viewport.z
      area[3] = viewport.w
      this.measureCells(viewport.z, viewport.w)
    }
    this.geometry = geometry
    this.material = material
    this.mesh = mesh
  }

  update(depth: CpuDepthFrame) {
    const started = performance.now()
    const float = depth.format === 'float32'
    const count = depth.width * depth.height
    // 형식과 길이가 맞지 않으면 (알 수 없는 형식) 올리지 않는다
    if (!(count > 0) || depth.data.byteLength < count * (float ? 4 : 2)) return
    const kind = float ? 'f' : 'i'
    if (!this.texture || depth.width !== this.width || depth.height !== this.height || kind !== this.kind) {
      this.allocate(depth.width, depth.height, float)
    }
    const cells = this.cells!
    const uniforms = this.material.uniforms
    let floorLimit: number | null = null
    if (this.mode === 'raw') {
      cells.set(float ? new Float32Array(depth.data, 0, count) : new Uint8Array(depth.data, 0, count * 2))
      uniforms.rawToMeters.value = depth.rawValueToMeters
    } else {
      const source = float ? new Float32Array(depth.data, 0, count) : new Uint16Array(depth.data, 0, count)
      const toMeters = depth.rawValueToMeters
      // 오래 끊겼다 다시 오면 지난 값과 섞지 않는다
      const restart = depth.time - this.lastAt > OCCLUSION_STALE_MS
      for (let i = 0; i < count; i++) cells[i] = blendDepth(restart ? 0 : cells[i], source[i] * toMeters)
      ;(uniforms.depthCameraWorld.value as Float32Array).set(depth.cameraWorld)
      ;(uniforms.depthProjectionInverse.value as Float32Array).set(this.scratch.fromArray(depth.projectionMatrix).invert().elements)
      this.floorY = depth.floorY !== null && Number.isFinite(depth.floorY) ? depth.floorY : null
      floorLimit = this.floorIgnore > 0 && this.floorY !== null ? this.floorY + this.floorIgnore : null
      uniforms.floorOn.value = floorLimit !== null
      uniforms.floorLimit.value = floorLimit ?? 0
    }
    this.texture!.needsUpdate = true
    ;(uniforms.depthFromView.value as Float32Array).set(depth.normDepthBufferFromNormView)
    this.lastAt = depth.time
    this.mesh.visible = true
    this.frames++
    // 복사·섞기·업로드 표시 시간 (실제 GPU 업로드는 다음 그리기에서 한다)
    this.uploadMs += (performance.now() - started - this.uploadMs) * 0.1
    if (this.mode === 'smooth' && (this.frames % FLOOR_SHARE_EVERY === 1 || floorLimit === null)) {
      this.floorShare = floorLimit === null ? null : this.measureFloorShare(depth, floorLimit)
    }
  }

  /** 깊이가 오래 안 오면 가리지 않는다. 매 프레임 부른다 */
  tick(time: number) {
    if (time - this.lastAt > OCCLUSION_STALE_MS) this.mesh.visible = false
  }

  status(time: number) {
    const age = Number.isFinite(this.lastAt) ? `${Math.round(time - this.lastAt)}ms 전` : '없음'
    const size = this.width ? `${this.width}x${this.height}${this.kind}` : '-'
    const cells = this.cellPx ? ` · 깊이 칸 ${this.cellPx[0].toFixed(0)}×${this.cellPx[1].toFixed(0)}px` : ''
    const head = `가림 시험 ${this.mode} · 깊이 ${size} (${age}, ${this.frames}번 올림, 복사 ${this.uploadMs.toFixed(2)}ms)${cells} · 뒤로 민 거리 ${OCCLUSION_BIAS_M}m`
    if (this.mode === 'raw') return [head, '가림 raw: Nearest · 바닥 제외 없음 · 섞기 없음 (d6b8a0e 방식)']
    const share = this.floorShare === null ? '-' : `${Math.round(this.floorShare * 100)}%`
    const floor =
      this.floorIgnore <= 0
        ? '끔'
        : this.floorY === null
          ? `바닥+${this.floorIgnore}m 아래 (바닥 모름, 안 뺌)`
          : `바닥+${this.floorIgnore}m 아래 · 빠진 칸 ${share}`
    return [head, `가림 smooth: bilinear · 바닥 제외 ${floor} · 섞기 새 값 ${OCCLUSION_BLEND_NEW} (${OCCLUSION_BLEND_JUMP_M}m 넘게 바뀌면 새 값)`]
  }

  dispose() {
    this.mesh.removeFromParent()
    this.geometry.dispose()
    this.material.dispose()
    this.texture?.dispose()
    this.texture = null
    this.cells = null
  }

  /** 깊이 크기·형식이 바뀌면 텍스처를 새로 만든다. raw 는 값 그대로, smooth 는 m 단위 실수 */
  private allocate(width: number, height: number, float: boolean) {
    this.texture?.dispose()
    const count = width * height
    const raw = this.mode === 'raw'
    const cells = raw && !float ? new Uint8Array(count * 2) : new Float32Array(count)
    const twoBytes = raw && !float
    const texture = new DataTexture(cells, width, height, twoBytes ? RGFormat : RedFormat, twoBytes ? UnsignedByteType : FloatType)
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    texture.unpackAlignment = 1
    texture.generateMipmaps = false
    this.texture = texture
    this.cells = cells
    this.width = width
    this.height = height
    this.kind = float ? 'f' : 'i'
    this.material.uniforms.depthMap.value = texture
    if (raw) this.material.uniforms.floatDepth.value = float
  }

  /** 깊이 있는 칸 중 실제 점이 바닥 문턱 아래인 칸 비율 (칸 가운데로 센다, 디버그) */
  private measureFloorShare(depth: CpuDepthFrame, floorLimit: number): number | null {
    const cells = this.cells
    if (!(cells instanceof Float32Array)) return null
    const projectionInverse = this.material.uniforms.depthProjectionInverse.value as Float32Array
    // 깊이 버퍼 좌표 → 정규화 뷰 좌표
    const a = this.scratch.fromArray(depth.normDepthBufferFromNormView).invert().elements
    const { width, height } = this
    let valid = 0
    let floor = 0
    for (let row = 0; row < height; row++) {
      const v = (row + 0.5) / height
      for (let col = 0; col < width; col++) {
        const meters = cells[row * width + col]
        if (!(meters > 0)) continue
        const u = (col + 0.5) / width
        const x = a[0] * u + a[4] * v + a[12]
        const y = a[1] * u + a[5] * v + a[13]
        if (x < 0 || x > 1 || y < 0 || y > 1) continue
        valid++
        const pointY = depthPointHeight(x, y, meters, depth.cameraWorld, projectionInverse)
        if (pointY !== null && pointY < floorLimit) floor++
      }
    }
    return valid ? floor / valid : null
  }

  /** 화면 픽셀 하나가 깊이 버퍼에서 얼마나 움직이는지로 깊이 칸 하나의 화면 크기를 잰다 (디버그) */
  private measureCells(width: number, height: number) {
    const m = this.material.uniforms.depthFromView.value as Float32Array
    const w = this.width
    const h = this.height
    if (!w || !h) return
    // 정규화 뷰 x 가 1 바뀔 때 깊이 버퍼에서 바뀌는 칸 수
    const alongX = Math.hypot(m[0] * w, m[1] * h)
    const alongY = Math.hypot(m[4] * w, m[5] * h)
    if (alongX > 0 && alongY > 0) this.cellPx = [width / alongX, height / alongY]
  }
}
