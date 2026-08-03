-- Migration 035: view public_store_lookup + acesso anon (roadmap 1.3)
--
-- Achado ao implementar lib/public-store.ts: resolveStoreIdBySlug precisa
-- ler `stores` usando a anon key (decisão nº 5 — rota pública nunca usa
-- service_role), mas `stores` não tem NENHUMA policy de RLS que libere o
-- role `anon` (migration 005 só libera `authenticated` via
-- `id = my_store_id()`, que exige linha em `public.users` — anon não tem).
-- Sem esta view, todo SELECT via anon em `stores` retorna 0 linhas e a
-- resolução de slug nunca funcionaria em produção.
--
-- Mesma arquitetura de allowlist da migration 034 (view + grant, não
-- CREATE POLICY — motivo idêntico: Postgres não suporta RLS em views):
-- só `id` e `slug` — nunca `nome`, `whatsapp_numero`,
-- `whatsapp_phone_number_id` ou qualquer outra coluna de `stores`.

CREATE VIEW public.public_store_lookup
WITH (security_barrier = true)
AS
SELECT id, slug
FROM public.stores;

COMMENT ON VIEW public.public_store_lookup IS
  'Leitura pública mínima (slug -> store_id) para o site da loja, sem sessão. Allowlist: id, slug. Nunca nome/whatsapp/telefone.';

GRANT SELECT ON public.public_store_lookup TO anon;
