// Pure grouping math for the worker lifetime detail view. No DB imports.
import { startOfWeekISO, hoursBetween } from "./payout-math";

export type LifetimeEntry = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  hours: number;
  siteLabel: string | null;
  project: string | null;
  flagged: boolean;
};

export type LifetimeReceipt = {
  id: string;
  description: string;
  amount: number;
  weekStart: string;
  createdAt: string;
  receiptUrl: string | null;
  receiptMime: string | null;
  vendor: string | null;
  date: string | null;
  siteLabel: string | null;
};

export type LifetimePayment = {
  weekStart: string;
  amount: number;
  actualPaid: number | null;
  tipAmount: number | null;
  paidAt: string;
  paidBy: string | null;
  paidByPerson: string | null;
};

export type LifetimeWeek = {
  weekStart: string;
  hours: number;
  wages: number;
  reimbTotal: number;
  total: number;
  entries: LifetimeEntry[];
  receipts: LifetimeReceipt[];
  payment: LifetimePayment | null;
};

export function buildLifetimeWeeks(args: {
  hourlyRate: number;
  entries: LifetimeEntry[];
  receipts: LifetimeReceipt[];
  payments: LifetimePayment[];
}): LifetimeWeek[] {
  const map = new Map<string, LifetimeWeek>();
  const get = (weekStart: string): LifetimeWeek => {
    let w = map.get(weekStart);
    if (!w) {
      w = {
        weekStart,
        hours: 0,
        wages: 0,
        reimbTotal: 0,
        total: 0,
        entries: [],
        receipts: [],
        payment: null,
      };
      map.set(weekStart, w);
    }
    return w;
  };

  for (const e of args.entries) {
    const w = get(startOfWeekISO(new Date(e.clockIn)));
    w.entries.push(e);
    w.hours += e.hours;
  }
  for (const r of args.receipts) {
    const w = get(r.weekStart);
    w.receipts.push(r);
    w.reimbTotal += r.amount;
  }
  for (const p of args.payments) {
    get(p.weekStart).payment = p;
  }

  const weeks = [...map.values()];
  for (const w of weeks) {
    w.wages = w.hours * args.hourlyRate;
    w.total = w.wages + w.reimbTotal;
    w.entries.sort((a, b) => a.clockIn.localeCompare(b.clockIn));
    w.receipts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  weeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  return weeks;
}

export function entryHours(clockIn: string, clockOut: string | null): number {
  return clockOut ? hoursBetween(clockIn, clockOut) : 0;
}
