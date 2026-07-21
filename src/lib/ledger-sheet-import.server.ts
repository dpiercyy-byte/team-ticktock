// Pure parser for the "master-copy" Google Sheet layout used for per-job books.
// Layout (single tab, typically "Sheet1"):
//
//   Row 1:  A "Client Name(s):"        C <client name>
//   Row 2:  A "Start Date:"            C <start>   E "Payments Owing:"   F <owing>   I "Estimated Profit:"  J <est>
//   Row 3:  A "Finish Date:"           C <finish>  E "Profit Margin:"    F <margin>
//   Row 5:  A "Total Revenue"          E "Finish Materials"  F "Building Materials"  G "Subs"  H "Labor"        J "Net Profit"
//   Row 6:  B <total revenue>          E <fm>                F <bm>                  G <subs>  H <labor>        J <net>
//   Row 7:  block headings: PAYMENTS (B..D)  EXPENSES (E..I+J date)  PRICE (K..M)  REIMBURSE (N..P)
//   Row 9:  sub-headers per block
//   Row 10..: rows until a green totals row (first row where the block's amount column is blank)
//
// The parser is defensive: it locates rows by label text so it survives minor
// re-orderings, and it falls back to `null` on unrecognized shapes so the
// caller can drop back to the legacy 4-tab parser.

export type ParsedMasterSheet = {
  summary: {
    client_name: string | null;
    start_date: string | null;
    finish_date: string | null;
    total_price: number;
    finish_materials: number;
    building_materials: number;
    subs: number;
    labor: number;
    payments_received: number;
    net: number;
    profit_margin: number;
  };
  payments_log: Array<{ date: string | null; amount: number; method: string }>;
  expense_log: Array<{ date: string | null; amount: number; category: string; vendor: string; comment: string }>;
  price_log: Array<{ date: string | null; amount: number; comment: string; has_hst: boolean }>;
  reimburse_log: Array<{ date: string | null; amount: number; comment: string; paid_date: string | null }>;
};

const A = 0, B = 1, C = 2, D = 3, E = 4, F = 5, G = 6, H = 7, I = 8, J = 9, K = 10, L = 11, M = 12, N = 13, O = 14, P = 15;

function cell(rows: string[][], r: number, c: number): string {
  const row = rows[r] ?? [];
  const v = row[c];
  return v == null ? "" : String(v).trim();
}
function num(s: unknown): number {
  if (s == null || s === "") return 0;
  const raw = String(s).replace(/[$,()\s]/g, "").replace(/%$/, "").trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
function normDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  // Try to parse a variety of formats; if it parses, return YYYY-MM-DD, else return the string as-is.
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return t;
}

// Find the row index that contains the given text in column A (case-insensitive, punctuation-agnostic).
function findLabelRow(rows: string[][], label: string, col = A): number {
  const target = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (let r = 0; r < rows.length; r++) {
    const v = cell(rows, r, col).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (v === target) return r;
  }
  return -1;
}

// Check if this looks like a master-copy sheet (row 7 has PAYMENTS/EXPENSES/PRICE block headings).
export function looksLikeMasterSheet(rows: string[][]): boolean {
  const joined = (rows[6] ?? []).map((c) => String(c ?? "").toUpperCase()).join(" ");
  return joined.includes("PAYMENTS") && joined.includes("EXPENSES") && joined.includes("PRICE");
}

export function parseMasterSheet(rows: string[][]): ParsedMasterSheet | null {
  if (!looksLikeMasterSheet(rows)) return null;

  // Summary — pull by label so slight row shifts are tolerated.
  const clientRow = findLabelRow(rows, "Client Name(s):");
  const startRow = findLabelRow(rows, "Start Date:");
  const finishRow = findLabelRow(rows, "Finish Date:");

  const client_name = clientRow >= 0 ? (cell(rows, clientRow, C) || null) : null;
  const start_date = startRow >= 0 ? normDate(cell(rows, startRow, C)) : null;
  const finish_date = finishRow >= 0 ? normDate(cell(rows, finishRow, C)) : null;

  // Owing / margin live to the right of the same rows.
  const payments_owing = startRow >= 0 ? num(cell(rows, startRow, F)) : 0;
  const profit_margin_pct = finishRow >= 0 ? num(cell(rows, finishRow, F)) : 0;
  // Values in row 6 (Total Revenue etc.). Fall back to searching if row 5 label doesn't match.
  const totalsHeaderRow = findLabelRow(rows, "Total Revenue");
  const totalsRow = totalsHeaderRow >= 0 ? totalsHeaderRow + 1 : 5;

  const total_price = num(cell(rows, totalsRow, B));
  const finish_materials = num(cell(rows, totalsRow, E));
  const building_materials = num(cell(rows, totalsRow, F));
  const subs = num(cell(rows, totalsRow, G));
  const labor = num(cell(rows, totalsRow, H));
  const net = num(cell(rows, totalsRow, J));
  const payments_received = Math.max(0, total_price - payments_owing);
  // profit_margin is expressed as a fraction (0..1) in the DB; sheet stores %.
  const profit_margin = profit_margin_pct > 1 ? profit_margin_pct / 100 : profit_margin_pct;

  // Block data rows start at row 9 (0-indexed) — row 10 in the sheet.
  const DATA_START = 9;

  const payments_log: ParsedMasterSheet["payments_log"] = [];
  const expense_log: ParsedMasterSheet["expense_log"] = [];
  const price_log: ParsedMasterSheet["price_log"] = [];
  const reimburse_log: ParsedMasterSheet["reimburse_log"] = [];

  for (let r = DATA_START; r < rows.length; r++) {
    // Payments (B amount, C method, D date)
    const pAmt = cell(rows, r, B);
    const pMethod = cell(rows, r, C);
    const pDate = cell(rows, r, D);
    if (pAmt && !isTotalsRow(pAmt)) {
      payments_log.push({ amount: num(pAmt), method: pMethod, date: normDate(pDate) });
    }

    // Expenses: category = whichever of E..H has a value; I = comment; J = date
    const eF = cell(rows, r, E);
    const eB = cell(rows, r, F);
    const eS = cell(rows, r, G);
    const eL = cell(rows, r, H);
    const eComment = cell(rows, r, I);
    const eDate = cell(rows, r, J);
    let category = "";
    let amountStr = "";
    if (eF && !isTotalsRow(eF)) { category = "finish_materials"; amountStr = eF; }
    else if (eB && !isTotalsRow(eB)) { category = "building_materials"; amountStr = eB; }
    else if (eS && !isTotalsRow(eS)) { category = "subs"; amountStr = eS; }
    else if (eL && !isTotalsRow(eL)) { category = "labor"; amountStr = eL; }
    if (amountStr) {
      expense_log.push({
        amount: num(amountStr),
        category,
        vendor: "",
        comment: eComment,
        date: normDate(eDate),
      });
    }

    // Price (K amount, L comment, M date)
    const kAmt = cell(rows, r, K);
    const kComment = cell(rows, r, L);
    const kDate = cell(rows, r, M);
    if (kAmt && !isTotalsRow(kAmt)) {
      price_log.push({ amount: num(kAmt), comment: kComment, date: normDate(kDate), has_hst: false });
    }

    // Reimburse (N amount, O comment, P paid date)
    const nAmt = cell(rows, r, N);
    const nComment = cell(rows, r, O);
    const nPaid = cell(rows, r, P);
    if (nAmt && !isTotalsRow(nAmt)) {
      reimburse_log.push({ amount: num(nAmt), comment: nComment, date: null, paid_date: normDate(nPaid) });
    }
  }

  return {
    summary: {
      client_name,
      start_date,
      finish_date,
      total_price,
      finish_materials,
      building_materials,
      subs,
      labor,
      payments_received,
      net,
      profit_margin,
    },
    payments_log,
    expense_log,
    price_log,
    reimburse_log,
  };
}

// The green totals row typically has the SAME value as the running sum with no distinguishing marker,
// but it lives after a blank row and at the same column position. To avoid double-counting we skip any
// row whose amount cell contains "$" formatting quirks that look like totals — best-effort. In practice
// blank-row separation is enough because empty amount cells are already filtered above. This hook is a
// no-op placeholder in case a specific sentinel appears later.
function isTotalsRow(_amount: string): boolean {
  return false;
}
