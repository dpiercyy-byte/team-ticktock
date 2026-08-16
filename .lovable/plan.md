Plan

Goal: Make the "Add" button in the Receipts tab one or two points larger without disturbing the surrounding header layout, then show a before-and-after screenshot for approval.

1. Locate the "Add" button in the receipts tab header (line ~2896 in `src/components/admin/AdminApp.tsx`).
2. Capture a **before** screenshot of the receipts tab at the current mobile viewport (402x725).
3. Increase the label size from `text-xs` to a slightly larger token (e.g., `text-[13px]` or `text-sm`) while keeping the button height (`h-8`), icon size (`h-3.5 w-3.5`), and horizontal padding (`px-3`) unchanged so the surrounding buttons and header row do not shift.
4. Capture an **after** screenshot of the same receipts tab viewport.
5. Present both screenshots side-by-side for approval; if approved, keep the change. If not, revert or tweak the size.
