/**
 * Unified Payment Service
 * Single source of truth for payment settlements, state transitions, and real-time sync
 * strictly bound to the centralized Firestore db instance.
 */
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PaymentRecord {
  bookingId: string;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  customerUid: string;
  status: 'paid' | 'pay_after_service' | 'failed' | 'refunded';
}

/**
 * Marks booking as paid and records transaction details.
 */
export async function markBookingPaid(
  bookingId: string,
  amount: number,
  transactionId: string,
  paymentMethod: string = 'online'
): Promise<void> {
  const bRef = doc(db, 'bookings', bookingId);
  await updateDoc(bRef, {
    paymentStatus: 'paid',
    paidAmount: amount,
    transactionId,
    paymentMethod,
    updatedAt: Timestamp.now()
  });
}

/**
 * Sets payment method to Pay After Service (COD).
 */
export async function setBookingPayAfterService(
  bookingId: string
): Promise<void> {
  const bRef = doc(db, 'bookings', bookingId);
  await updateDoc(bRef, {
    paymentMethod: 'cash',
    paymentStatus: 'pay_after_service',
    updatedAt: Timestamp.now()
  });
}

/**
 * Logs a payment receipt in the centralized receipts ledger.
 */
export async function recordPaymentTransaction(record: PaymentRecord): Promise<string> {
  const receiptsCol = collection(db, 'payment_receipts');
  const docRef = await addDoc(receiptsCol, {
    ...record,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}
