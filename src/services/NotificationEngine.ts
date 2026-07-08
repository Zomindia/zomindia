import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type NotificationType = 
  | 'booking_confirmed' 
  | 'job_started' 
  | 'job_completed' 
  | 'on_the_way' 
  | 'payment_received' 
  | 'new_booking' 
  | 'booking_cancelled' 
  | 'booking_pending' 
  | 'partner_rejected' 
  | 'promotional';

export interface WhatsAppAlert {
  id?: string;
  recipientPhone: string;
  recipientName: string;
  templateName: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  gateway: 'Twilio' | 'Gupshup';
  payload: any;
  messageText: string;
  timestamp: any;
}

export interface BookingNotificationData {
  bookingId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  date: string;
  time: string;
  assignedPartnerId?: string | null;
  partnerName?: string;
  partnerPhone?: string;
  eligiblePartners?: Array<{ id: string; userId?: string }>;
  basePrice?: number;
  otp?: string;
  totalPrice?: number;
  amount?: number;
  pendingReason?: string;
  actorId?: string;
}

/**
 * Sends a standard in-app notification, triggers dynamic push proxy, and hooks WhatsApp triggers.
 */
export async function sendNotification(
  userId: string, 
  title: string, 
  message: string, 
  type: NotificationType, 
  bookingId?: string
) {
  try {
    let prefs = null;
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        prefs = userSnap.data().notificationPreferences;
      }
    } catch (e) {
      console.warn("[NotificationEngine] Failed to fetch notification preferences, defaulting to enabled:", e);
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

    const payload = {
      userId,
      title,
      message,
      type,
      bookingId: bookingId || null,
      read: false,
      createdAt: Timestamp.now()
    };
    await addDoc(collection(db, 'notifications'), payload);
    console.log(`[NotificationEngine] In-app notification sent to ${userId}: ${title}`);

    // Trigger secure Firebase Cloud Messaging push via Express backend proxy
    fetch('/api/send-push-notification', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ userId, title, message })
    }).catch(err => console.error('[Push System] Background trigger failed:', err));

  } catch (err) {
    console.error(`[NotificationEngine] Suppressed non-fatal notification trigger error for user ${userId}:`, err);
  }
}

/**
 * Triggers an automated WhatsApp/SMS notifications trace with simulated Gupshup/Twilio payload formatting.
 */
export async function dispatchAutomatedWhatsAppAlert(
  phone: string,
  name: string,
  type: 'booking_received' | 'partner_assigned' | 'service_otp' | 'service_complete' | 'payment_reminder',
  params: Record<string, string>
): Promise<WhatsAppAlert | null> {
  if (!phone) return null;

  const recipientPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
  let templateName = '';
  let messageText = '';
  const isTwilio = Math.random() > 0.5; // Dynamically simulate either Twilio or Gupshup routing
  const gateway = isTwilio ? 'Twilio' : 'Gupshup';

  switch (type) {
    case 'booking_received':
      templateName = 'zom_cust_booking_confirmed';
      messageText = `Namaste ${name}, your zomindia booking is confirmed! We are matching a verified professional, standard service starts at ₹${params.price || '499'}. Tracking link: https://zomindia.com/track/${params.bookingId || 'new'}`;
      break;
    case 'partner_assigned':
      templateName = 'zom_cust_partner_assigned';
      messageText = `Good news ${name}! Service Partner ${params.partnerName || 'Pro'} is assigned to you. Contact: ${params.partnerPhone || 'N/A'}. They will arrive shortly on ${params.time || 'scheduled slot'}.`;
      break;
    case 'service_otp':
      templateName = 'zom_auth_service_start';
      messageText = `Secure Verification: Share OTP ${params.otp || '0000'} with ${params.partnerName || 'the assigned technician'} once they arrive on site to securely start your home service.`;
      break;
    case 'service_complete':
      templateName = 'zom_cust_completion_bill';
      messageText = `Thank you ${name}! Your service is successfully completed. Final Settlement of ₹${params.totalPrice || '0'} has been processed. Download invoice: https://zomindia.com/api/download-invoice?bookingId=${params.bookingId || ''}`;
      break;
    case 'payment_reminder':
      templateName = 'zom_payout_reminder';
      messageText = `Attention: Outstanding balance of ₹${params.amount || '0'} is detected for booking #${params.bookingId || ''}. Tap here to clear securely via Razorpay/Wallet: https://zomindia.com/pay/${params.bookingId || ''}`;
      break;
  }

  // Generate payload matching Twilio API / Gupshup API expected format
  const payload = isTwilio 
    ? {
        from: "whatsapp:+14155238886",
        to: `whatsapp:${recipientPhone}`,
        body: messageText,
        template: {
          name: templateName,
          language: "en_US"
        }
      }
    : {
        channel: "whatsapp",
        source: "919013151515",
        destination: recipientPhone,
        message: {
          type: "text",
          text: messageText
        },
        src_id: "Gupshup_ZomIndia_SMS"
      };

  const alertLog: WhatsAppAlert = {
    recipientPhone,
    recipientName: name,
    templateName,
    status: 'sent',
    gateway,
    payload,
    messageText,
    timestamp: new Date()
  };

  try {
    const docRef = await addDoc(collection(db, 'whatsapp_alerts'), alertLog);
    alertLog.id = docRef.id;

    setTimeout(async () => {
      try {
        console.log(`[WhatsApp Webhook Gateway] Receipt received for ${recipientPhone}: Delivered & Read`);
      } catch (err) {
        console.error('Webhook async error', err);
      }
    }, 3000);

    return alertLog;
  } catch (err) {
    console.error('[NotificationEngine] Error logging WhatsApp alert:', err);
    return null;
  }
}

/**
 * Ecosystem notification helper to broadcast status across roles
 */
export async function sendEcosystemNotification(
  role: 'customer' | 'admin' | 'partner' | 'all',
  status: string,
  data: {
    bookingId: string;
    customerId?: string;
    partnerId?: string;
    customerName: string;
    partnerName: string;
    serviceName: string;
    dateTime: string;
  }
) {
  const message = `Customer: ${data.customerName || 'N/A'} | Partner: ${data.partnerName || 'N/A'} | Service: ${data.serviceName || 'N/A'} | Time: ${data.dateTime || 'N/A'}`;
  const title = `Booking Status: ${status.replace('_', ' ').toUpperCase()}`;

  console.log(`[NotificationEngine Ecosystem] Broadcast to ${role} - Status: ${status} - Msg: ${message}`);

  const recipients: string[] = [];
  if (role === 'all' || role === 'customer') {
    if (data.customerId) recipients.push(data.customerId);
  }
  if (role === 'all' || role === 'partner') {
    if (data.partnerId) recipients.push(data.partnerId);
  }
  if (role === 'all' || role === 'admin') {
    recipients.push('sarthakwebtech@gmail.com');
  }

  for (const userId of recipients) {
    await sendNotification(userId, title, message, 'booking_confirmed', data.bookingId);
  }

  try {
    const alertLog = {
      userId: data.customerId || 'unknown',
      bookingId: data.bookingId,
      recipientPhone: data.customerId || '',
      customerName: data.customerName,
      partnerName: data.partnerName,
      serviceName: data.serviceName,
      scheduledTime: data.dateTime,
      message,
      gateway: 'Twilio' as const,
      status: 'Delivered',
      createdAt: Timestamp.now()
    };
    await addDoc(collection(db, 'whatsapp_alerts'), alertLog);
  } catch (err) {
    console.error('[NotificationEngine] Error logging ecosystem WhatsApp alert:', err);
  }
}

/**
 * Master service class for the Zomindia notification system
 */
export const NotificationEngine = {
  /**
   * Reusable central triggers
   */
  async sendBookingConfirmation(data: BookingNotificationData) {
    const bookingIdShort = data.bookingId.slice(0, 8);
    
    // 1. Notify Customer in-app
    await sendNotification(
      data.customerId,
      'Booking Placed!',
      data.assignedPartnerId 
        ? `Your request for ${data.serviceName} has been received and partner has been assigned.` 
        : `Your request for ${data.serviceName} has been received. Waiting for partner assignment.`,
      'new_booking',
      data.bookingId
    );

    // 2. Notify Partner or Admin
    if (data.assignedPartnerId) {
      await sendNotification(
        data.assignedPartnerId,
        'New Job Assigned',
        `You have been automatically matched for a ${data.serviceName} booking at ${data.date} ${data.time}.`,
        'new_booking',
        data.bookingId
      );

      // Trigger partner assigned WhatsApp
      await dispatchAutomatedWhatsAppAlert(
        data.customerPhone,
        data.customerName,
        'partner_assigned',
        {
          partnerName: data.partnerName || 'Certified Expert',
          partnerPhone: data.partnerPhone || 'N/A',
          time: `${data.date} ${data.time}`,
          bookingId: data.bookingId
        }
      );
    } else {
      await sendNotification(
        'sarthakwebtech@gmail.com',
        'New Booking Received',
        `Customer ${data.customerName} booked ${data.serviceName}. No partner could be auto-assigned.`,
        'new_booking',
        data.bookingId
      );
    }

    // 3. Notify nearby eligible partners
    if (data.eligiblePartners && data.eligiblePartners.length > 0) {
      const activeEligible = data.eligiblePartners.filter(p => p.id !== data.assignedPartnerId && p.userId !== data.assignedPartnerId);
      for (const pt of activeEligible) {
        const partnerUid = pt.userId || pt.id;
        if (partnerUid) {
          await sendNotification(
            partnerUid,
            'New Booking Request Nearby!',
            `A new request for ${data.serviceName} has been published in your area. Accept it now!`,
            'new_booking',
            data.bookingId
          );
        }
      }
    }

    // 4. Send customer booking received WhatsApp/SMS
    await dispatchAutomatedWhatsAppAlert(
      data.customerPhone,
      data.customerName,
      'booking_received',
      {
        price: data.basePrice?.toString() || '499',
        bookingId: data.bookingId
      }
    );
  },

  async sendPartnerOTP(data: BookingNotificationData) {
    if (!data.otp) return;

    // 1. In-app notification
    await sendNotification(
      data.customerId,
      'Partner Arrived!',
      'Your service partner has reached the location. Please provide the OTP to start.',
      'on_the_way',
      data.bookingId
    );

    // 2. WhatsApp OTP SMS Trigger
    await dispatchAutomatedWhatsAppAlert(
      data.customerPhone,
      data.customerName,
      'service_otp',
      {
        otp: data.otp,
        partnerName: data.partnerName || 'Technician'
      }
    );
  },

  async sendJobCompleted(data: BookingNotificationData) {
    const bookingIdShort = data.bookingId.slice(0, 8);

    // 1. In-app Customer
    await sendNotification(
      data.customerId,
      'Service Completed!',
      'Your service is finished. Please verify and pay.',
      'job_completed',
      data.bookingId
    );

    // 2. In-app Partner
    if (data.assignedPartnerId) {
      await sendNotification(
        data.assignedPartnerId,
        'Job Delivered!',
        `You marked booking #${bookingIdShort} as completed.`,
        'job_completed',
        data.bookingId
      );
    }

    // 3. In-app Admin
    await sendNotification(
      'sarthakwebtech@gmail.com',
      'Job Completed',
      `Booking #${bookingIdShort} marked as completed by partner.`,
      'job_completed',
      data.bookingId
    );

    // 4. WhatsApp completion alert
    await dispatchAutomatedWhatsAppAlert(
      data.customerPhone,
      data.customerName,
      'service_complete',
      {
        totalPrice: data.totalPrice?.toString() || '0',
        bookingId: data.bookingId
      }
    );
  },

  async sendPaymentReceived(data: BookingNotificationData) {
    const bookingIdShort = data.bookingId.slice(0, 8);

    await sendNotification(
      data.customerId,
      'Booking Finalized',
      'Payment received. Thank you for choosing zomindia!',
      'payment_received',
      data.bookingId
    );

    if (data.assignedPartnerId) {
      await sendNotification(
        data.assignedPartnerId,
        'Payment Confirmed',
        `Payment for booking #${bookingIdShort} is finalized.`,
        'payment_received',
        data.bookingId
      );
    }

    await sendNotification(
      'sarthakwebtech@gmail.com',
      'Booking Finalized',
      `Booking #${bookingIdShort} payment confirmed and closed.`,
      'payment_received',
      data.bookingId
    );
  },

  async sendBookingCancelled(data: BookingNotificationData) {
    const bookingIdShort = data.bookingId.slice(0, 8);
    const actorLabel = data.actorId === 'sarthakwebtech@gmail.com' ? 'Admin' : 'User';

    await sendNotification(
      data.customerId,
      'Booking Cancelled',
      `Your booking #${bookingIdShort} has been cancelled.`,
      'booking_cancelled',
      data.bookingId
    );

    if (data.assignedPartnerId) {
      await sendNotification(
        data.assignedPartnerId,
        'Booking Cancelled',
        `Job #${bookingIdShort} has been cancelled.`,
        'booking_cancelled',
        data.bookingId
      );
    }

    await sendNotification(
      'sarthakwebtech@gmail.com',
      'Booking Cancelled',
      `Booking #${bookingIdShort} was cancelled by ${actorLabel}.`,
      'booking_cancelled',
      data.bookingId
    );
  },

  async sendBookingPending(data: BookingNotificationData) {
    const bookingIdShort = data.bookingId.slice(0, 8);
    const reasonSuffix = data.pendingReason ? `: ${data.pendingReason}` : '';

    await sendNotification(
      data.customerId,
      'Booking on Hold',
      `Your booking #${bookingIdShort} is currently pending${reasonSuffix}.`,
      'booking_pending',
      data.bookingId
    );

    if (data.assignedPartnerId) {
      await sendNotification(
        data.assignedPartnerId,
        'Task marked Pending',
        `You set booking #${bookingIdShort} to pending${reasonSuffix}.`,
        'booking_pending',
        data.bookingId
      );
    } else if (data.actorId) {
      await sendNotification(
        'sarthakwebtech@gmail.com',
        'Job Unassigned',
        `Partner ${data.actorId} rejected and unassigned booking #${bookingIdShort}.`,
        'partner_rejected',
        data.bookingId
      );
    }
  }
};

/**
 * Helper for backwards-compatibility routing
 */
export const notifyBookingUpdate = async (booking: any, newStatus: string, actorId: string) => {
  const payload: BookingNotificationData = {
    bookingId: booking.id,
    customerId: booking.customerId,
    customerName: booking.customerBookedName || booking.customerName || 'Customer',
    customerPhone: booking.customerBookedPhone || booking.customerMobile || '',
    serviceName: booking.serviceName || 'Service',
    date: booking.date || '',
    time: booking.time || '',
    assignedPartnerId: booking.partnerId || null,
    partnerName: booking.partnerName || booking.partnerBookedName || 'Expert',
    partnerPhone: booking.partnerPhone || '',
    otp: booking.serviceOtp || '',
    totalPrice: booking.totalPrice || booking.finalPrice || booking.basePrice || 0,
    amount: booking.totalPrice || booking.finalPrice || booking.basePrice || 0,
    pendingReason: booking.pendingReason,
    actorId
  };

  switch (newStatus) {
    case 'confirmed':
      await sendNotification(
        payload.customerId, 
        'Booking Confirmed!', 
        `Your booking #${booking.id.slice(0, 8)} has been confirmed.`, 
        'booking_confirmed', 
        booking.id
      );
      if (payload.assignedPartnerId) {
        await sendNotification(
          payload.assignedPartnerId, 
          'New Task Assigned!', 
          `You have been assigned to booking #${booking.id.slice(0, 8)}.`, 
          'booking_confirmed', 
          booking.id
        );
      }
      await sendNotification(
        'sarthakwebtech@gmail.com', 
        'Booking Confirmed', 
        `Booking #${booking.id.slice(0, 8)} confirmed manually or partner assigned.`, 
        'booking_confirmed', 
        booking.id
      );
      break;

    case 'on_the_way':
      await sendNotification(
        payload.customerId, 
        'Partner On The Way!', 
        'Our service partner is heading to your location now.', 
        'on_the_way', 
        booking.id
      );
      await sendNotification(
        'sarthakwebtech@gmail.com', 
        'Partner Moving', 
        `Partner started journey for booking #${booking.id.slice(0, 8)}.`, 
        'on_the_way', 
        booking.id
      );
      break;

    case 'arrived':
      await NotificationEngine.sendPartnerOTP(payload);
      await sendNotification(
        'sarthakwebtech@gmail.com', 
        'Partner Arrived', 
        `Partner reached for booking #${booking.id.slice(0, 8)}.`, 
        'on_the_way', 
        booking.id
      );
      break;

    case 'in_progress':
      await sendNotification(
        payload.customerId, 
        'Service Started!', 
        'Your service is now in progress. Partner has reached.', 
        'job_started', 
        booking.id
      );
      if (payload.assignedPartnerId) {
        await sendNotification(
          payload.assignedPartnerId, 
          'Job Started', 
          `You have started working on booking #${booking.id.slice(0, 8)}.`, 
          'job_started', 
          booking.id
        );
      }
      await sendNotification(
        'sarthakwebtech@gmail.com', 
        'Job In Progress', 
        `Work started on booking #${booking.id.slice(0, 8)}.`, 
        'job_started', 
        booking.id
      );
      break;

    case 'completed':
      await NotificationEngine.sendJobCompleted(payload);
      break;

    case 'finalized':
      await NotificationEngine.sendPaymentReceived(payload);
      break;

    case 'cancelled':
      await NotificationEngine.sendBookingCancelled(payload);
      break;

    case 'pending':
      await NotificationEngine.sendBookingPending(payload);
      break;
  }
};
