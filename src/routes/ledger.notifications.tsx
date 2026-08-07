import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { relativeTime } from "@/components/ledger/ledger-ui";
import { ledgerJobsQuery } from "@/lib/ledger-client";

export const Route = createFileRoute("/ledger/notifications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notifications — Ledger" },
      { name: "description", content: "A calm feed of what's happening across every job." },
      { property: "og:title", content: "Notifications — Ledger" },
      { property: "og:description", content: "Latest movement across every job." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerJobsQuery());
  },
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data: jobs } = useSuspenseQuery(ledgerJobsQuery());
  const feed = jobs
    .map((j) => ({ job: j, at: j.updatedAt }))
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 30);

  return (
    <LedgerShell>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Notifications</h1>
        <p className="mt-1 text-sm l-muted">The latest movement across every job.</p>
      </header>

      {feed.length === 0 ? (
        <div className="l-card px-6 py-16 text-center">
          <Bell className="mx-auto h-6 w-6 l-muted" />
          <p className="mt-3 text-sm l-muted">Nothing new yet.</p>
        </div>
      ) : (
        <ol className="grid gap-3">
          {feed.map(({ job, at }) => (
            <li key={job.id}>
              <Link
                to="/ledger/jobs/$jobId"
                params={{ jobId: job.id }}
                className="flex items-start gap-4 l-card px-4 py-3.5"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{job.name}</p>
                  <p className="text-xs l-muted">
                    {job.status} · {job.client.name}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] l-muted tabular-nums">
                  {relativeTime(at)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </LedgerShell>
  );
}
