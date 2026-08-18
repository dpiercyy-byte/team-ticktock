UPDATE public.job_sites js
SET project_id = lj.id
FROM public.ledger_jobs lj
WHERE js.project_id IS NULL
  AND js.archived_at IS NULL
  AND js.kind = 'client'
  AND lj.archived_at IS NULL
  AND lower(regexp_replace(split_part(js.address, ',', 1), '[^a-zA-Z0-9]+', ' ', 'g'))
      = lower(regexp_replace(split_part(lj.address, ',', 1), '[^a-zA-Z0-9]+', ' ', 'g'));