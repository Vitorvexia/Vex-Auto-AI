-- =============================================================================
-- Vex Auto  Migration 028 — ai_logs multi-mensagem (BL-0008 / DL-0008)
--
-- Aditiva: zero breaking change, sem alter de colunas existentes.
-- Suporte a pipeline de envio multi-bolha (várias mensagens WhatsApp por
-- turno de IA, enviadas sequencialmente). ai_logs.message_id (migration 013)
-- segue existindo e guarda o ID da PRIMEIRA bolha do turno — retrocompatível
-- com qualquer leitura antiga que espera uma FK única.
-- =============================================================================

alter table public.ai_logs
  -- Lista ordenada de todas as mensagens (bolhas) inseridas neste turno.
  -- Sem FK de array nativa no Postgres — integridade garantida pela aplicação
  -- (lib/ai-pipeline.ts insere cada linha em messages antes de referenciá-la aqui).
  add column if not exists message_ids uuid[],
  -- Subconjunto de message_ids que falhou o envio e ainda não foi confirmado
  -- entregue. null/vazio quando todas as bolhas do turno foram enviadas com
  -- sucesso. Usado pelo retry job (lib/retry-failed.ts) pra reenviar só o que
  -- falhou, sem duplicar bolhas que já chegaram.
  add column if not exists failed_message_ids uuid[];

comment on column public.ai_logs.message_ids is
  'Lista ordenada de todas as mensagens (bolhas) inseridas neste turno de IA. Substitui message_id (singular) para pipeline multi-mensagem — message_id continua populado com o primeiro item por retrocompatibilidade.';
comment on column public.ai_logs.failed_message_ids is
  'Subconjunto de message_ids que falhou o envio nesta passada. Retry job reenvia só estes IDs e remove da lista os que tiverem sucesso. Null/vazio = nenhuma bolha pendente de reenvio.';
