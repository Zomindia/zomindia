import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Query,
  DocumentData
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Booking, BookingStatus } from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

export interface UseBookingsOptions {
  userId?: string;
  customerUid?: string;
  partnerId?: string;
  status?: BookingStatus | BookingStatus[];
  orderByField?: "createdAt" | "scheduledAt" | "updatedAt";
  orderDirection?: "asc" | "desc";
}

/**
 * Centralized real-time Firestore hook for bookings.
 * Acts as the Single Source of Truth for bookings across Customer, Partner, and Admin modules.
 */
export function useBookings(options: UseBookingsOptions = {}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const {
    userId,
    customerUid,
    partnerId,
    status,
    orderByField = "createdAt",
    orderDirection = "desc"
  } = options;

  useEffect(() => {
    setLoading(true);

    let baseQuery: Query<DocumentData> = collection(db, "bookings");

    // Apply filters if provided
    const targetCustomer = customerUid || userId;
    if (targetCustomer && partnerId) {
      // In Firestore, composite multi-field ORs are restricted, so listen to all or partnerId and filter
      baseQuery = query(collection(db, "bookings"), where("partnerId", "==", partnerId));
    } else if (targetCustomer) {
      baseQuery = query(collection(db, "bookings"), where("customerUid", "==", targetCustomer));
    } else if (partnerId) {
      baseQuery = query(collection(db, "bookings"), where("partnerId", "==", partnerId));
    }

    // Try orderBy, fallback gracefully if compound index missing
    try {
      if (orderByField) {
        baseQuery = query(baseQuery, orderBy(orderByField, orderDirection));
      }
    } catch {
      // Index may not exist yet; client-side sorting applied below
    }

    const unsubscribe = onSnapshot(
      baseQuery,
      (snapshot) => {
        let items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Booking[];

        // Apply status filtering client-side if array or specific
        if (status) {
          if (Array.isArray(status)) {
            items = items.filter((b) => status.includes(b.status));
          } else {
            items = items.filter((b) => b.status === status);
          }
        }

        // Apply fallback client-side sort
        items.sort((a, b) => {
          const getVal = (item: Booking) => {
            const raw = (item as any)[orderByField] || item.createdAt;
            if (raw?.toDate) return raw.toDate().getTime();
            if (raw instanceof Date) return raw.getTime();
            if (raw?.seconds) return raw.seconds * 1000;
            return typeof raw === "string" ? new Date(raw).getTime() : 0;
          };
          const valA = getVal(a);
          const valB = getVal(b);
          return orderDirection === "asc" ? valA - valB : valB - valA;
        });

        setBookings(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useBookings Firestore snapshot error:", err);
        handleFirestoreError(err, OperationType.LIST, "bookings");
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, customerUid, partnerId, status, orderByField, orderDirection]);

  return { bookings, loading, error, setBookings };
}
