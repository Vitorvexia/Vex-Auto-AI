-- Migration 029: tabela de auditoria (roadmap 0.5) — quem fez o quê, quando,
-- em ações sensíveis do sistema. Não é observability de erro (isso é Sentry,
-- 0.4) — é trilha de ações humanas.
create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  user_id       uuid,
  actor_role    text,
  action        text not null,
  resource_type text not null,
  resource_id   uuid not null,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index audit_logs_store_created_idx on public.audit_logs (store_id, created_at desc);

alter table public.audit_logs enable row level security;
-- Sem policies = acesso apenas via service_role (mesmo princípio de
-- 001_initial.sql, aplicado reativamente em leads na migration 027 —
-- aqui aplicado desde o desenho, não descoberto depois numa review).
-- Quando existir UI de consulta, adicionar policy de SELECT escopada a
-- super_admin/dono_loja da própria loja naquele momento — não antes.
