ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS cash_export_sheet_id text DEFAULT '1JPWlwuYOyOd5PATx33Y1mfVIM6zFFNC-v7hDcQWNyEs',
  ADD COLUMN IF NOT EXISTS cash_export_tab text DEFAULT 'Cash Tracking',
  ADD COLUMN IF NOT EXISTS cash_export_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.weekly_payouts
  ADD COLUMN IF NOT EXISTS paid_by_person text;