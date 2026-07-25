import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Briefcase, CalendarDays, Bell, User } from "lucide-react";

type NavItem = {
  to: "/ledger" | "/ledger/jobs" | "/ledger/calendar" | "/ledger/notifications" | "/ledger/profile";
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { to: "/ledger", label: "Home", icon: Home, exact: true },
  { to: "/ledger/jobs", label: "Jobs", icon: Briefcase },
  { to: "/ledger/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/ledger/notifications", label: "Alerts", icon: Bell },
  { to: "/ledger/profile", label: "Profile", icon: User },
];

export function LedgerBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Ledger"
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-background/90 px-2 py-2 shadow-[0_10px_40px_rgba(15,23,42,0.15)] backdrop-blur-xl"
    >
      <ul className="flex items-center gap-1">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={
                  "flex min-w-[60px] flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors " +
                  (active
                    ? "bg-slate-900 text-white"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                <span className="tracking-tight">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
