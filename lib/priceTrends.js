// 스파크라인용 시계열을 만드는 순수 함수. 원본 매물 행(rows)을 받아
// item_name별로 시간순 {t, price} 배열을 만든다.
//
// 같은 collect 실행에서 동시에 올라온 여러 매물은 collected_at이 완전히
// 동일하게 찍힌다(한 INSERT 문 안에서 Postgres now()가 한 번만 평가됨).
// 이걸 그대로 점으로 찍으면 x좌표가 겹쳐서 스파크라인이 세로 선(틱)으로
// 뭉개진다 — 그래서 같은 시각의 여러 매물은 "그 순간 가장 싼 값" 하나로
// 합친다(이 앱의 목적 자체가 저평가 매물 탐색이라 min이 median보다 적합).
export function buildPriceTrends(rows, { maxPointsPerItem = 60 } = {}) {
  const minByItemAndTime = new Map(); // item_name -> Map(t -> minPrice)

  for (const row of rows) {
    const t = new Date(row.collected_at).getTime();
    let tMap = minByItemAndTime.get(row.item_name);
    if (!tMap) {
      tMap = new Map();
      minByItemAndTime.set(row.item_name, tMap);
    }
    const prev = tMap.get(t);
    tMap.set(t, prev === undefined ? row.price : Math.min(prev, row.price));
  }

  const result = new Map();
  for (const [itemName, tMap] of minByItemAndTime) {
    const points = [...tMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, price]) => ({ t, price }));
    result.set(itemName, downsample(points, maxPointsPerItem));
  }
  return result;
}

function downsample(points, max) {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}
