-- =============================================================================
-- Vex Auto  Migration 021 — Onboarding wizard tracking
-- =============================================================================
-- Adiciona rastreio de progresso do wizard de primeiro acesso (self-service).
--
-- onboarding_completed_at: NULL = wizard ainda travando a loja (middleware
-- redireciona pra /onboarding). Setado uma vez, nunca mais limpo automaticamente
-- (só reset manual por superadmin em /admin — ver lib/onboarding-actions.ts).
--
-- estoque_wizard_skipped: única parte do progresso que não dá pra derivar dos
-- dados existentes — zero veículos é ambíguo (nunca tentou vs. decidiu pular).
-- Os outros 3 passos (nome, vendedor, whatsapp) são derivados direto do estado
-- de `stores`/`users`/`vehicles` — ver lib/onboarding.ts.
-- =============================================================================

-- up

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS estoque_wizard_skipped boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.stores.onboarding_completed_at IS
  'NULL = wizard de primeiro acesso ainda pendente. Setado uma vez, permanente.';
COMMENT ON COLUMN public.stores.estoque_wizard_skipped IS
  'true = admin clicou "cadastrar depois" no passo de estoque do wizard.';

-- =============================================================================
-- down
-- =============================================================================
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS estoque_wizard_skipped;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS onboarding_completed_at;
