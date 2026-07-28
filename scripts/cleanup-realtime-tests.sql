-- =============================================================================
-- Cleanup: sobras de teste do item 0.8 (Inbox em tempo real) em PRODUÇÃO
-- =============================================================================
--
-- O quê: 9 stores + 8 usuários (auth+public) criados por execuções de
-- tests/integration/realtime-isolation.test.ts contra o Supabase real,
-- que ficaram presos porque users.store_id é ON DELETE RESTRICT — o
-- afterAll do teste (antes de corrigido) deletava a store direto e
-- silenciava o erro, deixando store + usuário + leads/conversations/
-- messages cascateados presos em produção.
--
-- Por que IDs literais em vez de prefixo: o teste hoje usa
-- TEST_PREFIX = "__test__realtime-isolation" (permite `nome LIKE
-- '__test__realtime-isolation-%'`), mas essas 9 sobras são de execuções
-- ANTERIORES à existência desse prefixo — nome real é `Test RT-A/RT-B
-- <timestamp>` ou `Test webhook <timestamp>`. Um cleanup por prefixo
-- __test__ não as alcançaria. IDs confirmados por query read-only antes
-- do delete (ver revisão em sessão do Claude Code, 2026-07-28) e
-- checagem inversa de que nenhum pertence à store real da Speed Motos
-- (32359022-a2dc-4782-8eaa-b307e9970add) nem ao usuário dela.
--
-- Também remove 2 `leads` órfãos de produção (não são fixture de teste
-- automatizado — são artefato do setup do B001, criados via webhook real
-- em 2026-07-27: "#1 Atendimento" recebeu evento do número antigo/pessoal
-- da loja (+55 32 3541-3127) e "WhatsApp Business" de um número dos EUA,
-- típico de ping de verificação da Meta durante ativação do WABA).
--
-- Rodado em: 2026-07-28, via Supabase Studio SQL Editor
--   (projeto nrwnlhnmsmlyaueylsci), aprovado por Vitor após revisão de
--   duas queries de confirmação (lista lado a lado + checagem inversa
--   contra dado real).
-- Resultado confirmado: `select count(*) from stores` caiu de 12 para 3
--   (restam Speed Motos, Vex Motors - Loja Demo, Diag2 Store — todos
--   legítimos). auth.users/public.users das 9 stores: 0 remanescentes.
--   Os 2 leads: 0 remanescentes. Verificação independente via query
--   read-only depois do delete confirmou o mesmo resultado.
--
-- Este script é histórico/paliativo, não idempotente pra rodar de novo
-- (os IDs abaixo já não existem). Guardado versionado pra não repetir
-- "SQL fantasma em produção" — decisão sem artefato revisável no repo.
-- Causa raiz (ausência de Supabase de staging pra tests/integration/,
-- que roda contra produção real) segue como dívida em aberto — ver
-- 30_KNOWN_ISSUES.md.
-- =============================================================================

-- 1) auth.users primeiro — cascade automático pra public.users
--    (public.users.id references auth.users(id) ON DELETE CASCADE)
delete from auth.users where id in (
  '4c858705-150e-42d0-8684-93ef0983d0fa', -- Vendedor A / store d9b1fd57...
  '4bb86ff2-369c-41f1-ab48-29b756f9a9de', -- Vendedor A / store b70c8feb...
  '71a837df-9acc-433c-8d71-da0eaacf188a', -- Vendedor A / store c86220de...
  '7f40ad09-a1ea-4da8-91e7-0fc20a8c71dd', -- Vendedor B / store af79bac3...
  '6da67c41-3764-47b4-857c-8ff2e3c52087', -- Vendedor A / store da7ff6b2...
  'a0aa83e2-8771-4536-ae98-00eca29e64c4', -- Vendedor B / store 76ae915d...
  'dc9febb4-dd14-4de2-828d-6cbd89639611', -- Vendedor A / store 359d6e6a...
  'eabab58c-6a2b-40bc-a097-8283aa61c248'  -- Vendedor B / store 3de140e4...
);

-- 2) stores depois — cascade limpa leads/conversations/messages/
--    vehicles/ai_logs vinculados (ON DELETE CASCADE em todos)
delete from public.stores where id in (
  'd9b1fd57-8aa8-4059-8c9f-cf75c7e35472', -- Test RT-A 1785189277636
  'b70c8feb-cdef-4e5e-a6c0-b5aab45f2f96', -- Test RT-A 1785189369945
  'c86220de-ca48-4b3e-8843-e06a4bc16180', -- Test RT-A 1785191635485
  'af79bac3-4718-46de-9f1a-27e65a32eb96', -- Test RT-B 1785191636825
  'da7ff6b2-7a84-4c07-b292-534c95d89c0c', -- Test RT-A 1785191933478
  '1ab72ca7-28c4-4ae2-a889-3b49b918994a', -- Test webhook 1776966322200
  '76ae915d-cbb7-4b0c-8593-7f2a755ee985', -- Test RT-B 1785191934127
  '359d6e6a-5c79-4bdc-bcb1-9351c7574b7f', -- Test RT-A 1785192013955
  '3de140e4-16f4-4f5a-a66d-5f6a452f146b'  -- Test RT-B 1785192014210
);

-- 3) leads órfãos do setup B001 (produção real, store Speed Motos,
--    não fixture de teste)
delete from public.leads where id in (
  'f6efdad9-56bb-49be-924d-7f23f6e60b90', -- "#1 Atendimento"
  '12f15052-b2fe-473c-9cce-9b7e6e7755db'  -- "WhatsApp Business"
);
