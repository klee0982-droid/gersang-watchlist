import { renderSiteHtml } from '../lib/renderSite.js';

let failed = false;
function check(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    failed = true;
  }
}

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
  ],
  generatedAt: '2026-08-09T04:10:00.000Z',
});

check(html.includes('<!doctype html>'), '유효한 HTML 문서로 렌더링됨');
check(html.includes('&lt;위험한 이름&gt;'), 'HTML 이스케이프 처리됨 (XSS 방지)');
check(!html.includes('<위험한 이름>'), '이스케이프 안 된 원본 태그가 남아있지 않음');
check(html.includes('혼의결정'), '워치리스트 항목이 렌더링됨');
check(html.includes('1,000,000원'), '가격이 천단위 콤마로 포맷됨');

// 빈 데이터에서도 깨지지 않는지
const emptyHtml = renderSiteHtml({ alerts: [], watchlist: [], generatedAt: '2026-08-09T04:10:00.000Z' });
check(emptyHtml.includes('최근 저평가 매물이 없습니다'), '알림 빈 상태 메시지 표시');
check(emptyHtml.includes('워치리스트 데이터가 아직 없습니다'), '워치리스트 빈 상태 메시지 표시');

if (failed) {
  console.error('\n❌ 사이트 렌더링 검증 실패');
  process.exit(1);
} else {
  console.log('✅ 사이트 렌더링 검증 통과');
}
