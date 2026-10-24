/**
 * Granular Doorstep Reverse Geocoding Utility for Zomindia
 *
 * - Strictly preserves raw { lat, lng } coordinates.
 * - Prioritizes Google Maps Native Geocoder when available.
 * - OpenStreetMap Nominatim reverse geocoding fallback.
 * - Swiggy/Zomato Hyper-Local Address Hierarchy:
 *   MICRO (sublocality_level_2, sublocality_level_3, neighborhood, premise)
 *   ALWAYS takes strict precedence over MACRO (sublocality_level_1, sublocality).
 */

export interface ReverseGeocodeResult {
  lat: number;
  lng: number;
  fullAddress: string;
  area: string;
  premise?: string;
  road?: string;
  colony?: string;
  sublocality?: string;
  city?: string;
  postcode?: string;
  source: 'google' | 'nominatim' | 'coordinates';
}

/**
 * Indore Popular Township Smart Alias Dictionary
 * Maps raw revenue village names to popular Indore residential area names.
 */
export const INDORE_TOWNSHIP_ALIASES: Record<string, string> = {
  'kelod hala': 'Singapore Township',
  'talawali chanda': 'Talawali Chanda',
  'pipliya kumar': 'Mahalaxmi Nagar',
  'nipania': 'Nipania',
  'bicholi mardana': 'Bicholi Mardana',
  'bicholi hapsi': 'Bicholi Hapsi',
  'kanadia': 'Kanadia',
  'lasudia mori': 'Lasudiya Mori',
  'lasuriamori': 'Lasudiya Mori',
  'kumedi': 'Super Corridor',
  'dudhla': 'Dudhia',
};

/**
 * Resolves any string against the Indore Township Smart Alias Dictionary (case-insensitive)
 */
export function resolveIndoreTownshipAlias(name?: string | null): string | null {
  if (!name) return null;
  const clean = name.trim().toLowerCase();
  for (const [rawKey, targetAlias] of Object.entries(INDORE_TOWNSHIP_ALIASES)) {
    if (clean === rawKey || clean.includes(rawKey)) {
      return targetAlias;
    }
  }
  return null;
}

export const isBroadIndoreName = (str?: string | null): boolean => {
  if (!str) return true;
  const clean = str.trim().toLowerCase();
  return (
    clean === '' ||
    /^(indore|indore city|indore tehsil|indore district|indore municipal corporation|madhya pradesh|mp|india|452\d{3}|unnamed road)$/i.test(
      clean
    )
  );
};

const isPureHouseNumber = (str?: string | null): boolean => {
  if (!str) return false;
  return /^[0-9]+[a-zA-Z0-9\s/-]*$/.test(str.trim()) && str.trim().length <= 10;
};

/**
 * Granular parser for OpenStreetMap Nominatim jsonv2 payload.
 * Evaluates micro-localities (sublocality_level_2, neighbourhood, quarter, residential, housing)
 * strictly BEFORE macro-localities (sublocality_level_1, sublocality, suburb, city_district, village).
 */
export function parseNominatimPayload(data: any, lat: number, lng: number): ReverseGeocodeResult | null {
  if (!data || !data.address) return null;
  const a = data.address || {};

  const premise = (
    a.house_number ||
    a.building ||
    a.house_name ||
    a.flat ||
    a.amenity ||
    a.office ||
    a.shop ||
    ''
  ).trim();
  const rawRoad = (a.road || a.pedestrian || a.street || '').trim();
  const road = isBroadIndoreName(rawRoad) ? '' : rawRoad;

  // Swiggy/Zomato Hyper-Local Hierarchy: micro-localities strictly precede macro-localities
  const microLocal = (
    a.sublocality_level_2 ||
    a.sublocality_level_3 ||
    a.neighbourhood ||
    a.quarter ||
    a.residential ||
    a.housing ||
    (!isPureHouseNumber(premise) ? premise : '') ||
    ''
  ).trim();

  const macroLocal = (
    a.sublocality_level_1 ||
    a.sublocality ||
    a.suburb ||
    a.city_district ||
    a.village ||
    a.hamlet ||
    ''
  ).trim();

  const micro =
    microLocal && !isBroadIndoreName(microLocal)
      ? resolveIndoreTownshipAlias(microLocal) || microLocal
      : '';

  // Only apply macro township alias (like Kelod Hala -> Singapore Township) if micro isn't already a specific colony,
  // or if macro is a standard ward like Lasudia Mori -> Lasudiya Mori
  let macro = '';
  if (macroLocal && !isBroadIndoreName(macroLocal)) {
    const lowerMacro = macroLocal.toLowerCase();
    if (micro && lowerMacro.includes('kelod')) {
      macro = 'Kelod Hala';
    } else {
      macro = resolveIndoreTownshipAlias(macroLocal) || macroLocal;
    }
  }

  // INVERT PRECEDENCE (NEVER LET LEVEL-1 ECLIPSE LEVEL-2):
  const colony = micro
    ? macro && !micro.toLowerCase().includes(macro.toLowerCase())
      ? `${micro}, ${macro}`
      : micro
    : macro || road;

  const city = (a.city || a.town || 'Indore').trim();
  const postcode = (a.postcode || '').trim();

  const rawTokens = [premise, road, colony, city, postcode].filter(Boolean);
  if (rawTokens.length === 0) return null;

  const seen = new Set<string>();
  const cleanTokens: string[] = [];
  for (const token of rawTokens) {
    const lower = token.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      cleanTokens.push(token);
    }
  }

  const fullAddress = cleanTokens.join(', ');
  if (!fullAddress) return null;

  let area = colony;
  if (area && !area.toLowerCase().includes(city.toLowerCase())) {
    area = `${area}, ${city}`;
  } else if (!area) {
    area = road ? `${road}, ${city}` : city;
  }

  return {
    lat,
    lng,
    fullAddress,
    area,
    premise,
    road,
    colony: colony || macro || road,
    sublocality: colony || macro || road,
    city,
    postcode,
    source: 'nominatim',
  };
}

/**
 * Reverse geocode using Google Maps native Geocoder API (when available in window.google).
 * Inverted Address Hierarchy (Swiggy / Zomato standard):
 * - MICRO (Level-2 / Neighborhood): 'sublocality_level_2', 'sublocality_level_3', 'neighborhood', or named 'premise'.
 * - MACRO (Level-1 / Revenue Ward): 'sublocality_level_1' or 'sublocality'.
 * - CITY: 'locality' (Indore).
 * - MICRO MUST ALWAYS TAKE PRECEDENCE OVER MACRO.
 */
export async function reverseGeocodeWithGoogle(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  if (typeof window === 'undefined') return null;
  const googleMaps = (window as any).google?.maps;
  if (!googleMaps || !googleMaps.Geocoder) return null;

  return new Promise((resolve) => {
    try {
      const geocoder = new googleMaps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
        if (status !== 'OK' || !results || results.length === 0) {
          return resolve(null);
        }

        let premise = '';
        let road = '';
        let sublocalityLevel2 = '';
        let sublocalityLevel3 = '';
        let neighborhood = '';
        let sublocalityLevel1 = '';
        let sublocalityGeneral = '';
        let locality = '';
        let postalCode = '';

        // Scan across all returned geocoder results in order of specificity so that if results[0]
        // is a plus_code or unnamed route, we still capture sublocality_level_2 / neighborhood from results[1..n]
        for (const resItem of results) {
          for (const comp of resItem.address_components || []) {
            const types: string[] = comp.types || [];
            const name = (comp.long_name || '').trim();
            if (!name || types.includes('plus_code')) continue;

            if (
              !premise &&
              (types.includes('premise') || types.includes('subpremise') || types.includes('building'))
            ) {
              premise = name;
            }
            if (!road && types.includes('route') && !isBroadIndoreName(name)) {
              road = name;
            }
            if (!sublocalityLevel2 && types.includes('sublocality_level_2') && !isBroadIndoreName(name)) {
              sublocalityLevel2 = name;
            }
            if (!sublocalityLevel3 && types.includes('sublocality_level_3') && !isBroadIndoreName(name)) {
              sublocalityLevel3 = name;
            }
            if (!neighborhood && types.includes('neighborhood') && !isBroadIndoreName(name)) {
              neighborhood = name;
            }
            if (!sublocalityLevel1 && types.includes('sublocality_level_1') && !isBroadIndoreName(name)) {
              sublocalityLevel1 = name;
            }
            if (
              !sublocalityGeneral &&
              types.includes('sublocality') &&
              !types.includes('sublocality_level_2') &&
              !types.includes('sublocality_level_3') &&
              !isBroadIndoreName(name)
            ) {
              sublocalityGeneral = name;
            }
            if (!locality && types.includes('locality')) {
              locality = name;
            }
            if (!postalCode && types.includes('postal_code')) {
              postalCode = name;
            }
          }
        }

        // Strict Hierarchy Extraction:
        // MICRO: sublocality_level_2, sublocality_level_3, neighborhood, or named premise
        const namedPremise = premise && !isPureHouseNumber(premise) && !isBroadIndoreName(premise) ? premise : '';
        const rawMicro = (sublocalityLevel2 || sublocalityLevel3 || neighborhood || namedPremise || '').trim();
        // MACRO: sublocality_level_1 or sublocality
        const rawMacro = (sublocalityLevel1 || sublocalityGeneral || '').trim();

        const micro = rawMicro ? resolveIndoreTownshipAlias(rawMicro) || rawMicro : '';

        let macro = '';
        if (rawMacro) {
          const lowerMacro = rawMacro.toLowerCase();
          // Do not let "Kelod Hala" alias to "Singapore Township" when a distinct micro-colony (e.g. Manoj Nayar Nagar) is present
          if (micro && lowerMacro.includes('kelod')) {
            macro = '';
          } else {
            macro = resolveIndoreTownshipAlias(rawMacro) || rawMacro;
          }
        }

        // INVERT PRECEDENCE (NEVER LET LEVEL-1 ECLIPSE LEVEL-2):
        const colony = micro
          ? macro && !micro.toLowerCase().includes(macro.toLowerCase())
            ? `${micro}, ${macro}`
            : micro
          : macro || road;

        const city = locality || 'Indore';

        let area = colony;
        if (area && !area.toLowerCase().includes(city.toLowerCase())) {
          area = `${area}, ${city}`;
        } else if (!area) {
          area = road ? `${road}, ${city}` : results[0]?.formatted_address || city;
        }

        const tokens = [premise, road, colony, city, postalCode].filter(Boolean);
        const seen = new Set<string>();
        const cleanTokens: string[] = [];
        for (const t of tokens) {
          const lower = t.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            cleanTokens.push(t);
          }
        }

        resolve({
          lat,
          lng,
          fullAddress: cleanTokens.join(', ') || results[0]?.formatted_address || area,
          area: area || colony || city,
          premise,
          road,
          colony: colony || macro || road,
          sublocality: colony || macro || road,
          city,
          postcode: postalCode,
          source: 'google',
        });
      });
    } catch (err) {
      console.warn('[Google Geocoder Notice]: Geocoder error:', err);
      resolve(null);
    }
  });
}

/**
 * Clean reverse geocoder.
 * 1. Prioritizes Google Maps native Geocoder if available on client.
 * 2. Falls back to OpenStreetMap Nominatim with hyper-local hierarchy.
 * 3. Strictly preserves raw coordinates.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
    try {
      const googleResult = await reverseGeocodeWithGoogle(lat, lng);
      if (googleResult && googleResult.fullAddress.trim().length > 0) {
        return googleResult;
      }
    } catch (gErr) {
      console.warn('[Reverse Geocode Notice]: Google Geocoder fallback to OSM:', gErr);
    }
  }

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
      const parsed = parseNominatimPayload(data, lat, lng);
      if (parsed && parsed.fullAddress.trim().length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Reverse Geocode Notice]: Nominatim lookup fallback:', err);
  }

  const coordsFormatted = `Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  return {
    lat,
    lng,
    fullAddress: coordsFormatted,
    area: coordsFormatted,
    colony: '',
    city: 'Indore',
    source: 'coordinates',
  };
}
