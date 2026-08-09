import { fetchAndParsePage } from '../lib/scrapeGeota.js';
import { CONFIG } from '../lib/config.js';

async function main() {
  const serverId = CONFIG.SERVER_IDS[0];
  console.log(`서버 ${serverId} / 페이지 1 진단 시작...\n`);

  const listings = await fetchAndParsePage(serverId, 1);

  console.log(`파싱된 매물 수: ${listings.length}`);
  console.log('--- 샘플 (최대 10개) ---');
  listings.slice(0, 10).forEach((l, i) => {
    console.log(
      `${i + 1}. ${l.itemName} | 수량 ${l.quantity} | ${l.price.toLocaleString()}원 | 판매자 ${l.seller}`
    );
  });

  if (listings.length === 0) {
    console.log('\n⚠️ 파싱된 매물이 0개입니다. geota.co.kr의 페이지 구조가');
    console.log('   lib/scrapeGeota.js가 가정한 패턴과 다를 수 있습니다.');
    console.log('   실제 페이지를 브라우저에서 열어 텍스트 순서를 다시 확인하세요.');
  } else {
    console.log('\n✅ 정상적으로 파싱되면 npm run collect / npm run watchlist로 진행하세요.');
  }
}

main().catch((err) => {
  console.error('진단 실패:', err);
  process.exit(1);
});
