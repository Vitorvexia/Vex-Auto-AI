-- =============================================================================
-- Migration 044 — Motor de Mensagens Business-Initiated (BL-0040 / DL-0021)
--
-- Unifica follow-up e reativação num motor sequencial: follow-up dispara
-- primeiro (20h → 3d → 7d), reativação só começa depois que o follow-up
-- termina (7d → 15d → 30d, a partir do fim do follow-up). Trava de
-- frequência, janela de horário e opt-out compartilhados pelos dois.
--
-- Escopo:
--   1) business_hours_start/end em stores (resolve BL-0016: era env var global)
--   2) marketing_opt_out / marketing_opt_out_at / last_marketing_sent_at /
--      follow_up_completed_at em leads
--   3) Índice parcial de suporte à elegibilidade de reativação
--   4) get_followup_eligible_conversations — cadência 20h/3d/7d + novas colunas
--   5) get_reactivation_eligible_leads — âncora follow_up_completed_at (com
--      fallback pra leads que nunca completam follow-up) + cadência 7d/15d/30d
-- =============================================================================

-- =============================================================================
-- 1) Horário de disparo por loja
-- =============================================================================

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS business_hours_start time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS business_hours_end   time NOT NULL DEFAULT '20:00';

-- =============================================================================
-- 2) Opt-out + trava de frequência + fim da sequência de follow-up
-- =============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS marketing_opt_out      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_out_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_marketing_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_completed_at timestamptz;

COMMENT ON COLUMN public.leads.marketing_opt_out IS
  'Lead pediu pra não receber mais mensagens de marketing (follow-up/reativação). Detectado deterministicamente via lib/opt-out.ts, nunca pela LLM.';
COMMENT ON COLUMN public.leads.last_marketing_sent_at IS
  'Última mensagem business-initiated (follow-up ou reativação) enviada — trava de frequência compartilhada entre os dois motores (canSendMarketingMessage, lib/messaging-eligibility.ts).';
COMMENT ON COLUMN public.leads.follow_up_completed_at IS
  'Quando a sequência de follow-up terminou (3ª tentativa enviada, ou parada antecipada por resposta do lead). Âncora da elegibilidade de reativação.';

-- =============================================================================
-- 3) Índice de suporte à elegibilidade de reativação
-- =============================================================================

CREATE INDEX IF NOT EXISTS leads_reactivation_eligible_idx
  ON public.leads (store_id, follow_up_completed_at)
  WHERE lead_status NOT IN ('FECHADO', 'PERDIDO') AND marketing_opt_out = false;

-- =============================================================================
-- 4) RPC: get_followup_eligible_conversations — cadência 20h/3d/7d
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_followup_eligible_conversations(uuid, int);

CREATE OR REPLACE FUNCTION public.get_followup_eligible_conversations(
  p_store_id uuid DEFAULT NULL,
  p_limit    int  DEFAULT 20
)
RETURNS TABLE (
  conversation_id        uuid,
  store_id                uuid,
  lead_id                 uuid,
  nome                    text,
  phone_normalized        text,
  attempt_count           int,
  last_inbound_at         timestamptz,
  last_marketing_sent_at  timestamptz,
  business_hours_start    time,
  business_hours_end      time
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
    COALESCE(fs.sent_count, 0) AS attempt_count,
    -- ultima_mensagem_em só é atualizado por webhook_ingest_message (caminho
    -- de mensagem ENTRANTE) — na prática é "última mensagem do lead".
    c.ultima_mensagem_em       AS last_inbound_at,
    l.last_marketing_sent_at,
    s.business_hours_start,
    s.business_hours_end
  FROM public.conversations c
  JOIN public.leads l  ON l.id = c.lead_id
  JOIN public.stores s ON s.id = c.store_id
  LEFT JOIN follow_up_state fs ON fs.conversation_id = c.id
  WHERE
    c.conversation_status = 'ATIVA'
    AND c.handoff_to       = 'IA'
    AND c.ultima_saida_em  IS NOT NULL
    AND l.phone_normalized IS NOT NULL
    AND l.marketing_opt_out = false
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
    -- Cadência: 20h (tentativa 1) → 3d (tentativa 2) → 7d (tentativa 3)
    AND (
        (COALESCE(fs.sent_count, 0) = 0
            AND c.ultima_saida_em <= now() - INTERVAL '20 hours')
      OR
        (COALESCE(fs.sent_count, 0) = 1
            AND fs.last_sent_at <= now() - INTERVAL '3 days')
      OR
        (COALESCE(fs.sent_count, 0) = 2
            AND fs.last_sent_at <= now() - INTERVAL '7 days')
    )
  ORDER BY c.ultima_saida_em ASC
  LIMIT p_limit;
$$;

-- =============================================================================
-- 5) RPC: get_reactivation_eligible_leads — âncora follow_up_completed_at
--    (com fallback) + cadência 7d/15d/30d
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_reactivation_eligible_leads(uuid, int);

CREATE OR REPLACE FUNCTION public.get_reactivation_eligible_leads(
  p_store_id  uuid DEFAULT NULL,
  p_limit     int  DEFAULT 20
)
RETURNS TABLE (
  lead_id                 uuid,
  store_id                uuid,
  conversation_id         uuid,
  nome                    text,
  phone_normalized        text,
  attempt_count           int,
  veiculo_interesse       text,
  last_inbound_at         timestamptz,
  last_marketing_sent_at  timestamptz,
  business_hours_start    time,
  business_hours_end      time
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
  ),
  candidate AS (
    SELECT DISTINCT ON (l.id)
      l.id                                          AS lead_id,
      l.store_id,
      c.id                                          AS conversation_id,
      l.nome,
      l.phone_normalized,
      COALESCE(rs.sent_count, 0)                    AS attempt_count,
      (l.contexto->>'veiculo_interesse')::text      AS veiculo_interesse,
      c.ultima_mensagem_em                          AS last_inbound_at,
      l.last_marketing_sent_at,
      s.business_hours_start,
      s.business_hours_end,
      rs.last_sent_at,
      -- Âncora primária: fim da sequência de follow-up. Fallback (leads que
      -- nunca completam follow-up — handoff cedo, importados antes desta
      -- migration) usa a última atividade da conversa, só quando o lead não
      -- está mais ativamente em follow-up (senão os dois motores disputariam
      -- o mesmo lead ao mesmo tempo — ver DL-0021).
      COALESCE(
        l.follow_up_completed_at,
        CASE
          WHEN NOT (c.conversation_status = 'ATIVA' AND c.handoff_to = 'IA')
            THEN c.ultima_mensagem_em
          ELSE NULL
        END
      ) AS anchor_at
    FROM public.leads l
    JOIN public.conversations c ON c.lead_id = l.id
    LEFT JOIN reactivation_state rs ON rs.lead_id = l.id
    JOIN public.stores s ON s.id = l.store_id
    WHERE
      l.lead_status NOT IN ('FECHADO', 'PERDIDO')
      AND l.phone_normalized IS NOT NULL
      AND l.marketing_opt_out = false
      AND COALESCE(rs.sent_count, 0) < 3
      AND (p_store_id IS NULL OR l.store_id = p_store_id)
      -- ATIVA / PAUSADA / ENCERRADA — lead silencioso em qualquer um
      AND c.conversation_status IN ('ATIVA', 'PAUSADA', 'ENCERRADA')
      -- Para ATIVA/PAUSADA: IA deve estar no controle. ENCERRADA: sempre elegível.
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
    -- DISTINCT ON requer ORDER BY começando com a coluna de dedup.
    -- Prioridade de conversa: ATIVA > PAUSADA > ENCERRADA.
    ORDER BY
      l.id,
      CASE c.conversation_status
        WHEN 'ATIVA'     THEN 0
        WHEN 'PAUSADA'   THEN 1
        WHEN 'ENCERRADA' THEN 2
      END,
      c.ultima_mensagem_em ASC
  )
  SELECT
    lead_id, store_id, conversation_id, nome, phone_normalized, attempt_count,
    veiculo_interesse, last_inbound_at, last_marketing_sent_at,
    business_hours_start, business_hours_end
  FROM candidate
  WHERE
    -- Sem âncora (nunca completou follow-up e ainda está ativo nele) → não elegível
    anchor_at IS NOT NULL
    -- Cadência: 7d (tentativa 1) → 15d (tentativa 2) → 30d (tentativa 3), a partir da âncora
    AND (
      (attempt_count = 0 AND anchor_at    <= now() - INTERVAL '7 days')
      OR (attempt_count = 1 AND last_sent_at <= now() - INTERVAL '15 days')
      OR (attempt_count = 2 AND last_sent_at <= now() - INTERVAL '30 days')
    )
  LIMIT p_limit;
$$;
