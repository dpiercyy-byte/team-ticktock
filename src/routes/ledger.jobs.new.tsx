import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { listClients } from "@/lib/os/clients.functions";
import { createJob } from "@/lib/os/jobs.functions";
import { PROJECT_TYPES, TRADES, STATUSES } from "@/lib/os/constants";
import { getAdminToken } from "@/lib/session";

export const Route = createFileRoute("/ledger/jobs/new")({
  head: () => ({
    meta: [
      { title: "New Job — Clockwise OS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewJob,
});

type Draft = {
  clientId: string | null;
  newClientName: string;
  address: string;
  projectType: string;
  trades: string[];
  status: string;
};

const STEPS = ["Client", "Address", "Project", "Trades", "Status"] as const;

function NewJob() {
  const token = getAdminToken();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    clientId: null,
    newClientName: "",
    address: "",
    projectType: "",
    trades: [],
    status: "lead",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["os-clients"],
    queryFn: () => listClients({ data: { token: token! } }),
    enabled: !!token,
  });

  const create = useMutation({
    mutationFn: () =>
      createJob({
        data: {
          token: token!,
          client_id: draft.clientId,
          new_client_name: draft.newClientName || undefined,
          address: draft.address,
          project_type: draft.projectType,
          trades: draft.trades,
          status: draft.status,
        },
      }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ["os-jobs"] });
      qc.invalidateQueries({ queryKey: ["os-briefing"] });
      toast.success("Job created");
      navigate({ to: "/ledger/jobs/$jobId", params: { jobId: id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create job"),
  });

  if (!token) return <div className="mt-16 text-center text-sm text-slate-500">Sign in required.</div>;

  const canAdvance = [
    !!draft.clientId || draft.newClientName.trim().length > 0,
    draft.address.trim().length > 0,
    draft.projectType.length > 0,
    true, // trades optional
    draft.status.length > 0,
  ][step];

  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-lg pt-4">
      {/* Progress dots */}
      <div className="mb-8 flex items-center gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-slate-900" : "bg-slate-200"}`}
          />
        ))}
      </div>

      <div className="min-h-[420px]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1
          className="mt-2 text-[30px] font-semibold text-slate-900"
          style={{ fontFamily: '"Bricolage Grotesque", serif', letterSpacing: "-0.035em" }}
        >
          {stepTitle(step)}
        </h1>
        <p className="mt-1 text-[15px] text-slate-500">{stepHint(step)}</p>

        <div className="mt-8">
          {step === 0 && (
            <div className="space-y-3">
              <input
                autoFocus
                placeholder="New client name"
                value={draft.newClientName}
                onChange={(e) => setDraft({ ...draft, newClientName: e.target.value, clientId: null })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base outline-none focus:border-slate-900"
              />
              {clients.length > 0 && (
                <>
                  <div className="flex items-center gap-3 py-2">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs text-slate-400">or existing</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {clients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setDraft({ ...draft, clientId: c.id, newClientName: "" })}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                          draft.clientId === c.id
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-sm font-medium">{c.name}</span>
                        {draft.clientId === c.id && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 1 && (
            <input
              autoFocus
              placeholder="123 Main St, City"
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base outline-none focus:border-slate-900"
            />
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-2.5">
              {PROJECT_TYPES.map((p) => (
                <button
                  key={p}
                  onClick={() => setDraft({ ...draft, projectType: p })}
                  className={`rounded-2xl border px-4 py-5 text-sm font-semibold transition-all ${
                    draft.projectType === p
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-wrap gap-2">
              {TRADES.map((t) => {
                const on = draft.trades.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        trades: on ? draft.trades.filter((x) => x !== t) : [...draft.trades, t],
                      })
                    }
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      on
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setDraft({ ...draft, status: s.id })}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition-colors ${
                    draft.status === s.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  }`}
                >
                  <span className="text-sm font-medium">{s.label}</span>
                  {draft.status === s.id && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        {step > 0 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="inline-flex items-center gap-1 rounded-full px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          <span />
        )}
        <button
          disabled={!canAdvance || create.isPending}
          onClick={() => {
            if (isLast) create.mutate();
            else setStep(step + 1);
          }}
          className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-40"
        >
          {isLast ? (create.isPending ? "Creating…" : "Finish") : "Continue"}
          {!isLast && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function stepTitle(i: number) {
  return ["Who is the client?", "Where is the property?", "What kind of project?", "Which trades?", "Where does it stand?"][i];
}
function stepHint(i: number) {
  return [
    "Type a new name or pick someone you've worked with.",
    "Full street address.",
    "Pick one. You can change it later.",
    "Tap any that apply. Skip if unsure.",
    "This drives your home screen.",
  ][i];
}
