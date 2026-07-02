ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS worker_export_sheet_id text DEFAULT '1Qxn6DRVYIIuXvoCXlHSa1fu-CThlBTyj6ipYVVEP4bY',
  ADD COLUMN IF NOT EXISTS worker_export_last_sync_at timestamp with time zone;

UPDATE public.app_settings
  SET worker_export_sheet_id = COALESCE(worker_export_sheet_id, '1Qxn6DRVYIIuXvoCXlHSa1fu-CThlBTyj6ipYVVEP4bY')
  WHERE id = 1;