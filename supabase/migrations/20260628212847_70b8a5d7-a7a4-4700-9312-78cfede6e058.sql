ALTER TABLE public.time_entries
  ADD COLUMN clock_out_geo_status text,
  ADD COLUMN clock_out_job_site_id uuid REFERENCES public.job_sites(id);
CREATE INDEX IF NOT EXISTS time_entries_clock_out_job_site_id_idx
  ON public.time_entries(clock_out_job_site_id);