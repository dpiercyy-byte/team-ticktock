// Appends worker payout rows into the shared "Cash Tracking" Google Sheet.
// Michael occupies columns B–E, Dylan occupies columns H–K, each block laid
// out as Amount / Date In/Out / Address / Comments.
import { supabaseAdmin } from "./db.server";
import { cashAmountLabel, cashCommentLabel, cashDateLabel } from "./payout-math";

const GW = "https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets";

export type CashPayer = "Michael" | "Dylan";

const BLOCKS: Record<CashPayer, { label: string; first: string; last: string }> = {
  Michael: { label: "A", first: "B", last: "E" },
  Dylan: { label: "G", first: "H", last: "K" },
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

/**
 * First writable row of a payer block (1-indexed): the row directly under the
 * last transaction. Totals rows (labelled "… Total:" in the column beside the
 * block) sit far below the entries and must never be written over or after.
 */
async function nextEmptyRow(
  sheetId: string,
  tab: string,
  labelCol: string,
  amountCol: string,
): Promise<number> {
  const res = await gw(
    `${GW}/${sheetId}/values/${rangePath(tab, `${labelCol}1:${amountCol}2000`)}`,
  );
  const json: any = await res.json();
  const rows: any[][] = json?.values ?? [];
  const width = amountCol.charCodeAt(0) - labelCol.charCodeAt(0);
  let last = 2; // never write above the two header rows
  for (let i = 0; i < rows.length; i++) {
    const label = String(rows[i]?.[0] ?? "").toLowerCase();
    if (label.includes("total")) break;
    const amount = rows[i]?.[width];
    if (amount != null && String(amount).trim() !== "") last = i + 1;
  }
  return last + 1;
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
  const row = await nextEmptyRow(settings.sheetId, settings.tab, block.label, block.first);

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
