ALTER TABLE public.lead_records ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.lead_records DROP CONSTRAINT IF EXISTS lead_records_stage_check;
UPDATE public.lead_records SET stage = 'Contacted' WHERE stage = 'Qualified';
UPDATE public.lead_records SET stage = 'New', archived_at = COALESCE(archived_at, now()) WHERE stage = 'Lost';
ALTER TABLE public.lead_records ADD CONSTRAINT lead_records_stage_check CHECK (stage IN ('New','Contacted','Quoted','Won'));
CREATE INDEX IF NOT EXISTS lead_records_archived_idx ON public.lead_records(archived_at);