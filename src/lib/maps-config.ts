/**
 * Google Maps Platform Map ID Configuration
 *
 * Provides a valid Map ID required for Advanced Markers, Cloud-based map styling,
 * and Vector maps. Falls back to Google Maps Platform's official sample Map ID.
 */

export const GOOGLE_MAPS_MAP_ID: string =
  (typeof process !== "undefined" && process.env?.GOOGLE_MAPS_MAP_ID) ||
  (typeof process !== "undefined" && process.env?.VITE_GOOGLE_MAPS_MAP_ID) ||
  ((typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GOOGLE_MAPS_MAP_ID) as string) ||
  "4504f8b37365c3d0";
