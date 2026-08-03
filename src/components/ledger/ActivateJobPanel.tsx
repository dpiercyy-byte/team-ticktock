import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, MapPin, ShieldCheck, UserPlus, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  activateProjectFn,
  assignProjectCrew,
  geocodeForActivation,
  getActivationPreview,
  removeProjectCrew,
} from "@/lib/activation.functions";
import { listWorkersAdmin } from "@/lib/workers.functions";
import { getAdminToken } from "@/lib/session";
import { formatCurrency } from "@/components/ledger/ledger-ui";

const TOTAL = 7;

export function ActivateJobPanel({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const preview = useServerFn(getActivationPreview);
  const token = getAdminToken();

  const { data } = useQuery({
    queryKey: ["ledger", "activation", jobId],
    queryFn: async () => preview({ data: { token: token as string, projectId: jobId } }),
    enabled: Boolean(token),
    staleTime: 15_000,
  });

  if (!data) return null;
  const { project, site, crew } = data;
  if (project.salesStage !== "Won") return null;

  return (
    <section className="mt-3">
      {project.activatedAt ? (
        <ActiveBlock site={site} project={project} />
      ) : (
        <ActivationWizard
          jobId={jobId}
          project={project}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["ledger", "activation", jobId] });
            qc.invalidateQueries({ queryKey: ["ledger", "jobs", jobId] });
            qc.invalidateQueries({ queryKey: ["ledger", "jobs"] });
          }}
        />
      )}
      {project.activatedAt && <Crew jobId={jobId} crew={crew} />}
    </section>
  );
}

function ActiveBlock({
  site,
  project,
}: {
  site: { label: string; address: string; radius_m: number } | null;
  project: { activatedAt: string | null; deliveryStatus: string | null };
}) {
  return (
    <div className="l-card p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 l-green" />
        <p className="l-eyebrow">Active in Clockwise</p>
      </div>
      {site ? (
        <>
          <p className="mt-2 text-[14px] font-semibold">{site.label}</p>
          <p className="text-[12px] l-muted">{site.address}</p>
          <p className="mt-1 text-[12px] l-muted">
            {site.radius_m} m geofence · {project.deliveryStatus ?? "Preconstruction"}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[13px] l-muted">
          This job is activated but has no active site connected.
        </p>
      )}
    </div>
  );
}

type PreviewProject = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  propertyId: string | null;
  propertyAddress: string | null;
  propertyLat: number | null;
  propertyLng: number | null;
  address: string | null;
  contractValue: number;
  estimatedValue: number;
  expectedStartDate: string | null;
  name: string;
};

function ActivationWizard({
  jobId,
  project,
  onDone,
}: {
  jobId: string;
  project: PreviewProject;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [contract, setContract] = useState(
    String(project.contractValue || project.estimatedValue || ""),
  );
  const [address, setAddress] = useState(project.propertyAddress ?? project.address ?? "");
  const [lat, setLat] = useState<number | null>(project.propertyLat);
  const [lng, setLng] = useState<number | null>(project.propertyLng);
  const [radius, setRadius] = useState(250);
  const [startDate, setStartDate] = useState(project.expectedStartDate ?? "");

  const geocode = useServerFn(geocodeForActivation);
  const activate = useServerFn(activateProjectFn);

  const geoMutation = useMutation({
    mutationFn: async () => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return geocode({ data: { token, address } });
    },
    onSuccess: (res) => {
      setLat(res.lat);
      setLng(res.lng);
      setAddress(res.formatted);
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      if (!project.clientId) throw new Error("Project has no client");
      if (lat == null || lng == null) throw new Error("Confirm the geofence location first");
      return activate({
        data: {
          token,
          projectId: jobId,
          clientId: project.clientId,
          propertyId: project.propertyId,
          contractValue: Number(contract) || 0,
          address,
          lat,
          lng,
          radiusM: radius,
          expectedStartDate: startDate || null,
          label: project.name,
        },
      });
    },
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
  });

  useEffect(() => {
    if (open && step === 4 && lat == null && address.trim().length > 3 && !geoMutation.isPending) {
      geoMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[14px] font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-all active:scale-[0.99]"
      >
        <ShieldCheck className="h-4 w-4" /> Activate job
      </button>
    );
  }

  const canNext = (() => {
    switch (step) {
      case 1:
        return Boolean(project.clientId);
      case 3:
        return Number(contract) > 0;
      case 4:
        return lat != null && lng != null;
      case 5:
        return radius >= 25 && radius <= 2000;
      default:
        return true;
    }
  })();

  const next = () => {
    if (step === TOTAL) activateMutation.mutate();
    else setStep((s) => s + 1);
  };

  return (
    <div className="l-card p-4">
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="l-eyebrow truncate">Activate job · step {step} of {TOTAL}</p>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="shrink-0 l-muted">
          <X className="h-4 w-4" />
        </button>
      </div>

      {step === 1 && (
        <Step title="Confirm the client">
          <p className="text-[15px] font-semibold">{project.clientName ?? "No client linked"}</p>
          {!project.clientId && (
            <p className="mt-1 text-[12px] l-red">Link a client to this project before activating.</p>
          )}
        </Step>
      )}

      {step === 2 && (
        <Step title="Confirm the property">
          <p className="text-[15px] font-semibold">{project.propertyAddress ?? project.address}</p>
        </Step>
      )}

      {step === 3 && (
        <Step title="Confirm the accepted contract value">
          <Field label="Contract value">
            <input
              inputMode="decimal"
              value={contract}
              onChange={(e) => setContract(e.target.value)}
              className="w-full bg-transparent text-base outline-none"
            />
          </Field>
          <p className="mt-2 text-[12px] l-muted">{formatCurrency(Number(contract) || 0)}</p>
        </Step>
      )}

      {step === 4 && (
        <Step title="Confirm the geofence location">
          <Field label="Address" icon={<MapPin className="h-4 w-4 l-muted" />}>
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setLat(null);
                setLng(null);
              }}
              className="w-full bg-transparent text-base outline-none"
            />
          </Field>
          <button
            type="button"
            onClick={() => geoMutation.mutate()}
            disabled={geoMutation.isPending || address.trim().length < 3}
            className="mt-3 rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-50"
            style={{ background: "var(--l-surface-2)" }}
          >
            {geoMutation.isPending ? "Locating…" : "Verify location"}
          </button>
          {lat != null && lng != null && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] l-green">
              <Check className="h-3.5 w-3.5" /> {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          )}
          {geoMutation.isError && (
            <p className="mt-2 text-[12px] l-red">Could not locate that address.</p>
          )}
        </Step>
      )}

      {step === 5 && (
        <Step title="Confirm the geofence radius">
          <div className="flex flex-wrap gap-2">
            {[100, 150, 250, 500].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                className="l-pill"
                style={
                  radius === r
                    ? { background: "var(--l-accent)", color: "var(--l-on-ink)" }
                    : undefined
                }
              >
                {r} m
              </button>
            ))}
          </div>
        </Step>
      )}

      {step === 6 && (
        <Step title="Confirm the expected start date">
          <Field label="Expected start">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-transparent text-base outline-none"
            />
          </Field>
        </Step>
      )}

      {step === 7 && (
        <Step title="Review & activate">
          <ul className="grid gap-1.5 text-[13px]">
            <Row k="Client" v={project.clientName ?? "—"} />
            <Row k="Property" v={project.propertyAddress ?? project.address ?? "—"} />
            <Row k="Contract" v={formatCurrency(Number(contract) || 0)} />
            <Row k="Geofence" v={address} />
            <Row k="Radius" v={`${radius} m`} />
            <Row k="Start" v={startDate || "Not set"} />
          </ul>
          <p className="mt-3 text-[12px] l-muted">
            This connects the project to a Clockwise client site and moves delivery to
            Preconstruction. Workers clock in exactly as they do today.
          </p>
        </Step>
      )}

      {activateMutation.isError && (
        <p className="mt-3 text-[12px] l-red">
          {(activateMutation.error as Error)?.message ?? "Could not activate this job."}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="rounded-full px-4 py-2 text-[12px] font-bold"
            style={{ background: "var(--l-surface-2)" }}
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={!canNext || activateMutation.isPending}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-[14px] font-semibold text-primary-foreground disabled:opacity-40"
        >
          {step === TOTAL
            ? activateMutation.isPending
              ? "Activating…"
              : "Activate job"
            : "Continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

type CrewMember = {
  id: string;
  workerId: string;
  workerName: string | null;
  role: string | null;
  isActive: boolean;
};

function Crew({ jobId, crew }: { jobId: string; crew: CrewMember[] }) {
  const qc = useQueryClient();
  const assign = useServerFn(assignProjectCrew);
  const remove = useServerFn(removeProjectCrew);
  const listWorkers = useServerFn(listWorkersAdmin);
  const token = getAdminToken();
  const [adding, setAdding] = useState(false);
  const [role, setRole] = useState("");

  const { data: workers } = useQuery({
    queryKey: ["admin", "workers", "crew-picker"],
    queryFn: async () => listWorkersAdmin ? listWorkers({ data: { token: token as string } }) : null,
    enabled: Boolean(token) && adding,
    staleTime: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ledger", "activation", jobId] });

  const addMutation = useMutation({
    mutationFn: async (workerId: string) =>
      assign({ data: { token: token as string, projectId: jobId, workerId, role: role.trim() || null } }),
    onSuccess: () => {
      setAdding(false);
      setRole("");
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (workerId: string) =>
      remove({ data: { token: token as string, projectId: jobId, workerId } }),
    onSuccess: invalidate,
  });

  const active = crew.filter((c) => c.isActive);
  const assignedIds = new Set(active.map((c) => c.workerId));

  return (
    <div className="l-card mt-3 p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="l-eyebrow truncate">Crew</p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold l-accent"
        >
          <UserPlus className="h-3.5 w-3.5" /> {adding ? "Cancel" : "Assign"}
        </button>
      </div>

      {active.length === 0 && !adding && (
        <p className="mt-2 text-[13px] l-muted">Nobody assigned yet.</p>
      )}

      {active.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {active.map((c) => (
            <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="min-w-0 truncate text-[13px] font-semibold">
                {c.workerName ?? "Worker"}
                {c.role ? <span className="font-normal l-muted"> · {c.role}</span> : null}
              </span>
              <button
                type="button"
                aria-label={`Remove ${c.workerName ?? "worker"}`}
                onClick={() => removeMutation.mutate(c.workerId)}
                className="shrink-0 l-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-3">
          <Field label="Role (optional)">
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Lead carpenter"
              className="w-full bg-transparent text-base outline-none placeholder:l-muted"
            />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            {(workers?.workers ?? [])
              .filter((w: { id: string }) => !assignedIds.has(w.id))
              .map((w: { id: string; name: string }) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => addMutation.mutate(w.id)}
                  className="l-pill"
                >
                  {w.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-[16px] font-semibold tracking-tight">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <label className="block rounded-2xl px-4 py-3" style={{ background: "var(--l-surface-2)" }}>
      <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] l-muted">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <span className="l-muted">{k}</span>
      <span className="truncate text-right font-semibold">{v}</span>
    </li>
  );
}
