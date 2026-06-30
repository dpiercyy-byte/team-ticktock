## Move Receipts to main admin tab bar

### Goal
Move the "Receipts" view out of the Payout sub-tab and into its own top-level admin tab, positioned between "Payout" and "Workers".

### What will change

1. **AdminDashboard main tab bar**
   - Insert `<TabsTrigger value="receipts">Receipts</TabsTrigger>` between "Payout" and "Workers" triggers.
   - Insert `<TabsContent value="receipts"><ReceiptsTab … /></TabsContent>` between Payout and Workers content blocks.

2. **PayoutsTab internal tabs**
   - Remove the `<TabsTrigger value="receipts">Receipts</TabsTrigger>` from the sub-tabs list.
   - Remove the `<TabsContent value="receipts">…</TabsContent>` block from PayoutsTab.

3. **Preserve existing receipt functionality**
   - ReceiptsTab component stays exactly as-is (filters, cards, edit/delete/AI parse, add receipts dialog, etc.).
   - The `<Receipts>` content currently rendered inside PayoutsTab is already a self-contained component (`ReceiptsTab`).
   - Realtime subscriptions and query invalidations inside ReceiptsTab remain unchanged.

### Out of scope
- No changes to receipt upload flow, job site association, or Google Sheets sync.
- No changes to the ReceiptsTab component itself.
