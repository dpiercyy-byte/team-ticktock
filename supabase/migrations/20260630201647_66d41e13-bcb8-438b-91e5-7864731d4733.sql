
ALTER TABLE public.reimbursements
  ADD COLUMN IF NOT EXISTS uploaded_by_admin boolean NOT NULL DEFAULT false;

UPDATE public.reimbursements r
SET uploaded_by_admin = true
WHERE EXISTS (
  SELECT 1 FROM public.audit_log a
  WHERE a.entity_type = 'reimbursement'
    AND a.entity_id = r.id::text
    AND a.actor_kind = 'admin'
    AND a.action IN ('admin_receipt_create','reimbursement_create')
)
OR r.is_admin_receipt = true;
