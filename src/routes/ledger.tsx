import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LedgerHeader } from "@/components/ledger/LedgerHeader";
import { AppSwitcherBar } from "@/components/AppSwitcherBar";
import { getSessionToken } from "@/lib/ledger-client";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Ledger — Clockwise" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LedgerLayout,
});

function LedgerLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!getSessionToken()) navigate({ to: "/" });
  }, [navigate]);
  return (
    <div className="ledger-scope grain min-h-screen">
      <AppSwitcherBar />
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-6">
        <LedgerHeader />
        <Outlet />
      </div>
    </div>
  );
}
