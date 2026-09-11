import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ArrowRight, Check, FileSpreadsheet, Plus, RefreshCw, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LeadCard } from "@/components/ledger/LeadCard";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { Button } from "@/components/ui/button";
import { metaLeadsQuery } from "@/lib/meta-leads-client";
import { convertMetaLead, syncAllMetaLeads, updateMetaLead } from "@/lib/meta-leads.functions";
import { LEAD_STAGES, type LeadStage } from "@/lib/meta-leads";
import { getAdminToken } from "@/lib/session";

export const Route = createFileRoute("/ledger/leads/")({ ssr: false, head: () => ({ meta: [{ title: "Leads — Ledger" }, { name: "description", content: "Review new leads and move them through New, Contacted, Quoted and Won." }, { property: "og:title", content: "Leads — Ledger" }, { property: "og:description", content: "A simple four-stage board for your project leads." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), loader: ({ context }) => context.queryClient.ensureQueryData(metaLeadsQuery()), component: LeadsPage });

function LeadsPage() {
  const { data, dataUpdatedAt } = useSuspenseQuery(metaLeadsQuery());
  const qc = useQueryClient();
  const sync = useServerFn(syncAllMetaLeads);
  const update = useServerFn(updateMetaLead);
  const convert = useServerFn(convertMetaLead);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LeadStage | "review" | "archived">("review");
  const token = () => { const t = getAdminToken(); if (!t) throw new Error("Admin required"); return t; };

  const refresh = () => qc.invalidateQueries({ queryKey: ["meta-leads"] });
  const syncing = useMutation({ mutationFn: async () => sync({ data: { token: token() } }), onSuccess: async (r) => { toast.success(`Imported ${r.imported} new lead${r.imported === 1 ? "" : "s"}`); await refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const move = useMutation({ mutationFn: async (input: { id: string; stage?: LeadStage; archived?: boolean; win?: boolean; qualified?: boolean }) => input.win ? convert({ data: { token: token(), id: input.id } }) : update({ data: { token: token(), id: input.id, ...(input.stage ? { stage: input.stage } : {}), ...(input.archived === undefined ? {} : { archived: input.archived }), ...(input.qualified === undefined ? {} : { qualificationStatus: input.qualified ? "qualified" : "rejected" }) } }), onSuccess: async () => { await refresh(); await qc.invalidateQueries({ queryKey: ["ledger", "jobs"] }); }, onError: (e: Error) => toast.error(e.message) });

  const active = useMemo(() => data.leads.filter((l) => !l.archivedAt), [data.leads]);
  const archived = useMemo(() => data.leads.filter((l) => l.archivedAt), [data.leads]);
  const needsReview = useMemo(() => active.filter((l) => l.qualificationStatus === "needs_review"), [active]);
  const matches = (l: { clientName: string; address: string | null; phone: string | null; email: string | null; projectType: string | null }) => [l.clientName, l.address, l.phone, l.email, l.projectType].some((v) => String(v ?? "").toLowerCase().includes(query.trim().toLowerCase()));
  const visible = useMemo(() => (filter === "archived" ? archived : filter === "review" ? needsReview : active.filter((l) => l.stage === filter)).filter(matches), [active, archived, needsReview, filter, query]);
  const nextStage = (s: LeadStage) => LEAD_STAGES[LEAD_STAGES.indexOf(s) + 1];

  return <LedgerShell>
    <header className="mb-5 flex items-end justify-between gap-3">
      <div><p className="text-[13px] font-medium l-muted">{needsReview.length} awaiting review{dataUpdatedAt ? ` · updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }` : ""}</p><h1 className="mt-1 display text-[34px] leading-[1.05] md:text-[42px]">Leads</h1></div>
      <div className="flex gap-2">
        <Button size="icon" variant="secondary" asChild aria-label="Lead import settings"><Link to="/ledger/leads/setup"><SlidersHorizontal/></Link></Button>
        <Button size="icon" onClick={() => syncing.mutate()} disabled={syncing.isPending} aria-label="Sync leads"><RefreshCw className={syncing.isPending ? "animate-spin" : ""}/></Button>
      </div>
    </header>

    <label className="l-card sticky top-3 z-20 mb-4 flex items-center gap-2 px-4 py-3"><Search className="h-4 w-4 l-muted"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone or address" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label>

    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 md:-mx-8 md:px-8">
      <Button size="sm" variant={filter === "review" ? "default" : "secondary"} onClick={() => setFilter("review")} className="shrink-0 rounded-full">Review <span className="opacity-60">{needsReview.length}</span></Button>
      {LEAD_STAGES.map((s) => <Button key={s} size="sm" variant={filter === s ? "default" : "secondary"} onClick={() => setFilter(s)} className="shrink-0 rounded-full">{s} <span className="opacity-60">{active.filter((l) => l.stage === s).length}</span></Button>)}
      <Button size="sm" variant={filter === "archived" ? "default" : "ghost"} onClick={() => setFilter("archived")} className="shrink-0 rounded-full"><Archive/>Archived <span className="opacity-60">{archived.length}</span></Button>
    </div>

    <section className="mt-4 grid gap-3">{visible.map((lead) => <div key={lead.id} className="grid gap-2">
      <LeadCard lead={lead}/>
      <div className="flex gap-2">
        {filter === "archived"
          ? <Button size="sm" variant="secondary" className="flex-1" disabled={move.isPending} onClick={() => move.mutate({ id: lead.id, archived: false })}><RotateCcw/>Restore</Button>
          : filter === "review"
            ? <>
              <Button size="sm" variant="secondary" className="flex-1" disabled={move.isPending} onClick={() => move.mutate({ id: lead.id, qualified: true, stage: "New" })}><Check/>Qualified</Button>
              <Button size="sm" variant="ghost" className="flex-1" disabled={move.isPending} onClick={() => move.mutate({ id: lead.id, qualified: false, archived: true })}><X/>Not a fit</Button>
            </>
            : <>
              {lead.stage !== "Won" && <Button size="sm" variant="secondary" className="flex-1" disabled={move.isPending} onClick={() => { const next = nextStage(lead.stage); if (!next) return; move.mutate(next === "Won" ? { id: lead.id, win: true } : { id: lead.id, stage: next }); }}>{nextStage(lead.stage)}<ArrowRight/></Button>}
              <Button size="sm" variant="ghost" className="flex-1" disabled={move.isPending} onClick={() => move.mutate({ id: lead.id, archived: true })}><Archive/>Archive</Button>
            </>}
      </div>
    </div>)}</section>

    {visible.length === 0 && <div className="l-card mt-4 px-6 py-14 text-center"><FileSpreadsheet className="mx-auto h-6 w-6 l-muted"/><p className="mt-3 text-sm l-muted">{filter === "archived" ? "Nothing archived." : filter === "review" ? "Nothing to review." : `No leads in ${filter}.`}</p></div>}

    <Button asChild className="fixed bottom-24 right-5 z-30 h-12 rounded-full px-5 shadow-lg"><Link to="/ledger/leads/new"><Plus/>Add lead</Link></Button>
  </LedgerShell>;
}
