/**
 * TWILIO Secure Call Masking Integration
 * This module manages anonymous customer-to-partner voice calls securely via Twilio Click-to-Call Voice API.
 */

export interface CallMaskResponse {
  success: boolean;
  message: string;
  callId?: string;
  isSimulated?: boolean;
}

export async function triggerSecureCall(
  bookingId: string,
  fromRole: "customer" | "partner",
  customerPhone: string,
  partnerPhone: string
): Promise<CallMaskResponse> {
  try {
    const response = await fetch("/api/call/mask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId,
        fromRole,
        customerPhone,
        partnerPhone,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    console.error("[Twilio Frontend Client Error]:", err);
    return {
      success: false,
      message: err.message || "Failed to trigger secure masking call",
    };
  }
}
