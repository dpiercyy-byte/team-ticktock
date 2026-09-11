import { Link } from "@tanstack/react-router";
import { CalendarClock, MapPin, User } from "lucide-react";
import type { LeadStage } from "@/lib/meta-leads";
export type LeadCardData = { id: string; clientName: string; address: string | null; projectType: string | null; campaign: string | null; qualificationStatus: string; qualificationReasons: string[]; stage: LeadStage; assignedOwner: string | null; nextAction: string | null; nextActionDueAt: string | null; submittedAt: string | null; importedAt: string; archivedAt?: string | null };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((v) => v[0]?.toUpperCase()).join("") || "?";
const age = (date: string) => { const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)); return days === 0 ? "Today" : `${days}d ago`; };
export function LeadCard({ lead }: { lead: LeadCardData }) {
  const status = lead.qualificationStatus === "qualified" ? "Qualified" : lead.qualificationStatus === "rejected" ? "Rejected" : "Review";
  return <Link to="/ledger/leads/$leadId" params={{ leadId: lead.id }} className="l-card-cw block overflow-hidden">
    <article className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-[13px] font-extrabold">{initials(lead.clientName)}</span>
        <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate text-[16px] font-bold">{lead.clientName}</p><span className={`l-chip ${lead.qualificationStatus === "qualified" ? "l-s-active" : lead.qualificationStatus === "rejected" ? "text-destructive bg-destructive/10" : "l-s-approval"}`}>{status}</span></div><p className="mt-0.5 truncate text-[12px] l-muted">{lead.projectType || "Project type needed"}{lead.campaign ? ` · ${lead.campaign}` : ""}</p></div>
      </div>
      <div className="mt-3 grid gap-1.5 text-[12px] l-muted">
        <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0"/><span className="truncate">{lead.address || "Address needed"}</span></p>
        <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0"/>{lead.assignedOwner || "Unassigned"}<span>·</span>{age(lead.submittedAt ?? lead.importedAt)}</p>
        {lead.nextAction && <p className="flex items-center gap-1.5 text-foreground"><CalendarClock className="h-3.5 w-3.5 shrink-0"/><span className="truncate">{lead.nextAction}</span></p>}
      </div>
    </article>
    <div className="flex items-center justify-between border-t l-divider bg-muted/40 px-4 py-2.5 text-[11px] font-bold"><span>{lead.archivedAt ? "Archived" : lead.stage}</span><span className="l-muted">View lead</span></div>
  </Link>;
}
