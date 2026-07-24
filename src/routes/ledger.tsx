import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSwitcherBar } from "@/components/AppSwitcherBar";
import { BottomNav } from "@/components/os/BottomNav";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Jobs — Clockwise OS" },
      { name: "description", content: "The Job is the single source of truth." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LedgerLayout,
});

function LedgerLayout() {
  return (
    <div className="min-h-screen bg-[hsl(40_30%_98%)]">
      <AppSwitcherBar />
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4 sm:px-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
