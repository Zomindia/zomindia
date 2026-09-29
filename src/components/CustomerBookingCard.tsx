import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Zap,
  User,
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Star,
  HelpCircle,
  FileText,
  RotateCcw,
  Navigation,
  XCircle,
  X,
  Droplets,
  Snowflake,
  Tv,
  Wrench,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { doc, updateDoc, Timestamp, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Booking, Service, UserProfile, PartnerProfile, SupportTicket } from "../types";
import { formatBookingTime } from "../utils/formatTime";
import { generateInvoicePDF } from "../utils/generateInvoicePDF";
import PartnerTrackingMap from "./PartnerTrackingMap";
import LogoIcon from "../assets/images/logo-icon.png";
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
 * Clean Category Icon Resolver
 */
function getCategoryIcon(serviceName: string = "", categoryId: string = "") {
  const s = `${serviceName} ${categoryId}`.toLowerCase();
  if (
    s.includes("ac ") ||
    s.includes(" ac") ||
    s.includes("cooling") ||
    s.includes("air conditioner")
  ) {
    return <Snowflake size={18} className="text-cyan-600 shrink-0" />;
  }
  if (s.includes("ro") || s.includes("water") || s.includes("purifier")) {
    return <Droplets size={18} className="text-teal-600 shrink-0" />;
  }
  if (s.includes("tv") || s.includes("television") || s.includes("audio")) {
    return <Tv size={18} className="text-indigo-600 shrink-0" />;
  }
  if (s.includes("fridge") || s.includes("refrigerator") || s.includes("freezer")) {
    return <Snowflake size={18} className="text-blue-600 shrink-0" />;
  }
  if (s.includes("clean") || s.includes("wash") || s.includes("pest")) {
    return <Sparkles size={18} className="text-emerald-600 shrink-0" />;
  }
  if (
    s.includes("electric") ||
    s.includes("wiring") ||
    s.includes("inverter") ||
    s.includes("switch")
  ) {
    return <Zap size={18} className="text-amber-600 shrink-0" />;
  }
  return <Wrench size={18} className="text-blue-600 shrink-0" />;
}

/**
 * Formats scheduledAt timestamp or date into human-friendly "Today, 6:00 PM - 7:00 PM"
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

  const rawSlotTime = formatBookingTime(scheduledAt) || "11:00 AM";

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
    return `${pad(hour)}:${min} ${period} - ${pad(endHour)}:${min} ${endPeriod}`;
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
  const isToday =
    dateObj.getDate() === now.getDate() &&
    dateObj.getMonth() === now.getMonth() &&
    dateObj.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    dateObj.getDate() === tomorrow.getDate() &&
    dateObj.getMonth() === tomorrow.getMonth() &&
    dateObj.getFullYear() === tomorrow.getFullYear();

  let dateLabel = "";
  if (isToday) {
    dateLabel = "Today";
  } else if (isTomorrow) {
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

/**
 * Extracts concise 2-part locality e.g. "Scheme 54, Vijay Nagar"
 */
function getShortLocality(address?: string): string {
  if (!address || typeof address !== "string") return "Indore, MP";
  const clean = address.trim();
  const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "Indore, MP";
  if (parts.length === 1) return parts[0];

  // Exclude broad non-local labels like "India" or "Madhya Pradesh"
  const meaningful = parts.filter((p) => {
    const l = p.toLowerCase();
    return (
      l !== "india" &&
      l !== "madhya pradesh" &&
      l !== "mp" &&
      !l.includes("tehsil")
    );
  });

  if (meaningful.length >= 2) {
    return `${meaningful[meaningful.length - 2]}, ${meaningful[meaningful.length - 1]}`;
  }
  return meaningful[0] || "Indore, MP";
}

export const CustomerBookingCard = React.memo<CustomerBookingCardProps>(({
  booking,
  service,
  partnerUser,
  partnerDetail,
  customerProfile,
  activeTicket,
  otpCode: propOtpCode,
  isExpanded = false,
  onToggleExpand,
  onPayOnline,
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
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isFullscreenTrackingOpen, setIsFullscreenTrackingOpen] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  const expanded = onToggleExpand ? isExpanded : internalExpanded;
  const toggleExpanded = onToggleExpand || (() => setInternalExpanded((prev) => !prev));

  const serviceName = service?.name || booking.serviceName || "Professional Service";
  const rawStatus = (booking.status || "pending").toLowerCase();

  // Status breakdown
  const isCompleted = ["completed", "finalized", "closed"].includes(rawStatus);
  const isCancelled = rawStatus === "cancelled";
  const isInProgress = rawStatus === "in_progress";
  const isArrived = rawStatus === "arrived";
  const isOnTheWay =
    rawStatus === "on_the_way" ||
    rawStatus === "in_transit" ||
    rawStatus === "pro_en_route";
  const isAssigned = rawStatus === "assigned" || rawStatus === "confirmed";
  const isSearchingOrPending =
    [
      "pending",
      "searching",
      "pending_acceptance",
      "pending_assignment",
      "pending_parts",
      "pending_checkout",
      "confirmed_pay_after_service",
    ].includes(rawStatus) && !booking.partnerId;

  // Partner assignment status
  const hasPartner = !!(booking.partnerId || partnerUser);

  // Dynamic OTP calculation
  const otp = propOtpCode || booking.serviceOtp || booking.startOTP;
  const showOtpBox =
    Boolean(otp) &&
    !booking.otpVerified &&
    !isCompleted &&
    !isCancelled &&
    (isAssigned || isOnTheWay || isArrived || hasPartner);

  // Formatted date & time slot
  const rawDate = (booking as any).date;
  const rawTime = (booking as any).time;
  const scheduleInfo = formatBookingSchedule(booking.scheduledAt || rawDate);
  const displayTimeSlot = rawTime
    ? `${scheduleInfo.dateLabel || "Today"}, ${rawTime}`
    : scheduleInfo.fullDisplay;

  // Short locality
  const shortLocality = getShortLocality(booking.address);

  // Completed date formatting
  let completedDateStr = "";
  if (booking.completedAt) {
    const d =
      typeof (booking.completedAt as any).toDate === "function"
        ? (booking.completedAt as any).toDate()
        : new Date(booking.completedAt);
    if (!isNaN(d.getTime())) {
      completedDateStr = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  }
  if (!completedDateStr && rawDate) {
    completedDateStr = rawDate;
  }
  if (!completedDateStr) {
    completedDateStr = scheduleInfo.dateLabel || "recently";
  }

  // Payment status
  const isAmc = Boolean(
    booking.isAmcBooking || booking.isAmcCovered || booking.tier === "amc"
  );
  const hasValidOnlineTxn = Boolean(
    booking.transactionId &&
      booking.paymentStatus === "paid" &&
      booking.paymentMethod !== "cash" &&
      booking.paymentMethod !== "pay_after_service"
  );
  const isPaid =
    isAmc ||
    (booking.paymentMethod === "wallet" && (booking.walletDeductAmount ?? 0) > 0) ||
    hasValidOnlineTxn;

  // 1-second interval for live cancellation countdown
  useEffect(() => {
    if (!isSearchingOrPending) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isSearchingOrPending]);

  const secondsRemaining = getCancellationSecondsRemaining(booking.createdAt, nowMs);
  const isFreeCancelActive = secondsRemaining > 0 && isSearchingOrPending;

  // Cancel Handler
  const handleCancelBooking = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCancel) {
      onCancel(booking);
    } else if (typeof (window as any).__openCancellationModal === "function") {
      (window as any).__openCancellationModal(booking);
    }
  };

  const handleCancelPolicyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCancel) {
      onCancel(booking);
    } else if (onSupport) {
      onSupport(booking.id);
    } else if (typeof (window as any).__openSupportChat === "function") {
      (window as any).__openSupportChat(booking);
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
          customerProfile,
        });
        if (success && (window as any).__showToast) {
          (window as any).__showToast("Invoice downloaded successfully!");
        }
      }
    } catch (err) {
      console.error("Failed to generate invoice PDF:", err);
      if ((window as any).__showToast) {
        (window as any).__showToast("Failed to generate invoice. Please try again.");
      }
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
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 p-4 sm:p-5 relative overflow-hidden transition-all duration-200 shadow-xs hover:shadow-sm"
    >
      {/* Privacy Shield Active Call Routing Overlay */}
      {routingCallBookingId === booking.id && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-xs z-50 flex flex-col items-center justify-center text-center p-6 rounded-2xl">
          <div className="w-12 h-12 bg-emerald-50 border-2 border-emerald-500 rounded-full flex items-center justify-center mb-2 animate-bounce shadow-xs">
            <Phone size={20} className="text-emerald-600" />
          </div>
          <h4 className="text-slate-900 font-extrabold text-xs uppercase tracking-wider mb-1">
            Connecting Secure Call...
          </h4>
          <p className="text-slate-600 text-[11px] max-w-xs font-medium">
            Privacy shield active. Connecting safely to your assigned technician.
          </p>
        </div>
      )}

      {/* 1. Header: Large Service Title + Category Icon + Status Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
            {getCategoryIcon(serviceName, service?.categoryId || booking.serviceId)}
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug truncate">
              {serviceName}
            </h3>
            {booking.isAmcBooking && (
              <span className="inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-200 mt-0.5">
                AMC Plan
              </span>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="shrink-0">
          {isSearchingOrPending && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
              Assigning Pro
            </span>
          )}

          {hasPartner && isAssigned && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1.5">
              <User size={12} className="text-blue-600 shrink-0" />
              Pro Assigned
            </span>
          )}

          {hasPartner && isOnTheWay && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-300 inline-flex items-center gap-1.5 animate-pulse">
              <Navigation size={12} className="text-sky-600 shrink-0" />
              En Route
            </span>
          )}

          {hasPartner && isArrived && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1.5">
              <MapPin size={12} className="text-indigo-600 shrink-0" />
              Arrived
            </span>
          )}

          {isInProgress && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              In Progress
            </span>
          )}

          {isCompleted && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
              Completed
            </span>
          )}

          {isCancelled && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
              <XCircle size={12} className="text-rose-500 shrink-0" />
              Cancelled
            </span>
          )}
        </div>
      </div>

      {/* 2. Body (2 lines max): Date/Time Slot & Short Locality */}
      <div className="mt-3 space-y-1 text-xs">
        {/* Line 1: Date & Time Slot */}
        <div className="flex items-center gap-1.5 font-medium text-slate-700">
          <Clock size={13} className="text-slate-400 shrink-0" />
          <span>{displayTimeSlot}</span>
        </div>

        {/* Line 2: Short Address Locality */}
        <div className="flex items-center gap-1.5 font-medium text-slate-600">
          <MapPin size={13} className="text-slate-400 shrink-0" />
          <span className="truncate">{shortLocality}</span>
        </div>
      </div>

      {/* 3. State-Driven Dynamic Middle Content & Actions */}

      {/* STATE A: Status === 'searching' or 'pending' */}
      {isSearchingOrPending && (
        <>
          <div className="mt-3 p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-bold text-[12px] leading-tight text-amber-950">
                Assigning closest verified technician in Indore... Expected in ~2-3 mins. Need assistance? Tap Help.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancelBooking}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Cancel Booking"
              >
                <span>⏳ Cancel{isFreeCancelActive ? ` (${secondsRemaining}s)` : ''}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSupport) {
                    onSupport(booking.id);
                  } else if (typeof (window as any).__openSupportChat === "function") {
                    (window as any).__openSupportChat(booking);
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Need Help? Chat Support"
              >
                <MessageSquare size={13} className="text-blue-600" />
                <span>💬 Need Help?</span>
              </button>
            </div>

            <button
              type="button"
              onClick={toggleExpanded}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer ml-auto"
            >
              <span>{expanded ? "Less" : "Details"}</span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </>
      )}

      {/* STATE B: Status === 'assigned', 'on_the_way', 'arrived', or 'in_progress' */}
      {(hasPartner || isInProgress) && !isCompleted && !isCancelled && !isSearchingOrPending && (
        <>
          {/* Mini Partner Tile */}
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200 bg-white shadow-2xs">
                <img
                  src={
                    partnerUser?.photoURL ||
                    (partnerDetail as any)?.profilePhoto ||
                    LogoIcon
                  }
                  alt="Partner"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-900 text-xs truncate">
                    {partnerUser?.displayName || (booking as any).partnerName || "Assigned Technician"}
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5 shrink-0">
                    ★ {(partnerDetail?.rating || 4.9).toFixed(1)}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                  <ShieldCheck size={10} className="text-emerald-600" />
                  Verified Pro • Indore
                </span>
              </div>
            </div>

            {/* Start Job OTP chip */}
            {showOtpBox && otp && (
              <div className="shrink-0 bg-blue-50 border border-blue-200 rounded-xl px-2.5 py-1 text-center shadow-2xs">
                <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 block leading-tight">
                  Start OTP
                </span>
                <span className="font-mono font-black text-sm text-blue-800 tracking-wider">
                  {otp}
                </span>
              </div>
            )}

            {isInProgress && (
              <div className="shrink-0 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1 text-center shadow-2xs">
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 block leading-tight">
                  OTP Verified
                </span>
                <span className="text-[10px] font-bold text-emerald-800">
                  In Service
                </span>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Primary Track Live Button */}
              <button
                type="button"
                onClick={() => setIsFullscreenTrackingOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Navigation size={13} />
                <span>Track Live</span>
              </button>

              {/* Call Partner Button */}
              <button
                type="button"
                onClick={() => {
                  if (partnerUser && onCallPartner) {
                    onCallPartner(partnerUser, booking);
                  } else {
                    window.open(`tel:${partnerUser?.phoneNumber || CORPORATE_LANDLINE_GATEWAY}`);
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Phone size={13} className="text-emerald-600" />
                <span>Call Partner</span>
              </button>

              {/* Chat Button */}
              <button
                type="button"
                onClick={() => {
                  if (onChatPartner) {
                    onChatPartner(booking);
                  } else if (typeof (window as any).__openSupportChat === "function") {
                    (window as any).__openSupportChat(booking);
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Chat with partner / technician"
              >
                <MessageSquare size={13} className="text-slate-600" />
                <span>Chat</span>
              </button>
            </div>

            <button
              type="button"
              onClick={toggleExpanded}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer ml-auto"
            >
              <span>{expanded ? "Less" : "Details"}</span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </>
      )}

      {/* STATE C: Status === 'completed' */}
      {isCompleted && (
        <>
          <div className="mt-3 p-2.5 bg-emerald-50/70 border border-emerald-200/70 rounded-xl flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-1.5 font-medium text-[11.5px]">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span>Service completed on {completedDateStr}</span>
            </div>
            <span className="font-extrabold text-slate-900 text-xs">
              ₹{booking.totalPrice || 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Rate & Review Button */}
              {!isReviewSubmitted && onRatingChange ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!expanded) toggleExpanded();
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Star size={13} className="text-amber-500 fill-amber-500" />
                  <span>Rate & Review</span>
                </button>
              ) : isReviewSubmitted ? (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 inline-flex items-center gap-1">
                  <Star size={12} className="text-amber-500 fill-amber-500" />
                  Rated
                </span>
              ) : null}

              {/* Download Bill */}
              <button
                type="button"
                disabled={isGeneratingInvoice}
                onClick={handleDownloadInvoice}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isGeneratingInvoice ? (
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileText size={13} className="text-blue-600" />
                )}
                <span>Download Bill</span>
              </button>

              {/* Book Again */}
              {onBookAgain && service && (
                <button
                  type="button"
                  onClick={() => onBookAgain(service)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw size={12} />
                  <span>Book Again</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={toggleExpanded}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer ml-auto"
            >
              <span>{expanded ? "Less" : "Details"}</span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </>
      )}

      {/* STATE D: Status === 'cancelled' */}
      {isCancelled && (
        <>
          <div className="mt-3 p-2.5 bg-rose-50/70 border border-rose-200/70 rounded-xl flex items-center gap-1.5 text-xs text-rose-800">
            <XCircle size={13} className="text-rose-500 shrink-0" />
            <span className="font-medium text-[11.5px]">This booking was cancelled.</span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-2">
              {onBookAgain && service && (
                <button
                  type="button"
                  onClick={() => onBookAgain(service)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Book Again</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onSupport) {
                    onSupport(booking.id);
                  } else if (typeof (window as any).__openSupportChat === "function") {
                    (window as any).__openSupportChat(booking);
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <HelpCircle size={13} className="text-slate-500" />
                <span>Need Help?</span>
              </button>
            </div>

            <button
              type="button"
              onClick={toggleExpanded}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer ml-auto"
            >
              <span>{expanded ? "Less" : "Details"}</span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </>
      )}

      {/* 4. Expandable Details Drawer (Tucked behind "Details ▾") */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-3.5 mt-3 border-t border-slate-200/80 space-y-3.5">
              {/* Technical Reference & Price Header */}
              <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                <span className="font-mono text-[11px] font-bold text-slate-600">
                  ID: #{booking.id.slice(-6).toUpperCase()}
                </span>
                <span className="text-[11px] font-bold text-slate-700">
                  {isPaid ? "Paid in Full" : "Payment: Cash / UPI on Arrival"}
                </span>
              </div>

              {/* Transparent Price Breakdown */}
              <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600 text-[11.5px]">
                  <span>Inspection & Service Fee</span>
                  <span className="font-bold text-slate-800">
                    ₹{(booking as any).visitationFee || service?.basePrice || booking.totalPrice || 0}
                  </span>
                </div>
                {((booking as any).couponDiscount || booking.discountApplied || 0) > 0 && (
                  <div className="flex items-center justify-between text-emerald-700 text-[11.5px] font-medium">
                    <span>Discount {booking.promoCode ? `(${booking.promoCode})` : ""}</span>
                    <span className="font-bold">
                      -₹{(booking as any).couponDiscount || booking.discountApplied}
                    </span>
                  </div>
                )}
                {(booking.walletDeductAmount || 0) > 0 && (
                  <div className="flex items-center justify-between text-purple-700 text-[11.5px] font-medium">
                    <span>Wallet Balance Applied</span>
                    <span className="font-bold">-₹{booking.walletDeductAmount}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 font-extrabold">
                  <span className="text-slate-800 uppercase text-[10px] tracking-wider">
                    Total Amount
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    ₹{booking.totalPrice || 0}
                  </span>
                </div>
              </div>

              {/* Full Address Block */}
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 text-xs space-y-1">
                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block">
                  Service Address
                </span>
                <p className="font-medium text-slate-800 leading-relaxed">
                  {booking.address || "Indore, Madhya Pradesh"}
                </p>
                {booking.notes && (
                  <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60 mt-1">
                    <span className="font-bold">Note:</span> {booking.notes}
                  </p>
                )}
              </div>

              {/* Service Protocol Checklist */}
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <FileText size={12} className="text-blue-600" />
                    Standard Protocol
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {booking.progressPercentage || (isCompleted ? 100 : 0)}% Completed
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {[
                    "Diagnostic inspection & health check",
                    "Perform professional repair/deep clean",
                    "Component testing & calibration",
                    "Final quality check & work area cleanup",
                  ].map((task, idx) => {
                    const isDone =
                      isCompleted ||
                      (Array.isArray(booking?.completedTasks) &&
                        booking.completedTasks.includes(task));
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-1.5 rounded-lg bg-white border border-slate-200/70 text-[11px]"
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                            isDone
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-slate-300 text-transparent"
                          }`}
                        >
                          <CheckCircle2 size={10} className="text-white" />
                        </div>
                        <span
                          className={`truncate ${
                            isDone ? "line-through text-emerald-700" : "text-slate-700"
                          }`}
                        >
                          {task}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Completed Jobs: Rating & Feedback section inside Details */}
              {isCompleted && !isReviewSubmitted && onRatingChange && (
                <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Star size={13} className="text-amber-500 fill-amber-500" />
                      Rate Your Technician:
                    </span>
                    {onSkipReview && (
                      <button
                        type="button"
                        onClick={() => onSkipReview(booking.id)}
                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 cursor-pointer"
                      >
                        Skip
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2 items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => onRatingChange(booking.id, star)}
                        className="transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                      >
                        <Star
                          size={20}
                          fill={star <= inlineRating ? "currentColor" : "none"}
                          className={
                            star <= inlineRating
                              ? "text-amber-400 drop-shadow-xs"
                              : "text-slate-300 hover:text-amber-300"
                          }
                        />
                      </button>
                    ))}
                  </div>

                  {inlineRating > 0 && onCommentChange && (
                    <div className="space-y-1.5 pt-1">
                      <textarea
                        value={inlineComment}
                        onChange={(e) => onCommentChange(booking.id, e.target.value)}
                        placeholder="Share your experience (optional)..."
                        rows={2}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 font-medium"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={isReviewSubmitting || inlineRating === 0}
                          onClick={() => {
                            if (onSubmitReview) onSubmitReview(booking);
                          }}
                          className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                        >
                          {isReviewSubmitting ? "Submitting..." : "Submit Review"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Warranty & Support shortcut */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (onSupport) {
                      onSupport(booking.id);
                    } else if (typeof (window as any).__openSupportChat === "function") {
                      (window as any).__openSupportChat(booking);
                    }
                  }}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
                >
                    {activeTicket ? (
                      <>
                        <ShieldAlert size={12} className="text-amber-600" />
                        <span>Warranty Ticket #{activeTicket.id.slice(0, 6).toUpperCase()} Active</span>
                      </>
                    ) : (
                      <>
                        <HelpCircle size={12} className="text-slate-400" />
                        <span>Warranty & Resolution Desk</span>
                      </>
                    )}
                  </button>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Live Navigation Modal / Bottom Sheet */}
      <AnimatePresence>
        {isFullscreenTrackingOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setIsFullscreenTrackingOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.97 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/90">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
                    <Navigation size={16} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                      Live Technician Location • {serviceName}
                    </h3>
                    <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                      Technician is en-route to your Indore address
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFullscreenTrackingOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                  title="Close Live Navigation"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Full Map Canvas */}
              <div className="p-3 sm:p-4 overflow-y-auto space-y-3">
                <PartnerTrackingMap
                  partnerId={booking.partnerId!}
                  partnerLat={booking.partnerLocation?.lat}
                  partnerLng={booking.partnerLocation?.lng}
                  customerLat={booking.lat}
                  customerLng={booking.lng}
                  destinationAddress={booking.address}
                  bookingLocation={
                    booking.lat && booking.lng
                      ? { lat: booking.lat, lng: booking.lng }
                      : undefined
                  }
                  bookingId={booking.id}
                  serviceName={serviceName}
                  variant="full"
                  heightClassName="h-[360px] sm:h-[400px]"
                  onCall={() => {
                    if (partnerUser && onCallPartner) {
                      onCallPartner(partnerUser, booking);
                    }
                  }}
                  onChat={() => {
                    if (onChatPartner) {
                      onChatPartner(booking);
                    }
                  }}
                />

                {/* Additional Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2 shadow-2xs">
                    <MapPin size={14} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Service Destination
                      </span>
                      <span className="font-semibold text-slate-800 line-clamp-2 mt-0.5">
                        {booking.address || "Indore, Madhya Pradesh"}
                      </span>
                    </div>
                  </div>

                  {showOtpBox && otp && (
                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-center justify-between gap-2 shadow-2xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                          Start Job Verification OTP
                        </span>
                        <span className="text-[11px] font-medium text-slate-600">
                          Share with pro on arrival
                        </span>
                      </div>
                      <span className="text-base font-black font-mono tracking-widest text-blue-700 bg-white px-2.5 py-0.5 rounded-lg border border-blue-300 shadow-2xs">
                        {otp}
                      </span>
                    </div>
                  )}
                </div>

                {/* Persistent Help & Support Dock inside live tracking modal */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between flex-wrap gap-2 text-xs shadow-2xs">
                  <div className="flex items-center gap-1.5 font-extrabold text-slate-800">
                    <ShieldCheck size={15} className="text-emerald-600" />
                    <span>Priority Support Dock</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSupport) {
                          onSupport(booking.id);
                        } else if (typeof (window as any).__openSupportChat === "function") {
                          (window as any).__openSupportChat(booking);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl font-bold text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <MessageSquare size={13} className="text-blue-600" />
                      <span>Need Help? Chat Support</span>
                    </button>
                    <a
                      href={`tel:${CORPORATE_LANDLINE_GATEWAY}`}
                      className="px-3 py-1.5 rounded-xl font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      title={`Helpline: ${CORPORATE_LANDLINE_GATEWAY}`}
                    >
                      <Phone size={13} className="text-emerald-600" />
                      <span>Call Support</span>
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
