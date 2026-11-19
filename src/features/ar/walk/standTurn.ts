import type { StageFrame } from '../placement/arStage'
import type { Vec3 } from '../placement/types'
import { MAX_FRAME_S, STANDING_FADE_S } from './walkController'
import type { WalkHost } from './walkStage'
import { pickTurnClip, turnEndPose, walkSpec, type TurnClipSpec, type WalkSpec } from './walkSpec'

/** 사용자 발이 폰보다 뒤에 있는 만큼 − 발 반지름 (m). StandTurn.clearance */
export const TURN_FEET_GAP_M = 0.05

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
   * need 만큼 돌 때 사용자(카메라)가 개 발밑에서 떨어져 있어야 하는 수평 거리 (m). 고를 클립이 없으면 null.
   * 클립이 휩쓰는 자리 ≈ 몸길이/2 + end_offset (진도 헤드리스 측정: 90° 0.63 m·180° 0.735 m) 에서, 사용자 발이 폰보다
   * 0.2 m 뒤·반지름 0.15 m 라고 보고 0.05 m 를 뺀다 (측정한 '발과 안 겹치는 거리' 90° 0.56 m·180° 0.69 m 와 맞음)
   */
  clearance(need: number): number | null {
    const spec = pickTurnClip(this.spec.turns ?? [], need)
    if (!spec) return null
    return this.spec.bodyLength / 2 + Math.hypot(spec.offset[0], spec.offset[1]) * this.spec.scale - TURN_FEET_GAP_M
  }

  /** need: 개 정면에서 돌아야 할 각 (rad, + 왼쪽). 맞는 클립이 있어 돌기 시작했으면 true */
  start(need: number): boolean {
    if (this.play) return false
    const spec = pickTurnClip(this.spec.turns ?? [], need)
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
