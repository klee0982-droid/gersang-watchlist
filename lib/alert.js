import { supabase } from './supabase.js';
import { CONFIG } from './config.js';

// 저평가 매물은 Slack이 아니라 gersang_alerts 테이블에 기록되고,
// scripts/generateSite.js가 이 로그를 읽어 GitHub Pages 사이트에 표시함.
export async function checkAlerts(newListings) {
  if (newListings.length === 0) return;

  const itemNames = [...new Set(newListings.map((l) => l.itemName))];

  const { data: watchlist, error } = await supabase
    .from('gersang_watchlist')
    .select('item_name, group_label, median_price')
    .in('item_name', itemNames);

  if (error) {
    console.error('워치리스트 조회 실패:', error.message);
    return;
  }
  if (!watchlist || watchlist.length === 0) return;

  const statsMap = new Map(watchlist.map((w) => [w.item_name, w]));
  const dedupeCutoff = new Date(Date.now() - CONFIG.ALERT_DEDUPE_MINUTES * 60 * 1000).toISOString();

  for (const listing of newListings) {
    const stats = statsMap.get(listing.itemName);
    if (!stats || !stats.median_price) continue;

    const deviation = (listing.price - stats.median_price) / stats.median_price;
    if (deviation > -CONFIG.DEVIATION_ALERT_PCT) continue; // 저평가 기준 미충족

    // 같은 아이템+가격+판매자로 최근 알림 이력이 있으면 건너뜀 (매 수집 주기마다 중복 알림 방지)
    const { data: recentAlerts } = await supabase
      .from('gersang_alerts')
      .select('id')
      .eq('item_name', listing.itemName)
      .eq('price', listing.price)
      .eq('seller', listing.seller)
      .gte('alerted_at', dedupeCutoff)
      .limit(1);

    if (recentAlerts && recentAlerts.length > 0) continue;

    await supabase.from('gersang_alerts').insert({
      item_name: listing.itemName,
      price: listing.price,
      deviation_pct: deviation,
      seller: listing.seller,
      group_label: stats.group_label,
      server_id: listing.serverId,
    });
  }
}
