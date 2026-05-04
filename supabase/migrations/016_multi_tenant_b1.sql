-- =============================================================================
-- Vex Auto  Migration 016 — Multi-tenant B1: stores.active + RLS tabelas aux
-- =============================================================================
-- Completa isolamento multi-tenant nas tabelas auxiliares (D2 do eng-review).
--
-- Estado anterior:
--   follow_up_logs     — sem RLS habilitado, sem policy
--   reactivation_logs  — sem RLS habilitado, sem policy
--   lead_score_events  — RLS habilitado (011), mas sem policy
--   financing_sims     — RLS + policy já existem em 012 (NÃO alterar)
--
-- Invariante: todas as policies usam store_id = my_store_id() direto.
-- Nenhuma tabela usa join indireto — store_id é FK NOT NULL em todas.
-- =============================================================================

-- =============================================================================
-- stores.active — coluna para filtrar lojas ativas no cron diário
-- =============================================================================
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- =============================================================================
-- follow_up_logs — habilitar RLS + policy
-- =============================================================================
ALTER TABLE public.follow_up_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follow_up_logs_own_store"
  ON public.follow_up_logs
  FOR SELECT
  USING (store_id = public.my_store_id());

-- =============================================================================
-- reactivation_logs — habilitar RLS + policy
-- =============================================================================
ALTER TABLE public.reactivation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactivation_logs_own_store"
  ON public.reactivation_logs
  FOR SELECT
  USING (store_id = public.my_store_id());

-- =============================================================================
-- lead_score_events — RLS já habilitado em 011, faltava apenas a policy
-- =============================================================================
CREATE POLICY "lead_score_events_own_store"
  ON public.lead_score_events
  FOR SELECT
  USING (store_id = public.my_store_id());

-- =============================================================================
-- financing_simulations — RLS + policy existem em 012, NÃO duplicar
-- =============================================================================
