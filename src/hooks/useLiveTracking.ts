/**
 * useLiveTracking Hook
 * Real-time GPS & status sync for active bookings
 * strictly bound to the centralized Firestore db instance.
 */
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking } from '../types';

export interface LiveTrackingState {
  partnerLocation: { lat: number; lng: number } | null;
  status: Booking['status'] | null;
  eta: string | null;
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

        const data = docSnap.data() as Booking;
        const pLoc = data.partnerLocation || (data as any).expertLocation || null;

        setState({
          partnerLocation: pLoc ? { lat: Number(pLoc.lat), lng: Number(pLoc.lng) } : null,
          status: data.status,
          eta: (data as any).eta || null,
          partnerName: data.partnerName || (data as any).assignedPartnerName || null,
          partnerPhone: (data as any).partnerPhone || null,
          booking: { id: docSnap.id, ...data },
          loading: false,
          error: null,
        });
      },
      (err) => {
        console.warn('[useLiveTracking] Snapshot warning:', err);
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
