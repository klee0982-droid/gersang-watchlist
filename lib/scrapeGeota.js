import { CONFIG } from './config.js';

/**
 * 파싱 전략 (2026-08 실제 raw HTML 확인 후 확정)
 *
 * geota.co.kr은 Next.js App Router 사이트다. 매물 목록은 서버가 렌더한 DOM에는
 * 들어있지 않고(테이블/카드는 클라이언트에서 그려짐), 초기 HTML의 RSC 스트리밍
 * 페이로드에 JSON으로 실려 온다:
 *
 *   self.__next_f.push([1, "<escaped chunk>"])
 *
 * 이 청크들을 모두 이어붙여 escape를 풀면, 아래 형태의 매물 객체가 그대로 나온다:
 *
 *   {"itemName":"혼의결정","requiredLevel":0,"totalQuantity":163,
 *    "sellerName":"초코용","price":3500000,"duration":"장기",
 *    "createdAt":"2026-08-09T04:04:34.941773"}
 *
 * 그래서 CSS 셀렉터도, 텍스트 5줄 패턴도 아니라 "RSC 페이로드에서 매물 JSON
 * 객체를 그대로 뽑는" 방식으로 파싱한다. serverId / page 파라미터가 서버 렌더에
 * 반영되므로 페이지별·서버별로 다른 매물이 정상적으로 나온다(실측 확인).
 *
 * 다운스트림(collect.js/alert.js)이 기대하는 출력 형태는 유지한다:
 *   { itemName, quantity, price, seller, serverId }
 */

// 매물 객체는 항상 itemName을 첫 키로 갖는다: {"itemName":...,"createdAt":"..."}
// 여는 중괄호까지 포함해 마커를 잡아야 엉뚱한 중첩 객체를 집지 않고 항상 전진할 수 있음.
const ITEM_MARKER = '{"itemName"';

// self.__next_f.push([1,"..."]) 안의 문자열 청크를 전부 이어붙여 escape를 푼 원본 반환
export function extractFlightPayload(html) {
  const pushRe = /self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/g;
  let out = '';
  let m;
  while ((m = pushRe.exec(html)) !== null) {
    // 캡처된 건 JSON 문자열 리터럴의 "내용" — 따옴표로 감싸 JSON.parse하면 \uXXXX/\n/\" 전부 풀림
    try {
      out += JSON.parse(`"${m[1]}"`);
    } catch {
      // 개별 청크 파싱 실패는 무시하고 나머지 진행
    }
  }
  return out;
}

// blob의 start 위치("{"라고 가정)에서 문자열/escape를 존중하며 균형 잡힌 JSON 객체를 슬라이스
function sliceBalancedObject(blob, start) {
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < blob.length; i++) {
    const ch = blob[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      if (inStr) escaped = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return blob.slice(start, i + 1);
    }
  }
  return null; // 닫히지 않음
}

export function parseListingsFromHtml(html, serverId) {
  const blob = extractFlightPayload(html);
  const found = [];
  const seen = new Set();

  let searchFrom = 0;
  while (true) {
    const braceStart = blob.indexOf(ITEM_MARKER, searchFrom);
    if (braceStart === -1) break;
    // 항상 앞으로만 전진 — 균형 슬라이스에 실패해도 무한 루프 없음
    searchFrom = braceStart + 1;

    const objText = sliceBalancedObject(blob, braceStart);
    if (!objText) continue;

    let obj;
    try {
      obj = JSON.parse(objText);
    } catch {
      continue;
    }

    // 매물 객체인지 확인 (요구 필드가 다 있어야 함)
    const itemName = typeof obj.itemName === 'string' ? obj.itemName.trim() : '';
    const price = Number(obj.price);
    const quantity = Number(obj.totalQuantity);
    const seller = typeof obj.sellerName === 'string' ? obj.sellerName.trim() : '';

    if (!itemName || !seller || !Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const key = `${itemName}|${quantity}|${price}|${seller}`;
    if (seen.has(key)) continue;
    seen.add(key);

    found.push({
      itemName,
      quantity,
      price,
      seller,
      serverId,
    });
  }

  return found;
}

export async function fetchAndParsePage(serverId, page) {
  const url =
    page === 1
      ? `${CONFIG.BASE_URL}?serverId=${serverId}`
      : `${CONFIG.BASE_URL}?serverId=${serverId}&page=${page}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`요청 실패 (${res.status}): ${url}`);
  }

  const html = await res.text();
  return parseListingsFromHtml(html, serverId);
}

export async function collectAllListings() {
  const all = [];

  for (const serverId of CONFIG.SERVER_IDS) {
    for (let page = 1; page <= CONFIG.PAGES_PER_SERVER; page++) {
      try {
        const listings = await fetchAndParsePage(serverId, page);
        all.push(...listings);
      } catch (err) {
        console.error(`서버 ${serverId} 페이지 ${page} 수집 실패:`, err.message);
      }
      await new Promise((r) => setTimeout(r, CONFIG.REQUEST_DELAY_MS));
    }
  }

  return all;
}
