/**
 * TWILIO Secure Call Masking Integration
 * Re-exports unified call masking helper from telephony module.
 */
import { initiateMaskedCall, CallMaskResponse, MaskedCallParams } from "./telephony";

export type { CallMaskResponse, MaskedCallParams };

export async function triggerSecureCall(
  bookingId: string,
  fromRole: "customer" | "partner",
  customerPhone: string,
  partnerPhone: string
): Promise<CallMaskResponse> {
  return initiateMaskedCall({
    bookingId,
    fromRole,
    customerPhone,
    partnerPhone,
  });
}

