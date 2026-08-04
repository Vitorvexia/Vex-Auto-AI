-- Migration 039: config visual por loja (roadmap 1.5)
--
-- Logo, cor primária, telefone público, endereço e texto "sobre" — identidade
-- visual do site público da loja (1.4), até aqui hardcoded/genérico ("Veículos
-- disponíveis" sem nome/marca). Colunas direto em `stores`, mesmo padrão de
-- 017 (whatsapp_phone_number_id): estado atual da loja, sem tabela satélite.

ALTER TABLE public.stores
  ADD COLUMN logo_url         text,
  ADD COLUMN cor_primaria     text,
  ADD COLUMN telefone_publico text,
  ADD COLUMN endereco         text,
  ADD COLUMN sobre            text;

-- Formato estrito #RRGGBB — mesma validação roda em lib/store-settings.ts
-- (isValidHexColor) antes do insert via Server Action; o CHECK aqui é
-- backstop de banco (defesa em profundidade, mesmo princípio do guardrail de
-- margem no CLAUDE.md), não a única validação.
ALTER TABLE public.stores
  ADD CONSTRAINT stores_cor_primaria_hex_check
  CHECK (cor_primaria IS NULL OR cor_primaria ~ '^#[0-9A-Fa-f]{6}$');

-- Bucket PÚBLICO pra leitura — mesmo raciocínio da migration 032
-- (vehicle-photos): o site da loja é rota sem sessão, logo precisa servir
-- sem autenticação. Logo de loja não é dado sensível.
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-logos', 'store-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "store_logos_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'store-logos');

-- Escrita restrita ao store_id do usuário autenticado — path é sempre
-- {store_id}/logo.{ext} (lib/store-settings.ts), primeiro segmento do path
-- precisa bater com a store do usuário. Mesmo padrão exato da policy
-- vehicle_photos_own_store_insert (migration 032): a escrita real roda via
-- Server Action com supabaseAdmin (service_role, bypassa RLS); esta policy é
-- o backstop pro caso de escrita futura fora do Server Action.
--
-- UPDATE incluído (não só INSERT) porque uploadStoreLogo usa upsert:true —
-- substitui o logo anterior no mesmo path em vez de acumular lixo, e upsert
-- no Storage do Supabase é implementado como UPDATE quando o objeto já
-- existe. vehicle-photos não precisou de policy de UPDATE porque nunca faz
-- upsert (cada foto é um path novo, nunca substitui a anterior).
CREATE POLICY "store_logos_own_store_insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'store-logos'
    AND (storage.foldername(name))[1] = public.my_store_id()::text
  );

CREATE POLICY "store_logos_own_store_update"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'store-logos'
    AND (storage.foldername(name))[1] = public.my_store_id()::text
  )
  WITH CHECK (
    bucket_id = 'store-logos'
    AND (storage.foldername(name))[1] = public.my_store_id()::text
  );

-- Allowlist estendida da view pública (migration 035) — nome, logo_url,
-- cor_primaria, telefone_publico, endereco, sobre. Continua NUNCA expondo
-- whatsapp_numero/whatsapp_phone_number_id/qualquer credencial — allowlist
-- explícita, coluna nova em `stores` fica de fora por padrão.
CREATE OR REPLACE VIEW public.public_store_lookup
WITH (security_barrier = true)
AS
SELECT
  id,
  slug,
  nome,
  logo_url,
  cor_primaria,
  telefone_publico,
  endereco,
  sobre
FROM public.stores;

COMMENT ON VIEW public.public_store_lookup IS
  'Leitura pública (site da loja, sem sessão). Allowlist: id, slug, nome, logo_url, cor_primaria, telefone_publico, endereco, sobre. Nunca whatsapp_numero/whatsapp_phone_number_id/credencial.';
