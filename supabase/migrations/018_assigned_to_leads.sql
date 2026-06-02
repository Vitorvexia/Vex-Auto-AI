-- =============================================================================
-- Vex Auto  Migration 018 — leads.assigned_to
-- =============================================================================
-- Adiciona coluna assigned_to em leads para vinculo direto lead → vendedor.
--
-- NULL = sem dono definido (estado válido — lead não atribuído).
-- Valor presente = vendedor responsável pelo lead dentro da mesma loja.
--
-- Invariante de multi-tenant: assigned_to deve pertencer à mesma store_id do
-- lead. Enforced em dois níveis:
--   1. Server Action (getServerStoreId + validação de permissão)
--   2. Trigger DB (check_lead_assigned_to_store) — defense in depth
--
-- Índice composto (store_id, assigned_to, lead_status) otimiza queries de
-- inbox operacional por vendedor (lista de leads atribuídos a mim, por status).
-- O índice leads_store_status_idx (store_id, lead_status) criado em 001 NÃO é
-- duplicado aqui.
-- =============================================================================

-- up

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to uuid
    REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leads.assigned_to IS
  'Vendedor responsável pelo lead. NULL = não atribuído. Deve pertencer à mesma store_id do lead (enforced por trigger check_lead_assigned_to_store).';

CREATE INDEX IF NOT EXISTS leads_store_assigned_idx
  ON public.leads(store_id, assigned_to, lead_status);

-- =============================================================================
-- Trigger: check_lead_assigned_to_store
-- Rejeita INSERT/UPDATE se assigned_to pertence a outra loja.
-- Só dispara quando NEW.assigned_to IS NOT NULL.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_lead_assigned_to_store()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.users
       WHERE id       = NEW.assigned_to
         AND store_id = NEW.store_id
    ) THEN
      RAISE EXCEPTION
        'assigned_to must belong to the same store as the lead (store_id = %)',
        NEW.store_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_check_assigned_to_store ON public.leads;

CREATE TRIGGER leads_check_assigned_to_store
  BEFORE INSERT OR UPDATE OF assigned_to
  ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.check_lead_assigned_to_store();

-- =============================================================================
-- down
-- =============================================================================
-- DROP TRIGGER  IF EXISTS leads_check_assigned_to_store ON public.leads;
-- DROP FUNCTION IF EXISTS public.check_lead_assigned_to_store();
-- DROP INDEX    IF EXISTS leads_store_assigned_idx;
-- ALTER TABLE public.leads DROP COLUMN IF EXISTS assigned_to;
