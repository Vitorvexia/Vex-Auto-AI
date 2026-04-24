-- =============================================================================
-- Migration 009 — Follow-up automático básico
--
-- Escopo:
--   1) ultima_saida_em em conversations — âncora de cadência
--   2) Trigger: atualiza ultima_saida_em após INSERT em messages (direcao='saida')
--   3) follow_up_logs — rastreio de tentativas com claim atômico
--   4) get_followup_eligible_conversations — RPC de elegibilidade
-- =============================================================================

-- =============================================================================
-- 1) ultima_saida_em em conversations
-- =============================================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ultima_saida_em timestamptz;

-- Backfill: a partir do insert mais recente de saida por conversa
UPDATE public.conversations c
SET ultima_saida_em = m.latest_saida
FROM (
  SELECT
    conversation_id,
    max(received_at) AS latest_saida
  FROM public.messages
  WHERE direcao = 'saida'
  GROUP BY conversation_id
) m
WHERE c.id = m.conversation_id
  AND c.ultima_saida_em IS NULL;

-- Índice parcial para a query de elegibilidade
CREATE INDEX IF NOT EXISTS conversations_followup_eligible_idx
  ON public.conversations(store_id, ultima_saida_em)
  WHERE conversation_status = 'ATIVA'
    AND handoff_to = 'IA'
    AND ultima_saida_em IS NOT NULL;

-- =============================================================================
-- 2) Trigger: mantém ultima_saida_em atualizado
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_ultima_saida_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.direcao = 'saida' THEN
    UPDATE public.conversations
    SET ultima_saida_em = COALESCE(NEW.received_at, now())
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_update_ultima_saida_em ON public.messages;
CREATE TRIGGER messages_update_ultima_saida_em
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ultima_saida_em();

-- =============================================================================
-- 3) follow_up_logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.follow_up_logs (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  store_id         uuid not null references public.stores(id) on delete cascade,
  lead_id          uuid not null references public.leads(id) on delete cascade,
  attempt_number   int not null check (attempt_number between 1 and 3),
  status           text not null check (status in ('sent', 'failed')),
  error_message    text,
  logged_at        timestamptz not null default now()
);

-- Previne double-send concorrente: apenas um 'sent' por (conversa, tentativa)
CREATE UNIQUE INDEX IF NOT EXISTS follow_up_logs_sent_uidx
  ON public.follow_up_logs(conversation_id, attempt_number)
  WHERE status = 'sent';

-- Índice auxiliar para JOIN na query de elegibilidade
CREATE INDEX IF NOT EXISTS follow_up_logs_conv_idx
  ON public.follow_up_logs(conversation_id);

-- =============================================================================
-- 4) RPC: get_followup_eligible_conversations
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_followup_eligible_conversations(
  p_store_id uuid DEFAULT NULL,
  p_limit    int  DEFAULT 20
)
RETURNS TABLE (
  conversation_id  uuid,
  store_id         uuid,
  lead_id          uuid,
  nome             text,
  phone_normalized text,
  attempt_count    int
)
LANGUAGE sql
STABLE
AS $$
  WITH follow_up_state AS (
    SELECT
      fl.conversation_id,
      count(*)    FILTER (WHERE fl.status = 'sent')::int AS sent_count,
      max(fl.logged_at) FILTER (WHERE fl.status = 'sent')  AS last_sent_at
    FROM public.follow_up_logs fl
    GROUP BY fl.conversation_id
  )
  SELECT
    c.id            AS conversation_id,
    c.store_id,
    c.lead_id,
    l.nome,
    l.phone_normalized,
    COALESCE(fs.sent_count, 0) AS attempt_count
  FROM public.conversations c
  JOIN public.leads l
    ON l.id = c.lead_id
  LEFT JOIN follow_up_state fs
    ON fs.conversation_id = c.id
  WHERE
    c.conversation_status = 'ATIVA'
    AND c.handoff_to       = 'IA'
    AND c.ultima_saida_em  IS NOT NULL
    AND l.phone_normalized IS NOT NULL
    -- Nunca mais de 3 tentativas
    AND COALESCE(fs.sent_count, 0) < 3
    -- Lead não respondeu depois da última mensagem de saída
    AND NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.conversation_id = c.id
        AND m.direcao          = 'entrada'
        AND m.received_at      > c.ultima_saida_em
    )
    -- Filtro de loja (opcional)
    AND (p_store_id IS NULL OR c.store_id = p_store_id)
    -- Cadência: âncora em ultima_saida_em para tentativa 1,
    --           last_sent_at para tentativas 2 e 3
    AND (
        (COALESCE(fs.sent_count, 0) = 0
            AND c.ultima_saida_em <= now() - INTERVAL '2 hours')
      OR
        (COALESCE(fs.sent_count, 0) = 1
            AND fs.last_sent_at <= now() - INTERVAL '24 hours')
      OR
        (COALESCE(fs.sent_count, 0) = 2
            AND fs.last_sent_at <= now() - INTERVAL '72 hours')
    )
  ORDER BY c.ultima_saida_em ASC
  LIMIT p_limit;
$$;
