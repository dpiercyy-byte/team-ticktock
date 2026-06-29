Replace the single file-picker inputs in both the worker reimbursement flow and the admin receipt upload flows with a two-choice picker that lets users either (1) snap a photo directly from the device camera or (2) pick an existing file from their gallery.

### What to build

**1. Reusable CameraFilePicker component** (`src/components/CameraFilePicker.tsx`)
- A small modal/dialog triggered by a button.
- Two actions:
  - **Take Photo** — triggers a hidden `<input type="file" accept="image/*" capture="environment">` to open the device camera.
  - **Choose from Gallery** — triggers a hidden `<input type="file" accept="image/*">` to open the native file picker.
- On file selection, read the file via `FileReader` (base64) and call an `onFile` callback so the parent can upload it through the existing server function.
- Re-use the existing `ALLOWED_RECEIPT_MIMES` validation and reject oversized files (>10 MB) before reading.

**2. Wire into WorkerApp** (`src/components/worker/WorkerApp.tsx`)
- In the reimbursement section, replace the current `<input type="file">` element with the new `CameraFilePicker`.
- Keep the existing `workerUploadReceipt` + `fileToBase64` upload pipeline intact; only the trigger UI changes.

**3. Wire into AdminApp** (`src/components/admin/AdminApp.tsx`)
- In the admin "Add receipts" bulk-upload dialog and the standalone receipt upload areas, replace the raw file inputs with `CameraFilePicker`.
- Preserve existing upload flows (`uploadReceipt`, `adminAddStandaloneReceipt`).

### What stays the same
- No server-side changes.
- No changes to base64 encoding, MIME validation, upload limits, or existing server functions.
- No changes to the Google Sheets sync / AI parsing pipeline.

### Result
Workers and admins can tap "Add receipt" and immediately choose between snapping a new photo or selecting an existing image, instead of only seeing the generic file picker.