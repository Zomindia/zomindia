import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestore-errors';

export type NotificationType = 'booking_confirmed' | 'job_started' | 'job_completed' | 'on_the_way' | 'payment_received' | 'new_booking' | 'booking_cancelled' | 'booking_pending' | 'partner_rejected' | 'promotional';

interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  bookingId?: string;
  read: boolean;
  createdAt: any;
}

export const sendNotification = async (userId: string, title: string, message: string, type: NotificationType, bookingId?: string) => {
  try {
    // Check preferences if it's not an admin notification (assuming admin email is hardcoded or identifiable)
    // For simplicity, we check preferences for all users if they exist
    let prefs = null;
    try {
      const userRef = doc(db, 'users', userId);
      // Use getDoc with a short logic or just let it try
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        prefs = userSnap.data().notificationPreferences;
      }
    } catch (e) {
      console.warn("Failed to fetch notification preferences, defaulting to enabled:", e);
    }
    
    if (prefs) {
      const isBookingUpdate = [
        'booking_confirmed', 
        'job_started', 
        'job_completed', 
        'on_the_way', 
        'payment_received', 
        'new_booking', 
        'booking_cancelled', 
        'booking_pending', 
        'partner_rejected'
      ].includes(type);

      if (isBookingUpdate && prefs.bookingUpdates === false) {
        return;
      }

      if (type === 'promotional' && prefs.promotionalMessages === false) {
        return;
      }
    }

    const payload: NotificationPayload = {
      userId,
      title,
      message,
      type,
      bookingId: bookingId || null,
      read: false,
      createdAt: Timestamp.now()
    };
    await addDoc(collection(db, 'notifications'), payload);
    console.log(`Notification sent to ${userId}: ${title}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'notifications');
  }
};

// Helper for common transitions
export const notifyBookingUpdate = async (booking: any, newStatus: string, actorId: string) => {
  const customerId = booking.customerId;
  const partnerId = booking.partnerId;
  const adminId = 'sarthakwebtech@gmail.com'; // Hardcoded admin for demo
  const bookingIdShort = booking.id.slice(0, 8);

  switch (newStatus) {
    case 'confirmed':
      await sendNotification(customerId, 'Booking Confirmed!', `Your booking #${bookingIdShort} has been confirmed.`, 'booking_confirmed', booking.id);
      if (partnerId) {
        await sendNotification(partnerId, 'New Task Assigned!', `You have been assigned to booking #${bookingIdShort}.`, 'booking_confirmed', booking.id);
      }
      await sendNotification(adminId, 'Booking Confirmed', `Booking #${bookingIdShort} confirmed manually or partner assigned.`, 'booking_confirmed', booking.id);
      break;

    case 'on_the_way':
      await sendNotification(customerId, 'Partner On The Way!', 'Our service partner is heading to your location now.', 'on_the_way', booking.id);
      await sendNotification(adminId, 'Partner Moving', `Partner started journey for booking #${bookingIdShort}.`, 'on_the_way', booking.id);
      break;

    case 'arrived':
      await sendNotification(customerId, 'Partner Arrived!', 'Your service partner has reached the location. Please provide the OTP to start.', 'on_the_way', booking.id);
      await sendNotification(adminId, 'Partner Arrived', `Partner reached for booking #${bookingIdShort}.`, 'on_the_way', booking.id);
      break;

    case 'in_progress':
      await sendNotification(customerId, 'Service Started!', 'Your service is now in progress. Partner has reached.', 'job_started', booking.id);
      if (partnerId) {
        await sendNotification(partnerId, 'Job Started', `You have started working on booking #${bookingIdShort}.`, 'job_started', booking.id);
      }
      await sendNotification(adminId, 'Job In Progress', `Work started on booking #${bookingIdShort}.`, 'job_started', booking.id);
      break;

    case 'completed':
      await sendNotification(customerId, 'Service Completed!', 'Your service is finished. Please verify and pay.', 'job_completed', booking.id);
      if (partnerId) {
        await sendNotification(partnerId, 'Job Delivered!', `You marked booking #${bookingIdShort} as completed.`, 'job_completed', booking.id);
      }
      await sendNotification(adminId, 'Job Completed', `Booking #${bookingIdShort} marked as completed by partner.`, 'job_completed', booking.id);
      break;

    case 'finalized':
      await sendNotification(customerId, 'Booking Finalized', 'Payment received. Thank you for choosing zomindia!', 'payment_received', booking.id);
      if (partnerId) {
        await sendNotification(partnerId, 'Payment Confirmed', `Payment for booking #${bookingIdShort} is finalized.`, 'payment_received', booking.id);
      }
      await sendNotification(adminId, 'Booking Finalized', `Booking #${bookingIdShort} payment confirmed and closed.`, 'payment_received', booking.id);
      break;

    case 'cancelled':
      await sendNotification(customerId, 'Booking Cancelled', `Your booking #${bookingIdShort} has been cancelled.`, 'booking_cancelled', booking.id);
      if (partnerId) {
        await sendNotification(partnerId, 'Booking Cancelled', `Job #${bookingIdShort} has been cancelled.`, 'booking_cancelled', booking.id);
      }
      await sendNotification(adminId, 'Booking Cancelled', `Booking #${bookingIdShort} was cancelled by ${actorId === adminId ? 'Admin' : 'User'}.`, 'booking_cancelled', booking.id);
      break;

    case 'pending':
      const reasonSuffix = booking.pendingReason ? `: ${booking.pendingReason}` : '';
      await sendNotification(customerId, 'Booking on Hold', `Your booking #${bookingIdShort} is currently pending${reasonSuffix}.`, 'booking_pending' as any, booking.id);
      if (partnerId) {
        await sendNotification(partnerId, 'Task marked Pending', `You set booking #${bookingIdShort} to pending${reasonSuffix}.`, 'booking_pending' as any, booking.id);
      } else {
        // This case means a partner rejected and it went back to pending
        await sendNotification(adminId, 'Job Unassigned', `Partner ${actorId} rejected and unassigned booking #${bookingIdShort}.`, 'partner_rejected' as any, booking.id);
      }
      break;
  }
};
