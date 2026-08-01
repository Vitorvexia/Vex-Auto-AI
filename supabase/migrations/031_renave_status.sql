-- Migration 031: controle MANUAL de status de RENAVE por veículo (roadmap 1.1)
--
-- Não é integração com o RENAVE — é rastreio interno. Colunas direto em
-- `vehicles` (não tabela nova): relação 1:1 por veículo, sem histórico de
-- transições (o histórico de quem fez o quê já vive em audit_logs, migration
-- 029) — mesmo padrão de leads.vehicle_id/valor_final (migration 020) e
-- leads.agendamento_data/agendamento_horario (migration 022), que também são
-- "estado atual" indexado direto na entidade dona, não tabela satélite.

ALTER TABLE public.vehicles
  ADD COLUMN renave_stage text NOT NULL DEFAULT 'entrada_registrada'
    CHECK (renave_stage IN (
      'entrada_registrada',
      'chave_nfe_vinculada',
      'documentos_protocolados',
      'saida_registrada'
    )),
  ADD COLUMN renave_nfe_key text NULL,
  ADD COLUMN renave_stage_updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN renave_stage_updated_at timestamptz NOT NULL DEFAULT now();

-- Painel de pendências: veículos com stage != saída, ordenados por tempo
-- parado no estágio atual (mais antigo primeiro). Índice parcial — mesmo
-- padrão do leads_store_agendamento_idx (migration 022): só indexa o que a
-- página de fato filtra/ordena.
CREATE INDEX vehicles_store_renave_pending_idx
  ON public.vehicles (store_id, renave_stage_updated_at)
  WHERE renave_stage <> 'saida_registrada';
