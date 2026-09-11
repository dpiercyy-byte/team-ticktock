import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Plus, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LeadCard } from "@/components/ledger/LeadCard";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { Button } from "@/components/ui/button";
import { metaLeadsQuery } from "@/lib/meta-leads-client";
import { syncAllMetaLeads } from "@/lib/meta-leads.functions";
import { LEAD_STAGES } from "@/lib/meta-leads";
import { getAdminToken } from "@/lib/session";
export const Route = createFileRoute("/ledger/leads/")({ ssr: false, head: () => ({ meta: [{ title: "Leads — Ledger" }, { name: "description", content: "Review, qualify and follow up with new project leads." }, { property: "og:title", content: "Leads — Ledger" }, { property: "og:description", content: "Review and manage incoming project leads." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), loader: ({ context }) => context.queryClient.ensureQueryData(metaLeadsQuery()), component: LeadsPage });
function LeadsPage() {
  const { data } = useSuspenseQuery(metaLeadsQuery()); const qc = useQueryClient(); const sync = useServerFn(syncAllMetaLeads); const [query, setQuery] = useState(""); const [stage, setStage] = useState<string>("New");
  const syncing = useMutation({ mutationFn: async () => { const token = getAdminToken(); if (!token) throw new Error("Admin required"); return sync({ data: { token } }); }, onSuccess: async (r) => { toast.success(`Imported ${r.imported} new lead${r.imported === 1 ? "" : "s"}`); await qc.invalidateQueries({ queryKey: ["meta-leads"] }); }, onError: (e: Error) => toast.error(e.message) });
  const visible = useMemo(() => data.leads.filter((l) => l.stage === stage).filter((l) => [l.clientName, l.address, l.phone, l.email, l.projectType].some((v) => String(v ?? "").toLowerCase().includes(query.toLowerCase()))), [data.leads, query, stage]);
  return <LedgerShell><header className="mb-5 flex items-end justify-between gap-3"><div><p className="text-[13px] font-medium l-muted">{data.leads.length} imported leads</p><h1 className="mt-1 display text-[34px] leading-[1.05] md:text-[42px]">Leads</h1></div><div className="flex gap-2"><Button size="icon" variant="secondary" asChild aria-label="Lead import settings"><Link to="/ledger/leads/setup"><SlidersHorizontal/></Link></Button><Button size="icon" onClick={() => syncing.mutate()} disabled={syncing.isPending} aria-label="Sync leads"><RefreshCw className={syncing.isPending ? "animate-spin" : ""}/></Button></div></header>
    <label className="l-card sticky top-3 z-20 mb-4 flex items-center gap-2 px-4 py-3"><Search className="h-4 w-4 l-muted"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone or address" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label>
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 md:-mx-8 md:px-8">{LEAD_STAGES.map((s) => <Button key={s} size="sm" variant={stage === s ? "default" : "secondary"} onClick={() => setStage(s)} className="shrink-0 rounded-full">{s} <span className="opacity-60">{data.leads.filter((l) => l.stage === s).length}</span></Button>)}</div>
    <section className="mt-4 grid gap-3">{visible.map((lead) => <LeadCard key={lead.id} lead={lead}/>)}</section>
    {visible.length === 0 && <div className="l-card mt-4 px-6 py-14 text-center"><FileSpreadsheet className="mx-auto h-6 w-6 l-muted"/><p className="mt-3 text-sm l-muted">No matching leads in {stage}.</p></div>}
    <Button asChild className="fixed bottom-24 right-5 z-30 h-12 rounded-full px-5 shadow-lg"><Link to="/ledger/leads/new"><Plus/>Add lead</Link></Button>
  </LedgerShell>;
}
