import { supabaseAdmin } from "@/integrations/supabase/client.server";

export { supabaseAdmin };

// Verify password against bcrypt hash via Postgres crypt()
export async function verifyHash(plain: string, hash: string): Promise<boolean> {
  // Use a dummy table-less query via rpc-less SELECT through a temp function:
  // Trick: call workers select with a synthetic comparison
  const { data, error } = await supabaseAdmin
    .rpc("verify_hash" as never, { plain, hash } as never);
  if (!error && data !== null) return Boolean(data);
  // Fallback: do it in JS using bcrypt comparison via a quick query
  const { data: rows, error: e2 } = await supabaseAdmin
    .from("app_settings")
    .select("id")
    .eq("id", 1)
    .limit(1);
  if (e2) throw e2;
  // If RPC not present, compare with a select expression using pg
  const { data: r, error: e3 } = await (supabaseAdmin as any).rpc("crypt_compare", { p: plain, h: hash });
  if (!e3 && r !== null) return Boolean(r);
  // Last resort: direct SQL via PostgREST not available; return false
  void rows;
  return false;
}
