import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SwipeableTabs, SwipeTabPanel } from "@/components/ui/swipeable-tabs";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";

import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AppSwitcherBar } from "@/components/AppSwitcherBar";
import {
  getCashExportSettingsFn,
  updateCashExportSettings,
  testCashExportFn,
} from "@/lib/cash-export.functions";
import {
  LogOut,
  Plus,
  Trash2,
  Pencil,
  Download,
  AlertTriangle,
  KeyRound,
  Paperclip,
  Upload,
  X,
  FileText,
  MapPin,
  MapPinOff,
  Archive,
  ArchiveRestore,
  Search,
  Truck,
  Building2,
  PowerOff,
  Sparkles,
  RefreshCw,
  Sheet,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Phone,
  Mail,
  Home as HomeIcon,
  User as UserIcon,
  ShieldAlert,
  ChevronDown,
  ArrowLeft,
  Clock,
  SlidersHorizontal,
  Split,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  parseReceipt,
  updateParsedReceipt,
  getSheetSettings,
  updateSheetSettings,
  backfillSheet,
  parseUnprocessed,
} from "@/lib/receipts.functions";
import { CameraFilePicker } from "@/components/CameraFilePicker";

import { adminLogin, adminVerify, adminChangePassword } from "@/lib/auth.functions";
import {
  listWorkersAdmin,
  createWorker,
  deleteWorker,
  setWorkerRate,
  setWorkerName,
  resetWorkerPin,
  updateWorkerProfile,
} from "@/lib/workers.functions";
import {
  adminListEntries,
  adminAddEntry,
  adminEditEntry,
  adminDeleteEntry,
  adminFlaggedEntries,
  adminUpdateEntryGeo,
  adminUpdateEntryPlannedJob,
  adminForceClockOut,
} from "@/lib/entries.functions";
import { AllocationDialog } from "@/components/admin/AllocationDialog";

import { getPublicSettings, updateSettings } from "@/lib/settings.functions";
import {
  getProjectSummaryExportSettings,
  updateProjectSummaryExportSettings,
  runProjectSummaryExportFn,
} from "@/lib/finance.functions";
import {
  getWorkerExportSettings,
  updateWorkerExportSettings,
  runWorkerSheetExportFn,
} from "@/lib/sheet-export.functions";
import {
  listReimbursements,
  addReimbursement,
  deleteReimbursement,
  uploadReceipt,
  listAllReceipts,
  adminAddStandaloneReceipt,
  updateStandaloneReceipt,
} from "@/lib/reimbursements.functions";
import {
  weeklyPayout,
  exportEntriesCsv,
  lifetimePayout,
  listPendingWeeks,
  markWeekPaid,
  unmarkWeekPaid,
} from "@/lib/payout.functions";
import {
  adminListJobSites,
  adminAddJobSite,
  adminUpdateJobSite,
  adminDeleteJobSite,
  adminArchiveJobSite,
  adminSetJobSiteCompleted,
  adminSearchPlaces,
  adminBulkAddJobSites,
} from "@/lib/jobsites.functions";
import { adminListAuditLog } from "@/lib/audit.functions";

import { getAdminToken, setAdminToken, clearAdminToken } from "@/lib/session";
import {
  fmtHours,
  fmtMoney,
  fmtTime,
  fmtDate,
  startOfWeekISO,
  diffHours,
  addDaysISO,
  weekRangeLabel,
  relativeWeekLabel,
} from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { isAcceptableUpload, prepareUpload, withRetry } from "@/lib/image-compress";

const INACTIVITY_MS = 30 * 60 * 1000;


export function AdminApp() {
  const [token, setTokenState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const verify = useServerFn(adminVerify);

  useEffect(() => {
    const t = getAdminToken();
    if (!t) {
      setHydrated(true);
      return;
    }
    verify({ data: { token: t } })
      .then((r) => {
        setAdminToken(r.token);
        setTokenState(r.token);
      })
      .catch(() => {
        clearAdminToken();
        setTokenState(null);
      })
      .finally(() => setHydrated(true));
  }, [verify]);

  // Prevent blank screen when a serverFn rejects with a Response (e.g. 401 session expired).
  useEffect(() => {
    const onRej = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      if (r instanceof Response && (r.status === 401 || r.status === 403)) {
        e.preventDefault();
        clearAdminToken();
        setTokenState(null);
        toast.info("Session expired. Please sign in again.");
      }
    };
    window.addEventListener("unhandledrejection", onRej);
    return () => window.removeEventListener("unhandledrejection", onRej);
  }, []);

  // Inactivity logout
  useEffect(() => {
    if (!token) return;
    let last = Date.now();
    const reset = () => {
      last = Date.now();
    };
    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset));
    const t = setInterval(() => {
      if (Date.now() - last > INACTIVITY_MS) {
        clearAdminToken();
        setTokenState(null);
        toast.info("Logged out due to inactivity");
      }
    }, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearInterval(t);
    };
  }, [token]);

  const updateToken = (newToken: string) => {
    setAdminToken(newToken);
    setTokenState(newToken);
  };

  if (!hydrated) return <div className="min-h-dvh bg-background" />;
  if (!token) return <AdminLogin onLogin={updateToken} />;
  return (
    <AdminDashboard
      token={token}
      updateToken={updateToken}
      onLogout={() => {
        clearAdminToken();
        setTokenState(null);
      }}
    />
  );
}

function AdminLogin({ onLogin }: { onLogin: (t: string) => void }) {
  const login = useServerFn(adminLogin);
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const m = useMutation({
    mutationFn: () => login({ data: { password: pw } }),
    onSuccess: (r) => {
      if (!r.ok || !r.token) {
        toast.error(r.error ?? "Invalid password");
        setPw("");
        return;
      }
      onLogin(r.token);
      navigate({ to: "/admin" });
    },
    onError: () => {
      toast.error("Invalid password");
      setPw("");
    },
  });
  return (
    <div className="min-h-dvh bg-muted/40 flex flex-col px-6 pt-16 pb-10">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col">
        <div className="text-center mb-12">
          <div
            className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full mb-5 shadow-sm"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Clock className="h-8 w-8 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Clockwise</h1>
          <p className="text-[15px] text-muted-foreground mt-1.5">Access management portal.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-8"
        >
          <div className="space-y-2">
            <Label htmlFor="pw" className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">
              Password
            </Label>
            <Input
              id="pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              placeholder="Enter admin password"
              className="h-[60px] rounded-2xl bg-background border border-border/60 px-4 text-base shadow-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40"
            />
          </div>
          <Button
            type="submit"
            style={{ background: "var(--gradient-primary)" }}
            className="w-full h-[60px] rounded-2xl text-base font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98] hover:opacity-95"
            disabled={m.isPending || !pw}
          >
            {m.isPending ? "Signing in…" : "Sign In"}
          </Button>
          <div className="text-center pt-2">
            <a
              href="/"
              className="inline-flex items-center gap-1 text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to worker app
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

const ADMIN_TABS = [
  "entries",
  "payouts",
  "receipts",
  "workers",
  "sites",
  "audit",
  "settings",
] as const;

function AdminDashboard({
  token,
  updateToken,
  onLogout,
}: {
  token: string;
  updateToken: (t: string) => void;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState("entries");
  return (
    <div className="min-h-dvh bg-background pb-[calc(env(safe-area-inset-bottom)+7.5rem)]">
      <AppSwitcherBar onLogout={onLogout} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-2 sm:pt-3">
        <SwipeableTabs tabs={[...ADMIN_TABS]} value={activeTab} onValueChange={setActiveTab}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>



            <SwipeTabPanel tabKey={activeTab} tabs={ADMIN_TABS}>
              <TabsContent value="entries">
                <EntriesTab token={token} updateToken={updateToken} />
              </TabsContent>
              <TabsContent value="payouts">
                <PayoutsTab token={token} updateToken={updateToken} />
              </TabsContent>
              <TabsContent value="receipts">
                <ReceiptsTab token={token} updateToken={updateToken} />
              </TabsContent>
              <TabsContent value="workers">
                <WorkersTab token={token} updateToken={updateToken} />
              </TabsContent>
              <TabsContent value="sites">
                <JobSitesTab token={token} updateToken={updateToken} />
              </TabsContent>
              <TabsContent value="audit">
                <AuditTab token={token} updateToken={updateToken} />
              </TabsContent>
              <TabsContent value="settings">
                <SettingsTab token={token} updateToken={updateToken} />
              </TabsContent>
            </SwipeTabPanel>
          </Tabs>
        </SwipeableTabs>
      </div>
      <AdminBottomNav value={activeTab} onValueChange={setActiveTab} />
    </div>
  );
}


// ===== Entries tab =====
function EntriesTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const listW = useServerFn(listWorkersAdmin);
  const listE = useServerFn(adminListEntries);
  const flagFn = useServerFn(adminFlaggedEntries);
  const addE = useServerFn(adminAddEntry);
  const editE = useServerFn(adminEditEntry);
  const delE = useServerFn(adminDeleteEntry);
  const forceOut = useServerFn(adminForceClockOut);
  const updGeo = useServerFn(adminUpdateEntryGeo);
  const updPlanned = useServerFn(adminUpdateEntryPlannedJob);
  const listPendingFn = useServerFn(listPendingWeeks);

  const listSites = useServerFn(adminListJobSites);
  const settingsFn = useServerFn(getPublicSettings);
  const qc = useQueryClient();

  const sitesQ = useQuery({
    queryKey: ["adm-jobsites"],
    queryFn: () =>
      listSites({ data: { token } }).then((r) => {
        updateToken(r.token);
        return r.sites;
      }),
  });

  const wq = useQuery({
    queryKey: ["adm-workers"],
    queryFn: () =>
      listW({ data: { token } }).then((r) => {
        updateToken(r.token);
        return r.workers;
      }),
  });
  const sq = useQuery({ queryKey: ["pub-settings"], queryFn: () => settingsFn() });
  const flagQ = useQuery({
    queryKey: ["flagged"],
    queryFn: () =>
      flagFn({ data: { token } }).then((r) => {
        updateToken(r.token);
        return r.entries;
      }),
  });

  const [workerId, setWorkerId] = useState<string | null>(null);
  useEffect(() => {
    if (!workerId && wq.data?.[0]) setWorkerId(wq.data[0].id);
  }, [wq.data, workerId]);

  const eq = useQuery({
    enabled: !!workerId,
    queryKey: ["entries", workerId],
    queryFn: () =>
      listE({ data: { token, workerId: workerId! } }).then((r) => {
        updateToken(r.token);
        return r.entries;
      }),
  });

  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [confirmForce, setConfirmForce] = useState<string | null>(null);
  const [allocating, setAllocating] = useState<any | null>(null);
  const [weekStart, setWeekStart] = useState<string>(() => startOfWeekISO());
  const [calOpen, setCalOpen] = useState(false);

  const projectsEnabled = sq.data?.project_tracking_enabled;

  const pendingQ = useQuery({
    enabled: !!token,
    queryKey: ["pending-payouts", "all"],
    queryFn: () =>
      listPendingFn({ data: { token, includePaid: true } }).then((r) => {
        updateToken(r.token);
        return r.items;
      }),
  });
  const weekRow =
    (pendingQ.data ?? []).find((r: any) => r.workerId === workerId && r.weekStart === weekStart) ??
    null;
  const weekStatus: "paid" | "unpaid" | "overdue" | null = weekRow?.status ?? null;

  // Filter entries to the selected week
  const weekStartTs = new Date(weekStart + "T00:00:00").getTime();
  const weekEndTs = weekStartTs + 7 * 86_400_000;
  const weekEntries = (eq.data ?? []).filter((e: any) => {
    const t = new Date(e.clock_in).getTime();
    return t >= weekStartTs && t < weekEndTs;
  });

  const weekHours = weekEntries.reduce(
    (s, e: any) => s + (e.clock_out ? diffHours(e.clock_in, e.clock_out) : 0),
    0,
  );
  const weekWages = weekRow?.wages ?? 0;
  const weekReimb = weekRow?.reimbursements ?? 0;
  const weekTotal = weekRow?.total ?? weekWages + weekReimb;

  // group entries by date
  const byDate = weekEntries.reduce<Record<string, any[]>>((acc, e) => {
    const k = new Date(e.clock_in).toDateString();
    (acc[k] ||= []).push(e);
    return acc;
  }, {});

  const statusStyles =
    weekStatus === "paid"
      ? {
          border: "border-l-[var(--success)]",
          tint: "bg-[color-mix(in_oklab,var(--success)_4%,transparent)]",
          pill: "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]",
          label: "Paid",
        }
      : weekStatus === "overdue"
        ? {
            border: "border-l-[var(--destructive)]",
            tint: "bg-[color-mix(in_oklab,var(--destructive)_4%,transparent)]",
            pill: "bg-[color-mix(in_oklab,var(--destructive)_18%,transparent)] text-[var(--destructive)]",
            label: "Overdue",
          }
        : weekStatus === "unpaid"
          ? {
              border: "border-l-[var(--warning)]",
              tint: "bg-[color-mix(in_oklab,var(--warning)_4%,transparent)]",
              pill: "bg-[color-mix(in_oklab,var(--warning)_22%,transparent)] text-[var(--warning-foreground)]",
              label: "Unpaid",
            }
          : null;

  return (
    <div className="space-y-6">
      {flagQ.data && flagQ.data.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <CardTitle className="text-base">Pending review ({flagQ.data.length})</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {flagQ.data.slice(0, 5).map((f: any) => (
              <p key={f.id}>
                <span className="font-bold text-lg">{f.workers?.name}</span> · {fmtDate(f.clock_in)}
                {" · "}
                {f.clock_out
                  ? `${diffHours(f.clock_in, f.clock_out).toFixed(1)} hrs`
                  : "still clocked in"}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="w-full">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Worker</p>
        <Select value={workerId ?? ""} onValueChange={setWorkerId}>
          <SelectTrigger className="cw-input w-full h-12 border-0 shadow-none px-4 text-lg font-bold gap-3 focus:ring-2 focus:ring-ring">
            {(() => {
              const w = wq.data?.find((x: any) => x.id === workerId);
              if (!w) return <SelectValue placeholder="Select worker" />;
              const initials = w.name
                .split(/\s+/)
                .map((p: string) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <>
                  <span className="h-8 w-8 shrink-0 rounded-full bg-foreground text-background inline-flex items-center justify-center text-sm font-semibold">
                    {initials || "?"}
                  </span>
                  <SelectValue placeholder="Select worker" />
                </>
              );
            })()}
          </SelectTrigger>
          <SelectContent>
            {wq.data?.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                <span className="font-bold text-lg">{w.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Week navigator */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setWeekStart(addDaysISO(weekStart, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center min-w-0">
            <div className="text-sm font-semibold truncate">{weekRangeLabel(weekStart)}</div>
            <div className="mt-1 flex flex-col items-center gap-1.5">
              {(() => {
                const rel = relativeWeekLabel(weekStart);
                return rel ? (
                  <Badge variant="secondary" className="text-xs">
                    {rel}
                  </Badge>
                ) : null;
              })()}
              {statusStyles && (
                <span
                  className={`inline-flex items-center gap-1 text-sm px-2.5 py-1 rounded-full ${statusStyles.pill}`}
                >
                  ● {statusStyles.label}
                  {weekStatus === "paid" && weekRow?.paidAt
                    ? ` · ${new Date(weekRow.paidAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}`
                    : ""}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setWeekStart(addDaysISO(weekStart, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="default" size="icon" className="shrink-0">
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
              <Calendar
                mode="single"
                selected={new Date(weekStart + "T00:00:00")}
                onSelect={(d) => {
                  if (!d) return;
                  const x = new Date(d);
                  x.setDate(x.getDate() - x.getDay());
                  const pad = (n: number) => String(n).padStart(2, "0");
                  setWeekStart(`${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`);
                  setCalOpen(false);
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Hours" value={fmtHours(weekHours)} />
        <Stat label="Wages" value={fmtMoney(weekWages)} />
        <Stat label="Reimburse" value={fmtMoney(weekReimb)} />
        <Stat label="Total" value={fmtMoney(weekTotal)} variant="total" />
      </div>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => setAdding(true)}
        disabled={!workerId}
      >
        <Plus className="h-4 w-4 mr-2" /> Add entry
      </Button>

      <Card>
        <CardContent className="p-0">
          {!workerId || eq.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : weekEntries.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No entries this week.</p>
          ) : (
            <div className="divide-y divide-border">
              {Object.entries(byDate).map(([date, items]) => {
                const dayHours = items.reduce(
                  (s, e) => s + (e.clock_out ? diffHours(e.clock_in, e.clock_out) : 0),
                  0,
                );
                return (
                  <div
                    key={date}
                    className={
                      statusStyles
                        ? `border-l-[3px] ${statusStyles.border} ${statusStyles.tint}`
                        : "border-l-[3px] border-l-transparent"
                    }
                  >
                    <div className="px-4 sm:px-5 py-2 bg-secondary text-sm flex items-center justify-between">
                      <span className="font-medium">{fmtDate(items[0].clock_in)}</span>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const worker = wq.data?.find((w: any) => w.id === workerId);
                          const rate = Number(worker?.hourly_rate ?? 0);
                          if (rate > 0) {
                            return (
                              <span className="text-success font-semibold tabular-nums">
                                {fmtMoney(dayHours * rate)}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    {items.map((e: any) => (
                      <div key={e.id} className="px-4 sm:px-5 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {/* Time strip */}
                            <p className="font-medium tabular-nums text-sm sm:text-base flex items-center gap-2">
                              {fmtTime(e.clock_in)} –{" "}
                              {e.clock_out ? (
                                fmtTime(e.clock_out)
                              ) : (
                                <span className="text-success">active</span>
                              )}
                              {e.clock_out && (
                                <span className="text-xs text-muted-foreground font-normal">
                                  · {fmtHours(diffHours(e.clock_in, e.clock_out))}
                                </span>
                              )}
                            </p>

                            {/* Primary title: assigned/billed job(s) */}
                            <div className="mt-1.5 flex items-start justify-between gap-2 flex-wrap">
                              <div className="min-w-0 flex flex-col gap-0.5">
                                {e.assigned_sites && e.assigned_sites.length > 0 ? (
                                  e.assigned_sites.map((s: any, idx: number) => (
                                    <span
                                      key={s.id}
                                      className="font-semibold text-base text-foreground leading-tight truncate max-w-[240px]"
                                    >
                                      {idx > 0 && (
                                        <span className="text-muted-foreground mr-1">+</span>
                                      )}
                                      {s.label}
                                    </span>
                                  ))
                                ) : (
                                  <span className="font-semibold text-base text-foreground truncate max-w-[240px]">
                                    {(e.geo_status === "verified" && e.job_sites?.label) ||
                                      (e.clock_out_geo_status === "verified" &&
                                        e.clock_out_site?.label) ||
                                      "General"}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {e.created_by === "admin" && (
                                  <Badge variant="outline" className="h-4 text-[10px]">
                                    manual
                                  </Badge>
                                )}
                                {e.flagged_review && (
                                  <Badge className="h-4 text-[10px] bg-warning text-warning-foreground">
                                    flagged
                                  </Badge>
                                )}
                                {e.planned_job?.label && (
                                  <Badge
                                    variant="outline"
                                    className="h-4 text-[10px] border-primary/40 text-primary"
                                  >
                                    → {e.planned_job.label}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {e.segments && e.segments.length > 1 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {e.segments.map((sg: any) => (
                                  <span key={sg.id}
                                        className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] tabular-nums">
                                    {sg.label} · {fmtHours(sg.hours)}
                                  </span>
                                ))}
                              </div>
                            )}

                            {e.offsite_reason_code && (
                              <p className="text-[11px] text-muted-foreground italic mt-1 truncate max-w-full">
                                {reasonLabel(e.offsite_reason_code)}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            {!e.clock_out && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Force clock out"
                                onClick={() => setConfirmForce(e.id)}
                              >
                                <PowerOff className="h-4 w-4 text-warning" />
                              </Button>
                            )}
                            {e.clock_out && (
                              <Button variant="ghost" size="icon" title="Split hours across sites"
                                      onClick={() => setAllocating(e)}>
                                <Split className={`h-4 w-4 ${e.flagged_review ? "text-warning" : ""}`} />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => setEditing(e)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setConfirmDel(e.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {/* Footer: raw GPS audit timeline */}
                        <div className="mt-2.5 pt-2 border-t border-dashed border-border">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            GPS audit
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <GeoTagEditor
                                entry={e}
                                field="in"
                                sites={sitesQ.data ?? []}
                                onUpdate={async (status, jobSiteId) => {
                                  try {
                                    const r = await updGeo({
                                      data: {
                                        token,
                                        entryId: e.id,
                                        status,
                                        jobSiteId,
                                        field: "in",
                                      },
                                    });
                                    updateToken(r.token);
                                    qc.invalidateQueries({ queryKey: ["entries", workerId] });
                                    toast.success("In tag updated");
                                  } catch (err: any) {
                                    toast.error(err?.message || "Failed");
                                  }
                                }}
                                onUpdatePlanned={async (jobSiteId) => {
                                  try {
                                    const r = await updPlanned({
                                      data: { token, entryId: e.id, jobSiteId },
                                    });
                                    updateToken(r.token);
                                    qc.invalidateQueries({ queryKey: ["entries", workerId] });
                                    toast.success("Planned job updated");
                                  } catch (err: any) {
                                    toast.error(err?.message || "Failed");
                                  }
                                }}
                              />
                            </div>
                            {e.clock_out && (
                              <div className="flex items-center gap-1.5">
                                <GeoTagEditor
                                  entry={e}
                                  field="out"
                                  sites={sitesQ.data ?? []}
                                  onUpdate={async (status, jobSiteId) => {
                                    try {
                                      const r = await updGeo({
                                        data: {
                                          token,
                                          entryId: e.id,
                                          status,
                                          jobSiteId,
                                          field: "out",
                                        },
                                      });
                                      updateToken(r.token);
                                      qc.invalidateQueries({ queryKey: ["entries", workerId] });
                                      toast.success("Out tag updated");
                                    } catch (err: any) {
                                      toast.error(err?.message || "Failed");
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <EntryDialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add time entry"
        projectsEnabled={!!projectsEnabled}
        sites={sitesQ.data ?? []}
        onSubmit={async (vals) => {
          try {
            const r = await addE({ data: { token, workerId: workerId!, ...vals } });
            updateToken(r.token);
            qc.invalidateQueries({ queryKey: ["entries", workerId] });
            toast.success("Entry added");
            setAdding(false);
          } catch (e: any) {
            toast.error(e?.message || "Failed");
          }
        }}
      />
      <AllocationDialog
        entry={allocating}
        sites={(sitesQ.data ?? []) as any}
        token={token}
        onToken={updateToken}
        onClose={() => setAllocating(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["entries", workerId] })}
      />
      {editing && (
        <EntryDialog
          open
          onClose={() => setEditing(null)}
          title="Edit entry"
          projectsEnabled={!!projectsEnabled}
          sites={sitesQ.data ?? []}
          initial={{
            clockIn: editing.clock_in,
            clockOut: editing.clock_out,
            project: editing.project,
            assignedJobSiteIds: editing.assigned_job_site_ids ?? [],
          }}
          allowOpenEnd
          onSubmit={async (vals) => {
            try {
              const r = await editE({
                data: {
                  token,
                  entryId: editing.id,
                  ...vals,
                  clockOut: vals.clockOut || null,
                  project: vals.project || null,
                },
              });
              updateToken(r.token);
              qc.invalidateQueries({ queryKey: ["entries", workerId] });
              toast.success("Entry updated");
              setEditing(null);
            } catch (e: any) {
              toast.error(e?.message || "Failed");
            }
          }}
        />
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={() => setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const id = confirmDel!;
                setConfirmDel(null);
                try {
                  const r = await delE({ data: { token, entryId: id } });
                  updateToken(r.token);
                  qc.invalidateQueries({ queryKey: ["entries", workerId] });
                  toast.success("Deleted");
                } catch (e: any) {
                  toast.error(e?.message || "Failed");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmForce} onOpenChange={() => setConfirmForce(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force clock out now?</AlertDialogTitle>
            <AlertDialogDescription>
              The entry will be closed at the current time. The clock-out tag will match the
              clock-in tag (no GPS reading is taken).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const id = confirmForce!;
                setConfirmForce(null);
                try {
                  const r = await forceOut({ data: { token, entryId: id } });
                  updateToken(r.token);
                  qc.invalidateQueries({ queryKey: ["entries", workerId] });
                  toast.success("Clocked out");
                } catch (e: any) {
                  toast.error(e?.message || "Failed");
                }
              }}
            >
              Clock out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "default" | "total";
}) {
  const isTotal = variant === "total";
  return (
    <Card className={isTotal ? "border-l-4 border-l-[var(--success)]" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${isTotal ? "text-success" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}
function fromLocalInput(v: string) {
  return new Date(v).toISOString();
}

function EntryDialog({
  open,
  onClose,
  title,
  projectsEnabled,
  initial,
  allowOpenEnd,
  sites,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  projectsEnabled: boolean;
  initial?: {
    clockIn: string;
    clockOut?: string | null;
    project?: string | null;
    assignedJobSiteIds?: string[];
  };
  allowOpenEnd?: boolean;
  sites?: { id: string; label: string; kind?: string; archived_at?: string | null }[];
  onSubmit: (v: {
    clockIn: string;
    clockOut: string;
    project?: string;
    assignedJobSiteIds: string[];
  }) => void;
}) {
  const [ci, setCi] = useState(
    toLocalInput(initial?.clockIn) || toLocalInput(new Date().toISOString()),
  );
  const [co, setCo] = useState(toLocalInput(initial?.clockOut) || "");
  const [p, setP] = useState(initial?.project ?? "");
  const [assigned, setAssigned] = useState<string[]>(initial?.assignedJobSiteIds ?? []);
  useEffect(() => {
    if (open) {
      setCi(toLocalInput(initial?.clockIn) || toLocalInput(new Date().toISOString()));
      setCo(toLocalInput(initial?.clockOut) || "");
      setP(initial?.project ?? "");
      setAssigned(initial?.assignedJobSiteIds ?? []);
    }
  }, [open, initial]);

  const activeSites = (sites ?? []).filter(
    (s) => !s.archived_at && (s.kind ?? "client") === "client",
  );
  const siteMap = new Map(activeSites.map((s) => [s.id, s.label]));
  const available = activeSites.filter((s) => !assigned.includes(s.id));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Clock in</Label>
            <Input type="datetime-local" value={ci} onChange={(e) => setCi(e.target.value)} />
          </div>
          <div>
            <Label>
              Clock out{" "}
              {allowOpenEnd && (
                <span className="text-xs text-muted-foreground">(blank = still active)</span>
              )}
            </Label>
            <Input type="datetime-local" value={co} onChange={(e) => setCo(e.target.value)} />
          </div>
          <div>
            <Label>
              Assigned job sites{" "}
              <span className="text-xs text-muted-foreground">
                (stack in title; leave empty for auto)
              </span>
            </Label>
            {assigned.length > 0 && (
              <div className="flex flex-col gap-1 mt-1 mb-2">
                {assigned.map((id, idx) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-md border bg-secondary/40 px-2 py-1 text-sm"
                  >
                    <span className="text-xs text-muted-foreground w-4 tabular-nums">
                      {idx + 1}.
                    </span>
                    <span className="flex-1 truncate">{siteMap.get(id) ?? "(unknown)"}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setAssigned(assigned.filter((x) => x !== id))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {available.length > 0 && assigned.length < 5 && (
              <Select
                value=""
                onValueChange={(v) => {
                  if (v) setAssigned([...assigned, v]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="+ Add job site" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {projectsEnabled && (
            <div>
              <Label>Project (optional)</Label>
              <Input value={p} onChange={(e) => setP(e.target.value)} maxLength={100} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!ci) return;
              if (!allowOpenEnd && !co) return;
              onSubmit({
                clockIn: fromLocalInput(ci),
                clockOut: co ? fromLocalInput(co) : "",
                project: p || undefined,
                assignedJobSiteIds: assigned,
              });
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Workers tab =====
function WorkersTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const listFn = useServerFn(listWorkersAdmin);
  const createFn = useServerFn(createWorker);
  const delFn = useServerFn(deleteWorker);
  const rateFn = useServerFn(setWorkerRate);
  const nameFn = useServerFn(setWorkerName);
  const pinFn = useServerFn(resetWorkerPin);
  const profileFn = useServerFn(updateWorkerProfile);

  const qc = useQueryClient();

  const wq = useQuery({
    queryKey: ["adm-workers"],
    queryFn: () =>
      listFn({ data: { token } }).then((r) => {
        updateToken(r.token);
        return r.workers;
      }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["adm-workers"] });

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [rate, setRate] = useState("0");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newEcName, setNewEcName] = useState("");
  const [newEcPhone, setNewEcPhone] = useState("");
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);
  const [resetting, setResetting] = useState<{ id: string; name: string } | null>(null);
  const [newPin, setNewPin] = useState("");

  const initials = (n: string) =>
    n
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={adding}
          onOpenChange={(o) => {
            setAdding(o);
            if (!o) {
              setName("");
              setPin("");
              setRate("0");
              setNewPhone("");
              setNewEmail("");
              setNewAddress("");
              setNewEcName("");
              setNewEcPhone("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add worker
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add worker</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>PIN (4–12)</Label>
                  <Input
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    maxLength={12}
                    type="password"
                  />
                </div>
                <div>
                  <Label>Hourly rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </div>
              </div>
              <div className="pt-2 border-t space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Personal info (optional)
                </p>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <Label className="text-xs">Address</Label>
                  <Input
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Street, city"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Emergency contact</Label>
                    <Input
                      value={newEcName}
                      onChange={(e) => setNewEcName(e.target.value)}
                      placeholder="Name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Emergency phone</Label>
                    <Input
                      value={newEcPhone}
                      onChange={(e) => setNewEcPhone(e.target.value)}
                      placeholder="Phone"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const r = await createFn({
                      data: {
                        token,
                        name,
                        pin,
                        hourlyRate: parseFloat(rate) || 0,
                        phone: newPhone.trim() || undefined,
                        email: newEmail.trim() || undefined,
                        address: newAddress.trim() || undefined,
                        emergencyContactName: newEcName.trim() || undefined,
                        emergencyContactPhone: newEcPhone.trim() || undefined,
                      },
                    });
                    updateToken(r.token);
                    refresh();
                    toast.success("Worker added");
                    setAdding(false);
                  } catch (e: any) {
                    toast.error(e?.message || "Failed");
                  }
                }}
                disabled={!name.trim() || pin.length < 4}
              >
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {wq.isLoading ? (
        <p className="p-6 text-sm">Loading…</p>
      ) : wq.data?.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No workers yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wq.data?.map((w: any) => (
            <Card key={w.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                    {initials(w.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-lg truncate leading-tight">{w.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${Number(w.hourly_rate).toFixed(2)}/hr
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col gap-3">
                <div className="space-y-2 text-sm flex-1">
                  <InfoRow
                    icon={<Phone className="h-3.5 w-3.5" />}
                    label="Phone"
                    value={w.phone}
                    href={w.phone ? `tel:${w.phone}` : undefined}
                  />
                  <InfoRow
                    icon={<Mail className="h-3.5 w-3.5" />}
                    label="Email"
                    value={w.email}
                    href={w.email ? `mailto:${w.email}` : undefined}
                  />
                  <InfoRow
                    icon={<HomeIcon className="h-3.5 w-3.5" />}
                    label="Address"
                    value={w.address}
                  />
                  <InfoRow
                    icon={<ShieldAlert className="h-3.5 w-3.5" />}
                    label="Emergency"
                    value={
                      w.emergency_contact_name || w.emergency_contact_phone
                        ? [w.emergency_contact_name, w.emergency_contact_phone]
                            .filter(Boolean)
                            .join(" · ")
                        : null
                    }
                    href={
                      w.emergency_contact_phone ? `tel:${w.emergency_contact_phone}` : undefined
                    }
                  />
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <WorkerEditor
                    worker={w}
                    onSave={async (v) => {
                      try {
                        if (v.name !== w.name) {
                          const r1 = await nameFn({
                            data: { token, workerId: w.id, name: v.name },
                          });
                          updateToken(r1.token);
                        }
                        if (v.rate !== Number(w.hourly_rate)) {
                          const r2 = await rateFn({
                            data: { token, workerId: w.id, hourlyRate: v.rate },
                          });
                          updateToken(r2.token);
                        }
                        const r3 = await profileFn({
                          data: {
                            token,
                            workerId: w.id,
                            phone: v.phone,
                            email: v.email,
                            address: v.address,
                            emergencyContactName: v.ecName,
                            emergencyContactPhone: v.ecPhone,
                          },
                        });
                        updateToken(r3.token);
                        refresh();
                        toast.success("Worker updated");
                      } catch (e: any) {
                        toast.error(e?.message || "Failed");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setResetting({ id: w.id, name: w.name });
                      setNewPin("");
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">PIN</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    onClick={() => setConfirmDel({ id: w.id, name: w.name })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!resetting} onOpenChange={() => setResetting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset PIN for {resetting?.name}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>New PIN (4–12 digits)</Label>
            <Input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              maxLength={12}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(null)}>
              Cancel
            </Button>
            <Button
              disabled={newPin.length < 4}
              onClick={async () => {
                try {
                  const r = await pinFn({ data: { token, workerId: resetting!.id, newPin } });
                  updateToken(r.token);
                  toast.success("PIN reset");
                  setResetting(null);
                } catch (e: any) {
                  toast.error(e?.message || "Failed");
                }
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={() => setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDel?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              All their time entries and reimbursements will be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const id = confirmDel!.id;
                setConfirmDel(null);
                try {
                  const r = await delFn({ data: { token, workerId: id } });
                  updateToken(r.token);
                  refresh();
                  toast.success("Worker removed");
                } catch (e: any) {
                  toast.error(e?.message || "Failed");
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  const empty = !value;
  const content = (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">
          {label}
        </p>
        {empty ? (
          <p className="text-xs text-muted-foreground/60 italic">Not set</p>
        ) : (
          <p className="text-xs truncate">{value}</p>
        )}
      </div>
    </div>
  );
  if (href && !empty) {
    return (
      <a
        href={href}
        className="block hover:bg-muted/50 -mx-1 px-1 py-0.5 rounded transition-colors"
      >
        {content}
      </a>
    );
  }
  return content;
}

function WorkerEditor({
  worker,
  onSave,
}: {
  worker: any;
  onSave: (v: {
    name: string;
    rate: number;
    phone: string;
    email: string;
    address: string;
    ecName: string;
    ecPhone: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(worker.name);
  const [rate, setRate] = useState(String(worker.hourly_rate));
  const [phone, setPhone] = useState(worker.phone ?? "");
  const [email, setEmail] = useState(worker.email ?? "");
  const [address, setAddress] = useState(worker.address ?? "");
  const [ecName, setEcName] = useState(worker.emergency_contact_name ?? "");
  const [ecPhone, setEcPhone] = useState(worker.emergency_contact_phone ?? "");
  useEffect(() => {
    setName(worker.name);
    setRate(String(worker.hourly_rate));
    setPhone(worker.phone ?? "");
    setEmail(worker.email ?? "");
    setAddress(worker.address ?? "");
    setEcName(worker.emergency_contact_name ?? "");
    setEcPhone(worker.emergency_contact_phone ?? "");
  }, [worker, open]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit worker</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Hourly rate ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div className="pt-2 border-t space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Personal info
            </p>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <Label className="text-xs">Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Emergency contact</Label>
                <Input
                  value={ecName}
                  onChange={(e) => setEcName(e.target.value)}
                  placeholder="Name"
                />
              </div>
              <div>
                <Label className="text-xs">Emergency phone</Label>
                <Input
                  value={ecPhone}
                  onChange={(e) => setEcPhone(e.target.value)}
                  placeholder="Phone"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onSave({
                name: name.trim(),
                rate: parseFloat(rate) || 0,
                phone: phone.trim(),
                email: email.trim(),
                address: address.trim(),
                ecName: ecName.trim(),
                ecPhone: ecPhone.trim(),
              });
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Payouts tab =====
function PayoutsTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const payFn = useServerFn(weeklyPayout);
  const csvFn = useServerFn(exportEntriesCsv);
  const reimbList = useServerFn(listReimbursements);
  const reimbAdd = useServerFn(addReimbursement);
  const reimbDel = useServerFn(deleteReimbursement);
  const upload = useServerFn(uploadReceipt);
  const qc = useQueryClient();

  const [week, setWeek] = useState(startOfWeekISO());
  const [calOpen, setCalOpen] = useState(false);

  const pq = useQuery({
    queryKey: ["payout", week],
    queryFn: () =>
      payFn({ data: { token, weekStart: week } }).then((r) => {
        updateToken(r.token);
        return r.summary;
      }),
  });

  // Realtime: any reimbursement change → recalc payout & open list
  useEffect(() => {
    const channel = supabase
      .channel("admin-reimb")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reimbursements",
        },
        () => {
          qc.invalidateQueries({ queryKey: ["payout", week] });
          qc.invalidateQueries({ queryKey: ["reimb"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, week]);

  const [reimbFor, setReimbFor] = useState<{ id: string; name: string } | null>(null);
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [billableSite, setBillableSite] = useState<string>("none");
  const [reimbMaterialType, setReimbMaterialType] = useState<"regular" | "client_billable">("regular");

  const [receipt, setReceipt] = useState<{ url: string; mime: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<{ url: string; mime: string } | null>(null);

  const listSitesFn = useServerFn(adminListJobSites);
  const sitesQ = useQuery({
    queryKey: ["admin-jobsites-payouts"],
    queryFn: () =>
      listSitesFn({ data: { token } }).then((r) => {
        updateToken(r.token);
        return r.sites;
      }),
  });
  const activeSitesForReimb = ((sitesQ.data ?? []) as any[]).filter(
    (s) => !s.archived_at && (s.kind ?? "client") === "client",
  );

  const handleFile = async (file: File) => {
    if (!isAcceptableUpload(file)) {
      toast.error("Only images or PDF allowed");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Max file size is 25MB");
      return;
    }
    setUploading(true);
    try {
      const prepped = await prepareUpload(file);
      const r = await withRetry(() =>
        upload({
          data: {
            token,
            filename: prepped.filename,
            mime: prepped.mime as any,
            base64: prepped.base64,
          },
        }),
      );
      updateToken(r.token);
      setReceipt({ url: r.url, mime: r.mime });
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };
  const rq = useQuery({
    enabled: !!reimbFor,
    queryKey: ["reimb", reimbFor?.id, week],
    queryFn: () =>
      reimbList({ data: { token, workerId: reimbFor!.id, weekStart: week } }).then((r) => {
        updateToken(r.token);
        return r.items;
      }),
  });

  const downloadCsv = async () => {
    try {
      const r = await csvFn({ data: { token, weekStart: week } });
      updateToken(r.token);
      const blob = new Blob([r.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `time-entries-${week}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const downloadPayoutCsv = () => {
    if (!pq.data) return;
    const header = "Worker,Hours,Rate,Wages,Reimbursements,Total,Actual Paid,Tip\n";
    const rows = pq.data
      .map(
        (s: any) =>
          `"${s.name}",${s.hours.toFixed(2)},${s.hourlyRate.toFixed(2)},${s.wages.toFixed(2)},${s.reimbTotal.toFixed(2)},${s.total.toFixed(2)},${s.actualPaid != null ? s.actualPaid.toFixed(2) : ""},${s.tipAmount != null ? s.tipAmount.toFixed(2) : ""}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-${week}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markFn = useServerFn(markWeekPaid);
  const unmarkFn = useServerFn(unmarkWeekPaid);
  const [payDialog, setPayDialog] = useState<{
    workerId: string;
    name: string;
    owed: number;
  } | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [payer, setPayer] = useState<"Michael" | "Dylan" | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  const closePayDialog = () => {
    setPayDialog(null);
    setPayAmt("");
    setPayer(null);
  };

  const togglePaid = async (workerId: string, currentlyPaid: boolean) => {
    if (!currentlyPaid) {
      const row = pq.data?.find((x: any) => x.workerId === workerId);
      setPayDialog({ workerId, name: row?.name ?? "Worker", owed: row?.total ?? 0 });
      setPayAmt(row?.total != null ? String(row.total.toFixed(2)) : "");
      setPayer(null);
      return;
    }
    try {
      const r = await unmarkFn({ data: { token, workerId, weekStart: week } });
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["payout", week] });
      qc.invalidateQueries({ queryKey: ["pending-payouts"] });
      toast.warning("Marked unpaid — remove the Cash Tracking row manually if one was added.");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const submitPay = async () => {
    if (!payDialog) return;
    const n = parseFloat(payAmt);
    if (!isFinite(n) || n < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!payer) {
      toast.error("Choose who paid");
      return;
    }
    setPaySubmitting(true);
    try {
      const r = await markFn({
        data: {
          token,
          workerId: payDialog.workerId,
          weekStart: week,
          actualPaid: n,
          paidByPerson: payer,
        },
      });
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["payout", week] });
      qc.invalidateQueries({ queryKey: ["pending-payouts"] });
      if (r.sheetError) {
        toast.warning(`Marked paid — Cash Tracking row not added: ${r.sheetError}`);
      } else if (r.sheetRow) {
        toast.success(`Marked paid — added to ${payer}'s column (row ${r.sheetRow})`);
      } else if (r.sheetSkipped === "disabled") {
        toast.warning("Marked paid — Cash Tracking export is off, no row added.");
      } else if (r.sheetSkipped === "unconfigured") {
        toast.warning("Marked paid — no Cash Tracking sheet set in Settings, no row added.");
      } else {
        toast.success("Marked paid");
      }
      closePayDialog();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setPaySubmitting(false);
    }
  };

  return (
    <Tabs defaultValue="weekly" className="space-y-4">
      <TabsList>
        <TabsTrigger value="weekly">Weekly</TabsTrigger>
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="lifetime">Lifetime</TabsTrigger>
      </TabsList>
      <TabsContent value="pending" className="mt-0">
        <PendingPayoutsView token={token} updateToken={updateToken} />
      </TabsContent>
      <TabsContent value="lifetime" className="mt-0">
        <LifetimePayoutView token={token} updateToken={updateToken} />
      </TabsContent>

      <TabsContent value="weekly" className="mt-0 space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => setWeek(addDaysISO(week, -7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center min-w-0">
                <div className="text-sm font-semibold truncate">{weekRangeLabel(week)}</div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => setWeek(addDaysISO(week, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="default" size="icon" className="shrink-0">
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
                  <Calendar
                    mode="single"
                    selected={new Date(week + "T00:00:00")}
                    onSelect={(d) => {
                      if (!d) return;
                      const x = new Date(d);
                      x.setDate(x.getDate() - x.getDay());
                      const pad = (n: number) => String(n).padStart(2, "0");
                      setWeek(`${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`);
                      setCalOpen(false);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={downloadCsv}>
                    <Download className="h-4 w-4 mr-2" /> Time entries CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={downloadPayoutCsv}>
                    <Download className="h-4 w-4 mr-2" /> Payout CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {pq.isLoading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
          </Card>
        ) : pq.data?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-sm text-muted-foreground text-center">
              No workers yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            {pq.data?.map((s: any) => {
              const initials = s.name
                .split(/\s+/)
                .map((p: string) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              const isPaid = !!s.paidAt;
              const accent = isPaid
                ? "border-l-4 border-l-[var(--success)] bg-[color-mix(in_oklab,var(--success)_4%,transparent)]"
                : s.total > 0
                  ? "border-l-4 border-l-[var(--warning)] bg-[color-mix(in_oklab,var(--warning)_4%,transparent)]"
                  : "";
              return (
                <Card key={s.workerId} className={`overflow-hidden flex flex-col ${accent}`}>
                  <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-9 w-9 shrink-0 rounded-full bg-secondary text-secondary-foreground inline-flex items-center justify-center text-xs font-semibold">
                        {initials || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-lg truncate">{s.name}</p>
                        {isPaid ? (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            <span className="inline-flex items-center gap-1 text-sm px-2.5 py-1 rounded-full bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]">
                              ● Paid ·{" "}
                              {new Date(s.paidAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            {s.tipAmount != null && Math.abs(s.tipAmount) >= 0.005 && (
                              <span
                                className={`inline-flex items-center text-sm px-2.5 py-1 rounded-full ${
                                  s.tipAmount > 0
                                    ? "bg-[color-mix(in_oklab,var(--success)_15%,transparent)] text-[var(--success)]"
                                    : "bg-[color-mix(in_oklab,var(--destructive)_15%,transparent)] text-[var(--destructive)]"
                                }`}
                              >
                                {s.tipAmount > 0
                                  ? `+${fmtMoney(s.tipAmount)} tip`
                                  : `${fmtMoney(s.tipAmount)} short`}
                              </span>
                            )}
                          </div>
                        ) : s.total > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm mt-0.5 px-2.5 py-1 rounded-full bg-[color-mix(in_oklab,var(--warning)_22%,transparent)] text-[var(--warning-foreground)]">
                            ● Unpaid
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReimbFor({ id: s.workerId, name: s.name });
                        setDesc("");
                        setAmt("");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Reimb.
                    </Button>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3 pt-0 pb-4">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">Labour</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {s.hours.toFixed(2)} hrs × ${s.hourlyRate.toFixed(2)}
                        </p>
                      </div>
                      <span className="tabular-nums font-semibold">{fmtMoney(s.wages)}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">Reimbursements</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {s.reimbursements?.length ?? 0}{" "}
                          {(s.reimbursements?.length ?? 0) === 1 ? "item" : "items"}
                        </p>
                      </div>
                      <span className="tabular-nums font-semibold">{fmtMoney(s.reimbTotal)}</span>
                    </div>
                    {s.reimbursements?.length > 0 && (
                      <ul className="rounded-md bg-muted/40 p-2 space-y-1 text-xs">
                        {s.reimbursements.map((r: any) => (
                          <li
                            key={r.id ?? `${r.description}-${r.amount}`}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <span className="truncate text-muted-foreground">{r.description}</span>
                            <span className="tabular-nums">{fmtMoney(Number(r.amount))}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                  <div className="flex items-center justify-between gap-3 bg-muted/60 border-t border-border px-6 py-3">
                    <div className="flex min-w-0 items-baseline gap-5">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Total owed</p>
                        <p className="tabular-nums font-bold text-lg text-[var(--success)]">
                          {fmtMoney(s.total)}
                        </p>
                      </div>
                      {s.actualPaid != null && (
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Total cash paid</p>
                          <p className="tabular-nums font-bold text-lg text-[var(--success)]">
                            {fmtMoney(s.actualPaid)}
                          </p>
                        </div>
                      )}
                    </div>
                    {s.total > 0 || isPaid ? (
                      <Button
                        size="sm"
                        variant={isPaid ? "outline" : "default"}
                        onClick={() => togglePaid(s.workerId, isPaid)}
                      >
                        {isPaid ? "Mark unpaid" : "Mark paid"}
                      </Button>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={!!payDialog} onOpenChange={(o) => { if (!o && !paySubmitting) closePayDialog(); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Mark week paid</DialogTitle>
            </DialogHeader>
            {payDialog && (
              <div className="space-y-3">
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <p className="font-medium">{payDialog.name}</p>
                  <p className="text-xs text-muted-foreground">{weekRangeLabel(week)}</p>
                  <p className="mt-2 flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Owed</span>
                    <span className="font-semibold tabular-nums">{fmtMoney(payDialog.owed)}</span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Paid by</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Michael", "Dylan"] as const).map((p) => (
                      <Button
                        key={p}
                        type="button"
                        variant={payer === p ? "default" : "outline"}
                        onClick={() => setPayer(p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="weekly-cash-paid" className="text-xs">
                    Amount paid in cash
                  </Label>
                  <Input
                    id="weekly-cash-paid"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={payAmt}
                    onChange={(e) => setPayAmt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitPay();
                    }}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={paySubmitting} onClick={closePayDialog}>
                Cancel
              </Button>
              <Button
                onClick={submitPay}
                disabled={
                  paySubmitting ||
                  !payer ||
                  !payAmt ||
                  !isFinite(parseFloat(payAmt)) ||
                  parseFloat(payAmt) < 0
                }
              >
                {paySubmitting ? "Saving…" : "Confirm paid"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!reimbFor}
          onOpenChange={(o) => {
            if (!o) {
              setReimbFor(null);
              setReceipt(null);
              setDesc("");
              setAmt("");
              setBillableSite("none");
              setReimbMaterialType("regular");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Reimbursements — {reimbFor?.name} (week of {week})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="Description"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    className="flex-1 min-w-[140px]"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={amt}
                    onChange={(e) => setAmt(e.target.value)}
                    className="w-[110px]"
                  />
                </div>
                <div className="rounded-md border border-border p-3 space-y-2">
                  <Label className="text-xs">Material type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={reimbMaterialType === "regular" ? "default" : "outline"}
                      onClick={() => setReimbMaterialType("regular")}
                    >
                      Regular
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={reimbMaterialType === "client_billable" ? "default" : "outline"}
                      className={
                        reimbMaterialType === "client_billable"
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : ""
                      }
                      onClick={() => setReimbMaterialType("client_billable")}
                    >
                      Client-billable
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">
                      Job site
                      {reimbMaterialType === "client_billable" && (
                        <span className="text-destructive ml-0.5">*</span>
                      )}
                    </Label>
                    <Select value={billableSite} onValueChange={setBillableSite}>
                      <SelectTrigger className="mt-1">
                        <SelectValue
                          placeholder={
                            reimbMaterialType === "client_billable"
                              ? "Pick a job site"
                              : "Job site (optional)"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No job site</SelectItem>
                        {activeSitesForReimb.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {receipt ? (
                    <div className="flex items-center gap-2 rounded-md border border-border p-1.5 pr-2">
                      <button
                        type="button"
                        onClick={() => setViewing(receipt)}
                        className="block h-12 w-12 overflow-hidden rounded bg-secondary"
                      >
                        {receipt.mime.startsWith("image/") ? (
                          <img
                            src={receipt.url}
                            alt="Receipt preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </button>
                      <span className="text-xs text-muted-foreground">Receipt attached</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setReceipt(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <CameraFilePicker
                      onFile={handleFile}
                      uploading={uploading}
                      label="Attach receipt (optional)"
                    />
                  )}
                  <Button
                    className="ml-auto"
                    onClick={async () => {
                      if (reimbMaterialType === "client_billable" && billableSite === "none") {
                        toast.error("Pick a job site to bill");
                        return;
                      }
                      try {
                        const siteId = billableSite === "none" ? null : billableSite;
                        const r = await reimbAdd({
                          data: {
                            token,
                            workerId: reimbFor!.id,
                            weekStart: week,
                            description: desc,
                            amount: parseFloat(amt) || 0,
                            receiptUrl: receipt?.url ?? null,
                            receiptMime: receipt?.mime ?? null,
                            materialType: reimbMaterialType,
                            billableJobSiteId:
                              reimbMaterialType === "client_billable" ? siteId : null,
                            parsedJobSiteId: siteId,
                          },
                        });
                        updateToken(r.token);
                        setDesc("");
                        setAmt("");
                        setReceipt(null);
                        setBillableSite("none");
                        setReimbMaterialType("regular");
                        qc.invalidateQueries({ queryKey: ["reimb", reimbFor!.id, week] });
                        qc.invalidateQueries({ queryKey: ["payout", week] });
                      } catch (e: any) {
                        toast.error(e?.message || "Failed");
                      }
                    }}
                    disabled={
                      !desc.trim() ||
                      !amt ||
                      uploading ||
                      (reimbMaterialType === "client_billable" && billableSite === "none")
                    }
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="border border-border rounded-md divide-y divide-border max-h-72 overflow-auto">
                {rq.data?.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    No reimbursements this week.
                  </p>
                ) : (
                  rq.data?.map((r: any) => (
                    <div
                      key={r.id}
                      className="px-3 py-2 flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {r.receipt_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              setViewing({
                                url: r.receipt_url,
                                mime: r.receipt_mime || "image/jpeg",
                              })
                            }
                            className="block h-10 w-10 shrink-0 overflow-hidden rounded bg-secondary"
                          >
                            {(r.receipt_mime || "").startsWith("image/") ? (
                              <img
                                src={r.receipt_url}
                                alt="Receipt"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </button>
                        ) : null}
                        <p className="truncate flex items-center gap-1.5">
                          {r.description}
                          {r.receipt_url && (
                            <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums">{fmtMoney(Number(r.amount))}</span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Delete reimbursement">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove this reimbursement?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove this reimbursement? This cannot be
                                undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={async () => {
                                  try {
                                    const x = await reimbDel({ data: { token, id: r.id } });
                                    updateToken(x.token);
                                    qc.invalidateQueries({
                                      queryKey: ["reimb", reimbFor!.id, week],
                                    });
                                    qc.invalidateQueries({ queryKey: ["payout", week] });
                                  } catch (e: any) {
                                    toast.error(e?.message || "Failed");
                                  }
                                }}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Receipt</DialogTitle>
            </DialogHeader>
            {viewing &&
              (viewing.mime === "application/pdf" ? (
                <iframe
                  src={viewing.url}
                  title="Receipt"
                  className="w-full h-[70vh] rounded-md border border-border"
                />
              ) : (
                <img
                  src={viewing.url}
                  alt="Receipt"
                  className="w-full max-h-[70vh] object-contain rounded-md"
                />
              ))}
            {viewing && (
              <DialogFooter>
                <a href={viewing.url} target="_blank" rel="noreferrer">
                  <Button variant="outline">Open in new tab</Button>
                </a>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </TabsContent>
    </Tabs>
  );
}

// ===== Receipts (all reimbursements with attachments) =====
const RECEIPT_CATEGORIES = [
  "Materials",
  "Fuel",
  "Tools",
  "Subcontractor",
  "Permits",
  "Other",
] as const;

function ReceiptsTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const listFn = useServerFn(listAllReceipts);
  const parseFn = useServerFn(parseReceipt);
  const updFn = useServerFn(updateParsedReceipt);
  const parseAllFn = useServerFn(parseUnprocessed);
  const sitesFn = useServerFn(adminListJobSites);
  const deleteFn = useServerFn(deleteReimbursement);
  const qc = useQueryClient();
  const [workerId, setWorkerId] = useState<string>("all");
  const [weekStart, setWeekStart] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [materialType, setMaterialType] = useState<"all" | "regular" | "client_billable">("all");
  const [search, setSearch] = useState("");

  const [viewing, setViewing] = useState<{ url: string; mime: string } | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adminAddOpen, setAdminAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);

  const q = useQuery({
    queryKey: ["all-receipts"],
    queryFn: () =>
      listFn({ data: { token, withReceiptOnly: true, limit: 500 } }).then((r) => {
        updateToken(r.token);
        return r.items;
      }),
    refetchInterval: (query) => {
      const items = (query.state.data as any[] | undefined) ?? [];
      return items.some((it) => it?.parse_status === "pending") ? 4000 : false;
    },
  });

  const sitesQ = useQuery({
    queryKey: ["sites-for-receipts"],
    queryFn: () =>
      sitesFn({ data: { token, includeArchived: false } }).then((r) => {
        updateToken(r.token);
        return r.sites;
      }),
  });

  const items = q.data ?? [];
  const sites = sitesQ.data ?? [];
  const workers = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((i) => {
      if (i.workerId) m.set(i.workerId, i.workerName);
    });
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [items]);
  const weeks = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.weekStart)))
        .sort()
        .reverse(),
    [items],
  );

  const filtered = items.filter((i) => {
    if (workerId === "__admin__") {
      if (!i.isAdminReceipt) return false;
    } else if (workerId !== "all") {
      if (i.isAdminReceipt || i.workerId !== workerId) return false;
    }
    if (weekStart !== "all" && i.weekStart !== weekStart) return false;
    if (category !== "all" && i.parsedCategory !== category) return false;
    if (materialType !== "all" && (i.materialType ?? "regular") !== materialType) return false;
    if (search) {
      const hay = `${i.description} ${i.parsedVendor || ""} ${i.payeeLabel || ""}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const totalAmt = filtered.reduce((s, i) => s + (Number(i.parsedTotal ?? i.amount) || 0), 0);
  const unparsedCount = items.filter((i) => !i.parseStatus).length;

  function downloadName(i: (typeof items)[number]) {
    const ext =
      i.receiptMime === "application/pdf" ? "pdf" : i.receiptMime === "image/png" ? "png" : "jpg";
    const safe = (s: string) =>
      s
        .replace(/[^a-z0-9-]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40);
    return `${safe(i.workerName)}-${i.weekStart}-${safe(i.description)}.${ext}`;
  }

  async function handleDownload(i: (typeof items)[number]) {
    if (!i.receiptUrl) return;
    try {
      const res = await fetch(i.receiptUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName(i);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.open(i.receiptUrl, "_blank");
    }
  }

  async function rerun(id: string) {
    setBusyId(id);
    try {
      const r = await parseFn({ data: { token, id } });
      updateToken(r.token);
      toast.success("Receipt re-scanned");
      qc.invalidateQueries({ queryKey: ["all-receipts"] });
    } catch (e: any) {
      toast.error(e?.message || "Scan failed");
    } finally {
      setBusyId(null);
    }
  }

  async function parseAll() {
    setBusyId("ALL");
    try {
      const r = await parseAllFn({ data: { token } });
      updateToken(r.token);
      toast.success(`Scanned ${r.processed} receipt${r.processed === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["all-receipts"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusyId(null);
    }
  }

  function csvExport() {
    const headers = [
      "Date",
      "Worker",
      "Vendor",
      "Description",
      "Category",
      "Job Site",
      "Subtotal",
      "Tax",
      "Total",
      "Amount",
      "Week",
      "Material Type",
      "Billable Client",
      "Receipt",
    ];
    const lines = [headers.join(",")];
    filtered.forEach((i) => {
      const row = [
        i.parsedDate || "",
        i.workerName,
        i.parsedVendor || "",
        i.description,
        i.parsedCategory || "",
        i.parsedJobSiteLabel || "",
        i.parsedSubtotal ?? "",
        i.parsedTax ?? "",
        i.parsedTotal ?? "",
        i.amount,
        i.weekStart,
        (i.materialType ?? "regular") === "client_billable" ? "Client Billable" : "Regular",
        i.billableJobSiteLabel || "",
        i.receiptUrl || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(row.join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const activeFilterCount =
    (workerId !== "all" ? 1 : 0) +
    (weekStart !== "all" ? 1 : 0) +
    (category !== "all" ? 1 : 0) +
    (materialType !== "all" ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Search + Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendor or description…"
          className="cw-input h-11 pl-10 pr-14 border-0 focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg hover:bg-background"
              aria-label="Filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground grid place-items-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3 space-y-3">
            <div>
              <Label className="text-xs">Worker</Label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All workers</SelectItem>
                  <SelectItem value="__admin__">Admin</SelectItem>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Week</Label>
              <Select value={weekStart} onValueChange={setWeekStart}>
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All weeks</SelectItem>
                  {weeks.map((w) => (
                    <SelectItem key={w} value={w}>{fmtDate(w)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {RECEIPT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Material</Label>
              <Select value={materialType} onValueChange={(v) => setMaterialType(v as any)}>
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="client_billable">Client-billable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setWorkerId("all");
                  setWeekStart("all");
                  setCategory("all");
                  setMaterialType("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary + compact actions */}
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-sm text-muted-foreground min-w-0 truncate">
          {filtered.length} receipt{filtered.length === 1 ? "" : "s"} · Total:{" "}
          <span className="font-semibold text-foreground">{fmtMoney(totalAmt)}</span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {unparsedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={parseAll}
              disabled={busyId === "ALL"}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {busyId === "ALL" ? "Scanning…" : `Scan ${unparsedCount}`}
            </Button>
          )}
          <button
            type="button"
            onClick={() => setAdminAddOpen(true)}
            aria-label="Add receipts"
            className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={csvExport}
            aria-label="Export CSV"
            title="Export CSV"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>

      </div>


      {q.isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-sm text-muted-foreground text-center">
            No receipts match these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((i) => {
            const isPdf = (i.receiptMime || "").includes("pdf");
            const status = i.parseStatus;
            const isBillable = (i.materialType ?? "regular") === "client_billable";
            return (
              <Card key={i.id} className="overflow-hidden flex flex-col">
                <button
                  type="button"
                  onClick={() =>
                    i.receiptUrl &&
                    setViewing({ url: i.receiptUrl, mime: i.receiptMime || "image/jpeg" })
                  }
                  className="block aspect-[4/3] bg-muted overflow-hidden hover:opacity-90 transition relative"
                >
                  {isPdf ? (
                    <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <Paperclip className="h-8 w-8" />
                      <span className="text-xs">PDF receipt</span>
                    </div>
                  ) : (
                    <img
                      src={i.receiptUrl!}
                      alt={i.description}
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
                <CardContent className="p-3 space-y-2.5 flex-1 flex flex-col">
                  {/* Row 1: vendor + total (fixed position) */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm truncate min-w-0">
                      {i.parsedVendor || i.description}
                    </p>
                    <p className="font-semibold text-sm whitespace-nowrap tabular-nums">
                      {fmtMoney(i.parsedTotal ?? i.amount)}
                    </p>
                  </div>

                  {/* Row 2: date meta OR status when actionable */}
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 -mt-1">
                    {status === "pending" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span>Scanning…</span>
                      </>
                    ) : status === "failed" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        <span>Scan failed</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {i.parsedDate ? fmtDate(i.parsedDate) : `wk ${fmtDate(i.weekStart)}`}
                        </span>
                        {(i.parsedSubtotal != null || i.parsedTax != null) && (
                          <span className="text-muted-foreground/70">
                            · {i.parsedSubtotal != null && <>sub {fmtMoney(i.parsedSubtotal)}</>}
                            {i.parsedSubtotal != null && i.parsedTax != null && " · "}
                            {i.parsedTax != null && <>tax {fmtMoney(i.parsedTax)}</>}
                          </span>
                        )}
                      </>
                    )}
                  </p>

                  {/* Row 3: dedicated priority strip — source + job site, always rendered */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/60">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        i.isAdminReceipt
                          ? "bg-purple-500/15 text-purple-700 dark:text-purple-400"
                          : "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                      }`}
                    >
                      {i.isAdminReceipt ? "Admin" : i.workerName || "Worker"}
                    </span>
                    {i.parsedJobSiteLabel ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal max-w-[180px] truncate"
                      >
                        {i.parsedJobSiteLabel}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal text-muted-foreground border-dashed"
                      >
                        No job
                      </Badge>
                    )}
                  </div>

                  {/* Row 4: secondary tags + description, only if present */}
                  {(i.parsedCategory || isBillable) && (
                    <div className="flex flex-wrap gap-1">
                      {i.parsedCategory && (
                        <Badge variant="secondary" className="text-[10px]">
                          {i.parsedCategory}
                        </Badge>
                      )}
                      {isBillable && (
                        <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15">
                          Bill client{i.billableJobSiteLabel ? ` · ${i.billableJobSiteLabel}` : ""}
                        </Badge>
                      )}
                    </div>
                  )}
                  {i.parsedVendor && i.description && i.parsedVendor !== i.description && (
                    <p className="text-xs text-muted-foreground truncate" title={i.description}>
                      “{i.description}”
                    </p>
                  )}

                  <div className="flex gap-1.5 mt-auto pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 px-2"
                      onClick={() => setEditing(i)}
                      title="Edit fields"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2"
                      onClick={() => rerun(i.id)}
                      disabled={busyId === i.id}
                      title="Re-run AI"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${busyId === i.id ? "animate-spin" : ""}`}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2"
                      onClick={() =>
                        i.receiptUrl &&
                        setViewing({ url: i.receiptUrl, mime: i.receiptMime || "image/jpeg" })
                      }
                      title="View"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2"
                      onClick={() => handleDownload(i)}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDel(i)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {viewing &&
            (viewing.mime === "application/pdf" ? (
              <iframe
                src={viewing.url}
                title="Receipt"
                className="w-full h-[70vh] rounded-md border border-border"
              />
            ) : (
              <img
                src={viewing.url}
                alt="Receipt"
                className="w-full max-h-[70vh] object-contain rounded-md"
              />
            ))}
          {viewing && (
            <DialogFooter>
              <a href={viewing.url} target="_blank" rel="noreferrer">
                <Button variant="outline">Open in new tab</Button>
              </a>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <EditParsedDialog
        item={editing}
        sites={sites}
        token={token}
        updateToken={updateToken}
        onClose={() => setEditing(null)}
        updateFn={updFn}
        onSaved={() => qc.invalidateQueries({ queryKey: ["all-receipts"] })}
      />

      <AdminAddReceiptsDialog
        open={adminAddOpen}
        onClose={() => setAdminAddOpen(false)}
        token={token}
        updateToken={updateToken}
        onDone={() => qc.invalidateQueries({ queryKey: ["all-receipts"] })}
      />





      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the receipt
              {confirmDel?.parsedVendor ? ` from ${confirmDel.parsedVendor}` : ""}
              {confirmDel ? ` (${fmtMoney(confirmDel.amount)})` : ""} and its uploaded file. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDel) return;
                try {
                  const r = await deleteFn({ data: { token, id: confirmDel.id } });
                  updateToken(r.token);
                  toast.success("Receipt deleted");
                  qc.invalidateQueries({ queryKey: ["all-receipts"] });
                } catch (e: any) {
                  toast.error(e?.message || "Failed to delete");
                } finally {
                  setConfirmDel(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditParsedDialog({
  item,
  sites,
  token,
  updateToken,
  onClose,
  updateFn,
  onSaved,
}: {
  item: any | null;
  sites: Array<{ id: string; label: string; kind?: string; archived_at?: string | null }>;
  token: string;
  updateToken: (t: string) => void;
  onClose: () => void;
  updateFn: (args: { data: any }) => Promise<any>;
  onSaved: () => void;
}) {
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [tax, setTax] = useState("");
  const [total, setTotal] = useState("");
  const [category, setCategory] = useState<string>("");
  const [jobSite, setJobSite] = useState<string>("");
  const [materialType, setMaterialType] = useState<"regular" | "client_billable">("regular");
  const [billableSite, setBillableSite] = useState<string>("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const clientSites = useMemo(
    () => sites.filter((s) => (s.kind ?? "client") === "client" && !s.archived_at),
    [sites],
  );

  useEffect(() => {
    if (!item) return;
    setVendor(item.parsedVendor || "");
    setDate(item.parsedDate || "");
    setSubtotal(item.parsedSubtotal != null ? String(item.parsedSubtotal) : "");
    setTax(item.parsedTax != null ? String(item.parsedTax) : "");
    setTotal(item.parsedTotal != null ? String(item.parsedTotal) : "");
    setCategory(item.parsedCategory || "");
    setJobSite(item.parsedJobSiteId || "");
    setMaterialType((item.materialType as any) || "regular");
    setBillableSite(item.billableJobSiteId || "");
    setDescription(item.description || "");
  }, [item]);

  const save = async () => {
    if (!item) return;
    const resolvedBillable =
      materialType === "client_billable" ? jobSite || billableSite || "" : "";
    if (materialType === "client_billable" && !resolvedBillable) {
      toast.error("Pick a job site above to bill this receipt");
      return;
    }
    setSaving(true);
    try {
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      const r = await updateFn({
        data: {
          token,
          id: item.id,
          vendor: vendor.trim() || null,
          date: date || null,
          subtotal: num(subtotal),
          tax: num(tax),
          total: num(total),
          category: category || null,
          jobSiteId: jobSite || null,
          materialType,
          billableJobSiteId: materialType === "client_billable" ? resolvedBillable : null,
          description: description.trim() ? description.trim() : null,
        },
      });

      updateToken(r.token);
      toast.success("Saved");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit receipt details</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Vendor</Label>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Subtotal</Label>
              <Input
                type="number"
                step="0.01"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Tax</Label>
              <Input
                type="number"
                step="0.01"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Total</Label>
              <Input
                type="number"
                step="0.01"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select
              value={category || "none"}
              onValueChange={(v) => setCategory(v === "none" ? "" : v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {RECEIPT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Job site</Label>
            {item?.parsedJobSiteId && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Locked to worker's pick — re-scan won't change this.
              </p>
            )}

            <Select
              value={jobSite || "none"}
              onValueChange={(v) => setJobSite(v === "none" ? "" : v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {(() => {
                  const active = sites.filter((s) => !s.archived_at);
                  const clients = active.filter((s) => (s.kind ?? "client") === "client");
                  const suppliers = active.filter((s) => s.kind === "supplier");
                  const archived = sites.filter((s) => s.archived_at);
                  return (
                    <>
                      {clients.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Client jobs</SelectLabel>
                          {clients.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {archived.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Archived</SelectLabel>
                          {archived.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </>
                  );
                })()}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border border-border p-3 space-y-2">
            <Label className="text-xs">Material type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={materialType === "regular" ? "default" : "outline"}
                onClick={() => setMaterialType("regular")}
              >
                Regular
              </Button>
              <Button
                type="button"
                size="sm"
                variant={materialType === "client_billable" ? "default" : "outline"}
                className={
                  materialType === "client_billable"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : ""
                }
                onClick={() => setMaterialType("client_billable")}
              >
                Client-billable
              </Button>
            </div>
            {materialType === "client_billable" && !jobSite && (
              <p className="text-[11px] text-amber-700 mt-1">
                Pick a job site above to bill this receipt to a client.
              </p>
            )}

          </div>
          <div>
            <Label className="text-xs">Note</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Admin standalone receipt bulk upload =====


function currentWeekStartISOClient(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function AdminAddReceiptsDialog({
  open,
  onClose,
  token,
  updateToken,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  updateToken: (t: string) => void;
  onDone: () => void;
}) {
  const uploadFn = useServerFn(uploadReceipt);
  const addFn = useServerFn(adminAddStandaloneReceipt);
  const sitesFn = useServerFn(adminListJobSites);
  const [payee, setPayee] = useState("");
  const [description, setDescription] = useState("");
  const [weekStart, setWeekStart] = useState(currentWeekStartISOClient());
  const [jobSiteId, setJobSiteId] = useState<string>("");
  const [materialType, setMaterialType] = useState<"regular" | "client_billable">("regular");
  const [files, setFiles] = useState<File[]>([]);
  const [extraOpen, setExtraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sitesQ = useQuery({
    queryKey: ["admin-jobsites-for-receipts"],
    queryFn: () => sitesFn({ data: { token } }),
    enabled: open,
  });
  const clientJobs = ((sitesQ.data?.sites ?? []) as any[]).filter(
    (s) => !s.archived_at && (s.kind ?? "client") === "client",
  );

  useEffect(() => {
    if (!open) {
      setPayee("");
      setDescription("");
      setFiles([]);
      setJobSiteId("");
      setMaterialType("regular");
      setProgress(null);
      setBusy(false);
      setExtraOpen(false);
      setWeekStart(currentWeekStartISOClient());
    }
  }, [open]);

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list).filter((f) => {
      if (!isAcceptableUpload(f)) {
        toast.error(`Skipped ${f.name}: must be an image or PDF`);
        return false;
      }
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`Skipped ${f.name}: over 25MB`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...incoming].slice(0, 10));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const submit = async () => {
    if (files.length === 0) {
      toast.error("Add at least one file");
      return;
    }
    if (materialType === "client_billable" && !jobSiteId) {
      toast.error("Pick a job site for client-billable receipts");
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: files.length });
    let ok = 0,
      failed = 0;
    let firstError = "";
    for (const f of files) {
      try {
        const prepped = await prepareUpload(f);
        const up = await withRetry(() =>
          uploadFn({
            data: {
              token,
              filename: prepped.filename,
              mime: prepped.mime as any,
              base64: prepped.base64,
            },
          }),
        );
        updateToken(up.token);
        const r = await withRetry(() =>
          addFn({
            data: {
              token: up.token,
              payeeLabel: payee.trim() || undefined,
              description: description.trim() || undefined,
              weekStart,
              receiptUrl: up.url,
              receiptMime: up.mime,
              jobSiteId: jobSiteId || null,
              materialType,
            },
          }),
        );
        updateToken(r.token);
        ok++;
      } catch (e: any) {
        failed++;
        if (!firstError) firstError = String(e?.message || e || "Upload failed");
        console.error("admin receipt upload failed", e);
      } finally {
        setProgress((p) => (p ? { done: p.done + 1, total: p.total } : null));
      }
    }
    setBusy(false);
    if (ok > 0)
      toast.success(
        `Uploaded ${ok} receipt${ok === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""} — parsing in background`,
      );
    if (ok === 0 && failed > 0) toast.error(`Upload failed: ${firstError.slice(0, 160)}`);
    onDone();
    if (ok > 0) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        className="max-w-lg flex flex-col max-h-[90vh] p-0 gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Add receipts</DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Business receipts not tied to a worker. Each file is parsed by AI and added to your
            Google Sheet.
          </p>
        </DialogHeader>
        <div className="space-y-3 px-6 py-3 overflow-y-auto flex-1">
          <div>
            <Label className="text-xs">Week</Label>
            <Input
              type="date"
              value={weekStart}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split("-").map(Number);
                if (!y) return;
                const dt = new Date(y, (m || 1) - 1, d || 1);
                dt.setDate(dt.getDate() - dt.getDay());
                const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
                setWeekStart(iso);
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Material type</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMaterialType("regular")}
                className={`h-9 rounded-md border text-sm font-medium transition ${
                  materialType === "regular"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                Regular
              </button>
              <button
                type="button"
                onClick={() => setMaterialType("client_billable")}
                className={`h-9 rounded-md border text-sm font-medium transition ${
                  materialType === "client_billable"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                Client-billable
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs">
              Job {materialType === "client_billable" ? "(required)" : "(optional)"}
            </Label>
            <Select
              value={jobSiteId || "none"}
              onValueChange={(v) => setJobSiteId(v === "none" ? "" : v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {clientJobs.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Client jobs</SelectLabel>
                    {clientJobs.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            {clientJobs.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                No active client jobs. Add one in Job Sites.
              </p>
            )}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
            }`}
          >
            <Paperclip className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm">Drop files or click to choose</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              JPG, PNG, PDF · up to 10 files · 10MB each
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-auto">
              {files.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="flex items-center justify-between gap-2 text-xs bg-muted/50 rounded px-2 py-1"
                >
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-muted-foreground hover:text-red-500"
                    disabled={busy}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-2">
            <button
              type="button"
              onClick={() => setExtraOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition w-full"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${extraOpen ? "rotate-0" : "-rotate-90"}`}
              />
              {extraOpen ? "Hide extra details" : "Add extra details (Payee, Notes)"}
            </button>
            {extraOpen && (
              <div className="space-y-3 mt-3">
                <div>
                  <Label className="text-xs">Payee (optional)</Label>
                  <Input
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    placeholder="Auto-filled from receipt if left blank"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Note (optional)</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="optional"
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {progress && (
            <p className="text-xs text-center text-muted-foreground">
              Uploading {progress.done} / {progress.total}…
            </p>
          )}
        </div>
        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || files.length === 0}>
            {busy ? "Uploading…" : `Upload ${files.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Pending payouts =====

function PendingPayoutsView({
  token,
  updateToken,
}: {
  token: string;
  updateToken: (t: string) => void;
}) {
  const listFn = useServerFn(listPendingWeeks);
  const markFn = useServerFn(markWeekPaid);
  const unmarkFn = useServerFn(unmarkWeekPaid);
  const qc = useQueryClient();
  const [includePaid, setIncludePaid] = useState(false);
  const [payDialog, setPayDialog] = useState<{
    workerId: string;
    workerName: string;
    weekStart: string;
    owed: number;
  } | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [payer, setPayer] = useState<"Michael" | "Dylan" | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  const q = useQuery({
    queryKey: ["pending-payouts", includePaid],
    queryFn: () =>
      listFn({ data: { token, includePaid } }).then((r) => {
        updateToken(r.token);
        return r.items;
      }),
  });

  const unmark = async (workerId: string, weekStart: string) => {
    try {
      const r = await unmarkFn({ data: { token, workerId, weekStart } });
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["pending-payouts"] });
      qc.invalidateQueries({ queryKey: ["payout"] });
      toast.warning("Marked unpaid — remove the Cash Tracking row manually if one was added.");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const submitPay = async () => {
    if (!payDialog) return;
    const n = parseFloat(payAmt);
    if (!isFinite(n) || n < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!payer) {
      toast.error("Choose who paid");
      return;
    }
    setPaySubmitting(true);
    try {
      const r = await markFn({
        data: {
          token,
          workerId: payDialog.workerId,
          weekStart: payDialog.weekStart,
          actualPaid: n,
          paidByPerson: payer,
        },
      });
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["pending-payouts"] });
      qc.invalidateQueries({ queryKey: ["payout"] });
      if (r.sheetError) {
        toast.warning(`Marked paid — Cash Tracking row not added: ${r.sheetError}`);
      } else if (r.sheetRow) {
        toast.success(`Marked paid — added to ${payer}'s column (row ${r.sheetRow})`);
      } else {
        toast.success("Marked paid");
      }
      setPayDialog(null);
      setPayAmt("");
      setPayer(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setPaySubmitting(false);
    }
  };

  const items = q.data ?? [];
  const outstanding = items
    .filter((i: any) => i.status !== "paid")
    .reduce((s: number, i: any) => s + i.total, 0);

  const statusStyles: Record<
    string,
    { dotBg: string; pillBg: string; pillText: string; border: string; tint: string }
  > = {
    overdue: {
      dotBg: "bg-[var(--destructive)]",
      pillBg: "bg-[color-mix(in_oklab,var(--destructive)_18%,transparent)]",
      pillText: "text-[var(--destructive)]",
      border: "border-l-[var(--destructive)]",
      tint: "bg-[color-mix(in_oklab,var(--destructive)_4%,transparent)]",
    },
    unpaid: {
      dotBg: "bg-[var(--warning)]",
      pillBg: "bg-[color-mix(in_oklab,var(--warning)_22%,transparent)]",
      pillText: "text-[var(--warning-foreground)]",
      border: "border-l-[var(--warning)]",
      tint: "bg-[color-mix(in_oklab,var(--warning)_4%,transparent)]",
    },
    paid: {
      dotBg: "bg-[var(--success)]",
      pillBg: "bg-[color-mix(in_oklab,var(--success)_18%,transparent)]",
      pillText: "text-[var(--success)]",
      border: "border-l-[var(--success)]",
      tint: "bg-[color-mix(in_oklab,var(--success)_4%,transparent)]",
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Outstanding across all unpaid weeks</p>
          <p className="text-2xl font-bold tabular-nums">{fmtMoney(outstanding)}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includePaid}
            onChange={(e) => setIncludePaid(e.target.checked)}
            className="h-4 w-4"
          />
          Show paid weeks
        </label>
      </div>

      {q.isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-sm text-muted-foreground text-center">
            {includePaid ? "No payouts on record yet." : "All caught up — no unpaid weeks."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((row: any) => {
            const s = statusStyles[row.status];
            const weekLabel = `${fmtDate(row.weekStart)} – ${fmtDate(row.weekEnd)}`;
            const tip = row.tipAmount;
            const tipChip =
              row.status === "paid" && tip != null && Math.abs(tip) >= 0.005 ? (
                <span
                  className={`inline-flex items-center text-sm px-2.5 py-1 rounded-full ${
                    tip > 0
                      ? "bg-[color-mix(in_oklab,var(--success)_15%,transparent)] text-[var(--success)]"
                      : "bg-[color-mix(in_oklab,var(--destructive)_15%,transparent)] text-[var(--destructive)]"
                  }`}
                >
                  {tip > 0 ? `+${fmtMoney(tip)} tip` : `${fmtMoney(tip)} short`}
                </span>
              ) : null;
            return (
              <Card
                key={`${row.workerId}-${row.weekStart}`}
                className={`border-l-4 ${s.border} ${s.tint}`}
              >
                <CardContent className="p-3 sm:p-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{row.workerName}</p>
                      <span
                        className={`inline-flex items-center gap-1 text-sm px-2.5 py-1 rounded-full ${s.pillBg} ${s.pillText}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${s.dotBg}`} />
                        {row.status === "overdue"
                          ? "Overdue"
                          : row.status === "paid"
                            ? "Paid"
                            : "Unpaid"}
                      </span>
                      {tipChip}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {weekLabel} · {row.hours.toFixed(2)} hrs · reimb{" "}
                      {fmtMoney(row.reimbursements)}
                      {row.paidAt ? ` · paid ${new Date(row.paidAt).toLocaleDateString()}` : ""}
                      {row.status === "paid" && row.actualPaid != null
                        ? ` · cash ${fmtMoney(row.actualPaid)}`
                        : ""}
                      {row.paidByPerson ? ` · by ${row.paidByPerson}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums font-bold text-lg">{fmtMoney(row.total)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Owed
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={row.status === "paid" ? "outline" : "default"}
                    onClick={() => {
                      if (row.status === "paid") {
                        unmark(row.workerId, row.weekStart);
                      } else {
                        setPayDialog({
                          workerId: row.workerId,
                          workerName: row.workerName,
                          weekStart: row.weekStart,
                          owed: row.total,
                        });
                        setPayAmt("");
                      }
                    }}
                  >
                    {row.status === "paid" ? "Undo" : "Mark paid"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!payDialog}
        onOpenChange={(o) => {
          if (!o && !paySubmitting) {
            setPayDialog(null);
            setPayAmt("");
            setPayer(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark week paid</DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-medium">{payDialog.workerName}</p>
                <p className="text-xs text-muted-foreground">
                  Week of {fmtDate(payDialog.weekStart)}
                </p>
                <p className="mt-2 flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Owed</span>
                  <span className="font-semibold tabular-nums">{fmtMoney(payDialog.owed)}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Paid by</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Michael", "Dylan"] as const).map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={payer === p ? "default" : "outline"}
                      onClick={() => setPayer(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cash-paid" className="text-xs">
                  Amount paid in cash
                </Label>
                <Input
                  id="cash-paid"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 650.00"
                  value={payAmt}
                  onChange={(e) => setPayAmt(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitPay();
                  }}
                />
                {(() => {
                  const n = parseFloat(payAmt);
                  if (!isFinite(n)) return null;
                  const diff = Number((n - payDialog.owed).toFixed(2));
                  if (Math.abs(diff) < 0.005)
                    return <p className="text-xs text-muted-foreground">Exact amount.</p>;
                  return (
                    <p
                      className={`text-xs ${diff > 0 ? "text-[var(--success)]" : "text-[var(--destructive)]"}`}
                    >
                      {diff > 0 ? `+${fmtMoney(diff)} tip / rounding` : `${fmtMoney(diff)} short`}
                    </p>
                  );
                })()}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={paySubmitting}
              onClick={() => {
                setPayDialog(null);
                setPayAmt("");
                setPayer(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={submitPay}
              disabled={
                paySubmitting ||
                !payer ||
                !payAmt ||
                !isFinite(parseFloat(payAmt)) ||
                parseFloat(payAmt) < 0
              }
            >
              {paySubmitting ? "Saving…" : "Confirm paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Lifetime payout =====

function LifetimePayoutView({
  token,
  updateToken,
}: {
  token: string;
  updateToken: (t: string) => void;
}) {
  const payFn = useServerFn(lifetimePayout);
  const pq = useQuery({
    queryKey: ["payout-lifetime"],
    queryFn: () =>
      payFn({ data: { token } }).then((r) => {
        updateToken(r.token);
        return r.summary;
      }),
  });

  const downloadCsv = () => {
    if (!pq.data) return;
    const header = "Worker,Hours,Rate,Wages,Reimbursements,Total\n";
    const rows = pq.data
      .map(
        (s: any) =>
          `"${s.name}",${s.hours.toFixed(2)},${s.hourlyRate.toFixed(2)},${s.wages.toFixed(2)},${s.reimbTotal.toFixed(2)},${s.total.toFixed(2)}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-lifetime.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grandTotal = (pq.data ?? []).reduce((s: number, x: any) => s + x.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">All-time totals across every worker</p>
          <p className="text-2xl font-bold tabular-nums">{fmtMoney(grandTotal)}</p>
        </div>
        <Button onClick={downloadCsv} disabled={!pq.data?.length}>
          <Download className="h-4 w-4 mr-2" />
          Lifetime CSV
        </Button>
      </div>

      {pq.isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : pq.data?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-sm text-muted-foreground text-center">
            No workers yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {pq.data?.map((s: any) => {
            const initials = s.name
              .split(/\s+/)
              .map((p: string) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <Card
                key={s.workerId}
                className="overflow-hidden flex flex-col border-l-4 border-l-[var(--success)] bg-[color-mix(in_oklab,var(--success)_4%,transparent)]"
              >
                <CardHeader className="flex-row items-center gap-3 space-y-0 py-4">
                  <span className="h-9 w-9 shrink-0 rounded-full bg-secondary text-secondary-foreground inline-flex items-center justify-center text-xs font-semibold">
                    {initials || "?"}
                  </span>
                  <p className="font-bold text-lg truncate">{s.name}</p>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 pt-0 pb-4">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">Labour</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {s.hours.toFixed(2)} hrs × ${s.hourlyRate.toFixed(2)}
                      </p>
                    </div>
                    <span className="tabular-nums font-semibold">{fmtMoney(s.wages)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">Reimbursements</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {s.reimbCount} {s.reimbCount === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <span className="tabular-nums font-semibold">{fmtMoney(s.reimbTotal)}</span>
                  </div>
                </CardContent>
                <div className="flex items-baseline justify-between gap-3 bg-muted/60 border-t border-border px-6 py-3">
                  <span className="text-sm font-semibold">Total earned</span>
                  <span className="tabular-nums font-bold text-lg">{fmtMoney(s.total)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== Settings tab =====
function SettingsTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const sFn = useServerFn(getPublicSettings);
  const upd = useServerFn(updateSettings);
  const chFn = useServerFn(adminChangePassword);
  const qc = useQueryClient();

  const sq = useQuery({ queryKey: ["pub-settings"], queryFn: () => sFn() });
  const [pw, setPw] = useState("");

  const setS = async (
    patch: Partial<{ projectTrackingEnabled: boolean; showPayEstimates: boolean }>,
  ) => {
    if (!sq.data) return;
    try {
      const r = await upd({
        data: {
          token,
          projectTrackingEnabled: patch.projectTrackingEnabled ?? sq.data.project_tracking_enabled,
          showPayEstimates: patch.showPayEstimates ?? sq.data.show_pay_estimates,
        },
      });
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["pub-settings"] });
      toast.success("Settings updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Workspace settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Project / Job-site tracking</p>
              <p className="text-xs text-muted-foreground">
                Show project field on worker clock-in.
              </p>
            </div>
            <Switch
              checked={!!sq.data?.project_tracking_enabled}
              onCheckedChange={(v) => setS({ projectTrackingEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Show pay estimates to workers</p>
              <p className="text-xs text-muted-foreground">
                Workers see weekly $ estimate (off by default).
              </p>
            </div>
            <Switch
              checked={!!sq.data?.show_pay_estimates}
              onCheckedChange={(v) => setS({ showPayEstimates: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change admin password</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            type="password"
            placeholder="New password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="flex-1 min-w-[180px]"
          />
          <Button
            disabled={pw.length < 4}
            className="w-full sm:w-auto"
            onClick={async () => {
              try {
                const r = await chFn({ data: { token, newPassword: pw } });
                updateToken(r.token);
                setPw("");
                toast.success("Password changed");
              } catch (e: any) {
                toast.error(e?.message || "Failed");
              }
            }}
          >
            Update
          </Button>
        </CardContent>
      </Card>

      <GoogleSheetsSettingsCard token={token} updateToken={updateToken} />

      <WorkerExportSettingsCard token={token} updateToken={updateToken} />
      <ProjectSummaryExportCard token={token} updateToken={updateToken} />
      <CashExportSettingsCard token={token} updateToken={updateToken} />
    </div>
  );
}

function GoogleSheetsSettingsCard({
  token,
  updateToken,
}: {
  token: string;
  updateToken: (t: string) => void;
}) {
  const getFn = useServerFn(getSheetSettings);
  const updFn = useServerFn(updateSheetSettings);
  const backFn = useServerFn(backfillSheet);
  const qc = useQueryClient();
  const [sheetId, setSheetId] = useState("");
  const [tab, setTab] = useState("Receipts");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const q = useQuery({
    queryKey: ["sheet-settings"],
    queryFn: () =>
      getFn({ data: { token } }).then((r) => {
        updateToken(r.token);
        return r;
      }),
  });

  useEffect(() => {
    if (q.data?.settings) {
      setSheetId(q.data.settings.google_sheet_id || "");
      setTab(q.data.settings.google_sheet_tab || "Receipts");
      setEnabled(!!q.data.settings.sheet_sync_enabled);
    }
  }, [q.data]);

  const save = async (patch: { sheetId?: string; tab?: string; enabled?: boolean }) => {
    setSaving(true);
    try {
      const r = await updFn({ data: { token, ...patch } });
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["sheet-settings"] });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const backfill = async () => {
    setBackfilling(true);
    try {
      const r = await backFn({ data: { token } });
      updateToken(r.token);
      const parts = [`Synced ${r.synced}`];
      if (r.skipped) parts.push(`${r.skipped} skipped`);
      if (r.failed) parts.push(`${r.failed} failed`);
      const msg = parts.join(" · ");
      if (r.failed) toast.error(`${msg}${r.firstError ? ` — ${r.firstError}` : ""}`);
      else toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBackfilling(false);
    }
  };

  const connectorReady = q.data?.connectorReady;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sheet className="h-4 w-4" /> Google Sheets sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connectorReady ? (
          <p className="text-sm text-muted-foreground">
            Google Sheets connection missing. Reconnect via the workspace connectors panel.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Each parsed receipt is appended (or updated) as a row in your Google Sheet. Paste a
              Sheet URL or its ID below.
            </p>
            <div>
              <Label className="text-xs">Sheet URL or ID</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                />
                <Button onClick={() => save({ sheetId })} disabled={saving} variant="outline">
                  Save
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tab name</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={tab} onChange={(e) => setTab(e.target.value)} />
                  <Button onClick={() => save({ tab })} disabled={saving} variant="outline">
                    Save
                  </Button>
                </div>
              </div>
              <div className="flex items-end">
                <div className="flex items-center justify-between w-full p-2 rounded-md border border-border">
                  <span className="text-sm">Auto-sync</span>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => {
                      setEnabled(v);
                      save({ enabled: v });
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={backfill}
                disabled={backfilling || !sheetId}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {backfilling ? "Syncing…" : "Backfill all receipts"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CashExportSettingsCard({
  token,
  updateToken,
}: {
  token: string;
  updateToken: (t: string) => void;
}) {
  const getFn = useServerFn(getCashExportSettingsFn);
  const updFn = useServerFn(updateCashExportSettings);
  const testFn = useServerFn(testCashExportFn);
  const qc = useQueryClient();
  const [sheetId, setSheetId] = useState("");
  const [tab, setTab] = useState("Cash Tracking");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const q = useQuery({
    queryKey: ["cash-export-settings"],
    queryFn: () =>
      getFn({ data: { token } }).then((r) => {
        updateToken(r.token);
        return r;
      }),
  });

  useEffect(() => {
    const s = q.data?.settings;
    if (!s) return;
    setSheetId(s.cash_export_sheet_id || "");
    setTab(s.cash_export_tab || "Cash Tracking");
    setEnabled(!!s.cash_export_enabled);
  }, [q.data]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await updFn({ data: { token, sheetId, tab, enabled } });
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["cash-export-settings"] });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await testFn({ data: { token } });
      updateToken(r.token);
      if (r.ok) {
        toast.success(
          `Connected — next rows: Michael ${r.nextRows.Michael}, Dylan ${r.nextRows.Dylan}`,
        );
      } else {
        toast.error(r.error || "Failed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setTesting(false);
    }
  };

  const connectorReady = q.data?.connectorReady;
  const resolvedId = sheetId.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] || sheetId;
  const sheetUrl = resolvedId ? `https://docs.google.com/spreadsheets/d/${resolvedId}/edit` : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sheet className="h-4 w-4" /> Cash tracking export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connectorReady ? (
          <p className="text-sm text-muted-foreground">
            Google Sheets connection missing. Reconnect via the workspace connectors panel.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              When a worker week is marked paid, a row is appended to the payer's column block
              (Michael B–E, Dylan H–K) with the cash amount as money out, the date, and a
              "Name Aug 3 to 9" comment.
            </p>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">Write rows on mark paid</Label>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div>
              <Label className="text-xs">Sheet URL or ID</Label>
              <Input
                className="mt-1"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
              />
            </div>
            <div>
              <Label className="text-xs">Tab name</Label>
              <Input
                className="mt-1"
                value={tab}
                onChange={(e) => setTab(e.target.value)}
                placeholder="Cash Tracking"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {sheetUrl && (
                  <a href={sheetUrl} target="_blank" rel="noreferrer" className="underline">
                    Open sheet
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={test} disabled={testing || !sheetId}>
                  {testing ? "Testing…" : "Test connection"}
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WorkerExportSettingsCard({
  token,
  updateToken,
}: {
  token: string;
  updateToken: (t: string) => void;
}) {
  const getFn = useServerFn(getWorkerExportSettings);
  const updFn = useServerFn(updateWorkerExportSettings);
  const runFn = useServerFn(runWorkerSheetExportFn);
  const qc = useQueryClient();
  const [sheetId, setSheetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const q = useQuery({
    queryKey: ["worker-export-settings"],
    queryFn: () =>
      getFn({ data: { token } }).then((r) => {
        updateToken(r.token);
        return r;
      }),
  });

  useEffect(() => {
    if (q.data?.settings) setSheetId(q.data.settings.worker_export_sheet_id || "");
  }, [q.data]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await updFn({ data: { token, sheetId } });
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["worker-export-settings"] });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      const r = await runFn({ data: { token } });
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["worker-export-settings"] });
      toast.success(`Synced ${r.workers} workers · ${r.entries} entries · ${r.payouts} payouts`);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setRunning(false);
    }
  };

  const connectorReady = q.data?.connectorReady;
  const lastSync = q.data?.settings?.worker_export_last_sync_at;
  const resolvedId = sheetId.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] || sheetId;
  const sheetUrl = resolvedId ? `https://docs.google.com/spreadsheets/d/${resolvedId}/edit` : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sheet className="h-4 w-4" /> Worker data export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connectorReady ? (
          <p className="text-sm text-muted-foreground">
            Google Sheets connection missing. Reconnect via the workspace connectors panel.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Full overwrite of all worker time entries and payouts. One tab per worker per data
              type. Runs nightly at 1:00 AM ET, and can be triggered manually below.
            </p>
            <div>
              <Label className="text-xs">Sheet URL or ID</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                />
                <Button onClick={save} disabled={saving} variant="outline">
                  Save
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {lastSync ? (
                  <>Last sync: {new Date(lastSync).toLocaleString()}</>
                ) : (
                  <>Not synced yet.</>
                )}
                {sheetUrl && (
                  <>
                    {" "}
                    ·{" "}
                    <a href={sheetUrl} target="_blank" rel="noreferrer" className="underline">
                      Open sheet
                    </a>
                  </>
                )}
              </div>
              <Button size="sm" onClick={run} disabled={running || !sheetId}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${running ? "animate-spin" : ""}`} />
                {running ? "Syncing…" : "Sync to Sheets now"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectSummaryExportCard({
  token,
  updateToken,
}: {
  token: string;
  updateToken: (t: string) => void;
}) {
  const getFn = useServerFn(getProjectSummaryExportSettings);
  const updFn = useServerFn(updateProjectSummaryExportSettings);
  const runFn = useServerFn(runProjectSummaryExportFn);
  const qc = useQueryClient();
  const [sheetId, setSheetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const q = useQuery({
    queryKey: ["project-summary-export-settings"],
    queryFn: () =>
      getFn({ data: { token } }).then((r) => {
        updateToken(r.token);
        return r;
      }),
  });

  useEffect(() => {
    if (q.data?.settings) setSheetId(q.data.settings.project_summary_sheet_id || "");
  }, [q.data]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await updFn({ data: { token, sheetId } });
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["project-summary-export-settings"] });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      const r = await runFn({ data: { token } });
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["project-summary-export-settings"] });
      toast.success(`Exported ${r.projects} projects`);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setRunning(false);
    }
  };

  const connectorReady = q.data?.connectorReady;
  const lastSync = q.data?.settings?.project_summary_last_sync_at;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sheet className="h-4 w-4" /> Project summary export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connectorReady ? (
          <p className="text-sm text-muted-foreground">
            Google Sheets connection missing. Reconnect via the workspace connectors panel.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Writes one row per active project — contract, change orders, payments, each cost
              bucket, profit and margin — into its own “Project Summary” tab. Output only; nothing
              is read back, and the Cash Tracking layout is never touched.
            </p>
            <div>
              <Label className="text-xs">Sheet URL or ID</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                />
                <Button onClick={save} disabled={saving} variant="outline">
                  Save
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {lastSync ? <>Last export: {new Date(lastSync).toLocaleString()}</> : <>Not exported yet.</>}
              </div>
              <Button size="sm" onClick={run} disabled={running || !sheetId}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${running ? "animate-spin" : ""}`} />
                {running ? "Exporting…" : "Export project summary"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Job Sites tab =====
function JobSitesTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const listFn = useServerFn(adminListJobSites);
  const addFn = useServerFn(adminAddJobSite);
  const updFn = useServerFn(adminUpdateJobSite);
  const delFn = useServerFn(adminDeleteJobSite);
  const archFn = useServerFn(adminArchiveJobSite);
  const completeFn = useServerFn(adminSetJobSiteCompleted);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["job-sites"],
    queryFn: () =>
      listFn({ data: { token } }).then((r) => {
        updateToken(r.token);
        return r.sites;
      }),
  });

  const [view, setView] = useState<"client" | "completed" | "supplier" | "archived">("client");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"client" | "supplier">("client");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [radius, setRadius] = useState(250);
  const [editing, setEditing] = useState<any | null>(null);
  const [eLabel, setELabel] = useState("");
  const [eAddress, setEAddress] = useState("");
  const [eRadius, setERadius] = useState(100);
  const [eKind, setEKind] = useState<"client" | "supplier">("client");
  const [eOrigAddress, setEOrigAddress] = useState("");

  const openEdit = (s: any) => {
    setEditing(s);
    setELabel(s.label ?? "");
    setEAddress(s.address ?? "");
    setEOrigAddress(s.address ?? "");
    setERadius(s.radius_m ?? 250);
    setEKind((s.kind ?? "client") as "client" | "supplier");
  };

  const reset = () => {
    setAddress("");
    setLabel("");
    setRadius(100);
    setKind("client");
  };

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          token,
          address: address.trim(),
          label: label.trim() || undefined,
          radius_m: radius,
          kind,
        },
      }),
    onSuccess: (r) => {
      updateToken(r.token);
      toast.success(kind === "supplier" ? "Supplier location added" : "Job site added");
      setView(kind);
      reset();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not geocode address"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { token, id } }),
    onSuccess: (r) => {
      updateToken(r.token);
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const upd = useMutation({
    mutationFn: (v: {
      id: string;
      label: string;
      radius_m: number;
      address?: string;
      kind?: "client" | "supplier";
    }) => updFn({ data: { token, ...v } }),
    onSuccess: (r) => {
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const saveEdit = useMutation({
    mutationFn: (v: {
      id: string;
      label: string;
      radius_m: number;
      address?: string;
      kind: "client" | "supplier";
    }) => updFn({ data: { token, ...v } }),
    onSuccess: (r) => {
      updateToken(r.token);
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not save"),
  });

  const arch = useMutation({
    mutationFn: (v: { id: string; archived: boolean }) => archFn({ data: { token, ...v } }),
    onSuccess: (r, vars) => {
      updateToken(r.token);
      toast.success(vars.archived ? "Job archived" : "Job restored");
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const completeMut = useMutation({
    mutationFn: (v: { id: string; completed: boolean }) => completeFn({ data: { token, ...v } }),
    onSuccess: (r, vars) => {
      updateToken(r.token);
      toast.success(vars.completed ? "Moved to Completed" : "Job reopened");
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const all = q.data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((s: any) => {
      const isArchived = !!s.archived_at;
      const isCompleted = !!s.completed_at;
      const k = s.kind ?? "client";
      if (view === "archived" && !isArchived) return false;
      if (view !== "archived" && isArchived) return false;
      if (view === "client" && (k !== "client" || isCompleted)) return false;
      if (view === "completed" && (k !== "client" || !isCompleted)) return false;
      if (view === "supplier" && k !== "supplier") return false;
      if (!term) return true;
      return (
        (s.label ?? "").toLowerCase().includes(term) ||
        (s.address ?? "").toLowerCase().includes(term)
      );
    });
  }, [all, view, search]);

  const counts = useMemo(() => {
    let client = 0,
      completed = 0,
      supplier = 0,
      archived = 0;
    for (const s of all as any[]) {
      if (s.archived_at) archived++;
      else if ((s.kind ?? "client") === "supplier") supplier++;
      else if (s.completed_at) completed++;
      else client++;
    }
    return { client, completed, supplier, archived };
  }, [all]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold">Job Sites</h2>
          <p className="text-xs text-muted-foreground">
            Active jobs verify clock-ins. Supplier locations are recognized but not counted as job
            work. Archived jobs are hidden from verification.
          </p>
        </div>
        <div className="flex gap-2">
          <BulkAddDialog token={token} updateToken={updateToken} onAdded={(k) => setView(k)} />
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) reset();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add location</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (address.trim()) add.mutate();
                }}
                className="space-y-4"
              >
                <div>
                  <Label className="mb-1.5 block">Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKind("client")}
                      className={`flex items-center gap-2 rounded-md border p-2.5 text-sm text-left ${kind === "client" ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <Building2 className="h-4 w-4 text-success" />
                      <div className="leading-tight">
                        <div className="font-medium">Client job</div>
                        <div className="text-[11px] text-muted-foreground">Verified work site</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setKind("supplier")}
                      className={`flex items-center gap-2 rounded-md border p-2.5 text-sm text-left ${kind === "supplier" ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <Truck className="h-4 w-4 text-primary" />
                      <div className="leading-tight">
                        <div className="font-medium">Supplier</div>
                        <div className="text-[11px] text-muted-foreground">Home Depot, Rona…</div>
                      </div>
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="addr">Address</Label>
                  <Input
                    id="addr"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Oak St, Springfield"
                    autoFocus
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll look up the location automatically.
                  </p>
                </div>
                <div>
                  <Label htmlFor="lbl">Friendly name (optional)</Label>
                  <Input
                    id="lbl"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={
                      kind === "supplier" ? "e.g. Home Depot - Main St" : "e.g. Smith Reno"
                    }
                    maxLength={80}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="rad">Radius: {radius} m</Label>
                  <input
                    id="rad"
                    type="range"
                    min={50}
                    max={500}
                    step={10}
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value))}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Larger = more lenient. Default 100 m works for most sites.
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={add.isPending || !address.trim()}>
                    {add.isPending ? "Looking up…" : "Add location"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="inline-flex rounded-md border bg-card p-0.5 text-xs w-fit">
          {(["client", "completed", "supplier", "archived"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded capitalize ${view === v ? "bg-secondary font-medium" : "text-muted-foreground"}`}
            >
              {v === "client"
                ? `Active jobs (${counts.client})`
                : v === "completed"
                  ? `Completed (${counts.completed})`
                  : v === "supplier"
                    ? `Suppliers (${counts.supplier})`
                    : `Archived (${counts.archived})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={view === "archived" ? "Search archived…" : "Search…"}
            className="pl-8 h-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {q.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              {view === "archived"
                ? search
                  ? "No archived jobs match your search."
                  : "No archived jobs yet."
                : view === "supplier"
                  ? "No supplier locations yet. Add Home Depot, Rona, etc. to recognize material pickup stops."
                  : "No active job sites yet. Add one to enable geo-verification."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((s: any) => {
                const isArchived = !!s.archived_at;
                const isSupplier = (s.kind ?? "client") === "supplier";
                const isCompleted = !!s.completed_at;
                return (
                  <li key={s.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => !isArchived && openEdit(s)}
                        className={`block w-full text-left rounded -mx-1 px-1 py-0.5 ${isArchived ? "cursor-default" : "hover:bg-secondary/60 cursor-pointer"}`}
                        title={isArchived ? undefined : "Click to edit"}
                      >
                        <p className="font-medium truncate flex items-center gap-1.5">
                          {isSupplier ? (
                            <Truck className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Building2
                              className={`h-4 w-4 shrink-0 ${isArchived ? "text-muted-foreground" : isCompleted ? "text-warning" : "text-success"}`}
                            />
                          )}
                          <span className={isArchived ? "text-muted-foreground" : ""}>
                            {s.label}
                          </span>
                          {isArchived && (
                            <Badge variant="outline" className="h-4 text-[10px] ml-1">
                              Archived
                            </Badge>
                          )}
                          {isCompleted && !isArchived && (
                            <Badge
                              variant="outline"
                              className="h-4 text-[10px] ml-1 border-warning text-warning"
                            >
                              Completed
                            </Badge>
                          )}
                          {!isArchived && (
                            <Pencil className="h-3 w-3 text-muted-foreground/60 ml-1 shrink-0" />
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{s.address}</p>
                      </button>

                      {!isArchived && (
                        <div className="flex items-center gap-2 mt-2">
                          <Label className="text-xs text-muted-foreground">Radius</Label>
                          <input
                            type="range"
                            min={50}
                            max={500}
                            step={10}
                            defaultValue={s.radius_m}
                            onChange={(e) => {
                              const v = parseInt(e.target.value);
                              upd.mutate({ id: s.id, label: s.label, radius_m: v });
                            }}
                            className="flex-1 max-w-[200px]"
                          />
                          <span className="text-xs tabular-nums w-16">{s.radius_m} m</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!isArchived && !isSupplier && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            completeMut.mutate({ id: s.id, completed: !isCompleted })
                          }
                        >
                          {isCompleted ? "Reopen" : "Complete"}
                        </Button>
                      )}
                      {isArchived ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => arch.mutate({ id: s.id, archived: false })}
                          >
                            <ArchiveRestore className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Delete permanently">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete this location permanently?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This cannot be undone. Time entries linked to it lose the site
                                  label.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del.mutate(s.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={isSupplier ? "Remove supplier" : "Archive job"}
                            >
                              {isSupplier ? (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              ) : (
                                <Archive className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {isSupplier
                                  ? "Remove this supplier location?"
                                  : "Archive this job?"}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {isSupplier
                                  ? "It will no longer be recognized on clock-ins. Existing entries keep their tag."
                                  : "Archived jobs are hidden from geo-verification but can be restored anytime. Existing entries stay tagged."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  isSupplier
                                    ? del.mutate(s.id)
                                    : arch.mutate({ id: s.id, archived: true })
                                }
                              >
                                {isSupplier ? "Remove" : "Archive"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit location</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!eLabel.trim() || !eAddress.trim()) return;
                saveEdit.mutate({
                  id: editing.id,
                  label: eLabel.trim(),
                  radius_m: eRadius,
                  kind: eKind,
                  address: eAddress.trim() !== eOrigAddress ? eAddress.trim() : undefined,
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label className="mb-1.5 block">Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEKind("client")}
                    className={`flex items-center gap-2 rounded-md border p-2.5 text-sm text-left ${eKind === "client" ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <Building2 className="h-4 w-4 text-success" />
                    <div className="leading-tight">
                      <div className="font-medium">Client job</div>
                      <div className="text-[11px] text-muted-foreground">Verified work site</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEKind("supplier")}
                    className={`flex items-center gap-2 rounded-md border p-2.5 text-sm text-left ${eKind === "supplier" ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <Truck className="h-4 w-4 text-primary" />
                    <div className="leading-tight">
                      <div className="font-medium">Supplier</div>
                      <div className="text-[11px] text-muted-foreground">Home Depot, Rona…</div>
                    </div>
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="e-lbl">Friendly name</Label>
                <Input
                  id="e-lbl"
                  value={eLabel}
                  onChange={(e) => setELabel(e.target.value)}
                  maxLength={80}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="e-addr">Address</Label>
                <Input
                  id="e-addr"
                  value={eAddress}
                  onChange={(e) => setEAddress(e.target.value)}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {eAddress.trim() !== eOrigAddress
                    ? "Address changed — we'll re-geocode on save."
                    : "Edit to move the geofence to a new location."}
                </p>
              </div>
              <div>
                <Label htmlFor="e-rad">Radius: {eRadius} m</Label>
                <input
                  id="e-rad"
                  type="range"
                  min={50}
                  max={500}
                  step={10}
                  value={eRadius}
                  onChange={(e) => setERadius(parseInt(e.target.value))}
                  className="w-full mt-2"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveEdit.isPending || !eLabel.trim() || !eAddress.trim()}
                >
                  {saveEdit.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type GeoStatus = "verified" | "callback" | "supplier" | "off_site" | "no_gps";

const REASON_LABELS: Record<string, string> = {
  material_pickup: "Material pickup",
  client_visit: "Client visit",
  travel: "Travel between sites",
  forgot_clockout: "Forgot to clock out",
  new_site: "New / unlisted site",
  other: "Other",
};
function reasonLabel(code: string | null | undefined) {
  if (!code) return "";
  return REASON_LABELS[code] ?? code;
}

function GeoTagEditor({
  entry,
  sites,
  onUpdate,
  onUpdatePlanned,
  field = "in",
}: {
  entry: any;
  field?: "in" | "out";
  sites: Array<{ id: string; label: string; kind?: string; archived_at?: string | null; completed_at?: string | null }>;
  onUpdate: (status: GeoStatus, jobSiteId: string | null) => void | Promise<void>;
  onUpdatePlanned?: (jobSiteId: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const status: GeoStatus | null =
    (field === "out" ? entry.clock_out_geo_status : entry.geo_status) ?? null;
  const siteLabel: string | null =
    field === "out" ? (entry.clock_out_site?.label ?? null) : (entry.job_sites?.label ?? null);
  const prefix = field === "out" ? "Out: " : "In: ";

  const trigger =
    status === "verified" && siteLabel ? (
      <Badge
        variant="outline"
        className="h-4 text-[10px] border-success text-success cursor-pointer hover:bg-success/10"
      >
        <MapPin className="h-2.5 w-2.5 mr-0.5" />
        {prefix}
        {siteLabel}
      </Badge>
    ) : status === "callback" && siteLabel ? (
      <Badge
        variant="outline"
        className="h-4 text-[10px] border-warning text-warning cursor-pointer hover:bg-warning/10"
      >
        <MapPin className="h-2.5 w-2.5 mr-0.5" />
        {prefix}Callback · {siteLabel}
      </Badge>
    ) : status === "supplier" && siteLabel ? (
      <Badge
        variant="outline"
        className="h-4 text-[10px] border-primary text-primary cursor-pointer hover:bg-primary/10"
      >
        <Truck className="h-2.5 w-2.5 mr-0.5" />
        {prefix}
        {siteLabel}
      </Badge>
    ) : status === "off_site" ? (
      <Badge
        variant="outline"
        className="h-4 text-[10px] border-warning text-warning cursor-pointer hover:bg-warning/10"
      >
        <MapPin className="h-2.5 w-2.5 mr-0.5" />
        {prefix}Off-site
      </Badge>
    ) : status === "no_gps" ? (
      <Badge
        variant="outline"
        className="h-4 text-[10px] text-muted-foreground cursor-pointer hover:bg-secondary"
      >
        <MapPinOff className="h-2.5 w-2.5 mr-0.5" />
        {prefix}No GPS
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="h-4 text-[10px] text-muted-foreground cursor-pointer hover:bg-secondary"
      >
        <MapPinOff className="h-2.5 w-2.5 mr-0.5" />
        {prefix}Set tag
      </Badge>
    );

  const pick = async (s: GeoStatus, jid: string | null) => {
    setOpen(false);
    await onUpdate(s, jid);
  };

  const active = sites.filter((s) => !s.archived_at);
  const clientSites = active.filter((s) => (s.kind ?? "client") === "client" && !s.completed_at);
  const completedSites = active.filter((s) => (s.kind ?? "client") === "client" && !!s.completed_at);
  const supplierSites = active.filter((s) => s.kind === "supplier");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex" aria-label="Edit geo tag">
          {trigger}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1 max-h-80 overflow-y-auto" align="start">
        {entry.offsite_reason_code && (
          <div className="px-2 py-2 mb-1 rounded bg-warning/10 border border-warning/30 text-[11px]">
            <div className="font-semibold text-warning uppercase tracking-wide mb-0.5">
              Worker reason
            </div>
            <div className="text-foreground">{reasonLabel(entry.offsite_reason_code)}</div>
            {entry.offsite_reason_note && (
              <div className="text-muted-foreground italic mt-0.5">
                "{entry.offsite_reason_note}"
              </div>
            )}
          </div>
        )}
        {onUpdatePlanned && (
          <div className="px-2 py-2 mb-1 rounded bg-primary/5 border border-primary/20">
            <div className="text-[11px] font-medium text-primary uppercase tracking-wide mb-1">
              Planned job
            </div>
            <Select
              value={entry.planned_job_site_id ?? "__none__"}
              onValueChange={async (v) => {
                await onUpdatePlanned(v === "__none__" ? null : v);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {clientSites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Client job
        </div>

        {clientSites.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No active jobs</div>
        )}
        {clientSites.map((s) => {
          const isActive = status === "verified" && entry.job_site_id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => pick("verified", s.id)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary flex items-center gap-1.5 ${isActive ? "bg-secondary" : ""}`}
            >
              <Building2 className="h-3 w-3 text-success" />
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}

        {completedSites.length > 0 && (
          <>
            <div className="my-1 h-px bg-border" />
            <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Completed jobs (callback)
            </div>
            {completedSites.map((s) => {
              const isCurrent = status === "callback" && entry.job_site_id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick("callback", s.id)}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary flex items-center gap-1.5 ${isCurrent ? "bg-secondary" : ""}`}
                >
                  <Building2 className="h-3 w-3 text-warning" />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </>
        )}

        {supplierSites.length > 0 && (
          <>
            <div className="my-1 h-px bg-border" />
            <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Supplier
            </div>
            {supplierSites.map((s) => {
              const isActive = status === "supplier" && entry.job_site_id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick("supplier", s.id)}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary flex items-center gap-1.5 ${isActive ? "bg-secondary" : ""}`}
                >
                  <Truck className="h-3 w-3 text-primary" />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </>
        )}

        <div className="my-1 h-px bg-border" />
        <button
          type="button"
          onClick={() => pick("off_site", null)}
          className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary flex items-center gap-1.5 ${status === "off_site" ? "bg-secondary" : ""}`}
        >
          <MapPin className="h-3 w-3 text-warning" /> Off-site
        </button>
        <button
          type="button"
          onClick={() => pick("no_gps", null)}
          className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary flex items-center gap-1.5 ${status === "no_gps" ? "bg-secondary" : ""}`}
        >
          <MapPinOff className="h-3 w-3 text-muted-foreground" /> No GPS
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ===== Audit Log tab =====
function AuditTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const listFn = useServerFn(adminListAuditLog);
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterActor, setFilterActor] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", filterEntity, filterActor],
    queryFn: async () => {
      const res = await listFn({
        data: {
          token,
          entityType: filterEntity === "all" ? undefined : filterEntity,
          actorKind:
            filterActor === "all" ? undefined : (filterActor as "admin" | "worker" | "system"),
          limit: 300,
        },
      });
      if (res.token !== token) updateToken(res.token);
      return res.entries;
    },
  });

  const actionLabel = (a: string) => {
    const map: Record<string, string> = {
      clock_in: "Clocked in",
      clock_out: "Clocked out",
      entry_create: "Created time entry",
      entry_edit: "Edited time entry",
      entry_delete: "Deleted time entry",
      entry_geo_update: "Updated geo tag",
      reimbursement_create: "Added reimbursement",
      reimbursement_delete: "Deleted reimbursement",
    };
    return map[a] ?? a;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
        <p className="text-xs text-muted-foreground">
          Append-only history of every change. Records cannot be edited or deleted.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              <SelectItem value="time_entry">Time entries</SelectItem>
              <SelectItem value="reimbursement">Reimbursements</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterActor} onValueChange={setFilterActor}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Actor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="worker">Worker</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No audit records yet.
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((row) => {
              const isOpen = expanded === row.id;
              const hasDetail = row.before || row.after || row.metadata;
              return (
                <div key={row.id} className="border rounded-md text-sm">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : row.id)}
                    className="w-full text-left p-3 hover:bg-secondary/50 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3"
                  >
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(row.created_at)} {fmtTime(row.created_at)}
                    </span>
                    <Badge
                      variant={row.actor_kind === "admin" ? "default" : "secondary"}
                      className="w-fit"
                    >
                      {row.actor_label ?? row.actor_kind}
                    </Badge>
                    <span className="font-medium">{actionLabel(row.action)}</span>
                    <span className="text-xs text-muted-foreground sm:ml-auto truncate">
                      {row.entity_type}
                      {row.entity_id ? ` · ${String(row.entity_id).slice(0, 8)}` : ""}
                    </span>
                  </button>
                  {isOpen && hasDetail && (
                    <div className="border-t p-3 bg-muted/30 grid sm:grid-cols-2 gap-3 text-xs">
                      {row.before != null && (
                        <div>
                          <div className="font-semibold text-muted-foreground mb-1">Before</div>
                          <pre className="whitespace-pre-wrap break-all bg-background p-2 rounded border">
                            {JSON.stringify(row.before, null, 2)}
                          </pre>
                        </div>
                      )}
                      {row.after != null && (
                        <div>
                          <div className="font-semibold text-muted-foreground mb-1">After</div>
                          <pre className="whitespace-pre-wrap break-all bg-background p-2 rounded border">
                            {JSON.stringify(row.after, null, 2)}
                          </pre>
                        </div>
                      )}
                      {row.metadata != null && (
                        <div className="sm:col-span-2">
                          <div className="font-semibold text-muted-foreground mb-1">Metadata</div>
                          <pre className="whitespace-pre-wrap break-all bg-background p-2 rounded border">
                            {JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Bulk add job sites dialog =====
type BulkRow = {
  key: string;
  label: string;
  address: string;
  lat?: number;
  lng?: number;
  source: "paste" | "places";
};

function streetFromAddress(addr: string): string {
  const first = (addr.split(",")[0] || addr).trim();
  return first || addr;
}

function BulkAddDialog({
  token,
  updateToken,
  onAdded,
}: {
  token: string;
  updateToken: (t: string) => void;
  onAdded: (kind: "client" | "supplier") => void;
}) {
  const qc = useQueryClient();
  const searchFn = useServerFn(adminSearchPlaces);
  const bulkFn = useServerFn(adminBulkAddJobSites);

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"client" | "supplier">("supplier");
  const [brand, setBrand] = useState("");
  const [radius, setRadius] = useState(250);
  const [mode, setMode] = useState<"paste" | "search">("paste");
  const [pasteText, setPasteText] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ placeId: string; name: string; address: string; lat: number; lng: number }>
  >([]);
  const [rows, setRows] = useState<BulkRow[]>([]);

  const reset = () => {
    setBrand("");
    setRadius(100);
    setMode("paste");
    setPasteText("");
    setSearchQ("");
    setSearchResults([]);
    setRows([]);
    setKind("supplier");
  };

  const makeLabel = (addr: string) => {
    const street = streetFromAddress(addr);
    return brand.trim() ? `${brand.trim()} — ${street}` : street;
  };

  const addPasted = () => {
    const lines = pasteText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const newRows: BulkRow[] = lines.map((address, i) => ({
      key: `paste-${Date.now()}-${i}`,
      label: makeLabel(address),
      address,
      source: "paste",
    }));
    setRows((prev) => [...prev, ...newRows]);
    setPasteText("");
  };

  const search = useMutation({
    mutationFn: () => searchFn({ data: { token, query: searchQ.trim() } }),
    onSuccess: (r) => {
      updateToken(r.token);
      setSearchResults(r.results);
      if (r.results.length === 0) toast.message("No places found");
    },
    onError: (e: any) => toast.error(e?.message || "Search failed"),
  });

  const togglePlace = (p: {
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
  }) => {
    setRows((prev) => {
      const existing = prev.find((r) => r.key === `place-${p.placeId}`);
      if (existing) return prev.filter((r) => r.key !== `place-${p.placeId}`);
      return [
        ...prev,
        {
          key: `place-${p.placeId}`,
          label: makeLabel(p.address),
          address: p.address,
          lat: p.lat,
          lng: p.lng,
          source: "places",
        },
      ];
    });
  };

  // Re-derive labels when brand changes, only for rows the user hasn't edited
  const [editedKeys, setEditedKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    setRows((prev) =>
      prev.map((r) => (editedKeys.has(r.key) ? r : { ...r, label: makeLabel(r.address) })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  const save = useMutation({
    mutationFn: () =>
      bulkFn({
        data: {
          token,
          kind,
          radius_m: radius,
          items: rows.map((r) => ({
            label: r.label.trim(),
            address: r.address,
            lat: r.lat,
            lng: r.lng,
          })),
        },
      }),
    onSuccess: (r) => {
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["job-sites"] });
      onAdded(kind);
      if (r.failed.length === 0) {
        toast.success(`Added ${r.added} location${r.added === 1 ? "" : "s"}`);
      } else {
        toast.warning(`Added ${r.added}, ${r.failed.length} failed`, {
          description: r.failed
            .slice(0, 3)
            .map((f) => `${f.address}: ${f.reason}`)
            .join("\n"),
        });
      }
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message || "Bulk add failed"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-1" />
          Bulk add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk add locations</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("client")}
              className={`flex items-center gap-2 rounded-md border p-2.5 text-sm text-left ${kind === "client" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <Building2 className="h-4 w-4 text-success" />
              <div className="leading-tight">
                <div className="font-medium">Client jobs</div>
                <div className="text-[11px] text-muted-foreground">Verified work sites</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setKind("supplier")}
              className={`flex items-center gap-2 rounded-md border p-2.5 text-sm text-left ${kind === "supplier" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <Truck className="h-4 w-4 text-primary" />
              <div className="leading-tight">
                <div className="font-medium">Suppliers</div>
                <div className="text-[11px] text-muted-foreground">Home Depot, Rona…</div>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="brand">Brand prefix</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={kind === "supplier" ? "Home Depot" : "Smith Reno"}
                maxLength={60}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Labels become "{brand.trim() || "Brand"} — Street".
              </p>
            </div>
            <div>
              <Label htmlFor="brad">Radius: {radius} m</Label>
              <input
                id="brad"
                type="range"
                min={50}
                max={500}
                step={10}
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
                className="w-full mt-2"
              />
            </div>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="paste">Paste addresses</TabsTrigger>
              <TabsTrigger value="search">Search & pick</TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="space-y-2 mt-3">
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"123 Main St, Toronto, ON\n456 King Rd, Mississauga, ON"}
                rows={5}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={addPasted}
                  disabled={!pasteText.trim()}
                >
                  Add to list
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                One address per line. Geocoded when you save.
              </p>
            </TabsContent>
            <TabsContent value="search" className="space-y-2 mt-3">
              <div className="flex gap-2">
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (searchQ.trim().length >= 2) search.mutate();
                    }
                  }}
                  placeholder="e.g. Home Depot Toronto"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => search.mutate()}
                  disabled={search.isPending || searchQ.trim().length < 2}
                >
                  {search.isPending ? "Searching…" : "Search"}
                </Button>
              </div>
              {searchResults.length > 0 && (
                <ul className="border rounded-md divide-y max-h-64 overflow-y-auto">
                  {searchResults.map((p) => {
                    const checked = rows.some((r) => r.key === `place-${p.placeId}`);
                    return (
                      <li
                        key={p.placeId}
                        className="p-2.5 flex items-start gap-2.5 hover:bg-secondary/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => togglePlace(p)}
                          className="mt-0.5"
                        />
                        <button
                          type="button"
                          onClick={() => togglePlace(p)}
                          className="text-left flex-1 min-w-0"
                        >
                          <p className="text-sm font-medium truncate">
                            {p.name || streetFromAddress(p.address)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>

          {rows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>To add ({rows.length})</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRows([]);
                    setEditedKeys(new Set());
                  }}
                >
                  Clear all
                </Button>
              </div>
              <ul className="border rounded-md divide-y max-h-72 overflow-y-auto">
                {rows.map((r) => (
                  <li key={r.key} className="p-2.5 flex items-start gap-2">
                    <div className="flex-1 min-w-0 space-y-1">
                      <Input
                        value={r.label}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((prev) =>
                            prev.map((x) => (x.key === r.key ? { ...x, label: v } : x)),
                          );
                          setEditedKeys((prev) => new Set(prev).add(r.key));
                        }}
                        maxLength={80}
                        className="h-8 text-sm"
                      />
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        {r.source === "places" ? <MapPin className="h-3 w-3" /> : null}
                        {r.address}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 mt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={save.isPending || rows.length === 0}
            onClick={() => save.mutate()}
          >
            {save.isPending
              ? "Saving…"
              : `Save ${rows.length || ""} location${rows.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
