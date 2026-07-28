-- Item 0.9 — UI de resposta manual do vendedor. autor="humano" já era
-- suportado pelo CHECK constraint (003_hardening.sql) mas nunca identificava
-- QUAL vendedor respondeu. sent_by referencia users.id — nullable (mensagens
-- ia/lead/sistema nunca preenchem) e ON DELETE SET NULL (remover o vendedor
-- não pode apagar o histórico de mensagens que ele mandou).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_sent_by_idx
  ON public.messages(sent_by)
  WHERE sent_by IS NOT NULL;
