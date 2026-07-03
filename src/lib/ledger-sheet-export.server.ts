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

const TABS = ["Summary", "Payments", "Expenses", "Price Log"] as const;
const SUMMARY_KEYS: Array<{ key: string; label: string; type: "number" | "text" | "date" }> = [
  { key: "address", label: "Address", type: "text" },
  { key: "client_name", label: "Client", type: "text" },
  { key: "start_date", label: "Start Date", type: "date" },
  { key: "finish_date", label: "Finish Date", type: "date" },
  { key: "lead_source", label: "Lead Source", type: "text" },
  { key: "total_price", label: "Total Price", type: "number" },
  { key: "gross_cash", label: "Gross Cash", type: "number" },
  { key: "gross_with_hst", label: "Gross w/ HST", type: "number" },
  { key: "finish_materials", label: "Finish Materials", type: "number" },
  { key: "building_materials", label: "Building Materials", type: "number" },
  { key: "subs", label: "Subs", type: "number" },
  { key: "labor", label: "Labor", type: "number" },
  { key: "payments_received", label: "Payments Received", type: "number" },
];
const PAYMENTS_HEADERS = ["Date", "Amount", "Method"];
const EXPENSES_HEADERS = ["Date", "Vendor", "Category", "Amount"];
const PRICES_HEADERS = ["Date", "Amount", "Has HST", "Comment"];

function num(n: unknown): number {
  if (n === "" || n == null) return 0;
  const s = String(n).replace(/[$,]/g, "").trim();
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
}
function str(n: unknown): string {
  return n == null ? "" : String(n);
}

async function listSheetProps(sheetId: string): Promise<{ title: string; sheetId: number }[]> {
  const meta: any = await (await gw(`${GW}/${sheetId}?fields=sheets.properties`)).json();
  return (meta?.sheets || []).map((s: any) => ({ title: s.properties.title, sheetId: s.properties.sheetId }));
}

async function ensureTabsAndClear(sheetId: string, tabs: readonly string[]) {
  const existing = await listSheetProps(sheetId);
  const existingTitles = new Set(existing.map((p) => p.title));
  const toAdd = tabs.filter((t) => !existingTitles.has(t));
  if (toAdd.length) {
    await gw(`${GW}/${sheetId}:batchUpdate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })) }),
    });
  }
  await gw(`${GW}/${sheetId}/values:batchClear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ranges: tabs.map((t) => `${t}!A:Z`) }),
  }).catch(async () => {
    for (const t of tabs) {
      await gw(`${GW}/${sheetId}/values/${encodeURIComponent(t)}!A:Z:clear`, { method: "POST" }).catch(() => {});
    }
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

async function formatTab(sheetId: string, numericSheetId: number, colCount: number, freezeHeader: boolean) {
  await gw(`${GW}/${sheetId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        ...(freezeHeader
          ? [{
              updateSheetProperties: {
                properties: { sheetId: numericSheetId, gridProperties: { frozenRowCount: 1 } },
                fields: "gridProperties.frozenRowCount",
              },
            }, {
              repeatCell: {
                range: { sheetId: numericSheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: "userEnteredFormat.textFormat.bold",
              },
            }]
          : []),
        {
          autoResizeDimensions: {
            dimensions: { sheetId: numericSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: colCount },
          },
        },
      ],
    }),
  }).catch(() => {});
}

async function readValues(sheetId: string, range: string): Promise<string[][]> {
  const res = await gw(`${GW}/${sheetId}/values/${range}`);
  const j: any = await res.json();
  return (j?.values || []) as string[][];
}

// -------- Push (app -> sheet) --------

export async function pushJobToSheet(jobId: string): Promise<{ sheetId: string }> {
  const { data: job, error } = await supabaseAdmin.from("ledger_jobs").select("*").eq("id", jobId).single();
  if (error) throw error;
  const sheetId: string | null = (job as any)?.sheet_id ?? null;
  if (!sheetId) throw new Error("Job has no linked Google Sheet");

  await ensureTabsAndClear(sheetId, TABS);
  const props = await listSheetProps(sheetId);
  const propByTitle = new Map(props.map((p) => [p.title, p.sheetId]));

  const j = job as any;

  const summary: (string | number)[][] = [["Field", "Value"]];
  for (const k of SUMMARY_KEYS) {
    let v: string | number = "";
    const raw = j[k.key];
    if (k.type === "number") v = num(raw);
    else v = raw == null ? "" : String(raw);
    summary.push([k.label, v]);
  }
  const balance = num(j.total_price) - num(j.payments_received);
  summary.push(["Balance", balance]);
  summary.push(["Net", num(j.net)]);
  summary.push(["Margin", num(j.profit_margin)]);

  const payments: (string | number)[][] = [PAYMENTS_HEADERS];
  for (const p of (j.payments_log ?? []) as any[]) {
    payments.push([str(p.date), num(p.amount), str(p.method)]);
  }
  const expenses: (string | number)[][] = [EXPENSES_HEADERS];
  for (const e of (j.expense_log ?? []) as any[]) {
    expenses.push([str(e.date), str(e.vendor), str(e.category), num(e.amount)]);
  }
  const prices: (string | number)[][] = [PRICES_HEADERS];
  for (const p of (j.price_log ?? []) as any[]) {
    prices.push([str(p.date), num(p.amount), p.has_hst ? "yes" : "", str(p.comment)]);
  }

  const writes: Array<[string, (string | number)[][], number, boolean]> = [
    ["Summary", summary, 2, true],
    ["Payments", payments, PAYMENTS_HEADERS.length, true],
    ["Expenses", expenses, EXPENSES_HEADERS.length, true],
    ["Price Log", prices, PRICES_HEADERS.length, true],
  ];
  for (const [tab, rows, cols, freeze] of writes) {
    await writeTab(sheetId, tab, rows);
    const id = propByTitle.get(tab);
    if (typeof id === "number") await formatTab(sheetId, id, cols, freeze);
  }

  await supabaseAdmin.from("ledger_jobs")
    .update({ sheet_last_sync_at: new Date().toISOString() } as never)
    .eq("id", jobId);

  return { sheetId };
}

// -------- Pull (sheet -> app) --------

export async function pullJobFromSheet(jobId: string): Promise<{ sheetId: string; updated: boolean }> {
  const { data: job, error } = await supabaseAdmin.from("ledger_jobs").select("id, sheet_id, finish_date").eq("id", jobId).single();
  if (error) throw error;
  const sheetId: string | null = (job as any)?.sheet_id ?? null;
  if (!sheetId) throw new Error("Job has no linked Google Sheet");

  // Read the four tabs; ignore missing ones.
  const [summary, payments, expenses, prices] = await Promise.all([
    readValues(sheetId, "Summary!A1:B100").catch(() => [] as string[][]),
    readValues(sheetId, "Payments!A1:C1000").catch(() => [] as string[][]),
    readValues(sheetId, "Expenses!A1:D1000").catch(() => [] as string[][]),
    readValues(sheetId, "Price%20Log!A1:D1000").catch(() => [] as string[][]),
  ]);

  const summaryMap = new Map<string, string>();
  for (const row of summary.slice(1)) {
    if (row[0]) summaryMap.set(String(row[0]).trim(), String(row[1] ?? ""));
  }

  const patch: Record<string, unknown> = {};
  for (const k of SUMMARY_KEYS) {
    if (!summaryMap.has(k.label)) continue;
    const raw = summaryMap.get(k.label) ?? "";
    if (k.type === "number") patch[k.key] = num(raw);
    else if (k.type === "date") patch[k.key] = raw.trim() || null;
    else patch[k.key] = raw.trim();
  }

  const paymentsLog = payments.slice(1)
    .filter((r) => (r[0] || r[1] || r[2]))
    .map((r) => ({ date: str(r[0]).trim() || null, amount: num(r[1]), method: str(r[2]).trim() }));
  const expenseLog = expenses.slice(1)
    .filter((r) => (r[0] || r[1] || r[2] || r[3]))
    .map((r) => ({ date: str(r[0]).trim() || null, vendor: str(r[1]).trim(), category: str(r[2]).trim(), amount: num(r[3]) }));
  const priceLog = prices.slice(1)
    .filter((r) => (r[0] || r[1] || r[3]))
    .map((r) => ({
      date: str(r[0]).trim() || null,
      amount: num(r[1]),
      has_hst: /^(y|yes|true|1)$/i.test(String(r[2] ?? "").trim()),
      comment: str(r[3]).trim(),
    }));

  patch.payments_log = paymentsLog;
  patch.expense_log = expenseLog;
  patch.price_log = priceLog;

  // Recompute derived: prefer sheet Summary if provided, otherwise derive from logs.
  if (!summaryMap.has("Payments Received")) {
    patch.payments_received = paymentsLog.reduce((s, p) => s + p.amount, 0);
  }
  const totalPrice = num(patch.total_price ?? summaryMap.get("Total Price") ?? 0);
  const fm = num(patch.finish_materials);
  const bm = num(patch.building_materials);
  const subs = num(patch.subs);
  const labor = num(patch.labor);
  const totalExp = fm + bm + subs + labor;
  patch.net = totalPrice - totalExp;
  patch.profit_margin = totalPrice > 0 ? (totalPrice - totalExp) / totalPrice : 0;
  patch.sheet_last_sync_at = new Date().toISOString();

  const { error: uErr } = await supabaseAdmin.from("ledger_jobs").update(patch as never).eq("id", jobId);
  if (uErr) throw uErr;

  return { sheetId, updated: true };
}

// -------- Cron: pull all active jobs with a linked sheet --------

export async function pullAllActiveJobs(): Promise<{ pulled: number; errors: Array<{ id: string; error: string }> }> {
  const { data: jobs, error } = await supabaseAdmin
    .from("ledger_jobs")
    .select("id, sheet_id, finish_date")
    .not("sheet_id", "is", null)
    .is("finish_date", null);
  if (error) throw error;
  const errors: Array<{ id: string; error: string }> = [];
  let pulled = 0;
  for (const j of (jobs ?? []) as any[]) {
    try {
      await pullJobFromSheet(j.id);
      pulled++;
    } catch (e: any) {
      errors.push({ id: j.id, error: e?.message || String(e) });
    }
  }
  return { pulled, errors };
}
