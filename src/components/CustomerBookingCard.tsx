import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  User,
  Phone,
  MessageSquare,
  CreditCard,
  QrCode,
  ChevronDown,
  ChevronUp,
  Star,
  Download,
  HelpCircle,
  Compass,
  FileText,
  Sparkles,
  Navigation,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Booking, Service, UserProfile, PartnerProfile, SupportTicket } from "../types";
import { formatTime12Hour, formatBookingTime } from "../utils/formatTime";
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
      borderColor: "border-slate-100",
      activeGlow: "shadow-xs",
      iconGrad: "from-cyan-500 to-blue-600 shadow-cyan-500/25",
      badgeClass: "bg-cyan-100/90 text-cyan-900 border-cyan-200/90",
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
      borderColor: "border-slate-100",
      activeGlow: "shadow-xs",
      iconGrad: "from-teal-500 to-emerald-600 shadow-teal-500/25",
      badgeClass: "bg-teal-100/90 text-teal-900 border-teal-200/90",
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
      borderColor: "border-slate-100",
      activeGlow: "shadow-xs",
      iconGrad: "from-violet-500 to-indigo-600 shadow-violet-500/25",
      badgeClass: "bg-violet-100/90 text-violet-900 border-violet-200/90",
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
      borderColor: "border-slate-100",
      activeGlow: "shadow-xs",
      iconGrad: "from-amber-500 to-orange-600 shadow-amber-500/25",
      badgeClass: "bg-amber-100/90 text-amber-900 border-amber-200/90",
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
      borderColor: "border-slate-100",
      activeGlow: "shadow-xs",
      iconGrad: "from-emerald-500 to-teal-600 shadow-emerald-500/25",
      badgeClass: "bg-emerald-100/90 text-emerald-900 border-emerald-200/90",
      accentText: "text-emerald-700",
      pulseColor: "bg-emerald-500",
    };
  }

  // 6. Default / All other services (Plumbing, Cleaning, Pest, etc.)
  return {
    type: "default",
    name: "Home Service",
    cardGradient: "bg-white",
    borderColor: "border-slate-100",
    activeGlow: "shadow-xs",
    iconGrad: "from-[#002e6e] to-[#004bb5] shadow-blue-500/25",
    badgeClass: "bg-blue-100/90 text-[#002e6e] border-blue-200/90",
    accentText: "text-[#002e6e]",
    pulseColor: "bg-[#002e6e]",
  };
}

export const CustomerBookingCard: React.FC<CustomerBookingCardProps> = ({
  booking,
  service,
  partnerUser,
  partnerDetail,
  customerProfile,
  activeTicket,
  otpCode,
  isExpanded = false,
  onToggleExpand,
  onPayOnline,
  onPayCash,
  onScanQR,
  onBookAgain,
  onTrack,
  onCallPartner,
  onChatPartner,
  onDownloadInvoice,
  onSupport,
  onReschedule,
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
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

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

  const expanded = onToggleExpand ? isExpanded : internalExpanded;
  const toggleExpanded = onToggleExpand || (() => setInternalExpanded((prev) => !prev));

  const serviceName = service?.name || booking.serviceName || "Professional Service";
  const theme = getServiceCategoryTheme(serviceName, service?.categoryId || booking.serviceId);

  const rawStatus = (booking.status || "pending").toLowerCase();
  const isCompleted = ["completed", "finalized", "closed"].includes(rawStatus);
  const isAssigned = rawStatus === "assigned" || rawStatus === "confirmed";
  const isOnTheWay = rawStatus === "on_the_way";
  const isArrived = rawStatus === "arrived";
  const isInProgress = rawStatus === "in_progress";
  const isPaymentPending = rawStatus === "payment_pending";
  const isPending = ["pending", "pending_parts", "pending_acceptance", "pending_assignment"].includes(rawStatus);
  const isCancelled = rawStatus === "cancelled";

  const isActive = !isCompleted && !isCancelled;
  const hasPartner = !!(booking.partnerId || partnerUser);

  const isPaid = (booking.paymentStatus || "").toLowerCase() === "paid";

  // Formatted date and time (standardized to platform time slots)
  const getBookingDate = (b: Booking): Date | null => {
    if (b.scheduledAt) {
      if (typeof b.scheduledAt.toDate === "function") return b.scheduledAt.toDate();
      return new Date(b.scheduledAt);
    }
    if ((b as any).dateTime) return new Date((b as any).dateTime);
    if (b.createdAt) {
      if (typeof b.createdAt.toDate === "function") return b.createdAt.toDate();
      return new Date(b.createdAt);
    }
    return null;
  };

  const bookingDateObj = getBookingDate(booking);
  const dateDisplay = bookingDateObj
    ? bookingDateObj.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "Today";
  const timeDisplay = formatBookingTime(booking.scheduledAt) || "11:00 AM";

  // Check 30-day warranty for support
  let showSupportButton = false;
  if (isCompleted && bookingDateObj) {
    const daysDiff = Math.abs(Date.now() - bookingDateObj.getTime()) / (1000 * 60 * 60 * 24);
    showSupportButton = daysDiff <= 30;
  }

  // Stepper Stage Calculation
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`rounded-2xl border border-orange-100/90 hover:border-orange-300 bg-white p-4 sm:p-5 relative overflow-hidden transition-all duration-300 shadow-xs hover:shadow-md hover:shadow-orange-500/5`}
    >
      {/* Privacy Shield Routing Overlay */}
      {routingCallBookingId === booking.id && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-6 rounded-2xl">
          <div className="w-14 h-14 bg-emerald-50 border-2 border-emerald-500 rounded-full flex items-center justify-center mb-3 animate-bounce shadow-md">
            <Phone size={22} className="text-emerald-600" />
          </div>
          <h4 className="text-slate-900 font-black text-xs uppercase tracking-widest mb-1.5">
            Connecting via Secure Shield...
          </h4>
          <p className="text-slate-600 text-[11px] max-w-xs leading-relaxed font-medium">
            ZomIndia privacy shield active. Connecting safely to technician.
          </p>
        </div>
      )}

      {/* 1. Header Row: Service Icon + Service Name + Live Status Pill */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Service Icon with Glow */}
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
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.2 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                  AMC Plan
                </span>
              )}
            </div>
            <h4 className="font-black text-slate-900 text-sm sm:text-base leading-tight truncate uppercase tracking-tight mt-0.5">
              {serviceName}
            </h4>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="shrink-0">
          {isInProgress ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-800 border border-emerald-300 shadow-2xs inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              In Progress
            </span>
          ) : isOnTheWay ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-800 border border-sky-300 shadow-2xs inline-flex items-center gap-1.5 animate-pulse">
              <Navigation size={11} className="text-sky-600 shrink-0" />
              Pro En-Route
            </span>
          ) : isArrived ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-800 border border-indigo-300 shadow-2xs inline-flex items-center gap-1.5">
              <MapPin size={11} className="text-indigo-600 shrink-0" />
              Pro Arrived
            </span>
          ) : isAssigned ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-[#002e6e] border border-blue-300 shadow-2xs inline-flex items-center gap-1.5">
              <User size={11} className="text-[#002e6e] shrink-0" />
              Pro Assigned
            </span>
          ) : isPending ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-900 border border-amber-300 shadow-2xs inline-flex items-center gap-1.5">
              <Clock size={11} className="text-amber-600 shrink-0 animate-spin" />
              Assigning Pro
            </span>
          ) : isPaymentPending ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/15 text-orange-900 border border-orange-300 shadow-2xs inline-flex items-center gap-1.5 animate-pulse">
              <CreditCard size={11} className="text-orange-600 shrink-0" />
              Pay Invoice
            </span>
          ) : isCompleted ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-800 border border-emerald-300 shadow-2xs inline-flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
              Completed
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              {rawStatus.replace("_", " ")}
            </span>
          )}
        </div>
      </div>

      {/* 2. Middle Row: Chips (Date/Time, Service Area, Assigned Pro, Payment Status) */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3 relative z-10">
        {/* Date & Time Chip (12-hr AM/PM format) */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 border border-slate-200/80 text-slate-700 text-[11px] font-bold shadow-2xs">
          <Calendar size={12} className="text-slate-400 shrink-0" />
          <span>{dateDisplay}</span>
          <span className="text-slate-300">•</span>
          <Clock size={12} className="text-slate-400 shrink-0" />
          <span className="text-slate-900 font-extrabold">{timeDisplay}</span>
        </div>

        {/* Service Area Chip */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 border border-slate-200/80 text-slate-700 text-[11px] font-bold shadow-2xs max-w-[210px] truncate">
          <MapPin size={12} className="text-slate-400 shrink-0" />
          <span className="truncate">
            {booking.address ? booking.address.split(",")[0] : "Indore"}
          </span>
        </div>

        {/* Assigned Partner Chip (if assigned) */}
        {hasPartner && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold shadow-2xs">
            <User size={12} className="text-emerald-600 shrink-0" />
            <span className="truncate">
              Pro: {partnerUser?.displayName || (booking as any).partnerName || "Vikas C."}
            </span>
            <span className="text-[10px] font-black text-amber-600 flex items-center gap-0.5">
              ★ {partnerDetail?.rating || 4.9}
            </span>
          </div>
        )}

        {/* Payment Status & Dual Payment Switch */}
        {isPaid ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider shadow-2xs">
            <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
            Paid
          </span>
        ) : (
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black uppercase tracking-wider shadow-2xs">
              <AlertCircle size={11} className="text-rose-500 shrink-0" />
              Pay after service
            </span>
            {onPayOnline && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPayOnline(booking);
                }}
                className="bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                title="Pay now online via Native UPI / Dynamic QR"
              >
                <CreditCard size={12} className="shrink-0" />
                <span>Pay Now</span>
              </motion.button>
            )}
          </div>
        )}

        {/* Real-Time Active Warranty / Support Ticket Pulsing Badge */}
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
            <span>🛡️ Warranty Ticket #{activeTicket.id.slice(0, 6).toUpperCase()} - In Review</span>
          </button>
        )}

        {/* Real-Time Resolved Warranty Ticket Badge */}
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
            <span>🛡️ Ticket #{activeTicket.id.slice(0, 6).toUpperCase()} - Resolved</span>
          </button>
        )}
      </div>

      {/* 3. Action & Price Bar */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200/70 relative z-10 gap-2 flex-wrap">
        {/* Left: Total Amount */}
        <div className="flex flex-col justify-center">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none mb-0.5">
            {isPaid ? "Paid Total" : "Estimated Total"}
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900 font-display leading-tight">
            ₹{booking.totalPrice || 0}
          </span>
        </div>

        {/* Right: Consolidated Action Buttons (Single View Details & OTP or Book Again) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Book Again Button */}
          {isCompleted && onBookAgain && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={(e) => {
                e.stopPropagation();
                if (service) onBookAgain(service);
              }}
              className="bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw size={12} className="shrink-0" />
              <span>Book Again</span>
            </motion.button>
          )}

          {/* Primary View Details & OTP Action Button */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
              expanded
                ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                : isActive
                ? "bg-gradient-to-r from-slate-900 via-orange-950 to-slate-900 text-white hover:from-orange-600 hover:to-rose-600 border border-orange-500/20 shadow-orange-500/10"
                : "bg-white border border-slate-200 text-slate-800 hover:bg-slate-50"
            }`}
          >
            {isActive ? (
              <>
                <ShieldCheck size={13} className="shrink-0 text-orange-400" />
                <span>{expanded ? "Hide Details" : "View Details & OTP"}</span>
              </>
            ) : (
              <>
                <span>{expanded ? "Hide Details" : "View Details"}</span>
              </>
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

      {/* 4. Animated Expandable Drawer (Details on Tap) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.32, ease: "easeInOut" }}
            className="overflow-hidden relative z-10"
          >
            <div className="pt-4 mt-3 border-t border-slate-200/70 space-y-4">
              {/* A. Security OTP Box (for Active Bookings) */}
              {otpCode && !isCompleted && (
                <div className="p-4 bg-white/95 rounded-2xl border border-orange-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-center sm:text-left">
                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-200 px-3 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                      <ShieldCheck size={12} className="text-orange-600" /> Security Verification OTP
                    </span>
                    <p className="text-xs text-slate-600 font-bold mt-1">
                      Share this 4-digit token with the technician <span className="text-orange-700">ONLY after they arrive</span>.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {otpCode.toString().split("").map((digit, idx) => (
                      <div
                        key={idx}
                        className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center text-lg font-black font-mono shadow-sm"
                      >
                        {digit}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* B. Stepper Progress Pipeline */}
              <div className="bg-white/95 p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
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
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    className="absolute top-[18px] left-5 h-[3px] bg-gradient-to-r from-[#002e6e] to-[#22c55e] rounded-full z-0"
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
                                ? "bg-[#22c55e] border-[#22c55e] text-white shadow-sm"
                                : isCurrentStep
                                ? "bg-[#002e6e] border-[#002e6e] text-white ring-4 ring-[#002e6e]/15 shadow-md scale-105"
                                : "bg-white border-slate-200 text-slate-300"
                            }`}
                          >
                            <StageIcon size={15} />
                          </div>
                          <span
                            className={`text-[9px] font-black tracking-tight uppercase mt-1.5 text-center max-w-[65px] leading-tight ${
                              isPastStep
                                ? "text-emerald-700"
                                : isCurrentStep
                                ? "text-[#002e6e]"
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

              {/* C. Assigned Partner Card & Direct Actions (if partner assigned) */}
              {hasPartner && (
                <div className="p-4 bg-white/95 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
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
                          {partnerUser?.displayName || (booking as any).partnerName || "Vikas Chopra"}
                        </span>
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-500 font-bold">
                        Verified Expert Technician • ★ {partnerDetail?.rating || 4.9} ({partnerDetail?.reviewCount || 42} jobs)
                      </p>
                    </div>
                  </div>

                  {/* Call & Chat Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    {partnerUser && onCallPartner && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onChatPartner(booking);
                        }}
                        className="px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#002e6e] border border-sky-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                        title="Open direct live chat"
                      >
                        <MessageSquare size={13} className="text-[#002e6e]" />
                        <span>Chat</span>
                      </motion.button>
                    )}
                  </div>
                </div>
              )}

              {/* D. Full Address & Notes */}
              <div className="p-3.5 bg-white/95 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5 text-xs">
                <div className="flex items-start gap-2 text-slate-700">
                  <MapPin size={14} className="text-[#002e6e] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black text-slate-900 block uppercase text-[10px] tracking-wider">
                      Service Address
                    </span>
                    <p className="font-medium text-slate-700">{booking.address || "Indore, Madhya Pradesh"}</p>
                  </div>
                </div>
                {booking.notes && (
                  <div className="pt-2 border-t border-slate-100 text-slate-600 text-[11px]">
                    <span className="font-bold text-slate-800">Special Notes:</span> {booking.notes}
                  </div>
                )}
              </div>

              {/* E. Service Protocol Checklist */}
              <div className="p-3.5 bg-white/95 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#002e6e] flex items-center gap-1.5">
                    <FileText size={13} /> Service Tasks & Protocol
                  </span>
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-mono">
                    Progress: {booking.progressPercentage || 0}%
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
                    const isDone = booking.completedTasks?.includes(task);
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/80 border border-slate-200/60 text-xs"
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

              {/* F. Live Tracking Map Toggle (if en-route or in-progress) */}
              {hasPartner && (isOnTheWay || isArrived || isInProgress) && (
                <div className="space-y-2">
                  <button
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
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* G. Completed Feedback & Rating Section */}
              {isCompleted && booking.paymentStatus === "paid" && (
                <div className="p-4 bg-sky-50/70 rounded-2xl border border-sky-200/80 space-y-3">
                  {isReviewSubmitted ? (
                    <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span className="text-xs font-bold">Review successfully captured. Thank you!</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-[#002e6e] flex items-center gap-1.5">
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
                            placeholder="Write a quick comment about the expert's work..."
                            rows={2}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#002e6e] font-medium"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={isReviewSubmitting || inlineRating === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSubmitReview) onSubmitReview(booking);
                              }}
                              className="text-xs font-black uppercase tracking-wider text-white bg-[#002e6e] hover:bg-[#001f4d] disabled:bg-slate-300 disabled:text-slate-500 px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
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
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isGeneratingInvoice}
                    onClick={handleDownloadInvoice}
                    className="text-[11px] font-black uppercase tracking-wider text-[#002e6e] flex items-center gap-1.5 hover:bg-sky-100 bg-sky-50 px-3.5 py-2 rounded-xl border border-sky-200 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isGeneratingInvoice ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-[#002e6e] border-t-transparent rounded-full animate-spin shrink-0" />
                        <span>Generating Invoice...</span>
                      </>
                    ) : (
                      <>
                        <Download size={13} className="shrink-0" />
                        <span>Download Invoice PDF</span>
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
                          <span>🛡️ Ticket #{activeTicket.id.slice(0, 6).toUpperCase()} - In Review</span>
                        </>
                      ) : activeTicket && activeTicket.status === "resolved" ? (
                        <>
                          <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                          <span>🛡️ Ticket #{activeTicket.id.slice(0, 6).toUpperCase()} - Resolved</span>
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

              {/* I. Collapse Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded();
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-[11px] uppercase tracking-wider rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <ChevronUp size={14} />
                <span>Hide Details</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
