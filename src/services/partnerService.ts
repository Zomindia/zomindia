/**
 * Unified Partner Service
 * Handles partner dispatch, GPS location updates, and job state transitions
 * strictly bound to the centralized Firestore db instance.
 */
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PartnerProfile, Booking } from '../types';

/**
 * Updates a partner's live GPS coordinates in Firestore.
 */
export async function updatePartnerLocation(
  partnerUid: string,
  latitude: number,
  longitude: number,
  heading?: number
): Promise<void> {
  const pRef = doc(db, 'users', partnerUid);
  await updateDoc(pRef, {
    'location.lat': latitude,
    'location.lng': longitude,
    'location.updatedAt': Timestamp.now(),
    updatedAt: serverTimestamp()
  });
}

/**
 * Updates the partner's location on an active booking in real-time.
 */
export async function updateBookingPartnerLocation(
  bookingId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const bRef = doc(db, 'bookings', bookingId);
  await updateDoc(bRef, {
    partnerLocation: {
      lat: latitude,
      lng: longitude,
      updatedAt: Timestamp.now()
    },
    updatedAt: Timestamp.now()
  });
}

/**
 * Fetches verified partner profile by UID.
 */
export async function getPartnerProfile(partnerUid: string): Promise<PartnerProfile | null> {
  const uRef = doc(db, 'users', partnerUid);
  const snap = await import('firebase/firestore').then(m => m.getDoc(uRef));
  if (snap.exists()) {
    return snap.data() as PartnerProfile;
  }
  return null;
}
