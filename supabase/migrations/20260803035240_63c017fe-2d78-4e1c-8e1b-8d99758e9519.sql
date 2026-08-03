-- ============ clients ============
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lead_source text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferred_contact_method text;

DROP TRIGGER IF EXISTS clients_touch_updated_at ON public.clients;
CREATE TRIGGER clients_touch_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();

-- ============ properties ============
CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  address text NOT NULL,
  unit text,
  city text,
  province text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "properties deny all" ON public.properties;
CREATE POLICY "properties deny all" ON public.properties FOR ALL USING (false) WITH CHECK (false);

DROP TRIGGER IF EXISTS properties_touch_updated_at ON public.properties;
CREATE TRIGGER properties_touch_updated_at BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();

CREATE INDEX IF NOT EXISTS properties_client_id_idx ON public.properties(client_id);

-- ============ ledger_jobs (canonical project) ============
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS sales_stage text;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS delivery_status text;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS estimated_value_cents bigint NOT NULL DEFAULT 0;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS assigned_owner text;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS next_action text;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS next_action_due_at timestamptz;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS expected_start_date date;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS actual_start_date date;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS expected_completion_date date;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS actual_completion_date date;
ALTER TABLE public.ledger_jobs ADD COLUMN IF NOT EXISTS lost_reason text;

CREATE INDEX IF NOT EXISTS ledger_jobs_client_id_idx ON public.ledger_jobs(client_id);
CREATE INDEX IF NOT EXISTS ledger_jobs_property_id_idx ON public.ledger_jobs(property_id);

-- ============ job_sites -> project link ============
ALTER TABLE public.job_sites ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.ledger_jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS job_sites_project_id_idx ON public.job_sites(project_id);

-- supplier locations must never carry a project link
UPDATE public.job_sites SET project_id = NULL WHERE kind = 'supplier' AND project_id IS NOT NULL;

-- ============ backfill: status -> sales_stage / delivery_status ============
UPDATE public.ledger_jobs SET
  sales_stage = COALESCE(sales_stage, CASE status
    WHEN 'Lead' THEN 'New Lead'
    WHEN 'Site Visit Required' THEN 'Site Visit'
    WHEN 'Estimate Required' THEN 'Estimating'
    WHEN 'Waiting For Approval' THEN 'Estimate Sent'
    WHEN 'Scheduled' THEN 'Won'
    WHEN 'Active' THEN 'Won'
    WHEN 'Completed' THEN 'Won'
    ELSE 'New Lead' END),
  delivery_status = COALESCE(delivery_status, CASE status
    WHEN 'Scheduled' THEN 'Scheduled'
    WHEN 'Active' THEN 'Active'
    WHEN 'Completed' THEN 'Completed'
    ELSE 'Not Started' END)
WHERE sales_stage IS NULL OR delivery_status IS NULL;

-- ============ backfill: clients + properties from embedded fields ============
DO $$
DECLARE
  j RECORD;
  v_client_id uuid;
  v_property_id uuid;
BEGIN
  FOR j IN SELECT * FROM public.ledger_jobs WHERE client_id IS NULL OR property_id IS NULL LOOP
    -- find or create client
    SELECT c.id INTO v_client_id
    FROM public.clients c
    WHERE lower(trim(c.name)) = lower(trim(coalesce(j.client_name, '')))
      AND coalesce(lower(trim(c.email)), '') = coalesce(lower(trim(j.client_email)), '')
    LIMIT 1;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (name, email, phone)
      VALUES (coalesce(nullif(trim(j.client_name), ''), 'Unknown client'), nullif(trim(j.client_email), ''), nullif(trim(j.client_phone), ''))
      RETURNING id INTO v_client_id;
    END IF;

    -- find or create property for that client
    SELECT p.id INTO v_property_id
    FROM public.properties p
    WHERE p.client_id = v_client_id
      AND lower(trim(p.address)) = lower(trim(coalesce(j.address, '')))
    LIMIT 1;

    IF v_property_id IS NULL THEN
      INSERT INTO public.properties (client_id, address)
      VALUES (v_client_id, coalesce(nullif(trim(j.address), ''), 'Unknown address'))
      RETURNING id INTO v_property_id;
    END IF;

    UPDATE public.ledger_jobs
    SET client_id = COALESCE(client_id, v_client_id),
        property_id = COALESCE(property_id, v_property_id)
    WHERE id = j.id;
  END LOOP;
END $$;

COMMENT ON COLUMN public.ledger_jobs.status IS 'DEPRECATED (kept for rollback) - use sales_stage + delivery_status';
COMMENT ON COLUMN public.ledger_jobs.client_name IS 'DEPRECATED (kept for rollback) - use client_id -> clients';
COMMENT ON COLUMN public.ledger_jobs.client_email IS 'DEPRECATED (kept for rollback) - use client_id -> clients';
COMMENT ON COLUMN public.ledger_jobs.client_phone IS 'DEPRECATED (kept for rollback) - use client_id -> clients';
COMMENT ON COLUMN public.ledger_jobs.address IS 'DEPRECATED (kept for rollback) - use property_id -> properties';