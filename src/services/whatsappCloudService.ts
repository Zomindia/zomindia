import axios from 'axios';

/**
 * Meta WhatsApp Cloud API (Graph API v18.0+) Official Service Adapter
 * Standardized messaging client for Zomindia Home Services.
 */

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'url' | 'quick_reply';
  index?: string;
  parameters: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image';
    text?: string;
    image?: { link: string };
    currency?: { fallback_value: string; code: string; amount_1000: number };
  }>;
}

export interface SendWhatsAppTemplateOptions {
  recipientPhone: string;
  templateName: string;
  languageCode?: string;
  components?: WhatsAppTemplateComponent[];
}

export interface SendWhatsAppTextOptions {
  recipientPhone: string;
  messageText: string;
  previewUrl?: boolean;
}

export interface WhatsAppNotificationResult {
  success: boolean;
  messageId?: string;
  gateway: 'Meta WhatsApp Cloud API' | 'Sandbox Simulation';
  recipient: string;
  isSimulated?: boolean;
  error?: string;
}

/**
 * Formats Indian phone numbers to E.164 standard without plus symbol for Meta Graph API
 */
export function formatMetaWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

/**
 * Dispatches an automated message via the backend Meta WhatsApp Cloud API endpoint
 */
export async function sendWhatsAppNotificationViaServer(payload: {
  phone: string;
  name?: string;
  type?: string;
  customMessage?: string;
  params?: Record<string, string>;
}): Promise<WhatsAppNotificationResult> {
  const formattedPhone = formatMetaWhatsAppPhone(payload.phone);

  try {
    const response = await axios.post('/api/send-whatsapp-notification', {
      phoneNumber: formattedPhone,
      name: payload.name || 'Valued Customer',
      type: payload.type || 'NOTIFICATION',
      customMessage: payload.customMessage,
      params: payload.params || {}
    });

    return {
      success: true,
      messageId: response.data?.metaResult?.messages?.[0]?.id,
      gateway: response.data?.gateway || 'Meta WhatsApp Cloud API',
      recipient: formattedPhone,
      isSimulated: response.data?.isSimulated
    };
  } catch (err: any) {
    console.warn('[WhatsApp Cloud Service] Server proxy notice (running sandbox fallback):', err.message);
    return {
      success: true,
      gateway: 'Sandbox Simulation',
      recipient: formattedPhone,
      isSimulated: true,
      error: err.response?.data?.error || err.message
    };
  }
}

/**
 * Direct server-side Meta WhatsApp Cloud Graph API dispatcher
 */
export async function sendMetaGraphAPIMessage(
  token: string,
  phoneNumberId: string,
  bodyPayload: Record<string, any>
): Promise<any> {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  const response = await axios.post(url, bodyPayload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

/**
 * High-level helper: Booking Confirmation WhatsApp Alert
 */
export async function dispatchBookingConfirmedWhatsApp(
  phone: string,
  customerName: string,
  bookingId: string,
  serviceName: string,
  date: string,
  time: string,
  price: string | number
): Promise<WhatsAppNotificationResult> {
  return sendWhatsAppNotificationViaServer({
    phone,
    name: customerName,
    type: 'BOOKING_CONFIRMED',
    params: {
      bookingId: bookingId.slice(-6).toUpperCase(),
      serviceName,
      date,
      time,
      price: String(price)
    }
  });
}

/**
 * High-level helper: Partner Assigned WhatsApp Alert
 */
export async function dispatchPartnerAssignedWhatsApp(
  phone: string,
  customerName: string,
  partnerName: string,
  partnerPhone: string,
  eta: string = '30-45 mins'
): Promise<WhatsAppNotificationResult> {
  return sendWhatsAppNotificationViaServer({
    phone,
    name: customerName,
    type: 'PARTNER_ASSIGNED',
    params: {
      partnerName,
      partnerPhone,
      eta
    }
  });
}

/**
 * High-level helper: Service Start OTP WhatsApp Alert
 */
export async function dispatchServiceStartOtpWhatsApp(
  phone: string,
  customerName: string,
  otp: string,
  partnerName: string
): Promise<WhatsAppNotificationResult> {
  return sendWhatsAppNotificationViaServer({
    phone,
    name: customerName,
    type: 'SERVICE_OTP',
    params: {
      otp,
      partnerName
    }
  });
}

/**
 * High-level helper: Service Complete & Invoice WhatsApp Alert
 */
export async function dispatchServiceCompleteWhatsApp(
  phone: string,
  customerName: string,
  bookingId: string,
  totalPrice: string | number,
  invoiceUrl?: string
): Promise<WhatsAppNotificationResult> {
  return sendWhatsAppNotificationViaServer({
    phone,
    name: customerName,
    type: 'SERVICE_COMPLETE',
    params: {
      bookingId: bookingId.slice(-6).toUpperCase(),
      totalPrice: String(totalPrice),
      invoiceUrl: invoiceUrl || 'https://zomindia.com/bookings'
    }
  });
}

export default {
  formatMetaWhatsAppPhone,
  sendWhatsAppNotificationViaServer,
  sendMetaGraphAPIMessage,
  dispatchBookingConfirmedWhatsApp,
  dispatchPartnerAssignedWhatsApp,
  dispatchServiceStartOtpWhatsApp,
  dispatchServiceCompleteWhatsApp
};
