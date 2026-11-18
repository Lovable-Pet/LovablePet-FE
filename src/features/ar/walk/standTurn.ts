import type { StageFrame } from '../placement/arStage'
import type { Vec3 } from '../placement/types'
import { MAX_FRAME_S, STANDING_FADE_S } from './walkController'
import type { WalkHost } from './walkStage'
import { pickTurnClip, turnEndPose, walkSpec, type TurnClipSpec, type WalkSpec } from './walkSpec'

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
