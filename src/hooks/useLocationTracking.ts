import { useEffect, useRef, useState } from 'react';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking } from '../types';

const ACTIVE_BOOKING_STATUSES = ['assigned', 'accepted', 'on_the_way', 'in_progress'];
export const DEFAULT_INDORE_COORDS = { lat: 22.7196, lng: 75.8577 };

export function useLocationTracking(partnerProfileId: string | undefined, bookings: Booking[], availabilityStatus?: string) {
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const TRIP_UPDATE_INTERVAL = 10000; // 10 seconds during ongoing trip / active job
  const BACKGROUND_INTERVAL = 60000; // 60 seconds when available in background

  const activeBookings = bookings.filter(b => ACTIVE_BOOKING_STATUSES.includes(b.status));
  const hasActiveJob = activeBookings.length > 0;
  const isAvailable = availabilityStatus === 'Available';
  const isTrackingSupported = typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const isTrackingActive = !!partnerProfileId && (hasActiveJob || isAvailable) && isTrackingSupported;

  useEffect(() => {
    let isCancelled = false;
    let watchId: number | undefined;

    if (!partnerProfileId || (!hasActiveJob && !isAvailable) || !isTrackingSupported) {
      return;
    }

    const startSafeTracking = async () => {
      // 1. Verify permissions before invoking native GPS bridges
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (perm.state === 'denied') {
            console.warn('[Geo Sync Native Bypass]: Geolocation permission is denied. Bypassing native GPS bridge and applying Indore fallback.');
            try {
              await updateDoc(doc(db, 'partners', partnerProfileId), {
                lat: DEFAULT_INDORE_COORDS.lat,
                lng: DEFAULT_INDORE_COORDS.lng,
                updatedAt: Timestamp.now()
              });
            } catch (err) {
              console.warn('[Geo Sync Native Bypass]: Error setting Indore fallback coords:', err);
            }
            return;
          }
        } catch (permErr) {
          console.warn('[Geo Sync Native Bypass]: Permissions query failed:', permErr);
        }
      }

      if (isCancelled) return;

      let isRevertedToLowAccuracy = false;

      const startWatching = (enableHigh: boolean): number | undefined => {
        try {
          return navigator.geolocation.watchPosition(
            async (position) => {
              if (isCancelled) return;
              const now = Date.now();
              const currentActiveBookings = bookings.filter(b => ACTIVE_BOOKING_STATUSES.includes(b.status));
              const isOngoingTrip = currentActiveBookings.length > 0;
              const interval = isOngoingTrip ? TRIP_UPDATE_INTERVAL : BACKGROUND_INTERVAL;

              if (now - lastUpdateRef.current < interval) {
                return;
              }

              const latitude = position?.coords?.latitude;
              const longitude = position?.coords?.longitude;
              const heading = position?.coords?.heading;

              const latNum = typeof latitude === 'number' && !isNaN(latitude) ? latitude : DEFAULT_INDORE_COORDS.lat;
              const lngNum = typeof longitude === 'number' && !isNaN(longitude) ? longitude : DEFAULT_INDORE_COORDS.lng;
              const headingVal = typeof heading === 'number' && !isNaN(heading) ? Number(heading) : null;

              try {
                // Update partner's coordinates in Firestore
                await updateDoc(doc(db, 'partners', partnerProfileId), {
                  lat: latNum,
                  lng: lngNum,
                  heading: headingVal,
                  updatedAt: Timestamp.now()
                });

                // Sync coordinates to all active bookings
                for (const activeB of currentActiveBookings) {
                  await updateDoc(doc(db, 'bookings', activeB.id), {
                    partnerLocation: {
                      lat: latNum,
                      lng: lngNum,
                    },
                    heading: headingVal,
                    updatedAt: Timestamp.now()
                  });
                }

                lastUpdateRef.current = now;
                setLastSyncedAt(new Date(now));
              } catch (err) {
                console.warn('[Geo Sync Native Bypass]: Error syncing coordinates to Firestore:', err);
              }
            },
            async (error) => {
              console.warn(`[Geo Sync Native Bypass] watchPosition error (HighAccuracy: ${enableHigh}):`, error?.message);

              if (enableHigh && !isRevertedToLowAccuracy) {
                isRevertedToLowAccuracy = true;
                if (watchId !== undefined) {
                  try { navigator.geolocation.clearWatch(watchId); } catch {}
                }
                watchId = startWatching(false);
              } else {
                // Fall back to Indore coordinates safely if bridge rejected or position unavailable
                try {
                  await updateDoc(doc(db, 'partners', partnerProfileId), {
                    lat: DEFAULT_INDORE_COORDS.lat,
                    lng: DEFAULT_INDORE_COORDS.lng,
                    updatedAt: Timestamp.now()
                  });
                } catch {}
              }
            },
            {
              enableHighAccuracy: enableHigh,
              maximumAge: enableHigh ? 0 : 30000,
              timeout: 10000
            }
          );
        } catch (bridgeErr) {
          console.warn('[Geo Sync Native Bypass]: Exception invoking native watchPosition bridge:', bridgeErr);
          // Set fallback Indore coordinates
          try {
            updateDoc(doc(db, 'partners', partnerProfileId), {
              lat: DEFAULT_INDORE_COORDS.lat,
              lng: DEFAULT_INDORE_COORDS.lng,
              updatedAt: Timestamp.now()
            }).catch(() => {});
          } catch {}
          return undefined;
        }
      };

      watchId = startWatching(true);
    };

    startSafeTracking();

    return () => {
      isCancelled = true;
      if (watchId !== undefined) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {}
      }
    };
  }, [partnerProfileId, bookings, availabilityStatus, hasActiveJob, isAvailable, isTrackingSupported]);

  return { lastSyncedAt, isTrackingActive };
}

export default useLocationTracking;
