import { supabaseAdmin } from "./db.server";

const GW = "https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets";

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

const ENTRIES_HEADERS = [
  "Date", "Clock In", "Clock Out", "Hours", "Project",
  "Clock-In Tag", "Clock-Out Tag", "Geo Status", "Flagged", "Entry ID",
  // App-owned tail column: only filled when the entry resolves to a project.
  "Project ID",
];
const PAYOUTS_HEADERS = [
  "Week Start", "Hours", "Wages", "Reimbursements", "Tips",
  "Total Amount", "Actual Paid", "Paid At", "Paid By", "Notes",
];

const TZ = "America/Toronto";
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d).replace(",", "");
}
function hoursBetween(a: string, b: string | null): string {
  if (!b) return "";
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!isFinite(ms) || ms < 0) return "";
  return (ms / 3600_000).toFixed(2);
}

async function listSheetProps(sheetId: string): Promise<{ title: string; sheetId: number }[]> {
  const meta: any = await (await gw(`${GW}/${sheetId}?fields=sheets.properties`)).json();
  return (meta?.sheets || []).map((s: any) => ({ title: s.properties.title, sheetId: s.properties.sheetId }));
}

async function ensureTabsAndClear(sheetId: string, tabs: string[]) {
  const existing = await listSheetProps(sheetId);
  const existingTitles = new Set(existing.map((p) => p.title));
  const toAdd = tabs.filter((t) => !existingTitles.has(t));
  if (toAdd.length) {
    await gw(`${GW}/${sheetId}:batchUpdate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })),
      }),
    });
  }
  // Clear all target tabs
  const ranges = tabs.map((t) => `${encodeURIComponent(t)}!A:Z`);
  await gw(`${GW}/${sheetId}/values:batchClear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ranges: tabs.map((t) => `${t}!A:Z`) }),
  }).catch(() => {
    // fallback: individual clears
    return Promise.all(ranges.map((r) =>
      gw(`${GW}/${sheetId}/values/${r}:clear`, { method: "POST" })
    ));
  });
}

async function writeTab(sheetId: string, tab: string, rows: (string | number)[][]) {
  const range = `${tab}!A1`;
  await gw(`${GW}/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values: rows, majorDimension: "ROWS" }),
  });
}

async function formatTab(sheetId: string, numericSheetId: number, colCount: number) {
  await gw(`${GW}/${sheetId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: numericSheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: { sheetId: numericSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat.bold",
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId: numericSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: colCount },
          },
        },
      ],
    }),
  }).catch(() => {});
}

function sanitizeTabName(name: string): string {
  // Sheets tab names cannot contain: [ ] * ? / \ : and max length 100
  return name.replace(/[\[\]\*\?\/\\:]/g, " ").trim().slice(0, 80);
}

export async function runWorkerSheetExport(): Promise<{
  workers: number; entries: number; payouts: number; sheetId: string;
}> {
  const { data: settings, error: sErr } = await supabaseAdmin
    .from("app_settings").select("worker_export_sheet_id").eq("id", 1).single();
  if (sErr) throw sErr;
  const sheetId = settings?.worker_export_sheet_id;
  if (!sheetId) throw new Error("Worker export sheet ID not set");

  const { data: workers, error: wErr } = await supabaseAdmin
    .from("workers").select("id, name").order("name");
  if (wErr) throw wErr;

  const tabs: string[] = [];
  const perWorker: { name: string; entriesTab: string; payoutsTab: string; id: string }[] = [];
  for (const w of workers ?? []) {
    const base = sanitizeTabName(w.name);
    const eTab = `${base} - Time Entries`;
    const pTab = `${base} - Payouts`;
    tabs.push(eTab, pTab);
    perWorker.push({ id: w.id, name: w.name, entriesTab: eTab, payoutsTab: pTab });
  }

  if (!tabs.length) return { workers: 0, entries: 0, payouts: 0, sheetId };

  await ensureTabsAndClear(sheetId, tabs);
  const props = await listSheetProps(sheetId);
  const propByTitle = new Map(props.map((p) => [p.title, p.sheetId]));

  // Fetch site labels for project resolution
  const { data: sites } = await supabaseAdmin.from("job_sites").select("id, label, project_id");
  const siteById = new Map((sites ?? []).map((s) => [s.id, s.label]));
  const projectBySite = new Map(
    (sites ?? []).map((s) => [s.id, (s as { project_id: string | null }).project_id ?? ""]),
  );

  let totalEntries = 0;
  let totalPayouts = 0;

  for (const w of perWorker) {
    // Time entries
    const { data: entries } = await supabaseAdmin
      .from("time_entries")
      .select("id, clock_in, clock_out, project, geo_status, clock_out_geo_status, job_site_id, clock_out_job_site_id, flagged_review")
      .eq("worker_id", w.id)
      .order("clock_in", { ascending: false });

    const eRows: (string | number)[][] = [ENTRIES_HEADERS];
    for (const e of entries ?? []) {
      const inTag = e.job_site_id ? (siteById.get(e.job_site_id) || "") : (e.geo_status || "");
      const outTag = e.clock_out_job_site_id
        ? (siteById.get(e.clock_out_job_site_id) || "")
        : (e.clock_out_geo_status || "");
      eRows.push([
        fmtDate(e.clock_in),
        fmtDateTime(e.clock_in),
        fmtDateTime(e.clock_out),
        hoursBetween(e.clock_in, e.clock_out),
        e.project || "",
        inTag,
        outTag,
        e.geo_status || "",
        e.flagged_review ? "yes" : "",
        e.id,
        (e.job_site_id ? projectBySite.get(e.job_site_id) : "") ||
          (e.clock_out_job_site_id ? projectBySite.get(e.clock_out_job_site_id) : "") ||
          "",
      ]);
    }
    await writeTab(sheetId, w.entriesTab, eRows);
    const eSheetId = propByTitle.get(w.entriesTab);
    if (typeof eSheetId === "number") await formatTab(sheetId, eSheetId, ENTRIES_HEADERS.length);
    totalEntries += (entries?.length ?? 0);

    // Payouts
    const { data: payouts } = await supabaseAdmin
      .from("weekly_payouts")
      .select("week_start, hours, wages, reimbursement_total, tip_amount, amount, actual_paid, paid_at, paid_by, notes")
      .eq("worker_id", w.id)
      .order("week_start", { ascending: false });

    const pRows: (string | number)[][] = [PAYOUTS_HEADERS];
    for (const p of payouts ?? []) {
      pRows.push([
        p.week_start || "",
        Number(p.hours ?? 0),
        Number(p.wages ?? 0),
        Number(p.reimbursement_total ?? 0),
        Number(p.tip_amount ?? 0),
        Number(p.amount ?? 0),
        p.actual_paid == null ? "" : Number(p.actual_paid),
        fmtDateTime(p.paid_at),
        p.paid_by || "",
        p.notes || "",
      ]);
    }
    await writeTab(sheetId, w.payoutsTab, pRows);
    const pSheetId = propByTitle.get(w.payoutsTab);
    if (typeof pSheetId === "number") await formatTab(sheetId, pSheetId, PAYOUTS_HEADERS.length);
    totalPayouts += (payouts?.length ?? 0);
  }

  await supabaseAdmin.from("app_settings")
    .update({ worker_export_last_sync_at: new Date().toISOString() })
    .eq("id", 1);

  return { workers: perWorker.length, entries: totalEntries, payouts: totalPayouts, sheetId };
}
