import { Link, useRouterState } from "@tanstack/react-router";
import { Briefcase, CalendarDays, Users, MoreHorizontal, GitBranch } from "lucide-react";

type NavItem = {
  to: "/ledger/calendar" | "/ledger/pipeline" | "/ledger/jobs" | "/ledger/people" | "/ledger/more";
  label: string;
  icon: typeof Briefcase;
  exact?: boolean;
  prominent?: boolean;
};

const NAV: NavItem[] = [
  { to: "/ledger/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/ledger/pipeline", label: "Pipeline", icon: GitBranch },
  { to: "/ledger/jobs", label: "Jobs", icon: Briefcase, prominent: true },
  { to: "/ledger/people", label: "People", icon: Users },
  { to: "/ledger/more", label: "More", icon: MoreHorizontal },
];

export function LedgerBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Ledger"
      className="l-nav fixed inset-x-0 bottom-0 z-40 px-2 pt-1.5 backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-3xl items-end justify-between gap-0.5 pb-1.5">

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
                  "flex flex-col items-center gap-1 rounded-full px-2 py-1 font-semibold transition-colors " +
                  (item.prominent ? "min-w-[72px] text-[12px] font-bold " : "min-w-[58px] text-[10px] ") +
                  (active ? "l-nav-item--active" : "l-muted")
                }
              >
                <span
                  className={
                    "l-nav-icon grid place-items-center rounded-full transition-colors " +
                    (item.prominent ? "h-11 w-11" : "h-9 w-9")
                  }
                >
                  <Icon
                    className={item.prominent ? "h-[23px] w-[23px]" : "h-[19px] w-[19px]"}
                    strokeWidth={item.prominent ? 2.3 : 2.1}
                  />
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
