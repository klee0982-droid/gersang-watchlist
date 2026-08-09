// 모든 기준값은 여기서만 관리. GitHub Actions secrets가 아니라
// 코드에 직접 두는 이유: 자주 튜닝하게 될 값들이라 git으로 변경 이력 관리하는 게 편함.

export const CONFIG = {
  SERVER_IDS: [4], // 추적할 서버. 여러 개면 [4, 1, 7] 처럼 추가
  BASE_URL: 'https://geota.co.kr/gersang/yukeuijeon',
  PAGES_PER_SERVER: 5, // 서버당 몇 페이지(최신순 기준)까지 긁을지

  HIGH_VALUE_THRESHOLD: 10_000_000, // 그룹 B: 1,000만원 이상
  TOP_N_FREQUENT: 20, // 그룹 A: 최근 N일 등록건수 상위 20개
  FREQUENCY_WINDOW_DAYS: 7,

  DEVIATION_ALERT_PCT: 0.15, // 워치리스트 중앙값 대비 -15% 이하면 알림
  MIN_SAMPLES_FOR_STATS: 3, // 통계 낼 최소 샘플 수
  STATS_WINDOW_DAYS: 30, // 가격 통계(중앙값 등) 계산에 쓸 기간 — 그룹A보다 넉넉하게 잡아서 그룹B(저빈도) 샘플 확보
  ALERT_DEDUPE_MINUTES: 90, // 같은 아이템+가격+판매자는 이 시간 내 중복 알림 안 보냄

  REQUEST_DELAY_MS: 1500, // 페이지 간 딜레이 — 서버 부담 최소화
};
