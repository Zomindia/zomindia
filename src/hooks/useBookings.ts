/**
 * useBookings Hook
 * Unified real-time bookings subscriber for customer & partner roles
 * strictly bound to the centralized Firestore db instance.
 */
import { useState, useEffect } from 'react';
import { Booking } from '../types';
import { subscribeCustomerBookings, subscribePartnerBookings } from '../services/bookingService';

export function useBookings(userId: string | undefined, role: 'customer' | 'partner' = 'customer') {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = role === 'partner'
      ? subscribePartnerBookings(
          userId,
          (list) => {
            setBookings(list);
            setLoading(false);
          },
          (err) => {
            setError(err);
            setLoading(false);
          }
        )
      : subscribeCustomerBookings(
          userId,
          (list) => {
            setBookings(list);
            setLoading(false);
          },
          (err) => {
            setError(err);
            setLoading(false);
          }
        );

    return () => {
      unsubscribe();
    };
  }, [userId, role]);

  return { bookings, loading, error };
}

export default useBookings;
