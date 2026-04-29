-- =============================================================================
-- Vex Auto  Migration 012 — WhatsApp send tracking
--
-- Aditiva: zero breaking change, sem alter de colunas existentes.
-- Corrige 5 bugs no retry de envio WhatsApp (PR 15):
--   1. Double-send: message_id liga ai_logs → messages (FK direta)
--   2. Erros permanentes retentados: last_send_error + pre-send guard
--   3. ok_send_failed_retrying travado: updated_at + trigger moddatetime
--   4. Sem limite de tentativas: retry_count + MAX_RETRY_ATTEMPTS=3
--   5. Erro Meta logado raw: categorização em whatsapp-send.ts
-- =============================================================================

-- Extensão necessária para manter updated_at atualizado automaticamente em UPDATEs.
-- Disponível em todos os projetos Supabase via schema extensions.
create extension if not exists moddatetime schema extensions;

alter table public.ai_logs
  -- FK direta à mensagem específica que este log referencia.
  -- Permite retry reenviar a mensagem correta sem risco de double-send.
  -- NULL para logs antigos (sem message_id); retry usa fallback por 72h.
  add column if not exists message_id uuid
    references public.messages(id) on delete set null,

  -- Número de tentativas de reenvio (0 = nenhum retry ainda).
  -- Máximo antes de escalar para ok_send_failed_permanent: MAX_RETRY_ATTEMPTS = 3.
  add column if not exists retry_count smallint not null default 0,

  -- Categoria de erro sanitizada — nunca texto raw da Meta.
  -- Valores possíveis: rate_limited, invalid_recipient, service_error, auth_error, unknown.
  -- NULL quando não houve falha de envio.
  add column if not exists last_send_error text,

  -- Atualizado automaticamente pelo trigger ai_logs_updated_at (moddatetime).
  -- Usado pelo staleness recovery: retrying > 15min → processo crashou → resetar.
  add column if not exists updated_at timestamptz not null default now();

-- Trigger: mantém updated_at correto em cada UPDATE (via moddatetime extension).
create trigger ai_logs_updated_at
  before update on public.ai_logs
  for each row execute function extensions.moddatetime('updated_at');

-- Índice parcial para o retry endpoint:
--   - Busca de candidatos ok_send_failed
--   - Staleness recovery: ok_send_failed_retrying + updated_at
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
