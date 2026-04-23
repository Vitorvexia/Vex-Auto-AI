-- =============================================================================
-- Vex Auto  Migration 005 — RLS policies por store_id
-- =============================================================================
-- Completa o que 001_initial.sql prometeu (002_rls.sql que nunca existiu).
-- Regra: usuário autenticado acessa apenas dados da sua própria store.
-- service_role (usado pelo backend) bypassa RLS por design — comportamento correto.
-- =============================================================================

-- Helper: retorna store_id do usuário autenticado
create or replace function public.my_store_id()
returns uuid
language sql
stable
security definer
as $$
  select store_id from public.users where id = auth.uid()
$$;

-- =============================================================================
-- stores: usuário vê apenas sua própria store
-- =============================================================================
create policy "stores_own"
  on public.stores
  for select
  using (id = public.my_store_id());

-- =============================================================================
-- users: usuário vê apenas colegas da mesma store
-- =============================================================================
create policy "users_own_store"
  on public.users
  for select
  using (store_id = public.my_store_id());

-- =============================================================================
-- leads: leitura e escrita apenas na própria store
-- =============================================================================
create policy "leads_own_store_select"
  on public.leads
  for select
  using (store_id = public.my_store_id());

create policy "leads_own_store_insert"
  on public.leads
  for insert
  with check (store_id = public.my_store_id());

create policy "leads_own_store_update"
  on public.leads
  for update
  using (store_id = public.my_store_id());

-- =============================================================================
-- conversations
-- =============================================================================
create policy "conversations_own_store_select"
  on public.conversations
  for select
  using (store_id = public.my_store_id());

create policy "conversations_own_store_insert"
  on public.conversations
  for insert
  with check (store_id = public.my_store_id());

create policy "conversations_own_store_update"
  on public.conversations
  for update
  using (store_id = public.my_store_id());

-- =============================================================================
-- messages: leitura apenas — escrita é exclusiva do backend (service_role)
-- =============================================================================
create policy "messages_own_store_select"
  on public.messages
  for select
  using (store_id = public.my_store_id());

-- =============================================================================
-- vehicles: leitura e escrita na própria store
-- =============================================================================
create policy "vehicles_own_store_select"
  on public.vehicles
  for select
  using (store_id = public.my_store_id());

create policy "vehicles_own_store_insert"
  on public.vehicles
  for insert
  with check (store_id = public.my_store_id());

create policy "vehicles_own_store_update"
  on public.vehicles
  for update
  using (store_id = public.my_store_id());

-- =============================================================================
-- ai_logs: somente leitura para auditoria (escrita via service_role)
-- =============================================================================
create policy "ai_logs_own_store_select"
  on public.ai_logs
  for select
  using (store_id = public.my_store_id());
