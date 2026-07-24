-- Agendamento estruturado pra troca de moto — página /agenda filtra por dia.
-- Financiamento e troca (nome, CPF, km, modelo etc) ficam em leads.contexto (jsonb),
-- só agendamento vira coluna própria por precisar de índice/filtro por data.
ALTER TABLE public.leads
  ADD COLUMN agendamento_data    date NULL,
  ADD COLUMN agendamento_horario text NULL;

CREATE INDEX leads_store_agendamento_idx ON public.leads(store_id, agendamento_data)
  WHERE agendamento_data IS NOT NULL;
