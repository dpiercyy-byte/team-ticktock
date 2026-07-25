
CREATE TABLE public.ledger_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  address text NOT NULL,
  project_type text NOT NULL,
  trades text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'Lead',
  progress integer NOT NULL DEFAULT 0,
  budget_cents bigint NOT NULL DEFAULT 0,
  collected_cents bigint NOT NULL DEFAULT 0,
  expenses_cents bigint NOT NULL DEFAULT 0,
  workers_on_site integer NOT NULL DEFAULT 0,
  scheduled_for timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ledger_jobs TO service_role;
ALTER TABLE public.ledger_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_jobs deny all" ON public.ledger_jobs FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE public.ledger_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.ledger_jobs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  detail text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ledger_job_events TO service_role;
ALTER TABLE public.ledger_job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_job_events deny all" ON public.ledger_job_events FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX ledger_job_events_job_id_idx ON public.ledger_job_events(job_id, occurred_at DESC);
CREATE INDEX ledger_jobs_status_idx ON public.ledger_jobs(status) WHERE archived_at IS NULL;

CREATE TRIGGER ledger_jobs_touch_updated_at
  BEFORE UPDATE ON public.ledger_jobs
  FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();
