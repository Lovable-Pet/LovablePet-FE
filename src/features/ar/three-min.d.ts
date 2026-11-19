// three 0.172.0 은 타입을 싣지 않고 @types/three 도 없다. AR 바닥 원·회전 클립이 쓸고 지나가는 자리(modelViewerArStage.ts)와
// 가림 시험(depthOcclusion.ts, 개발용)에 쓰는 것만 적는다. @types/three 를 들이면 이 파일을 지운다
declare module 'three' {
  export const DoubleSide: number
  export const AlwaysDepth: number
  export const NearestFilter: number
  export const UnsignedByteType: number
  export const FloatType: number
  export const RedFormat: number
  export const RGFormat: number

  export class Matrix4 {
    readonly elements: number[]
    fromArray(array: ArrayLike<number>, offset?: number): this
    copy(matrix: Matrix4): this
    multiply(matrix: Matrix4): this
    invert(): this
  }

  export class Vector3 {
    x: number
    y: number
    z: number
    setFromMatrixPosition(matrix: Matrix4): this
    setFromMatrixColumn(matrix: Matrix4, index: number): this
    applyMatrix4(matrix: Matrix4): this
    length(): number
  }

  export class AnimationClip {
    readonly name: string
    readonly duration: number
  }

  export class AnimationAction {
    time: number
    play(): this
    stop(): this
  }

  export class AnimationMixer {
    constructor(root: Object3D)
    clipAction(clip: AnimationClip): AnimationAction
    uncacheAction(clip: AnimationClip): void
    update(deltaTime: number): this
  }

  export class Object3D {
    readonly name: string
    readonly matrixWorld: Matrix4
    visible: boolean
    renderOrder: number
    frustumCulled: boolean
    userData: Record<string, unknown>
    readonly position: { set(x: number, y: number, z: number): unknown }
    add(...objects: Object3D[]): this
    removeFromParent(): this
    clone(recursive?: boolean): this
    traverse(callback: (node: Object3D) => void): void
    updateWorldMatrix(updateParents: boolean, updateChildren: boolean): void
    updateMatrixWorld(force?: boolean): void
    raycast(...args: unknown[]): void
    /** 그리기 바로 전 (카메라마다). camera 는 XR 뷰 카메라이거나 그림자 카메라 */
    onBeforeRender(renderer: unknown, scene: unknown, camera: unknown, geometry: unknown, material: unknown, group: unknown): void
  }

  export class Group extends Object3D {}

  export class BufferAttribute {
    constructor(array: Float32Array, itemSize: number)
  }

  export class BufferGeometry {
    rotateX(angle: number): this
    setAttribute(name: string, attribute: BufferAttribute): this
    dispose(): void
  }

  export class RingGeometry extends BufferGeometry {
    constructor(innerRadius?: number, outerRadius?: number, thetaSegments?: number)
  }

  export class CircleGeometry extends BufferGeometry {
    constructor(radius?: number, segments?: number)
  }

  export class Texture {
    magFilter: number
    minFilter: number
    generateMipmaps: boolean
    unpackAlignment: number
    needsUpdate: boolean
    dispose(): void
  }

  export class DataTexture extends Texture {
    constructor(data: ArrayBufferView, width: number, height: number, format: number, type: number)
  }

  export class Material {
    dispose(): void
  }

  export interface MeshBasicMaterialParameters {
    color?: number | string
    transparent?: boolean
    opacity?: number
    depthTest?: boolean
    depthWrite?: boolean
    side?: number
    toneMapped?: boolean
  }

  export class MeshBasicMaterial extends Material {
    constructor(parameters?: MeshBasicMaterialParameters)
    readonly color: { set(value: number | string): unknown }
    opacity: number
  }

  export interface ShaderMaterialParameters {
    vertexShader: string
    fragmentShader: string
    uniforms: Record<string, { value: unknown }>
    colorWrite?: boolean
    depthWrite?: boolean
    depthTest?: boolean
    depthFunc?: number
    side?: number
  }

  export class ShaderMaterial extends Material {
    constructor(parameters: ShaderMaterialParameters)
    readonly uniforms: Record<string, { value: unknown }>
  }

  export class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material)
    material: Material
  }
}
