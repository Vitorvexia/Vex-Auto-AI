-- =============================================================================
-- Migration 010 — Reativação automática de leads inativos
--
-- Escopo:
--   1) reactivation_logs — rastreio de tentativas com claim atômico
--   2) Índices — idempotência (lead_id + attempt_number), auxiliares
--   3) get_reactivation_eligible_leads — RPC de elegibilidade
-- =============================================================================

-- =============================================================================
-- 1) reactivation_logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.reactivation_logs (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores(id) on delete cascade,
  lead_id          uuid not null references public.leads(id) on delete cascade,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  attempt_number   int not null check (attempt_number between 1 and 2),
  message_text     text not null,
  -- status 'skipped' não existe: 23505 significa outra instância já inseriu 'sent';
  -- a instância atual não insere nenhuma row — apenas incrementa contador local.
  status           text not null check (status in ('sent', 'failed')),
  logged_at        timestamptz not null default now()
);

-- =============================================================================
-- 2) Índices
-- =============================================================================

-- Idempotência atômica: 1 'sent' por (lead, tentativa).
-- Chave em lead_id (não conversation_id): reativação é por lead.
-- Se conversa for recriada, o índice ainda previne duplicata para o mesmo lead.
CREATE UNIQUE INDEX IF NOT EXISTS reactivation_logs_sent_uidx
  ON public.reactivation_logs(lead_id, attempt_number)
  WHERE status = 'sent';

-- Auxiliares para JOIN na query de elegibilidade e filtragem
CREATE INDEX IF NOT EXISTS reactivation_logs_lead_idx
  ON public.reactivation_logs(lead_id);

CREATE INDEX IF NOT EXISTS reactivation_logs_store_idx
  ON public.reactivation_logs(store_id);

CREATE INDEX IF NOT EXISTS reactivation_logs_logged_idx
  ON public.reactivation_logs(logged_at);

-- =============================================================================
-- 3) RPC: get_reactivation_eligible_leads
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_reactivation_eligible_leads(
  p_store_id uuid DEFAULT NULL,
  p_limit    int  DEFAULT 20
)
RETURNS TABLE (
  lead_id          uuid,
  store_id         uuid,
  conversation_id  uuid,
  nome             text,
  phone_normalized text,
  attempt_count    int
)
LANGUAGE sql
STABLE
AS $$
  WITH reactivation_state AS (
    SELECT
      rl.lead_id,
      count(*)          FILTER (WHERE rl.status = 'sent')::int  AS sent_count,
      max(rl.logged_at) FILTER (WHERE rl.status = 'sent')       AS last_sent_at
    FROM public.reactivation_logs rl
    GROUP BY rl.lead_id
  )
  SELECT
    l.id             AS lead_id,
    l.store_id,
    c.id             AS conversation_id,
    l.nome,
    l.phone_normalized,
    COALESCE(rs.sent_count, 0) AS attempt_count
  FROM public.leads l
  JOIN public.conversations c ON c.lead_id = l.id
  LEFT JOIN reactivation_state rs ON rs.lead_id = l.id
  WHERE
    l.lead_status NOT IN ('FECHADO', 'PERDIDO')
    AND c.conversation_status IN ('ATIVA', 'PAUSADA')
    AND c.handoff_to = 'IA'
    AND l.phone_normalized IS NOT NULL
    -- Nunca mais de 2 tentativas
    AND COALESCE(rs.sent_count, 0) < 2
    -- Sem resposta recente do lead (defensivo: captura edge cases onde
    -- ultima_mensagem_em não foi atualizado mas mensagem entrada existe)
    AND NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.conversation_id = c.id
        AND m.direcao = 'entrada'
        AND m.received_at > now() - INTERVAL '14 days'
    )
    AND (p_store_id IS NULL OR l.store_id = p_store_id)
    AND (
      -- Tentativa 1: sem reativação prévia, inativo há 14 dias
      (COALESCE(rs.sent_count, 0) = 0
        AND c.ultima_mensagem_em <= now() - INTERVAL '14 days')
      OR
      -- Tentativa 2: última reativação sent há 30 dias
      (COALESCE(rs.sent_count, 0) = 1
        AND rs.last_sent_at <= now() - INTERVAL '30 days')
    )
  ORDER BY c.ultima_mensagem_em ASC
  LIMIT p_limit;
$$;
