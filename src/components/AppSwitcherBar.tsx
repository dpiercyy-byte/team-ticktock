import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Clock, BookOpen, LogOut } from "lucide-react";
import { getAdminToken, getWorkerSession, clearAdminToken, clearWorkerSession } from "@/lib/session";

export function AppSwitcherBar({ onLogout }: { onLogout?: () => void }) {
  const { location } = useRouterState();
  const navigate = useNavigate();
  const isLedger = location.pathname.startsWith("/ledger");
  const isAdmin = typeof window !== "undefined" && !!getAdminToken();
  const clockwiseTo = isAdmin ? "/admin" : "/";

  const handleLogout = () => {
    if (onLogout) return onLogout();
    clearAdminToken();
    clearWorkerSession();
    navigate({ to: "/" });
  };

  const base =
    "flex-1 flex items-center justify-center gap-2 h-11 sm:h-12 text-sm sm:text-base font-semibold transition-colors";
  const active = "bg-slate-900 text-white";
  const inactive = "bg-white text-slate-600 hover:bg-slate-50";

  return (
    <div className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white">
      <div className="flex items-stretch w-full">
        <Link to={clockwiseTo} className={`${base} ${!isLedger ? active : inactive}`}>
          <Clock className="w-4 h-4" />
          Clockwise
        </Link>
        <Link to="/ledger" className={`${base} ${isLedger ? active : inactive}`}>
          <BookOpen className="w-4 h-4" />
          Ledger
        </Link>
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          className="shrink-0 h-11 sm:h-12 px-3 sm:px-4 inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 border-l border-slate-200 text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </div>
  );
}
