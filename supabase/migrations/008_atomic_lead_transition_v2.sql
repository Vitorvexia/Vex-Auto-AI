-- =============================================================================
-- Migration 008 — Transição atômica de lead_status v2
--
-- Problema com 007: SELECT(TypeScript) + RPC(DB) são chamadas separadas.
-- Se A completa o SELECT+RPC inteiro antes de B fazer o SELECT inicial,
-- B lê o estado pós-A e faz uma transição sequencial diferente — ambos
-- succedem, mas o teste espera que apenas 1 vença.
--
-- Solução: único RPC sem SELECT externo. pg_try_advisory_xact_lock(NOWAIT)
-- serializa tentativas concorrentes no mesmo lead dentro do DB.
-- B tenta o lock enquanto A o mantém → retorna FALSE imediatamente
-- (sem esperar) → TypeScript lança ConcurrentTransitionError.
--
-- Sem colisão de hash: hashtext produz int32, colisão improvável para N baixo.
-- Para segurança extra em produção poderia usar MD5 e tomar 8 bytes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.transition_lead_status(
  p_lead_id  UUID,
  p_to       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current  TEXT;
  v_lock_key BIGINT;
BEGIN
  v_lock_key := hashtext(p_lead_id::text)::bigint;

  -- Tenta adquirir lock de transação (NOWAIT). Se outra transação está
  -- atualizando este lead, retorna FALSE imediatamente (sem bloquear).
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RETURN jsonb_build_object('from', NULL::text, 'result', 'concurrent');
  END IF;

  SELECT lead_status INTO v_current
  FROM public.leads
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead_not_found' USING ERRCODE = 'P0001', DETAIL = p_lead_id::TEXT;
  END IF;

  IF v_current = p_to THEN
    RETURN jsonb_build_object('from', v_current, 'result', 'no_change');
  END IF;

  -- Valida transição (espelha LEAD_TRANSITIONS em lib/status.ts)
  IF NOT (
    (v_current = 'NOVO'        AND p_to = ANY(ARRAY['ENGAJADO', 'PERDIDO'])) OR
    (v_current = 'ENGAJADO'    AND p_to = ANY(ARRAY['INTERESSADO', 'QUENTE', 'PERDIDO'])) OR
    (v_current = 'INTERESSADO' AND p_to = ANY(ARRAY['QUENTE', 'ENGAJADO', 'PERDIDO'])) OR
    (v_current = 'QUENTE'      AND p_to = ANY(ARRAY['NEGOCIACAO', 'INTERESSADO', 'PERDIDO'])) OR
    (v_current = 'NEGOCIACAO'  AND p_to = ANY(ARRAY['FECHADO', 'PERDIDO', 'QUENTE'])) OR
    (v_current = 'PERDIDO'     AND p_to = ANY(ARRAY['ENGAJADO']))
  ) THEN
    RETURN jsonb_build_object('from', v_current, 'result', 'invalid');
  END IF;

  UPDATE public.leads
  SET lead_status = p_to
  WHERE id = p_lead_id;

  RETURN jsonb_build_object('from', v_current, 'result', 'ok');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transition_lead_status(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.transition_lead_status(UUID, TEXT) TO service_role;
