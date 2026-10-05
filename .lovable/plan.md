# Consistent receipt merchant names in Google Sheets

## Goal
Format receipt merchant names in Title Case when they are exported, so values such as `THE HOME DEPOT` appear as `The Home Depot`.

## Changes
- Add a small merchant-name formatter for the receipt export.
- Apply it only to the Google Sheets Vendor column, keeping the original scanned or edited name unchanged inside the app.
- Handle extra spaces, mixed case, apostrophes, and hyphenated names consistently.
- Use the same formatting when a receipt row is first added or later updated in Google Sheets.

## Verification
- Add focused tests for all-uppercase, mixed-case, apostrophe, and hyphenated merchant names.
- Confirm a receipt export sends the Title Case vendor value without changing other columns.

## Scope
Existing rows already in Google Sheets will not be rewritten automatically; they will be corrected if that receipt is exported again.
