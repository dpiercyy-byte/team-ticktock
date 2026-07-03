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

const JOB_HEADERS_ACTIVE = [
  "Address", "Client", "Start Date", "Lead Source", "Total Price",
  "Gross Cash", "Gross w/ HST", "Finish Materials", "Building Materials",
  "Subs", "Labor", "Net", "Margin", "Payments Received", "Balance",
];
const JOB_HEADERS_CLOSED = ["Finish Date", ...JOB_HEADERS_ACTIVE];
const PAYMENTS_HEADERS = ["Address", "Date", "Amount", "Method"];
const EXPENSES_HEADERS = ["Address", "Date", "Vendor", "Category", "Amount"];
const PRICES_HEADERS = ["Address", "Date", "Amount", "Has HST", "Comment"];

const TABS = ["Active Jobs", "Closed Jobs", "Payments Log", "Expenses Log", "Price Log"];

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

function num(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export async function runLedgerSheetExport(): Promise<{
  jobs: number; active: number; closed: number; payments: number; expenses: number; prices: number; sheetId: string;
}> {
  const { data: settings, error: sErr } = await supabaseAdmin
    .from("app_settings").select("ledger_export_sheet_id").eq("id", 1).single();
  if (sErr) throw sErr;
  const sheetId = (settings as any)?.ledger_export_sheet_id;
  if (!sheetId) throw new Error("Ledger export sheet ID not set");

  const { data: jobs, error: jErr } = await supabaseAdmin
    .from("ledger_jobs").select("*").order("start_date", { ascending: false, nullsFirst: false });
  if (jErr) throw jErr;

  await ensureTabsAndClear(sheetId, TABS);
  const props = await listSheetProps(sheetId);
  const propByTitle = new Map(props.map((p) => [p.title, p.sheetId]));

  const active: (string | number)[][] = [JOB_HEADERS_ACTIVE];
  const closed: (string | number)[][] = [JOB_HEADERS_CLOSED];
  const payments: (string | number)[][] = [PAYMENTS_HEADERS];
  const expenses: (string | number)[][] = [EXPENSES_HEADERS];
  const prices: (string | number)[][] = [PRICES_HEADERS];

  for (const j of (jobs ?? []) as any[]) {
    const total = num(j.total_price);
    const paid = num(j.payments_received);
    const balance = total - paid;
    const row = [
      j.address, j.client_name || "", j.start_date || "", j.lead_source || "",
      total, num(j.gross_cash), num(j.gross_with_hst),
      num(j.finish_materials), num(j.building_materials), num(j.subs), num(j.labor),
      num(j.net), num(j.profit_margin), paid, balance,
    ];
    if (j.finish_date) closed.push([j.finish_date, ...row]);
    else active.push(row);

    for (const p of (j.payments_log ?? []) as any[]) {
      payments.push([j.address, p.date || "", num(p.amount), p.method || ""]);
    }
    for (const e of (j.expense_log ?? []) as any[]) {
      expenses.push([j.address, e.date || "", e.vendor || "", e.category || "", num(e.amount)]);
    }
    for (const p of (j.price_log ?? []) as any[]) {
      prices.push([j.address, p.date || "", num(p.amount), p.has_hst ? "yes" : "", p.comment || ""]);
    }
  }

  const writes: Array<[string, (string | number)[][], number]> = [
    ["Active Jobs", active, JOB_HEADERS_ACTIVE.length],
    ["Closed Jobs", closed, JOB_HEADERS_CLOSED.length],
    ["Payments Log", payments, PAYMENTS_HEADERS.length],
    ["Expenses Log", expenses, EXPENSES_HEADERS.length],
    ["Price Log", prices, PRICES_HEADERS.length],
  ];
  for (const [tab, rows, cols] of writes) {
    await writeTab(sheetId, tab, rows);
    const id = propByTitle.get(tab);
    if (typeof id === "number") await formatTab(sheetId, id, cols);
  }

  await supabaseAdmin.from("app_settings")
    .update({ ledger_export_last_sync_at: new Date().toISOString() } as never)
    .eq("id", 1);

  return {
    jobs: jobs?.length ?? 0,
    active: active.length - 1,
    closed: closed.length - 1,
    payments: payments.length - 1,
    expenses: expenses.length - 1,
    prices: prices.length - 1,
    sheetId,
  };
}
