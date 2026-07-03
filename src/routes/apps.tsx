import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clock, BookOpen, LogOut, ShieldCheck, User } from "lucide-react";
import { getAdminToken, getWorkerSession, clearAdminToken, clearWorkerSession } from "@/lib/session";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/apps")({
  head: () => ({
    meta: [
      { title: "Choose App — Clockwise" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppsChooser,
});

function AppsChooser() {
  const navigate = useNavigate();
  const admin = typeof window !== "undefined" ? getAdminToken() : null;
  const worker = typeof window !== "undefined" ? getWorkerSession() : null;

  useEffect(() => {
    if (!admin && !worker) navigate({ to: "/" });
  }, [admin, worker, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">Welcome back</div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Choose an app</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {admin ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs">
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </span>
            ) : worker ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs">
                <User className="w-3.5 h-3.5" /> {worker.name}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (admin) clearAdminToken();
                if (worker) clearWorkerSession();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AppTile
            to={admin ? "/admin" : "/"}
            icon={<Clock className="w-6 h-6" />}
            title="Clockwise"
            subtitle="Time tracking, entries, payouts, receipts"
            accent="bg-blue-600"
          />
          <AppTile
            to="/ledger"
            icon={<BookOpen className="w-6 h-6" />}
            title="Ledger"
            subtitle="Job pipeline, revenue, margins"
            accent="bg-slate-900"
          />
        </div>
      </div>
    </div>
  );
}

function AppTile({ to, icon, title, subtitle, accent }: { to: string; icon: React.ReactNode; title: string; subtitle: string; accent: string }) {
  return (
    <Link
      to={to}
      className="group block bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${accent} text-white mb-4`}>{icon}</div>
      <div className="text-xl font-semibold text-slate-900">{title}</div>
      <div className="text-sm text-slate-500 mt-1">{subtitle}</div>
      <div className="mt-4 text-sm font-medium text-slate-900 group-hover:translate-x-0.5 transition-transform">Open →</div>
    </Link>
  );
}
