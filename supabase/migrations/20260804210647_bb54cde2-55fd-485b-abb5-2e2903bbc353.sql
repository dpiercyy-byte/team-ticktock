CREATE TABLE public.project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ledger_jobs(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount_expected_cents bigint NOT NULL DEFAULT 0,
  due_date date,
  amount_received_cents bigint NOT NULL DEFAULT 0,
  received_date date,
  method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.project_payments TO service_role;
ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_payments deny all" ON public.project_payments FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX project_payments_project_idx ON public.project_payments(project_id);
CREATE TRIGGER project_payments_touch_updated_at BEFORE UPDATE ON public.project_payments FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();

CREATE TABLE public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ledger_jobs(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  url text,
  storage_path text,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.project_documents TO service_role;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_documents deny all" ON public.project_documents FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX project_documents_project_idx ON public.project_documents(project_id);
CREATE TRIGGER project_documents_touch_updated_at BEFORE UPDATE ON public.project_documents FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();