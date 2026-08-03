-- Phase 4: job activation + crew assignment

ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS activated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.project_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ledger_jobs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  role text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  is_active boolean GENERATED ALWAYS AS (removed_at IS NULL) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.project_crew TO service_role;

ALTER TABLE public.project_crew ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_crew deny all" ON public.project_crew;
CREATE POLICY "project_crew deny all" ON public.project_crew FOR ALL USING (false) WITH CHECK (false);

CREATE TRIGGER project_crew_touch_updated_at
  BEFORE UPDATE ON public.project_crew
  FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS project_crew_active_unique
  ON public.project_crew (project_id, worker_id) WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS project_crew_project_idx ON public.project_crew (project_id);

-- A project can have at most one active client job site.
CREATE UNIQUE INDEX IF NOT EXISTS job_sites_project_active_unique
  ON public.job_sites (project_id)
  WHERE project_id IS NOT NULL AND archived_at IS NULL;