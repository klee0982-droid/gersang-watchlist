// "지금 이 순간 싼 매물"이 아니라 "계속 지켜볼 가치가 있는 아이템"을 찾는
// 분석. 최근 N일간의 알림(gersang_alerts) 이력을 아이템별로 집계해서
//   기회점수 = 알림 횟수 × 평균 할인율(절댓값)
// 로 순위를 매긴다. 자주(빈도) + 깊게(할인폭) 딜이 뜨는 아이템일수록
// 상위에 옴. 표본 수(sample_count)를 같이 보여줘서, 표본이 적어(=중앙값이
// 부정확해서) 알림이 과다하게 뜬 건지 사용자가 직접 판단할 수 있게 함.
export function computeItemInsights(alertRows, watchlistRows, { topN = 15 } = {}) {
  const watchlistByItem = new Map(watchlistRows.map((w) => [w.item_name, w]));

  const statsByItem = new Map();
  for (const a of alertRows) {
    const s = statsByItem.get(a.item_name) ?? { count: 0, sumDeviation: 0 };
    s.count += 1;
    s.sumDeviation += Number(a.deviation_pct);
    statsByItem.set(a.item_name, s);
  }

  const insights = [];
  for (const [itemName, s] of statsByItem) {
    const w = watchlistByItem.get(itemName);
    const avgDeviationPct = s.sumDeviation / s.count; // 음수 (예: -0.15 = 평균 15% 할인)
    const score = s.count * Math.abs(avgDeviationPct);
    insights.push({
      itemName,
      groupLabel: w?.group_label ?? null,
      alertCount: s.count,
      avgDeviationPct,
      sampleCount: w?.sample_count ?? null,
      medianPrice: w?.median_price ?? null,
      score,
    });
  }

  insights.sort((a, b) => b.score - a.score);
  return insights.slice(0, topN);
}
