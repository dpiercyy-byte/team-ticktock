
ALTER TABLE public.reimbursements ALTER COLUMN worker_id DROP NOT NULL;
ALTER TABLE public.reimbursements ADD COLUMN IF NOT EXISTS is_admin_receipt boolean NOT NULL DEFAULT false;
ALTER TABLE public.reimbursements ADD COLUMN IF NOT EXISTS payee_label text;
CREATE INDEX IF NOT EXISTS reimbursements_is_admin_idx ON public.reimbursements(is_admin_receipt) WHERE is_admin_receipt = true;
