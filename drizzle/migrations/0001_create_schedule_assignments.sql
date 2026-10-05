CREATE TABLE public.schedule_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  job_site_id uuid NOT NULL REFERENCES public.job_sites(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  arrival_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, work_date)
);
CREATE INDEX schedule_assignments_date_idx ON public.schedule_assignments (work_date);
GRANT ALL ON public.schedule_assignments TO service_role;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;