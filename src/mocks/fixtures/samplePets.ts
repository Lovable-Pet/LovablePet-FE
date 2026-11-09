import type { PetDetail, PetModelView } from '../../apis/dto/pet.dto'

// AR 샘플 9마리 (AI 저장소가 만든 실제 모델). public/mock/models, public/mock/samples 와 같이 온다.
// 쓰는 법은 저장소 루트의 MOCK_MODELS.md

/** usdzUrl 은 백엔드 PetModelView 에 이미 있다 (아이폰 Quick Look, model-viewer 의 ios-src) */
type SampleModel = PetModelView & { usdzUrl: string | null }
type SamplePet = Omit<PetDetail, 'model'> & { model: SampleModel }

export const samplePets: SamplePet[] = [
  {
    "id": 201,
    "desertionNo": "441407202600741",
    "noticeNo": "샘플-jindo-01",
    "displayName": "진도견 · 샘플 jindo 01 · 25kg",
    "kindName": "진도견",
    "color": "크림색",
    "ageText": "2024(년생)",
    "birthYear": 2024,
    "weightText": "25.0(Kg)",
    "weightKg": 25.0,
    "sex": "M",
    "neutered": "N",
    "processState": "보호중",
    "adoptable": true,
    "noticeStart": "2026-11-01",
    "noticeEnd": "2026-11-11",
    "orgName": "샘플 보호소",
    "happenPlace": "[발견 장소]",
    "careName": "샘플 동물보호센터",
    "careTel": "000-0000-0000",
    "careAddr": "[보호소 주소]",
    "specialMark": "AR 샘플 (11-07 다시 만듦). 실제 공고 사진과 파이프라인이 만든 모델",
    "photoUrls": [
      "/mock/samples/441407202600741.jpg"
    ],
    "model": {
      "glbUrl": "/mock/models/441407202600741/441407202600741-mock.glb",
      "usdzUrl": "/mock/models/441407202600741/441407202600741-mock.usdz",
      "withersM": 0.541,
      "template": "jindo",
      "behavior": {
        "tapAnimation": "tail_wag",
        "playbackRate": 1.0
      }
    },
    "favorited": false
  },
  {
    "id": 202,
    "desertionNo": "447510202600669",
    "noticeNo": "경북-영천-2026-00262",
    "displayName": "믹스견 · 샘플 jindo 02 · 15kg",
    "kindName": "믹스견",
    "color": "황갈색",
    "ageText": "2025(년생)",
    "birthYear": 2025,
    "weightText": "15.0(Kg)",
    "weightKg": 15.0,
    "sex": "M",
    "neutered": "N",
    "processState": "보호중",
    "adoptable": true,
    "noticeStart": "2026-11-01",
    "noticeEnd": "2026-11-11",
    "orgName": "샘플 보호소",
    "happenPlace": "[발견 장소]",
    "careName": "샘플 동물보호센터",
    "careTel": "000-0000-0000",
    "careAddr": "[보호소 주소]",
    "specialMark": "AR 샘플 (11-05 다시 만듦). 실제 공고 사진과 파이프라인이 만든 모델",
    "photoUrls": [
      "/mock/samples/447510202600669.jpg"
    ],
    "model": {
      "glbUrl": "/mock/models/447510202600669/447510202600669-mock.glb",
      "usdzUrl": "/mock/models/447510202600669/447510202600669-mock.usdz",
      "withersM": 0.457,
      "template": "jindo",
      "behavior": {
        "tapAnimation": "tail_wag",
        "playbackRate": 1.0
      }
    },
    "favorited": false
  },
  {
    "id": 203,
    "desertionNo": "444461202600256",
    "noticeNo": "샘플-jindo-03",
    "displayName": "진도견 · 샘플 jindo 03 · 15kg",
    "kindName": "진도견",
    "color": "갈색",
    "ageText": "2025(년생)",
    "birthYear": 2025,
    "weightText": "15.0(Kg)",
    "weightKg": 15.0,
    "sex": "F",
    "neutered": "N",
    "processState": "보호중",
    "adoptable": true,
    "noticeStart": "2026-11-01",
    "noticeEnd": "2026-11-11",
    "orgName": "샘플 보호소",
    "happenPlace": "[발견 장소]",
    "careName": "샘플 동물보호센터",
    "careTel": "000-0000-0000",
    "careAddr": "[보호소 주소]",
    "specialMark": "AR 샘플 (11-07 다시 만듦). 실제 공고 사진과 파이프라인이 만든 모델",
    "photoUrls": [
      "/mock/samples/444461202600256.jpg"
    ],
    "model": {
      "glbUrl": "/mock/models/444461202600256/444461202600256-mock.glb",
      "usdzUrl": "/mock/models/444461202600256/444461202600256-mock.usdz",
      "withersM": 0.457,
      "template": "jindo",
      "behavior": {
        "tapAnimation": "tail_wag",
        "playbackRate": 1.0
      }
    },
    "favorited": false
  },
  {
    "id": 204,
    "desertionNo": "413587202600172",
    "noticeNo": "광주-해남-2026-00014",
    "displayName": "믹스견 · 샘플 jindo 04 · 5.69kg",
    "kindName": "믹스견",
    "color": "갈색&흰색",
    "ageText": "2024(년생)",
    "birthYear": 2024,
    "weightText": "5.7(Kg)",
    "weightKg": 5.69,
    "sex": "M",
    "neutered": "N",
    "processState": "보호중",
    "adoptable": true,
    "noticeStart": "2026-11-01",
    "noticeEnd": "2026-11-11",
    "orgName": "샘플 보호소",
    "happenPlace": "[발견 장소]",
    "careName": "샘플 동물보호센터",
    "careTel": "000-0000-0000",
    "careAddr": "[보호소 주소]",
    "specialMark": "AR 샘플 (11-07 다시 만듦). 실제 공고 사진과 파이프라인이 만든 모델",
    "photoUrls": [
      "/mock/samples/413587202600172.jpg"
    ],
    "model": {
      "glbUrl": "/mock/models/413587202600172/413587202600172-mock.glb",
      "usdzUrl": "/mock/models/413587202600172/413587202600172-mock.usdz",
      "withersM": 0.331,
      "template": "jindo",
      "behavior": {
        "tapAnimation": "tail_wag",
        "playbackRate": 1.0
      }
    },
    "favorited": false
  },
  {
    "id": 205,
    "desertionNo": "441399202601337",
    "noticeNo": "경기-남양주-2026-00316",
    "displayName": "믹스견 · 샘플 jindo 05 · 18kg",
    "kindName": "믹스견",
    "color": "검정색",
    "ageText": "2025(년생)",
    "birthYear": 2025,
    "weightText": "18.0(Kg)",
    "weightKg": 18.0,
    "sex": "F",
    "neutered": "N",
    "processState": "보호중",
    "adoptable": true,
    "noticeStart": "2026-11-01",
    "noticeEnd": "2026-11-11",
    "orgName": "샘플 보호소",
    "happenPlace": "[발견 장소]",
    "careName": "샘플 동물보호센터",
    "careTel": "000-0000-0000",
    "careAddr": "[보호소 주소]",
    "specialMark": "AR 샘플 (11-07 다시 만듦). 실제 공고 사진과 파이프라인이 만든 모델",
    "photoUrls": [
      "/mock/samples/441399202601337.jpg"
    ],
    "model": {
      "glbUrl": "/mock/models/441399202601337/441399202601337-mock.glb",
      "usdzUrl": "/mock/models/441399202601337/441399202601337-mock.usdz",
      "withersM": 0.485,
      "template": "jindo",
      "behavior": {
        "tapAnimation": "tail_wag",
        "playbackRate": 1.0
      }
    },
    "favorited": false
  },
  {
    "id": 206,
    "desertionNo": "441554202601431",
    "noticeNo": "샘플-jindo-06",
    "displayName": "진도견 · 샘플 jindo 06 · 7kg",
    "kindName": "진도견",
    "color": "흑갈색",
    "ageText": "2023(년생)",
    "birthYear": 2023,
    "weightText": "7.0(Kg)",
    "weightKg": 7.0,
    "sex": "F",
    "neutered": "N",
    "processState": "보호중",
    "adoptable": true,
    "noticeStart": "2026-11-01",
    "noticeEnd": "2026-11-11",
    "orgName": "샘플 보호소",
    "happenPlace": "[발견 장소]",
    "careName": "샘플 동물보호센터",
    "careTel": "000-0000-0000",
    "careAddr": "[보호소 주소]",
    "specialMark": "AR 샘플 (11-05 다시 만듦). 실제 공고 사진과 파이프라인이 만든 모델",
    "photoUrls": [
      "/mock/samples/441554202601431.jpg"
    ],
    "model": {
      "glbUrl": "/mock/models/441554202601431/441554202601431-mock.glb",
      "usdzUrl": "/mock/models/441554202601431/441554202601431-mock.usdz",
      "withersM": 0.354,
      "template": "jindo",
      "behavior": {
        "tapAnimation": "tail_wag",
        "playbackRate": 1.0
      }
    },
    "favorited": false
  },
  {
    "id": 207,
    "desertionNo": "447508202601188",
    "noticeNo": "샘플-jindo-07",
    "displayName": "진도견 · 샘플 jindo 07 · 19.4kg",
    "kindName": "진도견",
    "color": "호반색(호랑이무늬)",
    "ageText": "2024(년생)",
    "birthYear": 2024,
    "weightText": "19.4(Kg)",
    "weightKg": 19.4,
    "sex": "M",
    "neutered": "N",
    "processState": "보호중",
    "adoptable": true,
    "noticeStart": "2026-11-01",
    "noticeEnd": "2026-11-11",
    "orgName": "샘플 보호소",
    "happenPlace": "[발견 장소]",
    "careName": "샘플 동물보호센터",
    "careTel": "000-0000-0000",
    "careAddr": "[보호소 주소]",
    "specialMark": "AR 샘플 (11-07 다시 만듦). 실제 공고 사진과 파이프라인이 만든 모델",
    "photoUrls": [
      "/mock/samples/447508202601188.jpg"
    ],
    "model": {
      "glbUrl": "/mock/models/447508202601188/447508202601188-mock.glb",
      "usdzUrl": "/mock/models/447508202601188/447508202601188-mock.usdz",
      "withersM": 0.497,
      "template": "jindo",
      "behavior": {
        "tapAnimation": "tail_wag",
        "playbackRate": 1.0
      }
    },
    "favorited": false
  },
  {
    "id": 208,
    "desertionNo": "427342202600461",
    "noticeNo": "대구-동구-2026-00222",
    "displayName": "믹스견 · 샘플 jindo 08 · 16kg",
    "kindName": "믹스견",
    "color": "회색",
    "ageText": "2022(년생)",
    "birthYear": 2022,
    "weightText": "16.0(Kg)",
    "weightKg": 16.0,
    "sex": "M",
    "neutered": "N",
    "processState": "보호중",
    "adoptable": true,
    "noticeStart": "2026-11-01",
    "noticeEnd": "2026-11-11",
    "orgName": "샘플 보호소",
    "happenPlace": "[발견 장소]",
    "careName": "샘플 동물보호센터",
    "careTel": "000-0000-0000",
    "careAddr": "[보호소 주소]",
    "specialMark": "AR 샘플 (11-07 다시 만듦). 실제 공고 사진과 파이프라인이 만든 모델",
    "photoUrls": [
      "/mock/samples/427342202600461.jpg"
    ],
    "model": {
      "glbUrl": "/mock/models/427342202600461/427342202600461-mock.glb",
      "usdzUrl": "/mock/models/427342202600461/427342202600461-mock.usdz",
      "withersM": 0.467,
      "template": "jindo",
      "behavior": {
        "tapAnimation": "tail_wag",
        "playbackRate": 1.0
      }
    },
    "favorited": false
  },
  {
    "id": 209,
    "desertionNo": "441383202600291",
    "noticeNo": "경기-안양-2026-00075",
    "displayName": "믹스견 · 샘플 jindo 09 · 15kg",
    "kindName": "믹스견",
    "color": "흑백",
    "ageText": "2025(년생)",
    "birthYear": 2025,
    "weightText": "15.0(Kg)",
    "weightKg": 15.0,
    "sex": "F",
    "neutered": "N",
    "processState": "보호중",
    "adoptable": true,
    "noticeStart": "2026-11-01",
    "noticeEnd": "2026-11-11",
    "orgName": "샘플 보호소",
    "happenPlace": "[발견 장소]",
    "careName": "샘플 동물보호센터",
    "careTel": "000-0000-0000",
    "careAddr": "[보호소 주소]",
    "specialMark": "AR 샘플 (11-05 다시 만듦). 실제 공고 사진과 파이프라인이 만든 모델",
    "photoUrls": [
      "/mock/samples/441383202600291.jpg"
    ],
    "model": {
      "glbUrl": "/mock/models/441383202600291/441383202600291-mock.glb",
      "usdzUrl": "/mock/models/441383202600291/441383202600291-mock.usdz",
      "withersM": 0.457,
      "template": "jindo",
      "behavior": {
        "tapAnimation": "tail_wag",
        "playbackRate": 1.0
      }
    },
    "favorited": false
  }
]
