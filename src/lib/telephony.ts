import { db } from './firebase';
import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';

/**
 * ZOMINDIA ENTERPRISE TELEPHONY SYSTEM
 * Centralized corporate Landline identity gateway and Twilio/Exotel Serverless Telephony Bridge Router
 */
export const CORPORATE_LANDLINE_GATEWAY = "080-6925-1100";
export const TELEPHONY_PROVIDER = "Exotel Enterprise SIP Trunk Gateway";

export interface TelephonyBridgeEvent {
  bookingId: string;
  callerId: string;
  callerName: string;
  callerRole: 'partner' | 'customer' | 'admin';
  callerPhone: string;
  calleeId: string;
  calleeName: string;
  calleePhone: string;
}

/**
 * Simulates a serverless telephony bridge connector (Exotel/Twilio API client wrapper)
 * to establish a masked corporate landline call.
 */
export async function triggerTelephonyBridge(event: TelephonyBridgeEvent) {
  console.log(`[Telephony Bridge] Initiating masked patch connecting ${event.callerRole} (${event.callerName}) to recipient...`);
  console.log(`[Telephony Bridge] Provider: ${TELEPHONY_PROVIDER}`);
  console.log(`[Telephony Bridge] Central Landline Caller ID Node: ${CORPORATE_LANDLINE_GATEWAY}`);
  console.log(`[Telephony Bridge] Masking target customer number: ${event.calleePhone.replace(/.(?=.{4})/g, '•')}`);
  console.log(`[Telephony Bridge] Masking target operator number: ${event.callerPhone.replace(/.(?=.{4})/g, '•')}`);

  // Update activeCall state in Firestore booking document to synchronize with other viewports reactively
  const bookingRef = doc(db, 'bookings', event.bookingId);
  await updateDoc(bookingRef, {
    activeCall: {
      callerId: event.callerId,
      callerName: event.callerName,
      callerRole: event.callerRole,
      status: 'ringing',
      gatewayNumber: CORPORATE_LANDLINE_GATEWAY,
      telephonyProvider: TELEPHONY_PROVIDER,
      timestamp: Timestamp.now()
    }
  });

  return {
    success: true,
    gateway: CORPORATE_LANDLINE_GATEWAY,
    provider: TELEPHONY_PROVIDER,
    timestamp: new Date().toISOString()
  };
}
