-- =============================================================================
-- Vex Auto  Migration 015 — corrigir constraint kind em ai_logs
--
-- Contexto: ai_logs_kind_check foi adicionada manualmente ao Studio sem
-- documentação. A constraint rejeita TODOS os valores, tornando logAi()
-- incapaz de inserir qualquer registro. Logging de IA está completamente
-- quebrado em produção desde a criação da coluna.
--
-- Fix: drop da constraint quebrada + recriar com valores do domínio atual.
-- Valores definidos: pipeline (webhook), follow_up, reactivation.
-- =============================================================================

alter table public.ai_logs
  drop constraint if exists ai_logs_kind_check;

alter table public.ai_logs
  add constraint ai_logs_kind_check
    check (kind in ('pipeline', 'follow_up', 'reactivation'));
