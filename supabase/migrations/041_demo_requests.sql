-- Migration 041: tabela demo_requests (roadmap 1.7) — captura de lead da
-- landing page de vendas do Vex Auto (site institucional, não confundir com
-- "leads" do CRM de lojas — este é lead comercial do próprio Vex Auto).
-- Tabela interna: sem UI de listagem neste escopo, consulta via Supabase
-- Studio por super-admin/founder. RLS habilitada sem policies (mesmo padrão
-- de audit_logs, migration 029) — acesso só via service_role, que ignora
-- RLS; a Server Action pública (lib/demo-request-actions.ts) usa
-- supabaseAdmin, então nenhuma policy precisa existir hoje.
create table public.demo_requests (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  empresa    text not null,
  telefone   text not null,
  email      text,
  mensagem   text,
  created_at timestamptz not null default now()
);

alter table public.demo_requests enable row level security;
