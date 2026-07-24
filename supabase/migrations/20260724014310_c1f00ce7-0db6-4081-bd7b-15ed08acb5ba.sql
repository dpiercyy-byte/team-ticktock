
-- Drop scheduled ledger sheet-pull jobs, if any exist
DO $$
DECLARE r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR r IN SELECT jobname FROM cron.job WHERE jobname ILIKE '%ledger%' LOOP
      PERFORM cron.unschedule(r.jobname);
    END LOOP;
  END IF;
END $$;

DROP TABLE IF EXISTS public.ledger_jobs CASCADE;
DROP FUNCTION IF EXISTS public.ledger_jobs_touch_updated_at() CASCADE;
