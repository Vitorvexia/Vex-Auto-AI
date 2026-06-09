-- =============================================================================
-- Migration 019 — Mina de Ouro: métricas de resultado para reativações
--
-- Escopo:
--   1) Expandir attempt_number para máximo 3 (era 2)
--   2) responded_at, converted_at — rastreio de resultado por tentativa
--   3) Índices para queries de métricas
--   4) Atualizar get_reactivation_eligible_leads:
--        - máximo 3 tentativas
--        - incluir conversas ENCERRADA
--        - retornar veiculo_interesse (leads.contexto jsonb)
--        - DISTINCT ON (lead_id) — evita duplicatas por múltiplas conversas
-- =============================================================================

-- =============================================================================
-- 1) Expandir check constraint: attempt_number 1–3 (era 1–2)
-- =============================================================================

ALTER TABLE public.reactivation_logs
  DROP CONSTRAINT IF EXISTS reactivation_logs_attempt_number_check;

ALTER TABLE public.reactivation_logs
  ADD CONSTRAINT reactivation_logs_attempt_number_check
    CHECK (attempt_number BETWEEN 1 AND 3);

-- =============================================================================
-- 2) Colunas de resultado
-- =============================================================================

ALTER TABLE public.reactivation_logs
  ADD COLUMN IF NOT EXISTS responded_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.reactivation_logs.responded_at IS
  'Quando o lead enviou uma mensagem após esta tentativa de reativação (dentro de 30 dias). Atualizado pelo pipeline de IA ao processar mensagem entrante.';

COMMENT ON COLUMN public.reactivation_logs.converted_at IS
  'Quando o lead foi marcado como FECHADO após ter respondido a esta reativação. Requer responded_at preenchido.';

-- =============================================================================
-- 3) Índices para métricas
-- =============================================================================

CREATE INDEX IF NOT EXISTS reactivation_logs_responded_idx
  ON public.reactivation_logs (lead_id, logged_at)
  WHERE responded_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS reactivation_logs_converted_idx
  ON public.reactivation_logs (store_id, logged_at)
  WHERE converted_at IS NOT NULL;

-- =============================================================================
-- 4) RPC atualizada: get_reactivation_eligible_leads
--
-- Mudanças vs. migration 010:
--   - COALESCE(rs.sent_count, 0) < 3 (era < 2)
--   - conversation_status inclui 'ENCERRADA'
--   - ENCERRADA dispensa handoff_to = 'IA'
--   - DISTINCT ON (l.id): 1 lead = 1 linha, priorizando ATIVA > PAUSADA > ENCERRADA
--   - Retorna veiculo_interesse extraído de leads.contexto
--   - Tentativas 2+: última reativação há ≥ 30 dias (generaliza tentativa 3)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_reactivation_eligible_leads(
  p_store_id  uuid DEFAULT NULL,
  p_limit     int  DEFAULT 20
)
RETURNS TABLE (
  lead_id           uuid,
  store_id          uuid,
  conversation_id   uuid,
  nome              text,
  phone_normalized  text,
  attempt_count     int,
  veiculo_interesse text
)
LANGUAGE sql
STABLE
AS $$
  WITH reactivation_state AS (
    SELECT
      rl.lead_id,
      COUNT(*) FILTER (WHERE rl.status = 'sent')::int   AS sent_count,
      MAX(rl.logged_at) FILTER (WHERE rl.status = 'sent') AS last_sent_at
    FROM public.reactivation_logs rl
    GROUP BY rl.lead_id
  )
  SELECT DISTINCT ON (l.id)
    l.id                                          AS lead_id,
    l.store_id,
    c.id                                          AS conversation_id,
    l.nome,
    l.phone_normalized,
    COALESCE(rs.sent_count, 0)                    AS attempt_count,
    (l.contexto->>'veiculo_interesse')::text      AS veiculo_interesse
  FROM public.leads l
  JOIN public.conversations c ON c.lead_id = l.id
  LEFT JOIN reactivation_state rs ON rs.lead_id = l.id
  WHERE
    l.lead_status NOT IN ('FECHADO', 'PERDIDO')
    AND l.phone_normalized IS NOT NULL
    AND COALESCE(rs.sent_count, 0) < 3
    AND (p_store_id IS NULL OR l.store_id = p_store_id)
    -- ATIVA / PAUSADA / ENCERRADA — lead silencioso em qualquer um
    AND c.conversation_status IN ('ATIVA', 'PAUSADA', 'ENCERRADA')
    -- Para ATIVA/PAUSADA: IA deve estar no controle.
    -- ENCERRADA: conversa já finalizada, reativação sempre elegível.
    AND (
      c.conversation_status = 'ENCERRADA'
      OR c.handoff_to = 'IA'
    )
    -- Sem mensagem ENTRANTE nos últimos 14 dias nesta conversa
    AND NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.conversation_id = c.id
        AND m.direcao = 'entrada'
        AND m.received_at > NOW() - INTERVAL '14 days'
    )
    -- Cadência: tentativa 1 (14d inativo) ou tentativas 2+ (30d desde última reativação)
    AND (
      (COALESCE(rs.sent_count, 0) = 0
        AND c.ultima_mensagem_em <= NOW() - INTERVAL '14 days')
      OR
      (COALESCE(rs.sent_count, 0) >= 1
        AND rs.last_sent_at <= NOW() - INTERVAL '30 days')
    )
  -- DISTINCT ON requer ORDER BY começando com a coluna de dedup.
  -- Prioridade de conversa: ATIVA > PAUSADA > ENCERRADA (evita reativar lead ativo).
  ORDER BY
    l.id,
    CASE c.conversation_status
      WHEN 'ATIVA'     THEN 0
      WHEN 'PAUSADA'   THEN 1
      WHEN 'ENCERRADA' THEN 2
    END,
    c.ultima_mensagem_em ASC
  LIMIT p_limit;
$$;

-- =============================================================================
-- down
-- =============================================================================
-- ALTER TABLE public.reactivation_logs DROP COLUMN IF EXISTS converted_at;
-- ALTER TABLE public.reactivation_logs DROP COLUMN IF EXISTS responded_at;
-- DROP INDEX IF EXISTS reactivation_logs_converted_idx;
-- DROP INDEX IF EXISTS reactivation_logs_responded_idx;
-- ALTER TABLE public.reactivation_logs DROP CONSTRAINT IF EXISTS reactivation_logs_attempt_number_check;
-- ALTER TABLE public.reactivation_logs ADD CONSTRAINT reactivation_logs_attempt_number_check CHECK (attempt_number BETWEEN 1 AND 2);
-- (Restaurar RPC 010 manualmente.)
