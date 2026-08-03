-- Migration 037: public_vehicle_listings passa a filtrar publicado=true (roadmap 1.4)
--
-- vehicles.publicado (migration 036) controla exposição no site, separado de
-- disponivel (controle interno). A view pública precisa dos dois filtros: um
-- veículo pode estar disponivel=true (à venda, aparece no Kanban/IA) e ainda
-- assim publicado=false (dono escondeu do site por algum motivo).
--
-- CREATE OR REPLACE VIEW preserva GRANT/COMMENT já aplicados na migration 034
-- (Postgres não revoga privilégios ao substituir a definição de uma view
-- existente) — GRANT/COMMENT abaixo são reafirmados apenas por explicitação,
-- mesmo estilo defensivo das migrations anteriores, não porque seriam
-- perdidos.
--
-- Allowlist de colunas inalterada — mesma decisão da migration 034, nunca
-- custo/margem_minima. `publicado` não entra no SELECT: é filtro de linha,
-- não dado que o visitante do site precisa ver.
CREATE OR REPLACE VIEW public.public_vehicle_listings
WITH (security_barrier = true)
AS
SELECT
  id,
  store_id,
  marca,
  modelo,
  ano,
  preco,
  photo_url,
  disponivel
FROM public.vehicles
WHERE disponivel = true AND publicado = true;

COMMENT ON VIEW public.public_vehicle_listings IS
  'Leitura pública (site da loja, sem sessão). Allowlist explícita de colunas — nunca adicionar custo/margem_minima. Filtro disponivel=true AND publicado=true embutido na view, não em código.';

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.public_vehicle_listings TO anon;
