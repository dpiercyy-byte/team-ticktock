
CREATE TABLE public.ledger_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  client_name text,
  start_date date,
  finish_date date,
  total_price numeric NOT NULL DEFAULT 0,
  gross_cash numeric NOT NULL DEFAULT 0,
  gross_with_hst numeric NOT NULL DEFAULT 0,
  finish_materials numeric NOT NULL DEFAULT 0,
  building_materials numeric NOT NULL DEFAULT 0,
  subs numeric NOT NULL DEFAULT 0,
  labor numeric NOT NULL DEFAULT 0,
  net numeric NOT NULL DEFAULT 0,
  profit_margin numeric NOT NULL DEFAULT 0,
  lead_source text NOT NULL DEFAULT 'unknown',
  payments_received numeric NOT NULL DEFAULT 0,
  payments_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  expense_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ledger_jobs TO service_role;

ALTER TABLE public.ledger_jobs ENABLE ROW LEVEL SECURITY;

-- Deny-all: no policies. All access goes through supabaseAdmin in server functions
-- gated by the project's custom HMAC auth (same posture as time_entries, workers, etc.)

CREATE INDEX ledger_jobs_address_lower_idx ON public.ledger_jobs (lower(address));
CREATE INDEX ledger_jobs_linked_job_site_id_idx ON public.ledger_jobs (linked_job_site_id);
CREATE INDEX ledger_jobs_finish_date_idx ON public.ledger_jobs (finish_date);

CREATE OR REPLACE FUNCTION public.ledger_jobs_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ledger_jobs_set_updated_at
  BEFORE UPDATE ON public.ledger_jobs
  FOR EACH ROW EXECUTE FUNCTION public.ledger_jobs_touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_jobs;
