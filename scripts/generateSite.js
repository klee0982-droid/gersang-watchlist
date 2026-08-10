import { mkdirSync, writeFileSync } from 'node:fs';
import { supabase } from '../lib/supabase.js';
import { renderSiteHtml } from '../lib/renderSite.js';

// 스파크라인용 최근 추이 조회 기간. STATS_WINDOW_DAYS(45일) 전체보다는
// 짧게 잡아야 "최근 흐름"을 한눈에 보는 용도에 맞음.
const TREND_WINDOW_DAYS = 14;
// 아이템당 이 개수보다 점이 많으면 등간격으로 솎아냄 (데이터가 몇 주치
// 쌓여도 SVG 경로가 무한정 길어지지 않게).
const MAX_POINTS_PER_ITEM = 60;

function downsample(points, max) {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

async function fetchPriceTrends(itemNames) {
  if (itemNames.length === 0) return new Map();

  // 아이템명에 괄호("+5 반고의귀걸이(외형전용)" 등)가 섞여 있으면 PostgREST의
  // in.(a,b,c) 필터 문법이 깨지므로, .in()으로 서버에서 거르지 않고 날짜
  // 범위로만 가져온 뒤 JS에서 워치리스트 아이템만 골라낸다.
  const wanted = new Set(itemNames);
  const cutoff = new Date(Date.now() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('gersang_listings')
    .select('item_name, collected_at, price')
    .gte('collected_at', cutoff)
    .order('collected_at', { ascending: true })
    .limit(20000);
  if (error) throw new Error(`가격 추이 조회 실패: ${error.message}`);

  const byItem = new Map();
  for (const row of data || []) {
    if (!wanted.has(row.item_name)) continue;
    const t = new Date(row.collected_at).getTime();
    const list = byItem.get(row.item_name) ?? [];
    list.push({ t, price: row.price });
    byItem.set(row.item_name, list);
  }
  for (const [name, points] of byItem) {
    byItem.set(name, downsample(points, MAX_POINTS_PER_ITEM));
  }
  return byItem;
}

async function main() {
  const { data: alerts, error: alertsError } = await supabase
    .from('gersang_alerts')
    .select('*')
    .order('alerted_at', { ascending: false })
    .limit(100);
  if (alertsError) throw new Error(`알림 조회 실패: ${alertsError.message}`);

  const { data: watchlist, error: watchlistError } = await supabase
    .from('gersang_watchlist')
    .select('*')
    .order('median_price', { ascending: false });
  if (watchlistError) throw new Error(`워치리스트 조회 실패: ${watchlistError.message}`);

  const priceTrends = await fetchPriceTrends((watchlist || []).map((w) => w.item_name));

  const html = renderSiteHtml({
    alerts: alerts || [],
    watchlist: watchlist || [],
    priceTrends,
    generatedAt: new Date().toISOString(),
  });

  mkdirSync('site', { recursive: true });
  writeFileSync('site/index.html', html);
  console.log(`site/index.html 생성 완료 (알림 ${alerts?.length ?? 0}건, 워치리스트 ${watchlist?.length ?? 0}건)`);
}

main().catch((err) => {
  console.error('사이트 생성 실패:', err);
  process.exit(1);
});
