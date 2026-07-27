import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { formatCurrency } from "@/components/ledger/ledger-ui";
import { ledgerJobsQuery } from "@/lib/ledger-client";
import { clearAdminToken, clearWorkerSession } from "@/lib/session";

export const Route = createFileRoute("/ledger/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Ledger" },
      { name: "description", content: "Your account and company at a glance." },
      { property: "og:title", content: "Profile — Ledger" },
      { property: "og:description", content: "Your account and company at a glance." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerJobsQuery());
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { data: jobs } = useSuspenseQuery(ledgerJobsQuery());
  const navigate = useNavigate();
  const active = jobs.filter((j) => j.status === "Active").length;
  const collected = jobs.reduce((s, j) => s + j.collected, 0);
  const pipeline = jobs.reduce((s, j) => s + Math.max(0, j.budget - j.collected), 0);

  const handleSignOut = () => {
    clearAdminToken();
    clearWorkerSession();
    navigate({ to: "/" });
  };

  return (
    <LedgerShell>
      <header className="mb-8 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
          L
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ledger</h1>
          <p className="text-sm l-muted">Signed in as Admin</p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-3 l-card p-5">
        <Stat label="Active jobs" value={String(active)} />
        <Stat label="Collected" value={formatCurrency(collected)} />
        <Stat label="Pipeline" value={formatCurrency(pipeline)} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 px-1 text-[15px] font-semibold tracking-tight">Settings</h2>
        <div className="divide-y l-divider divide-y-0 overflow-hidden l-card">
          {["Company", "Team", "Notifications", "Appearance"].map((label) => (
            <button key={label} className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium hover:bg-secondary/60">
              {label}
              <span className="l-muted">›</span>
            </button>
          ))}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-destructive hover:bg-secondary/60"
          >
            Sign out
            <span className="l-muted">›</span>
          </button>
        </div>
      </section>
    </LedgerShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider l-muted">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
