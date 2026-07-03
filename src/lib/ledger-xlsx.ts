// Server-only xlsx parser for Ledger job sheets (port of backend/server.py parse_job_xlsx)
import * as XLSX from "xlsx";

export type LedgerJobParsed = {
  address: string;
  client_name: string | null;
  start_date: string | null;
  finish_date: string | null;
  total_price: number;
  gross_cash: number;
  gross_with_hst: number;
  finish_materials: number;
  building_materials: number;
  subs: number;
  labor: number;
  net: number;
  profit_margin: number;
  lead_source: string;
  payments_received: number;
  payments_log: Array<{ date: string | null; amount: number; method: string }>;
  expense_log: Array<{ date: string | null; amount: number; category: string; vendor: string }>;
  price_log: Array<{ date: string | null; amount: number; comment: string; has_hst: boolean }>;
};

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const iso = `${String(d.y).padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return iso;
  }
  const s = String(v).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function isDateVal(v: unknown): boolean {
  if (v instanceof Date) return true;
  if (typeof v === "number" && v > 20000 && v < 90000) return true;
  return false;
}

function addressFromFilename(filename: string): string {
  let name = filename.replace(/\.(xlsx|xlsm)$/i, "");
  name = name.replace(/^\s*(DONE|ACTIVE)\s*-\s*/i, "");
  name = name.replace(/\s*\(\d+\)\s*$/, "");
  name = name.replace(/\s+/g, " ");
  return name.trim();
}

function cellAt(ws: XLSX.WorkSheet, addr: string): unknown {
  const c = ws[addr];
  if (!c) return null;
  // Prefer JS value (v) when available (dates parsed as Date if cellDates: true)
  return c.v ?? null;
}

function cellRC(ws: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  return cellAt(ws, addr);
}

export function parseLedgerJobXlsx(fileBytes: ArrayBuffer | Uint8Array, filename: string): LedgerJobParsed {
  const wb = XLSX.read(fileBytes, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("No sheet found");

  const address = addressFromFilename(filename);
  const client_name = cellAt(ws, "C1") ? String(cellAt(ws, "C1")) : null;
  const start_date = parseDate(cellAt(ws, "C2"));
  const finish_date = parseDate(cellAt(ws, "C3"));
  const profit_margin = num(cellAt(ws, "F3"));
  const total_price = num(cellAt(ws, "B6"));
  const finish_materials = num(cellAt(ws, "E6"));
  const building_materials = num(cellAt(ws, "F6"));
  const subs = num(cellAt(ws, "G6"));
  const labor = num(cellAt(ws, "H6"));
  const net = num(cellAt(ws, "J6"));

  const range = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : { s: { r: 0, c: 0 }, e: { r: 1000, c: 20 } };
  const maxRow = Math.min(range.e.r + 1, 1000);

  // Walk PRICE log (J=date col 10, K=price col 11, L=comment col 12)
  let gross_cash = 0;
  let gross_with_hst = 0;
  const price_log: LedgerJobParsed["price_log"] = [];
  for (let row = 10; row <= maxRow; row++) {
    const dateVal = cellRC(ws, row, 10);
    if (!isDateVal(dateVal)) continue;
    const priceVal = cellRC(ws, row, 11);
    if (priceVal === null || priceVal === undefined) continue;
    const p = num(priceVal);
    const comment = String(cellRC(ws, row, 12) ?? "");
    const hasHst = comment.toLowerCase().includes("hst");
    if (hasHst) gross_with_hst += p;
    else gross_cash += p;
    price_log.push({
      date: parseDate(dateVal),
      amount: Math.round(p * 100) / 100,
      comment,
      has_hst: hasHst,
    });
  }

  // Payments log (D=date col 4, B=amount col 2, C=method col 3)
  let payments_received = 0;
  const payments_log: LedgerJobParsed["payments_log"] = [];
  for (let row = 10; row <= maxRow; row++) {
    const dateVal = cellRC(ws, row, 4);
    if (!isDateVal(dateVal)) continue;
    const payVal = cellRC(ws, row, 2);
    const method = cellRC(ws, row, 3);
    if (payVal === null || payVal === undefined) continue;
    const amt = num(payVal);
    payments_received += amt;
    payments_log.push({
      date: parseDate(dateVal),
      amount: Math.round(amt * 100) / 100,
      method: String(method ?? ""),
    });
  }

  // Expenses (J=date col 10, I=vendor col 9, E/F/G/H = categories cols 5/6/7/8)
  const catCols: Array<[number, string]> = [
    [5, "finish_materials"],
    [6, "building_materials"],
    [7, "subs"],
    [8, "labor"],
  ];
  const expense_log: LedgerJobParsed["expense_log"] = [];
  for (let row = 10; row <= maxRow; row++) {
    const dateVal = cellRC(ws, row, 10);
    if (!isDateVal(dateVal)) continue;
    const vendor = String(cellRC(ws, row, 9) ?? "");
    for (const [col, cat] of catCols) {
      const v = cellRC(ws, row, col);
      if (v === null || v === undefined || v === "") continue;
      const amt = num(v);
      if (amt === 0) continue;
      expense_log.push({
        date: parseDate(dateVal),
        amount: Math.round(amt * 100) / 100,
        category: cat,
        vendor,
      });
    }
  }

  return {
    address,
    client_name,
    start_date,
    finish_date,
    total_price,
    gross_cash: Math.round(gross_cash * 100) / 100,
    gross_with_hst: Math.round(gross_with_hst * 100) / 100,
    finish_materials,
    building_materials,
    subs,
    labor,
    net,
    profit_margin,
    lead_source: "unknown",
    payments_received: Math.round(payments_received * 100) / 100,
    payments_log,
    expense_log,
    price_log,
  };
}
