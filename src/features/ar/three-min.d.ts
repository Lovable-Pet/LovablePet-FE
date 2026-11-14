// three 0.172.0 은 타입을 싣지 않고 @types/three 도 없다. AR 바닥 원(modelViewerArStage.ts)에 쓰는 것만 적는다.
// @types/three 를 들이면 이 파일을 지운다
declare module 'three' {
  export const DoubleSide: number

  export class Object3D {
    visible: boolean
    renderOrder: number
    userData: Record<string, unknown>
    readonly position: { set(x: number, y: number, z: number): unknown }
    add(...objects: Object3D[]): this
    removeFromParent(): this
    raycast(...args: unknown[]): void
  }

  export class Group extends Object3D {}

  export class BufferGeometry {
    rotateX(angle: number): this
    dispose(): void
  }

  export class RingGeometry extends BufferGeometry {
    constructor(innerRadius?: number, outerRadius?: number, thetaSegments?: number)
  }

  export class CircleGeometry extends BufferGeometry {
    constructor(radius?: number, segments?: number)
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

  export class MeshBasicMaterial {
    constructor(parameters?: MeshBasicMaterialParameters)
    readonly color: { set(value: number | string): unknown }
    opacity: number
    dispose(): void
  }

  export class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: MeshBasicMaterial)
    material: MeshBasicMaterial
  }
}
