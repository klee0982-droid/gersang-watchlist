import { collectAllListings } from '../lib/scrapeGeota.js';
import { checkAlerts } from '../lib/alert.js';
import { supabase } from '../lib/supabase.js';

async function main() {
  console.log('수집 시작...');
  const listings = await collectAllListings();
  console.log(`총 ${listings.length}건 수집됨`);

  if (listings.length === 0) {
    console.log('수집된 매물이 없어 종료합니다.');
    return;
  }

  const rows = listings.map((l) => ({
    server_id: l.serverId,
    item_name: l.itemName,
    quantity: l.quantity,
    price: l.price,
    seller: l.seller,
  }));

  // 대량 insert는 한 번에 500건씩 나눠서 (Supabase 요청 크기 제한 고려)
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('gersang_listings').insert(chunk);
    if (error) {
      console.error('저장 실패:', error.message);
      process.exit(1);
    }
  }

  console.log('저장 완료. 알림 체크 시작...');
  await checkAlerts(listings);
  console.log('완료.');
}

main().catch((err) => {
  console.error('수집 실패:', err);
  process.exit(1);
});
