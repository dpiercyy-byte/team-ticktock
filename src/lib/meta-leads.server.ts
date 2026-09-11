import { createHash } from "crypto";
import { supabaseAdmin } from "./db.server";
import { findOrCreateClient, findOrCreateProperty } from "./ledger-crm.server";
import { extractSpreadsheetId, parseLeadRow, qualifyLead, suggestMapping, type LeadFieldMapping, type LeadStage, type QualificationRules } from "./meta-leads";

const SHEETS = "https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets";
async function sheets(path: string) {
  const lovKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovKey || !connKey) throw new Error("Google Sheets connection is not configured");
  const res = await fetch(`${SHEETS}${path}`, { headers: { Authorization: `Bearer ${lovKey}`, "X-Connection-Api-Key": connKey } });
  if (!res.ok) { const body = await res.text().catch(() => ""); throw new Error(`Google Sheets ${res.status}: ${body.slice(0, 500)}`); }
  return res;
}
const sourceDto = (r: Record<string, any>) => ({ id: r.id, spreadsheetId: r.spreadsheet_id, spreadsheetUrl: r.spreadsheet_url, sheetTab: r.sheet_tab, fieldMapping: r.field_mapping as LeadFieldMapping, syncEnabled: r.sync_enabled, status: r.status, lastError: r.last_error, lastSyncedAt: r.last_synced_at, lastImportedCount: r.last_imported_count, lastSkippedCount: r.last_skipped_count, lastRejectedCount: r.last_rejected_count });
const leadDto = (r: Record<string, any>) => ({ id: r.id, sourceId: r.source_id, externalId: r.external_id, clientName: r.client_name, phone: r.phone, email: r.email, address: r.address, projectType: r.project_type, budgetCents: r.budget_cents === null ? null : Number(r.budget_cents), campaign: r.campaign, formName: r.form_name, notes: r.notes, submittedAt: r.submitted_at, qualificationStatus: r.qualification_status, qualificationReasons: r.qualification_reasons ?? [], stage: r.stage as LeadStage, assignedOwner: r.assigned_owner, nextAction: r.next_action, nextActionDueAt: r.next_action_due_at, lostReason: r.lost_reason, rawData: r.raw_data ?? {}, ledgerJobId: r.ledger_job_id, importedAt: r.imported_at, updatedAt: r.updated_at });
export async function fetchSheetPreview(input: string, tab?: string) {
  const id = extractSpreadsheetId(input); if (!id) throw new Error("Enter a valid Google Sheets URL");
  const meta = await sheets(`/${id}?fields=properties.title,sheets.properties.title`);
  const metadata = await meta.json() as { properties?: { title?: string }; sheets?: Array<{ properties?: { title?: string } }> };
  const tabs = (metadata.sheets ?? []).map((s) => s.properties?.title).filter((v): v is string => !!v);
  const sheetTab = tab && tabs.includes(tab) ? tab : tabs[0]; if (!sheetTab) throw new Error("This spreadsheet has no readable tabs");
  const range = `'${sheetTab.replaceAll("'", "''")}'!A1:ZZ6`;
  const valuesRes = await sheets(`/${id}/values/${range}?valueRenderOption=FORMATTED_VALUE`);
  const values = ((await valuesRes.json()) as { values?: unknown[][] }).values ?? [];
  const headers = (values[0] ?? []).map(String).map((v) => v.trim()).filter(Boolean);
  const sampleRows = values.slice(1, 4).map((row) => row.map((cell) => String(cell ?? "")));
  return { spreadsheetId: id, title: metadata.properties?.title ?? "Lead spreadsheet", tabs, sheetTab, headers, suggestedMapping: suggestMapping(headers), sampleRows };
}
async function getRules(): Promise<QualificationRules> {
  const { data, error } = await supabaseAdmin.from("lead_qualification_rules").select("*").eq("id", 1).single(); if (error) throw error;
  return { minimumBudgetCents: data.minimum_budget_cents === null ? null : Number(data.minimum_budget_cents), acceptedProjectTypes: data.accepted_project_types ?? [], acceptedPostalPrefixes: data.accepted_postal_prefixes ?? [] };
}
export async function listLeadData() {
  const [{ data: sources, error: sErr }, { data: leads, error: lErr }, rules] = await Promise.all([
    supabaseAdmin.from("lead_sources").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("lead_records").select("*").order("submitted_at", { ascending: false, nullsFirst: false }).order("imported_at", { ascending: false }), getRules(),
  ]); if (sErr) throw sErr; if (lErr) throw lErr;
  return { sources: (sources ?? []).map((r) => sourceDto(r as Record<string, any>)), leads: (leads ?? []).map((r) => leadDto(r as Record<string, any>)), rules };
}
export async function getLeadDetail(id: string) {
  const { data, error } = await supabaseAdmin.from("lead_records").select("*").eq("id", id).maybeSingle(); if (error) throw error; if (!data) throw new Response("Not found", { status: 404 });
  const { data: activity, error: aErr } = await supabaseAdmin.from("lead_activities").select("*").eq("lead_id", id).order("occurred_at", { ascending: false }); if (aErr) throw aErr;
  return { lead: leadDto(data as Record<string, any>), activity: (activity ?? []).map((a: any) => ({ id: a.id, kind: a.kind, title: a.title, detail: a.detail, occurredAt: a.occurred_at })) };
}
export async function saveLeadSource(input: { spreadsheetUrl: string; sheetTab: string; fieldMapping: LeadFieldMapping; syncEnabled: boolean }) {
  const spreadsheetId = extractSpreadsheetId(input.spreadsheetUrl); if (!spreadsheetId) throw new Error("Enter a valid Google Sheets URL");
  const { data, error } = await supabaseAdmin.from("lead_sources").upsert({ spreadsheet_id: spreadsheetId, spreadsheet_url: input.spreadsheetUrl.trim(), sheet_tab: input.sheetTab, field_mapping: input.fieldMapping as any, sync_enabled: input.syncEnabled, status: "pending", last_error: null }, { onConflict: "spreadsheet_id" }).select("*").single(); if (error) throw error;
  return sourceDto(data as Record<string, any>);
}
export async function saveRules(rules: QualificationRules) { const { error } = await supabaseAdmin.from("lead_qualification_rules").update({ minimum_budget_cents: rules.minimumBudgetCents, accepted_project_types: rules.acceptedProjectTypes, accepted_postal_prefixes: rules.acceptedPostalPrefixes }).eq("id", 1); if (error) throw error; return rules; }
const fingerprint = (sourceId: string, lead: ReturnType<typeof parseLeadRow>) => createHash("sha256").update(JSON.stringify([sourceId, lead.externalId, lead.email?.toLowerCase(), lead.phone?.replace(/\D/g, ""), lead.name.toLowerCase(), lead.submittedAt, lead.rawData])).digest("hex");
export async function syncLeadSource(sourceId: string) {
  const { data, error } = await supabaseAdmin.from("lead_sources").select("*").eq("id", sourceId).maybeSingle(); if (error) throw error; if (!data) throw new Error("Lead source not found"); const src = data as any;
  try {
    const range = `'${String(src.sheet_tab).replaceAll("'", "''")}'!A1:ZZ5000`;
    const res = await sheets(`/${src.spreadsheet_id}/values/${range}?valueRenderOption=FORMATTED_VALUE`);
    const values = ((await res.json()) as { values?: unknown[][] }).values ?? [];
    const headers = (values[0] ?? []).map(String).map((v) => v.trim()); const rules = await getRules(); let imported = 0; let skipped = 0; let rejected = 0;
    for (let i = 1; i < values.length; i += 1) {
      if (!(values[i] ?? []).some((v) => String(v ?? "").trim())) continue;
      const lead = parseLeadRow(headers, values[i] ?? [], src.field_mapping as LeadFieldMapping); const rowFingerprint = fingerprint(src.id, lead); const qualification = qualifyLead(lead, rules);
      const { data: inserted, error: insertError } = await supabaseAdmin.from("lead_records").insert({ source_id: src.id, external_id: lead.externalId, row_fingerprint: rowFingerprint, source_row_number: i + 1, client_name: lead.name, phone: lead.phone, email: lead.email, address: lead.address, project_type: lead.projectType, budget_cents: lead.budgetCents, campaign: lead.campaign, form_name: lead.formName, notes: lead.notes, submitted_at: lead.submittedAt, qualification_status: qualification.status, qualification_reasons: qualification.reasons, raw_data: lead.rawData as any }).select("id").single();
      if (insertError) { if (insertError.code === "23505") { skipped += 1; continue; } throw insertError; }
      imported += 1; if (qualification.status === "rejected") rejected += 1;
      await supabaseAdmin.from("lead_activities").insert({ lead_id: inserted.id, kind: "import", title: "Imported from Google Sheets", detail: qualification.reasons.join(" · ") });
    }
    await supabaseAdmin.from("lead_sources").update({ status: "synced", last_error: null, last_synced_at: new Date().toISOString(), last_imported_count: imported, last_skipped_count: skipped, last_rejected_count: rejected }).eq("id", src.id);
    return { ok: true, imported, skipped, rejected };
  } catch (e) { const message = e instanceof Error ? e.message : String(e); await supabaseAdmin.from("lead_sources").update({ status: "error", last_error: message.slice(0, 500) }).eq("id", src.id); return { ok: false, imported: 0, skipped: 0, rejected: 0, error: message }; }
}
export async function syncAllLeadSources() { const { data, error } = await supabaseAdmin.from("lead_sources").select("id").eq("sync_enabled", true); if (error) throw error; const results = []; for (const source of data ?? []) results.push(await syncLeadSource(source.id)); return { synced: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, imported: results.reduce((n, r) => n + r.imported, 0), results }; }
export async function updateLead(id: string, patch: { stage?: LeadStage; assignedOwner?: string | null; nextAction?: string | null; nextActionDueAt?: string | null; qualificationStatus?: "qualified" | "needs_review" | "rejected"; lostReason?: string | null }) {
  const dbPatch: Record<string, unknown> = {}; if (patch.stage !== undefined) dbPatch.stage = patch.stage; if (patch.assignedOwner !== undefined) dbPatch.assigned_owner = patch.assignedOwner; if (patch.nextAction !== undefined) dbPatch.next_action = patch.nextAction; if (patch.nextActionDueAt !== undefined) dbPatch.next_action_due_at = patch.nextActionDueAt; if (patch.qualificationStatus !== undefined) dbPatch.qualification_status = patch.qualificationStatus; if (patch.lostReason !== undefined) dbPatch.lost_reason = patch.lostReason;
  const { data, error } = await supabaseAdmin.from("lead_records").update(dbPatch as never).eq("id", id).select("*").single(); if (error) throw error;
  await supabaseAdmin.from("lead_activities").insert({ lead_id: id, kind: patch.stage ? "stage" : "update", title: patch.stage ? `Moved to ${patch.stage}` : "Lead updated", detail: patch.lostReason ?? null }); return leadDto(data as Record<string, any>);
}
export async function convertLead(id: string) {
  const { data, error } = await supabaseAdmin.from("lead_records").select("*").eq("id", id).maybeSingle(); if (error) throw error; if (!data) throw new Error("Lead not found"); const lead = data as any;
  if (lead.ledger_job_id) return { lead: leadDto(lead), jobId: lead.ledger_job_id as string };
  if (!lead.address || !lead.project_type) throw new Error("Add an address and project type before winning this lead");
  const clientId = await findOrCreateClient({ name: lead.client_name, email: lead.email, phone: lead.phone, leadSource: "Meta" }); const propertyId = await findOrCreateProperty(clientId, { address: lead.address }); const lastName = String(lead.client_name).trim().split(/\s+/).slice(-1)[0]; const now = new Date().toISOString();
  const { data: job, error: jErr } = await supabaseAdmin.from("ledger_jobs").insert({ name: `${lastName} ${lead.project_type}`, client_name: lead.client_name, client_email: lead.email, client_phone: lead.phone, address: lead.address, client_id: clientId, property_id: propertyId, project_type: lead.project_type, trades: [], status: "Scheduled", sales_stage: "Won", delivery_status: "Not Started", sales_stage_changed_at: now, estimated_value_cents: lead.budget_cents ?? 0, assigned_owner: lead.assigned_owner, next_action: lead.next_action, next_action_owner: lead.assigned_owner, next_action_due_at: lead.next_action_due_at }).select("id").single(); if (jErr) throw jErr;
  const { data: updated, error: uErr } = await supabaseAdmin.from("lead_records").update({ stage: "Won", ledger_job_id: job.id }).eq("id", id).select("*").single(); if (uErr) throw uErr;
  await Promise.all([supabaseAdmin.from("ledger_job_events").insert({ job_id: job.id, kind: "created", title: "Job created from Meta lead" }), supabaseAdmin.from("lead_activities").insert({ lead_id: id, kind: "conversion", title: "Converted to Ledger job", metadata: { jobId: job.id } })]); return { lead: leadDto(updated as Record<string, any>), jobId: job.id as string };
}
