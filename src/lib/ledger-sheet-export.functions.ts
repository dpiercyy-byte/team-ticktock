import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";

const adminBase = z.object({ token: z.string() });

function parseSheetId(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const m = raw.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : raw;
}

export const setJobSheet = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ jobId: z.string().uuid(), url: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const sheetId = parseSheetId(data.url) || null;
    const { error } = await supabaseAdmin
      .from("ledger_jobs")
      .update({ sheet_id: sheetId, sheet_last_sync_at: null } as never)
      .eq("id", data.jobId);
    if (error) throw error;
    return { ...refreshed, sheetId };
  });

export const pushJobToSheetFn = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { pushJobToSheet } = await import("./ledger-sheet-export.server");
    const r = await pushJobToSheet(data.jobId);
    return { ...refreshed, ...r };
  });

export const pullJobFromSheetFn = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { pullJobFromSheet } = await import("./ledger-sheet-export.server");
    const r = await pullJobFromSheet(data.jobId);
    return { ...refreshed, ...r };
  });
