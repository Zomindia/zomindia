/**
 * Granular Reverse Geocoding Utility for Zomindia
 * Provides Zomato/Rapido-level doorstep address accuracy:
 * 1. Primary: Google Maps Geocoder API (evaluating granular address_components: premise, route, sublocality, locality, postal_code)
 * 2. Secondary: OpenStreetMap Nominatim with granular data.address dictionary parsing (avoiding generic display_name)
 * 3. Never collapses valid coordinates to static landmark fallbacks
 */

export interface ReverseGeocodeResult {
  fullAddress: string;
  premise?: string;
  road?: string;
  colony?: string;
  sublocality?: string;
  city?: string;
  postcode?: string;
  source: 'google' | 'nominatim' | 'coordinates';
}

interface AddressComponentLike {
  long_name: string;
  short_name: string;
  types: string[];
}

/**
 * Parses Google Geocoder address components to build a granular address hierarchy:
 * [Premise/Building, Colony/Sublocality, Road, Locality, Pincode]
 */
export function parseGoogleAddressComponents(components: AddressComponentLike[]): {
  addressString: string;
  premise: string;
  road: string;
  colony: string;
  sublocality: string;
  city: string;
  postcode: string;
} {
  let premise = '';
  let subpremise = '';
  let pointOfInterest = '';
  let route = '';
  let neighborhood = '';
  let sublocality3 = '';
  let sublocality2 = '';
  let sublocality1 = '';
  let locality = '';
  let postalCode = '';

  for (const c of components) {
    const types = c.types || [];
    if (types.includes('premise')) premise = c.long_name;
    else if (types.includes('subpremise')) subpremise = c.long_name;
    else if (types.includes('point_of_interest')) pointOfInterest = c.long_name;
    else if (types.includes('route')) route = c.long_name;
    else if (types.includes('neighborhood')) neighborhood = c.long_name;
    else if (types.includes('sublocality_level_3')) sublocality3 = c.long_name;
    else if (types.includes('sublocality_level_2')) sublocality2 = c.long_name;
    else if (types.includes('sublocality_level_1')) sublocality1 = c.long_name;
    else if (types.includes('locality')) locality = c.long_name;
    else if (types.includes('postal_code')) postalCode = c.long_name;
  }

  const building = [subpremise, premise, pointOfInterest].filter(Boolean).join(' ').trim();
  const colony = sublocality2 || sublocality3 || neighborhood || '';
  const majorArea = sublocality1;
  const city = locality || 'Indore';

  // Construct granular address: [Colony/Sublocality, Road, Locality, Pincode]
  // Include premise / building if identified
  const rawParts = [
    building,
    colony,
    majorArea && majorArea.toLowerCase() !== colony.toLowerCase() ? majorArea : '',
    route,
    city,
    postalCode,
  ].filter(Boolean);

  // Case-insensitive deduplication while preserving order
  const seen = new Set<string>();
  const cleanParts: string[] = [];
  for (const part of rawParts) {
    const trimmed = part.trim();
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      cleanParts.push(trimmed);
    }
  }

  const addressString = cleanParts.join(', ');

  return {
    addressString,
    premise: building,
    road: route,
    colony,
    sublocality: majorArea || colony,
    city,
    postcode: postalCode,
  };
}

/**
 * Granular parser for OpenStreetMap Nominatim jsonv2 payload.
 * Extracts from data.address rather than data.display_name.
 */
export function parseNominatimPayload(data: any): ReverseGeocodeResult | null {
  if (!data || !data.address) return null;
  const a = data.address || {};
  const premise = (a.amenity || a.building || a.house_number || '').trim();
  const road = (a.road || a.pedestrian || a.street || '').trim();
  const colony = (a.suburb || a.neighbourhood || a.residential || a.sublocality || '').trim();
  const city = (a.city || a.town || a.city_district || 'Indore').trim();
  const postcode = (a.postcode || '').trim();

  // Combine non-empty tokens: [premise, road, colony, city, postcode]
  const tokens = [premise, road, colony, city, postcode].filter(Boolean);
  if (tokens.length === 0) return null;

  // Deduplicate tokens case-insensitively
  const seen = new Set<string>();
  const cleanTokens: string[] = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      cleanTokens.push(token);
    }
  }

  const fullAddress = cleanTokens.join(', ');
  if (!fullAddress) return null;

  return {
    fullAddress,
    premise,
    road,
    colony,
    sublocality: colony,
    city,
    postcode,
    source: 'nominatim',
  };
}

/**
 * Attempts reverse geocoding via Google Maps JavaScript SDK Geocoder
 */
async function reverseGeocodeGoogle(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  if (typeof window === 'undefined') return null;

  const googleMaps = (window as any).google?.maps;
  if (!googleMaps || !googleMaps.Geocoder) return null;

  return new Promise((resolve) => {
    try {
      const geocoder = new googleMaps.Geocoder();
      geocoder.geocode(
        { location: { lat, lng } },
        (results: any[], status: string) => {
          if (status === 'OK' && Array.isArray(results) && results.length > 0) {
            // Find the most specific result
            const specificResult = results.find((r) =>
              r.types?.some((t: string) =>
                ['premise', 'subpremise', 'point_of_interest', 'street_address', 'route'].includes(t)
              )
            ) || results[0];

            if (specificResult?.address_components && specificResult.address_components.length > 0) {
              const parsed = parseGoogleAddressComponents(specificResult.address_components);
              if (parsed.addressString.length > 0) {
                return resolve({
                  fullAddress: parsed.addressString,
                  premise: parsed.premise,
                  road: parsed.road,
                  colony: parsed.colony,
                  sublocality: parsed.sublocality,
                  city: parsed.city,
                  postcode: parsed.postcode,
                  source: 'google',
                });
              }
            }

            if (specificResult?.formatted_address) {
              return resolve({
                fullAddress: specificResult.formatted_address,
                city: 'Indore',
                source: 'google',
              });
            }
          }
          resolve(null);
        }
      );
    } catch (err) {
      console.warn('[Google Geocoder Non-blocking Notice]:', err);
      resolve(null);
    }
  });
}

/**
 * Attempts reverse geocoding via OpenStreetMap Nominatim with granular data.address parsing
 */
async function reverseGeocodeNominatim(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'zomindia-app-preview',
      },
    });

    if (res.ok) {
      const data = await res.json();
      return parseNominatimPayload(data);
    }
  } catch (err) {
    console.warn('[OSM Nominatim Non-blocking Notice]:', err);
  }
  return null;
}

/**
 * Unified reverse geocode function with granular hierarchy and graceful fallbacks.
 * Never snaps to static landmark arrays.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  // 1. Primary: Google Maps Geocoder
  try {
    const googleRes = await reverseGeocodeGoogle(lat, lng);
    if (googleRes && googleRes.fullAddress.trim().length > 0) {
      return googleRes;
    }
  } catch (gErr) {
    console.warn('[Google Maps Geocoder Fallback]:', gErr);
  }

  // 2. Secondary: Granular Nominatim data.address Parser
  try {
    const osmRes = await reverseGeocodeNominatim(lat, lng);
    if (osmRes && osmRes.fullAddress.trim().length > 0) {
      return osmRes;
    }
  } catch (osmErr) {
    console.warn('[OSM Nominatim Fallback]:', osmErr);
  }

  // 3. Fallback to precise coordinates rather than arbitrary static landmarks
  return {
    fullAddress: `Indore, Madhya Pradesh (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    city: 'Indore',
    source: 'coordinates',
  };
}
