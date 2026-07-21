import { supabaseAdmin } from "./db.server";
import { parseMasterSheet, looksLikeMasterSheet } from "./ledger-sheet-import.server";

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

function num(n: unknown): number {
  if (n === "" || n == null) return 0;
  const s = String(n).replace(/[$,]/g, "").trim();
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
}
function str(n: unknown): string {
  return n == null ? "" : String(n);
}

async function readValues(sheetId: string, range: string): Promise<string[][]> {
  const res = await gw(`${GW}/${sheetId}/values/${range}`);
  const j: any = await res.json();
  return (j?.values || []) as string[][];
}

async function firstTabTitle(sheetId: string): Promise<string> {
  const meta: any = await (await gw(`${GW}/${sheetId}?fields=sheets.properties.title`)).json();
  const t = meta?.sheets?.[0]?.properties?.title;
  return typeof t === "string" && t.length > 0 ? t : "Sheet1";
}

// -------- Push (app -> sheet): DISABLED --------
// Retained as a no-op to keep the exported symbol stable for callers/UI that
// still reference it. Ledger no longer writes anything back to Google Sheets;
// the sheet is the single source of truth and Ledger is a read-only mirror.
export async function pushJobToSheet(_jobId: string): Promise<{ sheetId: null; disabled: true }> {
  return { sheetId: null, disabled: true };
}

// -------- Pull (sheet -> app) --------
export async function pullJobFromSheet(jobId: string): Promise<{ sheetId: string; updated: boolean }> {
  const { data: job, error } = await supabaseAdmin
    .from("ledger_jobs").select("id, sheet_id, finish_date").eq("id", jobId).single();
  if (error) throw error;
  const sheetId: string | null = (job as any)?.sheet_id ?? null;
  if (!sheetId) throw new Error("Job has no linked Google Sheet");

  // Prefer the master-copy layout (single tab, fixed grid).
  const tabTitle = await firstTabTitle(sheetId).catch(() => "Sheet1");
  const encodedTab = encodeURIComponent(tabTitle);
  const grid = await readValues(sheetId, `${encodedTab}!A1:P200`).catch(() => [] as string[][]);

  let patch: Record<string, unknown> = {};

  if (looksLikeMasterSheet(grid)) {
    const parsed = parseMasterSheet(grid);
    if (!parsed) throw new Error("Master-copy layout detected but parse failed");
    patch = {
      client_name: parsed.summary.client_name,
      start_date: parsed.summary.start_date,
      finish_date: parsed.summary.finish_date,
      total_price: parsed.summary.total_price,
      finish_materials: parsed.summary.finish_materials,
      building_materials: parsed.summary.building_materials,
      subs: parsed.summary.subs,
      labor: parsed.summary.labor,
      payments_received: parsed.summary.payments_received,
      payments_log: parsed.payments_log,
      expense_log: parsed.expense_log,
      price_log: parsed.price_log,
      reimburse_log: parsed.reimburse_log,
    };
    // Derive net + margin from parsed totals (prefer sheet value when present).
    const totalP = parsed.summary.total_price;
    const totalExp = parsed.summary.finish_materials + parsed.summary.building_materials
      + parsed.summary.subs + parsed.summary.labor;
    patch.net = parsed.summary.net || (totalP - totalExp);
    patch.profit_margin = parsed.summary.profit_margin || (totalP > 0 ? (totalP - totalExp) / totalP : 0);
    // Sheet is source of truth for labor; freeze auto-sync.
    patch.labor_manual_override = true;
  } else {
    // Legacy 4-tab fallback (kept for sheets Ledger previously wrote).
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
  }

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
