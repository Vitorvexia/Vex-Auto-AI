import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase para Client Components — usa anon key + sessão do browser.
// NÃO usa service_role. Respeita RLS (necessário pro Realtime herdar isolamento por store).
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
