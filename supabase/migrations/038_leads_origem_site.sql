-- Migration 038: leads.origem aceita 'site' (roadmap 1.4)
--
-- Formulário de contato do site público da loja cria lead via
-- ingestLeadManually com origem="site" — precisa estar na allowlist do
-- CHECK constraint definido na migration 001 (leads_origem_check), senão
-- todo insert vindo do site falha em produção. Mesmo padrão de
-- DROP/ADD CONSTRAINT já usado em migration 019 (reactivation_logs) e
-- migration 026 (users_role_check).
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_origem_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_origem_check
  CHECK (origem in ('whatsapp','portal','base_inativa','manual','site'));
