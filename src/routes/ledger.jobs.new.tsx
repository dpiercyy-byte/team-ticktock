import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, MapPin, User, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { ledgerJobsQuery } from "@/lib/ledger-client";
import {
  createLedgerJob, LEDGER_PROJECT_TYPES, LEDGER_STATUSES, LEDGER_TRADES,
  type LedgerProjectType, type LedgerStatus, type LedgerTrade,
} from "@/lib/ledger.functions";
import { getAdminToken } from "@/lib/session";

export const Route = createFileRoute("/ledger/jobs/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New job — Ledger" },
      { name: "description", content: "One decision per screen. Set up a new job in under a minute." },
      { property: "og:title", content: "New job — Ledger" },
      { property: "og:description", content: "One decision per screen." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerJobsQuery());
  },
  component: NewJob,
});

type Step = 1 | 2 | 3 | 4 | 5;

function NewJob() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: existingJobs } = useSuspenseQuery(ledgerJobsQuery());
  const create = useServerFn(createLedgerJob);

  const [step, setStep] = useState<Step>(1);
  const [clientMode, setClientMode] = useState<"existing" | "new" | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [address, setAddress] = useState("");
  const [projectType, setProjectType] = useState<LedgerProjectType | null>(null);
  const [trades, setTrades] = useState<LedgerTrade[]>([]);
  const [status, setStatus] = useState<LedgerStatus | null>(null);

  const existingClients = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string | null; email?: string | null }>();
    existingJobs.forEach((j) => map.set(j.client.name, j.client));
    return [...map.values()];
  }, [existingJobs]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return create({
        data: {
          token,
          clientName: clientName.trim(),
          clientPhone: clientPhone || null,
          clientEmail: clientEmail || null,
          address: address.trim(),
          projectType: projectType!,
          trades,
          status: status!,
        },
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ledger", "jobs"] });
      navigate({ to: "/ledger/jobs/$jobId", params: { jobId: res.job.id } });
    },
  });

  const canNext =
    (step === 1 && clientName.trim().length > 0) ||
    (step === 2 && address.trim().length > 0) ||
    (step === 3 && projectType !== null) ||
    (step === 4 && trades.length > 0) ||
    (step === 5 && status !== null);

  function next() {
    if (!canNext) return;
    if (step === 5) { createMutation.mutate(); return; }
    setStep((s) => ((s + 1) as Step));
  }
  function back() {
    if (step === 1) { navigate({ to: "/ledger/jobs" }); return; }
    setStep((s) => ((s - 1) as Step));
  }

  return (
    <LedgerShell>
      <div className="mb-6 flex items-center justify-between">
        <button onClick={back} className="inline-flex items-center gap-1.5 text-sm font-medium l-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <span className="text-xs font-medium l-muted tabular-nums">Step {step} of 5</span>
      </div>

      <div className="mb-8 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }} />
      </div>

      {step === 1 && (
        <StepShell title="Who is this job for?" subtitle="Choose the client to attach this job to.">
          {clientMode === null && (
            <div className="grid gap-3">
              <BigChoice
                icon={<User className="h-5 w-5" />}
                title="Existing client"
                subtitle={existingClients.length ? `${existingClients.length} on file` : "None on file yet"}
                onClick={() => setClientMode("existing")}
                disabled={existingClients.length === 0}
              />
              <BigChoice
                icon={<UserPlus className="h-5 w-5" />}
                title="New client"
                subtitle="Add their name and contact"
                onClick={() => { setClientMode("new"); setClientName(""); }}
              />
            </div>
          )}

          {clientMode === "existing" && (
            <div className="grid gap-2">
              {existingClients.map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    setClientName(c.name);
                    setClientPhone(c.phone ?? "");
                    setClientEmail(c.email ?? "");
                  }}
                  className={
                    "flex items-center justify-between rounded-2xl border bg-card px-4 py-4 text-left shadow-[var(--shadow-card)] transition-colors " +
                    (clientName === c.name ? "border-primary" : "border-border hover:bg-secondary/60")
                  }
                >
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.phone && <p className="text-xs l-muted">{c.phone}</p>}
                  </div>
                  {clientName === c.name && <Check className="h-5 w-5 text-primary" />}
                </button>
              ))}
              <button onClick={() => setClientMode(null)} className="mt-2 text-xs l-muted hover:text-foreground">
                ← Choose different option
              </button>
            </div>
          )}

          {clientMode === "new" && (
            <div className="grid gap-3">
              <Field label="Full name">
                <input autoFocus value={clientName} onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Sarah Whitfield" className="w-full bg-transparent text-base outline-none placeholder:l-muted" />
              </Field>
              <Field label="Phone (optional)">
                <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(555) 000-0000" className="w-full bg-transparent text-base outline-none placeholder:l-muted" />
              </Field>
              <Field label="Email (optional)">
                <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="sarah@example.com" className="w-full bg-transparent text-base outline-none placeholder:l-muted" />
              </Field>
              <button onClick={() => setClientMode(null)} className="mt-1 text-xs l-muted hover:text-foreground">
                ← Choose different option
              </button>
            </div>
          )}
        </StepShell>
      )}

      {step === 2 && (
        <StepShell title="Where is the property?" subtitle="Type the address of the job site.">
          <Field label="Property address" icon={<MapPin className="h-4 w-4 l-muted" />}>
            <input autoFocus value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Rosewood Ave, Ottawa, ON"
              className="w-full bg-transparent text-base outline-none placeholder:l-muted" />
          </Field>
        </StepShell>
      )}

      {step === 3 && (
        <StepShell title="What kind of project?" subtitle="Pick the project type.">
          <div className="grid grid-cols-2 gap-3">
            {LEDGER_PROJECT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setProjectType(t)}
                className={
                  "rounded-2xl border px-4 py-6 text-left text-sm font-medium transition-all " +
                  (projectType === t
                    ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                    : "border-border bg-card hover:border-primary/40")
                }
              >
                {t}
              </button>
            ))}
          </div>
        </StepShell>
      )}

      {step === 4 && (
        <StepShell title="Which trades are involved?" subtitle="Tap all that apply. You can change these later.">
          <div className="flex flex-wrap gap-2">
            {LEDGER_TRADES.map((t) => {
              const on = trades.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => setTrades((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                  className={
                    "l-pill transition-all " +
                    (on ? "bg-primary text-primary-foreground" : "l-pill--raised")
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>

          {trades.length > 0 && (
            <p className="mt-4 text-xs l-muted">
              {trades.length} trade{trades.length === 1 ? "" : "s"} selected
            </p>
          )}
        </StepShell>
      )}

      {step === 5 && (
        <StepShell title="Where does this job stand?" subtitle="Set the current status.">
          <div className="grid gap-2">
            {LEDGER_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={
                  "flex items-center justify-between rounded-2xl border px-4 py-4 text-left text-sm font-medium transition-colors " +
                  (status === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-secondary/60")
                }
              >
                {s}
                {status === s && <Check className="h-5 w-5" />}
              </button>
            ))}
          </div>
        </StepShell>
      )}

      {createMutation.isError && (
        <p className="mt-4 text-center text-xs text-destructive">
          Failed to create job. Make sure you're signed in as admin.
        </p>
      )}

      <div className="mt-6 text-center">
        <Link to="/ledger/jobs" className="text-xs l-muted hover:text-foreground">
          Cancel
        </Link>
      </div>

      {/* spacer for the fixed footer */}
      <div className="h-28" />

      <div className="l-wizard-footer">
        <div className="mx-auto w-full max-w-3xl px-5 py-3 md:px-8">
          <button
            onClick={next}
            disabled={!canNext || createMutation.isPending}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            {step === 5 ? (createMutation.isPending ? "Saving…" : "Finish") : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </LedgerShell>

  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-2 text-sm l-muted md:text-base">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block l-card px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider l-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function BigChoice({
  icon, title, subtitle, onClick, disabled,
}: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-4 l-card p-5 text-left transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40"
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-foreground">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="block text-xs l-muted">{subtitle}</span>
      </span>
      <ArrowRight className="h-5 w-5 l-muted" />
    </button>
  );
}
