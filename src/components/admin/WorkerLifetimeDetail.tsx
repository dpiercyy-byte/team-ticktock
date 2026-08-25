import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, ChevronDown, ChevronRight, Download, Pencil, Receipt } from "lucide-react";
import { workerLifetimeDetail } from "@/lib/payout.functions";
import { fmtMoney, fmtHours, fmtDate, fmtTime, weekRangeLabel } from "@/lib/format";

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`tabular-nums font-semibold ${muted ? "text-muted-foreground text-sm" : "text-base"}`}
      >
        {value}
      </p>
    </div>
  );
}

export function WorkerLifetimeDetail({
  token,
  updateToken,
  workerId,
  onBack,
  onEditWeek,
}: {
  token: string;
  updateToken: (t: string) => void;
  workerId: string;
  onBack: () => void;
  onEditWeek: (args: { workerId: string; weekStart: string }) => void;
}) {
  const detailFn = useServerFn(workerLifetimeDetail);
  const q = useQuery({
    queryKey: ["worker-lifetime", workerId],
    queryFn: () =>
      detailFn({ data: { token, workerId } }).then((r) => {
        updateToken(r.token);
        return r;
      }),
  });

  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ url: string; mime: string | null } | null>(null);

  const data = q.data;
  const name = data?.worker.name ?? "Worker";

  const downloadCsv = () => {
    if (!data) return;
    const header = "Week,Hours,Rate,Wages,Reimbursements,Total,Paid,Paid By,Paid At\n";
    const rows = data.weeks
      .map((w) =>
        [
          w.weekStart,
          w.hours.toFixed(2),
          data.worker.hourlyRate.toFixed(2),
          w.wages.toFixed(2),
          w.reimbTotal.toFixed(2),
          w.total.toFixed(2),
          w.payment ? (w.payment.actualPaid ?? w.payment.amount).toFixed(2) : "",
          `"${w.payment?.paidByPerson ?? w.payment?.paidBy ?? ""}"`,
          w.payment?.paidAt ?? "",
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "-").toLowerCase()}-lifetime.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to lifetime list">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-lg truncate">{name}</p>
          {data && (
            <p className="text-xs text-muted-foreground tabular-nums">
              ${data.worker.hourlyRate.toFixed(2)}/hr · {data.totals.weeksWorked} weeks
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!data}>
          <Download className="h-4 w-4 mr-2" />
          CSV
        </Button>
      </div>

      {q.isLoading || !data ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-l-4 border-l-[var(--success)] bg-[color-mix(in_oklab,var(--success)_4%,transparent)]">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 shrink-0 rounded-full bg-secondary text-secondary-foreground inline-flex items-center justify-center text-sm font-semibold">
                  {initials || "?"}
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Total earned all time</p>
                  <p className="text-2xl font-bold tabular-nums">{fmtMoney(data.totals.total)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Hours" value={fmtHours(data.totals.hours)} />
                <Stat label="Wages" value={fmtMoney(data.totals.wages)} />
                <Stat label="Reimburse" value={fmtMoney(data.totals.reimbTotal)} />
                <Stat label="Paid out" value={fmtMoney(data.totals.paidTotal)} />
              </div>
              {data.totals.outstanding > 0.005 && (
                <p className="text-sm font-medium text-[var(--warning,orange)]">
                  {fmtMoney(data.totals.outstanding)} outstanding across {data.totals.unpaidWeeks}{" "}
                  unpaid {data.totals.unpaidWeeks === 1 ? "week" : "weeks"}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Weeks</p>
            {data.weeks.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-sm text-muted-foreground text-center">
                  No recorded weeks yet.
                </CardContent>
              </Card>
            ) : (
              data.weeks.map((w) => {
                const open = openWeek === w.weekStart;
                return (
                  <Card key={w.weekStart} className="overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenWeek(open ? null : w.weekStart)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{weekRangeLabel(w.weekStart)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {fmtHours(w.hours)} · {fmtMoney(w.wages)} wages
                          {w.reimbTotal > 0 ? ` · ${fmtMoney(w.reimbTotal)} reimb` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="tabular-nums font-bold">{fmtMoney(w.total)}</p>
                        {w.payment ? (
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            Paid{w.payment.paidByPerson ? ` · ${w.payment.paidByPerson}` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            Unpaid
                          </Badge>
                        )}
                      </div>
                    </button>

                    {open && (
                      <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/30">
                        <div className="space-y-1.5">
                          {w.entries.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No shifts this week.</p>
                          ) : (
                            w.entries.map((e) => (
                              <div
                                key={e.id}
                                className="flex items-baseline justify-between gap-3 text-sm"
                              >
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{fmtDate(e.clockIn)}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {fmtTime(e.clockIn)} –{" "}
                                    {e.clockOut ? fmtTime(e.clockOut) : "open"}
                                    {e.siteLabel ? ` · ${e.siteLabel}` : ""}
                                  </p>
                                </div>
                                <span className="tabular-nums shrink-0">{fmtHours(e.hours)}</span>
                              </div>
                            ))
                          )}
                        </div>

                        {w.receipts.length > 0 && (
                          <div className="space-y-1.5 border-t border-border pt-3">
                            {w.receipts.map((r) => (
                              <div
                                key={r.id}
                                className="flex items-baseline justify-between gap-3 text-sm"
                              >
                                <button
                                  type="button"
                                  className="min-w-0 text-left"
                                  onClick={() =>
                                    r.receiptUrl &&
                                    setViewing({ url: r.receiptUrl, mime: r.receiptMime })
                                  }
                                >
                                  <p className="truncate flex items-center gap-1.5">
                                    <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    {r.vendor || r.description}
                                  </p>
                                  {r.siteLabel && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {r.siteLabel}
                                    </p>
                                  )}
                                </button>
                                <span className="tabular-nums shrink-0">{fmtMoney(r.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEditWeek({ workerId, weekStart: w.weekStart })}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit in Entries
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>

          {data.payments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Payments</p>
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {data.payments.map((p) => (
                    <div
                      key={p.weekStart + p.paidAt}
                      className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{weekRangeLabel(p.weekStart)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {fmtDate(p.paidAt)}
                          {p.paidByPerson ? ` · ${p.paidByPerson}` : ""}
                          {p.tipAmount
                            ? p.tipAmount > 0
                              ? ` · +${fmtMoney(p.tipAmount)} tip`
                              : ` · ${fmtMoney(p.tipAmount)} short`
                            : ""}
                        </p>
                      </div>
                      <span className="tabular-nums font-semibold shrink-0">
                        {fmtMoney(p.actualPaid ?? p.amount)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {data.receipts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">All reimbursements</p>
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {data.receipts.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="w-full text-left flex items-baseline justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                      onClick={() =>
                        r.receiptUrl && setViewing({ url: r.receiptUrl, mime: r.receiptMime })
                      }
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{r.vendor || r.description}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {fmtDate(r.date ? r.date + "T12:00:00" : r.createdAt)}
                          {r.siteLabel ? ` · ${r.siteLabel}` : ""}
                        </p>
                      </div>
                      <span className="tabular-nums font-semibold shrink-0">
                        {fmtMoney(r.amount)}
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </>
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
    </div>
  );
}
