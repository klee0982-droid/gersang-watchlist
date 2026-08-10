import { buildPriceTrends } from '../lib/priceTrends.js';

let failed = false;
function check(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    failed = true;
  }
}

// 같은 시각(같은 collect 배치)에 동시에 올라온 매물 2개 — x좌표가 겹쳐서
// 스파크라인이 세로 틱으로 뭉개지던 실제 버그 재현 케이스
const sameTimestampRows = [
  { item_name: '백은색알', collected_at: '2026-08-10T12:45:40.000Z', price: 255000000 },
  { item_name: '백은색알', collected_at: '2026-08-10T12:45:40.000Z', price: 254000000 },
];
const trends1 = buildPriceTrends(sameTimestampRows, { maxPointsPerItem: 60 });
const points1 = trends1.get('백은색알');
check(points1.length === 1, `같은 시각 매물은 1개 포인트로 합쳐져야 함 (실제 ${points1.length}개)`);
check(points1[0].price === 254000000, `합쳐진 포인트는 그 시각의 최저가여야 함 (실제 ${points1[0].price})`);

// 서로 다른 시각의 정상 케이스 — 시간순 정렬 확인 (입력 순서가 뒤섞여도)
const normalRows = [
  { item_name: '혼의결정', collected_at: '2026-08-05T00:00:00.000Z', price: 3600000 },
  { item_name: '혼의결정', collected_at: '2026-08-01T00:00:00.000Z', price: 3400000 },
  { item_name: '혼의결정', collected_at: '2026-08-09T00:00:00.000Z', price: 3450000 },
];
const trends2 = buildPriceTrends(normalRows, { maxPointsPerItem: 60 });
const points2 = trends2.get('혼의결정');
check(points2.length === 3, `서로 다른 시각은 각각 포인트로 유지되어야 함 (실제 ${points2.length}개)`);
check(
  points2[0].t < points2[1].t && points2[1].t < points2[2].t,
  '포인트가 시간순으로 정렬되어야 함'
);
check(points2[0].price === 3400000 && points2[2].price === 3450000, '정렬 후에도 가격이 올바른 시점에 붙어있어야 함');

// 다운샘플링 — 개수 제한을 넘으면 등간격으로 줄어들되 마지막 포인트는 항상 보존
const manyRows = Array.from({ length: 200 }, (_, i) => ({
  item_name: '반계탕',
  collected_at: new Date(Date.parse('2026-08-01T00:00:00.000Z') + i * 3600 * 1000).toISOString(),
  price: 46000 + i,
}));
const trends3 = buildPriceTrends(manyRows, { maxPointsPerItem: 60 });
const points3 = trends3.get('반계탕');
check(points3.length <= 61, `다운샘플링 후 최대 개수 근처로 줄어야 함 (실제 ${points3.length}개)`);
check(points3[points3.length - 1].price === 46000 + 199, '다운샘플링해도 마지막(최신) 포인트는 보존되어야 함');

// 빈 입력
const trends4 = buildPriceTrends([], { maxPointsPerItem: 60 });
check(trends4.size === 0, '빈 입력에서는 빈 Map을 반환해야 함');

if (failed) {
  console.error('\n❌ 가격 추이 집계 검증 실패');
  process.exit(1);
} else {
  console.log('✅ 가격 추이 집계 검증 통과');
}
