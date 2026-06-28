
CREATE TABLE public.job_sites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  address text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.job_sites TO service_role;
ALTER TABLE public.job_sites ENABLE ROW LEVEL SECURITY;
-- deny-all: no policies. Access goes through supabaseAdmin in server functions only.

ALTER TABLE public.time_entries
  ADD COLUMN clock_in_lat double precision,
  ADD COLUMN clock_in_lng double precision,
  ADD COLUMN clock_out_lat double precision,
  ADD COLUMN clock_out_lng double precision,
  ADD COLUMN job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  ADD COLUMN geo_status text;
