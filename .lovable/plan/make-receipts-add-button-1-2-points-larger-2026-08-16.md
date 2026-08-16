# Make Receipts "Add" button 1–2 points larger

## Goal
Increase the font size of the "Add" button in the Receipts tab so it stands out slightly, without disturbing the surrounding bottom-nav layout.

## Current state
- The button is in `src/components/admin/AdminApp.tsx` and currently uses `text-xs`.
- A before screenshot has already been captured showing a small blue "Add" pill in the Receipts tab header.

## Proposed change
- Change `text-xs` to `text-[13px]` (one point larger) on the Add button in the Receipts tab.
- Keep the same pill padding, height (`h-8`), and gap so the surrounding UI is not pushed around.
- Verify the change in the live preview at the mobile viewport, then capture an after screenshot.

## Approval
Please confirm whether `text-[13px]` is the right bump, or if you prefer `text-sm` (≈14 px, two points bigger). After approval, I will apply the edit and show the after screenshot.
