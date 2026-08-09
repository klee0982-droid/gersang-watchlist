import { supabase } from '../lib/supabase.js';
import { CONFIG } from '../lib/config.js';

async function deleteOlderThan(table, column, days) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .lt(column, cutoff);

  if (error) throw new Error(`${table} 정리 실패: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const listingsDeleted = await deleteOlderThan('gersang_listings', 'collected_at', CONFIG.LISTING_RETENTION_DAYS);
  console.log(`gersang_listings: ${CONFIG.LISTING_RETENTION_DAYS}일 이전 ${listingsDeleted}건 삭제`);

  const alertsDeleted = await deleteOlderThan('gersang_alerts', 'alerted_at', CONFIG.ALERT_RETENTION_DAYS);
  console.log(`gersang_alerts: ${CONFIG.ALERT_RETENTION_DAYS}일 이전 ${alertsDeleted}건 삭제`);
}

main().catch((err) => {
  console.error('정리 실패:', err);
  process.exit(1);
});
