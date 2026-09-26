export const INDORE_TOP_PRIME_AREAS: readonly string[] = [
  'Vijay Nagar',
  'New Palasia',
  'Nipania',
  'Saket',
  'Mahalaxmi Nagar',
  'Bicholi Mardana',
  'Scheme 54',
  'Scheme 74',
  'Shalimar Township',
  'Manoramaganj',
  'Geeta Bhawan',
  'Annapurna',
  'Bhawarkua',
  'Silicon City',
];

/**
 * Extracts a recognizable customer locality in Indore from profile or saved addresses.
 */
export function extractCustomerIndoreLocality(
  profile?: {
    address?: string;
    customerData?: { address?: string };
    savedAddresses?: any[];
  } | null
): string | null {
  const addressStrings: string[] = [];

  if (profile?.address) addressStrings.push(profile.address);
  if (profile?.customerData?.address) addressStrings.push(profile.customerData.address);

  if (Array.isArray(profile?.savedAddresses)) {
    for (const item of profile.savedAddresses) {
      if (typeof item === 'string') {
        addressStrings.push(item);
      } else if (item && typeof item === 'object') {
        if (typeof item.locality === 'string') addressStrings.push(item.locality);
        if (typeof item.area === 'string') addressStrings.push(item.area);
        if (typeof item.addressLine === 'string') addressStrings.push(item.addressLine);
        if (typeof item.address === 'string') addressStrings.push(item.address);
      }
    }
  }

  // Check pending booking in localStorage if available
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const pendingRaw = localStorage.getItem('zomindia_pending_booking');
      if (pendingRaw) {
        const parsed = JSON.parse(pendingRaw);
        if (typeof parsed?.address === 'string') {
          addressStrings.push(parsed.address);
        }
      }
    } catch {
      // ignore
    }
  }

  if (addressStrings.length === 0) return null;

  const combined = addressStrings.join(' ');

  // 1. Direct match with INDORE_TOP_PRIME_AREAS (case-insensitive)
  for (const prime of INDORE_TOP_PRIME_AREAS) {
    const escaped = prime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(combined)) {
      return prime;
    }
  }

  // 2. Extract recognizable locality segment from comma-separated address parts
  for (const addr of addressStrings) {
    if (!addr || typeof addr !== 'string') continue;
    const parts = addr.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean);
    
    // First pass: look for strong locality indicators (Nagar, Colony, Vihar, Scheme, Enclave, Township, etc.)
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (
        lower === 'indore' ||
        lower.includes('madhya pradesh') ||
        lower === 'mp' ||
        lower === 'india' ||
        /^\d{5,6}$/.test(part) ||
        /^(flat|plot|house|h\.no|block|room|shop|floor|bldg|building|tower|near|behind|opp|opposite|sector|pocket|phase)\b/i.test(part)
      ) {
        continue;
      }
      if (/\b(nagar|colony|vihar|scheme|enclave|township|puram|puri|ganj|bagh|square|kunj|estate|city)\b/i.test(part)) {
        return part;
      }
    }

    // Second pass: any valid clean address segment
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (
        lower === 'indore' ||
        lower.includes('madhya pradesh') ||
        lower === 'mp' ||
        lower === 'india' ||
        /^\d{5,6}$/.test(part) ||
        /^(flat|plot|house|h\.no|block|room|shop|floor|bldg|building|tower|near|behind|opp|opposite|sector|pocket|phase|lane|road)\b/i.test(part) ||
        part.length < 3 ||
        part.length > 28
      ) {
        continue;
      }
      return part;
    }
  }

  return null;
}

/**
 * Dynamically samples 3 to 4 distinct areas in Indore, prioritizing the customer's locality
 * alongside 2-3 randomized prime posh areas.
 */
export function getSampledIndoreHighDemandAreas(
  profile?: {
    address?: string;
    customerData?: { address?: string };
    savedAddresses?: any[];
  } | null,
  targetCount: number = 4
): string[] {
  const customerLocality = extractCustomerIndoreLocality(profile);
  const selected: string[] = [];

  if (customerLocality) {
    selected.push(customerLocality);
  }

  // Filter remaining areas from prime list to avoid duplicate
  const remaining = INDORE_TOP_PRIME_AREAS.filter(
    (area) => !selected.some((s) => s.toLowerCase() === area.toLowerCase())
  );

  // Randomize remaining areas
  const shuffled = [...remaining].sort(() => 0.5 - Math.random());

  const desiredTotal = Math.min(Math.max(targetCount, 3), 4);
  for (const area of shuffled) {
    if (selected.length >= desiredTotal) break;
    selected.push(area);
  }

  return selected;
}
