import { renderSiteHtml } from '../lib/renderSite.js';

let failed = false;
function check(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    failed = true;
  }
}

const priceTrends = new Map([
  [
    '혼의결정',
    [
      { t: Date.parse('2026-08-01T00:00:00.000Z'), price: 3400000 },
      { t: Date.parse('2026-08-05T00:00:00.000Z'), price: 3600000 },
      { t: Date.parse('2026-08-09T03:00:00.000Z'), price: 3450000 },
    ],
  ],
  // 표본 1개짜리(추이 계산 불가) — 스파크라인이 안전하게 폴백하는지 확인용
  ['불의결정', [{ t: Date.parse('2026-08-09T03:00:00.000Z'), price: 2300000 }]],
]);

const html = renderSiteHtml({
  alerts: [
    {
      item_name: '<위험한 이름>',
      price: 1000000,
      deviation_pct: -0.2,
      seller: '판매자A',
      group_label: 'A(최다등록)',
      server_id: 4,
      alerted_at: '2026-08-09T04:00:00.000Z',
    },
  ],
  watchlist: [
    {
      item_name: '혼의결정',
      group_label: 'A(최다등록)',
      median_price: 3500000,
      p25_price: 3000000,
      sample_count: 12,
      recent_count_7d: 5,
      max_price_seen: 4000000,
      updated_at: '2026-08-09T03:00:00.000Z',
    },
    {
      item_name: '불의결정',
      group_label: 'A(최다등록)',
      median_price: 2300000,
      p25_price: 2100000,
      sample_count: 4,
      recent_count_7d: 2,
      max_price_seen: 2400000,
      updated_at: '2026-08-09T03:00:00.000Z',
    },
    {
      // priceTrends에 아예 없는 아이템 — "데이터 부족" 폴백 확인용
      item_name: '표본없음템',
      group_label: 'B(고가)',
      median_price: 15000000,
      p25_price: 14000000,
      sample_count: 2,
      recent_count_7d: 0,
      max_price_seen: 16000000,
      updated_at: '2026-08-09T03:00:00.000Z',
    },
  ],
  priceTrends,
  alertWindowHours: 2,
  generatedAt: '2026-08-09T04:10:00.000Z',
});

check(html.includes('<!doctype html>'), '유효한 HTML 문서로 렌더링됨');
check(html.includes('최근 저평가 매물 (2시간 이내)'), '알림 섹션 제목에 표시 시간 범위가 명시됨');
check(html.includes('&lt;위험한 이름&gt;'), 'HTML 이스케이프 처리됨 (XSS 방지)');
check(!html.includes('<위험한 이름>'), '이스케이프 안 된 원본 태그가 남아있지 않음');
check(html.includes('혼의결정'), '워치리스트 항목이 렌더링됨');
check(html.includes('1,000,000원'), '가격이 천단위 콤마로 포맷됨');

// 스파크라인 (2점 이상 있는 아이템)
check(/<svg[^>]*role="img"[^>]*>[\s\S]*?<path/.test(html), '스파크라인 SVG path가 렌더링됨');
check(html.includes('최근가'), '최근가 컬럼 헤더 존재');
check(html.includes('3,450,000원'), '최근가(추이 마지막 값)가 표시됨');
check((html.match(/stroke="var\(--muted\)"/g) || []).length >= 1, '스파크라인 선이 muted 톤으로 렌더링됨(단일 시리즈, 범례 불필요)');
check((html.match(/fill="var\(--accent\)"/g) || []).length >= 1, '스파크라인 마지막 포인트가 accent로 강조됨');

// 표본이 1개뿐이거나 아예 없는 아이템은 라인을 그릴 수 없으니 안전하게 폴백
check(html.includes('데이터 부족'), '표본 부족 시 스파크라인 대신 안내 텍스트 표시');

// 빈 데이터에서도 깨지지 않는지
const emptyHtml = renderSiteHtml({
  alerts: [],
  watchlist: [],
  priceTrends: new Map(),
  alertWindowHours: 2,
  generatedAt: '2026-08-09T04:10:00.000Z',
});
check(emptyHtml.includes('최근 2시간 내 저평가 매물이 없습니다'), '알림 빈 상태 메시지에 표시 시간 범위가 명시됨');
check(emptyHtml.includes('워치리스트 데이터가 아직 없습니다'), '워치리스트 빈 상태 메시지 표시');

// priceTrends를 아예 안 넘겨도(undefined) 죽지 않는지 (옵셔널 체이닝 확인)
const noTrendsHtml = renderSiteHtml({
  alerts: [],
  watchlist: [
    {
      item_name: '테스트템',
      group_label: 'A(최다등록)',
      median_price: 1000,
      p25_price: 900,
      sample_count: 3,
      recent_count_7d: 1,
      max_price_seen: 1100,
      updated_at: '2026-08-09T03:00:00.000Z',
    },
  ],
  alertWindowHours: 2,
  generatedAt: '2026-08-09T04:10:00.000Z',
});
check(noTrendsHtml.includes('테스트템'), 'priceTrends 미전달 시에도 워치리스트 행이 죽지 않고 렌더링됨');

if (failed) {
  console.error('\n❌ 사이트 렌더링 검증 실패');
  process.exit(1);
} else {
  console.log('✅ 사이트 렌더링 검증 통과');
}
