import {
  AlwaysDepth,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  FloatType,
  Mesh,
  NearestFilter,
  RedFormat,
  RGFormat,
  ShaderMaterial,
  UnsignedByteType,
} from 'three'

// 가림 시험 (개발용 주소 옵션 ?occlusion=1 에서만. 배포 파일에는 들어가지 않는다: useArPlacement 가 DEV 에서만 불러온다).
// 실제 물체(벽 모서리·소파·책상 다리)가 개보다 앞에 있으면 개를 가린다.
// 매 프레임 읽는 CPU 깊이(cpu-optimized)를 텍스처로 올리고, 개보다 먼저 '깊이만 쓰는' 화면 전체 사각형을 그린다.
// 화면 픽셀마다 실제 물체까지 거리를 깊이 버퍼에 써 두면, 실제 물체가 더 가까운 곳에서 개가 깊이 테스트에 져서 안 그려진다.
//
// - 화면 픽셀 → 정규화 뷰 좌표(왼쪽 위 원점) → normDepthBufferFromNormView → 깊이 버퍼 좌표. 깊이는 카메라 정면 축 거리 (m)
// - 그 거리 + OCCLUSION_BIAS_M 를 XR 뷰의 투영 행렬로 창 깊이(0~1)로 바꿔 gl_FragDepth 에 쓴다 (색은 쓰지 않는다)
// - 바닥은 개 발과 깊이가 같아 잡음으로 발·그림자가 깜빡이지 않게 BIAS 만큼 뒤로 민다 (그만큼 가까운 물체는 못 가린다)
// - 깊이는 우리 프레임 콜백(model-viewer 가 그린 뒤)에서만 읽혀, 그린 결과는 한 프레임 늦은 깊이다
// - model-viewer 의 그림자 패스는 장면 전체를 overrideMaterial 로 그린다. 사각형 꼭짓점은 position 을 모두 0 으로 둬
//   그 패스에서는 넓이가 0 이라 아무것도 안 그려지고, 이 셰이더는 uv 로 화면 전체를 덮는다

/** 실제 물체 깊이를 이만큼(m) 뒤로 밀어 쓴다 (바닥 잡음에 개 발·그림자가 가려지지 않게) */
export const OCCLUSION_BIAS_M = 0.05
/** 깊이가 이만큼(ms) 안 오면 가리지 않는다 (지난 깊이로 엉뚱한 곳을 가리지 않게) */
export const OCCLUSION_STALE_MS = 500
/** 개·그림자보다 먼저 그린다 */
const OCCLUSION_RENDER_ORDER = -1000

/** 한 프레임의 CPU 깊이 (XRCPUDepthInformation 에서 그 프레임 안에 꺼낸 것) */
export interface CpuDepthFrame {
  time: number
  width: number
  height: number
  /** 깊이 버퍼. 그 프레임 안에서만 유효해 update 에서 바로 복사한다 */
  data: ArrayBuffer
  rawValueToMeters: number
  /** 정규화 뷰 좌표 → 정규화 깊이 버퍼 좌표 (열 우선 4x4) */
  normDepthBufferFromNormView: Float32Array
  /** float32: 4바이트 실수 · 그 밖(luminance-alpha 등): 2바이트 정수 */
  format: string | null
}

/** 어댑터(ModelViewerArStage)가 장면에 넣고 매 프레임 깊이를 넘긴다 */
export interface StageOccluder {
  readonly mesh: Mesh
  update(depth: CpuDepthFrame): void
  /** 매 프레임: 깊이가 오래 안 왔으면 가리지 않는다 */
  tick(time: number): void
  /** 디버그 한 줄 */
  status(time: number): string
  dispose(): void
}

const VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAGMENT = /* glsl */ `
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

interface CameraLike {
  projectionMatrix?: { elements: ArrayLike<number> }
  /** XR 뷰 카메라만 있다 (프레임 버퍼 픽셀) */
  viewport?: { x: number; y: number; z: number; w: number }
}

export class DepthOccluder implements StageOccluder {
  readonly mesh: Mesh
  private readonly geometry: BufferGeometry
  private readonly material: ShaderMaterial
  private texture: DataTexture | null = null
  private bytes: Uint8Array | Float32Array | null = null
  private size = ''
  private lastAt = -Infinity
  private frames = 0
  private uploadMs = 0
  /** 깊이 칸 하나가 화면에서 몇 픽셀인지 (가로, 세로) */
  private cellPx: [number, number] | null = null

  constructor() {
    const geometry = new BufferGeometry()
    // position 은 모두 0 (그림자 패스처럼 overrideMaterial 로 그리면 넓이 0), 화면 위치는 uv 로
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(18), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 2))
    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        depthMap: { value: null },
        floatDepth: { value: false },
        rawToMeters: { value: 0 },
        depthFromView: { value: new Float32Array(16) },
        viewport: { value: new Float32Array([0, 0, 1, 1]) },
        projZ: { value: -1 },
        projW: { value: -0.2 },
        bias: { value: OCCLUSION_BIAS_M },
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
    // 형식과 길이가 맞지 않으면 (알 수 없는 형식) 올리지 않는다
    if (depth.data.byteLength < depth.width * depth.height * (float ? 4 : 2)) return
    const size = `${depth.width}x${depth.height}${float ? 'f' : 'i'}`
    if (size !== this.size || !this.texture || !this.bytes) {
      this.texture?.dispose()
      const count = depth.width * depth.height
      this.bytes = float ? new Float32Array(count) : new Uint8Array(count * 2)
      const texture = new DataTexture(this.bytes, depth.width, depth.height, float ? RedFormat : RGFormat, float ? FloatType : UnsignedByteType)
      texture.magFilter = NearestFilter
      texture.minFilter = NearestFilter
      texture.unpackAlignment = 1
      texture.generateMipmaps = false
      this.texture = texture
      this.size = size
      this.material.uniforms.depthMap.value = texture
      this.material.uniforms.floatDepth.value = float
    }
    const source = float ? new Float32Array(depth.data, 0, this.bytes.length) : new Uint8Array(depth.data, 0, this.bytes.length)
    this.bytes.set(source)
    this.texture.needsUpdate = true
    const uniforms = this.material.uniforms
    uniforms.rawToMeters.value = depth.rawValueToMeters
    ;(uniforms.depthFromView.value as Float32Array).set(depth.normDepthBufferFromNormView)
    this.lastAt = depth.time
    this.mesh.visible = true
    this.frames++
    // 복사·업로드 표시 시간 (실제 GPU 업로드는 다음 그리기에서 한다)
    this.uploadMs += (performance.now() - started - this.uploadMs) * 0.1
  }

  /** 깊이가 오래 안 오면 가리지 않는다. 매 프레임 부른다 */
  tick(time: number) {
    if (time - this.lastAt > OCCLUSION_STALE_MS) this.mesh.visible = false
  }

  status(time: number) {
    const age = Number.isFinite(this.lastAt) ? `${Math.round(time - this.lastAt)}ms 전` : '없음'
    const cells = this.cellPx ? ` · 깊이 칸 ${this.cellPx[0].toFixed(0)}×${this.cellPx[1].toFixed(0)}px` : ''
    return `가림 시험 켬 · 깊이 ${this.size || '-'} (${age}, ${this.frames}번 올림, 복사 ${this.uploadMs.toFixed(2)}ms)${cells} · 뒤로 민 거리 ${OCCLUSION_BIAS_M}m`
  }

  dispose() {
    this.mesh.removeFromParent()
    this.geometry.dispose()
    this.material.dispose()
    this.texture?.dispose()
    this.texture = null
    this.bytes = null
  }

  /** 화면 픽셀 하나가 깊이 버퍼에서 얼마나 움직이는지로 깊이 칸 하나의 화면 크기를 잰다 (디버그) */
  private measureCells(width: number, height: number) {
    const m = this.material.uniforms.depthFromView.value as Float32Array
    const [w, h] = this.size ? this.size.split('x').map((part) => parseInt(part, 10)) : [0, 0]
    if (!w || !h) return
    // 정규화 뷰 x 가 1 바뀔 때 깊이 버퍼에서 바뀌는 칸 수
    const alongX = Math.hypot(m[0] * w, m[1] * h)
    const alongY = Math.hypot(m[4] * w, m[5] * h)
    if (alongX > 0 && alongY > 0) this.cellPx = [width / alongX, height / alongY]
  }
}
