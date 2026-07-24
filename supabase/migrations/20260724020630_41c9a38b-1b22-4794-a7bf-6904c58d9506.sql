
-- Reusable updated_at trigger (safe if it already exists)
CREATE OR REPLACE FUNCTION public.os_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients deny all" ON public.clients FOR ALL USING (false) WITH CHECK (false);
CREATE TRIGGER clients_touch_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();

-- JOBS
CREATE TABLE public.os_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  project_type TEXT,
  trades TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'lead',
  budget_cents BIGINT NOT NULL DEFAULT 0,
  collected_cents BIGINT NOT NULL DEFAULT 0,
  expenses_cents BIGINT NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.os_jobs TO service_role;
ALTER TABLE public.os_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "os_jobs deny all" ON public.os_jobs FOR ALL USING (false) WITH CHECK (false);
CREATE TRIGGER os_jobs_touch_updated_at BEFORE UPDATE ON public.os_jobs
  FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();
CREATE INDEX os_jobs_status_idx ON public.os_jobs(status) WHERE archived_at IS NULL;
CREATE INDEX os_jobs_updated_idx ON public.os_jobs(updated_at DESC);

-- JOB EVENTS (append-only timeline)
CREATE TABLE public.job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.os_jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.job_events TO service_role;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_events deny all" ON public.job_events FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX job_events_job_idx ON public.job_events(job_id, occurred_at DESC);
