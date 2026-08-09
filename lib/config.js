// 모든 기준값은 여기서만 관리. GitHub Actions secrets가 아니라
// 코드에 직접 두는 이유: 자주 튜닝하게 될 값들이라 git으로 변경 이력 관리하는 게 편함.

export const CONFIG = {
  SERVER_IDS: [4], // 청룡 서버만 추적
  BASE_URL: 'https://geota.co.kr/gersang/yukeuijeon',
  PAGES_PER_SERVER: 10, // 서버 1개만 추적하므로 여유를 늘려 물량 많은 시간대 누락 방지

  HIGH_VALUE_THRESHOLD: 10_000_000, // 그룹 B: 1,000만원 이상
  TOP_N_FREQUENT: 20, // 그룹 A: 최근 N일 등록건수 상위 20개
  FREQUENCY_WINDOW_DAYS: 7,

  // 자본 효율(수익률 극대화) 우선 튜닝: 노이즈가 늘더라도 기회를 넓게 포착
  DEVIATION_ALERT_PCT: 0.10, // 워치리스트 중앙값 대비 -10% 이하면 알림 (기존 -15%)
  MIN_SAMPLES_FOR_STATS: 2, // 통계 낼 최소 샘플 수 (기존 3) — 그룹B(고가/저빈도) 편입 확대
  STATS_WINDOW_DAYS: 45, // 표본 기준 완화한 만큼 관측 기간을 늘려 중앙값 신뢰도 보완 (기존 30)
  ALERT_DEDUPE_MINUTES: 90, // 같은 아이템+가격+판매자는 이 시간 내 중복 알림 안 보냄

  REQUEST_DELAY_MS: 1500, // 페이지 간 딜레이 — 서버 부담 최소화
};
