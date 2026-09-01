import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Calendar,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Zap,
  User,
  Phone,
  MessageSquare,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Star,
  Download,
  HelpCircle,
  Compass,
  FileText,
  RotateCcw,
  ShieldAlert,
  Navigation,
  XCircle,
  X,
  Lock,
} from "lucide-react";
import { Booking, Service, UserProfile, PartnerProfile, SupportTicket } from "../types";
import { formatBookingTime } from "../utils/formatTime";
import { generateInvoicePDF } from "../utils/generateInvoicePDF";
import PartnerTrackingMap from "./PartnerTrackingMap";
import LogoIcon from "../assets/images/logo-icon.png";

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
 * Category-specific styling themes
 */
export function getServiceCategoryTheme(
  serviceName: string = "",
  categoryId: string = "",
) {
  const s = `${serviceName} ${categoryId}`.toLowerCase();

  // 1. AC Service / Cooling
  if (
    s.includes("ac ") ||
    s.includes(" ac") ||
    s.includes("air conditioner") ||
    s.includes("cooling") ||
    s.includes("split ac") ||
    s.includes("window ac") ||
    s.includes("duct")
  ) {
    return {
      type: "ac",
      name: "AC Service",
      cardGradient: "bg-white",
      borderColor: "border-slate-150",
      iconGrad: "from-cyan-500 to-blue-600 shadow-cyan-500/25",
      badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200",
      accentText: "text-cyan-700",
      pulseColor: "bg-cyan-500",
    };
  }

  // 2. RO Water Purifier
  if (
    s.includes("ro") ||
    s.includes("water purifier") ||
    s.includes("purifier") ||
    s.includes("filter") ||
    s.includes("aquaguard") ||
    s.includes("kent")
  ) {
    return {
      type: "ro",
      name: "Water Purifier",
      cardGradient: "bg-white",
      borderColor: "border-slate-150",
      iconGrad: "from-teal-500 to-emerald-600 shadow-teal-500/25",
      badgeClass: "bg-teal-50 text-teal-800 border-teal-200",
      accentText: "text-teal-700",
      pulseColor: "bg-teal-500",
    };
  }

  // 3. Refrigerator / Deep Freezer
  if (
    s.includes("refrigerator") ||
    s.includes("fridge") ||
    s.includes("freezer")
  ) {
    return {
      type: "fridge",
      name: "Refrigerator",
      cardGradient: "bg-white",
      borderColor: "border-slate-150",
      iconGrad: "from-violet-500 to-indigo-600 shadow-violet-500/25",
      badgeClass: "bg-violet-50 text-violet-800 border-violet-200",
      accentText: "text-violet-700",
      pulseColor: "bg-violet-500",
    };
  }

  // 4. TV / Electrical / Wiring / Geyser
  if (
    s.includes("tv") ||
    s.includes("television") ||
    s.includes("electrical") ||
    s.includes("electrician") ||
    s.includes("wiring") ||
    s.includes("geyser") ||
    s.includes("inverter") ||
    s.includes("switch") ||
    s.includes("fan") ||
    s.includes("light")
  ) {
    return {
      type: "electrical",
      name: "Electrical & TV",
      cardGradient: "bg-white",
      borderColor: "border-slate-150",
      iconGrad: "from-amber-500 to-orange-600 shadow-amber-500/25",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      accentText: "text-amber-700",
      pulseColor: "bg-amber-500",
    };
  }

  // 5. Washing Machine / Laundry
  if (
    s.includes("washing") ||
    s.includes("laundry") ||
    s.includes("dryer")
  ) {
    return {
      type: "washing",
      name: "Washing Machine",
      cardGradient: "bg-white",
      borderColor: "border-slate-150",
      iconGrad: "from-emerald-500 to-teal-600 shadow-emerald-500/25",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      accentText: "text-emerald-700",
      pulseColor: "bg-emerald-500",
    };
  }

  // 6. Default / All other services
  return {
    type: "default",
    name: "Home Service",
    cardGradient: "bg-white",
    borderColor: "border-slate-150",
    iconGrad: "from-[#002e6e] to-[#004bb5] shadow-blue-500/25",
    badgeClass: "bg-blue-50 text-[#002e6e] border-blue-200",
    accentText: "text-[#002e6e]",
    pulseColor: "bg-[#002e6e]",
  };
}

/**
 * Formats scheduledAt timestamp into a human-friendly string:
 * e.g., "Today, 02:00 PM - 04:00 PM" or "Wed, 26 Aug • 02:00 PM - 04:00 PM"
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

  // Build slot range e.g. "02:00 PM - 04:00 PM"
  const buildSlotRange = (startSlot: string): string => {
    const match = startSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return startSlot;
    let hour = parseInt(match[1], 10);
    const min = match[2];
    const period = match[3].toUpperCase();
    let endHour = hour + 2;
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
 * Format payment method for display
 */
function formatPaymentMethodName(method?: string): string {
  if (!method) return "Online";
  const m = method.toLowerCase();
  if (m === "phonepe" || m === "phonepe_qr") return "PhonePe / UPI";
  if (m === "upi") return "UPI";
  if (m === "cash") return "Cash on Delivery";
  if (m === "wallet") return "ZomIndia Wallet";
  if (m === "amc_pass" || m === "amc") return "AMC Annual Pass";
  if (m === "card" || m === "cards") return "Credit / Debit Card";
  if (m === "pay_after_service") return "Pay After Service";
  return method.charAt(0).toUpperCase() + method.slice(1);
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
  isPast = false,
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
  const [showLiveMap, setShowLiveMap] = useState(false);
  const [isFullscreenTrackingOpen, setIsFullscreenTrackingOpen] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  const expanded = onToggleExpand ? isExpanded : internalExpanded;
  const toggleExpanded = onToggleExpand || (() => setInternalExpanded((prev) => !prev));

  const serviceName = service?.name || booking.serviceName || "Professional Service";
  const theme = getServiceCategoryTheme(serviceName, service?.categoryId || booking.serviceId);

  // Status breakdown
  const rawStatus = (booking.status || "pending").toLowerCase();
  const isCompleted = ["completed", "finalized", "closed"].includes(rawStatus);
  const isCancelled = rawStatus === "cancelled";
  const isInProgress = rawStatus === "in_progress";
  const isArrived = rawStatus === "arrived";
  const isOnTheWay =
    rawStatus === "on_the_way" ||
    rawStatus === "in_transit" ||
    rawStatus === "pro_en_route";
  const isAssigned = rawStatus === "assigned" || rawStatus === "confirmed";
  const isPaymentPending = rawStatus === "payment_pending";
  const isPending = [
    "pending",
    "pending_acceptance",
    "pending_assignment",
    "pending_parts",
    "pending_checkout",
    "confirmed_pay_after_service",
  ].includes(rawStatus);

  const isActive = !isCompleted && !isCancelled;
  const hasPartner = !!(booking.partnerId || partnerUser);

  // Dynamic OTP calculation
  const otp = propOtpCode || booking.serviceOtp || booking.startOTP;
  // OTP box rendered ONLY when status is between assigned, confirmed, on_the_way, and arrived, and not yet verified
  const showOtpBox =
    Boolean(otp) &&
    !booking.otpVerified &&
    !isCompleted &&
    !isCancelled &&
    (isAssigned || isOnTheWay || isArrived);

  // Payment status resolution: strict resolution guard
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
    (booking.paymentMethod === "wallet" &&
      (booking.walletDeductAmount ?? 0) > 0) ||
    hasValidOnlineTxn;

  const isPayAfterService = !isPaid;
  const isOnlineUnpaid = false; // Always show Pay on Completion + Pay Online Instead if not paid

  // Formatted schedule info
  const scheduleInfo = formatBookingSchedule(booking.scheduledAt);

  // Stepper pipeline stages
  const stages = [
    { label: "Confirmed", icon: Clock },
    { label: "Assigned", icon: User },
    { label: "On The Way", icon: Navigation },
    { label: "In Progress", icon: Zap },
    { label: "Completed", icon: CheckCircle2 },
  ];

  const currentStageIndex = (() => {
    if (isPending) return 0;
    if (isAssigned) return 1;
    if (isOnTheWay || isArrived) return 2;
    if (isInProgress || isPaymentPending) return 3;
    if (isCompleted) return 4;
    return 0;
  })();

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
        if (success) {
          if ((window as any).__showToast) {
            (window as any).__showToast("Invoice downloaded successfully!");
          }
        } else {
          if ((window as any).__showToast) {
            (window as any).__showToast("Failed to generate invoice. Please try again.");
          }
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/90 hover:border-blue-300 bg-white p-4 sm:p-5 relative overflow-hidden transition-all duration-300 shadow-xs hover:shadow-md"
    >
      {/* Privacy Shield Active Call Routing Overlay */}
      {routingCallBookingId === booking.id && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-6 rounded-2xl">
          <div className="w-14 h-14 bg-emerald-50 border-2 border-emerald-500 rounded-full flex items-center justify-center mb-3 animate-bounce shadow-md">
            <Phone size={22} className="text-emerald-600" />
          </div>
          <h4 className="text-slate-900 font-black text-xs uppercase tracking-widest mb-1.5">
            Connecting via Secure Shield...
          </h4>
          <p className="text-slate-600 text-[11px] max-w-xs leading-relaxed font-medium">
            Privacy shield active. Connecting safely to your assigned technician.
          </p>
        </div>
      )}

      {/* 1. Header Row: Service Icon + Service Name + Real-Time Lifecycle Status Badge */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Service Icon with Theme Gradient */}
          <div
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl shrink-0 overflow-hidden bg-gradient-to-br ${theme.iconGrad} p-0.5 flex items-center justify-center text-white shadow-md relative group`}
          >
            {service?.imageURL ? (
              <img
                src={service.imageURL}
                alt={serviceName}
                className="w-full h-full object-cover rounded-[10px]"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            ) : (
              <Zap size={20} className="text-white drop-shadow" />
            )}
          </div>

          {/* Service Title & ID */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider">
                #{booking.id.slice(-6).toUpperCase()}
              </span>
              {booking.isAmcBooking && (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                  AMC Plan
                </span>
              )}
            </div>
            <h4 className="font-black text-slate-900 text-sm sm:text-base leading-tight truncate uppercase tracking-tight mt-0.5">
              {serviceName}
            </h4>
          </div>
        </div>

        {/* Real-Time Lifecycle Status Badge */}
        <div className="shrink-0">
          {isPending && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs inline-flex items-center gap-1.5 animate-pulse">
              <Clock size={11} className="text-amber-600 shrink-0 animate-spin" />
              Assigning Pro
            </span>
          )}
          {isAssigned && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-[#2563EB] border border-blue-300 shadow-2xs inline-flex items-center gap-1.5">
              <User size={11} className="text-[#2563EB] shrink-0" />
              Pro Assigned
            </span>
          )}
          {isOnTheWay && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-300 shadow-2xs inline-flex items-center gap-1.5 animate-pulse">
              <Navigation size={11} className="text-sky-600 shrink-0" />
              Pro En-Route
            </span>
          )}
          {isArrived && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-800 border border-indigo-300 shadow-2xs inline-flex items-center gap-1.5">
              <MapPin size={11} className="text-indigo-600 shrink-0" />
              Pro Arrived at Location
            </span>
          )}
          {isInProgress && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Job In Progress
            </span>
          )}
          {isCompleted && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs inline-flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
              Service Completed
            </span>
          )}
          {isCancelled && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs inline-flex items-center gap-1.5">
              <XCircle size={11} className="text-rose-600 shrink-0" />
              Cancelled
            </span>
          )}
          {isPaymentPending && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-900 border border-orange-300 shadow-2xs inline-flex items-center gap-1.5 animate-pulse">
              <CreditCard size={11} className="text-orange-600 shrink-0" />
              Pay Invoice
            </span>
          )}
        </div>
      </div>

      {/* 2. Middle Row: Chips (Date & Time Range, Location Area, Support Badge) */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3 relative z-10">
        {/* Scheduled Date & Time Slot Chip */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 text-[11px] font-bold shadow-2xs">
          <Calendar size={12} className="text-blue-600 shrink-0" />
          <span>{scheduleInfo.dateLabel}</span>
          <span className="text-slate-300">•</span>
          <Clock size={12} className="text-slate-400 shrink-0" />
          <span className="text-slate-900 font-extrabold">{scheduleInfo.timeSlot}</span>
        </div>

        {/* Service Area Chip */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 text-[11px] font-bold shadow-2xs max-w-[220px] truncate">
          <MapPin size={12} className="text-slate-400 shrink-0" />
          <span className="truncate">
            {booking.address ? booking.address.split(",")[0] : "Indore"}
          </span>
        </div>

        {/* Assigned Partner Chip (if assigned) */}
        {hasPartner && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-bold shadow-2xs">
            <User size={12} className="text-blue-600 shrink-0" />
            <span className="truncate">
              Pro: {partnerUser?.displayName || (booking as any).partnerName || "Assigned Pro"}
            </span>
            <span className="text-[10px] font-black text-amber-600 flex items-center gap-0.5 ml-0.5">
              ★ {(partnerDetail?.rating || 4.9).toFixed(1)}
            </span>
          </div>
        )}

        {/* Real-Time Active Support/Warranty Ticket Badge */}
        {activeTicket && (activeTicket.status === "open" || activeTicket.status === "in_progress") && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onSupport) onSupport(booking.id);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-orange-50 border border-orange-300 text-orange-900 text-[10px] font-black uppercase tracking-wider shadow-2xs animate-pulse cursor-pointer hover:bg-orange-100"
          >
            <ShieldAlert size={12} className="text-orange-600 shrink-0" />
            <span>Warranty #{activeTicket.id.slice(0, 6).toUpperCase()} - In Review</span>
          </button>
        )}

        {activeTicket && activeTicket.status === "resolved" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onSupport) onSupport(booking.id);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-black uppercase tracking-wider shadow-2xs cursor-pointer hover:bg-emerald-100"
          >
            <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
            <span>Ticket #{activeTicket.id.slice(0, 6).toUpperCase()} - Resolved</span>
          </button>
        )}
      </div>

      {/* 2.5. Embedded Live Tracking Mini-Map (Zomato/Uber Style for PRO EN-ROUTE) */}
      {hasPartner && isOnTheWay && (
        <div className="mt-3 relative z-10">
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
            variant="mini"
            heightClassName="h-36 sm:h-44"
            onExpand={() => setIsFullscreenTrackingOpen(true)}
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
        </div>
      )}

      {/* 3. Single Dynamic Payment & Action Bar (Eliminates Dual-Payment Button Conflict) */}
      <div className="flex items-center justify-between pt-3.5 mt-3.5 border-t border-slate-200/80 relative z-10 gap-3 flex-wrap">
        {/* Left: Total & Context-Aware Payment Indicator */}
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none block mb-0.5">
              {isPaid ? "Total Paid" : "Total Payable"}
            </span>
            <span className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              ₹{booking.totalPrice || 0}
            </span>
          </div>

          {/* Context-Aware Dynamic Payment Badge / Indicator (Single Source of Truth) */}
          <div className="flex items-center gap-2">
            {/* Scenario A (Paid): Verified Green Badge & HIDE all payment trigger buttons */}
            {isPaid && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-black uppercase tracking-wider shadow-2xs">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>
                  Paid via{" "}
                  {booking.paymentMethod === "wallet"
                    ? "Wallet"
                    : isAmc
                    ? "AMC Plan"
                    : booking.onlinePaymentProvider || "Online / UPI"}
                </span>
              </span>
            )}

            {/* Scenario B (Pay After Service / Cash): Clear indicator + subtle optional outline button: Pay Online Instead */}
            {isPayAfterService && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold shadow-2xs">
                  <span>💵 Cash / UPI on Completion (₹{booking.totalPrice || 0})</span>
                </span>
                {onPayOnline && !isCompleted && !isCancelled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPayOnline(booking);
                    }}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Pay Online Instead
                  </button>
                )}
              </div>
            )}

            {/* Scenario C (Unpaid / Online Pending): Exactly ONE prominent Royal Blue button */}
            {isOnlineUnpaid && !isCompleted && !isCancelled && onPayOnline && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPayOnline(booking);
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black tracking-wide px-4 py-2 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:brightness-105 active:scale-[0.98] flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
              >
                <Lock size={12} className="shrink-0" />
                <span>Pay ₹{booking.totalPrice || 0} Now</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Right: Consolidated Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Book Again Button for Completed Jobs */}
          {isCompleted && onBookAgain && service && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBookAgain(service);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw size={12} className="shrink-0" />
              <span>Book Again</span>
            </motion.button>
          )}

          {/* Primary View Details / OTP Toggle */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              expanded
                ? "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200"
                : "bg-white border border-slate-200 text-slate-800 hover:bg-slate-50"
            }`}
          >
            {showOtpBox ? (
              <>
                <ShieldCheck size={13} className="shrink-0 text-blue-600" />
                <span>{expanded ? "Hide Details" : "View Details & OTP"}</span>
              </>
            ) : (
              <span>{expanded ? "Hide Details" : "View Details"}</span>
            )}
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0"
            >
              <ChevronDown size={13} />
            </motion.span>
          </motion.button>
        </div>
      </div>

      {/* 4. Animated Expandable Drawer (Details & Real-Time Modules on Tap) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden relative z-10"
          >
            <div className="pt-4 mt-3 border-t border-slate-200/80 space-y-4">
              {/* A. Dynamic 4-Digit Security OTP Block (ONLY between 'assigned' and 'arrived', hidden once verified or in_progress/completed) */}
              {showOtpBox && otp && (
                <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-center sm:text-left">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-white border border-blue-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                      <ShieldCheck size={12} className="text-blue-600" /> 4-Digit Security Verification PIN
                    </span>
                    <p className="text-xs text-slate-700 font-bold mt-1.5">
                      Share this OTP with your technician <span className="text-blue-800 font-black">ONLY when they arrive</span> at your location.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {otp.toString().split("").map((digit, idx) => (
                      <div
                        key={idx}
                        className="w-11 h-12 bg-white text-blue-700 border-2 border-blue-600 rounded-xl flex items-center justify-center text-xl font-black font-mono shadow-sm"
                      >
                        {digit}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* In-Progress OTP Verified Notification */}
              {isInProgress && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Security OTP Verified • Technician is actively performing your service.</span>
                </div>
              )}

              {/* B. Stepper Progress Pipeline */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="relative w-full max-w-xl mx-auto py-1">
                  {/* Progress Line Track */}
                  <div className="absolute top-[18px] left-5 right-5 h-[3px] bg-slate-200 rounded-full z-0" />
                  {/* Animated Progress Line */}
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{
                      width: isCompleted
                        ? "100%"
                        : `${(currentStageIndex / (stages.length - 1)) * 100}%`,
                    }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute top-[18px] left-5 h-[3px] bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 rounded-full z-0"
                  />

                  <div className="flex items-center justify-between relative z-10">
                    {stages.map((stage, idx) => {
                      const isPastStep = idx <= currentStageIndex || isCompleted;
                      const isCurrentStep = idx === currentStageIndex && !isCompleted;
                      const StageIcon = stage.icon;

                      return (
                        <div key={idx} className="flex flex-col items-center">
                          <div
                            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                              isPastStep
                                ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
                                : isCurrentStep
                                ? "bg-[#2563EB] border-[#2563EB] text-white ring-4 ring-blue-500/20 shadow-md scale-105"
                                : "bg-white border-slate-300 text-slate-300"
                            }`}
                          >
                            <StageIcon size={15} />
                          </div>
                          <span
                            className={`text-[9px] font-black tracking-tight uppercase mt-1.5 text-center max-w-[65px] leading-tight ${
                              isPastStep
                                ? "text-emerald-700"
                                : isCurrentStep
                                ? "text-blue-700"
                                : "text-slate-400"
                            }`}
                          >
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* C. Dynamic Partner Details Tile (Rendered if booking.partnerId exists) */}
              {hasPartner && (
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-emerald-500 bg-slate-100 shadow-2xs">
                      <img
                        src={
                          partnerUser?.photoURL ||
                          (partnerDetail as any)?.profilePhoto ||
                          LogoIcon
                        }
                        alt="Partner"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900 text-sm">
                          {partnerUser?.displayName || (booking as any).partnerName || "Expert Technician"}
                        </span>
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-black uppercase tracking-wider">
                          <CheckCircle2 size={10} className="text-emerald-600 shrink-0" /> Verified Pro
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                        ★ {(partnerDetail?.rating || 4.9).toFixed(1)} Rating • {partnerDetail?.reviewCount || 38} completed jobs
                      </p>
                    </div>
                  </div>

                  {/* Direct Call & Chat Buttons */}
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    {partnerUser && onCallPartner && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCallPartner(partnerUser, booking);
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                        title="Secure privacy phone call"
                      >
                        <Phone size={13} className="text-emerald-600" />
                        <span>Call Pro</span>
                      </motion.button>
                    )}
                    {onChatPartner && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChatPartner(booking);
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                        title="Open direct live chat"
                      >
                        <MessageSquare size={13} className="text-blue-600" />
                        <span>Chat</span>
                      </motion.button>
                    )}
                  </div>
                </div>
              )}

              {/* D. Full Address & Notes */}
              <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5 text-xs">
                <div className="flex items-start gap-2 text-slate-700">
                  <MapPin size={14} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black text-slate-900 block uppercase text-[10px] tracking-wider">
                      Service Address
                    </span>
                    <p className="font-medium text-slate-700">{booking.address || "Indore, Madhya Pradesh"}</p>
                  </div>
                </div>
                {booking.notes && (
                  <div className="pt-2 border-t border-slate-200/60 text-slate-600 text-[11px]">
                    <span className="font-bold text-slate-800">Special Instructions:</span> {booking.notes}
                  </div>
                )}
              </div>

              {/* E. Service Protocol Checklist */}
              <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <FileText size={13} className="text-blue-600" /> Service Protocol Checklist
                  </span>
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-mono">
                    Progress: {booking.progressPercentage || (isCompleted ? 100 : 0)}%
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(booking.checklist?.length
                    ? booking.checklist
                    : service?.predefinedTasks?.length
                    ? service.predefinedTasks
                    : [
                        "Diagnostic inspection & health check",
                        "Perform professional repair/deep clean",
                        "Component testing & calibration",
                        "Final quality check & work area cleanup",
                      ]
                  ).map((task, idx) => {
                    const isDone = isCompleted || booking.completedTasks?.includes(task);
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/70 text-xs"
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                            isDone
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-slate-300 text-transparent"
                          }`}
                        >
                          <CheckCircle2 size={11} className="text-white" />
                        </div>
                        <span
                          className={`text-[11px] font-medium leading-tight truncate ${
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

              {/* F. Live Tracking Map Toggle (if en-route, arrived, or in-progress) */}
              {hasPartner && (isOnTheWay || isArrived || isInProgress) && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowLiveMap((prev) => !prev)}
                    className="w-full text-xs font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Compass size={13} />
                    <span>{showLiveMap ? "Hide Live Tracking Map" : "View Live Tracking Map"}</span>
                  </button>

                  <AnimatePresence>
                    {showLiveMap && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <PartnerTrackingMap
                          partnerId={booking.partnerId!}
                          destinationAddress={booking.address}
                          bookingLocation={booking.lat && booking.lng ? { lat: booking.lat, lng: booking.lng } : undefined}
                          bookingId={booking.id}
                          serviceName={booking.serviceName}
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
                          heightClassName="h-[340px] sm:h-[380px]"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* G. Completed Feedback & Rating Section */}
              {isCompleted && (
                <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-200/70 space-y-3">
                  {isReviewSubmitted ? (
                    <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span className="text-xs font-bold">Review captured. Thank you for rating your expert!</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                          <Star size={13} className="text-amber-500 fill-amber-500" /> Share Your Rating & Experience:
                        </span>
                        {onSkipReview && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSkipReview(booking.id);
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200 cursor-pointer"
                          >
                            Maybe Later
                          </button>
                        )}
                      </div>

                      {/* 5 Stars */}
                      <div className="flex gap-2 items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onRatingChange) onRatingChange(booking.id, star);
                            }}
                            className="transition-transform hover:scale-115 active:scale-95 cursor-pointer"
                          >
                            <Star
                              size={22}
                              fill={star <= inlineRating ? "currentColor" : "none"}
                              className={
                                star <= inlineRating
                                  ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]"
                                  : "text-slate-300 hover:text-amber-300"
                              }
                            />
                          </button>
                        ))}
                      </div>

                      {/* Comment Input */}
                      {inlineRating > 0 && onCommentChange && (
                        <div className="space-y-1.5">
                          <textarea
                            value={inlineComment}
                            onChange={(e) => onCommentChange(booking.id, e.target.value)}
                            placeholder="Write a quick note about your experience..."
                            rows={2}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 font-medium"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={isReviewSubmitting || inlineRating === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSubmitReview) onSubmitReview(booking);
                              }}
                              className="text-xs font-black uppercase tracking-wider text-white bg-[#2563EB] hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                            >
                              {isReviewSubmitting ? "Submitting..." : "Submit Review"}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* H. Invoice & Support Buttons (for completed bookings) */}
              {isCompleted && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                  <button
                    type="button"
                    disabled={isGeneratingInvoice}
                    onClick={handleDownloadInvoice}
                    className="text-[11px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5 hover:bg-blue-100 bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-200 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isGeneratingInvoice ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                        <span>Generating Invoice...</span>
                      </>
                    ) : (
                      <>
                        <Download size={13} className="shrink-0" />
                        <span>Download Invoice</span>
                      </>
                    )}
                  </button>

                  {onSupport && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSupport(booking.id);
                      }}
                      className={`text-[11px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        activeTicket && (activeTicket.status === "open" || activeTicket.status === "in_progress")
                          ? "text-amber-900 bg-amber-100 hover:bg-amber-200/90 border-amber-300 animate-pulse ring-2 ring-amber-400/30"
                          : activeTicket && activeTicket.status === "resolved"
                          ? "text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border-emerald-300"
                          : "text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200"
                      }`}
                    >
                      {activeTicket && (activeTicket.status === "open" || activeTicket.status === "in_progress") ? (
                        <>
                          <ShieldAlert size={13} className="text-amber-600 shrink-0" />
                          <span>Warranty #{activeTicket.id.slice(0, 6).toUpperCase()} - In Review</span>
                        </>
                      ) : activeTicket && activeTicket.status === "resolved" ? (
                        <>
                          <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                          <span>Ticket #{activeTicket.id.slice(0, 6).toUpperCase()} - Resolved</span>
                        </>
                      ) : (
                        <>
                          <HelpCircle size={13} className="shrink-0" />
                          <span>Warranty & Support</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* I. Collapse Drawer Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded();
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-[11px] uppercase tracking-wider rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <ChevronUp size={14} />
                <span>Hide Details</span>
              </button>
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
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreenTrackingOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 80, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 80, scale: 0.96 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
                    <Navigation size={17} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                      Live Navigation • {serviceName}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                      <span>Technician is actively en-route to your doorstep</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFullscreenTrackingOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                  title="Close Live Navigation"
                >
                  <X size={17} />
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
                  heightClassName="h-[380px] sm:h-[430px]"
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
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 shadow-2xs">
                    <MapPin size={15} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Service Destination
                      </span>
                      <span className="font-bold text-slate-800 line-clamp-2 mt-0.5">
                        {booking.address || "Indore, Madhya Pradesh"}
                      </span>
                    </div>
                  </div>

                  {showOtpBox && otp && (
                    <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200/80 flex items-center justify-between gap-2 shadow-2xs">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block">
                          Security Verification PIN
                        </span>
                        <span className="text-[11px] font-medium text-slate-600">
                          Share with pro on arrival
                        </span>
                      </div>
                      <span className="text-lg font-black font-mono tracking-widest text-blue-700 bg-white px-2.5 py-1 rounded-xl border border-blue-300 shadow-2xs">
                        {otp}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
