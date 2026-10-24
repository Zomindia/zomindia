import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  Star,
  Phone,
  Navigation,
  FileText,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Booking, Service, UserProfile, PartnerProfile, SupportTicket } from "../types";
import { formatBookingTime } from "../utils/formatTime";
import { generateInvoicePDF } from "../utils/generateInvoicePDF";
import { TrackingModal } from "./tracking/TrackingModal";
import { CORPORATE_LANDLINE_GATEWAY } from "../lib/telephony";
import { getCancellationSecondsRemaining } from "../utils/cancellation";

export interface CustomerBookingCardProps {
  booking: Booking;
  service?: Service;
  partnerUser?: UserProfile | null;
  partnerDetail?: PartnerProfile | null;
  customerProfile?: UserProfile | null;
  activeTicket?: SupportTicket | null;
  otpCode?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onPayOnline?: (booking: Booking) => void;
  onPayCash?: (booking: Booking) => void;
  onScanQR?: (booking: Booking) => void;
  onBookAgain?: (service: Service) => void;
  onTrack?: (bookingId: string) => void;
  onCallPartner?: (partner: UserProfile, booking: Booking) => void;
  onChatPartner?: (booking: Booking) => void;
  onDownloadInvoice?: (booking: Booking) => void;
  onSupport?: (bookingId: string) => void;
  onReschedule?: (bookingId: string, newDate: string, newTime: string) => void;
  onCancel?: (booking: Booking) => void;
  isPast?: boolean;
  inlineRating?: number;
  inlineComment?: string;
  onRatingChange?: (bookingId: string, rating: number) => void;
  onCommentChange?: (bookingId: string, comment: string) => void;
  onSubmitReview?: (booking: Booking) => void;
  onSkipReview?: (bookingId: string) => void;
  isReviewSubmitted?: boolean;
  isReviewSubmitting?: boolean;
  routingCallBookingId?: string | null;
}

/**
 * Formats scheduledAt timestamp or date into human-friendly "Today, 01:00 PM – 02:00 PM"
 */
export function formatBookingSchedule(scheduledAt: any): {
  dateLabel: string;
  timeSlot: string;
  fullDisplay: string;
} {
  let dateObj: Date | null = null;
  if (scheduledAt) {
    if (typeof scheduledAt.toDate === "function") {
      dateObj = scheduledAt.toDate();
    } else if (scheduledAt.seconds) {
      dateObj = new Date(scheduledAt.seconds * 1000);
    } else if (scheduledAt instanceof Date) {
      dateObj = scheduledAt;
    } else {
      dateObj = new Date(scheduledAt);
    }
  }

  const rawSlotTime = formatBookingTime(scheduledAt) || "01:00 PM";

  const buildSlotRange = (startSlot: string): string => {
    const match = startSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return startSlot;
    let hour = parseInt(match[1], 10);
    const min = match[2];
    const period = match[3].toUpperCase();
    let endHour = hour + 1;
    let endPeriod = period;
    if (hour < 12 && endHour >= 12) {
      endPeriod = period === "AM" ? "PM" : "AM";
    }
    if (endHour > 12) endHour = endHour - 12;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(hour)}:${min} ${period} – ${pad(endHour)}:${min} ${endPeriod}`;
  };

  const slotRange = buildSlotRange(rawSlotTime);

  if (!dateObj || isNaN(dateObj.getTime())) {
    return {
      dateLabel: "Today",
      timeSlot: slotRange,
      fullDisplay: `Today, ${slotRange}`,
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const bookingDay = new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate()
  );

  let dateLabel = "";
  if (bookingDay.getTime() === today.getTime()) {
    dateLabel = "Today";
  } else if (bookingDay.getTime() === tomorrow.getTime()) {
    dateLabel = "Tomorrow";
  } else {
    dateLabel = dateObj.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  return {
    dateLabel,
    timeSlot: slotRange,
    fullDisplay: `${dateLabel}, ${slotRange}`,
  };
}

export function CustomerBookingCard({
  booking,
  service,
  partnerUser,
  partnerDetail,
  customerProfile: _customerProfile,
  activeTicket: _activeTicket,
  otpCode: propOtpCode,
  isExpanded: _isExpanded = false,
  onToggleExpand: _onToggleExpand,
  onPayOnline: _onPayOnline,
  onPayCash: _onPayCash,
  onScanQR: _onScanQR,
  onBookAgain,
  onTrack: _onTrack,
  onCallPartner,
  onChatPartner,
  onDownloadInvoice,
  onSupport,
  onReschedule: _onReschedule,
  onCancel,
  isPast: _isPast = false,
  inlineRating = 0,
  inlineComment = "",
  onRatingChange,
  onCommentChange,
  onSubmitReview,
  onSkipReview,
  isReviewSubmitted = false,
  isReviewSubmitting = false,
  routingCallBookingId,
}: CustomerBookingCardProps) {
  const [isFullscreenTrackingOpen, setIsFullscreenTrackingOpen] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  const serviceName = service?.name || booking.serviceName || "RO Water Purifier Repair";
  const rawStatus = (booking.status || "pending").toLowerCase();
  const bookingShortCode = (booking.id || "").slice(-6).toUpperCase();

  // Status flags
  const isCompleted = ["completed", "finalized", "closed"].includes(rawStatus);
  const isCancelled = ["cancelled", "canceled", "rejected", "declined"].includes(rawStatus);
  const isInProgress = rawStatus === "in_progress";
  const isArrived = rawStatus === "arrived";
  const isOnTheWay =
    rawStatus === "on_the_way" ||
    rawStatus === "in_transit" ||
    rawStatus === "pro_en_route";
  const isAssigned = rawStatus === "assigned" || rawStatus === "confirmed";

  const hasPartner = !!(booking.partnerId || partnerUser);

  const isSearchingOrPending =
    !hasPartner &&
    !isCompleted &&
    !isCancelled &&
    (
      [
        "pending",
        "searching",
        "pending_acceptance",
        "pending_assignment",
        "pending_parts",
        "pending_checkout",
        "confirmed_pay_after_service",
      ].includes(rawStatus) ||
      !rawStatus ||
      rawStatus === "undefined"
    );

  // Dynamic OTP calculation
  const otp =
    propOtpCode ||
    booking.serviceOtp ||
    booking.startOTP ||
    (booking as any).startOtp ||
    (booking as any).otp ||
    (booking as any).completionOtp ||
    (booking.id
      ? (parseInt(booking.id.replace(/\D/g, "").slice(-4), 10) || 6330)
          .toString()
          .padStart(4, "0")
      : "6330");

  const isOtpRelevantStatus =
    ["assigned", "confirmed", "on_the_way", "in_progress", "accepted", "arrived"].includes(rawStatus) ||
    (hasPartner && !isCompleted && !isCancelled);

  const showServiceOtpBadge =
    Boolean(otp) &&
    !booking.otpVerified &&
    !isCompleted &&
    !isCancelled &&
    isOtpRelevantStatus;

  // Formatted date & time slot
  const rawDate = (booking as any).date;
  const rawTime = (booking as any).time;
  const scheduleInfo = formatBookingSchedule(booking.scheduledAt || rawDate);
  const slotSubtext = `${scheduleInfo.dateLabel || "Today"}, ${scheduleInfo.timeSlot || rawTime || "01:00 PM – 02:00 PM"} • Booking #${bookingShortCode}`;

  // Technician details
  const partnerName =
    partnerUser?.displayName ||
    (booking as any).partnerName ||
    (booking as any).assignedPartner?.name ||
    "Amit Singh";
  const techFirstName = (partnerName || "Amit").split(" ")[0];
  const partnerRating = partnerDetail?.rating || 4.9;
  const partnerPhoto =
    (booking as any).assignedPartner?.profileImage ||
    (booking as any).assignedPartner?.photoURL ||
    partnerUser?.photoURL ||
    (partnerDetail as any)?.profileImage ||
    null;

  // Payment status
  const isAmc = Boolean(
    booking.isAmcBooking || booking.isAmcCovered || booking.tier === "amc"
  );
  const hasValidOnlineTxn = Boolean(
    booking.transactionId &&
      booking.paymentStatus === "paid" &&
      booking.paymentMethod !== "cash" &&
      booking.paymentMethod !== "pay_after_service" &&
      booking.paymentMethod !== "cash_after_service"
  );
  const isPaid =
    isAmc ||
    (booking.paymentMethod === "wallet" && (booking.walletDeductAmount ?? 0) > 0) ||
    hasValidOnlineTxn;

  const paymentLabel = isPaid
    ? (booking.paymentMethod === "wallet" ? "Paid via Wallet" : isAmc ? "Covered by AMC" : "Paid Online")
    : "Pay After Service (Cash / UPI)";

  // 1-second interval for cancellation countdown if searching
  useEffect(() => {
    if (!isSearchingOrPending) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isSearchingOrPending]);

  // Cancel Handler
  const handleCancelBooking = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCancel) {
      onCancel(booking);
    } else if (typeof (window as any).__openCancellationModal === "function") {
      (window as any).__openCancellationModal(booking);
    }
  };

  // Support click handler
  const handleSupportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSupport) {
      onSupport(booking.id);
    } else if (onChatPartner) {
      onChatPartner(booking);
    } else if (typeof (window as any).__openSupportChat === "function") {
      (window as any).__openSupportChat(booking);
    }
  };

  // Call click handler
  const handleCallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (partnerUser && onCallPartner) {
      onCallPartner(partnerUser, booking);
    } else {
      const ph = partnerUser?.phoneNumber || (booking as any).partnerPhone || CORPORATE_LANDLINE_GATEWAY;
      window.open(`tel:${ph}`);
    }
  };

  // Download Invoice Handler
  const handleDownloadInvoice = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGeneratingInvoice(true);
    try {
      if (onDownloadInvoice) {
        await onDownloadInvoice(booking);
      } else {
        const success = await generateInvoicePDF({
          booking,
          service,
          partnerUser,
          partnerDetail,
        });
        if (success && (window as any).__showToast) {
          (window as any).__showToast("Invoice downloaded successfully!");
        }
      }
    } catch (err) {
      console.error("Failed to generate invoice PDF:", err);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  return (
    <motion.div
      id={`booking-card-${booking.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md p-4 sm:p-5 transition-all duration-200 relative overflow-hidden flex flex-col gap-3.5"
    >
      {/* Privacy Shield Active Call Routing Overlay */}
      {routingCallBookingId === booking.id && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-xs z-50 flex flex-col items-center justify-center text-center p-6 rounded-3xl">
          <div className="w-12 h-12 bg-emerald-50 border-2 border-emerald-500 rounded-full flex items-center justify-center mb-2 animate-bounce shadow-xs">
            <Phone size={20} className="text-emerald-600" />
          </div>
          <h4 className="text-slate-900 font-extrabold text-xs uppercase tracking-wider mb-1">
            Connecting Secure Call...
          </h4>
          <p className="text-slate-600 text-[11px] max-w-xs font-medium">
            Privacy shield active. Connecting safely to {partnerName}.
          </p>
        </div>
      )}

      {/* A. Card Top Bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate">
            {serviceName}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
            {slotSubtext}
          </p>
        </div>

        {/* Smooth Status Badge */}
        <div className="shrink-0">
          {isOnTheWay && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse shrink-0" />
              <span>🛵 On the way</span>
            </span>
          )}

          {isArrived && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
              <span>📍 Arrived</span>
            </span>
          )}

          {isInProgress && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <span>⚡ In progress</span>
            </span>
          )}

          {hasPartner && isAssigned && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-600 shrink-0" />
              <span>👤 Pro Assigned</span>
            </span>
          )}

          {isSearchingOrPending && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>🔍 Assigning Pro</span>
            </span>
          )}

          {isCompleted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span>✓ Completed</span>
            </span>
          )}

          {isCancelled && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
              <span>✕ Cancelled</span>
            </span>
          )}
        </div>
      </div>

      {/* B. Technician & Quick Actions Strip */}
      <div className="flex items-center justify-between gap-3 pt-1">
        {hasPartner ? (
          <>
            {/* Left: Technician Avatar + Name + Rating */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0 flex items-center justify-center">
                {partnerPhoto ? (
                  <img
                    src={partnerPhoto}
                    alt={partnerName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="font-bold text-slate-600 text-xs uppercase">
                    {techFirstName.slice(0, 2)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                  {partnerName}
                </h4>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mt-0.5">
                  <Star size={11} className="text-amber-500 fill-amber-500 shrink-0" />
                  <span>{partnerRating.toFixed(1)} ★ Verified Pro</span>
                </div>
              </div>
            </div>

            {/* Right: Quick Action Buttons (Call + Track Live) */}
            <div className="flex items-center gap-2 shrink-0">
              {!isCompleted && !isCancelled && (
                <button
                  type="button"
                  onClick={handleCallClick}
                  className="py-1.5 px-3 rounded-full text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title={`Call ${partnerName}`}
                >
                  <Phone size={12} className="text-emerald-600" />
                  <span>Call</span>
                </button>
              )}

              {!isCompleted && !isCancelled && (
                <button
                  type="button"
                  onClick={() => setIsFullscreenTrackingOpen(true)}
                  className="py-1.5 px-3.5 rounded-full text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="Track Live"
                >
                  <Navigation size={12} />
                  <span>Track Live →</span>
                </button>
              )}

              {isCompleted && (
                <>
                  <button
                    type="button"
                    disabled={isGeneratingInvoice}
                    onClick={handleDownloadInvoice}
                    className="py-1.5 px-3 rounded-full text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Download Bill"
                  >
                    <FileText size={12} className="text-slate-500" />
                    <span>Bill</span>
                  </button>

                  {onBookAgain && service && (
                    <button
                      type="button"
                      onClick={() => onBookAgain(service)}
                      className="py-1.5 px-3.5 rounded-full text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <RotateCcw size={12} />
                      <span>Book Again</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Searching / Pending Pro Match State */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <Sparkles size={16} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                  Matching Verified Pro...
                </h4>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                  Assigning the nearest technician in your area
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsFullscreenTrackingOpen(true)}
                className="py-1.5 px-3.5 rounded-full text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Track Live"
              >
                <Navigation size={12} />
                <span>Track Live →</span>
              </button>

              {!isCompleted && !isCancelled && (
                <button
                  type="button"
                  onClick={handleCancelBooking}
                  className="py-1.5 px-3 rounded-full text-xs font-semibold text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 transition-all cursor-pointer active:scale-95"
                  title="Cancel Booking"
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* C. Sleek Human OTP Pill */}
      {showServiceOtpBadge && (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔒</span>
            <span className="text-xs font-semibold text-slate-700">Start OTP:</span>
            <span className="font-mono font-black text-sm sm:text-base tracking-[0.25em] text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs select-all">
              {otp.toString().split("").join(" ")}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Share this code with {techFirstName} once he arrives at your doorstep.
          </p>
        </div>
      )}

      {/* D. Bottom Info Strip (Address & Payment in 1 Clean Row) */}
      <div className="pt-3 mt-0.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        {/* Left: Clean Address */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-slate-600" title={booking.address}>
          <MapPin size={13} className="text-slate-400 shrink-0" />
          <span className="truncate">{booking.address || "147, Anil Nagar, Barfani Dham, Indore"}</span>
        </div>

        {/* Right: Payment Info & Subtle Support Link */}
        <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
          <span className="font-bold text-emerald-700">
            ₹{booking.totalPrice || 0} • {paymentLabel}
          </span>
          <button
            type="button"
            onClick={handleSupportClick}
            className="text-slate-500 hover:text-blue-600 font-medium transition-colors cursor-pointer flex items-center gap-1 text-xs"
            title="Customer Support & Warranty"
          >
            Need help? 💬
          </button>
        </div>
      </div>

      {/* Completed Rating Prompt (Clean & Minimal) */}
      {isCompleted && !isReviewSubmitted && onRatingChange && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Rate your service:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => onRatingChange(booking.id, star)}
                  className="transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                >
                  <Star
                    size={16}
                    fill={star <= inlineRating ? "currentColor" : "none"}
                    className={
                      star <= inlineRating
                        ? "text-amber-400"
                        : "text-slate-300 hover:text-amber-300"
                    }
                  />
                </button>
              ))}
            </div>
          </div>
          {inlineRating > 0 && onSubmitReview && (
            <button
              type="button"
              disabled={isReviewSubmitting}
              onClick={() => onSubmitReview(booking)}
              className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
            >
              {isReviewSubmitting ? "Submitting..." : "Submit"}
            </button>
          )}
          {onSkipReview && inlineRating === 0 && (
            <button
              type="button"
              onClick={() => onSkipReview(booking.id)}
              className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Skip
            </button>
          )}
        </div>
      )}

      {/* Clean Fullscreen Live Navigation Tracking Modal */}
      <TrackingModal
        isOpen={isFullscreenTrackingOpen}
        onClose={() => setIsFullscreenTrackingOpen(false)}
        booking={booking}
        partnerUser={partnerUser}
        serviceName={serviceName}
        onCallPartner={() => {
          if (partnerUser && onCallPartner) {
            onCallPartner(partnerUser, booking);
          }
        }}
        onChatPartner={() => {
          if (onChatPartner) {
            onChatPartner(booking);
          }
        }}
      />
    </motion.div>
  );
}

export default CustomerBookingCard;
