import { supabaseAdmin } from "./db.server";

export type ClientInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  leadSource?: string | null;
  preferredContactMethod?: string | null;
};

export type PropertyInput = {
  address: string;
  unit?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
};

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

/** Find an existing client by name+email, otherwise create one. */
export async function findOrCreateClient(input: ClientInput): Promise<string> {
  const { data: existing, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, email")
    .is("archived_at", null);
  if (error) throw error;

  const match = (existing ?? []).find(
    (c) => norm(c.name) === norm(input.name) && norm(c.email) === norm(input.email),
  );
  if (match) return match.id;

  const { data: created, error: insErr } = await supabaseAdmin
    .from("clients")
    .insert({
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      lead_source: input.leadSource?.trim() || null,
      preferred_contact_method: input.preferredContactMethod?.trim() || null,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return created.id;
}

/** Find an existing property for a client by address, otherwise create one. */
export async function findOrCreateProperty(
  clientId: string,
  input: PropertyInput,
): Promise<string> {
  const { data: existing, error } = await supabaseAdmin
    .from("properties")
    .select("id, address")
    .eq("client_id", clientId)
    .is("archived_at", null);
  if (error) throw error;

  const match = (existing ?? []).find((p) => norm(p.address) === norm(input.address));
  if (match) return match.id;

  const { data: created, error: insErr } = await supabaseAdmin
    .from("properties")
    .insert({
      client_id: clientId,
      address: input.address.trim(),
      unit: input.unit?.trim() || null,
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
      postal_code: input.postalCode?.trim() || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return created.id;
}
