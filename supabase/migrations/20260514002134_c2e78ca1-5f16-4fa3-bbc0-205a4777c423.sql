ALTER TABLE public.reimbursements REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reimbursements;