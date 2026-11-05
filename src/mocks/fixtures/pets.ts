import type { PetDetail, PetSummary } from '../../apis/dto/pet.dto'

// MSW 목업 데이터. 백엔드 응답 모양 그대로, 화면 상태별로 한 마리씩 둔다
// 1: 성견, 모델 있음 (기본 흐름)
// 2: 올해 태어난 강아지, 모델 있음 (지금 크기 안내)
// 3: 모델 없음 (아직 만들지 않음)
// 4: 체중 원문을 숫자로 못 바꿈 → 모델을 만들 수 없음
// 5: 공고 기간 중 (보호중이지만 adoptable=false, 목록에는 안 나옴)
// 6: 입양 완료 (찜 목록에서만 보임)
const glb = (desertionNo: string) => `/models/${desertionNo}/${desertionNo}-mock.glb`

export const petDetails: PetDetail[] = [
  {
    id: 1,
    desertionNo: '448567202600101',
    noticeNo: '경기-화성-2026-01509',
    displayName: '믹스견 · 경기도 화성시 · 14kg',
    kindName: '믹스견',
    color: '갈색&흰색',
    ageText: '2023(년생)',
    birthYear: 2023,
    weightText: '14.0(Kg)',
    weightKg: 14,
    sex: 'M',
    neutered: 'Y',
    processState: '보호중',
    adoptable: true,
    noticeStart: '2026-10-12',
    noticeEnd: '2026-10-26',
    orgName: '경기도 화성시',
    happenPlace: '화성시 봉담읍',
    careName: '화성시동물보호센터',
    careTel: '031-000-0000',
    careAddr: '경기도 화성시 ○○로 123',
    specialMark: '사람을 잘 따르고 순함. 목줄을 한 채로 발견됨',
    photoUrls: [],
    model: {
      glbUrl: glb('448567202600101'),
      withersM: 0.48,
      template: 'jindo',
      behavior: { tapAnimation: 'tail_wag', playbackRate: 1 },
    },
    favorited: true,
  },
  {
    id: 2,
    desertionNo: '448567202600102',
    noticeNo: '경기-평택-2026-00567',
    displayName: '진도견 · 경기도 평택시 · 6.5kg',
    kindName: '진도견',
    color: '흰색',
    ageText: '2026(년생)',
    birthYear: 2026,
    weightText: '6.5(Kg)',
    weightKg: 6.5,
    sex: 'F',
    neutered: 'N',
    processState: '보호중',
    adoptable: true,
    noticeStart: '2026-10-20',
    noticeEnd: '2026-10-30',
    orgName: '경기도 평택시',
    happenPlace: '평택시 비전동',
    careName: '평택시동물보호센터',
    careTel: '031-000-0001',
    careAddr: '경기도 평택시 ○○길 45',
    specialMark: '형제견 3마리와 함께 구조',
    photoUrls: [],
    model: {
      glbUrl: glb('448567202600102'),
      withersM: 0.36,
      template: 'jindo_puppy',
      behavior: { tapAnimation: 'tail_wag', playbackRate: 1.2 },
    },
    favorited: false,
  },
  {
    id: 3,
    desertionNo: '448567202600103',
    noticeNo: '경기-수원-2026-00089',
    displayName: '말티즈 · 경기도 수원시 · 3.2kg',
    kindName: '말티즈',
    color: '흰색',
    ageText: '2019(년생)',
    birthYear: 2019,
    weightText: '3.2(Kg)',
    weightKg: 3.2,
    sex: 'F',
    neutered: 'U',
    processState: '보호중',
    adoptable: true,
    noticeStart: '2026-08-02',
    noticeEnd: '2026-08-12',
    orgName: '경기도 수원시',
    happenPlace: '수원시 권선구 주택가',
    careName: '수원시동물보호센터',
    careTel: '031-000-0002',
    careAddr: '경기도 수원시 ○○로 67',
    specialMark: '털이 많이 엉켜 있음',
    // 관리자 목업: 0번 적합, 1번 체형 부적합(force 필요), 2번 사진 거부
    photoUrls: ['/mock/photos/3-0.jpg', '/mock/photos/3-1.jpg', '/mock/photos/3-2.jpg'],
    model: null,
    favorited: false,
  },
  {
    id: 4,
    desertionNo: '448567202600104',
    noticeNo: '경기-용인-2026-00321',
    displayName: '믹스견 · 경기도 용인시',
    kindName: '믹스견',
    color: '검정색',
    ageText: '2021(년생)',
    birthYear: 2021,
    weightText: '미상',
    weightKg: null,
    sex: 'Q',
    neutered: 'Y',
    processState: '보호중',
    adoptable: true,
    noticeStart: '2026-09-15',
    noticeEnd: '2026-09-25',
    orgName: '경기도 용인시',
    happenPlace: '용인시 처인구 산책로',
    careName: '용인시동물보호센터',
    careTel: '031-000-0003',
    careAddr: '경기도 용인시 ○○로 89',
    specialMark: '철창 안에서 촬영, 겁이 많음',
    photoUrls: [],
    model: null,
    favorited: false,
  },
  {
    id: 5,
    desertionNo: '448567202600105',
    noticeNo: '경기-이천-2026-00777',
    displayName: '진도견 · 경기도 이천시 · 21kg',
    kindName: '진도견',
    color: '황색',
    ageText: '2020(년생)',
    birthYear: 2020,
    weightText: '21(Kg)',
    weightKg: 21,
    sex: 'M',
    neutered: 'U',
    processState: '보호중',
    adoptable: false,
    noticeStart: '2026-11-04',
    noticeEnd: '2026-11-14',
    orgName: '경기도 이천시',
    happenPlace: '이천시 부발읍',
    careName: '이천시동물보호센터',
    careTel: '031-000-0004',
    careAddr: '경기도 이천시 ○○로 12',
    specialMark: '목걸이 있음, 보호자를 찾는 중',
    photoUrls: [],
    model: null,
    favorited: false,
  },
  {
    id: 6,
    desertionNo: '448567202600106',
    noticeNo: '경기-고양-2026-00410',
    displayName: '시바 · 경기도 고양시 · 9.8kg',
    kindName: '시바',
    color: '적갈색',
    ageText: '2022(년생)',
    birthYear: 2022,
    weightText: '9.8(Kg)',
    weightKg: 9.8,
    sex: 'M',
    neutered: 'Y',
    processState: '종료(입양)',
    adoptable: false,
    noticeStart: '2026-09-01',
    noticeEnd: '2026-09-11',
    orgName: '경기도 고양시',
    happenPlace: '고양시 일산동구',
    careName: '고양시동물보호센터',
    careTel: '031-000-0005',
    careAddr: '경기도 고양시 ○○로 34',
    specialMark: '활발함',
    photoUrls: [],
    model: {
      glbUrl: glb('448567202600106'),
      withersM: 0.39,
      template: 'jindo',
      behavior: { tapAnimation: 'tail_wag', playbackRate: 1 },
    },
    favorited: true,
  },
]

// 목록·페이지 넘김·필터 확인용으로 입양 가능한 아이를 더 만든다 (id 101부터, 매번 같은 값)
const REGIONS: [string, string[]][] = [
  ['경기도', ['화성시', '평택시', '수원시', '용인시', '안성시', '이천시', '포천시']],
  ['경상남도', ['창원시', '김해시']],
  ['충청남도', ['천안시', '아산시']],
  ['서울특별시', ['강서구', '노원구']],
  ['부산광역시', ['해운대구']],
]
const KINDS: [string, string][] = [
  ['믹스견', 'jindo'],
  ['믹스견', 'jindo'],
  ['믹스견', 'retriever'],
  ['진도견', 'jindo'],
  ['말티즈', 'maltese'],
  ['푸들', 'toypoodle'],
  ['포메라니안', 'chihuahua'],
  ['시바', 'jindo'],
]
const COLORS = ['갈색', '흰색', '검정색', '갈색&흰색', '크림색', '황색']
const SEXES = ['M', 'F', 'Q'] as const

const generatedPets: PetDetail[] = Array.from({ length: 26 }, (_, index) => {
  const id = 101 + index
  const [sido, sigungus] = REGIONS[index % REGIONS.length]
  const orgName = `${sido} ${sigungus[index % sigungus.length]}`
  const [kindName, template] = KINDS[(index * 3) % KINDS.length]
  const small = kindName === '말티즈' || kindName === '푸들' || kindName === '포메라니안'
  const weightKg = small ? 2.5 + (index % 5) * 0.7 : 8 + ((index * 7) % 23)
  const birthYear = 2018 + (index % 9)
  const hasModel = index % 10 < 7
  // 2026-07-20부터 약 3일 간격으로 공고 시작
  const start = new Date(2026, 6, 20 + index * 3)
  const noticeStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const desertionNo = `4485672026${String(id).padStart(5, '0')}`
  const weightText = `${weightKg.toFixed(1)}(Kg)`
  return {
    id,
    desertionNo,
    noticeNo: `${sido.slice(0, 2)}-${sigungus[0].slice(0, 2)}-2026-${String(id).padStart(5, '0')}`,
    displayName: `${kindName} · ${orgName} · ${Number(weightKg.toFixed(1))}kg`,
    kindName,
    color: COLORS[index % COLORS.length],
    ageText: `${birthYear}(년생)`,
    birthYear,
    weightText,
    weightKg: Number(weightKg.toFixed(1)),
    sex: SEXES[index % SEXES.length],
    neutered: index % 2 === 0 ? 'Y' : 'U',
    processState: '보호중',
    adoptable: true,
    noticeStart,
    noticeEnd: noticeStart,
    orgName,
    happenPlace: `${sigungus[0]} 인근`,
    careName: `${sigungus[index % sigungus.length]}동물보호센터`,
    careTel: '000-0000-0000',
    careAddr: `${orgName} [보호소 주소]`,
    specialMark: '[특징]',
    // 사진 0~3장 (0장이면 관리자 화면에서 '사진이 없어 만들 수 없어요')
    photoUrls: Array.from({ length: index % 4 }, (_, photoIndex) => `/mock/photos/${id}-${photoIndex}.jpg`),
    model: hasModel
      ? {
          glbUrl: glb(desertionNo),
          withersM: Number((0.18 + Math.cbrt(weightKg) * 0.13).toFixed(2)),
          template,
          behavior: { tapAnimation: 'tail_wag', playbackRate: 1 },
        }
      : null,
    favorited: false,
  }
})

petDetails.push(...generatedPets)

export const toSummary = (pet: PetDetail): PetSummary => ({
  id: pet.id,
  displayName: pet.displayName,
  kindName: pet.kindName,
  sex: pet.sex,
  ageText: pet.ageText,
  weightKg: pet.weightKg,
  orgName: pet.orgName,
  careName: pet.careName,
  thumbnailUrl: pet.photoUrls[0] ?? null,
  noticeStart: pet.noticeStart,
  hasModel: pet.model !== null,
  adoptable: pet.adoptable,
  favorited: pet.favorited,
})
