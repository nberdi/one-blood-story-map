const GEOCODE_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const SEARCH_LIMIT = 6;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildLabel(result) {
  const name = typeof result?.name === "string" ? result.name.trim() : "";
  const admin = typeof result?.admin1 === "string" ? result.admin1.trim() : "";
  const country =
    typeof result?.country === "string" ? result.country.trim() : "";

  const locationParts = [name, admin].filter(Boolean).join(", ");
  if (country) return `${locationParts || name}, ${country}`;
  return locationParts || name;
}

function sanitizeCountryCode(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function normalizeGeocodeResult(result) {
  const latitude = toNumber(result?.latitude);
  const longitude = toNumber(result?.longitude);
  const label = buildLabel(result);
  const countryCode = sanitizeCountryCode(result?.country_code);

  if (!label || latitude === null || longitude === null) return null;

  return {
    id: `${result?.id || label}-${latitude}-${longitude}`,
    label,
    latitude,
    longitude,
    city: typeof result?.name === "string" ? result.name.trim() : "",
    country: typeof result?.country === "string" ? result.country.trim() : "",
    countryCode,
  };
}

async function runSearch(query, limit, signal) {
  const trimmedQuery = typeof query === "string" ? query.trim() : "";
  if (trimmedQuery.length < 2) return [];

  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set("name", trimmedQuery);
  url.searchParams.set("count", String(limit));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Hometown search failed (${response.status})`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map(normalizeGeocodeResult).filter(Boolean);
}

export async function searchHometownSuggestions(query, options = {}) {
  return runSearch(query, SEARCH_LIMIT, options.signal);
}

export async function geocodeHometown(query) {
  const results = await runSearch(query, 3);
  if (results.length !== 1) return null;
  return results[0];
}
