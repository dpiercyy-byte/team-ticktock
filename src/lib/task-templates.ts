// Reusable checklist templates. Pure data + pure derivation so templates can be
// versioned and tested without touching the database.

export type TemplateItem = {
  key: string;
  title: string;
  description?: string;
  taskType: string;
  priority: TaskPriority;
  dueOffsetDays?: number; // relative to the anchor date when applied
};

export type ChecklistTemplate = {
  key: string;
  label: string;
  blurb: string;
  items: TemplateItem[];
};

export const TASK_STATUSES = [
  "Not Started",
  "In Progress",
  "Blocked",
  "Completed",
  "Cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TYPES = [
  "general",
  "admin",
  "site_visit",
  "inspection",
  "warranty",
  "payment",
  "trade",
  "closeout",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const ACCEPTED_JOB_TEMPLATE: ChecklistTemplate = {
  key: "accepted_job",
  label: "Pre-construction checklist",
  blurb: "Everything that must be true before the first crew day.",
  items: [
    { key: "signed_agreement", title: "Confirm signed agreement", taskType: "admin", priority: "Urgent", dueOffsetDays: 1 },
    { key: "deposit", title: "Confirm deposit", taskType: "payment", priority: "Urgent", dueOffsetDays: 2 },
    { key: "address_geofence", title: "Confirm project address and geofence", taskType: "admin", priority: "High", dueOffsetDays: 2 },
    { key: "start_window", title: "Confirm expected start window", taskType: "admin", priority: "High", dueOffsetDays: 3 },
    { key: "project_owner", title: "Assign project owner", taskType: "admin", priority: "High", dueOffsetDays: 3 },
    { key: "initial_crew", title: "Assign initial crew", taskType: "admin", priority: "Normal", dueOffsetDays: 5 },
    { key: "drawings", title: "Collect drawings", taskType: "admin", priority: "Normal", dueOffsetDays: 5 },
    { key: "selections", title: "Confirm required selections", taskType: "admin", priority: "Normal", dueOffsetDays: 7 },
    { key: "schedule_trades", title: "Schedule initial trades", taskType: "trade", priority: "High", dueOffsetDays: 7 },
    { key: "pre_start_walkthrough", title: "Complete pre-start walkthrough", taskType: "site_visit", priority: "High", dueOffsetDays: 10 },
  ],
};

export const CLOSEOUT_TEMPLATE: ChecklistTemplate = {
  key: "closeout",
  label: "Closeout checklist",
  blurb: "Finish the job properly and get paid.",
  items: [
    { key: "final_walkthrough", title: "Complete final walkthrough", taskType: "site_visit", priority: "High", dueOffsetDays: 1 },
    { key: "record_deficiencies", title: "Record deficiencies", taskType: "closeout", priority: "High", dueOffsetDays: 2 },
    { key: "complete_deficiencies", title: "Complete deficiencies", taskType: "closeout", priority: "High", dueOffsetDays: 7 },
    { key: "final_payment", title: "Collect final payment", taskType: "payment", priority: "Urgent", dueOffsetDays: 10 },
    { key: "completion_photos", title: "Upload completion photos", taskType: "closeout", priority: "Normal", dueOffsetDays: 10 },
    { key: "warranty_info", title: "Deliver warranty information", taskType: "warranty", priority: "Normal", dueOffsetDays: 12 },
    { key: "client_review", title: "Request client review", taskType: "closeout", priority: "Normal", dueOffsetDays: 14 },
    { key: "warranty_followup", title: "Schedule warranty follow-up", taskType: "warranty", priority: "Low", dueOffsetDays: 21 },
  ],
};

export const CHECKLIST_TEMPLATES = [ACCEPTED_JOB_TEMPLATE, CLOSEOUT_TEMPLATE];
export const TEMPLATE_KEYS = ["accepted_job", "closeout"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export function getTemplate(key: string): ChecklistTemplate | null {
  return CHECKLIST_TEMPLATES.find((t) => t.key === key) ?? null;
}

export function addDays(anchorIso: string, days: number): string {
  const d = new Date(anchorIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export type PlannedTask = {
  templateKey: string;
  templateItemKey: string;
  title: string;
  taskType: string;
  priority: TaskPriority;
  dueAt: string | null;
  sortOrder: number;
};

/**
 * Items from `template` that the project does not already have.
 * Re-applying a template tops up missing items instead of duplicating.
 */
export function planTemplateTasks(
  template: ChecklistTemplate,
  existingItemKeys: string[],
  anchorIso: string,
): PlannedTask[] {
  const have = new Set(existingItemKeys);
  return template.items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !have.has(item.key))
    .map(({ item, i }) => ({
      templateKey: template.key,
      templateItemKey: item.key,
      title: item.title,
      taskType: item.taskType,
      priority: item.priority,
      dueAt: item.dueOffsetDays == null ? null : addDays(anchorIso, item.dueOffsetDays),
      sortOrder: i,
    }));
}
