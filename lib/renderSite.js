function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWon(n) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function renderAlertRow(a) {
  const pct = `${(a.deviation_pct * 100).toFixed(1)}%`;
  return `
    <tr>
      <td>${escapeHtml(a.item_name)}</td>
      <td class="num">${formatWon(a.price)}</td>
      <td class="num neg">${pct}</td>
      <td>${escapeHtml(a.seller)}</td>
      <td>${escapeHtml(a.group_label || '-')}</td>
      <td>${escapeHtml(a.server_id ?? '-')}</td>
      <td class="muted">${formatDateTime(a.alerted_at)}</td>
    </tr>`;
}

function renderWatchlistRow(w) {
  return `
    <tr>
      <td>${escapeHtml(w.item_name)}</td>
      <td>${escapeHtml(w.group_label)}</td>
      <td class="num">${formatWon(w.median_price)}</td>
      <td class="num">${formatWon(w.p25_price)}</td>
      <td class="num">${w.sample_count}</td>
      <td class="num">${w.recent_count_7d}</td>
      <td class="num">${formatWon(w.max_price_seen)}</td>
      <td class="muted">${formatDateTime(w.updated_at)}</td>
    </tr>`;
}

export function renderSiteHtml({ alerts, watchlist, generatedAt }) {
  const alertRows = alerts.length
    ? alerts.map(renderAlertRow).join('')
    : `<tr><td colspan="7" class="empty">최근 저평가 매물이 없습니다.</td></tr>`;

  const watchlistRows = watchlist.length
    ? watchlist.map(renderWatchlistRow).join('')
    : `<tr><td colspan="8" class="empty">워치리스트 데이터가 아직 없습니다.</td></tr>`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>거상 육의전 시세 모니터링</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f7f5f2;
    --fg: #2a2420;
    --muted: #7a7168;
    --border: #e4ddd4;
    --card-bg: #ffffff;
    --accent: #b3552f;
    --neg: #c0392b;
    --header-bg: #efe9e2;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1c1a18;
      --fg: #ece7e1;
      --muted: #a39a90;
      --border: #3a352f;
      --card-bg: #262320;
      --accent: #e08a5c;
      --neg: #ff6b5e;
      --header-bg: #2f2b26;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 2rem 1rem 4rem;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  }
  main { max-width: 960px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .subtitle { color: var(--muted); font-size: 0.9rem; margin-bottom: 2rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 0.75rem; }
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow-x: auto;
  }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; white-space: nowrap; }
  thead th {
    text-align: left;
    padding: 0.6rem 0.8rem;
    background: var(--header-bg);
    color: var(--muted);
    font-weight: 600;
    border-bottom: 1px solid var(--border);
  }
  tbody td { padding: 0.55rem 0.8rem; border-bottom: 1px solid var(--border); }
  tbody tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .neg { color: var(--neg); font-weight: 600; }
  .muted { color: var(--muted); }
  .empty { text-align: center; color: var(--muted); padding: 1.5rem; }
  footer { margin-top: 2.5rem; color: var(--muted); font-size: 0.8rem; }
  a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <h1>거상 육의전 시세 모니터링</h1>
  <p class="subtitle">마지막 갱신: ${formatDateTime(generatedAt)} (KST) · 3분마다 자동 갱신</p>

  <h2>🔻 최근 저평가 매물</h2>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>아이템</th><th>가격</th><th>중앙값 대비</th><th>판매자</th><th>그룹</th><th>서버</th><th>발견 시각</th>
        </tr>
      </thead>
      <tbody>${alertRows}</tbody>
    </table>
  </div>

  <h2>📋 워치리스트 현황</h2>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>아이템</th><th>그룹</th><th>중앙값</th><th>25퍼센타일</th><th>표본 수</th><th>최근 7일 등록</th><th>관측 최고가</th><th>갱신 시각</th>
        </tr>
      </thead>
      <tbody>${watchlistRows}</tbody>
    </table>
  </div>

  <footer>
    <a href="https://github.com/klee0982-droid/gersang-watchlist">gersang-watchlist</a> · geota.co.kr 육의전 자동 수집
  </footer>
</main>
</body>
</html>
`;
}
