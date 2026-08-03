-- Migration 036: vehicles.publicado (roadmap 1.4)
--
-- Controla exposição do veículo no site público da loja — separado de
-- `disponivel` (controle interno de estoque, usado pelo Kanban/IA/arquivo).
-- Default TRUE: estoque atual aparece automaticamente no site assim que 1.4
-- for ao ar; o dono da loja desmarca item a item o que quiser esconder,
-- em vez de precisar publicar cada veículo manualmente (decisão registrada
-- em docs/vex/53_ROADMAP.md, nota da linha 63).
ALTER TABLE public.vehicles
  ADD COLUMN publicado boolean NOT NULL DEFAULT true;
