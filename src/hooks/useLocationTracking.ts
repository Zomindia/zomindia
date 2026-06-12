import { useEffect, useRef, useState } from 'react';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking } from '../types';

export function useLocationTracking(partnerProfileId: string | undefined, bookings: Booking[], availabilityStatus?: string) {
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const UPDATE_INTERVAL = 30000; // 30 seconds
  const BACKGROUND_INTERVAL = 120000; // 2 minutes for background tracking

  const hasActiveJob = bookings.some(b => ['on_the_way', 'in_progress'].includes(b.status));
  const isAvailable = availabilityStatus === 'Available';
  const isTrackingSupported = typeof window !== 'undefined' && 'geolocation' in navigator;
  const isTrackingActive = !!partnerProfileId && (hasActiveJob || isAvailable) && isTrackingSupported;

  useEffect(() => {
    if (!partnerProfileId || (!hasActiveJob && !isAvailable) || !navigator.geolocation) {
      return;
    }

    console.log("Starting location tracking for partner:", partnerProfileId, "Active Job:", hasActiveJob, "Available:", isAvailable);
    
    let watchId: number;
    let isRevertedToLowAccuracy = false;

    const startWatching = (enableHigh: boolean) => {
      return navigator.geolocation.watchPosition(
        async (position) => {
          const now = Date.now();
          const interval = hasActiveJob ? UPDATE_INTERVAL : BACKGROUND_INTERVAL;

          if (now - lastUpdateRef.current < interval) {
            return;
          }

          const { latitude, longitude } = position.coords;
          try {
            await updateDoc(doc(db, 'partners', partnerProfileId), {
              lat: latitude,
              lng: longitude,
              updatedAt: Timestamp.now()
            });
            lastUpdateRef.current = now;
            setLastSyncedAt(new Date(now));
          } catch (err) {
            console.error("Failed to update location:", err);
          }
        },
        (error) => {
          console.warn(`Location tracking watchPosition error code: ${error.code} (HighAccuracy: ${enableHigh})`, error.message);
          
          if (enableHigh && !isRevertedToLowAccuracy) {
            console.warn("High accuracy watchPosition failed or timed out. Reverting to standard accuracy watchPosition...");
            isRevertedToLowAccuracy = true;
            if (watchId) navigator.geolocation.clearWatch(watchId);
            watchId = startWatching(false);
          } else {
            switch(error.code) {
              case error.PERMISSION_DENIED:
                console.error("User denied the request for Geolocation.");
                break;
              case error.POSITION_UNAVAILABLE:
                console.error("Location information is unavailable.");
                break;
              case error.TIMEOUT:
                console.error("The request to get user location timed out.");
                break;
              default:
                console.error("An unknown error occurred.");
                break;
            }
          }
        },
        {
          enableHighAccuracy: enableHigh,
          maximumAge: enableHigh ? 0 : 30000,
          timeout: 10000
        }
      );
    };

    // Begin with Dual approach permissions check
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((status) => {
        if (status.state === 'denied') {
          console.error("Location tracking disabled because geolocation permission is denied by user.");
          return;
        }
        watchId = startWatching(true);
      }).catch(() => {
        // Fallback directly
        watchId = startWatching(true);
      });
    } else {
      watchId = startWatching(true);
    }

    return () => {
      console.log("Stopping location tracking");
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [partnerProfileId, bookings, availabilityStatus]);

  return { lastSyncedAt, isTrackingActive };
}
