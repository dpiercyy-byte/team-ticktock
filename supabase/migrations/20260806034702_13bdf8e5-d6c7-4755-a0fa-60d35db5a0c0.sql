CREATE TABLE public.time_entry_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  geo_status text,
  source text NOT NULL DEFAULT 'clock_in',
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX time_entry_segments_entry_idx ON public.time_entry_segments (entry_id);
CREATE INDEX time_entry_segments_site_idx ON public.time_entry_segments (job_site_id);

GRANT ALL ON public.time_entry_segments TO service_role;

ALTER TABLE public.time_entry_segments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER time_entry_segments_touch_updated_at
BEFORE UPDATE ON public.time_entry_segments
FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();