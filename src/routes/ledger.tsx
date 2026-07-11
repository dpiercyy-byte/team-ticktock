import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LedgerHeader } from "@/components/ledger/LedgerHeader";
import { AppSwitcherBar } from "@/components/AppSwitcherBar";
import { SwipeCarousel } from "@/components/ui/swipeable-tabs";
import { getSessionToken } from "@/lib/ledger-client";

const LEDGER_TABS = ["/ledger", "/ledger/active", "/ledger/closed", "/ledger/sync"] as const;
type LedgerTab = (typeof LEDGER_TABS)[number];

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [{ title: "Ledger — Clockwise" }, { name: "robots", content: "noindex" }],
  }),
  component: LedgerLayout,
});

function LedgerLayout() {
  const navigate = useNavigate();
  const { location } = useRouterState();

  useEffect(() => {
    if (!getSessionToken()) navigate({ to: "/" });
  }, [navigate]);

  const current = (LEDGER_TABS as readonly string[]).includes(location.pathname)
    ? (location.pathname as LedgerTab)
    : "/ledger";

  return (
    <div className="ledger-scope grain min-h-screen">
      <AppSwitcherBar />
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-6">
        <LedgerHeader />
        <SwipeCarousel
          items={LEDGER_TABS}
          current={current}
          onChange={(to) => navigate({ to })}
          renderPanel={(key) =>
            key === current ? <Outlet /> : <div className="min-h-[300px]" aria-hidden />
          }
        />
      </div>
    </div>
  );
}
