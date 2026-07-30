-- Migration 026: renomeia users.role 'admin' -> 'dono_loja'
--
-- 'admin' aqui sempre significou "dono/gerente da loja" (escopado por
-- store_id) — não tem relação com super_admin (Vitor, cross-store via
-- ADMIN_EMAILS/isSuperAdmin(), nunca uma linha em public.users). O rename
-- evita ambiguidade entre os dois conceitos agora que RBAC (0.3) formaliza
-- os 3 níveis de perfil.
--
-- JÁ EXECUTADA MANUALMENTE EM PRODUÇÃO em 2026-07-29 (SQL Editor do
-- Supabase Studio) — confirmado via query read-only pós-execução (3
-- usuários role='admin' -> role='dono_loja', 2 role='vendedor' intocados).
-- Este arquivo registra o schema real no repo; não reaplicar via
-- `supabase db push` no projeto de produção (idempotente-seguro se
-- aplicado do zero em qualquer OUTRO ambiente, ex: novo projeto Supabase
-- criado a partir do zero a partir destas migrations).
--
-- Constraint descoberta em runtime via pg_constraint em vez de assumir
-- nome fixo (users_role_check é o nome padrão do Postgres pra check
-- inline sem nome, mas `supabase db dump` pra confirmar exigia Docker,
-- indisponível no ambiente de dev no momento da escrita).
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.users'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

UPDATE public.users SET role = 'dono_loja' WHERE role = 'admin';

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('dono_loja', 'vendedor'));
