import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

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
  let isTwilio = Math.random() > 0.5; // Dynamically simulate either Twilio or Gupshup routing
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
    // Record log directly into Firestore so frontend displays dispatcher tracks instantly
    const docRef = await addDoc(collection(db, 'whatsapp_alerts'), alertLog);
    alertLog.id = docRef.id;

    // Simulate async webhook delivery & read receipts reporting
    setTimeout(async () => {
      try {
        // Simple mock trigger simulation update
        console.log(`[WhatsApp Webhook Gateway] Receipt received for ${recipientPhone}: Delivered & Read`);
      } catch (err) {
        console.error('Webhook async error', err);
      }
    }, 3000);

    return alertLog;
  } catch (err) {
    console.error('Error logging WhatsApp alert:', err);
    return null;
  }
}
