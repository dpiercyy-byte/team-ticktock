import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSwitcherBar } from "@/components/AppSwitcherBar";
import { LedgerBottomNav } from "@/components/ledger/LedgerBottomNav";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Ledger — Jobs" },
      { name: "description", content: "Every renovation job in one calm place." },
      { property: "og:title", content: "Ledger — Jobs" },
      { property: "og:description", content: "Every renovation job in one calm place." },
    ],
  }),
  component: LedgerLayout,
});

function LedgerLayout() {
  return (
    <div className="ledger-scope min-h-screen flex flex-col">
      <AppSwitcherBar />
      <Outlet />
      <LedgerBottomNav />
    </div>
  );
}
