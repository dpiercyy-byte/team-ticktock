import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LedgerHeader } from "@/components/ledger/LedgerHeader";
import { AppSwitcherBar } from "@/components/AppSwitcherBar";
import { useSwipeableTabs, SwipeTabPanel } from "@/components/ui/swipeable-tabs";
import { getSessionToken } from "@/lib/ledger-client";

const LEDGER_TABS = ["/ledger", "/ledger/active", "/ledger/closed", "/ledger/sync"] as const;

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [{ title: "Ledger — Clockwise" }, { name: "robots", content: "noindex" }],
  }),
  component: LedgerLayout,
});

function LedgerLayout() {
  const navigate = useNavigate();
  const { location } = useRouterState();

  const swipeHandlers = useSwipeableTabs({
    items: LEDGER_TABS,
    current: location.pathname,
    onChange: (to) => navigate({ to }),
  });

  useEffect(() => {
    if (!getSessionToken()) navigate({ to: "/" });
  }, [navigate]);
  return (
    <div {...swipeHandlers} className="ledger-scope grain min-h-screen touch-pan-y">
      <AppSwitcherBar />
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-6">
        <LedgerHeader />
        <SwipeTabPanel tabKey={location.pathname} tabs={LEDGER_TABS}>
          <Outlet />
        </SwipeTabPanel>
      </div>
    </div>
  );
}
