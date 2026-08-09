import { createClient } from '@supabase/supabase-js';

// GitHub Actions secrets를 대시보드에서 복사/등록할 때 개행이 섞여 들어오는 경우가 흔해서
// (HTTP 헤더 값으로 못 씀 → "invalid header value" 에러) 방어적으로 공백을 전부 제거한다.
// URL/JWT 둘 다 원래 공백을 포함하지 않는 값이라 안전함.
const stripWhitespace = (v) => v?.replace(/\s+/g, '');
const url = stripWhitespace(process.env.SUPABASE_URL);
const serviceRoleKey = stripWhitespace(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!url || !serviceRoleKey) {
  throw new Error(
    'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다. .env 또는 GitHub Actions secrets를 확인하세요.'
  );
}

// service_role 키를 쓰기 때문에 RLS를 우회함. 서버 사이드(GitHub Actions)에서만 사용.
// 절대 프론트엔드나 클라이언트 코드에 이 키를 노출하지 말 것.
export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
