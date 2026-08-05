-- =============================================================================
-- Vex Auto  Migration 043 — handoff parcial por assunto (roadmap 1.11)
-- =============================================================================
-- Escopo contido: 1 único tópico possível hoje, "preco_negociacao" — não é
-- engine genérica de múltiplos tópicos. Formato array (não enum de coluna)
-- porque segue o precedente já usado em leads.contexto.pending_topics
-- (financiamento/troca), e deixa espaço pra um segundo tópico futuro sem
-- migration nova, mas isso não é o que este item entrega.
--
-- handoff_topics = '[]' e handoff_to = 'HUMANO' simultaneamente é o estado
-- "handoff legado" (conversas já em handoff antes deste deploy, ou handoff
-- disparado por algum caminho que não passa pela regra de preço) — o
-- guardrail (lib/guardrails.ts) trata esse caso como bloqueio total,
-- idêntico ao comportamento anterior a esta migration. Só quando
-- handoff_topics contém "preco_negociacao" o guardrail passa a liberar
-- mensagens de outro assunto.
-- =============================================================================

-- up

alter table public.conversations
  add column if not exists handoff_topics jsonb not null default '[]'::jsonb;

comment on column public.conversations.handoff_topics is
  'Roadmap 1.11 — tópicos suspensos aguardando humano dentro de um handoff ativo. Array de strings; hoje só "preco_negociacao" é um valor possível. Vazio + handoff_to=HUMANO = handoff legado/total (bloqueia tudo, comportamento pré-1.11).';

-- =============================================================================
-- down
-- =============================================================================
-- alter table public.conversations drop column if exists handoff_topics;
