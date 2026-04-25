-- =============================================================================
-- Vex Auto  Migration 006 — Observabilidade e guarda de concorrência do pipeline
-- =============================================================================
--
-- 1. correlation_id em ai_logs  — rastreabilidade ponta-a-ponta por requisição
-- 2. ai_processing_since em conversations — guarda contra execução concorrente da IA
--
-- =============================================================================

-- Rastreabilidade: ID único por ciclo de processamento (gerado no webhook)
ALTER TABLE public.ai_logs
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;

CREATE INDEX IF NOT EXISTS ai_logs_correlation_idx
  ON public.ai_logs(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Guarda de concorrência: prevenção de dupla execução da IA para a mesma conversa.
-- NULL = livre. Valor = processando desde. Stale após 2 min (pipeline falhou sem liberar).
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_processing_since TIMESTAMPTZ;
