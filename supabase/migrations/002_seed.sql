-- =============================================================================
-- Vex Auto  Migration 002 (seed de ambiente de teste)
-- =============================================================================
-- Popula o minimo necessario para testar o fluxo lead -> conversa -> mensagem:
--   1 store de teste
--   1 vendedor (auth.users + public.users)
--   5 veiculos realistas (mercado BR de seminovos)
--
-- Idempotente via ON CONFLICT DO NOTHING + UUIDs fixos.
-- Pode ser re-executada sem criar duplicatas.
--
-- UUIDs fixos (faceis de referenciar em dev):
--   store .... aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
--   vendedor . bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
--   veiculos . cccccccc-cccc-cccc-cccc-cccccccc000N
-- =============================================================================

-- =============================================================================
-- 1) Store de teste
-- =============================================================================
insert into public.stores (id, nome, whatsapp_numero)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Vex Motors  Loja Demo',
  '+5511999990000'
)
on conflict (id) do nothing;

-- =============================================================================
-- 2) Vendedor (auth.users + public.users)
-- =============================================================================
-- Credencial de teste:
--   email:  vendedor@vex.demo
--   senha:  vex123456
--
-- Aviso: insercao direta em auth.users funciona em ambiente de dev/Supabase
-- SQL Editor (role postgres). Em producao, prefira criar via Supabase Auth
-- (signup/admin API) e depois inserir apenas a linha em public.users.
-- Se algum campo NOT NULL mudou em versao nova do Supabase, ajuste o INSERT.
-- =============================================================================
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated',
  'authenticated',
  'vendedor@vex.demo',
  crypt('vex123456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

insert into public.users (id, store_id, nome, role)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Carlos Vendedor',
  'vendedor'
)
on conflict (id) do nothing;

-- =============================================================================
-- 3) Catalogo de veiculos (5 carros populares, mercado BR de seminovos)
-- =============================================================================
-- Precos, custos e margens coerentes com dealers brasileiros:
--   margem_minima = piso aceitavel pela loja (IA nao pode fechar abaixo)
--   margem potencial = preco - custo (acima da margem minima)
-- =============================================================================
insert into public.vehicles
  (id, store_id, marca, modelo, ano, preco, custo, margem_minima, disponivel)
values
  -- Hatch compacto de entrada
  ('cccccccc-cccc-cccc-cccc-cccccccc0001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Hyundai',   'HB20 1.0 Comfort Plus',         2022,  74900.00,  65000.00, 3000.00, true),

  -- Hatch compacto lider de vendas
  ('cccccccc-cccc-cccc-cccc-cccccccc0002',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Chevrolet', 'Onix 1.0 LT',                   2023,  79900.00,  70000.00, 3500.00, true),

  -- SUV compacto acessivel
  ('cccccccc-cccc-cccc-cccc-cccccccc0003',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Jeep',      'Renegade Sport 1.8',            2022,  99900.00,  88000.00, 4000.00, true),

  -- Sedan medio premium (alto giro em usados)
  ('cccccccc-cccc-cccc-cccc-cccccccc0004',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Toyota',    'Corolla XEi 2.0 Flex',          2021, 139900.00, 124000.00, 5000.00, true),

  -- SUV medio premium
  ('cccccccc-cccc-cccc-cccc-cccccccc0005',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Jeep',      'Compass Longitude 1.3 T270',    2023, 189900.00, 170000.00, 7000.00, true)
on conflict (id) do nothing;
