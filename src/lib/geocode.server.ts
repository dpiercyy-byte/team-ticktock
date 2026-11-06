const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export type Geocoded = { lat: number; lng: number; formatted: string };

/** Geocode a free-form address through the Google Maps connector gateway. */
export async function geocodeAddress(address: string): Promise<Geocoded> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY || !GMAPS_KEY) {
    throw new Error("Geocoding not configured");
  }
  const lookup = async (q: string) => {
    const res = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=ca&components=country:CA`,
      {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GMAPS_KEY,
        },
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`Geocode failed [${res.status}]: ${body}`);
      throw new Error(`Address lookup failed (${res.status})`);
    }
    const json: any = await res.json();
    if (json.status !== "OK") console.warn(`Geocode status ${json.status} for "${q}": ${json.error_message ?? ""}`);
    return json;
  };
  let json: any = await lookup(address);
  if (json.status === "ZERO_RESULTS" && !/ontario|\bON\b|canada/i.test(address)) {
    json = await lookup(`${address}, ON, Canada`);
  }
  if (json.status !== "OK" || !json.results?.length) {
    if (json.status === "ZERO_RESULTS") {
      throw new Error(`Google couldn't find "${address}" — add the city or postal code and try again.`);
    }
    throw new Error(`Address lookup failed (${json.status}${json.error_message ? `: ${json.error_message}` : ""})`);
  }
  const r = json.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address as string,
  };
}

