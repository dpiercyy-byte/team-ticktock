CREATE TABLE public.project_change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ledger_jobs(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  approved_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.project_change_orders TO service_role;
ALTER TABLE public.project_change_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_change_orders deny all" ON public.project_change_orders FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX project_change_orders_project_idx ON public.project_change_orders(project_id);
CREATE TRIGGER project_change_orders_touch_updated_at BEFORE UPDATE ON public.project_change_orders FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();

CREATE TABLE public.project_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ledger_jobs(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  vendor text,
  amount_cents bigint NOT NULL DEFAULT 0,
  incurred_on date,
  client_billable boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.project_costs TO service_role;
ALTER TABLE public.project_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_costs deny all" ON public.project_costs FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX project_costs_project_idx ON public.project_costs(project_id);
CREATE TRIGGER project_costs_touch_updated_at BEFORE UPDATE ON public.project_costs FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();

ALTER TABLE public.ledger_jobs
  ADD COLUMN IF NOT EXISTS last_summary_export_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_summary_export_hash text;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS project_summary_sheet_id text,
  ADD COLUMN IF NOT EXISTS project_summary_last_sync_at timestamptz;