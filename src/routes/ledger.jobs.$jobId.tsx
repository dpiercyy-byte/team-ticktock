import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, Plus, MapPin } from "lucide-react";
import { toast } from "sonner";
import { getJob, updateJob } from "@/lib/os/jobs.functions";
import { listJobEvents, addJobEvent } from "@/lib/os/events.functions";
import { getAdminToken } from "@/lib/session";
import { STATUSES, statusMeta, formatMoney } from "@/lib/os/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/ledger/jobs/$jobId")({
  head: () => ({
    meta: [
      { title: "Job — Clockwise OS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const token = getAdminToken();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ["os-job", jobId],
    queryFn: () => getJob({ data: { token: token!, id: jobId } }),
    enabled: !!token,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["os-job-events", jobId],
    queryFn: () => listJobEvents({ data: { token: token!, job_id: jobId } }),
    enabled: !!token,
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => updateJob({ data: { token: token!, id: jobId, patch: { status } } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["os-job", jobId] });
      qc.invalidateQueries({ queryKey: ["os-job-events", jobId] });
      qc.invalidateQueries({ queryKey: ["os-briefing"] });
    },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evBody, setEvBody] = useState("");

  const addEvent = useMutation({
    mutationFn: () =>
      addJobEvent({ data: { token: token!, job_id: jobId, title: evTitle.trim(), body: evBody.trim() || undefined } }),
    onSuccess: () => {
      setEvTitle("");
      setEvBody("");
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["os-job-events", jobId] });
      toast.success("Added to timeline");
    },
  });

  if (!token) return <div className="mt-16 text-center text-sm text-slate-500">Sign in required.</div>;
  if (isLoading || !job) return <div className="mt-16 text-center text-sm text-slate-400">Loading…</div>;

  const profit = job.collected_cents - job.expenses_cents;
  const meta = statusMeta(job.status);

  return (
    <div className="pt-2">
      <button
        onClick={() => navigate({ to: "/ledger/jobs" })}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" /> All jobs
      </button>

      <header className="rounded-3xl border border-slate-200/80 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-[28px] leading-tight font-semibold text-slate-900"
              style={{ fontFamily: '"Bricolage Grotesque", serif', letterSpacing: "-0.035em" }}
            >
              {job.name}
            </h1>
            {job.client_name && <p className="mt-1 text-sm text-slate-500">{job.client_name}</p>}
            {job.address && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400">
                <MapPin className="h-3 w-3" /> {job.address}
              </p>
            )}
          </div>
          <select
            value={job.status}
            onChange={(e) => setStatus.mutate(e.target.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide outline-none ${meta.tone}`}
          >
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
            <span>Progress</span>
            <span className="font-semibold text-slate-900">{job.progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-900" style={{ width: `${job.progress}%` }} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Budget" value={formatMoney(job.budget_cents)} />
          <Stat label="Collected" value={formatMoney(job.collected_cents)} tone="text-emerald-600" />
          <Stat label="Expenses" value={formatMoney(job.expenses_cents)} tone="text-rose-600" />
          <Stat label="Profit" value={formatMoney(profit)} tone={profit >= 0 ? "text-slate-900" : "text-rose-600"} />
        </div>

        {job.trades.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {job.trades.map((t) => (
              <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                {t}
              </span>
            ))}
          </div>
        )}
      </header>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">Timeline</h2>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Add event
          </button>
        </div>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 px-4 py-10 text-center text-xs text-slate-400">
            No activity yet.
          </div>
        ) : (
          <ol className="relative space-y-3 border-l border-slate-200 pl-5">
            {events.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[26px] top-3 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-900" />
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{ev.title}</p>
                    <time className="shrink-0 text-[11px] text-slate-400">
                      {new Date(ev.occurred_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  {ev.body && <p className="mt-1 text-sm text-slate-500">{ev.body}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to timeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title (e.g. Deposit received)" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} />
            <Textarea placeholder="Notes (optional)" value={evBody} onChange={(e) => setEvBody(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addEvent.mutate()}
              disabled={!evTitle.trim() || addEvent.isPending}
            >
              {addEvent.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone = "text-slate-900" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
    </div>
  );
}
