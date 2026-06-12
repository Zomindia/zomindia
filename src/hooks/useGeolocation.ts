import { useState, useEffect, useCallback } from 'react';

export type PermissionStateValue = 'prompt' | 'granted' | 'denied' | 'unsupported';

export function useGeolocation() {
  const [permissionState, setPermissionState] = useState<PermissionStateValue>('prompt');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showBlockedModal, setShowBlockedModal] = useState<boolean>(false);

  // Sync / query the current geolocation permission status
  const queryPermission = useCallback(async (): Promise<PermissionStateValue> => {
    if (typeof window === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
      return 'prompt'; // Fallback
    }
    
    try {
      // Query name: 'geolocation' is supported in all modern browsers
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      
      const mapState = (state: string): PermissionStateValue => {
        if (state === 'granted') return 'granted';
        if (state === 'denied') return 'denied';
        return 'prompt';
      };

      setPermissionState(mapState(result.state));

      // Set up change event listener on permission status changes
      result.onchange = () => {
        setPermissionState(mapState(result.state));
      };

      return mapState(result.state);
    } catch (err) {
      console.warn("navigator.permissions.query failed or is unsupported for 'geolocation':", err);
      return 'prompt';
    }
  }, []);

  useEffect(() => {
    queryPermission();
  }, [queryPermission]);

  // High Accuracy Request with Fallback to Standard Accuracy and Manual search redirection
  const getCurrentLocation = useCallback(
    async (customOptions?: { enableHighAccuracy?: boolean; timeout?: number }) => {
      setIsFetching(true);
      setError(null);

      // Check current query status first to prevent loops or blocked triggers
      const currentPerm = await queryPermission();
      if (currentPerm === 'denied') {
        setIsFetching(false);
        setShowBlockedModal(true);
        const errMsg = "Location permission is blocked. Please enable map/device location settings manually from your browser address bar.";
        setError(errMsg);
        throw new Error(errMsg);
      }

      if (typeof window === 'undefined' || !navigator.geolocation) {
        setIsFetching(false);
        const errMsg = "Geolocation is not supported by your browser.";
        setError(errMsg);
        throw new Error(errMsg);
      }

      return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        const highAccuracyOptions: PositionOptions = {
          enableHighAccuracy: customOptions?.enableHighAccuracy ?? true,
          timeout: customOptions?.timeout ?? 10000,
          maximumAge: 0, // Forces fresh, non-cached location lookup
        };

        const successCallback = (position: GeolocationPosition) => {
          setPermissionState('granted');
          setIsFetching(false);
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        };

        const fallbackAndErrorCallback = (err: GeolocationPositionError) => {
          console.warn(`Geolocation failed (code ${err.code}): ${err.message}. Trying fallback options...`);
          
          if (err.code === err.PERMISSION_DENIED) {
            setPermissionState('denied');
            setShowBlockedModal(true);
            setIsFetching(false);
            const errMsg = "Location permission was denied. Please adjust your browser settings.";
            setError(errMsg);
            reject(new Error(errMsg));
            return;
          }

          // Automatically trigger the standard fallback request
          const lowAccuracyOptions: PositionOptions = {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000, // Safe cached value fallback
          };

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              console.log("Successfully retrieved location using standard low-accuracy fallback.");
              setPermissionState('granted');
              setIsFetching(false);
              resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
            },
            (fallbackErr) => {
              setIsFetching(false);
              const errMsg = "High accuracy location timed out and fallback request failed. Redirecting to manual input is recommended.";
              setError(errMsg);
              reject(new Error(errMsg));
            },
            lowAccuracyOptions
          );
        };

        navigator.geolocation.getCurrentPosition(successCallback, fallbackAndErrorCallback, highAccuracyOptions);
      });
    },
    [queryPermission]
  );

  return {
    permissionState,
    isFetching,
    error,
    showBlockedModal,
    setShowBlockedModal,
    getCurrentLocation,
    refreshPermission: queryPermission,
  };
}
