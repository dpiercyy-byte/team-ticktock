ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS auto_clocked_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.time_entries.auto_clocked_out IS
  'True when the nightly process closed the entry; cleared only after an admin reviews and saves the time.';