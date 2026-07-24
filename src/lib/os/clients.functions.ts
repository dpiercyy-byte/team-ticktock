import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/auth.server";

const db = supabaseAdmin as any;

export const listClients = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: rows, error } = await db
      .from("clients")
      .select("id, name, email, phone")
      .is("archived_at", null)
      .order("name", { ascending: true });
    if (error) throw error;
    return rows as Array<{ id: string; name: string; email: string | null; phone: string | null }>;
  });

export const createClient = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; name: string; email?: string; phone?: string }) =>
    z
      .object({
        token: z.string(),
        name: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: row, error } = await db
      .from("clients")
      .insert({ name: data.name.trim(), email: data.email || null, phone: data.phone || null })
      .select("id, name")
      .single();
    if (error) throw error;
    return row as { id: string; name: string };
  });
