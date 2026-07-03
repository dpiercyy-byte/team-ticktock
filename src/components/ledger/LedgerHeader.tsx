import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, CheckCircle2, RefreshCw, ArrowLeft } from "lucide-react";

const tabs = [
  { to: "/ledger", label: "Executive", icon: LayoutDashboard, exact: true },
  { to: "/ledger/active", label: "Active", icon: Briefcase },
  { to: "/ledger/closed", label: "Closed", icon: CheckCircle2 },
  { to: "/ledger/sync", label: "Sync", icon: RefreshCw },
];

export function LedgerHeader() {
  const { location } = useRouterState();
  return (
    <div className="pill-card p-4 md:p-5 mb-6 flex items-center justify-between gap-3 flex-wrap fade-up">
      <div className="flex items-center gap-3">
        <Link
          to="/apps"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Apps
        </Link>
        <div className="h-6 w-px bg-slate-200" />
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">Clockwise</div>
          <div className="display text-xl md:text-2xl text-slate-900 -mt-0.5">Ledger</div>
        </div>
      </div>
      <nav className="flex items-center gap-1 bg-slate-100/60 rounded-full p-1">
        {tabs.map((t) => {
          const active = t.exact
            ? location.pathname === t.to
            : location.pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={
                "tab-pill inline-flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors " +
                (active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900")
              }
              data-state={active ? "active" : "inactive"}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
