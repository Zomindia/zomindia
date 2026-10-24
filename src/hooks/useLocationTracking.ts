import { useEffect, useRef, useState } from 'react';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking } from '../types';
import { Telemetry } from '../services/telemetry';

const ACTIVE_BOOKING_STATUSES = ['assigned', 'accepted', 'on_the_way', 'in_progress'];

function isLegacyRajwadaCoord(lat: number, lng: number): boolean {
  return Math.abs(lat - 22.7196) < 0.001 && Math.abs(lng - 75.8577) < 0.001;
}

export function useLocationTracking(
  partnerProfileId: string | undefined,
  bookings: Booking[],
  availabilityStatus?: string
) {
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const BACKGROUND_INTERVAL = 60000; // 60 seconds when available in background

  const activeBookings = bookings.filter((b) => ACTIVE_BOOKING_STATUSES.includes(b.status));
  const hasActiveJob = activeBookings.length > 0;
  const isAvailable = availabilityStatus === 'Available';
  const isTrackingSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'geolocation' in navigator;
  const isTrackingActive =
    !!partnerProfileId && (hasActiveJob || isAvailable) && isTrackingSupported;

  useEffect(() => {
    let isCancelled = false;
    let watchId: number | undefined;

    if (!partnerProfileId || (!hasActiveJob && !isAvailable) || !isTrackingSupported) {
      return;
    }

    if (typeof window !== 'undefined' && (window as any).__ZOMINDIA_ONBOARDING_MODAL_VISIBLE) {
      return;
    }

    const startSafeTracking = async () => {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const perm = await navigator.permissions.query({
            name: 'geolocation' as PermissionName,
          });
          if (perm.state === 'denied') {
            Telemetry.addBreadcrumb(
              'native',
              'Location tracking permission is denied; maintaining current state without dummy overwrite'
            );
            return;
          }
        } catch (permErr) {
          Telemetry.addBreadcrumb('native', 'Permissions query failed');
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
              const currentActiveBookings = bookings.filter((b) =>
                ACTIVE_BOOKING_STATUSES.includes(b.status)
              );
              const isOngoingTrip = currentActiveBookings.length > 0;
              const hasOnTheWayBooking = currentActiveBookings.some(
                (b) => b.status === 'on_the_way'
              );
              const interval = hasOnTheWayBooking
                ? 3000
                : isOngoingTrip
                ? 7000
                : BACKGROUND_INTERVAL;

              if (now - lastUpdateRef.current < interval) {
                return;
              }

              const latitude = position?.coords?.latitude;
              const longitude = position?.coords?.longitude;
              const heading = position?.coords?.heading;

              if (
                typeof latitude !== 'number' ||
                isNaN(latitude) ||
                typeof longitude !== 'number' ||
                isNaN(longitude) ||
                (latitude === 0 && longitude === 0) ||
                isLegacyRajwadaCoord(latitude, longitude)
              ) {
                Telemetry.addBreadcrumb('native', 'Skipped invalid or dummy GPS coordinates');
                return;
              }

              const headingVal =
                typeof heading === 'number' && !isNaN(heading) ? Number(heading) : null;

              try {
                await updateDoc(doc(db, 'partners', partnerProfileId), {
                  lat: latitude,
                  lng: longitude,
                  heading: headingVal,
                  updatedAt: Timestamp.now(),
                }).catch(() => {});

                await updateDoc(doc(db, 'users', partnerProfileId), {
                  'location.lat': latitude,
                  'location.lng': longitude,
                  'location.updatedAt': Timestamp.now(),
                  updatedAt: Timestamp.now(),
                }).catch(() => {});

                for (const activeB of currentActiveBookings) {
                  await updateDoc(doc(db, 'bookings', activeB.id), {
                    partnerLocation: {
                      lat: latitude,
                      lng: longitude,
                      heading: headingVal,
                      updatedAt: Timestamp.now(),
                    },
                    heading: headingVal,
                    updatedAt: Timestamp.now(),
                  }).catch(() => {});
                }

                lastUpdateRef.current = now;
                setLastSyncedAt(new Date(now));
              } catch (err) {
                Telemetry.addBreadcrumb('native', 'Error syncing GPS coordinates to Firestore');
              }
            },
            (error) => {
              Telemetry.addBreadcrumb(
                'native',
                `watchPosition error (HighAccuracy: ${enableHigh})`,
                {
                  code: error?.code,
                  error: error?.message,
                }
              );

              if (enableHigh && !isRevertedToLowAccuracy) {
                isRevertedToLowAccuracy = true;
                if (watchId !== undefined) {
                  try {
                    navigator.geolocation.clearWatch(watchId);
                  } catch {}
                }
                watchId = startWatching(false);
              }
            },
            {
              enableHighAccuracy: enableHigh,
              maximumAge: enableHigh ? 0 : 30000,
              timeout: 10000,
            }
          );
        } catch (bridgeErr) {
          Telemetry.addBreadcrumb(
            'native',
            'Exception invoking native watchPosition bridge; maintaining existing location state'
          );
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
  }, [
    partnerProfileId,
    bookings,
    availabilityStatus,
    hasActiveJob,
    isAvailable,
    isTrackingSupported,
  ]);

  return { lastSyncedAt, isTrackingActive };
}

export default useLocationTracking;
