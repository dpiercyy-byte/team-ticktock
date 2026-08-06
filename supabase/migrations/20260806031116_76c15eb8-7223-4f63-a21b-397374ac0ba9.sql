CREATE TABLE public.sheet_job_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id text NOT NULL UNIQUE,
  file_name text NOT NULL,
  address text,
  start_label text,
  ongoing boolean NOT NULL DEFAULT true,
  project_id uuid REFERENCES public.ledger_jobs(id) ON DELETE SET NULL,
  match_mode text NOT NULL DEFAULT 'auto',
  status text NOT NULL DEFAULT 'pending',
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_error text,
  sheet_totals jsonb,
  last_synced_at timestamptz,
  drive_modified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sheet_job_sources TO service_role;
ALTER TABLE public.sheet_job_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sheet_job_sources deny all" ON public.sheet_job_sources FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX sheet_job_sources_project_idx ON public.sheet_job_sources(project_id);
CREATE TRIGGER sheet_job_sources_touch_updated_at BEFORE UPDATE ON public.sheet_job_sources FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();

ALTER TABLE public.project_payments
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_key text;

ALTER TABLE public.project_costs
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_key text;

ALTER TABLE public.project_change_orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_key text;

CREATE INDEX IF NOT EXISTS project_payments_source_idx ON public.project_payments(project_id, source);
CREATE INDEX IF NOT EXISTS project_costs_source_idx ON public.project_costs(project_id, source);
CREATE INDEX IF NOT EXISTS project_change_orders_source_idx ON public.project_change_orders(project_id, source);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS sheet_jobs_sync_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sheet_jobs_last_sync_at timestamptz;