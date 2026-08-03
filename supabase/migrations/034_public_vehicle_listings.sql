-- Migration 034: view public_vehicle_listings + acesso anon (roadmap 1.3)
--
-- Allowlist EXPLÍCITA de colunas seguras para o site público da loja (sem
-- sessão — visitante não está logado). custo e margem_minima NUNCA aparecem
-- aqui — não são filtradas em código, estão simplesmente ausentes da view
-- desde a origem. Qualquer coluna nova em vehicles no futuro fica de fora por
-- padrão (allowlist, não denylist) — precisa ser adicionada aqui de propósito.
--
-- DESVIO CONSCIENTE da redação original da decisão ("RLS policy para anon
-- SELECT na view, restrita a disponivel = true"): PostgreSQL não permite
-- CREATE POLICY / ROW LEVEL SECURITY em views — RLS só existe em tabelas
-- (regulares ou foreign, migration 001/005 usam esse mecanismo em `vehicles`
-- mesmo). O equivalente funcional usado aqui:
--   1. O filtro `disponivel = true` é embutido na própria definição da view
--      (não depende de policy nem de checagem em código de aplicação).
--   2. A view roda com o privilégio do owner (postgres/superuser da
--      migration), NÃO com o do caller — por isso ela consegue ler
--      `vehicles` mesmo sem nenhuma policy de RLS liberando `anon` na tabela
--      base. security_invoker fica OFF de propósito (default do Postgres):
--      se fosse ON, a policy de RLS de `vehicles` (migration 005, só libera
--      `store_id = my_store_id()` para usuário autenticado) bloquearia a
--      view inteira para `anon`, e a única forma de destravar seria criar
--      uma policy de RLS para `anon` diretamente em `vehicles` — o que
--      exporia `custo`/`margem_minima` a qualquer SELECT direto na tabela
--      com a anon key, contrariando a decisão nº 5 (SELECT direto em
--      `vehicles` via anon deve continuar bloqueado).
--   3. `grant select` restringe QUEM pode consultar a view (só `anon` e
--      `authenticated`) — é o controle de acesso; o filtro de linha
--      (disponivel = true) é estrutural na view, não uma policy separada.
-- Resultado prático é idêntico ao pedido (anon só lê disponível=true, nunca
-- vê custo/margem, nunca lê `vehicles` direto) — o mecanismo é view+grant em
-- vez de CREATE POLICY, porque o segundo não existe para views no Postgres.

-- security_invoker fica no default (false/owner-privilege) — não declarado
-- explicitamente para não depender de PG15+ caso o projeto rode em versão
-- anterior; o comportamento é o mesmo (ver explicação acima).
CREATE VIEW public.public_vehicle_listings
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
WHERE disponivel = true;

COMMENT ON VIEW public.public_vehicle_listings IS
  'Leitura pública (site da loja, sem sessão). Allowlist explícita de colunas — nunca adicionar custo/margem_minima. Filtro disponivel=true embutido na view, não em código.';

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.public_vehicle_listings TO anon;
