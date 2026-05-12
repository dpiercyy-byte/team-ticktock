import { supabaseAdmin } from "@/integrations/supabase/client.server";

export { supabaseAdmin };

export async function verifyHash(plain: string, hash: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("verify_hash", { plain, hash });
  if (error) throw error;
  return !!data;
}

export async function hashPassword(plain: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("hash_password", { plain });
  if (error) throw error;
  return data as string;
}
