// Client-side helpers for the Ledger app.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminToken, getWorkerSession } from "@/lib/session";
import {
  listLedgerJobs,
  updateLedgerJob,
  deleteLedgerJob,
  uploadLedgerJobXlsx,
} from "@/lib/ledger.functions";
import {
  getLedgerExportSettings,
  updateLedgerExportSettings,
  runLedgerSheetExportFn,
} from "@/lib/ledger-sheet-export.functions";

export type LedgerJob = {
  id: string;
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
  linked_job_site_id: string | null;
  created_at: string;
  updated_at: string;
};

export function getSessionToken(): string | null {
  return getAdminToken() ?? getWorkerSession()?.token ?? null;
}

export function isAdminSession(): boolean {
  return !!getAdminToken();
}

export function useLedgerJobs() {
  const listFn = useServerFn(listLedgerJobs);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ledger_jobs"],
    queryFn: async () => {
      const token = getSessionToken();
      if (!token) return [] as LedgerJob[];
      return (await listFn({ data: { token } })) as LedgerJob[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("ledger_jobs_stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger_jobs" }, () => {
        qc.invalidateQueries({ queryKey: ["ledger_jobs"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return query;
}

export function useUpdateLedgerJob() {
  const fn = useServerFn(updateLedgerJob);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const token = getSessionToken();
      if (!token) throw new Error("Not signed in");
      return fn({ data: { token, id, patch } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ledger_jobs"] }),
  });
}

export function useDeleteLedgerJob() {
  const fn = useServerFn(deleteLedgerJob);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = getSessionToken();
      if (!token) throw new Error("Not signed in");
      return fn({ data: { token, id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ledger_jobs"] }),
  });
}

export function useResetLedgerJobs() {
  const fn = useServerFn(resetLedgerJobs);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const token = getSessionToken();
      if (!token) throw new Error("Not signed in");
      return fn({ data: { token } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ledger_jobs"] }),
  });
}

export function useUploadLedgerJobXlsx() {
  const fn = useServerFn(uploadLedgerJobXlsx);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const token = getSessionToken();
      if (!token) throw new Error("Not signed in");
      const base64 = await fileToBase64(file);
      return fn({ data: { token, filename: file.name, base64 } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ledger_jobs"] }),
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// Formatters (ported from lib/format.js)
export const fmtMoney = (n: number | null | undefined, opts: { compact?: boolean; showCents?: boolean } = {}) => {
  const { compact = false, showCents = false } = opts;
  if (n === null || n === undefined || isNaN(Number(n))) return "$0";
  const value = Number(n);
  if (compact && Math.abs(value) >= 1000) {
    return "$" + Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }
  return "$" + Intl.NumberFormat("en-US", {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);
};

export const fmtPct = (n: number | null | undefined, digits = 1) => {
  if (n === null || n === undefined || isNaN(Number(n))) return "0%";
  return (Number(n) * 100).toFixed(digits) + "%";
};

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
};

export const monthKey = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "2-digit", month: "short" });
};

export const monthKeySortable = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const totalExpenses = (job: LedgerJob) =>
  (Number(job.finish_materials) || 0) + (Number(job.building_materials) || 0) +
  (Number(job.subs) || 0) + (Number(job.labor) || 0);
