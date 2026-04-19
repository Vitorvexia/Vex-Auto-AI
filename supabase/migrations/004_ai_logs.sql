-- =============================================================================
-- Vex Auto  Migration 004 — tabela ai_logs
-- =============================================================================
create table if not exists public.ai_logs (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  lead_id         uuid not null references public.leads(id) on delete cascade,
  model           text,
  latency_ms      integer not null,
  status          text not null,
  error_code      text,
  llm_output      jsonb,
  tokens_input    integer,
  tokens_output   integer,
  created_at      timestamptz not null default now()
);

create index if not exists ai_logs_conversation_idx
  on public.ai_logs(conversation_id, created_at desc);

create index if not exists ai_logs_store_idx
  on public.ai_logs(store_id, created_at desc);
