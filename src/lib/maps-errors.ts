
/**
 * Utility to handle and format Google Maps and Geolocation errors
 */

export function getMapsErrorMessage(error: any): string {
  const errorMessage = typeof error === 'string' ? error : error?.message || '';
  const status = error?.status || '';

  // API Authorization Errors
  if (errorMessage.includes('not authorized') || status === 'REQUEST_DENIED' || errorMessage.includes('API key')) {
    return "Google Maps API error: This API key is not authorized for Geocoding/Places. Please enable 'Geocoding API' and 'Places API' in Google Cloud Console.";
  }

  // Geolocation Browser Errors
  if (error?.code === 1 || errorMessage.toLowerCase().includes('denied') || errorMessage.includes('Geolocation')) {
    return "Location permission denied. We'll use a default center, or you can search for your location manually.";
  }
  
  if (error?.code === 2 || errorMessage.toLowerCase().includes('unavailable')) {
    return "Location information is unavailable. Please check your GPS settings.";
  }

  if (error?.code === 3 || errorMessage.toLowerCase().includes('timeout')) {
    return "Location request timed out. Please try again.";
  }

  return "Could not determine location. Please try searching or entering it manually.";
}

export function handleMapsError(error: any) {
  const message = getMapsErrorMessage(error);
  console.error("Maps/Geolocation Error:", error, message);
  return message;
}
