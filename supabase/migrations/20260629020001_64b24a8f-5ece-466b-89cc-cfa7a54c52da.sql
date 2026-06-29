ALTER TABLE public.reimbursements
  ADD COLUMN IF NOT EXISTS material_type text NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS billable_job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL;

ALTER TABLE public.reimbursements
  DROP CONSTRAINT IF EXISTS reimbursements_material_type_check;

ALTER TABLE public.reimbursements
  ADD CONSTRAINT reimbursements_material_type_check
  CHECK (material_type IN ('regular','client_billable'));

CREATE INDEX IF NOT EXISTS reimbursements_billable_job_site_idx
  ON public.reimbursements(billable_job_site_id);