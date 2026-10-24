import { useState, useEffect, useCallback } from 'react';

export type PermissionStateValue = 'prompt' | 'granted' | 'denied' | 'unsupported';

export const DEFAULT_INDORE_COORDS = { lat: 22.7196, lng: 75.8577 };

export function useGeolocation() {
  const [permissionState, setPermissionState] = useState<PermissionStateValue>('prompt');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showBlockedModal, setShowBlockedModal] = useState<boolean>(false);

  // Sync / query the current geolocation permission status
  const queryPermission = useCallback(async (): Promise<PermissionStateValue> => {
    if (typeof window === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
      return 'prompt';
    }
    
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      const mapState = (state: string): PermissionStateValue => {
        if (state === 'granted') return 'granted';
        if (state === 'denied') return 'denied';
        return 'prompt';
      };

      setPermissionState(mapState(result.state));
      result.onchange = () => {
        setPermissionState(mapState(result.state));
      };
      return mapState(result.state);
    } catch {
      return 'prompt';
    }
  }, []);

  useEffect(() => {
    queryPermission();
  }, [queryPermission]);

  // Clean, lean getCurrentLocation returning real GPS coordinates
  const getCurrentLocation = useCallback(
    async (options?: { enableHighAccuracy?: boolean; timeout?: number }) => {
      setIsFetching(true);
      setError(null);

      if (typeof window === 'undefined' || !navigator.geolocation) {
        setIsFetching(false);
        const errMsg = "Geolocation is not supported by your device.";
        setError(errMsg);
        return DEFAULT_INDORE_COORDS;
      }

      return new Promise<{ lat: number; lng: number }>((resolve) => {
        const geoOptions: PositionOptions = {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
          maximumAge: 0,
        };

        navigator.geolocation.getCurrentPosition(
          (position) => {
            setPermissionState('granted');
            setIsFetching(false);
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            if (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
              resolve({ lat, lng });
            } else {
              resolve(DEFAULT_INDORE_COORDS);
            }
          },
          (err) => {
            setIsFetching(false);
            if (err.code === err.PERMISSION_DENIED) {
              setPermissionState('denied');
              setShowBlockedModal(true);
              setError("Location permission denied. Please allow location access.");
            } else {
              setError("Unable to retrieve GPS position.");
            }
            resolve(DEFAULT_INDORE_COORDS);
          },
          geoOptions
        );
      });
    },
    []
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

export default useGeolocation;
