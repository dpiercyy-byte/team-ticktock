import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Inbox, RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LeadCard } from "@/components/ledger/LeadCard";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { Button } from "@/components/ui/button";
import { metaLeadsQuery } from "@/lib/meta-leads-client";
import { syncAllMetaLeads, updateMetaLead } from "@/lib/meta-leads.functions";
import { getAdminToken } from "@/lib/session";

export const Route = createFileRoute("/ledger/leads/inbox")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lead Inbox — Ledger" },
      { name: "description", content: "Live feed of incoming Meta leads with qualification status and one-tap decisions." },
      { property: "og:title", content: "Lead Inbox — Ledger" },
      { property: "og:description", content: "Review incoming Meta leads and mark them qualified or not a fit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadInboxPage,
});

const FILTERS = [
  { key: "needs_review", label: "Needs review" },
  { key: "qualified", label: "Qualified" },
  { key: "rejected", label: "Not a fit" },
  { key: "all", label: "All" },
] as const;

function LeadInboxPage() {
  const token = () => {
    const value = getAdminToken();
    if (!value) throw new Error("Admin required");
    return value;
  };
  const { data, isLoading, dataUpdatedAt } = useQuery({ ...metaLeadsQuery(), refetchInterval: 30_000, refetchOnWindowFocus: true });
  const qc = useQueryClient();
  const sync = useServerFn(syncAllMetaLeads);
  const update = useServerFn(updateMetaLead);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("needs_review");

  const refresh = () => qc.invalidateQueries({ queryKey: ["meta-leads"] });

  const syncing = useMutation({
    mutationFn: async () => sync({ data: { token: token() } }),
    onSuccess: async (r) => {
      toast.success(`Imported ${r.imported} new lead${r.imported === 1 ? "" : "s"}`);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (input: { id: string; qualified: boolean }) =>
      update({
        data: {
          token: token(),
          id: input.id,
          qualificationStatus: input.qualified ? ("qualified" as const) : ("rejected" as const),
          ...(input.qualified ? { stage: "Qualified" as const } : { stage: "Lost" as const, lostReason: "Marked not a fit from the inbox" }),
        },
      }),
    onSuccess: async (_r, input) => {
      toast.success(input.qualified ? "Marked qualified" : "Marked not a fit");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leads = data?.leads ?? [];
  const counts = useMemo(
    () => ({
      needs_review: leads.filter((l) => l.qualificationStatus === "needs_review").length,
      qualified: leads.filter((l) => l.qualificationStatus === "qualified").length,
      rejected: leads.filter((l) => l.qualificationStatus === "rejected").length,
      all: leads.length,
    }),
    [leads],
  );

  const visible = useMemo(
    () =>
      leads
        .filter((l) => (filter === "all" ? true : l.qualificationStatus === filter))
        .filter((l) =>
          [l.clientName, l.address, l.phone, l.email, l.projectType].some((v) =>
            String(v ?? "").toLowerCase().includes(query.trim().toLowerCase()),
          ),
        ),
    [leads, filter, query],
  );

  return (
    <LedgerShell>
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium l-muted">
            {counts.needs_review} awaiting a decision
            {dataUpdatedAt ? ` · updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
          </p>
          <h1 className="mt-1 display text-[34px] leading-[1.05] md:text-[42px]">Lead Inbox</h1>
        </div>
        <Button size="icon" onClick={() => syncing.mutate()} disabled={syncing.isPending} aria-label="Sync leads now">
          <RefreshCw className={syncing.isPending ? "animate-spin" : ""} />
        </Button>
      </header>

      <label className="l-card sticky top-3 z-20 mb-4 flex items-center gap-2 px-4 py-3">
        <Search className="h-4 w-4 l-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone or address"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 md:-mx-8 md:px-8">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "secondary"}
            onClick={() => setFilter(f.key)}
            className="shrink-0 rounded-full"
          >
            {f.label} <span className="opacity-60">{counts[f.key]}</span>
          </Button>
        ))}
      </div>

      <section className="mt-4 grid gap-3">
        {visible.map((lead) => (
          <div key={lead.id} className="grid gap-2">
            <LeadCard lead={lead} />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                disabled={decide.isPending || lead.qualificationStatus === "qualified"}
                onClick={() => decide.mutate({ id: lead.id, qualified: true })}
              >
                <Check /> Qualified
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                disabled={decide.isPending || lead.qualificationStatus === "rejected"}
                onClick={() => decide.mutate({ id: lead.id, qualified: false })}
              >
                <X /> Not a fit
              </Button>
            </div>
          </div>
        ))}
      </section>

      {!isLoading && visible.length === 0 && (
        <div className="l-card mt-4 px-6 py-14 text-center">
          <Inbox className="mx-auto h-6 w-6 l-muted" />
          <p className="mt-3 text-sm l-muted">Nothing here right now.</p>
          <Link to="/ledger/leads/setup" className="mt-2 inline-block text-sm font-bold underline">
            Lead import settings
          </Link>
        </div>
      )}
    </LedgerShell>
  );
}
