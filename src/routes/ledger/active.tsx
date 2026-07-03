import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCreateLedgerJob, useLedgerJobs, isAdminSession } from "@/lib/ledger-client";
import { JobCard } from "@/components/ledger/JobCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Search, Briefcase, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ledger/active")({
  component: LedgerActive,
});

function LedgerActive() {
  const { data, isLoading } = useLedgerJobs();
  const [q, setQ] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const admin = mounted && isAdminSession();

  const rows = useMemo(() => {
    const active = (data ?? []).filter((j) => !j.finish_date);
    if (!q.trim()) return active;
    const s = q.toLowerCase();
    return active.filter((j) => j.address.toLowerCase().includes(s) || (j.client_name || "").toLowerCase().includes(s));
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl md:text-3xl text-slate-900">Active Jobs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Projects still in progress</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search address or client" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 pill-card border-0 shadow-none" />
          </div>
          {admin && <NewJobButton />}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="pill-card p-10 text-center text-slate-500 flex flex-col items-center gap-3">
          <Briefcase className="w-8 h-8 text-slate-300" />
          <div>No active jobs yet.</div>
          {admin && <div className="text-xs">Click "New Job" above, or upload a spreadsheet from the Sync tab.</div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((j) => <JobCard key={j.id} job={j} />)}
        </div>
      )}
    </div>
  );
}

function NewJobButton() {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [client, setClient] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const create = useCreateLedgerJob();

  async function submit() {
    if (!address.trim()) { toast.error("Job name / address is required"); return; }
    try {
      await create.mutateAsync({
        address: address.trim(),
        client_name: client.trim() || null,
        start_date: startDate || null,
      });
      toast.success("Job created");
      setOpen(false);
      setAddress(""); setClient("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create job");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-1.5" /> New Job</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New active job</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Job name / address *</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Toronto" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Client (optional)</label>
            <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Start date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Create job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
