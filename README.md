# 거상 육의전 시세 모니터링

geota.co.kr 육의전 매물을 주기적으로 수집해서 Supabase에 쌓고,
"저평가 매물"(워치리스트 중앙값 대비 -10% 이하)을 GitHub Pages 대시보드에 표시.
**실행(구매)은 자동화하지 않음** — 사이트에서 확인하고 실제 매수는 사람이 직접 판단.

대시보드: https://klee0982-droid.github.io/gersang-watchlist/

## 구조

- `lib/scrapeGeota.js` — 페이지 fetch + 파싱 (Next.js RSC 페이로드 `self.__next_f`의 매물 JSON 추출)
- `lib/config.js` — 기준값 전부 여기서 관리 (임계값, 서버, 페이지 수 등)
- `lib/alert.js` — 워치리스트 대비 저평가 판정 + `gersang_alerts` 테이블 기록 + 중복 기록 방지
- `lib/renderSite.js` — 대시보드 HTML 렌더링 (순수 함수, DB 접근 없음)
- `scripts/diagnose.js` — 1회성 진단 (실제 파싱이 되는지 눈으로 확인)
- `scripts/collect.js` — 수집 + 저장 + 저평가 판정 (기본 15분마다, FAST_MODE 켜면 2분마다)
- `scripts/updateWatchlist.js` — 그룹A(최다등록 20개)/그룹B(1,000만원 이상) 통계 갱신 (매일 새벽 3시)
- `scripts/cleanupListings.js` — 오래된 원본 매물/알림 기록 삭제 (매일 새벽 3시, Supabase 용량 관리)
- `scripts/generateSite.js` — Supabase 데이터로 `site/index.html` 생성 (수집/갱신 후 매번 실행)
- `.github/workflows/scrape.yml` — GitHub Actions 스케줄 + GitHub Pages 배포 + 월간 점검 이슈 생성

## 최초 설정

### 1. 저장소 생성 및 코드 업로드

\`\`\`bash
cd gersang-watchlist
git init
git add .
git commit -m "init"
# GitHub에서 새 repo 만든 뒤
git remote add origin <repo-url>
git push -u origin main
\`\`\`

GitHub Pages는 **private repo에서 Free 플랜으로는 사용할 수 없음** — repo를 public으로
만들거나 GitHub Pro 이상이 필요함. 코드에는 민감정보가 없고(키는 전부 Actions
secrets로 관리), 표시되는 시세 데이터도 geota.co.kr에 이미 공개된 정보라
public repo로 운영해도 무방함.

### 2. 로컬 환경변수 설정

\`\`\`bash
cp .env.example .env
\`\`\`

`.env`에 아래 값을 채워넣기:

- `SUPABASE_URL`: 이미 채워져 있음 (`https://hvvxequwyjqbgxmnavbz.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase 대시보드 → 해당 프로젝트 → Settings → API →
  "service_role" 키 (⚠️ anon/publishable 키 아님. RLS를 우회해야 쓰기가 되므로 service_role 필요)

### 3. 1단계 진단 — 실제 파싱이 되는지 먼저 확인

\`\`\`bash
npm install
npm run diagnose
\`\`\`

10개 내외 매물이 정상적으로 출력되면 성공. **0개가 나오면 GitHub Actions를
걸기 전에 반드시 `lib/scrapeGeota.js`의 패턴을 다시 확인해야 함** —
저에게 `npm run diagnose` 출력 결과와 함께 다시 요청하면 그 자리에서 고쳐드릴 수 있어요.

### 4. GitHub repo secrets 등록

repo → Settings → Secrets and variables → Actions → New repository secret:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 5. GitHub Pages 활성화

repo → Settings → Pages → Build and deployment → Source를
**"GitHub Actions"**로 설정 (브랜치 배포 방식 아님).

### 6. 활성화

`.github/workflows/scrape.yml`이 push되는 순간부터 스케줄이 자동으로 돌아감.
Actions 탭에서 "Run workflow"로 수동 실행도 가능. 첫 실행 후 위 대시보드
URL에서 확인.

## 수집 주기: 기본(15분) vs 플레이 중(2분)

시세를 계속 파악하는 것(DB 적재)과 실제로 매수 타이밍을 잡는 것(빠른 반응)은
목적이 달라서 둘로 나눠놨음:

- **기본 주기(15분)**: 항상 자동으로 돌아감. 별도 조작 불필요.
- **빠른 주기(2분)**: `FAST_MODE`라는 GitHub 저장소 변수가 `true`일 때만 실제로
  수집함. 게임 할 때만 켜두면 됨.

**켜고 끄는 법** — repo → Settings → Secrets and variables → Actions →
**Variables** 탭 → `FAST_MODE` 값을 `true`/`false`로 수정.
(또는 터미널에서: `gh variable set FAST_MODE --body true` / `--body false`)

끄는 걸 잊어도 큰 문제는 없음 — 기본 주기는 항상 별도로 돌아가니까 데이터가
끊기진 않고, 다만 `FAST_MODE`를 켜둔 채로 오래 두면 아래 저장공간 정리
주기보다 데이터가 더 빨리 쌓일 수 있음.

## 월간 점검 알림

이 시스템은 껐다 켰다 하는 스위치가 없어서 — 잊고 방치하면 계속 도는 구조임.
그래서 매달 1일 09:00 KST에 워크플로우가 이 repo에 GitHub 이슈를 자동으로
하나 만듦 ("계속 쓰시나요?"). GitHub 알림(이메일/웹)으로 뜨니, 계속 쓸 거면
이슈를 닫고, 그만 쓸 거면 repo → Settings → Actions → General에서
Actions를 꺼주면 됨 — 그러면 geota 요청/Supabase 적재가 전부 멈춤.

## Supabase 저장공간 관리

`gersang_listings`는 수집 때마다 그 시점 매물을 새 행으로 계속 추가만 하고
지우지 않으므로 무한정 쌓임. 이 프로젝트가 다른 앱과 Supabase 무료 티어
(500MB)를 같이 쓰고 있어서, 방치하면 몇 달 안에 한도를 채울 수 있음.

`updateWatchlist.js`는 최근 `STATS_WINDOW_DAYS`(45일)만 보므로 그보다 오래된
원본 데이터는 다시 쓰이지 않음 — 그래서 `scripts/cleanupListings.js`가 매일
새벽 3시에 `LISTING_RETENTION_DAYS`(60일)/`ALERT_RETENTION_DAYS`(90일)보다
오래된 행을 삭제함.

## 튜닝 포인트 (`lib/config.js`)

| 값 | 기본값 | 의미 |
|---|---|---|
| `PAGES_PER_SERVER` | 10 | 회당 몇 페이지까지 긁을지 (서버 1개만 추적하므로 여유 있게) |
| `TOP_N_FREQUENT` | 20 | 최다등록 상위 몇 개를 그룹A로 볼지 |
| `HIGH_VALUE_THRESHOLD` | 10,000,000 | 그룹B 기준 가격 |
| `DEVIATION_ALERT_PCT` | 0.10 | 중앙값 대비 몇 % 낮으면 대시보드에 표시할지 (자본 효율 우선으로 넓게 잡음) |
| `MIN_SAMPLES_FOR_STATS` | 2 | 통계 낼 최소 샘플 수 (낮을수록 그룹B 편입은 늘지만 노이즈도 늘어남) |
| `STATS_WINDOW_DAYS` | 45 | 중앙값 계산에 쓸 관측 기간 |
| `ALERT_DEDUPE_MINUTES` | 90 | 같은 매물 중복 기록 방지 시간 |
| `LISTING_RETENTION_DAYS` | 60 | 원본 매물 기록 보관 기간 (이후 자동 삭제) |
| `ALERT_RETENTION_DAYS` | 90 | 알림 기록 보관 기간 (이후 자동 삭제) |

## 알려진 한계

- 파싱은 2026-08 실제 raw HTML을 확인하고 RSC 페이로드(`self.__next_f`)의
  매물 JSON을 직접 뽑는 방식으로 짰음. geota.co.kr이 데이터 스키마(필드명
  `itemName`/`price`/`totalQuantity`/`sellerName`)나 렌더 방식을 바꾸면
  `diagnose`에서 0건이 나올 수 있음. `tests/parse.test.mjs`가 실제 HTML
  픽스처로 이 스키마를 검증하므로, 구조 변경 시 테스트가 먼저 깨져 알려줌.
- "등록가"만 보므로 실제 체결 가능 여부(이미 팔렸는지 등)는 확인 못 함 —
  대시보드에서 저평가 매물을 확인하면 직접 게임 내에서 확인 후 매수할 것.
- 대시보드는 수집 직후에만 갱신되므로 실시간 알림은 아님(기본 주기엔 최대 15분,
  FAST_MODE 켜면 최대 2분 지연 — Slack 푸시 대신 사이트를 직접 확인해야 함).
- 거타 이용약관/robots.txt에 자동 수집을 명시적으로 금지하는 조항은
  발견되지 않았으나, 완전한 법적 검토는 아니므로 과도하게 잦은 요청은 피할 것.
  기본 주기만이면 하루 약 960요청(15분 × 10페이지), `FAST_MODE`를 하루 종일
  켜두면 최대 약 8,200요청까지 늘어남 — 게임 할 때만 켰다가 끄는 걸 권장.
  GitHub Actions의 스케줄 트리거도 5분 미만(FAST_MODE 주기)은 공식적으로
  보장되지 않으므로 실제 주기는 부하 상황에 따라 다소 밀릴 수 있음. 만약
  geota가 접근을 차단하는 정황이 보이면 즉시 FAST_MODE를 끄고 기본 주기도
  늘릴 것.
