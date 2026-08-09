import { mkdirSync, writeFileSync } from 'node:fs';
import { supabase } from '../lib/supabase.js';
import { renderSiteHtml } from '../lib/renderSite.js';

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

  const html = renderSiteHtml({
    alerts: alerts || [],
    watchlist: watchlist || [],
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
