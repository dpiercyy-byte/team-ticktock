import { createFileRoute } from "@tanstack/react-router";
import { AppSwitcherBar } from "@/components/AppSwitcherBar";
import { Hammer } from "lucide-react";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Ledger — Rebuilding" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LedgerPlaceholder,
});

function LedgerPlaceholder() {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppSwitcherBar />
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white inline-flex items-center justify-center mb-6">
          <Hammer className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-semibold text-slate-900 mb-3">Ledger is being rebuilt</h1>
        <p className="text-slate-500 leading-relaxed">
          The old Ledger has been retired. A new version is coming — Clockwise is unaffected.
        </p>
      </div>
    </div>
  );
}
