# 거상 육의전 시세 모니터링

geota.co.kr 육의전 매물을 주기적으로 수집해서 Supabase에 쌓고,
"저평가 매물"(워치리스트 중앙값 대비 -15% 이하) 발견 시 Slack으로 알림.
**실행(구매)은 자동화하지 않음** — 알림만 보내고 실제 매수는 사람이 직접 판단.

## 구조

- `lib/scrapeGeota.js` — 페이지 fetch + 파싱 (Next.js RSC 페이로드 `self.__next_f`의 매물 JSON 추출)
- `lib/config.js` — 기준값 전부 여기서 관리 (임계값, 서버, 페이지 수 등)
- `lib/alert.js` — 워치리스트 대비 저평가 판정 + Slack 알림 + 중복 알림 방지
- `scripts/diagnose.js` — 1회성 진단 (실제 파싱이 되는지 눈으로 확인)
- `scripts/collect.js` — 수집 + 저장 + 알림 (10분마다 실행됨)
- `scripts/updateWatchlist.js` — 그룹A(최다등록 20개)/그룹B(1,000만원 이상) 통계 갱신 (매일 새벽 3시)
- `.github/workflows/scrape.yml` — GitHub Actions 스케줄

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

### 2. 로컬 환경변수 설정

\`\`\`bash
cp .env.example .env
\`\`\`

`.env`에 아래 값을 채워넣기:

- `SUPABASE_URL`: 이미 채워져 있음 (`https://hvvxequwyjqbgxmnavbz.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase 대시보드 → 해당 프로젝트 → Settings → API →
  "service_role" 키 (⚠️ anon/publishable 키 아님. RLS를 우회해야 쓰기가 되므로 service_role 필요)
- `SLACK_WEBHOOK_URL`: Slack 앱 → Incoming Webhooks에서 발급

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
- `SLACK_WEBHOOK_URL`

### 5. 활성화

`.github/workflows/scrape.yml`이 push되는 순간부터 스케줄이 자동으로 돌아감.
Actions 탭에서 "Run workflow"로 수동 실행도 가능.

## 튜닝 포인트 (`lib/config.js`)

| 값 | 기본값 | 의미 |
|---|---|---|
| `TOP_N_FREQUENT` | 20 | 최다등록 상위 몇 개를 그룹A로 볼지 |
| `HIGH_VALUE_THRESHOLD` | 10,000,000 | 그룹B 기준 가격 |
| `DEVIATION_ALERT_PCT` | 0.15 | 중앙값 대비 몇 % 낮으면 알림 보낼지 |
| `MIN_SAMPLES_FOR_STATS` | 3 | 통계 낼 최소 샘플 수 (너무 적으면 노이즈) |
| `ALERT_DEDUPE_MINUTES` | 90 | 같은 매물 중복 알림 방지 시간 |

## 알려진 한계

- 파싱은 2026-08 실제 raw HTML을 확인하고 RSC 페이로드(`self.__next_f`)의
  매물 JSON을 직접 뽑는 방식으로 짰음. geota.co.kr이 데이터 스키마(필드명
  `itemName`/`price`/`totalQuantity`/`sellerName`)나 렌더 방식을 바꾸면
  `diagnose`에서 0건이 나올 수 있음. `tests/parse.test.mjs`가 실제 HTML
  픽스처로 이 스키마를 검증하므로, 구조 변경 시 테스트가 먼저 깨져 알려줌.
- "등록가"만 보므로 실제 체결 가능 여부(이미 팔렸는지 등)는 확인 못 함 —
  알림 받으면 직접 게임 내에서 확인 후 매수할 것.
- 거타 이용약관/robots.txt에 자동 수집을 명시적으로 금지하는 조항은
  발견되지 않았으나, 완전한 법적 검토는 아니므로 과도하게 잦은 요청은 피할 것
  (현재 10분 주기 + 페이지 간 1.5초 딜레이로 설정됨).
