import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";

export const getPublicSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("app_settings").select("project_tracking_enabled, show_pay_estimates").eq("id", 1).single();
  if (error) throw error;
  return data;
});

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    projectTrackingEnabled: z.boolean(),
    showPayEstimates: z.boolean(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("app_settings").update({
      project_tracking_enabled: data.projectTrackingEnabled,
      show_pay_estimates: data.showPayEstimates,
    }).eq("id", 1);
    if (error) throw error;
    return refreshed;
  });
