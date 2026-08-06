// Pure parsing for the per-job Google Sheet files ("MM/DD ongoing *** Address").
// Every job sheet shares one layout: a summary block at the top, then a row of
// column labels (Payment: / Method: / Date: / Finish Materials: / ... / Price)
// followed by free-form rows. Blocks are located by their label text, never by
// fixed row/column numbers, so a sheet with an extra column still parses.

export type ParsedPayment = {
  key: string;
  amount: number;
  method: string | null;
  date: string | null;
};

export type SheetCostCategory = "finish_material" | "material" | "subcontractor" | "labour";

export type ParsedCost = {
  key: string;
  category: SheetCostCategory;
  amount: number;
  description: string;
  date: string | null;
};

export type ParsedPriceLine = {
  key: string;
  amount: number;
  description: string;
};

export type ParsedJobSheet = {
  clientName: string | null;
  startDate: string | null;
  finishDate: string | null;
  payments: ParsedPayment[];
  costs: ParsedCost[];
  priceLines: ParsedPriceLine[];
  sheetTotals: {
    revenue: number | null;
    finishMaterials: number | null;
    buildingMaterials: number | null;
    subs: number | null;
    labour: number | null;
    netProfit: number | null;
  };
  warnings: string[];
};

/* ---------------- file name ---------------- */

export type ParsedFileName = {
  ongoing: boolean;
  isCopy: boolean;
  startLabel: string | null;
  address: string;
};

export function parseFileName(name: string): ParsedFileName {
  const raw = name.trim();
  const isCopy = /^copy of\b/i.test(raw);
  const cleaned = raw.replace(/^copy of\s+/i, "");
  const ongoing = /\bongoing\b/i.test(cleaned);
  const startMatch = cleaned.match(/^(\d{1,2}\/\d{1,2})/);
  // Everything after the "***" separator is the address; fall back to trimming
  // the leading date + status words when the separator is missing.
  let address = cleaned;
  const starIdx = cleaned.indexOf("***");
  if (starIdx >= 0) address = cleaned.slice(starIdx + 3);
  else
    address = cleaned
      .replace(/^\d{1,2}\/\d{1,2}\s*/, "")
      .replace(/\b(ongoing|complete[d]?|done|paid)\b/gi, "");
  return {
    ongoing,
    isCopy,
    startLabel: startMatch ? startMatch[1] : null,
    address: address.replace(/\s+/g, " ").trim(),
  };
}

const STREET_WORDS: Record<string, string> = {
  street: "st",
  st: "st",
  road: "rd",
  rd: "rd",
  avenue: "ave",
  ave: "ave",
  av: "ave",
  drive: "dr",
  dr: "dr",
  boulevard: "blvd",
  blvd: "blvd",
  bvld: "blvd",
  court: "crt",
  crt: "crt",
  ct: "crt",
  crescent: "cres",
  cres: "cres",
  lane: "ln",
  ln: "ln",
  place: "pl",
  pl: "pl",
  terrace: "terr",
  trail: "trl",
  way: "way",
  mews: "mews",
  gardens: "gdns",
  circle: "cir",
  parkway: "pkwy",
};

/**
 * Address match key: street number + normalised street name, with unit numbers,
 * scope notes in brackets and city/province tails dropped.
 */
export function addressKey(input: string): string {
  let s = (input || "").toLowerCase();
  s = s.replace(/\([^)]*\)/g, " "); // "(Living Room)"
  s = s.split(",")[0]; // drop city/province tail
  s = s.replace(/#\s*[\w-]+/g, " "); // unit numbers
  s = s.replace(/\bunit\s+[\w-]+/g, " ");
  s = s.replace(/[^a-z0-9\s]/g, " ");
  const parts = s.split(/\s+/).filter(Boolean).map((w) => STREET_WORDS[w] ?? w);
  // Stop after the street-type token so trailing words don't break the match.
  const out: string[] = [];
  for (const p of parts) {
    out.push(p);
    if (Object.values(STREET_WORDS).includes(p) && out.length > 1) break;
  }
  return out.join(" ").trim();
}

/* ---------------- primitives ---------------- */

export function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  const negParen = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/[$,\s]/g, "");
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negParen ? -n : n;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "May 19", "July 27, 2026", "2026-07-27" → ISO date (yyyy-mm-dd). */
export function parseSheetDate(v: unknown, yearHint: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = s.match(/^([a-zA-Z]+)\.?\s+(\d{1,2})(?:\s*,\s*(\d{4}))?$/);
  if (!m) return null;
  const monthIdx = MONTHS.findIndex((mm) => mm.startsWith(m[1].toLowerCase().slice(0, 3)));
  if (monthIdx < 0) return null;
  const year = m[3] ? Number(m[3]) : yearHint;
  const day = Number(m[2]);
  if (day < 1 || day > 31) return null;
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const cell = (row: string[] | undefined, i: number | undefined): string =>
  i == null || i < 0 || !row ? "" : String(row[i] ?? "").trim();

const labelIndex = (row: string[], ...labels: string[]): number => {
  const wanted = labels.map((l) => l.toLowerCase().replace(/[^a-z]/g, ""));
  for (let i = 0; i < row.length; i++) {
    const v = String(row[i] ?? "").toLowerCase().replace(/[^a-z]/g, "");
    if (v && wanted.includes(v)) return i;
  }
  return -1;
};

const findRowValue = (rows: string[][], label: string): string | null => {
  const wanted = label.toLowerCase().replace(/[^a-z]/g, "");
  for (const row of rows.slice(0, 12)) {
    for (let i = 0; i < row.length; i++) {
      const v = String(row[i] ?? "").toLowerCase().replace(/[^a-z]/g, "");
      if (v === wanted) {
        for (let j = i + 1; j < Math.min(i + 4, row.length); j++) {
          const val = String(row[j] ?? "").trim();
          if (val) return val;
        }
        return null;
      }
    }
  }
  return null;
};

/* ---------------- main parse ---------------- */

export function parseJobSheet(values: unknown[][], yearHint: number): ParsedJobSheet {
  const rows: string[][] = (values ?? []).map((r) =>
    (r ?? []).map((c) => (c == null ? "" : String(c))),
  );
  const warnings: string[] = [];

  const clientName = findRowValue(rows, "Client Name(s):");
  const startDate = parseSheetDate(findRowValue(rows, "Start Date:"), yearHint);
  const finishDate = parseSheetDate(findRowValue(rows, "Finish Date:"), yearHint);

  // Summary strip: a header row naming the buckets, values on the next row.
  const sheetTotals: ParsedJobSheet["sheetTotals"] = {
    revenue: null,
    finishMaterials: null,
    buildingMaterials: null,
    subs: null,
    labour: null,
    netProfit: null,
  };
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i];
    const revIdx = labelIndex(row, "Total Revenue");
    if (revIdx < 0) continue;
    const vals = rows[i + 1] ?? [];
    sheetTotals.revenue = parseMoney(vals[revIdx]);
    sheetTotals.finishMaterials = parseMoney(vals[labelIndex(row, "Finish Materials")]);
    sheetTotals.buildingMaterials = parseMoney(
      vals[labelIndex(row, "Building Materials:", "Bulding Materials:")],
    );
    sheetTotals.subs = parseMoney(vals[labelIndex(row, "Subs:")]);
    sheetTotals.labour = parseMoney(vals[labelIndex(row, "Labor:", "Labour:")]);
    sheetTotals.netProfit = parseMoney(vals[labelIndex(row, "Net Profit")]);
    break;
  }

  // Column-label row.
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (labelIndex(rows[i], "Payment:") >= 0) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    return {
      clientName,
      startDate,
      finishDate,
      payments: [],
      costs: [],
      priceLines: [],
      sheetTotals,
      warnings: ["Could not find the Payment / Expenses column headers in this sheet."],
    };
  }

  const head = rows[headerIdx];
  const payIdx = labelIndex(head, "Payment:");
  const methodIdx = payIdx + 1;
  const payDateIdx = payIdx + 2;
  const finishIdx = labelIndex(head, "Finish Materials:");
  const buildIdx = labelIndex(head, "Building Materials:", "Bulding Materials:");
  const subsIdx = labelIndex(head, "Subs:");
  const labourIdx = labelIndex(head, "Labor:", "Labour:");
  const priceIdx = labelIndex(head, "Price");
  const commentIdx = labourIdx >= 0 ? labourIdx + 1 : -1;
  const expenseDateIdx = labourIdx >= 0 ? labourIdx + 2 : -1;
  const priceCommentIdx = priceIdx >= 0 ? priceIdx + 1 : -1;

  if (finishIdx < 0 || buildIdx < 0 || subsIdx < 0 || labourIdx < 0)
    warnings.push("Some expense columns are missing; those costs were skipped.");
  if (priceIdx < 0) warnings.push("No Price column found; contract value not imported.");

  const payments: ParsedPayment[] = [];
  const costs: ParsedCost[] = [];
  const priceLines: ParsedPriceLine[] = [];

  const allCostCols: Array<{ idx: number; category: SheetCostCategory }> = [
    { idx: finishIdx, category: "finish_material" },
    { idx: buildIdx, category: "material" },
    { idx: subsIdx, category: "subcontractor" },
    { idx: labourIdx, category: "labour" },
  ];
  const costCols = allCostCols.filter((c) => c.idx >= 0);

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => String(c).trim() === "")) continue;

    const comment = cell(row, commentIdx);
    const expenseDate = cell(row, expenseDateIdx);
    const filledCostCols = costCols.filter((c) => parseMoney(row[c.idx]) != null).length;
    const payAmount = parseMoney(row[payIdx]);
    // The bottom totals row repeats every bucket with no comment and no date.
    const isTotalsRow =
      !comment && !expenseDate && filledCostCols >= 3 && payAmount != null;
    if (isTotalsRow) continue;

    if (payAmount != null && payAmount !== 0) {
      payments.push({
        key: `pay:${i}`,
        amount: payAmount,
        method: cell(row, methodIdx) || null,
        date: parseSheetDate(cell(row, payDateIdx), yearHint),
      });
    }

    for (const col of costCols) {
      const amount = parseMoney(row[col.idx]);
      if (amount == null || amount === 0) continue;
      costs.push({
        key: `cost:${i}:${col.category}`,
        category: col.category,
        amount,
        description: comment || defaultCostLabel(col.category),
        date: parseSheetDate(expenseDate, yearHint),
      });
    }

    if (priceIdx >= 0) {
      const price = parseMoney(row[priceIdx]);
      if (price != null && price !== 0) {
        priceLines.push({
          key: `price:${i}`,
          amount: price,
          description: cell(row, priceCommentIdx) || "Contract line",
        });
      }
    }
  }

  return { clientName, startDate, finishDate, payments, costs, priceLines, sheetTotals, warnings };
}

function defaultCostLabel(c: SheetCostCategory): string {
  if (c === "finish_material") return "Finish materials";
  if (c === "material") return "Building materials";
  if (c === "subcontractor") return "Subcontractor";
  return "Labour (sheet)";
}

/** Sum of the parsed rows, for reconciliation against the sheet's own totals. */
export function parsedTotals(parsed: ParsedJobSheet) {
  const sum = (f: (c: ParsedCost) => boolean) =>
    round2(parsed.costs.filter(f).reduce((s, c) => s + c.amount, 0));
  return {
    revenue: round2(parsed.payments.reduce((s, p) => s + p.amount, 0)),
    contract: round2(parsed.priceLines.reduce((s, p) => s + p.amount, 0)),
    finishMaterials: sum((c) => c.category === "finish_material"),
    buildingMaterials: sum((c) => c.category === "material"),
    subs: sum((c) => c.category === "subcontractor"),
    labour: sum((c) => c.category === "labour"),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Buckets where the sheet's own total disagrees with the rows we parsed. */
export function reconciliationWarnings(parsed: ParsedJobSheet): string[] {
  const mine = parsedTotals(parsed);
  const out: string[] = [];
  const check = (label: string, sheet: number | null, ours: number) => {
    if (sheet == null) return;
    if (Math.abs(sheet - ours) > 0.02)
      out.push(`${label}: sheet says ${sheet.toFixed(2)}, rows add to ${ours.toFixed(2)}`);
  };
  check("Payments", parsed.sheetTotals.revenue, mine.revenue);
  check("Finish materials", parsed.sheetTotals.finishMaterials, mine.finishMaterials);
  check("Building materials", parsed.sheetTotals.buildingMaterials, mine.buildingMaterials);
  check("Subs", parsed.sheetTotals.subs, mine.subs);
  check("Labour", parsed.sheetTotals.labour, mine.labour);
  return out;
}
