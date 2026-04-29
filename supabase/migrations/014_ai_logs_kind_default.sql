-- =============================================================================
-- Vex Auto  Migration 014 — corrigir coluna kind em ai_logs
--
-- Contexto: kind foi adicionado manualmente ao ai_logs sem DEFAULT nem código
-- correspondente. Todo INSERT sem kind falha com NOT NULL violation, causando
-- logAi() a lançar erro silenciosamente desde o início.
--
-- Fix: set DEFAULT 'pipeline' para que inserts sem kind funcionem.
-- O código (logAi) também passa kind='pipeline' explicitamente a partir de agora.
-- =============================================================================

alter table public.ai_logs
  alter column kind set default 'pipeline';
