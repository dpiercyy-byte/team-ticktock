CREATE TABLE public.schedule_subs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trade text,
  phone text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.schedule_subs TO service_role;
ALTER TABLE public.schedule_subs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.schedule_sub_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_id uuid NOT NULL REFERENCES public.schedule_subs(id) ON DELETE CASCADE,
  job_site_id uuid NOT NULL REFERENCES public.job_sites(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  arrival_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_id, work_date)
);
GRANT ALL ON public.schedule_sub_assignments TO service_role;
ALTER TABLE public.schedule_sub_assignments ENABLE ROW LEVEL SECURITY;