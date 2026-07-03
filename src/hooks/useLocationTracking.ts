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
          const activeOnTheWay = bookings.filter(b => b.status === 'on_the_way');
          const isOnTheWay = activeOnTheWay.length > 0;
          const interval = isOnTheWay ? 10000 : (hasActiveJob ? UPDATE_INTERVAL : BACKGROUND_INTERVAL);

          if (now - lastUpdateRef.current < interval) {
            return;
          }

          const { latitude, longitude } = position.coords;
          console.log(`Transmitted coordinates: lat=${latitude}, lng=${longitude}`);
          try {
            await updateDoc(doc(db, 'partners', partnerProfileId), {
              lat: latitude,
              lng: longitude,
              updatedAt: Timestamp.now()
            });

            // Securely write coordinates to the active booking document
            for (const activeB of activeOnTheWay) {
              await updateDoc(doc(db, 'bookings', activeB.id), {
                partnerLocation: { lat: latitude, lng: longitude },
                lat: latitude,
                lng: longitude,
                updatedAt: Timestamp.now()
              });
              console.log(`[Geo Sync] Synced location to active on-the-way booking ${activeB.id}`);
            }

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
          }
        },
        {
          enableHighAccuracy: enableHigh,
          maximumAge: enableHigh ? 0 : 30000,
          timeout: 10000
        }
      );
    };

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((status) => {
        if (status.state === 'denied') {
          console.error("Location tracking disabled because geolocation permission is denied by user.");
          return;
        }
        watchId = startWatching(true);
      }).catch(() => {
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
  }, [partnerProfileId, bookings, availabilityStatus, hasActiveJob, isAvailable]);

  return { lastSyncedAt, isTrackingActive };
}
