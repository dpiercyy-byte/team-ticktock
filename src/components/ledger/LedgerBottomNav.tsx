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
      className="l-nav fixed inset-x-0 bottom-0 z-40 px-2 pt-1.5 backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-3xl items-center justify-between gap-0.5 pb-1.5">

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
                  "flex min-w-[58px] flex-col items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition-colors " +
                  (active ? "l-nav-item--active" : "l-muted")
                }
              >
                <span className="l-nav-icon grid h-9 w-9 place-items-center rounded-full transition-colors">
                  <Icon className="h-[19px] w-[19px]" strokeWidth={2.1} />
                </span>
                <span className="tracking-tight">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
