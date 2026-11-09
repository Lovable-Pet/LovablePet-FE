import type { PetModelView } from '../../apis/dto/pet.dto'
import { samplePets } from './samplePets'

// samplePets.ts 는 AI 저장소가 보내는 파일 그대로 둔다 (새 묶음을 받으면 덮어쓰기만 하면 되게).
// 이 파일은 FE 가 붙인 도우미

/**
 * 다른 목업 개에게 붙일 모델. 가짜 파이프라인처럼 체중이 가장 가까운 샘플의 GLB·USDZ·체고를 쓴다.
 * GLB 가 그 샘플의 실제 크기라 체고도 샘플 값을 써야 AR 배지와 모델 크기가 맞는다
 * (그 개 자신이 아니라 진도 샘플이라 생김새가 다르다)
 */
export const sampleModelFor = (weightKg: number): Pick<PetModelView, 'glbUrl' | 'usdzUrl' | 'withersM'> => {
  const nearest = [...samplePets].sort(
    (a, b) => Math.abs((a.weightKg ?? 0) - weightKg) - Math.abs((b.weightKg ?? 0) - weightKg),
  )[0].model
  return { glbUrl: nearest.glbUrl, usdzUrl: nearest.usdzUrl, withersM: nearest.withersM }
}
