/**
 * Unified Booking Service
 * Single source of truth for booking operations, status changes, and real-time subscriptions
 * strictly bound to the centralized Firestore db instance.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  Unsubscribe,
  or
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking } from '../types';

export const BOOKINGS_COLLECTION = 'bookings';

/**
 * Creates or updates a booking document in Firestore.
 */
export async function saveBooking(
  bookingId: string, 
  payload: Partial<Booking>
): Promise<void> {
  const bRef = doc(db, BOOKINGS_COLLECTION, bookingId);
  await setDoc(bRef, {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * Updates status of a booking document in real-time.
 */
export async function updateBookingStatus(
  bookingId: string, 
  status: Booking['status'], 
  extraData: Record<string, any> = {}
): Promise<void> {
  const bRef = doc(db, BOOKINGS_COLLECTION, bookingId);
  await updateDoc(bRef, {
    status,
    ...extraData,
    updatedAt: Timestamp.now()
  });
}

/**
 * Updates payment status of a booking document.
 */
export async function updateBookingPaymentStatus(
  bookingId: string,
  paymentStatus: 'pending' | 'paid' | 'pay_after_service' | 'failed' | 'refunded',
  paymentDetails: {
    transactionId?: string;
    paidAmount?: number;
    paymentMethod?: string;
  } = {}
): Promise<void> {
  const bRef = doc(db, BOOKINGS_COLLECTION, bookingId);
  await updateDoc(bRef, {
    paymentStatus,
    ...paymentDetails,
    updatedAt: Timestamp.now()
  });
}

/**
 * Real-time listener for customer bookings.
 */
export function subscribeCustomerBookings(
  customerUid: string,
  onUpdate: (bookings: Booking[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!customerUid) {
    onUpdate([]);
    return () => {};
  }

  const q = query(
    collection(db, BOOKINGS_COLLECTION),
    or(
      where('customerUid', '==', customerUid),
      where('userId', '==', customerUid),
      where('customerId', '==', customerUid)
    )
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking);
      list.sort((a, b) => {
        const timeA = (a.scheduledAt as any)?.seconds || (a.createdAt as any)?.seconds || 0;
        const timeB = (b.scheduledAt as any)?.seconds || (b.createdAt as any)?.seconds || 0;
        return timeB - timeA;
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('[bookingService] Customer bookings listener warning:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time listener for partner bookings (only assigned, non-cancelled jobs).
 */
export function subscribePartnerBookings(
  partnerId: string,
  onUpdate: (bookings: Booking[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!partnerId) {
    onUpdate([]);
    return () => {};
  }

  const q = query(
    collection(db, BOOKINGS_COLLECTION),
    where('partnerId', '==', partnerId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Booking)
        .filter((b) => b.status !== 'cancelled');
      list.sort((a, b) => {
        const timeA = (a.scheduledAt as any)?.seconds || (a.createdAt as any)?.seconds || 0;
        const timeB = (b.scheduledAt as any)?.seconds || (b.createdAt as any)?.seconds || 0;
        return timeB - timeA;
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('[bookingService] Partner bookings listener warning:', err);
      if (onError) onError(err);
    }
  );
}
