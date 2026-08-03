import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, Phone, Search } from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { relativeTime } from "@/components/ledger/ledger-ui";
import { clientsDirectoryQuery } from "@/lib/crm-client";

export const Route = createFileRoute("/ledger/people/")({
  head: () => ({
    meta: [
      { title: "People — Ledger" },
      { name: "description", content: "Every client, their projects and what they need next." },
      { property: "og:title", content: "People — Ledger" },
      { property: "og:description", content: "Your client directory." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(clientsDirectoryQuery("", "active"));
  },
  component: PeopleScreen,
});

function PeopleScreen() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const { data: clients = [], isPending } = useQuery(clientsDirectoryQuery(q, filter));

  return (
    <LedgerShell>
      <header className="mb-5">
        <p className="text-[13px] font-medium l-muted">{clients.length} clients</p>
        <h1 className="mt-1 display text-[34px] leading-[1.05] md:text-[42px]">People</h1>
      </header>

      <label className="l-card mb-3 flex items-center gap-2.5 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 l-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone or email"
          className="w-full bg-transparent text-[15px] outline-none placeholder:l-muted"
        />
      </label>

      <div className="mb-5 flex gap-2">
        {(["active", "archived"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={
              "rounded-full px-4 py-2 text-[12px] font-semibold capitalize " +
              (filter === f ? "" : "l-card l-muted")
            }
            style={filter === f ? { background: "var(--l-ink)", color: "#fff" } : undefined}
          >
            {f}
          </button>
        ))}
      </div>

      {isPending ? (
        <div className="l-card px-4 py-10 text-center text-[13px] l-muted">Loading…</div>
      ) : clients.length === 0 ? (
        <div className="l-card px-4 py-10 text-center text-[13px] l-muted">
          No {filter} clients match that search.
        </div>
      ) : (
        <ul className="grid gap-3">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                to="/ledger/people/$clientId"
                params={{ clientId: c.id }}
                className="l-card block p-4"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <p className="truncate text-[16px] font-bold tracking-tight">{c.name}</p>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums l-muted">
                    {c.projectCount} project{c.projectCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] l-muted">
                  {c.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> {c.phone}
                    </span>
                  )}
                  {c.email && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <p className="truncate text-[12px] l-muted">
                    {c.nextAction ? `Next: ${c.nextAction}` : "No next action"}
                  </p>
                  {c.lastActivityAt && (
                    <span className="shrink-0 text-[11px] tabular-nums l-muted">
                      {relativeTime(c.lastActivityAt)}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </LedgerShell>
  );
}
