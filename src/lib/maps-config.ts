/**
 * Google Maps Platform Configuration
 *
 * Provides valid API Key and Map ID required for Maps JavaScript API,
 * Advanced Markers, Cloud-based map styling, and Vector maps.
 */

export const GOOGLE_MAPS_API_KEY: string =
  ((typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY) as string) ||
  ((typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY) as string) ||
  (typeof process !== "undefined" && process.env?.VITE_GOOGLE_MAPS_API_KEY) ||
  (typeof process !== "undefined" && process.env?.GOOGLE_MAPS_PLATFORM_KEY) ||
  (typeof process !== "undefined" && process.env?.GOOGLE_MAPS_API_KEY) ||
  "AIzaSyClYzA_PZRpvQo4jYwVwF56ZVcf0BbgJBc";

export const GOOGLE_MAPS_MAP_ID: string =
  (typeof process !== "undefined" && process.env?.GOOGLE_MAPS_MAP_ID) ||
  (typeof process !== "undefined" && process.env?.VITE_GOOGLE_MAPS_MAP_ID) ||
  ((typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GOOGLE_MAPS_MAP_ID) as string) ||
  "4504f8b37365c3d0";

