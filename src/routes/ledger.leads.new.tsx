import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, MapPin } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { clientsDirectoryQuery } from "@/lib/crm-client";
import { createLead } from "@/lib/crm.functions";
import { LEDGER_PROJECT_TYPES } from "@/lib/ledger.functions";
import { getAdminToken } from "@/lib/session";

const LEAD_SOURCES = [
  "Referral",
  "Repeat client",
  "Website",
  "Google",
  "Social",
  "Sign / truck",
  "Other",
];

const TOTAL = 7;

export const Route = createFileRoute("/ledger/leads/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New lead — Ledger" },
      { name: "description", content: "Capture a new opportunity in under a minute." },
      { property: "og:title", content: "New lead — Ledger" },
      { property: "og:description", content: "One question at a time." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(clientsDirectoryQuery("", "active"));
  },
  component: NewLead,
});

function NewLead() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: clients } = useSuspenseQuery(clientsDirectoryQuery("", "active"));
  const submit = useServerFn(createLead);

  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [address, setAddress] = useState("");
  const [projectType, setProjectType] = useState<string | null>(null);
  const [leadSource, setLeadSource] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [dueAt, setDueAt] = useState("");

  const matches = useMemo(() => {
    const n = clientName.trim().toLowerCase();
    if (n.length < 2) return [];
    return clients.filter((c) => c.name.toLowerCase().includes(n)).slice(0, 4);
  }, [clients, clientName]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return submit({
        data: {
          token,
          clientName: clientName.trim(),
          clientPhone: phone.trim() || null,
          clientEmail: email.trim() || null,
          preferredContactMethod: contactMethod || null,
          address: address.trim(),
          projectType: projectType!,
          leadSource: leadSource,
          notes: notes.trim() || null,
          assignedOwner: owner.trim() || null,
          nextAction: nextAction.trim() || null,
          nextActionDueAt: dueAt || null,
        },
      });
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["crm"] });
      await qc.invalidateQueries({ queryKey: ["ledger", "jobs"] });
      navigate({ to: "/ledger/jobs/$jobId", params: { jobId: res.card.id } });
    },
  });

  const canNext =
    (step === 1 && clientName.trim().length > 0) ||
    step === 2 ||
    (step === 3 && address.trim().length > 0) ||
    (step === 4 && projectType !== null) ||
    step === 5 ||
    step === 6 ||
    step === 7;

  function next() {
    if (!canNext) return;
    if (step === TOTAL) {
      createMutation.mutate();
      return;
    }
    setStep((s) => s + 1);
  }
  function back() {
    if (step === 1) {
      navigate({ to: "/ledger/pipeline" });
      return;
    }
    setStep((s) => s - 1);
  }

  return (
    <LedgerShell>
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={back}
          className="inline-flex items-center gap-1.5 text-sm font-medium l-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <span className="text-xs font-medium tabular-nums l-muted">
          Step {step} of {TOTAL}
        </span>
      </div>

      <div className="mb-8 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${(step / TOTAL) * 100}%` }}
        />
      </div>

      {step === 1 && (
        <StepShell title="Who is the client?" subtitle="Just their name for now.">
          <Field label="Client name">
            <input
              autoFocus
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Sarah Whitfield"
              className="w-full bg-transparent text-base outline-none placeholder:l-muted"
            />
          </Field>
          {matches.length > 0 && (
            <div className="mt-3 grid gap-2">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wider l-muted">
                Existing clients
              </p>
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setClientName(c.name);
                    setPhone(c.phone ?? "");
                    setEmail(c.email ?? "");
                  }}
                  className="l-card flex items-center justify-between px-4 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    {c.phone && <span className="block text-xs l-muted">{c.phone}</span>}
                  </span>
                  {clientName === c.name && <Check className="h-4 w-4 shrink-0 l-green" />}
                </button>
              ))}
            </div>
          )}
        </StepShell>
      )}

      {step === 2 && (
        <StepShell title="How do we reach them?" subtitle="Optional, but it saves a call later.">
          <div className="grid gap-3">
            <Field label="Phone">
              <input
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="w-full bg-transparent text-base outline-none placeholder:l-muted"
              />
            </Field>
            <Field label="Email">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@example.com"
                className="w-full bg-transparent text-base outline-none placeholder:l-muted"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {["Phone", "Text", "Email"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setContactMethod(contactMethod === m ? "" : m)}
                  className={"l-pill " + (contactMethod === m ? "l-pill--raised" : "")}
                  style={
                    contactMethod === m
                      ? { background: "var(--l-ink)", color: "var(--l-on-ink)" }
                      : undefined
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </StepShell>
      )}

      {step === 3 && (
        <StepShell title="Where is the property?" subtitle="The address this work would happen at.">
          <Field label="Property address" icon={<MapPin className="h-4 w-4 l-muted" />}>
            <input
              autoFocus
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Rosewood Ave, Ottawa, ON"
              className="w-full bg-transparent text-base outline-none placeholder:l-muted"
            />
          </Field>
        </StepShell>
      )}

      {step === 4 && (
        <StepShell title="What kind of project?" subtitle="A rough category is enough.">
          <div className="grid grid-cols-2 gap-3">
            {LEDGER_PROJECT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setProjectType(t)}
                className={
                  "rounded-2xl border px-4 py-6 text-left text-sm font-medium transition-all " +
                  (projectType === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card")
                }
              >
                {t}
              </button>
            ))}
          </div>
        </StepShell>
      )}

      {step === 5 && (
        <StepShell title="Where did this lead come from?" subtitle="Helps you see what works.">
          <div className="grid gap-2">
            {LEAD_SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setLeadSource(leadSource === s ? null : s)}
                className={
                  "flex items-center justify-between rounded-2xl border px-4 py-4 text-left text-sm font-medium transition-colors " +
                  (leadSource === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card")
                }
              >
                {s}
                {leadSource === s && <Check className="h-5 w-5" />}
              </button>
            ))}
          </div>
        </StepShell>
      )}

      {step === 6 && (
        <StepShell title="Anything worth remembering?" subtitle="A sentence is plenty.">
          <label className="l-card block px-4 py-3">
            <textarea
              autoFocus
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Wants a quote before the end of the month…"
              className="w-full resize-none bg-transparent text-base outline-none placeholder:l-muted"
            />
          </label>
        </StepShell>
      )}

      {step === 7 && (
        <StepShell title="Who owns the next step?" subtitle="One action, one person, one date.">
          <div className="grid gap-3">
            <Field label="Assigned owner">
              <input
                autoFocus
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. Dave"
                className="w-full bg-transparent text-base outline-none placeholder:l-muted"
              />
            </Field>
            <Field label="Next action">
              <input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="Call to book a site visit"
                className="w-full bg-transparent text-base outline-none placeholder:l-muted"
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full bg-transparent text-base outline-none"
              />
            </Field>
          </div>
        </StepShell>
      )}

      {createMutation.isError && (
        <p className="mt-4 text-center text-xs text-destructive">
          Could not save this lead. Make sure you're signed in as admin.
        </p>
      )}

      <div className="mt-6 text-center">
        <Link to="/ledger/pipeline" className="text-xs l-muted">
          Cancel
        </Link>
      </div>

      <div className="h-28" />

      <div className="l-wizard-footer">
        <div className="mx-auto w-full max-w-3xl px-5 py-3 md:px-8">
          <button
            onClick={next}
            disabled={!canNext || createMutation.isPending}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            {step === TOTAL
              ? createMutation.isPending
                ? "Saving…"
                : "Save lead"
              : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </LedgerShell>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-2 text-sm l-muted md:text-base">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="l-card block px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider l-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}
