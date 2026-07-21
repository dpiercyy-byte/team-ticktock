
ALTER TABLE public.ledger_jobs
  ADD COLUMN IF NOT EXISTS labor_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS labor_synced_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'job_sites'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.job_sites';
  END IF;
END$$;
