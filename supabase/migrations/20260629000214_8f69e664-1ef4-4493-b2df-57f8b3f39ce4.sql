CREATE TABLE public.weekly_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  wages numeric NOT NULL DEFAULT 0,
  reimbursement_total numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  paid_at timestamptz NOT NULL DEFAULT now(),
  paid_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, week_start)
);

GRANT ALL ON public.weekly_payouts TO service_role;

ALTER TABLE public.weekly_payouts ENABLE ROW LEVEL SECURITY;

CREATE INDEX weekly_payouts_worker_week_idx ON public.weekly_payouts(worker_id, week_start);
