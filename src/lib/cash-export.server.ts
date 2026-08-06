// Appends worker payout rows into the shared "Cash Tracking" Google Sheet.
// Michael occupies columns B–E, Dylan occupies columns H–K, each block laid
// out as Amount / Date In/Out / Address / Comments.
import { supabaseAdmin } from "./db.server";
import { cashAmountLabel, cashCommentLabel, cashDateLabel } from "./payout-math";

const GW = "https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets";

export type CashPayer = "Michael" | "Dylan";

const BLOCKS: Record<CashPayer, { first: string; last: string }> = {
  Michael: { first: "B", last: "E" },
  Dylan: { first: "H", last: "K" },
};

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

/** A1 range for a URL path segment — quote the tab, keep the colon literal. */
function rangePath(tab: string, a1: string): string {
  return `'${tab.replace(/'/g, "''")}'!${a1}`.replace(/ /g, "%20");
}

export type CashExportSettings = {
  sheetId: string | null;
  tab: string;
  enabled: boolean;
};

export async function getCashExportSettings(): Promise<CashExportSettings> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("cash_export_sheet_id, cash_export_tab, cash_export_enabled")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return {
    sheetId: data?.cash_export_sheet_id ?? null,
    tab: data?.cash_export_tab || "Cash Tracking",
    enabled: !!data?.cash_export_enabled,
  };
}

/** First row of a payer block that has no Amount value yet (1-indexed). */
async function nextEmptyRow(sheetId: string, tab: string, col: string): Promise<number> {
  const res = await gw(`${GW}/${sheetId}/values/${rangePath(tab, `${col}1:${col}2000`)}`);
  const json: any = await res.json();
  const rows: any[][] = json?.values ?? [];
  let last = 0;
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i]?.[0];
    if (v != null && String(v).trim() !== "") last = i + 1;
  }
  // Never write above the two header rows.
  return Math.max(last + 1, 3);
}

export type CashRowInput = {
  payer: CashPayer;
  /** Positive amount actually paid out; written as money out (negative). */
  amount: number;
  paidAt: Date;
  workerName: string;
  weekStart: string;
};

export type CashRowResult = {
  row: number;
  sheetId: string;
  tab: string;
  values: string[];
};

export async function appendCashPayoutRow(input: CashRowInput): Promise<CashRowResult> {
  const settings = await getCashExportSettings();
  if (!settings.sheetId) throw new Error("Cash tracking sheet not configured");
  const block = BLOCKS[input.payer];
  const row = await nextEmptyRow(settings.sheetId, settings.tab, block.first);

  const values = [
    cashAmountLabel(-Math.abs(input.amount)),
    cashDateLabel(input.paidAt),
    "",
    cashCommentLabel(input.workerName, input.weekStart),
  ];

  await gw(
    `${GW}/${settings.sheetId}/values/${rangePath(
      settings.tab,
      `${block.first}${row}:${block.last}${row}`,
    )}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [values], majorDimension: "ROWS" }),
    },
  );

  return { row, sheetId: settings.sheetId, tab: settings.tab, values };
}

/** Read-only reachability check used by the Settings "Test connection" button. */
export async function testCashExport(): Promise<{ tab: string; nextRows: Record<string, number> }> {
  const settings = await getCashExportSettings();
  if (!settings.sheetId) throw new Error("Cash tracking sheet not configured");
  const [michael, dylan] = await Promise.all([
    nextEmptyRow(settings.sheetId, settings.tab, BLOCKS.Michael.first),
    nextEmptyRow(settings.sheetId, settings.tab, BLOCKS.Dylan.first),
  ]);
  return { tab: settings.tab, nextRows: { Michael: michael, Dylan: dylan } };
}
