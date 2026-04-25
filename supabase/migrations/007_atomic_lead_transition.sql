-- =============================================================================
-- Migration 007 — Transição atômica de lead_status
--
-- Problema: SELECT+UPDATE separados (via PostgREST) têm janela TOCTOU.
-- Chamadas concorrentes podem ambas ler o mesmo estado e ambas ter sucesso
-- em transições que deveriam ser mutuamente exclusivas.
--
-- Solução: stored procedure com SELECT FOR UPDATE.
-- O lock de linha serializa chamadas concorrentes dentro do PostgreSQL.
-- A segunda chamada lê o estado pós-primeira (READ COMMITTED) e detecta
-- que p_from já não bate → retorna FALSE (perdeu a corrida).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.try_transition_lead_status(
  p_lead_id  UUID,
  p_from     TEXT,
  p_to       TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current TEXT;
BEGIN
  -- Adquire lock exclusivo da linha. Chamadas concorrentes bloqueiam aqui
  -- e só prosseguem após a transação vencedora commitar.
  SELECT lead_status INTO v_current
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead_not_found' USING ERRCODE = 'P0001', DETAIL = p_lead_id::TEXT;
  END IF;

  -- Verificação otimista: se o estado mudou desde que o chamador leu,
  -- outra transação ganhou a corrida → retorna FALSE.
  IF v_current <> p_from THEN
    RETURN FALSE;
  END IF;

  UPDATE public.leads
  SET lead_status = p_to
  WHERE id = p_lead_id;

  RETURN TRUE;
END;
$$;

-- Segurança: apenas service_role pode chamar esta função
REVOKE EXECUTE ON FUNCTION public.try_transition_lead_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.try_transition_lead_status(UUID, TEXT, TEXT) TO service_role;
