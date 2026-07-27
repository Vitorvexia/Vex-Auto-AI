-- Inbox em tempo real (roadmap 0.8): sem a tabela na publication supabase_realtime,
-- nenhum INSERT em messages é propagado via postgres_changes, independente de RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
