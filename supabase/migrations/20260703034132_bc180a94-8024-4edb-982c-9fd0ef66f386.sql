
ALTER TABLE public.ledger_jobs
  ADD COLUMN IF NOT EXISTS sheet_id text,
  ADD COLUMN IF NOT EXISTS sheet_last_sync_at timestamptz;
