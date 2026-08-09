import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
