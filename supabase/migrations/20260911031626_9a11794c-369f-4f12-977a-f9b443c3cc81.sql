CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id text NOT NULL UNIQUE,
  spreadsheet_url text NOT NULL,
  sheet_tab text NOT NULL DEFAULT 'Sheet1',
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  last_synced_at timestamptz,
  last_imported_count integer NOT NULL DEFAULT 0,
  last_skipped_count integer NOT NULL DEFAULT 0,
  last_rejected_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead_sources TO service_role;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lead_qualification_rules (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  minimum_budget_cents bigint,
  accepted_project_types text[] NOT NULL DEFAULT '{}'::text[],
  accepted_postal_prefixes text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead_qualification_rules TO service_role;
ALTER TABLE public.lead_qualification_rules ENABLE ROW LEVEL SECURITY;
INSERT INTO public.lead_qualification_rules (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.lead_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.lead_sources(id) ON DELETE CASCADE,
  external_id text,
  row_fingerprint text NOT NULL,
  source_row_number integer,
  client_name text NOT NULL,
  phone text,
  email text,
  address text,
  project_type text,
  budget_cents bigint,
  campaign text,
  form_name text,
  notes text,
  submitted_at timestamptz,
  qualification_status text NOT NULL DEFAULT 'needs_review' CHECK (qualification_status IN ('qualified', 'needs_review', 'rejected')),
  qualification_reasons text[] NOT NULL DEFAULT '{}'::text[],
  stage text NOT NULL DEFAULT 'New' CHECK (stage IN ('New', 'Contacted', 'Qualified', 'Won', 'Lost')),
  assigned_owner text,
  next_action text,
  next_action_due_at timestamptz,
  lost_reason text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ledger_job_id uuid REFERENCES public.ledger_jobs(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, row_fingerprint)
);
GRANT ALL ON public.lead_records TO service_role;
ALTER TABLE public.lead_records ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX lead_records_source_external_id_key ON public.lead_records(source_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX lead_records_stage_idx ON public.lead_records(stage, imported_at DESC);
CREATE INDEX lead_records_qualification_idx ON public.lead_records(qualification_status, imported_at DESC);

CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.lead_records(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  detail text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead_activities TO service_role;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX lead_activities_lead_time_idx ON public.lead_activities(lead_id, occurred_at DESC);

CREATE TRIGGER lead_sources_touch_updated_at BEFORE UPDATE ON public.lead_sources FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();
CREATE TRIGGER lead_qualification_rules_touch_updated_at BEFORE UPDATE ON public.lead_qualification_rules FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();
CREATE TRIGGER lead_records_touch_updated_at BEFORE UPDATE ON public.lead_records FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();