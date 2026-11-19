import type { StageFrame } from '../placement/arStage'
import type { Vec3 } from '../placement/types'
import { MAX_FRAME_S, STANDING_FADE_S } from './walkController'
import type { WalkHost } from './walkStage'
import { pickTurnClip, turnEndPose, walkSpec, type TurnClip, type TurnClipSpec, type WalkSpec } from './walkSpec'
import { fromDogFrame, sweepHits, sweepOutline, USER_FEET_BACK_M, USER_FEET_RADIUS_M, userFeet } from './turnSweep'

/** 쓸고 지나가는 자리를 모를 때 (계산 실패): 거리로만. 몸길이/2 + end_offset − (발 뒤 0.2 − 발 반지름 0.15) */
const FALLBACK_FEET_GAP_M = USER_FEET_BACK_M - USER_FEET_RADIUS_M

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

/** 몸 돌리기를 할 수 있는지 (사용자 발과 클립이 쓸고 지나가는 자리가 겹치는지) */
export interface TurnPlan {
  /** 돌 수 있으면 true. clip 이 그 클립 */
  ok: boolean
  /** 돌 클립. 막혔으면 처음 고른 클립 */
  clip: TurnClip | null
  /** 처음 고른 클립이 겹쳐 다른 클립(남은 각이 더 작아지는 것)으로 바꿨는지 */
  alternative: boolean
  /** 막힌 까닭 (돌 수 있으면 null) */
  reason: string | null
  /** ?debug 바닥 윤곽 (처음 고른 클립이 쓸고 지나가는 자리, 월드 x·z) · 발 원 가운데 · 개 발밑 높이 */
  outline: { x: number; z: number }[]
  feet: { x: number; z: number }
  y: number
}

/**
 * 산책 밖에서 서 있는 개의 제자리 회전 (고개 바라보기의 몸 돌리기, ../gaze/gazeController.ts).
 * 산책의 회전(WalkController)과 같은 클립 고르기(135° 기준 90°·180°)·재생 배율(1/√s × ?turnspeed)·시작 섞기(서기 0.3초)·
 * 끝 처리(end_offset 만큼 옮기고 yaw 를 돌려 서기 첫 프레임으로 돌려준다)를 쓴다. 도는 동안 명령·개 탭·산책 시작은 부르는 쪽이 막는다
 */
export class StandTurn {
  private readonly host: WalkHost
  private readonly spec: WalkSpec
  private readonly rate: number
  private readonly onChange: (turning: boolean) => void
  private play: { spec: TurnClipSpec; time: number; fade: number; position: Vec3; yaw0: number } | null = null
  private lastTime: number | null = null
  private unsubscribe: (() => void) | null = null

  constructor(host: WalkHost, options: { turnSpeed?: number; onChange: (turning: boolean) => void }) {
    this.host = host
    this.spec = walkSpec(host.rig.info)
    const speed = options.turnSpeed
    this.rate = this.spec.r0 * (speed && speed > 0 ? speed : 1)
    this.onChange = options.onChange
  }

  /** 회전 클립이 있는지 */
  get available(): boolean {
    return (this.spec.turns?.length ?? 0) > 0
  }

  get turning(): boolean {
    return this.play !== null
  }

  /**
   * need 만큼 돌 때 사용자 발 (폰에서 개 반대쪽으로 0.2 m, 반지름 0.15 m 원) 이 클립이 쓸고 지나가는 자리와 겹치는지.
   * 처음 고른 클립 (135° 기준 같은 쪽 90°·180°) 이 겹치면, alternatives 일 때 다른 클립 중 돈 뒤 남는 각이 지금보다 작은 것을
   * 남는 각이 작은 순서로 본다. 클립이 없으면 null
   */
  plan(need: number, camera: Vec3, alternatives = true): TurnPlan | null {
    const turns = this.spec.turns ?? []
    const primary = pickTurnClip(turns, need)
    const pose = this.host.dogPose()
    if (!primary || !pose) return null
    const dog = { x: pose.position.x, z: pose.position.z }
    const feet = userFeet(camera, dog, pose.yaw)
    const others = alternatives
      ? turns
          .filter((turn) => turn !== primary && Math.abs(wrap(need - turn.angle)) < Math.abs(need))
          .sort((a, b) => Math.abs(wrap(need - a.angle)) - Math.abs(wrap(need - b.angle)))
      : []
    const fits = (turn: TurnClipSpec) =>
      turn.sweep
        ? !sweepHits(turn.sweep, feet.u, feet.v, USER_FEET_RADIUS_M)
        : Math.hypot(camera.x - dog.x, camera.z - dog.z) >=
          this.spec.bodyLength / 2 + Math.hypot(turn.offset[0], turn.offset[1]) * this.spec.scale - FALLBACK_FEET_GAP_M
    const chosen = [primary, ...others].find(fits) ?? null
    const outline = primary.sweep ? this.outlineOf(primary).map((point) => fromDogFrame(point, dog, pose.yaw)) : []
    return {
      ok: !!chosen,
      clip: (chosen ?? primary).clip,
      alternative: !!chosen && chosen !== primary,
      reason: chosen ? null : `쓸고 지나가는 자리와 겹침 (${[primary, ...others].map((turn) => turn.clip).join('·')})`,
      outline,
      feet: fromDogFrame(feet, dog, pose.yaw),
      y: pose.position.y,
    }
  }

  private readonly outlines = new Map<TurnClip, { u: number; v: number }[]>()
  private outlineOf(turn: TurnClipSpec) {
    let outline = this.outlines.get(turn.clip)
    if (!outline) {
      outline = turn.sweep ? sweepOutline(turn.sweep) : []
      this.outlines.set(turn.clip, outline)
    }
    return outline
  }

  /** need: 개 정면에서 돌아야 할 각 (rad, + 왼쪽). clip 을 주면 그 클립 (plan 이 고른 것). 돌기 시작했으면 true */
  start(need: number, clip?: TurnClip | null): boolean {
    if (this.play) return false
    const turns = this.spec.turns ?? []
    const spec = (clip ? turns.find((turn) => turn.clip === clip) : null) ?? pickTurnClip(turns, need)
    const pose = this.host.dogPose()
    if (!spec || !pose) return false
    this.host.rig.takeOver()
    this.play = { spec, time: 0, fade: 0, position: { ...pose.position }, yaw0: pose.yaw }
    this.lastTime = null
    this.unsubscribe = this.host.subscribe((frame) => this.frame(frame))
    this.onChange(true)
    return true
  }

  /** 그만둔다 (다시 놓기·AR 끝). 도는 중이면 서기 루프로 바로 돌려준다 */
  dispose() {
    if (this.play) this.host.rig.release()
    this.stop()
  }

  private frame(frame: StageFrame) {
    const play = this.play
    if (!play) return
    const dt = this.lastTime === null ? 0 : Math.min(MAX_FRAME_S, Math.max(0, (frame.time - this.lastTime) / 1000))
    this.lastTime = frame.time
    play.time += dt * this.rate
    play.fade += dt
    if (play.time < play.spec.duration) {
      this.host.rig.show({ clip: play.spec.clip, time: play.time, standingWeight: Math.max(0, 1 - play.fade / STANDING_FADE_S) })
      return
    }
    const end = turnEndPose(play.spec, play.position, play.yaw0, this.spec.scale)
    this.host.rig.moveDog(end.position, end.yaw)
    this.host.dogMoved(end.position, end.yaw)
    this.host.rig.release()
    this.stop()
  }

  private stop() {
    const was = this.play !== null
    this.play = null
    this.unsubscribe?.()
    this.unsubscribe = null
    if (was) this.onChange(false)
  }
}
