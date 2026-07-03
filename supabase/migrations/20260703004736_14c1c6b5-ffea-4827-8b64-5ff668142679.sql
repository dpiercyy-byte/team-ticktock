ALTER TABLE public.app_settings 
  ADD COLUMN IF NOT EXISTS ledger_export_sheet_id text,
  ADD COLUMN IF NOT EXISTS ledger_export_last_sync_at timestamptz;