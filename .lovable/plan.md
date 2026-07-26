## What went wrong

Your Android photo was 3812 KB. The app sends receipts to the server as **base64 text inside a JSON request body** — base64 inflates the file by ~33%, so that single photo became a ~5.1 MB request. On a phone connection those large single-shot requests frequently stall or get dropped, which is exactly the "works on the 5th try" pattern. The dialog then shows a generic **"All uploads failed"** because the real error is only written to the browser console, never shown.

Two secondary issues on Android:
- Some Android cameras/galleries report a photo as `image/heic`, `image/webp`, or with an empty MIME type. The picker silently rejects those ("must be JPG, PNG, or PDF").
- A failed file is not retried at all — one network hiccup kills it.

## The fix

**1. Shrink images before upload (main fix)**
Add a shared helper `src/lib/image-compress.ts`:
- Decode the picked image (via `createImageBitmap`), draw to a canvas scaled so the longest edge is max 2000px, re-encode as JPEG quality ~0.8.
- Loop down quality/size until the result is under ~1.2 MB.
- PDFs pass through untouched; if decoding fails for any reason, fall back to the original file so nothing breaks.

A 3.8 MB phone photo becomes ~300–600 KB — small enough to upload reliably first try, and receipt text stays perfectly legible for the AI parser.

**2. Retry with backoff**
Wrap the per-file `uploadReceipt` call in up to 3 attempts with a short increasing delay, so a transient mobile-network drop self-heals instead of failing the batch.

**3. Show the real error**
Replace the blanket "All uploads failed" toast with the actual failure message from the first failed file (e.g. size, auth expiry, storage error), so future problems are diagnosable.

**4. Accept what Android actually hands over**
Widen the picker's accepted list to include `image/heic`, `image/heif`, `image/webp`, and files with a blank MIME type — these get normalized to JPEG by the compression step before being sent, so the server still only ever receives JPG/PNG/PDF.

**5. Apply the same treatment to the worker app**
The worker reimbursement upload (`WorkerApp.tsx`) uses the identical base64 pattern and has the same failure mode — it gets the same compression + retry helper.

## Technical notes

- Files touched: new `src/lib/image-compress.ts`; `src/components/admin/AdminApp.tsx` (`AdminAddReceiptsDialog`: `addFiles`, `submit`, `ADMIN_ALLOWED_MIMES`); `src/components/worker/WorkerApp.tsx` (receipt submit path).
- No server or database changes. `uploadReceipt` / `workerUploadReceipt` keep their existing 10 MB guard and JPG/PNG/PDF enum as the backstop.
- Compression runs on the main thread but only on user-picked files; typical cost is well under 200 ms per photo.
