-- =============================================================================
-- Vex Auto  Migration 029 — lock de conversa pro pipeline de IA
--
-- Aditiva: zero breaking change, sem alter de colunas existentes.
-- Corrige bug de produção (Speed Motos, 2026-07-30): duas mensagens do mesmo
-- lead chegando em requests separados do webhook (concorrência entre
-- processos serverless) disparavam 2 runAiPipeline concorrentes pra mesma
-- conversation_id — cada um sem saber do outro, gerando respostas
-- sobrepostas/contraditórias (amplificado pelo BL-0008, multi-bolha).
--
-- Claim atômico no banco (mesmo padrão canônico já usado em
-- webhook_ingest_message/003 e no retry job) — funciona entre processos
-- serverless diferentes, ao contrário de lock in-process
-- (pendingLeadTransitions, lib/status.ts, que só protege dentro do mesmo
-- processo Node).
-- =============================================================================

alter table public.conversations
  add column if not exists pipeline_locked_at timestamptz;

comment on column public.conversations.pipeline_locked_at is
  'Lock atômico anti-concorrência do pipeline de IA para esta conversa. Setado (now()) ao iniciar processamento em claim_conversation_pipeline_lock, null ao liberar (releaseConversationPipelineLock). TTL de recuperação de lock órfão é aplicado no claim, não é constraint da coluna.';

create or replace function public.claim_conversation_pipeline_lock(
  p_conversation_id uuid,
  p_ttl_seconds integer
) returns boolean
language plpgsql
as $$
declare
  v_claimed boolean := false;
begin
  update public.conversations
  set pipeline_locked_at = now()
  where id = p_conversation_id
    and (
      pipeline_locked_at is null
      or pipeline_locked_at < now() - (p_ttl_seconds || ' seconds')::interval
    )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

comment on function public.claim_conversation_pipeline_lock is
  'Claim atômico do lock de processamento de pipeline por conversation_id. Retorna true se claimed (lock livre ou expirado há mais de p_ttl_seconds), false se outro processo já detém o lock ainda válido. Usado pelo webhook (lib/pipeline-dispatch.ts) pra garantir no máximo 1 runAiPipeline em execução por conversa, entre processos serverless diferentes.';
