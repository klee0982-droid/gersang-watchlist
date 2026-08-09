import { supabase } from './supabase.js';
import { CONFIG } from './config.js';

async function sendSlackAlert({ itemName, price, seller, serverId, groupLabel, deviationPct }) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('SLACK_WEBHOOK_URL이 설정되지 않아 알림을 건너뜁니다.');
    return;
  }

  const pctText = `${(deviationPct * 100).toFixed(1)}%`;
  const payload = {
    text: `🔔 저평가 매물 발견 (${groupLabel})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${itemName}*\n가격: ${price.toLocaleString()}원 (워치리스트 중앙값 대비 ${pctText})\n판매자: ${seller} | 서버: ${serverId}`,
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error('Slack 알림 전송 실패:', res.status, await res.text());
  }
}

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

    // 같은 아이템+가격+판매자로 최근 알림 이력이 있으면 건너뜀 (매 10분마다 중복 알림 방지)
    const { data: recentAlerts } = await supabase
      .from('gersang_alerts')
      .select('id')
      .eq('item_name', listing.itemName)
      .eq('price', listing.price)
      .eq('seller', listing.seller)
      .gte('alerted_at', dedupeCutoff)
      .limit(1);

    if (recentAlerts && recentAlerts.length > 0) continue;

    await sendSlackAlert({
      itemName: listing.itemName,
      price: listing.price,
      seller: listing.seller,
      serverId: listing.serverId,
      groupLabel: stats.group_label,
      deviationPct: deviation,
    });

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
