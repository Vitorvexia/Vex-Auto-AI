-- Guardrail de Margem Etapa 2: registra veículo vendido e valor de fechamento
-- Permite calcular ROI futuro e auditoria de margem por venda

ALTER TABLE public.leads
  ADD COLUMN vehicle_id  uuid            NULL REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN valor_final numeric(12, 2)  NULL CHECK (valor_final IS NULL OR valor_final >= 0);

CREATE INDEX leads_vehicle_id_idx ON public.leads(vehicle_id)
  WHERE vehicle_id IS NOT NULL;
