import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveDashboard } from "@/components/ledger/ExecutiveDashboard";
import { RecentSheets } from "@/components/ledger/RecentSheets";
import { useLedgerJobs } from "@/lib/ledger-client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/ledger/")({
  component: LedgerExecutive,
});

function LedgerExecutive() {
  const { data, isLoading } = useLedgerJobs();
  return (
    <div className="space-y-4">
      <RecentSheets />
      {isLoading ? (
        <div className="flex justify-center py-12 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <ExecutiveDashboard jobs={data ?? []} />
      )}
    </div>
  );
}
