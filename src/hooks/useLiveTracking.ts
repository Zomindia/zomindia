/**
 * useLiveTracking Hook
 * Real-time GPS & status sync for active bookings
 * strictly bound to the centralized Firestore db instance.
 */
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking } from '../types';
import {
  resolveDoorstepCoords,
  isValidPartnerGps,
  calculateHaversineDistance,
} from '../components/tracking/TrackingModal';

export interface LiveTrackingState {
  partnerLocation: { lat: number; lng: number } | null;
  status: Booking['status'] | null;
  eta: string | null;
  distance: string | null;
  partnerName: string | null;
  partnerPhone: string | null;
  booking: Booking | null;
  loading: boolean;
  error: Error | null;
}

export function useLiveTracking(bookingId: string | undefined): LiveTrackingState {
  const [state, setState] = useState<LiveTrackingState>({
    partnerLocation: null,
    status: null,
    eta: null,
    distance: null,
    partnerName: null,
    partnerPhone: null,
    booking: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!bookingId) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    const bRef = doc(db, 'bookings', bookingId);
    const unsubscribe = onSnapshot(
      bRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          setState((prev) => ({ ...prev, loading: false, booking: null }));
          return;
        }

        const data = { id: docSnap.id, ...docSnap.data() } as Booking;
        const destCoords = resolveDoorstepCoords(data);
        const rawStatus = (data.status || 'pending').toLowerCase();
        const isTripActive = [
          'on_the_way',
          'in_transit',
          'pro_en_route',
          'arrived',
          'in_progress',
        ].includes(rawStatus);
        const rawCandidate = data.partnerLocation || (data as any).expertLocation || null;

        const resolvedPartnerLoc =
          isTripActive && isValidPartnerGps(rawCandidate, destCoords, data.status)
            ? { lat: Number(rawCandidate.lat), lng: Number(rawCandidate.lng) }
            : null;

        let eta: string | null = null;
        let distance: string | null = null;

        if (resolvedPartnerLoc) {
          const straightKm = calculateHaversineDistance(resolvedPartnerLoc, destCoords);
          const roadDistanceKm = Number((straightKm * 1.32).toFixed(1));
          const durationMin = Math.max(1, Math.ceil((roadDistanceKm / 22) * 60));
          eta = `~${durationMin} mins`;
          distance = `${roadDistanceKm.toFixed(1)} km`;
        }

        setState({
          partnerLocation: resolvedPartnerLoc,
          status: data.status,
          eta,
          distance,
          partnerName: data.partnerName || (data as any).assignedPartnerName || null,
          partnerPhone: (data as any).partnerPhone || null,
          booking: data,
          loading: false,
          error: null,
        });
      },
      (err) => {
        setState((prev) => ({ ...prev, loading: false, error: err }));
      }
    );

    return () => {
      unsubscribe();
    };
  }, [bookingId]);

  return state;
}

export default useLiveTracking;
