-- =============================================================================
-- Vex Auto  Migration 003 (hardening estrutural)
-- =============================================================================
-- Correcoes de fundacao:
--   1) received_at em messages (timestamp da Meta; created_at = ingest)
--   2) CHECK constraints semanticos (direcao<->autor; encerrada<->status)
--   3) Trigger multi-tenant em conversations.assigned_to
--   4) Funcao RPC webhook_ingest_message (atomica + race-safe)
-- =============================================================================

-- =============================================================================
-- 1) received_at em messages
-- =============================================================================
alter table public.messages
  add column if not exists received_at timestamptz;

-- Backfill para linhas pre-existentes (se houver)
update public.messages
  set received_at = created_at
  where received_at is null;

alter table public.messages
  alter column received_at set not null,
  alter column received_at set default now();

-- Indice para ordenacao temporal correta na inbox
create index if not exists messages_conversation_received_idx
  on public.messages(conversation_id, received_at desc);

-- =============================================================================
-- 2) CHECK constraints semanticos
-- =============================================================================
-- entrada <=> lead (e saida <=> ia/humano/sistema)
alter table public.messages
  add constraint messages_direcao_autor_chk
  check ((direcao = 'entrada') = (autor = 'lead'));

-- ENCERRADA <=> encerrada_em preenchido
alter table public.conversations
  add constraint conversations_encerrada_consistency_chk
  check ((conversation_status = 'ENCERRADA') = (encerrada_em is not null));

-- =============================================================================
-- 3) Multi-tenant: assigned_to deve pertencer a mesma store da conversa
-- =============================================================================
create or replace function public.validate_assigned_to_same_store()
returns trigger
language plpgsql
as $$
declare
  v_user_store uuid;
begin
  if new.assigned_to is null then
    return new;
  end if;

  select store_id into v_user_store
  from public.users
  where id = new.assigned_to;

  if v_user_store is null then
    raise exception 'assigned_to user % nao encontrado', new.assigned_to
      using errcode = '23503';
  end if;

  if v_user_store <> new.store_id then
    raise exception
      'multi-tenant: user % (store %) nao pode ser assigned em conversa da store %',
      new.assigned_to, v_user_store, new.store_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists conversations_validate_assigned_to on public.conversations;
create trigger conversations_validate_assigned_to
before insert or update of assigned_to, store_id on public.conversations
for each row
execute function public.validate_assigned_to_same_store();

-- =============================================================================
-- 4) RPC: webhook_ingest_message  (atomica, race-safe, idempotente)
-- =============================================================================
-- Executa lead + conversation + message em uma unica transacao implicita
-- (funcao PL/pgSQL). Usa INSERT ... ON CONFLICT DO NOTHING + SELECT fallback,
-- padrao canonico de upsert concorrente em Postgres.
-- =============================================================================
create or replace function public.webhook_ingest_message(
  p_store_id            uuid,
  p_phone_normalized    text,
  p_contact_name        text,
  p_message_external_id text,
  p_mensagem            text,
  p_received_at         timestamptz
) returns jsonb
language plpgsql
as $$
declare
  v_lead_id              uuid;
  v_conversation_id      uuid;
  v_message_id           uuid;
  v_is_new_lead          boolean := false;
  v_is_new_conversation  boolean := false;
  v_duplicate            boolean := false;
  v_received             timestamptz := coalesce(p_received_at, now());
begin
  -- -------------------------------------------------------------------------
  -- LEAD  upsert race-safe contra unique (store_id, phone_normalized)
  -- -------------------------------------------------------------------------
  insert into public.leads (store_id, phone_normalized, nome, origem)
  values (p_store_id, p_phone_normalized, p_contact_name, 'whatsapp')
  on conflict (store_id, phone_normalized) do nothing
  returning id into v_lead_id;

  if v_lead_id is null then
    select id into v_lead_id
    from public.leads
    where store_id = p_store_id
      and phone_normalized = p_phone_normalized;
  else
    v_is_new_lead := true;
  end if;

  -- -------------------------------------------------------------------------
  -- CONVERSATION  upsert contra partial unique (lead_id where status aberto)
  -- -------------------------------------------------------------------------
  insert into public.conversations (store_id, lead_id, canal)
  values (p_store_id, v_lead_id, 'whatsapp')
  on conflict (lead_id)
    where conversation_status in ('ATIVA','AGUARDANDO_HUMANO','PAUSADA')
  do nothing
  returning id into v_conversation_id;

  if v_conversation_id is null then
    select id into v_conversation_id
    from public.conversations
    where lead_id = v_lead_id
      and conversation_status in ('ATIVA','AGUARDANDO_HUMANO','PAUSADA')
    order by iniciada_em desc
    limit 1;
  else
    v_is_new_conversation := true;
  end if;

  -- -------------------------------------------------------------------------
  -- MESSAGE  idempotencia via partial unique (message_external_id)
  -- -------------------------------------------------------------------------
  insert into public.messages (
    store_id, conversation_id, lead_id,
    message_external_id, direcao, autor, mensagem,
    received_at
  ) values (
    p_store_id, v_conversation_id, v_lead_id,
    p_message_external_id, 'entrada', 'lead', p_mensagem,
    v_received
  )
  on conflict (message_external_id)
    where message_external_id is not null
  do nothing
  returning id into v_message_id;

  v_duplicate := (v_message_id is null);

  -- Bump ultima_mensagem_em apenas se a mensagem foi realmente nova
  -- e o timestamp for mais recente que o atual.
  if not v_duplicate then
    update public.conversations
    set ultima_mensagem_em = v_received
    where id = v_conversation_id
      and v_received > ultima_mensagem_em;
  end if;

  return jsonb_build_object(
    'lead_id',             v_lead_id,
    'conversation_id',     v_conversation_id,
    'message_id',          v_message_id,
    'duplicate',           v_duplicate,
    'is_new_lead',         v_is_new_lead,
    'is_new_conversation', v_is_new_conversation
  );
end;
$$;
