import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidos no .env.local"
  );
}

/**
 * Cliente server-side com privilegios de service_role (bypassa RLS).
 * Usar apenas em rotas de API. NUNCA expor no cliente.
 */
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
