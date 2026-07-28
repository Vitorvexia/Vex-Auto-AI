-- reactivation_logs não tinha error_message (follow_up_logs já tinha desde a
-- migration 009 e nunca foi escrito) — falha de envio (texto ou template) era
-- silenciosa: status='failed' sem dizer por quê. Espelha follow_up_logs.
ALTER TABLE public.reactivation_logs
  ADD COLUMN IF NOT EXISTS error_message text;
