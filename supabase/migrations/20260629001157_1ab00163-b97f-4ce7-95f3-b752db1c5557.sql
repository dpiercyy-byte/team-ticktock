ALTER TABLE public.weekly_payouts
  ADD COLUMN IF NOT EXISTS actual_paid numeric,
  ADD COLUMN IF NOT EXISTS tip_amount numeric;