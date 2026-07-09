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
    "flex-1 flex items-center justify-center gap-2 h-10 sm:h-11 text-sm sm:text-base font-semibold transition-colors rounded-xl";
  const active = "bg-slate-900 text-white shadow-sm";
  const inactive = "bg-secondary text-secondary-foreground hover:bg-muted";

  return (
    <div className="sticky top-0 z-40 w-full border-b border-border bg-background">
      <div className="flex items-center gap-2 w-full px-2 sm:px-3 py-2">
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
          className="shrink-0 h-10 sm:h-11 px-3 sm:px-4 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </div>
  );
}
