ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS offsite_reason_code text,
  ADD COLUMN IF NOT EXISTS offsite_reason_note text;