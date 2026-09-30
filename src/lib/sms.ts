/**
 * Zomindia Enterprise SMS Gateway & Android SMS Retriever API Service
 * Single Source of Truth for SMS and Notification Message Formatting
 */

/**
 * Safely resolves the 11-character Android SMS Retriever API App Hash across Node.js and Browser environments.
 */
export function getAppHash(customHash?: string): string {
  if (customHash && typeof customHash === "string" && customHash.trim()) {
    return customHash.trim();
  }
  try {
    if (typeof process !== "undefined" && process?.env?.ANDROID_APP_HASH) {
      return process.env.ANDROID_APP_HASH;
    }
  } catch {}
  try {
    if (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_ANDROID_APP_HASH) {
      return (import.meta as any).env.VITE_ANDROID_APP_HASH;
    }
  } catch {}
  return "FA+9qCX9VSu";
}

export const DEFAULT_ANDROID_APP_HASH = getAppHash();

export interface LoginOtpOptions {
  otp: string;
  appHash?: string;
  validityMinutes?: number;
  appName?: string;
}

/**
 * Formats Login / Account Verification OTP message adhering strictly to both:
 * 1. WebOTP API (W3C standard for Chrome on Android / Desktop):
 *    Your Zomindia verification code is 123456.
 *    @zomindia.com #123456
 * 2. Android SMS Retriever API (<#> prefix and 11-char app hash suffix).
 */
export function formatLoginOtpMessage({
  otp,
  appHash,
  validityMinutes = 5,
  appName = "Zomindia",
}: LoginOtpOptions): string {
  const hash = getAppHash(appHash);
  // Domain tag for native WebOTP API auto-detection
  const domainTag = typeof window !== "undefined" && window.location?.hostname
    ? `@${window.location.hostname} #${otp}`
    : `@zomindia.com #${otp}`;

  return `<#> Your ${appName} verification code is: ${otp}. Valid for ${validityMinutes} mins.\n\n${domainTag}\n${hash}`;
}

// Backward compatibility alias
export const formatSmsOtpMessage = formatLoginOtpMessage;

export interface ServiceStartOtpOptions {
  otp: string;
  partnerName?: string;
  appName?: string;
}

/**
 * Formats Doorstep Service Start OTP message (distinct from login to avoid customer confusion).
 * Format:
 * Your Zomindia Service Start OTP is {OTP}. Share this with technician {partnerName} only when work begins at your doorstep.
 */
export function formatServiceStartOtpMessage(
  otpOrOptions: string | ServiceStartOtpOptions,
  legacyPartnerName?: string
): string {
  let otp = "";
  let partnerName = "the technician";
  let appName = "Zomindia";

  if (typeof otpOrOptions === "string") {
    otp = otpOrOptions;
    if (legacyPartnerName && legacyPartnerName.trim()) {
      partnerName = legacyPartnerName.trim();
    }
  } else {
    otp = otpOrOptions.otp;
    partnerName = otpOrOptions.partnerName?.trim() || "the technician";
    appName = otpOrOptions.appName || "Zomindia";
  }

  return `Your ${appName} Service Start OTP is ${otp}. Share this with technician ${partnerName} only when work begins at your doorstep.`;
}

export interface BookingReceivedMessageOptions {
  name: string;
  price?: string | number;
  date?: string;
  time?: string;
  bookingId?: string;
  appName?: string;
}

/**
 * Formats booking confirmation notification with scheduled slot and live tracking link.
 */
export function formatBookingReceivedMessage({
  name,
  price = "499",
  date,
  time,
  bookingId = "new",
  appName = "Zomindia",
}: BookingReceivedMessageOptions): string {
  const scheduleDetails =
    date || time ? ` for ${[date, time].filter(Boolean).join(" at ")}` : "";
  return `Namaste ${name}, your booking with ${appName} Internet Technology is confirmed${scheduleDetails}! We are matching a verified professional, standard service starts at ₹${price}. Tracking link: https://zomindia.com/track/${bookingId}`;
}

export interface PartnerAssignedMessageOptions {
  name: string;
  partnerName?: string;
  partnerPhone?: string;
  date?: string;
  time?: string;
  eta?: string;
}

/**
 * Formats partner assignment notification with expert name, contact number, and ETA/slot.
 */
export function formatPartnerAssignedMessage({
  name,
  partnerName = "Pro",
  partnerPhone = "N/A",
  date,
  time,
  eta,
}: PartnerAssignedMessageOptions): string {
  const slotText = [date, time].filter(Boolean).join(" ");
  const timingInfo = eta ? `ETA: ${eta}` : slotText ? `scheduled slot: ${slotText}` : "shortly";
  return `Good news ${name}! Service Partner ${partnerName} is assigned to you. Contact: ${partnerPhone}. They will arrive on ${timingInfo}.`;
}

export interface ServiceCompleteMessageOptions {
  name: string;
  totalPrice?: string | number;
  bookingId?: string;
  invoiceUrl?: string;
}

/**
 * Formats service completion notification with settled amount and invoice download link.
 */
export function formatServiceCompleteMessage({
  name,
  totalPrice = "0",
  bookingId = "",
  invoiceUrl,
}: ServiceCompleteMessageOptions): string {
  const url =
    invoiceUrl ||
    (bookingId
      ? `https://zomindia.com/api/download-invoice?bookingId=${bookingId}`
      : "https://zomindia.com/bookings");
  return `Thank you ${name}! Your service is successfully completed. Final Settlement of ₹${totalPrice} has been processed. Download invoice: ${url}`;
}
