
-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  project TEXT,
  created_by TEXT NOT NULL DEFAULT 'worker', -- 'worker' or 'admin'
  flagged_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_worker ON public.time_entries(worker_id, clock_in DESC);
CREATE INDEX idx_time_entries_active ON public.time_entries(worker_id) WHERE clock_out IS NULL;

CREATE TABLE public.reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reimb_worker_week ON public.reimbursements(worker_id, week_start);

CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  admin_password_hash TEXT NOT NULL,
  project_tracking_enabled BOOLEAN NOT NULL DEFAULT true,
  show_pay_estimates BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT singleton CHECK (id = 1)
);

-- Seed default admin password "admin123"
INSERT INTO public.app_settings (id, admin_password_hash)
VALUES (1, crypt('admin123', gen_salt('bf')));

-- RLS: enable, no policies = deny all client access
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
