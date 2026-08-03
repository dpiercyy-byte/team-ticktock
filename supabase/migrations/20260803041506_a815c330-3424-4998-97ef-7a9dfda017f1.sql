ALTER TABLE public.ledger_jobs
  ADD COLUMN IF NOT EXISTS sales_stage_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS next_action_owner text;

UPDATE public.ledger_jobs SET sales_stage_changed_at = updated_at WHERE sales_stage_changed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_unique_name_email_active
  ON public.clients (lower(btrim(name)), coalesce(lower(btrim(email)), ''))
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS ledger_jobs_sales_stage_idx ON public.ledger_jobs (sales_stage);
CREATE INDEX IF NOT EXISTS ledger_jobs_next_action_due_idx ON public.ledger_jobs (next_action_due_at);
CREATE INDEX IF NOT EXISTS ledger_jobs_client_id_idx ON public.ledger_jobs (client_id);