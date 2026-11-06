# 반응형·인터랙션 정책

프론트 개발자를 위한 반응형·인터랙션 기준이에요. 다른 프로젝트의 정책 문서(2026-11-05)를 LovablePet에 맞게 고쳐 정리했어요.

- 여기 없는 세부 모양은 [디자인 캔버스](https://claude.ai/artifact/WtedaDRe9NooiWF3odAjHH)를 따라요.
- 여기 없거나 맞지 않는 경우는 개발자가 판단해요. 그렇게 정한 것은 이 문서에 바로 추가해 주세요.
- 원문과 다르게 정한 것은 [원문과 달라진 점](#원문과-달라진-점)에 모아 뒀어요.

## 화면 구조

LovablePet은 휴대폰으로 강아지를 우리 집 바닥에 놓아 보는 서비스라 사용자 화면은 휴대폰 한 장 크기로 만들어요.

| 화면 | 폭 | 기준 코드 |
| --- | --- | --- |
| 사용자 화면 (둘러보기·상세·찜·마이·로그인) | 모바일은 전체 폭, 태블릿부터 **480px 가운데** | `TabLayout`, 각 페이지의 `max-w-[480px]` |
| 관리자 화면 (목록·관리) | 본문 **최대 1160px 가운데** | `AdminLayout`의 `CONTAINER` |

## 반응형·뷰포트

### 브레이크포인트

| 이름 | 폭 | Tailwind |
| --- | --- | --- |
| 모바일 | ~767px | (기본) |
| 태블릿 | 768px~899px | `tablet:` |
| 데스크톱 | 900px~ | `desktop:` |

`src/styles/tokens.css`의 `--breakpoint-tablet`, `--breakpoint-desktop`이에요. Tailwind 기본 `sm:`, `md:`, `lg:`는 쓰지 않아요.

### 컨테이너와 여백

| | 모바일 | 태블릿 | 데스크톱 |
| --- | --- | --- | --- |
| 관리자 좌우 여백 | 20px | 32px | 40px |
| 사용자 화면 좌우 여백 | 20px (`px-5`). 480px 안이라 화면 폭과 상관없이 같아요 | | |

- 관리자는 `box-content max-w-[1160px]`라서 1160px는 여백을 뺀 본문 폭이에요.
- 사용자 화면은 넓은 화면에서도 480px 그대로 가운데 정렬해요. 입력 화면 672px, 목록 1160px 기준은 쓰지 않아요.

### 최소 지원 너비

**320px**이에요. `body { min-width: 320px }`를 걸었고, 320px에서 가로로 넘치는 요소가 없어야 해요.

- 상세 하단 바는 360px보다 좁으면 '보호소 문의'를 전화 아이콘만 남겨서 '우리 집에 놓아 보기' 글자가 들어가게 했어요 (`max-[359px]:`).

### viewport meta

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
```

- `viewport-fit=cover`: 이게 있어야 아이폰에서 `env(safe-area-inset-*)` 값이 들어와요.
- `interactive-widget=resizes-content`: 안드로이드 크롬에서 키보드가 뜨면 화면 높이가 줄어요. 아래 [가상 키보드](#가상-키보드)를 보세요.
- 확대는 막지 않아요 (접근성). `maximum-scale`, `user-scalable=no`는 쓰지 않아요.
- 입력창 자동 확대는 **입력 글자 16px**로 막아요. `Field`, 필터 체중 칸이 `text-emphasis`(16px)예요. 관리자 select는 모바일 16px, 태블릿부터 14px이에요.

### Safe area

| 위치 | 적용 |
| --- | --- |
| 위 | 각 화면 맨 바깥에 `pt-[env(safe-area-inset-top)]` (`TabLayout`, 로그인·회원가입, 관리자 헤더 등). 상세는 사진을 노치 밑까지 깔고, 뒤로·공유 버튼만 `top-[calc(8px+env(safe-area-inset-top))]`로 피해요 |
| 아래 | 하단 탭, 상세 하단 바, 시트 버튼 영역, 화면 맨 아래 버튼·링크에 `env(safe-area-inset-bottom)`을 더해요 |

안드로이드와 아이폰 모두 같은 `env()` 코드로 처리돼요. 좌우(가로 모드 노치)는 480px 가운데 정렬이라 따로 넣지 않았어요.

### 100vh 문제

`100vh` 대신 `dvh`를 써요 (`min-h-dvh`, 시트 높이 `100dvh`).

### 가상 키보드

목표는 두 가지예요. 입력창이 키보드에 가려지지 않아야 하고, 하단 고정 버튼은 키보드 위에 붙어서 따라와야 해요.

| | 기본 동작 | 우리 처리 |
| --- | --- | --- |
| 안드로이드 | 키보드가 화면 위를 덮음 | `interactive-widget=resizes-content`로 화면 높이가 줄어요. `dvh`와 `fixed bottom`이 그대로 키보드 위로 와요 |
| 아이폰 | 키보드가 화면을 덮고, 입력창이 보이게 페이지를 밀어 올림 | `useKeyboardInset`이 `visualViewport`로 가린 높이를 재서 `--keyboard-inset`에 넣어요 |

- `src/hooks/useKeyboardInset.ts`는 `RootLayout`에서 한 번만 불러요.
  - 120px보다 작은 변화는 주소창이라 키보드로 보지 않아요.
  - 손가락으로 확대한 상태도 키보드로 보지 않아요.
  - 키보드가 뜨면 입력 중인 칸을 `scrollIntoView({ block: 'nearest' })`로 보이게 해요.
- 입력이 있는 하단 고정 영역은 지금 **필터 시트**뿐이에요. 시트 높이에서 `--keyboard-inset`만큼 빼서 아래 버튼 영역이 키보드 위에 붙어요.
- 새로 입력 + 하단 고정 버튼 화면을 만들면 `bottom`이나 `margin-bottom`에 `var(--keyboard-inset)`을 더해 주세요.

### 터치 영역

아이콘 크기와 상관없이 누를 수 있는 요소는 **44×44px 이상**이에요.

- 보이는 크기를 키울 수 없으면 `touch-target` 유틸리티를 붙여요. 투명한 `::after`로 누르는 영역만 44px로 넓혀요.
- 지금 붙어 있는 곳: `IconButton` sm(40px, 카드 위 찜), `Chip` sm(30px), 정렬 토글(30px), `Toggle`(32px), 글자 링크(회원가입 등)
- `touch-target`은 `absolute`, `fixed`, `sticky`가 아니면 `relative`를 스스로 붙여요.

### 스크롤 바운스

| | 대상 |
| --- | --- |
| 허용 | 기본값 (페이지 스크롤) |
| 막기 | 오버레이 안(`overscroll-contain`), 가로 목록·사진 넘기기(`overscroll-x-contain`) |

지도는 아직 없어요.

### sticky hover 문제

모바일에서는 hover가 동작하지 않아요. Tailwind v4의 `hover:`는 `@media (hover: hover)` 안에 들어가서, 터치 기기에서 누른 뒤 hover 모양이 남지 않아요. 그래서 `hover:`를 그대로 쓰면 돼요.

## 인터랙션

### 모션 토큰

애니메이션 시간과 가속 곡선을 몇 가지로 정해서 통일해요.

| 이름 | 시간 | 쓰는 곳 | 클래스 |
| --- | --- | --- | --- |
| fast | 200ms | 색 변화, 버튼 누름, 호버 | `transition` (기본값) |
| base | 300ms | 시트·모달 열림, 토스트, 사진 fade-in | `transition duration-base`, `animate-sheet-up` 등 |
| slow | 450ms | 화면 진입, 큰 레이아웃 변화 | `transition duration-slow`, `animate-rise-in` |

- 시간은 `src/index.css`의 `--duration-fast`, `--duration-base`, `--duration-slow`예요.
- `transition`만 쓰면 Tailwind 기본값(`--default-transition-duration`)이 200ms라서 fast가 돼요.
- `duration-300` 같은 숫자 클래스 대신 `duration-base`처럼 이름을 써 주세요.

### 가속 곡선

`cubic-bezier(.16, 1, .3, 1)`이에요. `transition`의 기본 곡선이고, `ease-standard` 클래스와 모든 `animate-*`가 이 곡선을 써요.

**움직임 줄이기**: OS에서 '동작 줄이기'를 켜면 모든 애니메이션·전환을 거의 0으로 줄여요 (`prefers-reduced-motion`, `src/index.css`).

### 누를 수 있는 요소의 상태

| 상태 | 모습 | 코드 |
| --- | --- | --- |
| 기본 | - | |
| 호버 | 마우스 기기에서만 배경을 한 단계 진하게 해요 (가장 진한 `ink`는 한 단계 밝게). 사진 카드는 사진을 키워요 | `hover:bg-*-hover` 토큰 (`tokens.css`) |
| 누름 | 살짝 작아져요 | `active:scale-99` |
| 포커스 | 키보드로 이동할 때만 테두리 2px | `focus-visible:outline-2` |
| 비활성 | 흐리게, 누를 수 없음, 커서 기본 | `disabled:opacity-45 disabled:pointer-events-none` |

`Button`, `IconButton`, `Chip`, `Toggle`에는 이미 들어 있어요. 직접 만든 버튼과 링크 카드에도 같은 세 가지(호버·누름·포커스)를 붙여 주세요.

### 오버레이

| | 모양 |
| --- | --- |
| 모바일 | 바텀시트 (하단 고정, 위쪽만 둥글게, 손잡이). 아래에서 올라와요 (`sheet-up`, base) |
| 태블릿·데스크톱 | 가운데 모달 (손잡이 없음, 최대 높이 760px). 살짝 떠오르며 나타나요 (`modal-in`, base) |

- 열려 있으면 뒤 페이지 스크롤을 잠가요 (`html`, `body` 둘 다 `overflow: hidden`).
- 시트 안을 끝까지 스크롤해도 뒤 페이지는 스크롤되지 않아요 (`overscroll-contain`).
- 닫는 방법은 네 가지예요: 배경 탭, ESC, X 버튼, **뒤로가기**. 뒤로가기는 페이지 이동 대신 오버레이만 닫아요.
  - `useOverlay(name)`가 열림 상태를 방문 기록(`history.state`)에 남겨서 그렇게 돼요.
  - 오버레이 안에서 주소를 바꾸며 닫을 때(필터 적용)는 `replace`로 이동해요. 그러면 오버레이 기록이 새 주소로 바뀌면서 같이 닫혀요. 그 뒤 뒤로가면 시트를 열기 전 조건으로 돌아가요.
- 코드: `src/components/BottomSheet/BottomSheet.tsx`, `src/hooks/useOverlay.ts`
- 닫힐 때 애니메이션은 없어요. 바로 사라져요.

### 토스트

- 위치는 하단 가운데예요. 하단 바(탭, 상세 버튼 바)가 있으면 그 위에 떠요.
  - 하단 바에 `data-bottom-bar="tab"` 또는 `"action"`을 달면 `--toast-offset`이 바뀌어요 (`src/index.css`).
  - 새 하단 고정 바를 만들면 이 속성을 달아 주세요.
- 노출 시간은 3초예요 (`FLASH_DURATION`).
- 아래에서 살짝 올라오며 나타나요 (`toast-in`, base). 같은 문구를 다시 띄워도 다시 움직여요.
- `useFlash()`로 띄워요.

### 화면 진입

- 페이지를 이동하면 스크롤이 맨 위로 가요. 뒤로가기는 제외해요.
  - `RootLayout`의 `<ScrollRestoration />`이 처리해요.
  - 같은 화면 안에서 주소만 바꿀 때(필터·정렬·AR 칩, 시트 열기, 관리자 목록 조건)는 `preventScrollReset: true`로 스크롤을 그대로 둬요.
- 요소 등장 애니메이션
  - 대상은 목록 아이템이에요: 둘러보기 카드, 오래 기다린 아이들, 찜 목록.
  - 헤더, 탭, 버튼, 글 같은 고정 UI에는 쓰지 않아요.
  - 아래에서 12px 올라오며 나타나요. 카드마다 60ms씩 순서대로예요 (`animate-rise-in`, slow).
  - 한 번에 받은 목록이 길어도 11번째 카드부터는 같이 나와요 (최대 600ms 지연).
  - 캐시에서 바로 보인 목록과 뒤로가기로 돌아온 목록은 **움직이지 않아요**. 첫 응답과 다음 페이지처럼 새로 받은 묶음만 움직여요.
  - 코드: `src/hooks/useEntranceStagger.ts`

### 레이아웃 쉬프트

**아직 확정하지 않았어요 (pending).** 스켈레톤이 어색한 곳은 개발자가 판단해요.

- 불러오는 중인 영역은 실제 콘텐츠 크기만큼 자리를 미리 잡아요. 예: 카드 스켈레톤, 마릿수 자리 `–`
- 사진은 비율이나 크기를 고정해요 (`aspect-square`, `h-37`, `size-22`, `h-90`). 그래서 불러온 뒤에도 높이가 바뀌지 않아요.

### 이미지 로딩

- 스켈레톤은 카드 단위로 써요 (`PetCardSkeleton`, `FavoriteCardSkeleton`, 상세·관리자 스켈레톤).
- 모양은 실제 콘텐츠와 같은 크기, 위치, 모서리예요.
- 움직임은 shimmer예요 (`skeleton` 유틸리티). 예전 `animate-pulse`는 쓰지 않아요.
- 사진이 다 불러와지면 fade-in으로 나타나요 (`PetPhoto`, base). 캐시에 있던 사진도 처리해요.
- 사진을 못 불러오면 기존 빗금 자리와 '공고 사진' 문구를 보여 줘요 (`photo-placeholder`).

### 뒤로가기

- 이전 스크롤 위치를 복원해요. 위치는 방문 기록 하나하나(`location.key`)마다 따로 저장해요. 그래서 같은 주소라도 기록이 다르면 위치가 달라요.
  - 목록은 TanStack Query 캐시로 바로 다시 그려지고, 사진 자리가 고정이라 높이가 같아요. 그래서 위치가 정확히 맞아요.
- 오버레이가 켜져 있으면 오버레이를 닫아요 ([오버레이](#오버레이)).
- 앱 안 기록이 없으면(주소로 바로 들어온 경우) 화면의 뒤로 버튼은 둘러보기나 지정한 화면으로 가요 (`useGoBack`, `AuthHeader`).

### 영상 재생

지금은 영상이 없어요. AR 모델 미리보기(6단계)를 넣을 때 아래를 따라요.

- 목록과 카드는 썸네일만 써요.
- 자동 재생은 무음이고, 사용자가 조작하면 소리가 나요.

### hover zoom

| 대상 | 움직임 |
| --- | --- |
| 공고 사진 카드 (둘러보기, 오래 기다린 아이들, 찜) | 카드 안 사진이 4% 커져요 (`zoomOnHover`, 테두리는 넘지 않음) |
| 화살표 | 진행 방향으로 2px 움직여요 (마이 메뉴 →, 뒤로 버튼 ←) |

모바일에서는 동작하지 않아요.

## 원문과 달라진 점

| 항목 | 원문 | LovablePet | 이유 |
| --- | --- | --- | --- |
| 사용자 화면 폭 | 입력 672, 목록 1160 | 480px 한 칸 | 휴대폰 AR 서비스이고, 디자인 캔버스가 모바일 기준이에요 |
| 관리자 폭 | 1160 | 1160 (캔버스는 1200) | 원문 기준에 맞췄어요 |
| 비활성 | 회색 바탕 + 비활성 글자색 | 흐리게 (`opacity-45`) | 디자인 캔버스가 흐림 처리예요. 색마다 비활성 색을 따로 두지 않아요 |
| 가장 진한 버튼 호버 | 한 단계 진하게 | 한 단계 밝게 (`ink-hover`) | `ink`보다 진한 색이 없어요 |
| 움직임 줄이기 | 없음 | 애니메이션을 거의 0으로 | 접근성 |
| 목록 등장 | 항상 | 새로 받은 묶음만 | 뒤로가기마다 다시 움직이면 어지러워요 |
| 영상, 지도 | 있음 | 지금은 없음 | 해당 기능이 아직 없어요 |

## 실기기에서 확인할 것

헤드리스 브라우저로는 확인하지 못한 것들이에요.

- 아이폰 사파리
  - 필터 시트에서 체중 칸을 누르면 아래 버튼이 키보드 위에 붙는지
  - 입력칸이 가려지지 않는지
- 아이폰
  - 노치나 홈 바에 버튼·탭이 가리지 않는지 (세로, 가로)
- 안드로이드 크롬
  - 키보드가 뜰 때 시트 높이가 줄어드는지
- 터치 기기
  - 누른 뒤 hover 모양이 남지 않는지

## 새 화면 만들 때 확인

- [ ] 320px에서 가로로 넘치지 않는다
- [ ] 위, 아래 고정 요소에 safe area가 들어갔다
- [ ] 누를 수 있는 것은 44px 이상이다 (아니면 `touch-target`)
- [ ] 버튼·링크 카드에 호버, 누름(`active:scale-99`), 포커스(`focus-visible`)가 있다
- [ ] 입력 글자가 16px이다
- [ ] 같은 화면 안 주소 변경은 `preventScrollReset`을 쓴다
- [ ] 시트·모달은 `BottomSheet` + `useOverlay`로 만든다
- [ ] 하단 고정 바에 `data-bottom-bar`를 달았다
- [ ] 불러오는 중에는 같은 크기의 `skeleton` 자리를 보여 준다
- [ ] 시간·곡선은 모션 토큰을 쓴다
