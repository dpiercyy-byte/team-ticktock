
ALTER TABLE public.reimbursements
  ADD COLUMN IF NOT EXISTS parsed_vendor text,
  ADD COLUMN IF NOT EXISTS parsed_date date,
  ADD COLUMN IF NOT EXISTS parsed_subtotal numeric,
  ADD COLUMN IF NOT EXISTS parsed_tax numeric,
  ADD COLUMN IF NOT EXISTS parsed_total numeric,
  ADD COLUMN IF NOT EXISTS parsed_category text,
  ADD COLUMN IF NOT EXISTS parsed_job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parse_status text,
  ADD COLUMN IF NOT EXISTS parse_confidence numeric,
  ADD COLUMN IF NOT EXISTS parse_raw jsonb,
  ADD COLUMN IF NOT EXISTS parsed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sheet_row_id text;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS google_sheet_id text,
  ADD COLUMN IF NOT EXISTS google_sheet_tab text DEFAULT 'Receipts',
  ADD COLUMN IF NOT EXISTS sheet_sync_enabled boolean NOT NULL DEFAULT false;
