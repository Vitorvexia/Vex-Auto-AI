-- =============================================================================
-- Vex Auto  Migration 013 — WhatsApp send tracking
--
-- Aditiva: zero breaking change, sem alter de colunas existentes.
-- Corrige 5 bugs no retry de envio WhatsApp (PR 15):
--   1. Double-send: message_id liga ai_logs → messages (FK direta)
--   2. Erros permanentes retentados: last_send_error + pre-send guard
--   3. ok_send_failed_retrying travado: updated_at + trigger moddatetime
--   4. Sem limite de tentativas: retry_count + MAX_RETRY_ATTEMPTS=3
--   5. Erro Meta logado raw: categorização em whatsapp-send.ts
--
-- Nota: também inclui colunas originais da migration 004 (status, error_code,
-- llm_output, model, latency_ms) com ADD COLUMN IF NOT EXISTS para recuperar
-- ambientes onde a tabela foi criada manualmente antes das migrations.
-- =============================================================================

-- Extensão necessária para manter updated_at atualizado automaticamente em UPDATEs.
-- Disponível em todos os projetos Supabase via schema extensions.
create extension if not exists moddatetime schema extensions;

-- Colunas da migration 004 — garantir que existem mesmo em ambientes
-- onde ai_logs foi criada manualmente (sem status, model, etc.).
alter table public.ai_logs
  add column if not exists model       text,
  add column if not exists latency_ms  integer not null default 0,
  add column if not exists status      text not null default 'ok',
  add column if not exists error_code  text,
  add column if not exists llm_output  jsonb;

-- Colunas desta migration.
alter table public.ai_logs
  -- FK direta à mensagem específica que este log referencia.
  add column if not exists message_id  uuid
    references public.messages(id) on delete set null,
  add column if not exists retry_count    smallint not null default 0,
  add column if not exists last_send_error text,
  add column if not exists updated_at     timestamptz not null default now();

-- Trigger: mantém updated_at correto em cada UPDATE (via moddatetime extension).
drop trigger if exists ai_logs_updated_at on public.ai_logs;
create trigger ai_logs_updated_at
  before update on public.ai_logs
  for each row execute function extensions.moddatetime('updated_at');

-- Índice para o retry endpoint (status + created_at).
create index if not exists ai_logs_retry_eligible_idx
  on public.ai_logs(status, created_at)
  where status in ('ok_send_failed', 'ok_send_failed_retrying');

comment on column public.ai_logs.message_id is
  'ID da mensagem específica que este log referencia. Usado pelo retry para reenviar a mensagem correta sem double-send.';
comment on column public.ai_logs.retry_count is
  'Número de tentativas de reenvio (0 = nenhum retry). Máximo antes de permanent: MAX_RETRY_ATTEMPTS = 3.';
comment on column public.ai_logs.last_send_error is
  'Categoria de erro sanitizada (nunca texto raw da Meta). Ex: rate_limited, invalid_recipient, service_error.';
comment on column public.ai_logs.updated_at is
  'Atualizado automaticamente pelo trigger ai_logs_updated_at. Usado pelo staleness recovery do ok_send_failed_retrying.';
