import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseListingsFromHtml } from '../lib/scrapeGeota.js';

// 2026-08-09 geota.co.kr?serverId=4 에서 실제로 받아온 raw HTML을 픽스처로 사용.
// (RSC 페이로드 self.__next_f 안에 매물 JSON이 실려오는 구조)
const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, 'fixtures', 'geota-server4-page1.html'), 'utf-8');

const result = parseListingsFromHtml(html, 4);

console.log(`파싱 결과: ${result.length}건`);
result.forEach((r) =>
  console.log(`  ${r.itemName} | 수량 ${r.quantity} | ${r.price.toLocaleString()}원 | ${r.seller} | 서버 ${r.serverId}`)
);

let failed = false;
function check(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    failed = true;
  }
}

// 픽스처 페이지는 매물 10건
check(result.length === 10, `매물 건수: 기대 10, 실제 ${result.length}`);

// 첫 매물이 실제 값과 정확히 일치하는지
const first = result[0];
check(first?.itemName === '염후의 빛바랜 장식', `첫 매물명: ${first?.itemName}`);
check(first?.quantity === 1000, `첫 매물 수량: ${first?.quantity}`);
check(first?.price === 1600000, `첫 매물 가격: ${first?.price}`);
check(first?.seller === '파뱃', `첫 매물 판매자: ${first?.seller}`);

// 모든 매물이 필수 필드를 갖추고 serverId가 주입됐는지
for (const r of result) {
  check(
    r.itemName && r.seller && r.price > 0 && r.quantity > 0 && r.serverId === 4,
    `매물 필드 유효성: ${JSON.stringify(r)}`
  );
}

// 고가 매물(불의정령옥 7,000만원)이 잡히는지 — 그룹B 판정에 중요
check(
  result.some((r) => r.itemName === '불의정령옥' && r.price === 70000000),
  '고가 매물(불의정령옥) 파싱 확인'
);

if (failed) {
  console.error('\n❌ 파싱 로직 검증 실패');
  process.exit(1);
} else {
  console.log('\n✅ 파싱 로직 검증 통과 (실제 raw HTML 픽스처 기준)');
}
