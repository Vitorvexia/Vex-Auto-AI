-- =============================================================================
-- Migration 011 — Lead score events (auditoria determinística)
--
-- Escopo:
--   1) lead_score_events — trilha auditável de cada mudança de score
--   2) Índices — por lead (consulta de isFirstScore) e por store
-- =============================================================================

CREATE TABLE public.lead_score_events (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores(id) on delete cascade,
  lead_id          uuid not null references public.leads(id) on delete cascade,
  conversation_id  uuid references public.conversations(id) on delete set null,
  old_score        int not null,
  new_score        int not null,
  delta            int not null,
  reasons          jsonb not null default '[]'::jsonb,
  source           text not null check (source in (
                     'message', 'follow_up', 'reactivation', 'system'
                   )),
  created_at       timestamptz not null default now()
);

CREATE INDEX lead_score_events_lead_idx
  ON public.lead_score_events(lead_id, created_at desc);

CREATE INDEX lead_score_events_store_idx
  ON public.lead_score_events(store_id, created_at desc);

ALTER TABLE public.lead_score_events ENABLE ROW LEVEL SECURITY;
