## Fix: re-scan wipes worker's job site + weak AI fills

### 1. Never overwrite an existing job site on re-scan
In `src/lib/receipts.functions.ts` → `runParseForReimbursement`:
- Before writing the patch, read the row's current `parsed_job_site_id`.
- Only set `parsed_job_site_id` from the AI result when the current value is `null`. Otherwise, omit the key from the patch so the worker's (or admin's) selection is preserved.
- Same guard for `material_type` / `billable_job_site_id` (don't clobber if already set by a human).

### 2. Improve AI parsing quality
Also in `runParseForReimbursement` / `aiParseReceipt`:
- Upgrade the prompt with concrete instructions: locate vendor at top of receipt, prefer transaction date over print date, prefer the largest bottom-line "TOTAL" for total, sum items→subtotal, tax line if labeled, and infer category from vendor (Home Depot/Lowes→Materials, Shell/Chevron/gas→Fuel, etc.).
- Return a per-field confidence map so we can log low-confidence fields.
- Add one retry with a stricter "re-read and correct" pass if any of vendor/date/total came back null.
- Keep the existing model (`google/gemini-3-flash-preview`) but add `temperature: 0` for determinism.

### 3. UI signal (small)
In the admin receipt edit dialog, show a subtle "Job locked by worker selection" hint next to the job site field when it was set pre-parse, so admins know a re-scan won't touch it.

### Files touched
- `src/lib/receipts.functions.ts` (parse guard + prompt)
- `src/components/admin/AdminApp.tsx` (hint text only)

No schema changes. No migration needed.
