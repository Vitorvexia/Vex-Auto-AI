import { config } from "dotenv";

// Carrega credenciais reais quando existirem
config({ path: ".env.local", override: true });
config({ path: ".env.test" });
config({ path: ".env" });

// Fallbacks dummy: permitem que modulos que importam supabase.ts carreguem
// sem disparar erro em testes UNITARIOS. Testes de integracao usam hasSupabase
// (helpers.ts) para pular caso esses fallbacks estejam ativos.
const DUMMY_URL = "https://dummy.supabase.co";
const DUMMY_KEY = "dummy-service-role-key";

if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = DUMMY_URL;
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = DUMMY_KEY;
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = DUMMY_URL;
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = DUMMY_KEY;
}
