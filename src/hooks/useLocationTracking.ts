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
    
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        const interval = hasActiveJob ? UPDATE_INTERVAL : BACKGROUND_INTERVAL;

        // Only update if it's been more than interval since last update
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
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000
      }
    );

    return () => {
      console.log("Stopping location tracking");
      navigator.geolocation.clearWatch(watchId);
    };
  }, [partnerProfileId, bookings, availabilityStatus]);

  return { lastSyncedAt, isTrackingActive };
}
