import type { PetSummary } from '../../apis/dto/pet.dto'
import { SEX_LABEL } from '../../constants/pet'
import { formatAge, formatWeight } from '../../utils/pet'

/** 성별, 나이, 체중 한 줄 */
export const petFacts = (pet: Pick<PetSummary, 'sex' | 'ageText' | 'weightKg'>) =>
  [SEX_LABEL[pet.sex], formatAge(pet.ageText), formatWeight(pet.weightKg)].filter(Boolean).join(', ')
