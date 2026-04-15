-- =============================================================================
-- Vex Auto  Migration 001 (schema inicial)
-- =============================================================================
-- Escopo: schema estrutural do MVP.
--  Multi-tenant via store_id em todas as entidades de negocio.
--  Idempotencia de webhook via messages.message_external_id.
--  lead_status e conversation_status separados e ortogonais.
--  RLS habilitado em todas as tabelas (policies em migration futura).
-- =============================================================================

-- Extensoes
create extension if not exists "pgcrypto";

-- =============================================================================
-- Helper: trigger para updated_at
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- stores (raiz multi-tenant)
-- =============================================================================
create table public.stores (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  whatsapp_numero  text not null unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger stores_set_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

-- =============================================================================
-- users (perfil vinculado ao auth.users do Supabase)
-- =============================================================================
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  store_id    uuid not null references public.stores(id) on delete restrict,
  nome        text not null,
  role        text not null check (role in ('admin','vendedor')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index users_store_id_idx on public.users(store_id);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- =============================================================================
-- leads
-- =============================================================================
create table public.leads (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores(id) on delete cascade,
  phone_normalized  text not null
                      check (phone_normalized ~ '^\+[1-9][0-9]{6,14}$'),
  nome              text,
  origem            text not null default 'whatsapp'
                      check (origem in ('whatsapp','portal','base_inativa','manual')),
  lead_status       text not null default 'NOVO'
                      check (lead_status in (
                        'NOVO','ENGAJADO','INTERESSADO','QUENTE',
                        'NEGOCIACAO','FECHADO','PERDIDO'
                      )),
  score             int  not null default 0 check (score between 0 and 100),
  contexto          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Um lead unico por (store, telefone normalizado)
create unique index leads_store_phone_uidx
  on public.leads(store_id, phone_normalized);

create index leads_store_status_idx
  on public.leads(store_id, lead_status);

create index leads_store_score_idx
  on public.leads(store_id, score desc);

create index leads_store_updated_idx
  on public.leads(store_id, updated_at desc);

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

-- =============================================================================
-- conversations
-- =============================================================================
create table public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  store_id              uuid not null references public.stores(id) on delete cascade,
  lead_id               uuid not null references public.leads(id) on delete cascade,
  canal                 text not null default 'whatsapp'
                          check (canal in ('whatsapp','instagram','portal_chat')),
  conversation_status   text not null default 'ATIVA'
                          check (conversation_status in (
                            'ATIVA','AGUARDANDO_HUMANO','PAUSADA','ENCERRADA'
                          )),
  handoff_to            text not null default 'IA'
                          check (handoff_to in ('IA','HUMANO')),
  assigned_to           uuid references public.users(id) on delete set null,
  summary               text,
  iniciada_em           timestamptz not null default now(),
  ultima_mensagem_em    timestamptz not null default now(),
  encerrada_em          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index conversations_lead_idx
  on public.conversations(lead_id);

create index conversations_store_status_idx
  on public.conversations(store_id, conversation_status, ultima_mensagem_em desc);

create index conversations_assigned_idx
  on public.conversations(assigned_to)
  where assigned_to is not null;

-- No maximo uma conversa nao encerrada por lead
create unique index conversations_one_open_per_lead_uidx
  on public.conversations(lead_id)
  where conversation_status in ('ATIVA','AGUARDANDO_HUMANO','PAUSADA');

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

-- =============================================================================
-- messages
-- =============================================================================
create table public.messages (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null references public.stores(id) on delete cascade,
  conversation_id      uuid not null references public.conversations(id) on delete cascade,
  lead_id              uuid not null references public.leads(id) on delete cascade,
  message_external_id  text,
  direcao              text not null check (direcao in ('entrada','saida')),
  autor                text not null check (autor in ('lead','ia','humano','sistema')),
  mensagem             text not null,
  meta                 jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

create index messages_conversation_created_idx
  on public.messages(conversation_id, created_at desc);

create index messages_lead_created_idx
  on public.messages(lead_id, created_at desc);

create index messages_store_created_idx
  on public.messages(store_id, created_at desc);

-- Idempotencia do webhook (nunca gravar o mesmo external_id duas vezes)
create unique index messages_external_id_uidx
  on public.messages(message_external_id)
  where message_external_id is not null;

-- =============================================================================
-- vehicles
-- =============================================================================
create table public.vehicles (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  marca          text not null,
  modelo         text not null,
  ano            int  not null check (ano between 1900 and 2100),
  preco          numeric(12,2) not null check (preco >= 0),
  custo          numeric(12,2) not null check (custo >= 0),
  margem_minima  numeric(12,2) not null default 0 check (margem_minima >= 0),
  disponivel     boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index vehicles_store_disponivel_idx
  on public.vehicles(store_id, disponivel);

create index vehicles_store_preco_idx
  on public.vehicles(store_id, preco);

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

-- =============================================================================
-- ai_logs (observabilidade minima das chamadas a LLM)
-- =============================================================================
create table public.ai_logs (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores(id) on delete cascade,
  conversation_id  uuid references public.conversations(id) on delete set null,
  lead_id          uuid references public.leads(id) on delete set null,
  kind             text not null check (kind in (
                     'run_agent','followup','briefing_retorno','scoring','guardrail'
                   )),
  model            text,
  prompt_input     jsonb,
  llm_output       jsonb,
  tokens_input     int,
  tokens_output    int,
  latency_ms       int,
  error            text,
  created_at       timestamptz not null default now()
);

create index ai_logs_conversation_idx
  on public.ai_logs(conversation_id, created_at desc);

create index ai_logs_store_kind_idx
  on public.ai_logs(store_id, kind, created_at desc);

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- Habilitado em todas as tabelas por seguranca.
-- Sem policies = acesso apenas via service_role.
-- Policies por store_id virao em migration proxima (002_rls.sql).
-- =============================================================================
alter table public.stores         enable row level security;
alter table public.users          enable row level security;
alter table public.leads          enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.vehicles       enable row level security;
alter table public.ai_logs        enable row level security;
