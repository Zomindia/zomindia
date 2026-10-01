import { useEffect, useRef, useState } from 'react';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking } from '../types';

const ACTIVE_BOOKING_STATUSES = ['assigned', 'accepted', 'on_the_way', 'in_progress'];

export function useLocationTracking(partnerProfileId: string | undefined, bookings: Booking[], availabilityStatus?: string) {
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const TRIP_UPDATE_INTERVAL = 10000; // 10 seconds during ongoing trip / active job
  const BACKGROUND_INTERVAL = 60000; // 60 seconds when available in background

  const activeBookings = bookings.filter(b => ACTIVE_BOOKING_STATUSES.includes(b.status));
  const hasActiveJob = activeBookings.length > 0;
  const isAvailable = availabilityStatus === 'Available';
  const isTrackingSupported = typeof window !== 'undefined' && 'geolocation' in navigator;
  const isTrackingActive = !!partnerProfileId && (hasActiveJob || isAvailable) && isTrackingSupported;

  useEffect(() => {
    if (!partnerProfileId || (!hasActiveJob && !isAvailable) || !navigator.geolocation) {
      return;
    }

    console.log("[Geo Sync] Starting location tracking for partner:", partnerProfileId, "Active Jobs:", activeBookings.length, "Available:", isAvailable);
    
    let watchId: number;
    let isRevertedToLowAccuracy = false;

    const startWatching = (enableHigh: boolean) => {
      return navigator.geolocation.watchPosition(
        async (position) => {
          const now = Date.now();
          const currentActiveBookings = bookings.filter(b => ACTIVE_BOOKING_STATUSES.includes(b.status));
          const isOngoingTrip = currentActiveBookings.length > 0;
          const interval = isOngoingTrip ? TRIP_UPDATE_INTERVAL : BACKGROUND_INTERVAL;

          if (now - lastUpdateRef.current < interval) {
            return;
          }

          const { latitude, longitude, heading } = position.coords;
          const latNum = Number(latitude);
          const lngNum = Number(longitude);
          const headingVal = typeof heading === 'number' && !isNaN(heading) ? Number(heading) : null;
          console.log(`[Geo Sync] Transmitted coordinates: lat=${latNum}, lng=${lngNum}, heading=${headingVal}`);
          
          try {
            // 1. Update partner's global coordinates in Firestore
            await updateDoc(doc(db, 'partners', partnerProfileId), {
              lat: latNum,
              lng: lngNum,
              heading: headingVal,
              updatedAt: Timestamp.now()
            });

            // 2. Securely sync coordinates to all active bookings (assigned, accepted, on_the_way, in_progress)
            for (const activeB of currentActiveBookings) {
              await updateDoc(doc(db, 'bookings', activeB.id), {
                partnerLocation: {
                  lat: latNum,
                  lng: lngNum,
                },
                heading: headingVal,
                updatedAt: Timestamp.now()
              });
              console.log(`[Geo Sync] Synced location to active booking ${activeB.id} (${activeB.status})`);
            }

            lastUpdateRef.current = now;
            setLastSyncedAt(new Date(now));
          } catch (err) {
            console.error("[Geo Sync] Failed to update location:", err);
          }
        },
        (error) => {
          console.warn(`[Geo Sync] watchPosition error code: ${error.code} (HighAccuracy: ${enableHigh})`, error.message);
          
          if (enableHigh && !isRevertedToLowAccuracy) {
            console.warn("[Geo Sync] High accuracy watchPosition failed or timed out. Reverting to standard accuracy...");
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

    // Directly initiate watchPosition with automatic standard accuracy fallback
    watchId = startWatching(true);

    return () => {
      console.log("[Geo Sync] Stopping location tracking");
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [partnerProfileId, bookings, availabilityStatus, hasActiveJob, isAvailable]);

  return { lastSyncedAt, isTrackingActive };
}
