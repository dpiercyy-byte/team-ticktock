
CREATE OR REPLACE FUNCTION public.audit_log_block_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$;
