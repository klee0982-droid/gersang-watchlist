import { computeItemInsights } from '../lib/insights.js';

let failed = false;
function check(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    failed = true;
  }
}

const alertRows = [
  // 혼의결정: 3번, 평균 -12%
  { item_name: '혼의결정', deviation_pct: -0.10 },
  { item_name: '혼의결정', deviation_pct: -0.12 },
  { item_name: '혼의결정', deviation_pct: -0.14 },
  // 공명의 예복: 1번인데 훨씬 깊은 할인(-40%) — 빈도는 낮지만 임팩트 큰 케이스
  { item_name: '공명의 예복', deviation_pct: -0.40 },
  // 반계탕: 자주 뜨지만 할인폭은 얕음
  { item_name: '반계탕', deviation_pct: -0.10 },
  { item_name: '반계탕', deviation_pct: -0.10 },
  { item_name: '반계탕', deviation_pct: -0.10 },
  { item_name: '반계탕', deviation_pct: -0.10 },
];

const watchlistRows = [
  { item_name: '혼의결정', group_label: 'A(최다등록)', sample_count: 20, median_price: 3500000 },
  { item_name: '공명의 예복', group_label: 'B(고가)', sample_count: 3, median_price: 18000000 },
  { item_name: '반계탕', group_label: 'A(최다등록)', sample_count: 50, median_price: 47000 },
  // 워치리스트에 없는 아이템(알림만 있고 통계 매칭 안 되는 엣지케이스)
];

const results = computeItemInsights(alertRows, watchlistRows, { topN: 15 });

check(results.length === 3, `집계된 아이템 수는 3이어야 함 (실제 ${results.length})`);

const byName = Object.fromEntries(results.map((r) => [r.itemName, r]));
check(byName['혼의결정'].alertCount === 3, '혼의결정 알림 횟수 3');
check(Math.abs(byName['혼의결정'].avgDeviationPct - -0.12) < 1e-9, `혼의결정 평균 할인율 -12% (실제 ${byName['혼의결정'].avgDeviationPct})`);
check(byName['반계탕'].alertCount === 4, '반계탕 알림 횟수 4');
check(byName['공명의 예복'].alertCount === 1, '공명의 예복 알림 횟수 1');

// 점수 = 횟수 × |평균할인율| 이므로:
//   혼의결정 = 3 × 0.12 = 0.36
//   공명의 예복 = 1 × 0.40 = 0.40
//   반계탕 = 4 × 0.10 = 0.40
// 반계탕과 공명의 예복이 동점으로 상위, 혼의결정이 그다음이어야 함
check(results[0].score >= results[1].score && results[1].score >= results[2].score, '점수 내림차순 정렬');
check(byName['혼의결정'].score < byName['반계탕'].score, '빈도만 높고 할인폭 얕은 것보다 종합 점수가 낮게 나와야 하는 케이스가 아니라, 실제로는 혼의결정(0.36) < 반계탕(0.40)이어야 함');

// group_label/sample_count가 워치리스트에서 정확히 매칭되는지
check(byName['혼의결정'].groupLabel === 'A(최다등록)', '워치리스트 그룹 라벨 매칭');
check(byName['혼의결정'].sampleCount === 20, '워치리스트 표본 수 매칭');

// topN 제한
const limited = computeItemInsights(alertRows, watchlistRows, { topN: 2 });
check(limited.length === 2, `topN=2면 결과도 2개여야 함 (실제 ${limited.length})`);

// 빈 입력
const empty = computeItemInsights([], [], { topN: 15 });
check(empty.length === 0, '빈 입력이면 빈 배열 반환');

// 워치리스트에 없는 아이템도 안 죽고 groupLabel/sampleCount가 null로 처리되는지
const orphanAlerts = [{ item_name: '워치리스트없는템', deviation_pct: -0.2 }];
const orphanResult = computeItemInsights(orphanAlerts, [], { topN: 15 });
check(orphanResult.length === 1, '워치리스트 매칭 안 되는 아이템도 결과에 포함되어야 함');
check(orphanResult[0].groupLabel === null && orphanResult[0].sampleCount === null, '매칭 안 되면 groupLabel/sampleCount는 null');

if (failed) {
  console.error('\n❌ 인사이트 집계 검증 실패');
  process.exit(1);
} else {
  console.log('✅ 인사이트 집계 검증 통과');
}
