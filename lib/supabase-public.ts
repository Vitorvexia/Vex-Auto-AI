import { createClient } from "@supabase/supabase-js";

// Cliente da rota pública (site da loja, roadmap 1.3) — sem sessão, sem
// cookie, sem usuário. SEMPRE anon key, NUNCA service_role (decisão nº 5):
// a RLS/grant da view é a segunda camada de proteção, não a única — este
// cliente não pode ter privilégio de bypass em nenhuma circunstância.
export function createPublicSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
