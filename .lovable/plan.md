## Plan

1. **Backfill Dylan’s missing clock-out tags**
   - Update Dylan - test worker’s completed entries where the clock-out tag is blank.
   - Use the existing intended fallback: copy the clock-in geo status and job site into the clock-out geo fields.
   - Add an audit entry noting the repair/backfill.

2. **Harden normal worker clock-out**
   - Update the worker clock-out function so if GPS resolution fails or returns incomplete data, the completed entry still gets a clock-out status.
   - Fallback rule: if no usable clock-out tag is available, mirror the clock-in tag.

3. **Harden admin/auto clock-out consistency**
   - Confirm the force-close helper keeps mirroring clock-in tag to clock-out tag.
   - Keep admin forced clock-out and 8 PM auto clock-out using that same fallback behavior.

4. **Verify**
   - Query Dylan’s last completed entries to confirm the clock-out tag fields are populated.
   - Run a targeted typecheck/build validation for the touched code path.