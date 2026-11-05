# LOVABLEPET FRONTEND

사진만으로는 가늠하기 어려운 강아지의 크기를, 입양 전에 우리 집에서 AR로 확인하는 서비스
**LovablePet의 프론트엔드 웹입니다.**

[서비스 바로가기]() · [Backend](https://github.com/Lovable-Pet/LovablePet-BE)

## ✨ LovablePet

보호소 공고의 사진과 체중만으로는 그 아이가 우리 집에서 어느 정도 크기인지 알기 어렵습니다. LovablePet은 공고 사진 한 장으로 그 아이의 3D 모델을 자동으로 만들고, AR로 우리 집 바닥에 실제 크기로 놓아 보게 합니다.

- **개체별 3D 모델 자동 생성**: 형태·뼈대는 템플릿, 털색·무늬는 공고 사진에서 읽어 입힘
- **AR 실제 크기 확인**: 공고 체중으로 환산한 체고·몸길이로 우리 집 바닥에 배치 (안드로이드 WebXR, 아이폰 Quick Look)
- **가벼운 상호작용**: 탭하면 꼬리 흔들기, AR 화면 저장·공유

보호소 방문을 대체하지 않고, 만나러 가기 전에 우리 집에 맞는지 미리 확인하도록 돕습니다.

## 🖥️ 화면 구성

| 화면 | 내용 |
| --- | --- |
| 둘러보기 | AR로 볼 수 있는 아이 토글, 최근 공고순·오래 기다린 순 정렬, 오래 기다린 아이들, 찜 |
| 필터 | 지역·품종(마릿수 표시), 크기 소형·중형·대형 |
| 찜한 아이 | 찜 목록, 입양 완료 표시 |
| 상세 | 크기 카드(체고·체중·체형), 공고 정보, 보호소 정보, 상태별 안내(1살 미만, AR 없음, 체중 없음, 공고 기간 중, 입양 완료) |
| AR | 안내 → 바닥 찾기 → 실제 크기로 배치(탭하면 반응) → 캡처 저장·공유 |
| 로그인·회원가입 | 카카오·아이디 로그인 |
| 관리자 (데스크톱) | AR 모델 만들기 목록, 한 마리 만들기(적합도 확인), 생성 기록 |

상세 기획은 [docs/project-plan.md](docs/project-plan.md) 참고.

## 🛠️ 기술 스택

### Core

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)

### 상태 관리 / 데이터 통신

<!-- 확정 후 배지 추가 -->

### 스타일링 / UI

<!-- 확정 후 배지 추가 -->

### 라우팅

<!-- 확정 후 배지 추가 -->

### CI/CD

<!-- 확정 후 배지 추가 -->

### Mocking

![MSW](https://img.shields.io/badge/MSW-FF6A33?style=for-the-badge&logo=mockserviceworker&logoColor=white)

## 👥 Frontend Team

<div align="center">

| <img src="https://github.com/anjaein.png" width="120" /> |
| :---: |
| **안재인** |
| 담당자 |
| [@anjaein](https://github.com/anjaein) |

</div>

## 🚀 시작하기

```bash
# 도메인으로 가기!

```

## 📁 폴더 구조

```
src/
├── apis/          # Axios 인스턴스와 API 함수
├── assets/        # 이미지·아이콘 등 정적 리소스
├── components/    # 공용 UI 컴포넌트
├── constants/     # 상수 정의
├── hooks/         # 커스텀 훅
├── mocks/         # MSW 핸들러
├── pages/         # 라우트 단위 페이지
├── routes/        # 라우팅 설정
├── styles/        # 디자인 토큰 및 전역 스타일
├── types/         # 공용 타입 정의
└── utils/         # 유틸 함수
```
