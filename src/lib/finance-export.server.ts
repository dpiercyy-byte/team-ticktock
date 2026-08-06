// Project Summary export: one row per project, written into its own app-owned
// tab. Sheets is an output destination only — nothing is ever read back in.
import { supabaseAdmin } from "./db.server";
import { financeFingerprint } from "./finance-math";
import { loadWorkspace } from "./workspace.server";

const GW = "https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets";
export const SUMMARY_TAB = "Project Summary";

async function gw(url: string, init?: RequestInit) {
  const lovKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovKey || !connKey) throw new Error("Google Sheets connector not configured");
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${lovKey}`,
      "X-Connection-Api-Key": connKey,
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Sheets ${res.status}: ${t.slice(0, 300)}`);
  }
  return res;
}

const HEADERS = [
  "Project ID",
  "Project",
  "Client",
  "Address",
  "Status",
  "Progress %",
  "Original contract",
  "Approved change orders",
  "Revised contract",
  "Payments received",
  "Outstanding balance",
  "Materials",
  "Client-billable materials",
  "Subcontractors",
  "Labour cost (Clockwise)",
  "Worker reimbursements",
  "Permits and fees",
  "Other project costs",
  "Total revenue",
  "Total cost",
  "Gross profit",
  "Gross margin %",
  "Forecast gross profit",
  "Forecast gross margin %",
  "Collected %",
  "Exported at",
];

async function ensureTab(sheetId: string) {
  const meta: any = await (await gw(`${GW}/${sheetId}?fields=sheets.properties`)).json();
  const titles: string[] = (meta?.sheets || []).map((s: any) => s?.properties?.title);
  if (!titles.includes(SUMMARY_TAB)) {
    await gw(`${GW}/${sheetId}:batchUpdate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: SUMMARY_TAB } } }],
      }),
    });
  }
}

export async function runProjectSummaryExport(): Promise<{
  projects: number;
  sheetId: string;
  exportedAt: string;
}> {
  const { data: settings, error: sErr } = await supabaseAdmin
    .from("app_settings")
    .select("project_summary_sheet_id")
    .eq("id", 1)
    .single();
  if (sErr) throw sErr;
  const sheetId = (settings as { project_summary_sheet_id: string | null } | null)
    ?.project_summary_sheet_id;
  if (!sheetId) throw new Error("Project Summary sheet ID not set");

  const { data: projects, error: pErr } = await supabaseAdmin
    .from("ledger_jobs")
    .select("id")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (pErr) throw pErr;

  const exportedAt = new Date().toISOString();
  const rows: (string | number)[][] = [HEADERS];
  const stamps: { id: string; hash: string }[] = [];

  for (const p of projects ?? []) {
    const ws = await loadWorkspace(p.id);
    const f = ws.financials;
    rows.push([
      ws.project.id,
      ws.project.name,
      ws.project.client,
      ws.project.address ?? "",
      ws.project.status,
      Number(ws.project.progress ?? 0),
      f.revenue.originalContract,
      f.revenue.approvedChangeOrders,
      f.revenue.revisedContract,
      f.revenue.received,
      f.revenue.outstanding,
      f.costs.materials,
      f.costs.clientBillableTotal,
      f.costs.subcontractors,
      f.costs.labourCost,
      f.costs.reimbursements,
      f.costs.permits,
      f.costs.other,
      f.results.totalRevenue,
      f.results.totalCost,
      f.results.grossProfit,
      f.results.grossMargin ?? "",
      f.results.forecastProfit ?? "",
      f.results.forecastMargin ?? "",
      f.results.percentCollected ?? "",
      exportedAt,
    ]);
    stamps.push({ id: ws.project.id, hash: financeFingerprint(f) });
  }

  await ensureTab(sheetId);
  await gw(`${GW}/${sheetId}/values/${SUMMARY_TAB}!A:Z:clear`, { method: "POST" }).catch(() => {});
  await gw(`${GW}/${sheetId}/values/${SUMMARY_TAB}!A1?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values: rows, majorDimension: "ROWS" }),
  });

  for (const s of stamps) {
    await supabaseAdmin
      .from("ledger_jobs")
      .update({ last_summary_export_at: exportedAt, last_summary_export_hash: s.hash })
      .eq("id", s.id);
  }
  await supabaseAdmin
    .from("app_settings")
    .update({ project_summary_last_sync_at: exportedAt })
    .eq("id", 1);

  return { projects: stamps.length, sheetId, exportedAt };
}
