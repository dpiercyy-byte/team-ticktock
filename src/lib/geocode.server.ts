const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export type Geocoded = { lat: number; lng: number; formatted: string };

/** Geocode a free-form address through the Google Maps connector gateway. */
export async function geocodeAddress(address: string): Promise<Geocoded> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY || !GMAPS_KEY) {
    throw new Response("Geocoding not configured", { status: 500 });
  }
  const res = await fetch(
    `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}`,
    {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GMAPS_KEY,
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Response(`Geocoding failed (${res.status}): ${body.slice(0, 200)}`, { status: 502 });
  }
  const json: any = await res.json();
  if (json.status !== "OK" || !json.results?.length) {
    throw new Response(`Address not found${json.error_message ? `: ${json.error_message}` : ""}`, { status: 400 });
  }
  const r = json.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address as string,
  };
}

/** Reverse-geocode coordinates into a street address via the same gateway. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY || !GMAPS_KEY) {
    throw new Response("Geocoding not configured", { status: 500 });
  }
  const res = await fetch(
    `${GATEWAY_URL}/maps/api/geocode/json?latlng=${lat},${lng}`,
    {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GMAPS_KEY,
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Response(`Address lookup failed (${res.status}): ${body.slice(0, 200)}`, { status: 502 });
  }
  const json: any = await res.json();
  if (json.status !== "OK" || !json.results?.length) {
    throw new Response("No address found for those coordinates", { status: 400 });
  }
  return json.results[0].formatted_address as string;
}
