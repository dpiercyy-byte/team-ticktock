import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Briefcase, Calendar, Bell, User } from "lucide-react";

const items = [
  { to: "/ledger", label: "Home", icon: Home, exact: true },
  { to: "/ledger/jobs", label: "Jobs", icon: Briefcase, exact: false },
  { to: "/ledger/calendar", label: "Calendar", icon: Calendar, exact: false },
  { to: "/ledger/notifications", label: "Alerts", icon: Bell, exact: false },
  { to: "/ledger/profile", label: "Profile", icon: User, exact: false },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/85 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-3xl grid grid-cols-5">
        {items.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.2]" : "stroke-[1.75]"}`} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
