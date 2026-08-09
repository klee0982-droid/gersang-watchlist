import { supabase } from '../lib/supabase.js';
import { CONFIG } from '../lib/config.js';

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return null;
  const idx = (sortedArr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
}

async function fetchAllListings(sinceIso) {
  // Supabase 기본 응답 제한(1000행)을 넘을 수 있어 페이지네이션으로 전부 가져옴
  const pageSize = 1000;
  let from = 0;
  let all = [];

  while (true) {
    const { data, error } = await supabase
      .from('gersang_listings')
      .select('item_name, price, collected_at')
      .gte('collected_at', sinceIso)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function main() {
  const statsCutoff = new Date(Date.now() - CONFIG.STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const freqCutoff = new Date(Date.now() - CONFIG.FREQUENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  console.log('데이터 조회 중...');
  const rows = await fetchAllListings(statsCutoff);
  console.log(`최근 ${CONFIG.STATS_WINDOW_DAYS}일 데이터 ${rows.length}건 조회됨`);

  if (rows.length === 0) {
    console.log('데이터가 없어 워치리스트를 갱신하지 않습니다.');
    return;
  }

  // 그룹 A: 최근 FREQUENCY_WINDOW_DAYS 내 등록 건수 상위 N개
  const freqMap = {};
  rows.forEach((r) => {
    if (r.collected_at >= freqCutoff) {
      freqMap[r.item_name] = (freqMap[r.item_name] || 0) + 1;
    }
  });
  const groupA = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, CONFIG.TOP_N_FREQUENT)
    .map(([name]) => name);
  const groupASet = new Set(groupA);

  // 그룹 B: 기간 내 가격 1,000만원 이상 매물이 있었던 아이템
  const groupBSet = new Set(rows.filter((r) => r.price >= CONFIG.HIGH_VALUE_THRESHOLD).map((r) => r.item_name));

  const watchlistNames = new Set([...groupASet, ...groupBSet]);
  console.log(`워치리스트 대상: 그룹A ${groupASet.size}개, 그룹B ${groupBSet.size}개, 합집합 ${watchlistNames.size}개`);

  // 아이템별 가격 배열
  const pricesByItem = {};
  rows.forEach((r) => {
    if (!watchlistNames.has(r.item_name)) return;
    (pricesByItem[r.item_name] ||= []).push(r.price);
  });

  const upsertRows = [];
  for (const name of watchlistNames) {
    const prices = (pricesByItem[name] || []).sort((a, b) => a - b);
    if (prices.length < CONFIG.MIN_SAMPLES_FOR_STATS) continue;

    const inA = groupASet.has(name);
    const inB = groupBSet.has(name);
    const groupLabel = inA && inB ? 'A+B' : inA ? 'A(최다등록)' : 'B(고가)';

    upsertRows.push({
      item_name: name,
      group_label: groupLabel,
      sample_count: prices.length,
      median_price: Math.round(percentile(prices, 0.5)),
      p25_price: Math.round(percentile(prices, 0.25)),
      recent_count_7d: freqMap[name] || 0,
      max_price_seen: prices[prices.length - 1],
      updated_at: new Date().toISOString(),
    });
  }

  if (upsertRows.length === 0) {
    console.log('통계 낼 수 있는 샘플(최소 기준 미달)이 없어 갱신할 항목이 없습니다.');
    return;
  }

  const { error } = await supabase.from('gersang_watchlist').upsert(upsertRows, { onConflict: 'item_name' });
  if (error) {
    console.error('워치리스트 저장 실패:', error.message);
    process.exit(1);
  }

  console.log(`워치리스트 갱신 완료: ${upsertRows.length}개 아이템`);
}

main().catch((err) => {
  console.error('워치리스트 갱신 실패:', err);
  process.exit(1);
});
