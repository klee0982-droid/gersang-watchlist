import { mkdirSync, writeFileSync } from 'node:fs';
import { supabase } from '../lib/supabase.js';
import { renderSiteHtml } from '../lib/renderSite.js';
import { buildPriceTrends } from '../lib/priceTrends.js';
import { computeItemInsights } from '../lib/insights.js';
import { CONFIG } from '../lib/config.js';

// 스파크라인용 최근 추이 조회 기간. STATS_WINDOW_DAYS(45일) 전체보다는
// 짧게 잡아야 "최근 흐름"을 한눈에 보는 용도에 맞음.
const TREND_WINDOW_DAYS = 14;
// 아이템당 이 개수보다 점이 많으면 등간격으로 솎아냄 (데이터가 몇 주치
// 쌓여도 SVG 경로가 무한정 길어지지 않게).
const MAX_POINTS_PER_ITEM = 60;

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

  const rows = (data || []).filter((row) => wanted.has(row.item_name));
  return buildPriceTrends(rows, { maxPointsPerItem: MAX_POINTS_PER_ITEM });
}

async function main() {
  const alertCutoff = new Date(Date.now() - CONFIG.ALERT_DISPLAY_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data: alerts, error: alertsError } = await supabase
    .from('gersang_alerts')
    .select('*')
    .gte('alerted_at', alertCutoff)
    .order('alerted_at', { ascending: false })
    .limit(200);
  if (alertsError) throw new Error(`알림 조회 실패: ${alertsError.message}`);

  const { data: watchlist, error: watchlistError } = await supabase
    .from('gersang_watchlist')
    .select('*')
    .order('median_price', { ascending: false });
  if (watchlistError) throw new Error(`워치리스트 조회 실패: ${watchlistError.message}`);

  // "지금 싼 것"과 별개로 "계속 지켜볼 가치가 있는 것"을 뽑으려면 훨씬 긴
  // 기간의 알림 이력이 필요함 (표시용 2시간 창과는 목적이 다름).
  const insightCutoff = new Date(Date.now() - CONFIG.INSIGHT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: insightAlerts, error: insightAlertsError } = await supabase
    .from('gersang_alerts')
    .select('item_name, deviation_pct')
    .gte('alerted_at', insightCutoff)
    .limit(5000);
  if (insightAlertsError) throw new Error(`인사이트용 알림 이력 조회 실패: ${insightAlertsError.message}`);

  const insights = computeItemInsights(insightAlerts || [], watchlist || [], { topN: CONFIG.INSIGHT_TOP_N });

  const priceTrends = await fetchPriceTrends((watchlist || []).map((w) => w.item_name));

  const html = renderSiteHtml({
    alerts: alerts || [],
    watchlist: watchlist || [],
    priceTrends,
    insights,
    insightWindowDays: CONFIG.INSIGHT_WINDOW_DAYS,
    alertWindowHours: CONFIG.ALERT_DISPLAY_WINDOW_HOURS,
    generatedAt: new Date().toISOString(),
  });

  mkdirSync('site', { recursive: true });
  writeFileSync('site/index.html', html);
  console.log(
    `site/index.html 생성 완료 (알림 ${alerts?.length ?? 0}건, 워치리스트 ${watchlist?.length ?? 0}건, 인사이트 ${insights.length}건)`
  );
}

main().catch((err) => {
  console.error('사이트 생성 실패:', err);
  process.exit(1);
});
