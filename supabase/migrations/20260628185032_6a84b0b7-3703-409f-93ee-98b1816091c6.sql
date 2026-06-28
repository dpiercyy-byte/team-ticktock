ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.job_sites
  DROP CONSTRAINT IF EXISTS job_sites_kind_check;
ALTER TABLE public.job_sites
  ADD CONSTRAINT job_sites_kind_check CHECK (kind IN ('client','supplier'));

CREATE INDEX IF NOT EXISTS job_sites_active_idx
  ON public.job_sites (kind) WHERE archived_at IS NULL;