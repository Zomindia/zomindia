import { useState, useEffect, useCallback } from 'react';
import { Telemetry } from '../services/telemetry';

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
      return 'prompt'; // Fallback
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
        const newState = mapState(result.state);
        setPermissionState(newState);
        Telemetry.addBreadcrumb('native', `Geolocation permission changed to ${newState}`);
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

  // High Accuracy Request with Fallback to Standard Accuracy and Indore default fallback
  const getCurrentLocation = useCallback(
    async (customOptions?: { enableHighAccuracy?: boolean; timeout?: number }) => {
      setIsFetching(true);
      setError(null);
      Telemetry.addBreadcrumb('native', 'getCurrentLocation requested', {
        enableHighAccuracy: customOptions?.enableHighAccuracy ?? true,
      });

      // Verify permissions before invoking native GPS bridges
      let currentPerm: PermissionStateValue = 'prompt';
      try {
        currentPerm = await queryPermission();
      } catch (e) {
        console.warn("[Geolocation Native Bypass]: Permission query error:", e);
      }

      if (currentPerm === 'denied') {
        setIsFetching(false);
        setShowBlockedModal(true);
        const errMsg = "Location permission is blocked. Using default Indore coordinates.";
        setError(errMsg);
        console.warn(`[Geolocation Native Bypass]: ${errMsg}`);
        Telemetry.addBreadcrumb('native', 'Location permission denied, using Indore fallback');
        return DEFAULT_INDORE_COORDS;
      }

      if (typeof window === 'undefined' || !navigator.geolocation) {
        setIsFetching(false);
        const errMsg = "Geolocation is not supported by your browser or WebView.";
        setError(errMsg);
        console.warn(`[Geolocation Native Bypass]: ${errMsg}`);
        Telemetry.addBreadcrumb('native', 'Geolocation not supported, using Indore fallback');
        return DEFAULT_INDORE_COORDS;
      }

      return new Promise<{ lat: number; lng: number }>((resolve) => {
        const highAccuracyOptions: PositionOptions = {
          enableHighAccuracy: customOptions?.enableHighAccuracy ?? true,
          timeout: customOptions?.timeout ?? 10000,
          maximumAge: 0,
        };

        const successCallback = (position: GeolocationPosition) => {
          setPermissionState('granted');
          setIsFetching(false);
          const lat = position?.coords?.latitude;
          const lng = position?.coords?.longitude;
          if (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
            Telemetry.addBreadcrumb('native', 'Geolocation resolved successfully', {
              lat: Number(lat.toFixed(4)),
              lng: Number(lng.toFixed(4)),
            });
            resolve({ lat, lng });
          } else {
            Telemetry.addBreadcrumb('native', 'Geolocation returned NaN coordinates, using Indore fallback');
            resolve(DEFAULT_INDORE_COORDS);
          }
        };

        const fallbackAndErrorCallback = (err: GeolocationPositionError) => {
          console.warn(`[Geolocation Native Bypass] High accuracy failed (code ${err?.code}): ${err?.message}. Trying fallback...`);
          Telemetry.addBreadcrumb('native', `Geolocation high accuracy failed (code ${err?.code}), attempting fallback`);
          
          if (err && err.code === err.PERMISSION_DENIED) {
            setPermissionState('denied');
            setShowBlockedModal(true);
            setIsFetching(false);
            const errMsg = "Location permission was denied. Falling back to Indore coordinates.";
            setError(errMsg);
            console.warn(`[Geolocation Native Bypass]: ${errMsg}`);
            Telemetry.addBreadcrumb('native', 'Geolocation permission denied by user');
            resolve(DEFAULT_INDORE_COORDS);
            return;
          }

          // Fallback to low accuracy
          const lowAccuracyOptions: PositionOptions = {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000,
          };

          try {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setPermissionState('granted');
                setIsFetching(false);
                const lat = pos?.coords?.latitude;
                const lng = pos?.coords?.longitude;
                if (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
                  Telemetry.addBreadcrumb('native', 'Geolocation low accuracy fallback succeeded');
                  resolve({ lat, lng });
                } else {
                  Telemetry.addBreadcrumb('native', 'Geolocation low accuracy returned NaN, using Indore');
                  resolve(DEFAULT_INDORE_COORDS);
                }
              },
              (fallbackErr) => {
                setIsFetching(false);
                console.warn("[Geolocation Native Bypass]: Both high & standard accuracy failed. Falling back to Indore:", fallbackErr);
                setError("Location request timed out. Using default Indore coordinates.");
                Telemetry.addBreadcrumb('native', 'Geolocation both accuracy attempts timed out, defaulting to Indore');
                resolve(DEFAULT_INDORE_COORDS);
              },
              lowAccuracyOptions
            );
          } catch (err: any) {
            setIsFetching(false);
            console.warn("[Geolocation Native Bypass]: Location fallback bridge exception caught:", err);
            Telemetry.addBreadcrumb('native', 'Geolocation bridge exception caught, defaulting to Indore');
            resolve(DEFAULT_INDORE_COORDS);
          }
        };

        try {
          navigator.geolocation.getCurrentPosition(successCallback, fallbackAndErrorCallback, highAccuracyOptions);
        } catch (err: any) {
          console.warn("[Geolocation Native Bypass]: Error invoking native GPS bridge:", err);
          Telemetry.addBreadcrumb('native', 'Native GPS bridge threw exception', { error: String(err?.message || err) });
          fallbackAndErrorCallback(err as any);
        }
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

export default useGeolocation;
