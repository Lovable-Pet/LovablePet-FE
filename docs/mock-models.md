# AR 모델 묶음: 진도형 9마리 (AI 저장소에서 보냄, 2026-11-07)

> FE에 넣으면서 고친 점: `usdzUrl`은 `PetModelView` DTO에 추가했고, AR 화면은 `src/pages/ArPage.tsx`, 명령 재생은 `src/features/ar/dogAnimator.ts`입니다. 모델 파일(약 165MB)은 git에 없으니 AI 저장소 담당에게 받아 `public/mock/`에 풀어 주세요.

실제 보호소 공고 사진으로 파이프라인이 만든 진도형 AR 모델 9마리입니다. 시험하는 방법은 두 가지입니다.

- **A. 스프링에 연결해서(실제 흐름):** 로컬 스프링 + 가짜 파이프라인 + 프론트. 관리자 'AR 만들기'부터 상세, AR 화면까지 진짜 API로 돕니다.
- **B. 프론트 목업만(MSW):** 스프링 없이 화면만 봅니다.

압축은 **FE 저장소 루트**에 풉니다. 아래가 들어갑니다.

| 경로 | 내용 |
|---|---|
| `public/mock/models/<유기번호>/<유기번호>-mock.glb`, `.usdz` | 모델 (B에서 쓰고, A의 가짜 파이프라인도 여기서 읽음) |
| `public/mock/samples/<유기번호>.jpg` | 공고 사진 (B) |
| `src/mocks/fixtures/samplePets.ts` | `PetDetail` 모양 목업 데이터, id 201~209 (B) |
| `fake-pipeline/fake-pipeline.mjs`, `samples.json` | 가짜 파이프라인 (A) |

파일이 크니(약 165 MB) `public/mock/models/`, `public/mock/samples/`는 `.gitignore`에 넣고 커밋하지 마세요.

## A. 스프링에 연결해서 시험

스프링은 원래 Python 파이프라인(`localhost:8000`)을 부릅니다. 그 자리에 **가짜 파이프라인**을 띄웁니다.

- 스프링의 실제 코드가 그대로 돕니다: 적합도 확인 → 작업 등록 → 콜백 → GLB·USDZ 다운로드·저장 → 상세 API의 `model` → `/models/...` 파일 제공.
- 모델은 새로 만들지 않습니다. 진도 9마리 중 같은 유기번호가 있으면 그 개, 없으면 **체중이 가장 가까운 개**의 GLB·USDZ를 돌려줍니다.
- 비용과 외부 호출이 없고, 15초면 끝납니다.

1. **스프링 띄우기 (IntelliJ)**
   - BE 저장소(LovablePet-BE, `dev` 브랜치)를 IntelliJ로 엽니다. Gradle JDK는 21입니다(Settings → Build Tools → Gradle → Gradle JVM).
   - BE 폴더 터미널에서 `docker compose up -d`로 로컬 Postgres를 띄웁니다(Docker Desktop이 켜져 있어야 합니다).
   - `LovablePetApplication`을 실행합니다. 프로필은 기본이 `local`이라 파이프라인 주소(`localhost:8000`)와 키(`local-dev-key`), DB가 모두 기본값으로 맞습니다.
   - Run Configuration → Environment variables에 `DATA_GO_KR_SERVICE_KEY=<공공데이터 키>`를 넣습니다.
     동물 목록이 있어야 만들 수 있는데, 이 키가 있으면 띄우고 1분 뒤 공고를 동기화합니다. 키가 비어 있으면 동기화를 건너뛰어 목록이 비어 있습니다.
   - 'AR 만들기'는 관리자만 됩니다. 가입한 뒤 DB에서 역할을 바꿉니다.
     `docker exec -it lovablepet-postgres psql -U lovablepet -d lovablepet -c "UPDATE member SET role='ADMIN' WHERE id=<내 id>;"`
   - 화면 없이 확인하려면 Swagger(`http://localhost:8080/swagger-ui.html`)의 관리자 API로도 됩니다.
   - **공공데이터 키가 없으면** 시험용 동물을 DB에 직접 넣습니다.
     - 사진 주소는 스프링이 내려받을 수 있기만 하면 되고, 사진 내용은 보지 않습니다. 프론트 개발 서버가 떠 있으면 이 묶음의 사진을 쓰면 됩니다.
     - 유기번호를 샘플과 같게 넣으면 그 개의 모델이, 다르게 넣으면 체중이 가장 가까운 샘플이 나옵니다.
     ```sql
     INSERT INTO pet (desertion_no, notice_no, kind_name, color, age_text, birth_year, weight_text, weight_kg, sex, neutered,
                      process_state, notice_start, notice_end, listed, org_name, care_name, photo_urls, raw, synced_at)
     VALUES ('444461202600256', '시험-2026-00001', '진도견', '갈색', '2024(년생)', 2024, '15.0(Kg)', 15.0, 'M', 'N',
             '보호중', '2026-10-20', '2026-10-30', true, '경기도 시험시', '시험보호소',
             ARRAY['http://localhost:5173/mock/samples/444461202600256.jpg'], '{}'::jsonb, now());
     ```
     실행은 `docker exec -it lovablepet-postgres psql -U lovablepet -d lovablepet`에서 합니다.
2. **가짜 파이프라인 띄우기**: `node fake-pipeline/fake-pipeline.mjs` (Node 18 이상, 설치할 것 없음)
   - 포트 8000과 키 `local-dev-key`는 스프링 local 기본값과 같아서 따로 설정할 게 없습니다.
3. **프론트**: `.env.development.local`에 아래 두 줄을 넣고 `pnpm dev`를 실행합니다.
   ```
   VITE_ENABLE_MOCK=false
   API_PROXY_TARGET=http://localhost:8080
   ```
4. 관리자 화면에서 개를 고르고 'AR 만들기'를 누릅니다.
   - 약 15초 뒤 완성되고, 상세의 `model.glbUrl`·`usdzUrl`(`/models/<유기번호>/<jobId>.glb|.usdz`)로 AR 화면에서 열립니다.
   - 파일은 스프링이 `./storage/models/`에 저장한 것입니다.
5. **실패 화면 시험**: `FAKE_OUTCOME`을 바꿔 띄웁니다.
   - `photo_rejected`: 사진 거부
   - `failed`: 서버 오류
   - `unsuitable`: 부적합. 진짜처럼 강제 생성이 아닐 때(`fit_stop=true`)만 납니다.
   - 예(PowerShell): `$env:FAKE_OUTCOME="photo_rejected"; node fake-pipeline/fake-pipeline.mjs`
   - 그 밖에 `FAKE_JOB_SECONDS`(기본 15)와 `PORT`, `FAKE_PIPELINE_KEY`도 바꿀 수 있습니다.

**확인한 것** (11-07, LovablePet-BE `dev` + 이 가짜 파이프라인, 로컬)
- **완성:** 적합도 good → 생성 202(PENDING) → DONE → 상세 `model`에 `glbUrl`·`usdzUrl`이 들어오고, `GET /models/...`는 로그인 없이 GLB·USDZ를 줍니다(샘플과 같은 바이트).
  - 샘플과 같은 유기번호는 그 개, 샘플에 없는 3 kg 개는 체중이 가장 가까운 5.69 kg 샘플이 나옵니다.
- **`FAKE_OUTCOME=failed`:** FAILED, 상세 `model`은 null입니다.
- **`FAKE_OUTCOME=photo_rejected`:** 적합도가 poor이고 `photoRejected=["person_covers"]`, `canGenerate=false`입니다. 이때 생성하면 400 `GENERATION_400_PHOTO_REJECTED`가 납니다.

**주의**
- 모델이 그 개 자신은 아닙니다. 진도 샘플 중 하나라 생김새와 털색이 다르고, 크기도 그 샘플의 실제 크기입니다. 예를 들어 3 kg 몰티즈를 만들면 체고 33 cm짜리 진도가 나옵니다.
- 스프링에는 하루 생성 상한(`PET_PIPELINE_DAILY_LIMIT`, 기본 30)이 있습니다.
- 진짜 모델로 시험하려면 가짜 대신 AI 저장소의 파이프라인을 띄우면 됩니다. 이 경우 한 마리에 약 $0.15~0.2가 듭니다.

## B. 프론트 목업만(MSW)

1. 목업 데이터에는 이미 연결돼 있습니다(`src/mocks/fixtures/pets.ts`가 `samplePets`를 붙이고, 다른 목업 개도 `sampleModelFor`로 체중이 가장 가까운 샘플 모델을 씁니다). 모델 파일만 받아 `public/mock/models/`, `public/mock/samples/`에 두면 됩니다.
2. `.env.development.local`에 `VITE_ENABLE_MOCK=true`를 넣고 `pnpm dev`를 실행합니다. 목록의 '입양 가능'에 9마리가 나옵니다.
3. 목업 주소는 `/mock/models/...`입니다. `vite.config.ts`가 `/models`를 백엔드로 프록시하기 때문에 `public/models`에는 둘 수 없습니다.
   화면 코드는 `resolveModelUrl(model.glbUrl)` 그대로면 A와 B 모두 동작합니다.

## 모델 쓰는 법 (A·B 같음)

- **`usdzUrl`:** 백엔드 `PetModelView`에 이미 있습니다(아이폰 Quick Look용, model-viewer의 `ios-src`). FE DTO에 `usdzUrl: string | null`을 추가해 주세요.
- **크기:** GLB는 이미 미터 단위 실제 크기입니다. AR에서 scale을 다시 조정하지 마세요. `withersM`은 표시용입니다.
- **애니메이션:** 9마리 모두 클립이 13개입니다.
  `idle, standing, sitting, shake, tail_wag, bark, lying, sit_down, stand_up, lie_down, get_up, play_dead, rollover`
  - 대기 루프는 `standing`입니다.
  - 클립 이름은 GLB에서 읽어 쓰세요(three.js `gltf.animations`, model-viewer `availableAnimations`). 다른 견종 모델은 `idle`, `tail_wag` 2개뿐입니다.
  - 명령(앉아·엎드려·일어나·손·굴러·짖어·빵)의 재생 흐름과 코드는 AI 저장소의 `docs/ANIMATION.md`에 있습니다.
  - 백엔드 Swagger의 "애니메이션 이름은 idle, tail_wag 고정"은 예전 설명입니다.
- **탭 반응:** `behavior.tapAnimation`을 한 번 재생한 뒤 대기 루프로 돌아갑니다. `behavior.playbackRate`는 `AnimationMixer.timeScale`입니다.
- **아이폰 USDZ:** `standing` 하나만 반복합니다. Quick Look에서는 탭과 명령이 안 됩니다.
- 모델을 다시 만들면 **같은 파일 이름**으로 보내 드립니다. 덮어쓰기만 하면 됩니다.

## 샘플 목록

| id | 유기번호 | 품종(공고) | 체중(kg) | 털색(공고) | 체고(m) |
|---|---|---|---|---|---|
| 201 | 441407202600741 | 진도견 | 25 | 크림색 | 0.541 |
| 202 | 447510202600669 | 믹스견 | 15 | 황갈색 | 0.457 |
| 203 | 444461202600256 | 진도견 | 15 | 갈색 | 0.457 |
| 204 | 413587202600172 | 믹스견 | 5.69 | 갈색&흰색 | 0.331 |
| 205 | 441399202601337 | 믹스견 | 18 | 검정색 | 0.485 |
| 206 | 441554202601431 | 진도견 | 7 | 흑갈색 | 0.354 |
| 207 | 447508202601188 | 진도견 | 19.4 | 호반색(호랑이무늬) | 0.497 |
| 208 | 427342202600461 | 믹스견 | 16 | 회색 | 0.467 |
| 209 | 441383202600291 | 믹스견 | 15 | 흑백 | 0.457 |
