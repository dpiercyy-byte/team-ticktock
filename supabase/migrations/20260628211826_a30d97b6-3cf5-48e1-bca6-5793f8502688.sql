ALTER TABLE public.time_entries
ADD COLUMN planned_job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS time_entries_planned_job_site_id_idx ON public.time_entries(planned_job_site_id);