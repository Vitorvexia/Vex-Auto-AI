-- =============================================================================
-- Vex Auto  Migration 042 — distribuição automática de leads (roadmap 1.10)
-- =============================================================================
-- Efeito prático zero hoje: nenhuma loja em produção tem 2+ vendedores
-- ativos simultâneos (levantamento 2026-08-05). Construído antecipadamente
-- por decisão explícita — mecanismo pronto pra quando uma loja crescer,
-- sem exigir migration nova naquele momento.
--
-- Regra: menor carga aberta (leads.lead_status NOT IN FECHADO/PERDIDO)
-- entre os vendedores da loja. Empate → vendedor mais antigo (users.created_at)
-- vence. Lógica pura equivalente em lib/lead-distribution.ts
-- (pickLeastLoadedVendedor), usada só pela camada de UI/testes — a fonte de
-- verdade em runtime é esta função SQL, chamada via RPC nos dois pontos de
-- ingestão de lead (webhook e ingestLeadManually).
--
-- Sem conceito de vendedor "ativo/inativo" — todo role='vendedor' da loja é
-- candidato, mesmo afastado/de férias. Gap documentado em 28_BACKLOG.md
-- (BL-0028), não bloqueante.
--
-- Race safety: pg_advisory_xact_lock(hashtext(store_id)) serializa cálculo+
-- write por loja dentro da MESMA transação (advisory lock transaction-scoped,
-- liberado automaticamente no commit/rollback) — lojas diferentes nunca se
-- bloqueiam. Sem isso, dois leads novos quase simultâneos na mesma loja
-- poderiam ler a mesma "menor carga" antes de qualquer um persistir.
-- =============================================================================

-- up

create or replace function public.assign_lead_to_least_loaded_vendedor(
  p_lead_id  uuid,
  p_store_id uuid
) returns uuid
language plpgsql
as $$
declare
  v_chosen_user_id uuid;
begin
  -- Serializa por loja; nunca bloqueia lojas diferentes.
  perform pg_advisory_xact_lock(hashtext(p_store_id::text));

  select u.id
    into v_chosen_user_id
    from public.users u
    left join (
      select assigned_to, count(*) as open_count
        from public.leads
       where store_id = p_store_id
         and assigned_to is not null
         and lead_status not in ('FECHADO', 'PERDIDO')
       group by assigned_to
    ) load on load.assigned_to = u.id
   where u.store_id = p_store_id
     and u.role = 'vendedor'
   order by coalesce(load.open_count, 0) asc, u.created_at asc
   limit 1;

  -- Sem candidato (loja sem vendedor cadastrado): no-op, assigned_to
  -- permanece NULL — comportamento atual preservado.
  if v_chosen_user_id is null then
    return null;
  end if;

  update public.leads
     set assigned_to = v_chosen_user_id
   where id = p_lead_id
     and store_id = p_store_id;

  return v_chosen_user_id;
end;
$$;

comment on function public.assign_lead_to_least_loaded_vendedor is
  'Roadmap 1.10 — atribui lead ao vendedor de menor carga aberta na loja (empate: mais antigo). Serializado por store_id via advisory lock transacional. No-op se a loja não tem vendedor cadastrado. Retorna o user_id escolhido ou NULL.';

-- ---------------------------------------------------------------------------
-- webhook_ingest_message (migration 003) — dispara a distribuição só quando
-- o INSERT de lead efetivamente criou linha nova (v_is_new_lead). Lead
-- existente (caiu em ON CONFLICT DO NOTHING) nunca tem assigned_to
-- sobrescrito por este fluxo.
-- ---------------------------------------------------------------------------
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
    perform public.assign_lead_to_least_loaded_vendedor(v_lead_id, p_store_id);
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

-- =============================================================================
-- down
-- =============================================================================
-- Reverte webhook_ingest_message pra versão da migration 003 (sem chamada de
-- distribuição) e remove assign_lead_to_least_loaded_vendedor. Não incluído
-- inline por convenção do projeto (ver 018/030) — restaurar a partir do
-- corpo da função em 003_hardening.sql se necessário.
-- drop function if exists public.assign_lead_to_least_loaded_vendedor(uuid, uuid);
