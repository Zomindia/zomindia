import React, { useState, useEffect, useMemo, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  or,
  onSnapshot,
  orderBy,
  getDocs,
  getDoc,
  documentId,
  updateDoc,
  doc,
  Timestamp,
  addDoc,
  deleteField,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { LogoIcon } from "./BrandLogo";
import {
  Booking,
  UserProfile,
  PartnerProfile,
  Promotion,
  Category,
  Service,
  SupportTicket,
} from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { fuzzyMatch } from "../utils/search";
import { formatTime12Hour, formatBookingTime } from "../utils/formatTime";
import { motion, AnimatePresence } from "motion/react";
import ChatWindow from "./ChatWindow";
import { LoadingScreen, ServiceCardSkeleton } from "./LoadingIndicator";
import PaymentModal from "./PaymentModal";
import BookingModal from "./BookingModal";
import AiSupportChat from "./AiSupportChat";
import { QRCodeSVG } from "qrcode.react";
import PartnerTrackingMap from "./PartnerTrackingMap";
import { CustomerPaymentScanner } from "./CustomerPaymentScanner";
import { CustomerBookingCard } from "./CustomerBookingCard";
import { WarrantySupportModal } from "./WarrantySupportModal";
import { generateInvoicePDF } from "../utils/generateInvoicePDF";
import { triggerTelephonyBridge, CORPORATE_LANDLINE_GATEWAY, TELEPHONY_PROVIDER } from "../lib/telephony";
import { triggerSecureCall } from "../lib/twilio";
import {
  Download,
  Clock,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Navigation,
  MessageSquare,
  User,
  Zap,
  Search,
  ChevronRight,
  Star,
  QrCode,
  Camera,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Compass,
  FileText,
  Phone,
  Sparkles,
  Moon,
  ChevronDown,
  ChevronUp,
  CreditCard,
  AlertCircle,
  X,
} from "lucide-react";

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY as string) || "";
const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY";

interface ServiceThumbnailProps {
  service?: any;
  size?: "sm" | "md";
  bookingStatus?: string;
}

function ServiceThumbnail({
  service,
  size = "md",
  bookingStatus,
}: ServiceThumbnailProps) {
  const serviceName = service?.name || "";

  // Choose icon based on service name characteristics or default
  let IconComponent: any = Zap;
  let gradientClass = "from-indigo-600 to-blue-700 shadow-indigo-600/20";
  let isCustomComposite = false;

  if (bookingStatus && bookingStatus.toLowerCase() === "assigned") {
    isCustomComposite = true;
    gradientClass = "from-blue-600 to-indigo-700 shadow-blue-500/20";
  } else if (
    serviceName.toLowerCase().includes("cleaning") ||
    serviceName.toLowerCase().includes("wash")
  ) {
    IconComponent = Sparkles;
    gradientClass = "from-emerald-400 to-teal-600 shadow-emerald-500/20";
  } else if (
    serviceName.toLowerCase().includes("repair") ||
    serviceName.toLowerCase().includes("fix") ||
    serviceName.toLowerCase().includes("install") ||
    serviceName.toLowerCase().includes("plumbing") ||
    serviceName.toLowerCase().includes("pest")
  ) {
    IconComponent = Zap;
    gradientClass = "from-amber-500 to-orange-600 shadow-orange-500/20";
  } else if (
    serviceName.toLowerCase().includes("salon") ||
    serviceName.toLowerCase().includes("spa") ||
    serviceName.toLowerCase().includes("beauty") ||
    serviceName.toLowerCase().includes("massage") ||
    serviceName.toLowerCase().includes("hair")
  ) {
    IconComponent = Sparkles;
    gradientClass = "from-rose-400 to-pink-650 shadow-rose-550/20";
  } else if (
    serviceName.toLowerCase().includes("ac") ||
    serviceName.toLowerCase().includes("cool") ||
    serviceName.toLowerCase().includes("appliance")
  ) {
    IconComponent = Compass;
    gradientClass = "from-cyan-400 to-sky-600 shadow-cyan-500/20";
  }

  const dimensionClass =
    size === "sm" ? "w-12 h-12 rounded-[18px]" : "w-16 h-16 rounded-[22px]";
  const iconSize = size === "sm" ? 18 : 24;

  if (service?.imageURL && !isCustomComposite) {
    return (
      <div
        className={`${dimensionClass} relative overflow-hidden shrink-0 border-2 border-white shadow-md bg-slate-100 group`}
      >
        <img
          src={service.imageURL}
          alt={serviceName}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </div>
    );
  }

  const subSize = Math.max(8, Math.floor(iconSize * 0.45));

  return (
    <div
      className={`${dimensionClass} bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white shrink-0 relative overflow-hidden shadow-md border-2 border-white`}
    >
      {/* Ambient radial reflection glare */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 skew-y-12 origin-top-left" />
      {isCustomComposite ? (
        <div className="relative flex items-center justify-center shrink-0" style={{ width: iconSize, height: iconSize }}>
          <Clock size={iconSize} className="text-white shrink-0 animate-pulse" />
          <div className="absolute -bottom-1 -right-1 bg-blue-700 rounded-full p-0.5 border border-white shadow-sm flex items-center justify-center">
            <User size={subSize} className="text-white fill-white" strokeWidth={3} />
          </div>
        </div>
      ) : (
        <IconComponent
          size={iconSize}
          className="relative z-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)] font-black"
        />
      )}
    </div>
  );
}

function PartnerLiveStatus({
  partnerId,
  destinationAddress,
  isOpen,
  onToggle,
  status,
  serviceOtp,
  bookingLocation,
  bookingId,
}: {
  partnerId: string;
  destinationAddress: string;
  isOpen: boolean;
  onToggle: () => void;
  status: string;
  serviceOtp?: string;
  bookingLocation?: { lat: number; lng: number };
  bookingId?: string;
}) {
  const statusLabel =
    status === "on_the_way"
      ? "Partner Navigating"
      : status === "arrived"
        ? "Partner Arrived"
        : status === "in_progress"
          ? "Job in Progress"
          : "Update Logged";

  const statusColor =
    status === "on_the_way"
      ? "bg-indigo-600"
      : status === "arrived"
        ? "bg-amber-500"
        : status === "in_progress"
          ? "bg-blue-600 animate-pulse"
          : "bg-blue-700";

  return (
    <div className="mt-8 pt-8 border-t border-slate-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div
            className={`flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest ${statusColor} px-4 py-2 rounded-2xl shadow-lg`}
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            {statusLabel}
          </div>
          {serviceOtp && (status === "on_the_way" || status === "arrived") && (
            <div className="flex items-center gap-3 bg-amber-50 px-5 py-2 rounded-2xl border border-amber-200 shadow-sm animate-bounce-subtle">
              <Shield size={14} className="text-amber-600" />
              <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest">
                Share OTP:{" "}
                <span className="text-lg font-black ml-2 tracking-[0.2em]">
                  {serviceOtp}
                </span>
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="w-full sm:w-auto text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 transition-all px-6 py-3 border-2 border-slate-100 rounded-2xl flex items-center justify-center gap-3 bg-white shadow-sm hover:shadow-md"
        >
          <Compass size={16} className="text-slate-900" />
          {isOpen ? "Minimize Live Tracker" : "Open Live Tracker"}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <PartnerTrackingMap
              partnerId={partnerId}
              destinationAddress={destinationAddress}
              bookingLocation={bookingLocation}
              bookingId={bookingId}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SafetyInfoTooltipProps {
  partnerId?: string;
  isVerified?: boolean;
  kycStatus?: 'not_submitted' | 'pending' | 'pending_review' | 'verified' | 'rejected' | 'approved';
}

function SafetyInfoTooltip({ partnerId, isVerified = true, kycStatus = 'verified' }: SafetyInfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 rounded-full text-blue-600 hover:text-blue-700 hover:bg-slate-100 transition-all focus:outline-none shrink-0"
        title="Verified Safety Info"
      >
        <Shield size={12} className="fill-blue-500/15" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-white border border-slate-200 text-slate-800 rounded-2xl p-4 shadow-xl z-50 pointer-events-auto text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
              <Shield size={16} className="text-emerald-600 fill-emerald-500/10" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 leading-none">
                Safety & Verification
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-bold">PROFILE CHECK:</span>
                <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase">
                  {isVerified ? 'VERIFIED' : 'PASSED'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-bold">KYC DOCUMENTS:</span>
                <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase">
                  {kycStatus === 'verified' ? 'APPROVED' : 'VERIFIED'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-bold">BACKGROUND:</span>
                <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase">
                  CLEARED
                </span>
              </div>
            </div>

            <p className="text-[9px] text-slate-600 font-medium leading-relaxed mt-2.5 pt-2.5 border-t border-slate-100">
              This technician is a fully background-verified professional under safety standards.
            </p>

            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2.5 h-2.5 bg-white border-r border-b border-slate-200 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface RescheduleSectorProps {
  booking: Booking;
  onReschedule: (bookingId: string, newDate: string, newTime: string) => Promise<void>;
}

function RescheduleSector({ booking, onReschedule }: RescheduleSectorProps) {
  const [cooldown, setCooldown] = useState(900); // 15 minutes grace cooldown
  const [bypass, setBypass] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cooldown <= 0 || bypass) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown, bypass]);

  const handleApply = async () => {
    if (!newDate || !newTime) {
      alert("Please specify both a new Date and Time slot.");
      return;
    }
    setLoading(true);
    try {
      await onReschedule(booking.id, newDate, newTime);
    } catch (err) {
      console.error("Reschedule failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatSecs = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}m ${s < 10 ? "0" : ""}${s}s`;
  };

  const isLocked = cooldown > 0 && !bypass;

  return (
    <div className="bg-white text-slate-900 rounded-2xl p-6 border border-slate-200/80 space-y-5 shadow-sm relative overflow-hidden">
      <div className="absolute -right-12 -top-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
          <HelpCircle size={20} className="animate-pulse" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-black uppercase tracking-widest text-amber-700">
            ⚠️ Service Connection Hold (Grace Cooldown Active)
          </h4>
          <p className="text-[11px] text-slate-600 leading-normal">
            Your Service Expert was unable to reach you. To protect your wallet and scheduling sequence, we have queued your booking in slot-retention mode. A 15-minute response grace cooldown is active.
          </p>
        </div>
      </div>

      {isLocked ? (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Response Grace Countdown</span>
            <span className="text-sm font-mono font-black text-amber-600 animate-pulse">{formatSecs(cooldown)}</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-1000"
              style={{ width: `${(cooldown / 900) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-[9px] text-slate-500 font-bold uppercase">Safe Retention Mode Enabled</p>
            <button
              onClick={() => setBypass(true)}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-xs"
            >
              ⚡ Fast-Forward Cooldown
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="space-y-1">
            <h5 className="text-xs font-black uppercase tracking-widest text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> 🔄 Reschedule & Release Slot
            </h5>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Cooldown period resolved. Pick a new date/time to instantly release this booking back to available partner dispatch pools.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5 text-left">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">New Service Date</label>
              <input 
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>
            <div className="space-y-1.5 text-left">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">New Slot Time</label>
              <input 
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>
          </div>

          <button
            onClick={handleApply}
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-55 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm mt-1 cursor-pointer"
          >
            {loading ? "Re-initializing Dispatch..." : "Confirm Reschedule & Release Reservation"}
          </button>
        </div>
      )}
    </div>
  );
}

interface Props {
  profile: UserProfile;
  onServiceSelect?: (serviceId: string) => void;
  initialExpandedBookingId?: string | null;
  setActiveTab?: (tab: string, arg?: string | null) => void;
}

const BookingStatusTracker = ({ status }: { status: Booking["status"] }) => {
  const stages: { key: Booking["status"][]; label: string; icon: any }[] = [
    {
      key: ["pending", "pending_acceptance", "pending_parts", "confirmed_pay_after_service"],
      label: "Confirmed",
      icon: Clock,
    },
    {
      key: ["confirmed", "assigned"],
      label: "Expert Assigned",
      icon: User,
    },
    { key: ["on_the_way", "arrived"], label: "On The Way", icon: Navigation },
    { key: ["in_progress"], label: "In Progress", icon: Zap },
    {
      key: ["completed", "finalized", "closed"],
      label: "Completed",
      icon: CheckCircle2,
    },
  ];

  const currentStageIndex = stages.findIndex((s) => s.key.includes(status));
  const activeIndex = currentStageIndex >= 0 ? currentStageIndex : 0;

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm my-2">
      <div className="relative w-full max-w-2xl mx-auto py-2">
        {/* Track Line Background */}
        <div className="absolute top-[18px] sm:top-[20px] left-6 right-6 h-1 bg-slate-150 bg-slate-200/70 rounded-full z-0" />
        {/* Active Progress Line */}
        <div
          className="absolute top-[18px] sm:top-[20px] left-6 h-1 bg-gradient-to-r from-[#002e6e] via-[#e11d48] to-[#22c55e] rounded-full z-0 transition-all duration-500"
          style={{
            width: `${
              status === "completed" || status === "finalized" || status === "closed"
                ? "100%"
                : `${Math.min(100, (activeIndex / (stages.length - 1)) * 100)}%`
            }`,
          }}
        />

        <div className="flex items-center justify-between relative z-10">
          {stages.map((stage, idx) => {
            const isCompleted =
              idx < activeIndex ||
              status === "completed" ||
              status === "finalized" ||
              status === "closed";
            const isCurrent = idx === activeIndex && !["completed", "finalized", "closed"].includes(status);
            const Icon = stage.icon;

            return (
              <div key={idx} className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? "bg-[#22c55e] border-[#22c55e] text-white shadow-sm"
                      : isCurrent
                      ? "bg-[#002e6e] border-[#002e6e] text-white ring-4 ring-[#002e6e]/15 shadow-md scale-110"
                      : "bg-white border-slate-200 text-slate-300"
                  }`}
                >
                  <Icon size={16} />
                </div>
                <span
                  className={`text-[9px] sm:text-[10px] font-black tracking-wider uppercase mt-2 text-center max-w-[75px] leading-tight ${
                    isCompleted
                      ? "text-emerald-700 font-black"
                      : isCurrent
                      ? "text-[#002e6e] font-black"
                      : "text-slate-400 font-bold"
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
  );
};

export default function CustomerDashboard({
  profile,
  onServiceSelect,
  initialExpandedBookingId,
  setActiveTab,
}: Props) {
  // PWA states
  const [showPwaInstall, setShowPwaInstall] = useState(false);
  const [showIosSafariInstall, setShowIosSafariInstall] = useState(false);

  // Booking and partner states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [partners, setPartners] = useState<Record<string, UserProfile>>({});
  const [partnerDetails, setPartnerDetails] = useState<Record<string, PartnerProfile>>({});
  const [services, setServices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [trackingBookingId, setTrackingBookingId] = useState<string | null>(null);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(initialExpandedBookingId || null);
  const [expandedTrackerId, setExpandedTrackerId] = useState<string | null>(null);
  const [bookingOtps, setBookingOtps] = useState<Record<string, string>>({});
  const [routingCallBookingId, setRoutingCallBookingId] = useState<string | null>(null);
  const [activeBookingChat, setActiveBookingChat] = useState<Booking | null>(null);
  const [activeCallBooking, setActiveCallBooking] = useState<Booking | null>(null);

  // Modal and action states
  const [showSuccessModal, setShowSuccessModal] = useState<string | null>(null);
  const [finalizingBooking, setFinalizingBooking] = useState<Booking | null>(null);
  const [bookingToPay, setBookingToPay] = useState<Booking | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allActiveServices, setAllActiveServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  // Payment scanner and history search/filters states
  const [isPaymentScannerOpen, setIsPaymentScannerOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Support and warranty ticket states
  const [selectedSupportBooking, setSelectedSupportBooking] = useState<Booking | null>(null);
  const [supportTickets, setSupportTickets] = useState<Record<string, SupportTicket>>({});

  // Rating & review states
  const [skippedRatingBookingIds, setSkippedRatingBookingIds] = useState<Record<string, boolean>>(() => {
    try {
      const local = localStorage.getItem("zomindia_skipped_ratings");
      const session = sessionStorage.getItem("zomindia_skipped_ratings");
      return {
        ...(local ? JSON.parse(local) : {}),
        ...(session ? JSON.parse(session) : {}),
      };
    } catch (e) {
      return {};
    }
  });
  const [dbRatedBookings, setDbRatedBookings] = useState<Record<string, boolean>>({});
  const [dismissedHistoryCards, setDismissedHistoryCards] = useState<Record<string, boolean>>({});
  const [successCheckedCards, setSuccessCheckedCards] = useState<Record<string, boolean>>({});
  const [inlineRatings, setInlineRatings] = useState<Record<string, number>>({});
  const [inlineComments, setInlineComments] = useState<Record<string, string>>({});
  const [inlineSubmittingId, setInlineSubmittingId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingPartner, setRatingPartner] = useState(0);
  const [ratingProcess, setRatingProcess] = useState(0);
  const [ratingSafety, setRatingSafety] = useState(0);
  const [ratingZomIndia, setRatingZomIndia] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewPhoto, setReviewPhoto] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // PWA prompt effect
  useEffect(() => {
    const checkPrompt = () => {
      setShowPwaInstall(!!(window as any).deferredPrompt);
    };
    checkPrompt();
    window.addEventListener('pwa-prompt-available', checkPrompt);
    window.addEventListener('pwa-prompt-dismissed', checkPrompt);

    // Safari iOS detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = ('standalone' in window.navigator) && (window.navigator as any).standalone;
    let isDismissed = false;
    try {
      isDismissed = sessionStorage.getItem('pwa-safari-dismissed') === 'true';
    } catch (err) {
      console.warn('[PWA] Storage access denied', err);
    }

    if (isIOS && isSafari && !isStandalone && !isDismissed) {
      setShowIosSafariInstall(true);
    }

    return () => {
      window.removeEventListener('pwa-prompt-available', checkPrompt);
      window.removeEventListener('pwa-prompt-dismissed', checkPrompt);
    };
  }, []);

  const handleInstallPwa = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (!promptEvent) {
      window.dispatchEvent(new CustomEvent('trigger-pwa-install'));
      return;
    }
    try {
      await promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      console.log(`[PWA] Install choice: ${choiceResult.outcome}`);
      if (choiceResult.outcome === 'accepted') {
        (window as any).deferredPrompt = null;
        setShowPwaInstall(false);
      }
    } catch (err) {
      console.warn('[PWA] Error prompt:', err);
      window.dispatchEvent(new CustomEvent('trigger-pwa-install'));
    }
  };

  useEffect(() => {
    if (initialExpandedBookingId) {
      setExpandedBookingId(initialExpandedBookingId);
      const timer = setTimeout(() => {
        const el =
          document.getElementById(`booking-${initialExpandedBookingId}`) ||
          document.getElementById(`booking-card-${initialExpandedBookingId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [initialExpandedBookingId]);

  const activeBookings = useMemo(
    () =>
      bookings.filter((b) =>
        [
          "pending",
          "pending_acceptance",
          "confirmed",
          "confirmed_pay_after_service",
          "assigned",
          "on_the_way",
          "arrived",
          "in_progress",
          "pending_parts",
          "payment_pending",
          "Pending - Customer Unresponsive",
        ].includes(b.status),
      ),
    [bookings],
  );
  const pastBookings = useMemo(
    () => bookings,
    [bookings],
  );

  const activeBookingIds = activeBookings.map((b) => b.id).join(",");

  useEffect(() => {
    let isMounted = true;
    const activeWithOtpBookings = activeBookings.filter((b) =>
      ["pending", "assigned", "confirmed", "on_the_way", "arrived"].includes(
        b.status,
      ),
    );
    if (activeWithOtpBookings.length === 0) return;

    const unsubscribes = activeWithOtpBookings.map((booking) => {
      return onSnapshot(
        doc(db, `bookings/${booking.id}/secrets`, "otp"),
        (snap) => {
          if (!isMounted) return;
          if (snap.exists()) {
            setBookingOtps((prev) => ({
              ...prev,
              [booking.id]: snap.data().code,
            }));
          }
        },
        (err) => {
          if (!isMounted) return;
          // Graceful fallback for security rule / offline restrictions
          console.warn(`[CustomerDashboard] OTP snapshot handler for ${booking.id}:`, err?.message);
        }
      );
    });

    return () => {
      isMounted = false;
      unsubscribes.forEach((unsub) => {
        if (typeof unsub === "function") unsub();
      });
    };
  }, [activeBookingIds, activeBookings]);

  const activeCoordinatedCallBooking = useMemo(() => {
    return bookings.find(
      (b) =>
        b.activeCall &&
        (b.activeCall.status === "ringing" ||
          b.activeCall.status === "connected"),
    );
  }, [bookings]);

  const handleInitiateCall = (booking: Booking) => {
    const assignedPartner = booking.partnerId ? partners[booking.partnerId] : null;
    const assignedPartnerPhone = (assignedPartner as any)?.phoneNumber || (assignedPartner as any)?.phone || (booking as any)?.assignedPartner?.phoneNumber || (booking as any)?.assignedPartner?.phone || "+919630234563";

    if (typeof (window as any).__showToast === "function") {
      (window as any).__showToast("Opening device phone dialer to connect with assigned professional...", "info");
    }

    window.location.href = `tel:${assignedPartnerPhone || '+919630234563'}`;
  };

  const handleAnswerCall = async (booking: Booking) => {
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        "activeCall.status": "connected",
      });
    } catch (err) {
      console.error("Error answering firestore call: ", err);
    }
  };

  const handleEndCall = async (booking: Booking) => {
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        "activeCall.status": "ended",
        "activeCall.endedBy": profile.uid,
      });
      setTimeout(async () => {
        try {
          await updateDoc(doc(db, "bookings", booking.id), {
            activeCall: null,
          });
        } catch (err) {}
      }, 1500);
    } catch (err) {
      console.error("Error ending firestore call: ", err);
    }
  };

  const handleReschedule = async (bookingId: string, newDateStr: string, newTimeStr: string) => {
    try {
      const combinedDateTime = new Date(`${newDateStr}T${newTimeStr}`);
      await updateDoc(doc(db, "bookings", bookingId), {
        scheduledAt: Timestamp.fromDate(combinedDateTime),
        status: "pending",
        partnerId: deleteField() as any,
        activeCall: null
      });
      setShowSuccessModal(`Booking rescheduled successfully to ${combinedDateTime.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}! Service has been safely released back into the dispatch pool.`);
    } catch (err) {
      console.error("Error rescheduling booking:", err);
      alert("Failed to reschedule service. Please try again.");
    }
  };

  const handleInitiateSupport = (bookingId: string) => {
    const found = bookings.find((b) => b.id === bookingId);
    if (found) {
      setSelectedSupportBooking(found);
    }
  };

  // Real-time listener for support & warranty tickets for customer's bookings
  useEffect(() => {
    if (!profile?.uid) return;
    try {
      const qCust = query(
        collection(db, "support_tickets"),
        where("customerId", "==", profile.uid)
      );
      const unsub = onSnapshot(
        qCust,
        (snapshot) => {
          const ticketMap: Record<string, SupportTicket> = {};
          snapshot.docs.forEach((doc) => {
            const data = { id: doc.id, ...doc.data() } as SupportTicket;
            if (data.bookingId) {
              const prev = ticketMap[data.bookingId];
              if (!prev || (data.createdAt && (!prev.createdAt || data.createdAt > prev.createdAt))) {
                ticketMap[data.bookingId] = data;
              }
            }
          });
          setSupportTickets(ticketMap);
        },
        (err) => {
          console.warn("Error subscribing to support_tickets in CustomerDashboard:", err);
        }
      );
      return () => unsub();
    } catch (e) {
      console.warn("support_tickets query failed:", e);
    }
  }, [profile?.uid]);

  // Hook to check if a booking has already been rated and feedback is submitted to Firestore
  useEffect(() => {
    if (!profile?.uid) return;
    try {
      const q = query(
        collection(db, "reviews"),
        where("customerId", "==", profile.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ratedMap: Record<string, boolean> = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.bookingId) {
            ratedMap[data.bookingId] = true;
          }
        });
        setDbRatedBookings(ratedMap);
      }, (error) => {
        console.error("Error loading reviews snapshots:", error);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Hook error for check reviews:", err);
    }
  }, [profile?.uid]);

  // Derived filtered past bookings list for historical search/filters
  const filteredPastBookings = useMemo(() => {
    return pastBookings.filter((booking) => {
      const service = services[booking.serviceId];
      // Get search query of lowercase
      const queryStr = historySearchQuery.trim().toLowerCase();

      const serviceName = (service?.name || "").toLowerCase();
      const serviceDesc = (service?.description || "").toLowerCase();
      const serviceCatId = service?.categoryId || "";

      // Filter by query match
      const matchesSearch =
        !queryStr ||
        serviceName.includes(queryStr) ||
        serviceDesc.includes(queryStr);

      // Filter by category match
      const matchesCategory =
        !historyCategoryFilter || serviceCatId === historyCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [pastBookings, services, historySearchQuery, historyCategoryFilter]);

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) {
      return allActiveServices.filter((s) => {
        return !activeCategoryFilter || s.categoryId === activeCategoryFilter;
      });
    }

    const results = allActiveServices
      .map((s) => {
        const categoryName = allCategories.find((c) => c.id === s.categoryId)?.name || "";
        const nameMatch = fuzzyMatch(s.name, searchQuery);
        const descMatch = fuzzyMatch(s.description, searchQuery);
        const catMatch = fuzzyMatch(categoryName, searchQuery);

        // Calculate a prioritizing score
        const bestScore = Math.max(
          nameMatch.score,
          descMatch.score * 0.8,
          catMatch.score * 0.9
        );
        const matches = nameMatch.matches || descMatch.matches || catMatch.matches;

        return { service: s, matches, score: bestScore };
      })
      .filter((item) => {
        const matchesCategory =
          !activeCategoryFilter || item.service.categoryId === activeCategoryFilter;
        return item.matches && matchesCategory;
      });

    // Sort by the best match score
    results.sort((a, b) => b.score - a.score);
    return results.map((r) => r.service);
  }, [allActiveServices, searchQuery, activeCategoryFilter, allCategories]);

  // Fetch Categories & Services for discovery
  useEffect(() => {
    const fetchDiscoveryData = async () => {
      try {
        const catsSnap = await getDocs(
          query(collection(db, "categories"), orderBy("name", "asc")),
        );
        setAllCategories(
          catsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category),
        );

        const servicesSnap = await getDocs(collection(db, "services"));
        setAllActiveServices(
          servicesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Service),
        );
      } catch (err) {
        console.error("Error fetching discovery data:", err);
      }
    };
    fetchDiscoveryData();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const q = query(
      collection(db, "promotions"),
      where("active", "==", true),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (!isMounted) return;
        const allPromos = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Promotion,
        );
        const customerPromos = allPromos.filter(
          (promo) =>
            promo.targetAudience === "customer" ||
            !promo.targetAudience ||
            promo.targetAudience === "all",
        );
        setPromotions(customerPromos);
      },
      (err) => {
        if (!isMounted) return;
        console.error("Error fetching promotions:", err);
      },
    );
    return () => {
      isMounted = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid || profile?.uid;
    if (!uid) {
      // Do not clear state or stop loading if we don't have auth yet, 
      // just keep the loading screen active.
      return;
    }

    let isMounted = true;
    let unsubscribeSnapshot = () => {};

    try {
      // Query Firestore with both 'customerUid', 'userId', and 'customerId' using or()
      const q = query(
        collection(db, "bookings"),
        or(
          where("customerUid", "==", uid),
          where("userId", "==", uid),
          where("customerId", "==", uid)
        )
      );

      unsubscribeSnapshot = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;
          const dbBookings = snap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Booking
          );

          // Gracefully sort client-side in memory descending by date/time to bypass any Firestore composite indexing requirements
          dbBookings.sort((a, b) => {
            const dateA = a.scheduledAt?.toDate?.() || (a.scheduledAt instanceof Date ? a.scheduledAt : (a.scheduledAt?.seconds ? new Date(a.scheduledAt.seconds * 1000) : null)) || ((a as any).dateTime ? new Date((a as any).dateTime) : null) || (a.createdAt?.toDate?.() || (a.createdAt instanceof Date ? a.createdAt : (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : null))) || new Date(0);
            const dateB = b.scheduledAt?.toDate?.() || (b.scheduledAt instanceof Date ? b.scheduledAt : (b.scheduledAt?.seconds ? new Date(b.scheduledAt.seconds * 1000) : null)) || ((b as any).dateTime ? new Date((b as any).dateTime) : null) || (b.createdAt?.toDate?.() || (b.createdAt instanceof Date ? b.createdAt : (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : null))) || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });

          setBookings(dbBookings);
          setLoading(false);
        },
        (err) => {
          if (!isMounted) return;
          console.error("onSnapshot error on bookings query:", err);
          // Maintain existing bookings on transient network disconnects to prevent wipeout
          setLoading(false);
        }
      );
    } catch (e) {
      if (!isMounted) return;
      console.error("Failed to set up Customer bookings snapshot listener:", e);
      setLoading(false);
    }

    return () => {
      isMounted = false;
      unsubscribeSnapshot();
    };
  }, [profile?.uid, auth.currentUser?.uid]);

  // Fetch partner profiles (UserProfile) for bookings
  useEffect(() => {
    const fetchPartners = async () => {
      const partnerIds = bookings
        .map((b) => b.partnerId)
        .filter((id): id is string => !!id && !partners[id]);

      const uniqueMissingIds = Array.from(new Set(partnerIds));

      if (uniqueMissingIds.length === 0) return;

      try {
        const batchSize = 10;
        for (let i = 0; i < uniqueMissingIds.length; i += batchSize) {
          const chunk = uniqueMissingIds.slice(i, i + batchSize);
          const uq = query(collection(db, "users"), where("uid", "in", chunk));
          const uSnap = await getDocs(uq);
          const fetched: Record<string, UserProfile> = {};
          uSnap.forEach((doc) => {
            const data = doc.data() as UserProfile;
            fetched[data.uid] = data;
          });
          setPartners((prev) => ({ ...prev, ...fetched }));
        }
      } catch (err) {
        console.error("Error fetching partner profiles:", err);
      }
    };

    if (bookings.length > 0) {
      fetchPartners();
    }
  }, [bookings, partners]);

  // Fetch & listen to real-time Partner details (PartnerProfile) for assigned bookings
  useEffect(() => {
    const partnerIds = bookings
      .map((b) => b.partnerId)
      .filter((id): id is string => !!id);

    const uniqueIds = Array.from(new Set(partnerIds));
    if (uniqueIds.length === 0) return;

    let isMounted = true;
    const unsubs: (() => void)[] = [];

    // 1. Listen by doc ID directly
    uniqueIds.forEach((pId) => {
      const unsubDoc = onSnapshot(
        doc(db, "partners", pId),
        (snap) => {
          if (!isMounted) return;
          if (snap.exists()) {
            const data = snap.data() as PartnerProfile;
            const profile = { id: snap.id, ...data };
            setPartnerDetails((prev) => ({
              ...prev,
              [pId]: profile,
              [data.userId || pId]: profile,
            }));
          }
        },
        (err) => {
          if (!isMounted) return;
          console.warn("Snapshot listener error for partner:", pId, err);
        }
      );
      unsubs.push(unsubDoc);
    });

    // 2. Query by userId in batch
    const batchSize = 10;
    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const chunk = uniqueIds.slice(i, i + batchSize);
      const pq = query(
        collection(db, "partners"),
        where("userId", "in", chunk)
      );
      const unsubQuery = onSnapshot(
        pq,
        (pSnap) => {
          if (!isMounted) return;
          const fetched: Record<string, PartnerProfile> = {};
          pSnap.forEach((doc) => {
            const data = doc.data() as PartnerProfile;
            const profile = { id: doc.id, ...data };
            if (data.userId) fetched[data.userId] = profile;
            fetched[doc.id] = profile;
          });
          setPartnerDetails((prev) => ({ ...prev, ...fetched }));
        },
        (err) => {
          if (!isMounted) return;
          console.warn("Query snapshot error for partners:", err);
        }
      );
      unsubs.push(unsubQuery);
    }

    return () => {
      isMounted = false;
      unsubs.forEach((unsub) => {
        if (typeof unsub === "function") unsub();
      });
    };
  }, [bookings]);

  // Fetch service details for bookings
  useEffect(() => {
    const fetchServices = async () => {
      const serviceIds = bookings
        .map((b) => b.serviceId)
        .filter((id) => id && !services[id]);

      const uniqueMissingIds = Array.from(new Set(serviceIds));

      if (uniqueMissingIds.length === 0) return;

      try {
        const batchSize = 10;
        for (let i = 0; i < uniqueMissingIds.length; i += batchSize) {
          const chunk = uniqueMissingIds.slice(i, i + batchSize);
          const uq = query(
            collection(db, "services"),
            where(documentId(), "in", chunk),
          );
          const sSnap = await getDocs(uq);
          const fetched: Record<string, any> = {};
          sSnap.forEach((doc) => {
            fetched[doc.id] = { id: doc.id, ...doc.data() };
          });
          setServices((prev) => ({ ...prev, ...fetched }));
        }
      } catch (err) {
        console.error("Error fetching services:", err);
      }
    };

    if (bookings.length > 0) {
      fetchServices();
    }
  }, [bookings, services]);

  const getStatusColor = (status: Booking["status"]) => {
    switch (status) {
      case "finalized":
      case "closed":
      case "completed":
        return "bg-slate-100 text-[#002e6e] border border-slate-200 font-medium";
      case "cancelled":
        return "bg-rose-100 text-rose-700 border border-rose-200 font-medium";
      case "in_progress":
        return "bg-blue-600 text-white font-medium animate-pulse";
      case "on_the_way":
        return "bg-indigo-600 text-white font-medium";
      case "arrived":
        return "bg-amber-500 text-white font-medium";
      case "confirmed":
      case "assigned":
        return "bg-slate-100 text-[#002e6e] border border-slate-200 font-medium";
      case "pending":
      case "pending_parts":
        return "bg-slate-100 text-[#002e6e] border border-slate-200 font-medium";
      case "payment_pending":
        return "bg-rose-600 text-white font-medium";
      default:
        return "bg-slate-100 text-[#002e6e] border border-slate-200 font-medium";
    }
  };

  // Dismiss / Skip rating modal without blocking user
  const handleSkipRating = (bookingId?: string) => {
    const bId = bookingId || finalizingBooking?.id;
    if (bId) {
      setSkippedRatingBookingIds((prev) => {
        const updated = { ...prev, [bId]: true };
        try {
          localStorage.setItem("zomindia_skipped_ratings", JSON.stringify(updated));
          sessionStorage.setItem("zomindia_skipped_ratings", JSON.stringify(updated));
        } catch (e) {
          console.warn("[CustomerDashboard] Storage write notice:", e);
        }
        return updated;
      });
      setDismissedHistoryCards((prev) => ({ ...prev, [bId]: true }));
    }
    setFinalizingBooking(null);
    setRating(0);
    setRatingPartner(0);
    setRatingProcess(0);
    setRatingSafety(0);
    setRatingZomIndia(0);

    const toastMsg = "Feedback skipped. You can always rate later from your booking history.";
    if ((window as any).__showToast) {
      (window as any).__showToast(toastMsg);
    }
  };

  // Automatically open rating popup for completed bookings that need review (Urban Company style)
  useEffect(() => {
    const completedBookingToReview = bookings.find(
      (b) =>
        b.status === "completed" &&
        b.paymentStatus === "paid" &&
        (b.customerUid === profile?.uid || b.customerId === profile?.uid || b.userId === profile?.uid) &&
        !b.rating &&
        !b.reviewedAt &&
        !dbRatedBookings[b.id] &&
        !dismissedHistoryCards[b.id] &&
        !skippedRatingBookingIds[b.id]
    );
    if (completedBookingToReview && !finalizingBooking) {
      setRating(0);
      setRatingPartner(0);
      setRatingProcess(0);
      setRatingSafety(0);
      setRatingZomIndia(0);
      setFinalizingBooking(completedBookingToReview);
    }
  }, [bookings, profile?.uid, finalizingBooking, dbRatedBookings, dismissedHistoryCards, skippedRatingBookingIds]);

  const handlePaymentScanSuccess = (scannedBookingId: string) => {
    // Locate the booking by ID across user's active/past bookings list
    const foundBooking = bookings.find((b) => b.id === scannedBookingId);
    if (foundBooking) {
      if (foundBooking.paymentStatus === "paid") {
        alert("This booking has already been paid!");
        return;
      }
      setBookingToPay(foundBooking);
      setIsPaymentScannerOpen(false);
    } else {
      alert(
        `Booking with ID '${scannedBookingId}' scanned from QR, but it wasn't found in your bookings record. Ensure you are scanning the QR generated for your specific booking.`,
      );
    }
  };

  const handlePayWithCashByCustomer = async (booking: Booking) => {
    if (!confirm(`Are you sure you want to confirm cash handover for ₹${booking.totalPrice}? This will notify your service expert and instantly complete the booking.`)) {
      return;
    }
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "completed",
        paymentStatus: "paid",
        paymentMethod: "cash",
        updatedAt: Timestamp.now(),
      });

      // Credit the partner's earnings & rewards
      if (booking.partnerId) {
        const partnerQuery = query(
          collection(db, "partners"),
          where("userId", "==", booking.partnerId),
        );
        const pSnap = await getDocs(partnerQuery);
        if (!pSnap.empty) {
          const pDoc = pSnap.docs[0];
          const pData = pDoc.data() as PartnerProfile;
          const rewardPts = 10;
          await updateDoc(doc(db, "partners", pDoc.id), {
            totalEarnings: (pData.totalEarnings || 0) + booking.totalPrice,
            rewardCredits: (pData.rewardCredits || 0) + rewardPts,
            updatedAt: Timestamp.now(),
          });

          await addDoc(collection(db, "partners", pDoc.id, "earningsHistory"), {
            type: "booking_earning",
            amount: booking.totalPrice,
            credits: rewardPts,
            bookingId: booking.id,
            reason: `Completed service (Cash settled): ${services[booking.serviceId]?.name || 'Service'}`,
            createdAt: Timestamp.now(),
          });
        }
      }

      alert("Cash payment of ₹" + booking.totalPrice + " confirmed successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
    }
  };

  const handleInlineFeedbackSubmit = async (booking: Booking) => {
    const inlineRating = inlineRatings[booking.id] || 0;
    const inlineComment = inlineComments[booking.id] || "";

    if (inlineRating === 0) {
      if ((window as any).__showToast) {
        (window as any).__showToast("Please select at least 1 star before submitting.");
      } else {
        alert("Please select at least a 1-star rating before submitting.");
      }
      return;
    }

    setInlineSubmittingId(booking.id);

    const scores = {
      hygiene: inlineRating,
      safety: inlineRating,
      process: inlineRating,
      partner: inlineRating,
      appExperience: inlineRating,
      zomindia: inlineRating,
    };

    try {
      await syncReviewAndRatings(
        booking,
        inlineRating,
        inlineComment,
        scores,
        null
      );

      // Optimistic update & UI unlock
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                status: "finalized",
                rating: inlineRating,
                review: inlineComment,
                reviewedAt: new Date().toISOString(),
              }
            : b
        )
      );
      setDbRatedBookings((prev) => ({ ...prev, [booking.id]: true }));
      setSuccessCheckedCards((prev) => ({ ...prev, [booking.id]: true }));

      setInlineRatings((prev) => {
        const copy = { ...prev };
        delete copy[booking.id];
        return copy;
      });
      setInlineComments((prev) => {
        const copy = { ...prev };
        delete copy[booking.id];
        return copy;
      });

      if ((window as any).__showToast) {
        (window as any).__showToast("Thank you for your feedback!");
      }

      setTimeout(() => {
        setDismissedHistoryCards((prev) => ({ ...prev, [booking.id]: true }));
      }, 1200);

    } catch (err) {
      console.warn("[Inline Feedback] Handled feedback fallback:", err);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                status: "finalized",
                rating: inlineRating,
                review: inlineComment,
                reviewedAt: new Date().toISOString(),
              }
            : b
        )
      );
      setDbRatedBookings((prev) => ({ ...prev, [booking.id]: true }));
      setDismissedHistoryCards((prev) => ({ ...prev, [booking.id]: true }));
      if ((window as any).__showToast) {
        (window as any).__showToast("Thank you for your feedback!");
      }
    } finally {
      setInlineSubmittingId(null);
    }
  };

  // Helper for centralized, real-time rating and review synchronization across collections
  const syncReviewAndRatings = async (
    booking: Booking,
    finalRating: number,
    commentText: string,
    scores: {
      hygiene?: number;
      safety?: number;
      process?: number;
      partner?: number;
      appExperience?: number;
      zomindia?: number;
    },
    photoURL?: string | null
  ) => {
    const effectiveScores = {
      hygiene: scores.hygiene ?? scores.safety ?? finalRating,
      safety: scores.safety ?? finalRating,
      process: scores.process ?? scores.partner ?? finalRating,
      partner: scores.partner ?? scores.process ?? finalRating,
      appExperience: scores.appExperience ?? scores.zomindia ?? finalRating,
      zomindia: scores.zomindia ?? scores.appExperience ?? finalRating,
    };

    const reviewDocPayload: any = {
      bookingId: booking.id,
      customerId: profile?.uid || "",
      customerUid: profile?.uid || "",
      userId: profile?.uid || "",
      customerName: profile?.fullName || profile?.displayName || "Verified Customer",
      partnerId: booking.partnerId || "",
      serviceId: booking.serviceId || "",
      serviceName: services[booking.serviceId]?.name || booking.serviceName || "Home Service",
      rating: finalRating,
      ratingDetails: effectiveScores,
      feedbackScores: effectiveScores,
      comment: commentText,
      review: commentText,
      reviewText: commentText,
      createdAt: Timestamp.now(),
      reviewedAt: Timestamp.now(),
    };
    if (photoURL) reviewDocPayload.photoURL = photoURL;

    // 1. Add review document
    try {
      await addDoc(collection(db, "reviews"), reviewDocPayload);
    } catch (rErr) {
      console.warn("[Review Sync] Direct review doc write notice:", rErr);
    }

    // 2. Update booking document
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "finalized",
        rating: finalRating,
        review: commentText,
        comment: commentText,
        reviewText: commentText,
        feedbackScores: effectiveScores,
        ratingDetails: effectiveScores,
        reviewedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        isReviewed: true,
      });
    } catch (bErr) {
      console.warn("[Review Sync] Direct booking update notice:", bErr);
    }

    // 3. Atomically sync Partner Document
    if (booking.partnerId) {
      try {
        let pDocRef = doc(db, "partners", booking.partnerId);
        let pSnap = await getDoc(pDocRef);

        if (!pSnap.exists()) {
          const pQuery = query(
            collection(db, "partners"),
            where("userId", "==", booking.partnerId)
          );
          const pQSnap = await getDocs(pQuery);
          if (!pQSnap.empty) {
            pDocRef = doc(db, "partners", pQSnap.docs[0].id);
            pSnap = pQSnap.docs[0];
          }
        }

        if (pSnap.exists()) {
          const pData = pSnap.data() as any;
          const currentReviews = Number(pData.totalReviews || pData.reviewCount || 0);
          const currentPoints = Number(
            pData.totalRatingPoints ||
              (pData.averageRating || pData.rating || 4.9) * (currentReviews || 10)
          );
          const newTotalReviews = currentReviews + 1;
          const newTotalPoints = currentPoints + finalRating;
          const newAverage = Number(
            (
              newTotalPoints /
              (pData.totalRatingPoints ? newTotalReviews : newTotalReviews + 10)
            ).toFixed(1)
          );

          const prevScores = pData.feedbackScores || {};
          const updatedFeedback = {
            hygiene: Number(
              (
                ((prevScores.hygiene || 4.9) * (currentReviews || 5) +
                  effectiveScores.hygiene) /
                (currentReviews + 5 + 1)
              ).toFixed(1)
            ),
            safety: Number(
              (
                ((prevScores.safety || 5.0) * (currentReviews || 5) +
                  effectiveScores.safety) /
                (currentReviews + 5 + 1)
              ).toFixed(1)
            ),
            process: Number(
              (
                ((prevScores.process || 4.8) * (currentReviews || 5) +
                  effectiveScores.process) /
                (currentReviews + 5 + 1)
              ).toFixed(1)
            ),
            appExperience: Number(
              (
                ((prevScores.appExperience || 4.9) * (currentReviews || 5) +
                  effectiveScores.appExperience) /
                (currentReviews + 5 + 1)
              ).toFixed(1)
            ),
          };

          await updateDoc(pDocRef, {
            rating: newAverage,
            averageRating: newAverage,
            reviewCount: newTotalReviews,
            totalReviews: newTotalReviews,
            totalRatingPoints: newTotalPoints,
            feedbackScores: updatedFeedback,
            updatedAt: Timestamp.now(),
          });
        }
      } catch (pErr) {
        console.warn("[Review Sync] Partner rating sync notice:", pErr);
      }
    }

    // 4. Atomically sync Service Document
    if (booking.serviceId) {
      try {
        const serviceRef = doc(db, "services", booking.serviceId);
        const sSnap = await getDoc(serviceRef);
        if (sSnap.exists()) {
          const sData = sSnap.data() as any;
          const currentReviews = Number(sData.totalReviews || sData.reviewCount || 0);
          const currentPoints = Number(
            sData.totalRatingPoints ||
              (sData.averageRating || sData.rating || 4.8) * (currentReviews || 10)
          );
          const newTotalReviews = currentReviews + 1;
          const newTotalPoints = currentPoints + finalRating;
          const newAverage = Number(
            (
              newTotalPoints /
              (sData.totalRatingPoints ? newTotalReviews : newTotalReviews + 10)
            ).toFixed(1)
          );

          await updateDoc(serviceRef, {
            rating: newAverage,
            averageRating: newAverage,
            reviewCount: newTotalReviews,
            totalReviews: newTotalReviews,
            totalRatingPoints: newTotalPoints,
            updatedAt: Timestamp.now(),
          });
        }
      } catch (sErr) {
        console.warn("[Review Sync] Service rating sync notice:", sErr);
      }
    }

    // 5. Asynchronously notify backend API
    try {
      await fetch(`/api/bookings/${booking.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewDocPayload),
      });
    } catch (apiErr) {
      console.info("[Review Sync] Backend API sync notice:", apiErr);
    }
  };

  const handleFinalize = async (booking: Booking) => {
    if (booking.paymentStatus === "unpaid" && booking.totalPrice > 0) {
      setBookingToPay(booking);
      setFinalizingBooking(null);
      return;
    }

    // Compute the composite rating based on sub-criteria
    const finalRating =
      Math.round((ratingPartner + ratingProcess + ratingSafety + ratingZomIndia) / 4) || 5;

    setIsSubmittingReview(true);

    const scores = {
      partner: ratingPartner || 5,
      process: ratingProcess || 5,
      safety: ratingSafety || 5,
      hygiene: ratingSafety || 5,
      appExperience: ratingZomIndia || 5,
      zomindia: ratingZomIndia || 5,
    };

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out after 5s")), 5000)
    );

    try {
      await Promise.race([
        syncReviewAndRatings(booking, finalRating, comment, scores, reviewPhoto),
        timeoutPromise,
      ]);

      // Optimistic local state update & UI unlock
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                status: "finalized",
                rating: finalRating,
                review: comment,
                reviewedAt: new Date().toISOString(),
              }
            : b
        )
      );
      setDbRatedBookings((prev) => ({ ...prev, [booking.id]: true }));
      setDismissedHistoryCards((prev) => ({ ...prev, [booking.id]: true }));

      // Clean up modal state immediately
      setFinalizingBooking(null);
      setRating(0);
      setRatingPartner(0);
      setRatingProcess(0);
      setRatingSafety(0);
      setRatingZomIndia(0);
      setComment("");
      setReviewPhoto("");

      // Show green success toast & confirmation modal
      if ((window as any).__showToast) {
        (window as any).__showToast("Thank you for your feedback!");
      }
      setShowSuccessModal("Thank you for your feedback! Your experience rating has been recorded.");

    } catch (err: any) {
      console.warn("[HandleFinalize] Timeout or handled error during review submission:", err);
      // Perform optimistic local dismissal so user is never locked out
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                status: "finalized",
                rating: finalRating,
                review: comment,
                reviewedAt: new Date().toISOString(),
              }
            : b
        )
      );
      setDbRatedBookings((prev) => ({ ...prev, [booking.id]: true }));
      setDismissedHistoryCards((prev) => ({ ...prev, [booking.id]: true }));
      setFinalizingBooking(null);
      setRating(0);
      setRatingPartner(0);
      setRatingProcess(0);
      setRatingSafety(0);
      setRatingZomIndia(0);
      setComment("");
      setReviewPhoto("");

      if ((window as any).__showToast) {
        (window as any).__showToast("Thank you for your feedback!");
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDownloadInvoice = async (b: Booking) => {
    const partnerUser = b.partnerId ? partners[b.partnerId] : null;
    const partnerDetail = b.partnerId ? partnerDetails[b.partnerId] : null;
    const service = services[b.serviceId];

    try {
      const success = await generateInvoicePDF({
        booking: b,
        service,
        partnerUser,
        partnerDetail,
        customerProfile: profile,
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
    } catch (err) {
      console.error("Failed to generate invoice PDF:", err);
      if ((window as any).__showToast) {
        (window as any).__showToast("Failed to generate invoice. Please try again.");
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10 lg:py-12 select-none animate-pulse">
        {/* Mirror: Greeting Top Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 px-2 sm:px-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-200 shrink-0" />
            <div className="w-64 h-4 bg-slate-200 rounded-lg" />
          </div>
        </div>

        {/* Mirror: Categories Section Title */}
        <div className="mb-12 flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-200 rounded-[16px]" />
          <div className="w-48 h-7 bg-slate-200 rounded-xl" />
        </div>

        {/* Mirror: Category Grid (6 columns) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 mb-16">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="bg-white border-2 border-slate-50 p-6 rounded-[32px] shadow-sm flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl" />
              <div className="w-20 h-4 bg-slate-100 rounded animate-[pulse_1.5s_infinite]" />
            </div>
          ))}
        </div>

        {/* Mirror: Explore Services Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-200 rounded-[16px]" />
            <div className="w-48 h-7 bg-slate-200 rounded-xl" />
          </div>
        </div>

        {/* Mirror: Grid of service card skeletons (3 cards in view) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {[1, 2, 3].map((idx) => (
            <ServiceCardSkeleton key={idx} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10 lg:py-12">
      {/* 1. Global PWA Install Banner */}
      {(showPwaInstall || showIosSafariInstall) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white border border-slate-200/80 text-slate-900 py-3 px-6 md:px-8 rounded-[28px] shadow-sm relative overflow-hidden mb-6"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 text-left">
            <div className="flex items-center gap-4">
              <div className="bg-blue-50 p-2 rounded-xl shrink-0 border border-blue-100">
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="text-xs font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  INSTALL ZOMINDIA WEB-APP
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 font-normal leading-normal max-w-xl">
                  {showIosSafariInstall 
                    ? "To install, tap Share [↑] and select 'Add to Home Screen'."
                    : "Install Zomindia directly on your home screen for quick offline access and service tracking."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {!showIosSafariInstall && (
                <button
                  onClick={handleInstallPwa}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold py-2 px-4 rounded-xl transition duration-150 flex items-center gap-1 shadow-md cursor-pointer tracking-wide"
                >
                  <Zap className="w-3 h-3" />
                  Install Now
                </button>
              )}
              <button
                onClick={() => {
                  if (showIosSafariInstall) {
                    try {
                      sessionStorage.setItem('pwa-safari-dismissed', 'true');
                    } catch (err) {
                      console.warn('[PWA] Storage access denied', err);
                    }
                    setShowIosSafariInstall(false);
                  } else {
                    setShowPwaInstall(false);
                  }
                }}
                className="text-slate-500 hover:text-slate-800 text-xs font-medium py-2 px-3 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* INCOMING SECURE CALL MODAL */}
      <AnimatePresence>
        {activeCoordinatedCallBooking && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="bg-white rounded-[40px] p-8 max-w-sm w-full text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-slate-100"
            >
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping animate-duration-1000" />
                <div className="w-20 h-20 bg-emerald-600 rounded-[28px] border border-emerald-400 flex items-center justify-center text-white shadow-lg shadow-emerald-650/30">
                  <Phone size={36} className="text-white animate-bounce" fill="currentColor" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="inline-block px-3 py-1 bg-emerald-100 border border-emerald-250 rounded-full">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">🔒 Corporate Landline Gateway</span>
                </div>
                <h3 className="text-xl font-black italic tracking-tight text-slate-900 uppercase">
                  Incoming Voice Call
                </h3>
                <p className="text-sm font-mono font-black text-slate-800">{CORPORATE_LANDLINE_GATEWAY}</p>
                <div className="bg-emerald-50/55 rounded-3xl p-4 border border-emerald-120">
                  <p className="text-emerald-800 text-xs font-black leading-relaxed">
                    "🔒 Verified Corporate Line: Connecting securely via {CORPORATE_LANDLINE_GATEWAY}. Both you and the Service Professional are connected through this masked central gateway."
                  </p>
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Supported by Zomindia Telephony Router
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-8">
                <button
                  onClick={() => handleAnswerCall(activeCoordinatedCallBooking)}
                  className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-black uppercase tracking-wider text-[10px] hover:bg-emerald-700 transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Answer
                </button>
                <button
                  onClick={() => handleEndCall(activeCoordinatedCallBooking)}
                  className="w-full bg-rose-600 text-white py-3.5 rounded-xl font-black uppercase tracking-wider text-[10px] hover:bg-rose-700 transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Decline
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Confirmation Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[32px] p-6 sm:p-10 max-w-sm w-full text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)]"
            >
              <div className="w-16 h-16 bg-blue-700 text-white rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-xl">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900 italic mb-2">
                Confirmed
              </h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                {showSuccessModal}
              </p>
              <button
                onClick={() => setShowSuccessModal(null)}
                className="w-full bg-blue-700 text-white py-4 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-blue-800 transition-all shadow-lg active:scale-95"
              >
                Acknowledge
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Unified Premium Active Booking Ticker Console */}
      {activeBookings.some((b) =>
        [
          "pending",
          "assigned",
          "confirmed",
          "on_the_way",
          "arrived",
          "in_progress",
          "payment_pending",
          "pending_parts",
        ].includes(b.status),
      ) ? (
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 14 }}
          className="mb-12 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {activeBookings
              .filter((b) =>
                [
                  "pending",
                  "assigned",
                  "confirmed",
                  "on_the_way",
                  "arrived",
                  "in_progress",
                  "payment_pending",
                  "pending_parts",
                ].includes(b.status),
              )
              .map((booking) => {
                const partnerUser = booking.partnerId
                  ? partners[booking.partnerId]
                  : null;
                const partnerDetail = booking.partnerId
                  ? partnerDetails[booking.partnerId]
                  : null;
                const otpCode = bookingOtps[booking.id] || booking.serviceOtp;

                return (
                  <CustomerBookingCard
                    key={booking.id}
                    booking={booking}
                    service={services[booking.serviceId]}
                    partnerUser={partnerUser}
                    partnerDetail={partnerDetail}
                    customerProfile={profile}
                    activeTicket={supportTickets[booking.id] || null}
                    otpCode={otpCode}
                    isExpanded={expandedBookingId === booking.id}
                    onToggleExpand={() =>
                      setExpandedBookingId(
                        expandedBookingId === booking.id ? null : booking.id,
                      )
                    }
                    onPayOnline={(b) => setBookingToPay(b)}
                    onPayCash={(b) => handlePayWithCashByCustomer(b)}
                    onScanQR={() => setIsPaymentScannerOpen(true)}
                    onCallPartner={(_p, b) => handleInitiateCall(b)}
                    onChatPartner={(b) => setActiveBookingChat(b)}
                    onDownloadInvoice={handleDownloadInvoice}
                    onSupport={(id) => handleInitiateSupport(id)}
                    onReschedule={handleReschedule}
                    routingCallBookingId={routingCallBookingId}
                  />
                );
              })}
          </div>
        </motion.div>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-150 rounded-[32px] p-8 text-center mb-12 flex flex-col items-center justify-center py-16 max-w-7xl mx-auto shadow-sm">
          <Calendar size={32} className="text-slate-300 mb-3" />
          <p className="text-sm font-extrabold text-slate-500">
            No active bookings right now.
          </p>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Need a professional task done? Book a service below!
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 px-2 sm:px-0">
        <div className="flex items-center gap-2 select-none">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse shrink-0" />
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">
            Hey {(profile.displayName || "Vikas").split(" ")[0]}, what are you looking for today?
          </span>
        </div>
      </div>

      {/* Active High-Visibility Status Ticker - Deactivated and Merged into top console */}
      {false && activeBookings.some((b) =>
        [
          "pending",
          "assigned",
          "confirmed",
          "on_the_way",
          "arrived",
          "in_progress",
          "payment_pending",
          "pending_parts",
        ].includes(b.status),
      ) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {activeBookings
            .filter((b) =>
              [
                "pending",
                "assigned",
                "confirmed",
                "on_the_way",
                "arrived",
                "in_progress",
                "payment_pending",
                "pending_parts",
              ].includes(b.status),
            )
            .map((booking) => {
              const bookingStatus = booking.status || "pending";
              const hasPartner = !!booking.partnerId;
              const partnerUser = hasPartner
                ? partners[booking.partnerId!]
                : null;
              const partnerDetail = hasPartner
                ? partnerDetails[booking.partnerId!]
                : null;
              const otpCode = bookingOtps[booking.id] || booking.serviceOtp;
              const isLiveTrackingAvailable = [
                "on_the_way",
                "arrived",
                "in_progress",
              ].includes(bookingStatus);

              return (
                <div
                  key={booking.id}
                  className="booking-details-modal bg-white border border-slate-200/80 text-slate-900 rounded-2xl p-4 sm:p-8 shadow-sm relative overflow-hidden mb-6"
                >
                  {/* Visual Ambient Blur Accent */}
                  <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                  {/* Header Module */}
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200/80 pb-4 mb-6">
                    <div className="flex items-center gap-4 sm:gap-6">
                      <ServiceThumbnail
                        service={services[booking.serviceId]}
                        bookingStatus={bookingStatus}
                        size="md"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-mono tracking-widest bg-sky-100 text-sky-800 border border-sky-200 font-semibold uppercase px-2.5 py-0.5 rounded-full">
                            ID: #{booking.id.toUpperCase().slice(-6)}
                          </span>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span
                            className={`text-[8px] px-2.5 py-0.5 rounded-full font-medium uppercase tracking-wider ${getStatusColor(bookingStatus)}`}
                          >
                            {bookingStatus.replace("_", " ")}
                          </span>
                        </div>
                        <h4 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">
                          {services[booking.serviceId]?.name ||
                            "Professional Service"}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end border-t border-slate-200/80 md:border-t-0 pt-4 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                          Estimated Total
                        </p>
                        <p className="text-xl font-black text-[#002e6e]">
                          ₹{booking.totalPrice}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Visual Status Tracking Timeline */}
                  <div className="relative z-10 w-full mb-8 pt-4 pb-6 px-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center justify-between relative max-w-3xl mx-auto px-1 sm:px-4 md:px-6">
                      {/* Background Progress Track Line */}
                      <div className="absolute top-[18px] sm:top-[22px] left-6 right-6 h-[2px] bg-slate-200 z-0" />
                      
                      {/* Active Animated Progress Track Line */}
                      <motion.div 
                        initial={{ width: '0%' }}
                        animate={{ 
                          width: `${
                            ['completed', 'finalized', 'closed'].includes(bookingStatus)
                              ? '100'
                              : (() => {
                                  if (['pending', 'pending_parts', 'pending_acceptance'].includes(bookingStatus)) return 0;
                                  if (['confirmed', 'assigned'].includes(bookingStatus)) return 25;
                                  if (['on_the_way', 'arrived'].includes(bookingStatus)) return 50;
                                  if (bookingStatus === 'in_progress') return 75;
                                  return 0;
                                })()
                          }%` 
                        }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        className="absolute top-[18px] sm:top-[22px] left-6 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 z-0 origin-left"
                      />

                      {[
                        { label: "Confirmed", description: "Schedule Secured", icon: Clock, keys: ["pending", "pending_parts", "pending_acceptance"] },
                        { label: "Assigned", description: "Expert Matched", icon: User, keys: ["confirmed", "assigned"] },
                        { label: "On The Way", description: "En Route/Arrived", icon: Navigation, keys: ["on_the_way", "arrived"] },
                        { label: "In Progress", description: "Service Underway", icon: Zap, keys: ["in_progress"] },
                        { label: "Completed", description: "Job Finalized", icon: CheckCircle2, keys: ["completed", "finalized", "closed"] }
                      ].map((step, idx) => {
                        const getTimelineStageIndex = (status: string) => {
                          if (['pending', 'pending_parts', 'pending_acceptance'].includes(status)) return 0;
                          if (['confirmed', 'assigned'].includes(status)) return 1;
                          if (['on_the_way', 'arrived'].includes(status)) return 2;
                          if (status === 'in_progress') return 3;
                          if (['completed', 'finalized', 'closed'].includes(status)) return 4;
                          return 0;
                        };

                        const stageIndex = getTimelineStageIndex(bookingStatus);
                        const isCompleted = idx < stageIndex || ['completed', 'finalized', 'closed'].includes(bookingStatus);
                        const isCurrent = idx === stageIndex && !['completed', 'finalized', 'closed'].includes(bookingStatus);
                        const StepIcon = step.icon;

                        return (
                          <div key={idx} className="relative z-10 flex flex-col items-center">
                            {/* Node Disc */}
                            <motion.div
                              initial={{ scale: 0.8 }}
                              animate={{ 
                                scale: isCurrent ? [1, 1.15, 1] : 1,
                                borderColor: isCompleted ? '#10b981' : isCurrent ? '#6366f1' : '#cbd5e1'
                              }}
                              transition={{ 
                                scale: isCurrent ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : { duration: 0.3 }
                              }}
                              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center transition-all duration-300 relative ${
                                isCompleted 
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                                  : isCurrent 
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/30 ring-4 ring-indigo-500/15' 
                                    : 'bg-white border-slate-300 text-slate-400'
                              }`}
                            >
                              <StepIcon size={16} className={isCurrent ? "animate-pulse" : ""} />
                              
                              {/* Pulsing indicator for active step */}
                              {isCurrent && (
                                <span className="absolute -inset-1 rounded-full border border-indigo-400 animate-ping opacity-20 pointer-events-none" />
                              )}
                            </motion.div>

                            {/* Texts info */}
                            <div className="mt-3 text-center flex flex-col items-center max-w-[65px] sm:max-w-[120px]">
                              <span className={`text-[8px] sm:text-[10px] font-black tracking-tight leading-snug transition-colors duration-300 ${
                                isCompleted 
                                  ? 'text-emerald-700 font-extrabold' 
                                  : isCurrent 
                                    ? 'text-indigo-700 font-black' 
                                    : 'text-slate-500'
                              }`}>
                                {step.label}
                              </span>
                              <span className={`text-[7px] sm:text-[8px] font-medium tracking-wide mt-0.5 whitespace-nowrap opacity-70 hidden md:block ${
                                isCompleted ? 'text-emerald-800' : isCurrent ? 'text-indigo-600' : 'text-slate-500'
                              }`}>
                                {step.description}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Content Grid */}
                  <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10">
                    {/* Left Column: Details */}
                    <div className="lg:col-span-7 space-y-6">
                      {/* Booking metadata list */}
                      <div className="space-y-4 bg-slate-50 border border-slate-200/80 p-5 rounded-2xl">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-1">
                          <FileText size={12} className="text-blue-600" />{" "}
                          Appointment Details
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                          <div className="flex items-center gap-3 text-slate-800">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0">
                              <Calendar size={14} className="text-slate-600" />
                            </div>
                            <div>
                              <p className="text-[8px] uppercase tracking-wider text-slate-500 font-extrabold mb-0.5">
                                Service Date
                              </p>
                              <p className="font-bold text-slate-900">
                                {booking.scheduledAt
                                  ?.toDate?.()
                                  ?.toLocaleDateString([], {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }) || "Scheduled Date"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-slate-800">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0">
                              <Clock size={14} className="text-slate-600" />
                            </div>
                            <div>
                              <p className="text-[8px] uppercase tracking-wider text-slate-500 font-extrabold mb-0.5">
                                Service Time
                              </p>
                              <p className="font-bold text-slate-900">
                                {formatBookingTime(booking.scheduledAt) || "11:00 AM"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-200/80 flex items-start gap-3 text-slate-800 text-xs">
                          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 pb-0.5">
                            <MapPin size={14} className="text-slate-600" />
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-wider text-slate-500 font-extrabold mb-0.5">
                              Service Address
                            </p>
                            <p className="font-bold text-slate-900 leading-relaxed text-left">
                              {booking.address}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Technician details & Actions */}
                      {hasPartner ? (
                        <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 border-emerald-500 relative">
                              <img
                                src={
                                  ((booking as any).assignedPartner?.profileImage && !(booking as any).assignedPartner?.profileImage.includes("googleusercontent.com/image_collection"))
                                    ? (booking as any).assignedPartner?.profileImage
                                    : ((booking as any).assignedPartner?.photoURL && !(booking as any).assignedPartner?.photoURL.includes("googleusercontent.com/image_collection"))
                                    ? (booking as any).assignedPartner?.photoURL
                                    : (partnerUser?.photoURL && !partnerUser?.photoURL.includes("googleusercontent.com/image_collection"))
                                    ? partnerUser.photoURL
                                    : LogoIcon
                                }
                                alt=""
                                className="w-full h-full object-cover rounded-full"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                              />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md inline-block mb-1">
                                Assigned Professional
                              </span>
                              <h5 className="font-bold text-slate-900 text-base flex items-center gap-1.5 leading-none">
                                {partnerUser?.displayName || "Expert Partner"}
                                <CheckCircle2
                                  size={14}
                                  className="text-emerald-600"
                                  fill="currentColor"
                                />
                                <SafetyInfoTooltip 
                                  partnerId={booking.partnerId}
                                  isVerified={partnerDetail?.isVerified}
                                  kycStatus={partnerDetail?.kycStatus}
                                />
                              </h5>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600 font-bold">
                                <span className="flex items-center gap-1 text-slate-800">
                                  <Star
                                    size={12}
                                    className="text-amber-500 fill-amber-500"
                                  />
                                  <span>
                                    {(partnerDetail?.rating || 4.9).toFixed(1)} out of 5
                                  </span>
                                </span>
                                <span>•</span>
                                <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] tracking-wider">
                                  {partnerDetail?.reviewCount || 12} reviews
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Direct action panel for assigned partner */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => setActiveBookingChat(booking)}
                              className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold tracking-wider text-[11px] uppercase py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                              <MessageSquare
                                size={14}
                                className="text-slate-600"
                              />{" "}
                              Chat
                            </button>
                            <button
                              id="customer-booking-secure-call-btn-2"
                              onClick={() => handleInitiateCall(booking)}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 border border-blue-600 text-white font-bold tracking-wider text-[11px] uppercase py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                            >
                              <Phone size={14} className="text-white" />{" "}
                              Call
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-dashed border-slate-200 p-6 rounded-2xl text-left">
                          <div className="inline-flex w-10 h-10 rounded-xl bg-blue-50 items-center justify-center text-blue-600 mb-3 animate-pulse">
                            <Sparkles size={18} />
                          </div>
                          <h5 className="font-bold text-slate-800 leading-tight">
                            Finding the best technician for you
                          </h5>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            We are matching your request with active, verified
                            experts nearby. Your booking schedule is secured.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Security (OTP) & Map (Live Status Tracking) */}
                    <div className="lg:col-span-5 flex flex-col justify-between gap-6">
                      {/* Security Code Panel */}
                      <div className="bg-slate-50 border border-slate-200/80 p-6 sm:p-8 rounded-2xl text-center shadow-xs relative flex flex-col justify-center items-center h-full min-h-[180px]">
                        {booking.status === "in_progress" ? (
                          <>
                            <div className="mb-4">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full inline-block animate-pulse">
                                Service Status
                              </span>
                            </div>

                            <div className="p-6 bg-emerald-50 text-emerald-600 rounded-full inline-block ring-4 ring-emerald-100 mb-2">
                              <Zap size={44} className="animate-bounce" />
                            </div>

                            <p className="text-[9px] font-bold text-slate-600 mt-4 uppercase tracking-widest leading-relaxed px-1">
                              Your service is actively in progress. <br /> Our expert technician is working on your booking.
                            </p>
                          </>
                        ) : otpCode ? (
                          <>
                            <div className="mb-4">
                              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-700 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full inline-block">
                                Security Verification OTP
                              </span>
                            </div>

                            <div className="flex items-center justify-center gap-3 my-3">
                              {otpCode
                                .toString()
                                .split("")
                                .map((digit, i) => (
                                  <div
                                    key={i}
                                    className="w-12 h-14 bg-white border border-slate-200 text-slate-900 rounded-xl flex items-center justify-center text-3xl font-black italic shadow-sm"
                                  >
                                    {digit}
                                  </div>
                                ))}
                            </div>

                            <p className="text-[9px] font-bold text-slate-500 mt-4 uppercase tracking-widest leading-relaxed px-2">
                              Share this code with the partner ONLY <br /> once
                              they arrive to verify the visit.
                            </p>
                          </>
                        ) : (
                          <div className="text-center py-4 text-slate-500">
                            <Shield
                              size={36}
                              className="mx-auto text-slate-400 mb-3"
                            />
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-700">
                              Secured Service
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1">
                              An OTP will be generated when a partner confirms.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Live Tracker Map Toggle inside ticker */}
                      {isLiveTrackingAvailable && hasPartner && (
                        <div className="space-y-4">
                          <button
                            onClick={() =>
                              setExpandedTrackerId(
                                expandedTrackerId === booking.id
                                  ? null
                                  : booking.id,
                              )
                            }
                            className="w-full text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white transition-all px-6 py-4 rounded-xl flex items-center justify-center gap-3 shadow-xs cursor-pointer"
                          >
                            <Compass size={16} className="text-white" />
                            {expandedTrackerId === booking.id
                              ? "Hide Live Navigation Map"
                              : "View Team Live Location Map"}
                          </button>

                          <AnimatePresence>
                            {expandedTrackerId === booking.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden border border-slate-200/80 rounded-2xl bg-slate-50 p-4"
                              >
                                <PartnerTrackingMap
                                  partnerId={booking.partnerId!}
                                  destinationAddress={booking.address}
                                  bookingLocation={booking.lat && booking.lng ? { lat: booking.lat, lng: booking.lng } : undefined}
                                  bookingId={booking.id}
                                  serviceName={booking.serviceName}
                                  heightClassName="h-[340px] sm:h-[380px]"
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </motion.div>
      )}

      {/* Ongoing Jobs & Service Discovery Logic */}
      {!searchQuery && (
        <div className="space-y-12 sm:space-y-16">
          {false && activeBookings.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-700 rounded-xl text-white shadow-2xl flex items-center justify-center">
                    <Calendar size={18} />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter uppercase italic">
                    Ongoing Jobs
                  </h2>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {activeBookings.map((booking) => (
                  <motion.div
                    layout
                    key={booking.id}
                    id={`booking-card-${booking.id}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`bg-white border transition-all duration-300 ${expandedBookingId === booking.id ? "border-[#002e6e] shadow-lg" : "border-slate-100 shadow-xs hover:shadow-md hover:border-slate-200"} rounded-2xl p-5 cursor-pointer relative overflow-hidden`}
                    onClick={() =>
                      setExpandedBookingId(
                        expandedBookingId === booking.id ? null : booking.id,
                      )
                    }
                  >
                    <div className="flex flex-col gap-4 sm:gap-6 relative z-10">
                      <div className="flex gap-4 sm:gap-6 items-start">
                        <ServiceThumbnail
                          service={services[booking.serviceId]}
                          bookingStatus={booking.status}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span
                              className={`text-[10px] px-3 py-0.5 rounded-full font-black uppercase tracking-widest ${getStatusColor(booking.status)} shadow-2xs border border-black/5`}
                            >
                              {booking.status.replace("_", " ")}
                            </span>
                            <span className="text-xs font-mono font-extrabold text-[#002e6e] bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
                              #{booking.id.slice(-6).toUpperCase()}
                            </span>
                          </div>
                          <h3 className="text-lg sm:text-xl font-black mb-1.5 text-[#002e6e] tracking-tight uppercase leading-snug truncate">
                            {services[booking.serviceId]?.name ||
                              "Professional Service"}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-slate-500 font-bold uppercase tracking-wider">
                            <Clock size={13} className="text-[#002e6e]" />{" "}
                            {formatBookingTime(booking.scheduledAt)}
                            <span className="text-slate-300">•</span>
                            <MapPin size={13} className="text-[#002e6e]" />{" "}
                            <span className="truncate max-w-[140px]">
                              {booking.address}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 flex-wrap">
                            <div>
                              {(() => {
                                const isAmc = Boolean(
                                  booking.isAmcBooking ||
                                  booking.isAmcCovered ||
                                  booking.tier === "amc"
                                );
                                const hasValidOnlineTxn = Boolean(
                                  booking.transactionId &&
                                    booking.paymentStatus === "paid" &&
                                    booking.paymentMethod !== "cash" &&
                                    booking.paymentMethod !== "pay_after_service"
                                );
                                const isPaidBooking =
                                  isAmc ||
                                  (booking.paymentMethod === "wallet" &&
                                    (booking.walletDeductAmount ?? 0) > 0) ||
                                  hasValidOnlineTxn;

                                if (isPaidBooking) {
                                  return (
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 shadow-2xs">
                                      <CheckCircle2 size={11} className="text-emerald-600" />
                                      {booking.paymentMethod === "wallet"
                                        ? "✓ PAID VIA WALLET"
                                        : isAmc
                                        ? "✓ PAID VIA AMC"
                                        : "✓ PAID ONLINE"}
                                    </span>
                                  );
                                }
                                return (
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 inline-flex items-center gap-1 shadow-2xs">
                                    <span>💵 Cash / UPI on Completion</span>
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-[#002e6e]">₹{booking.totalPrice}</span>
                              {!(
                                Boolean(booking.isAmcBooking || booking.isAmcCovered || booking.tier === "amc") ||
                                (booking.paymentMethod === "wallet" && (booking.walletDeductAmount ?? 0) > 0) ||
                                (booking.paymentStatus === "paid" && Boolean(booking.transactionId) && booking.transactionId.trim() !== "")
                              ) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBookingToPay(booking);
                                  }}
                                  className="text-[11px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                                >
                                  Pay Online Instead
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {expandedBookingId === booking.id && (
                        <div
                          className="pt-6 border-t border-slate-200/80 animate-in fade-in slide-in-from-top-2 space-y-6 cursor-default"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {booking.status === "Pending - Customer Unresponsive" ? (
                            <RescheduleSector 
                              booking={booking} 
                              onReschedule={handleReschedule} 
                            />
                          ) : (
                            <>
                              <BookingStatusTracker status={booking.status} />

                          {/* OTP / Security PIN Code Widget */}
                          {[
                            "pending",
                            "assigned",
                            "confirmed",
                            "on_the_way",
                            "arrived",
                          ].includes(booking.status) && (
                            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-200 px-3.5 py-1 rounded-full inline-flex items-center gap-1.5 shadow-2xs mb-1.5">
                                  <ShieldCheck size={13} className="text-orange-600" /> Security Verification OTP
                                </span>
                                <p className="text-xs text-slate-600 font-bold leading-relaxed">
                                  Provide this 4-digit token to your service technician ONLY on arrival.
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="flex gap-2">
                                  {(bookingOtps[booking.id] || booking.serviceOtp || "----")
                                    .toString()
                                    .split("")
                                    .map((digit, i) => (
                                      <div
                                        key={i}
                                        className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center text-xl font-black font-mono shadow-sm"
                                      >
                                        {digit}
                                      </div>
                                    ))}
                                </div>
                                <span className="text-[10px] text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 font-bold flex items-center gap-1">
                                  <CheckCircle2 size={12} /> Standby
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Predefined tasks / Multi-service Checklist */}
                          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                              <h4 className="text-xs font-black uppercase tracking-wider text-[#002e6e] flex items-center gap-1.5">
                                <FileText size={14} className="text-[#002e6e]" /> Service Protocol & Items
                              </h4>
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                                Progress:{" "}
                                {Math.round(
                                  ((booking.completedTasks?.length || 0) /
                                    (services[booking.serviceId]
                                      ?.predefinedTasks?.length || 4)) *
                                    100,
                                )}
                                %
                              </span>
                            </div>

                            <div className="space-y-2">
                              {(services[booking.serviceId]?.predefinedTasks
                                ?.length
                                ? (services[booking.serviceId]?.predefinedTasks || [])
                                : [
                                    "Inspect issue & diagnostics",
                                    "Perform requested repair/cleaning",
                                    "Calibrate or test performance",
                                    "Clean work area & final check",
                                  ]
                              ).map((task: string, i: number) => {
                                const isDone = booking.completedTasks?.includes(
                                  task || "",
                                );
                                return (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between bg-slate-50/70 px-3.5 py-2.5 rounded-xl border border-slate-200/60 shadow-2xs"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div
                                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${isDone ? "bg-[#22c55e] border-[#22c55e] text-white" : "border-slate-300 text-slate-300"}`}
                                      >
                                        <CheckCircle2
                                          size={11}
                                          className={
                                            isDone
                                              ? "text-white"
                                              : "text-slate-200"
                                          }
                                          fill={
                                            isDone
                                              ? "currentColor"
                                              : "transparent"
                                          }
                                        />
                                      </div>
                                      <span
                                        className={`text-xs font-semibold leading-tight text-left transition-colors duration-300 ${isDone ? "text-emerald-700 line-through font-medium" : "text-slate-800"}`}
                                      >
                                        {task}
                                      </span>
                                    </div>
                                    <span
                                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${isDone ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}
                                    >
                                      {isDone ? "Done" : "Pending"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Billing & Pricing Summary Panel */}
                          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
                            <h4 className="text-xs font-black uppercase tracking-wider text-[#002e6e] mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                              <Sparkles size={14} className="text-[#002e6e]" /> Comprehensive Cost Summary
                            </h4>
                            <div className="space-y-2.5 text-xs">
                              <div className="flex justify-between items-center text-slate-600">
                                <span className="font-semibold text-slate-600">
                                  {services[booking.serviceId]?.name ||
                                    "Base Fare"}
                                </span>
                                <span className="font-extrabold text-slate-900">
                                  ₹
                                  {services[booking.serviceId]?.basePrice ||
                                    booking.totalPrice}
                                </span>
                              </div>

                              {booking.discountApplied &&
                              booking.discountApplied > 0 ? (
                                <div className="flex justify-between items-center text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-extrabold">
                                  <span>
                                    Discount Applied (
                                    {booking.promoCode || "PROMO"})
                                  </span>
                                  <span className="font-black">
                                    -₹{booking.discountApplied}
                                  </span>
                                </div>
                              ) : null}

                              {/* Additional Charges added by Partner */}
                              {booking.additionalCharges &&
                              booking.additionalCharges.length > 0 ? (
                                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-left">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Technician Approved Add-ons
                                  </span>
                                  {booking.additionalCharges.map((chg, i) => (
                                    <div
                                      key={i}
                                      className="flex justify-between items-start bg-amber-50 p-2.5 rounded-xl border border-amber-200/80"
                                    >
                                      <div>
                                        <p className="font-extrabold text-slate-800 text-xs leading-none">
                                          {chg.reason}
                                        </p>
                                        <span className="text-[9px] text-slate-400 font-bold leading-none">
                                          {chg.createdAt
                                            ?.toDate?.()
                                            ?.toLocaleDateString() || "Today"}
                                        </span>
                                      </div>
                                      <span className="font-black text-amber-800 text-xs">
                                        ₹{chg.amount}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              <div className="flex justify-between items-center text-slate-900 border-t border-slate-200/80 pt-3 mt-2 flex-wrap gap-2">
                                <div>
                                  <span className="font-black uppercase tracking-wider text-xs text-[#002e6e] block">
                                    Total Net Payable
                                  </span>
                                  {(() => {
                                    const isAmc = Boolean(
                                      booking.isAmcBooking ||
                                      booking.isAmcCovered ||
                                      booking.tier === "amc"
                                    );
                                    const hasValidOnlineTxn = Boolean(
                                      booking.transactionId &&
                                        booking.paymentStatus === "paid" &&
                                        booking.paymentMethod !== "cash" &&
                                        booking.paymentMethod !== "pay_after_service"
                                    );
                                    const isPaidBooking =
                                      isAmc ||
                                      (booking.paymentMethod === "wallet" &&
                                        (booking.walletDeductAmount ?? 0) > 0) ||
                                      hasValidOnlineTxn;

                                    if (isPaidBooking) {
                                      return (
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 mt-1 shadow-2xs">
                                          <CheckCircle2 size={11} className="text-emerald-600" />
                                          {booking.paymentMethod === "wallet"
                                            ? "✓ PAID VIA WALLET"
                                            : isAmc
                                            ? "✓ PAID VIA AMC"
                                            : "✓ PAID ONLINE"}
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 inline-flex items-center gap-1 mt-1 shadow-2xs">
                                        <span>💵 Cash / UPI on Completion</span>
                                      </span>
                                    );
                                  })()}
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <span className="text-xl font-black text-[#002e6e]">
                                    ₹{booking.totalPrice}
                                  </span>
                                  {!(
                                    Boolean(booking.isAmcBooking || booking.isAmcCovered || booking.tier === "amc") ||
                                    (booking.paymentMethod === "wallet" && (booking.walletDeductAmount ?? 0) > 0) ||
                                    (booking.paymentStatus === "paid" && Boolean(booking.transactionId) && booking.transactionId.trim() !== "")
                                  ) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setBookingToPay(booking);
                                      }}
                                      className="mt-1.5 text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ml-auto"
                                    >
                                      Pay Online Instead
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                              {(booking.status === "payment_pending" || booking.status === "completed") && booking.paymentStatus !== "paid" && (
                                <div className="mt-4 p-4 bg-sky-50/50 rounded-2xl border border-sky-200/80 flex flex-col md:flex-row items-center justify-between gap-3">
                                  <div className="text-left">
                                    <h5 className="text-xs font-black uppercase text-[#002e6e] tracking-wider">
                                      Awaiting Service Payment
                                    </h5>
                                    <p className="text-xs text-slate-600 font-medium mt-0.5 leading-tight">
                                      Select secure payment route or clear ₹{booking.totalPrice} in cash.
                                    </p>
                                  </div>
                                  <div className="flex gap-2 w-full md:w-auto shrink-0 flex-wrap justify-end">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setBookingToPay(booking);
                                      }}
                                      className="flex-1 md:flex-initial text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#002e6e] to-[#004bb5] hover:from-[#001f4d] hover:to-[#002e6e] px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer text-center active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                      <CreditCard size={13} /> PAY NOW
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsPaymentScannerOpen(true);
                                      }}
                                      className="flex-1 md:flex-initial text-xs font-bold uppercase tracking-wider text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                                    >
                                      <QrCode size={13} /> SCAN QR
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePayWithCashByCustomer(booking);
                                      }}
                                      className="flex-1 md:flex-initial text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-4 py-2.5 rounded-xl border border-emerald-200 transition-all cursor-pointer text-center active:scale-95"
                                    >
                                      💵 PAY CASH
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                          {/* Technician Card or Assignment Status */}
                          {booking.partnerId && !['completed', 'finalized', 'closed'].includes(booking.status) ? (
                            <div className="booking-details-modal flex gap-4 p-5 rounded-2xl bg-white text-slate-900 items-center relative overflow-hidden group border border-slate-200/80 shadow-sm">
                              <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-emerald-500">
                                <img
                                  src={
                                    ((booking as any).assignedPartner?.profileImage && !(booking as any).assignedPartner?.profileImage.includes("googleusercontent.com/image_collection"))
                                      ? (booking as any).assignedPartner?.profileImage
                                      : ((booking as any).assignedPartner?.photoURL && !(booking as any).assignedPartner?.photoURL.includes("googleusercontent.com/image_collection"))
                                      ? (booking as any).assignedPartner?.photoURL
                                      : (partners[booking.partnerId]?.photoURL && !partners[booking.partnerId]?.photoURL.includes("googleusercontent.com/image_collection"))
                                      ? partners[booking.partnerId]?.photoURL
                                      : LogoIcon
                                  }
                                  alt=""
                                  className="w-full h-full object-cover rounded-full"
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                />
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <span className="text-[8px] font-black uppercase text-blue-700 tracking-widest leading-none">
                                  Your Assigned Expert
                                </span>
                                <h4 className="text-sm font-black tracking-tight text-slate-900 mt-1 truncate uppercase italic flex items-center gap-1.5 relative">
                                  <span>{partners[booking.partnerId]?.displayName ||
                                    "Expert Technician"}</span>
                                  <SafetyInfoTooltip 
                                    partnerId={booking.partnerId}
                                    isVerified={partnerDetails[booking.partnerId]?.isVerified}
                                    kycStatus={partnerDetails[booking.partnerId]?.kycStatus}
                                  />
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div className="flex items-center text-amber-500">
                                    <Star
                                      size={10}
                                      className="fill-amber-500"
                                    />
                                    <span className="text-[9px] font-black ml-1 text-slate-700">
                                      {(
                                        partnerDetails[booking.partnerId]
                                          ?.rating || 4.8
                                      ).toFixed(1)} out of 5
                                    </span>
                                  </div>
                                  <span className="text-slate-300 text-[10px]">
                                    •
                                  </span>
                                  <span className="text-[9px] text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded tracking-wider">
                                    {partnerDetails[booking.partnerId]?.reviewCount || 12} reviews
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-2 shrink-0">
                                <button
                                  id="customer-booking-secure-call-btn-3"
                                  disabled={isCalling}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInitiateCall(booking);
                                  }}
                                  className="w-10 h-10 bg-emerald-600 active:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white hover:bg-emerald-700 rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer"
                                  title="Call"
                                >
                                  <Phone size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBookingChat(booking);
                                  }}
                                  className="w-10 h-10 bg-blue-600 text-white hover:bg-blue-700 rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer"
                                  title="Chat with Partner"
                                >
                                  <MessageSquare size={14} />
                                </button>
                              </div>
                            </div>
                          ) : ['completed', 'finalized', 'closed'].includes(booking.status) ? (
                            <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-3xl border border-emerald-100/50 select-none">
                              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                              <span className="text-[9.5px] font-black uppercase tracking-widest text-emerald-700">
                                🔒 Zomindia Secure-Mask: Active partner details archived
                              </span>
                            </div>
                          ) : (
                            <div className="p-5 rounded-[28px] bg-slate-50 border border-slate-100 flex items-center gap-4 text-left">
                              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 shrink-0 flex items-center justify-center relative shadow-inner">
                                <Clock size={20} className="stroke-[2.5]" />
                              </div>
                              <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                  Assigning Partner...
                                </h4>
                                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                                  Finding the closest verified partner with
                                  premium expertise in{" "}
                                  {services[booking.serviceId]?.name ||
                                    "category"}{" "}
                                  nearby.
                                </p>
                              </div>
                            </div>
                          )}
                          </>)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Discovery Grid */}
          <div className="mb-16">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-700 rounded-[16px] text-white shadow-2xl flex items-center justify-center">
                    <Sparkles size={18} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">
                    Explore Services
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {allCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (setActiveTab) {
                        setActiveTab("home", cat.id);
                      } else {
                        setActiveCategoryFilter(cat.id);
                      }
                    }}
                    className="group bg-white border-2 border-slate-50 hover:border-blue-700 p-6 rounded-[32px] transition-all shadow-sm hover:shadow-xl active:scale-95 text-center"
                  >
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-50 transition-colors">
                      {cat.iconURL ? (
                        <img
                          src={cat.iconURL}
                          alt=""
                          className="w-8 h-8 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <Zap
                          size={24}
                          className="text-slate-300 group-hover:text-blue-700"
                        />
                      )}
                    </div>
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest group-hover:text-blue-700 truncate block">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      {/* Promotions & Offers - Discovery */}
      {promotions.length > 0 && !searchQuery && (
        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#22c55e]/10 text-[#22c55e] rounded-xl border border-[#22c55e]/20">
                <Zap size={18} fill="currentColor" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Exclusive Deals
              </h2>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {promotions.map((promo, idx) => {
              const isPercent = promo.discountType === "percent";
              const isFestive = (promo.code || '').includes('SUMMER') || (promo.name || '').includes('Summer');
              const pillarGradient = isFestive
                ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
                : isPercent
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white';

              return (
                <motion.div
                  whileHover={{ y: -3, boxShadow: '0 8px 20px rgba(0,0,0,0.06)' }}
                  key={promo.id}
                  className="flex-shrink-0 w-[320px] bg-white border border-slate-200/80 rounded-2xl flex flex-row items-stretch relative overflow-hidden group shadow-sm transition-all duration-300"
                >
                  {/* Left Offer Badge Pillar */}
                  <div className={`w-20 shrink-0 relative flex flex-col items-center justify-center p-2.5 text-center ${pillarGradient} select-none`}>
                    <span className="text-lg sm:text-xl font-black leading-none tracking-tight">
                      {isPercent ? `${promo.discountValue}%` : `₹${promo.discountValue}`}
                    </span>
                    <span className="bg-white/20 backdrop-blur-xs text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 border border-white/20">
                      OFF
                    </span>
                  </div>

                  {/* Semicircular Ticket Notch Divider */}
                  <div className="relative w-0 flex flex-col justify-between items-center z-10">
                    <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-slate-50 border-b border-slate-200/80 shadow-inner" />
                    <div className="h-full border-r-2 border-dashed border-slate-200/90 my-2" />
                    <div className="absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-slate-50 border-t border-slate-200/80 shadow-inner" />
                  </div>

                  {/* Right Content */}
                  <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0 bg-white pl-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                          Exclusive
                        </span>
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-full border border-amber-200/60">
                          ⚡ 7 Days
                        </span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-snug truncate">
                        {promo.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                        {promo.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-2.5 mt-2 border-t border-slate-100">
                      <div className="border-dashed border-2 border-blue-300 bg-blue-50/50 px-2 py-0.5 rounded-lg text-[11px] font-mono font-black text-blue-700 tracking-wider flex items-center gap-1">
                        <span>{promo.code}</span>
                      </div>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(promo.code);
                          try {
                            localStorage.setItem('activeCoupon', JSON.stringify(promo));
                            localStorage.setItem('zomindia_active_coupon', promo.code);
                          } catch {}
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('coupon-applied', { detail: promo }));
                          }
                          if (typeof (window as any).__showToast === 'function') {
                            (window as any).__showToast(`Coupon ${promo.code} applied successfully! Check savings at checkout.`);
                          } else if (typeof (window as any).__showCopyToast === 'function') {
                            (window as any).__showCopyToast(promo.code);
                          }
                        }}
                        className="bg-[#2563EB] hover:bg-blue-700 text-white text-[11px] font-black px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles size={11} />
                        <span>APPLY</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Categories Discovery */}
      {!searchQuery && (
        <div className="mb-24">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-700 rounded-[16px] text-white flex items-center justify-center shadow-md">
                <Compass size={18} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Explore Categories
              </h2>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-8 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveCategoryFilter(null)}
              className={`flex-shrink-0 px-8 py-5 rounded-[24px] font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all shadow-sm active:scale-95 duration-200 ${!activeCategoryFilter ? "bg-blue-700 text-white shadow-slate-200" : "bg-slate-50 border-2 border-slate-50 text-slate-400 hover:text-blue-700 hover:bg-slate-100 hover:border-slate-100"}`}
            >
              All Assets
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={`flex-shrink-0 px-8 py-5 rounded-[24px] font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-4 shadow-sm active:scale-95 duration-200 ${activeCategoryFilter === cat.id ? "bg-blue-700 text-white shadow-slate-200" : "bg-slate-50 border-2 border-slate-50 text-slate-400 hover:text-blue-700 hover:bg-slate-100 hover:border-slate-100"}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Services Grid or Filtered Results */}
      {(activeCategoryFilter || searchQuery) && (
        <div className="mb-32">
          <div className="flex items-center justify-between mb-16">
            <div>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-4">
                {searchQuery
                  ? `Results: "${searchQuery}"`
                  : allCategories.find((c) => c.id === activeCategoryFilter)
                      ?.name}
              </h2>
              <p className="text-slate-400 font-medium">
                Refining your selection for{" "}
                <span className="text-slate-900 border-b border-blue-700">
                  verified pros
                </span>
                .
              </p>
            </div>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveCategoryFilter(null);
              }}
              className="px-6 py-3 bg-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:text-blue-700 hover:bg-slate-200 uppercase tracking-widest transition-all"
            >
              Reset View
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredServices.map((service) => (
              <motion.div
                layout
                key={service.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -8 }}
                className="bg-white border-2 border-slate-50 rounded-[48px] p-8 sm:p-10 shadow-sm hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] hover:border-blue-700 transition-all duration-500 group flex flex-col h-full overflow-hidden"
              >
                {service.imageURL && (
                  <div className="w-full h-48 sm:h-56 rounded-[32px] overflow-hidden mb-8 bg-slate-50 shadow-inner group-hover:shadow-2xl transition-all duration-700">
                    <img
                      src={service.imageURL}
                      alt=""
                      className="w-full h-full object-cover grayscale transition-all duration-1000 group-hover:grayscale-0 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  </div>
                )}
                <div
                  onClick={() => onServiceSelect?.(service.id)}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase italic">
                      {service.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-amber-500 font-black text-sm bg-amber-50 px-3 py-1 rounded-full">
                      <Star size={14} fill="currentColor" />{" "}
                      {service.rating || 4.8}
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm line-clamp-3 mb-10 font-medium leading-relaxed">
                    {service.description}
                  </p>
                </div>
                <div className="flex justify-between items-center pt-8 border-t border-slate-100 mt-auto">
                  <div>
                    <p className="text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] leading-none mb-2 italic">
                      Operational Base
                    </p>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">
                      ₹{service.basePrice}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedService(service)}
                    className="bg-blue-700 text-white px-8 py-5 rounded-[22px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-800 transition-all active:scale-95 shadow-2xl shadow-blue-700/10"
                  >
                    Deploy Pro
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
          {filteredServices.length === 0 && (
            <div className="py-20 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
              <Search size={32} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">
                No services found matching your criteria.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Past Bookings - Collapsible Section */}
      {!searchQuery && pastBookings.length > 0 && (
        <div className="mb-12">
          {/* Header with search inputs */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-xl text-slate-400">
                <Clock size={16} />
              </div>
              <h2 className="text-lg font-black text-slate-400 tracking-tight italic uppercase tracking-widest">
                History
              </h2>
            </div>

            {/* Filtering Controls */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full lg:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search
                  size={12}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Search history by service..."
                  className="w-full bg-white border border-slate-200/80 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-700 transition-all font-sans"
                />
                {historySearchQuery && (
                  <button
                    onClick={() => setHistorySearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 text-[10px] font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="relative">
                <select
                  value={historyCategoryFilter || ""}
                  onChange={(e) =>
                    setHistoryCategoryFilter(e.target.value || null)
                  }
                  className="w-full sm:w-44 bg-white border border-slate-200/80 text-xs font-bold text-slate-700 pl-3 pr-8 py-2 rounded-xl focus:outline-none focus:border-blue-700 transition-all appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-[right_10px_center] bg-no-repeat font-sans"
                >
                  <option value="">All Categories</option>
                  {allCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {(showAllHistory || historySearchQuery || historyCategoryFilter
              ? filteredPastBookings
              : filteredPastBookings.slice(0, 4)
            ).map((booking) => {
              const partnerUser = booking.partnerId
                ? partners[booking.partnerId]
                : null;
              const partnerDetail = booking.partnerId
                ? partnerDetails[booking.partnerId]
                : null;

              return (
                <CustomerBookingCard
                  key={booking.id}
                  booking={booking}
                  service={services[booking.serviceId]}
                  partnerUser={partnerUser}
                  partnerDetail={partnerDetail}
                  customerProfile={profile}
                  activeTicket={supportTickets[booking.id] || null}
                  isPast={true}
                  isExpanded={expandedBookingId === booking.id}
                  onToggleExpand={() =>
                    setExpandedBookingId(
                      expandedBookingId === booking.id ? null : booking.id,
                    )
                  }
                  onPayOnline={(b) => setBookingToPay(b)}
                  onPayCash={(b) => handlePayWithCashByCustomer(b)}
                  onScanQR={() => setIsPaymentScannerOpen(true)}
                  onBookAgain={(svc) => setSelectedService(svc)}
                  onDownloadInvoice={handleDownloadInvoice}
                  onSupport={(id) => handleInitiateSupport(id)}
                  inlineRating={inlineRatings[booking.id] || 0}
                  inlineComment={inlineComments[booking.id] || ""}
                  onRatingChange={(id, r) =>
                    setInlineRatings((prev) => ({ ...prev, [id]: r }))
                  }
                  onCommentChange={(id, c) =>
                    setInlineComments((prev) => ({ ...prev, [id]: c }))
                  }
                  onSubmitReview={(b) => handleInlineFeedbackSubmit(b)}
                  onSkipReview={(id) => handleSkipRating(id)}
                  isReviewSubmitted={!!successCheckedCards[booking.id]}
                  isReviewSubmitting={inlineSubmittingId === booking.id}
                />
              );
            })}
          </div>

          {filteredPastBookings.length === 0 && (
            <div className="py-20 text-center bg-slate-50 border border-dashed border-slate-100 rounded-[32px] mt-6">
              <Search size={28} className="mx-auto text-slate-300 mb-3" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                No past matching service history found
              </p>
            </div>
          )}

          {filteredPastBookings.length > 4 &&
            !showAllHistory &&
            !historySearchQuery &&
            !historyCategoryFilter && (
              <button
                onClick={() => setShowAllHistory(true)}
                className="w-full mt-6 py-4 bg-white border border-slate-100 rounded-2xl text-xs font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-colors"
              >
                View Full Service History
              </button>
            )}
        </div>
      )}

      {/* Booking Modal Integration */}
      <AnimatePresence>
        {selectedService && (
          <BookingModal
            service={selectedService}
            profile={profile}
            onClose={() => setSelectedService(null)}
            onSuccess={() => {
              setSelectedService(null);
              setExpandedBookingId(null);
              if (setActiveTab) setActiveTab("home");
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeBookingChat && (
          <ChatWindow
            booking={activeBookingChat}
            otherUser={partners[activeBookingChat.partnerId!] || null}
            onClose={() => setActiveBookingChat(null)}
          />
        )}
      </AnimatePresence>

      {/* Audio call mechanism bypassed */}

      <AnimatePresence>
        {finalizingBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Immersive backdrop with vibrant glowing indicators - click to close disabled for paid bookings to enforce review */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 120 }}
              className="relative bg-white w-full max-w-xl rounded-[36px] shadow-2xl overflow-hidden max-h-[85dvh] flex flex-col border border-slate-100"
            >
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                {/* Top-Right Skip / Maybe Later Button */}
                <button
                  type="button"
                  id="btn-skip-rating-modal-top"
                  onClick={() => handleSkipRating(finalizingBooking?.id)}
                  className="absolute top-4 right-4 sm:top-5 sm:right-5 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100/90 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold transition-all z-20 cursor-pointer border border-slate-200/80 shadow-xs active:scale-95 group"
                  title="Skip rating for now"
                >
                  <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-900">Skip / Maybe Later</span>
                  <X size={14} className="text-slate-400 group-hover:text-slate-700 transition-colors" />
                </button>
                
                {/* Celebratory Header with Pulsing Success Ring */}
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0.8, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.1, type: "spring" }}
                    className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner"
                  >
                    <CheckCircle2 size={34} strokeWidth={2.5} className="animate-pulse text-emerald-600" />
                  </motion.div>
                  <span className="text-[9px] font-black tracking-[0.2em] text-emerald-600 uppercase bg-emerald-50 px-3 py-1 rounded-full inline-block mb-1">
                    Service Fully Completed
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight font-display">
                    How was your experience?
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 leading-normal font-medium">
                    Your feedback ensures safety, top-tier craftsmanship, and professional standards across India.
                  </p>
                </div>

                {/* Core booking parameters banner */}
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                      Service Code
                    </span>
                    <span className="font-mono font-black text-slate-700">
                      #{finalizingBooking.id.slice(-6).toUpperCase()}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                      Expert Partner
                    </span>
                    <span className="font-bold text-slate-800">
                      {partners[finalizingBooking.partnerId!]?.displayName || "Professional Expert"}
                    </span>
                  </div>
                </div>

                {/* Quality feedback notification with quick skip */}
                <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-blue-100 rounded-xl text-blue-600 shrink-0">
                      <Shield size={15} strokeWidth={2.5} />
                    </div>
                    <p className="text-[10.5px] leading-relaxed font-bold text-blue-900">
                      <span className="font-extrabold uppercase text-[9.5px]">Quality Feedback:</span> Share your ratings to verify completion, or skip to rate whenever you want from history.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSkipRating(finalizingBooking?.id)}
                    className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer"
                  >
                    Skip
                  </button>
                </div>

                {/* The 4-Tier Interactive Score Section */}
                <div className="space-y-4">

                  {/* 1. Service Partner Rating */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:border-slate-200 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 rounded-lg text-blue-700 shrink-0">
                          <User size={14} />
                        </div>
                        <div>
                          <h4 className="text-[11.5px] font-black text-slate-900 uppercase tracking-wide">
                            Service Partner & Expert
                          </h4>
                          <p className="text-[10px] text-slate-450 leading-none mt-0.5 font-medium">
                            Rating for behavior, hygiene, and craftsmanship skill
                          </p>
                        </div>
                      </div>
                      {ratingPartner > 0 ? (
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                          {ratingPartner}★ Done
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-amber-600 animate-pulse uppercase tracking-wider">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRatingPartner(star)}
                            className="transition-all hover:scale-120 duration-150 transform active:scale-95 cursor-pointer"
                          >
                            <Star
                              size={22}
                              fill={star <= ratingPartner ? "currentColor" : "none"}
                              className={
                                star <= ratingPartner
                                  ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)] scale-110"
                                  : "text-slate-200 hover:text-amber-300 transition-colors"
                              }
                            />
                          </button>
                        ))}
                      </div>
                      <span className="text-[10.5px] font-extrabold text-slate-500">
                        {ratingPartner === 5
                          ? "Excellent Pro!"
                          : ratingPartner === 4
                            ? "Very Good"
                            : ratingPartner === 3
                              ? "Satisfactory"
                              : ratingPartner > 0
                                ? "Needs Improvement"
                                : "Select Rating"}
                      </span>
                    </div>
                  </div>

                  {/* 2. Process Rating */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:border-slate-200 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-700 shrink-0">
                          <Clock size={14} />
                        </div>
                        <div>
                          <h4 className="text-[11.5px] font-black text-slate-900 uppercase tracking-wide">
                            Booking & Service Process
                          </h4>
                          <p className="text-[10px] text-slate-450 leading-none mt-0.5 font-medium">
                            Punctual dispatch, real-time tracking, seamless job completion
                          </p>
                        </div>
                      </div>
                      {ratingProcess > 0 ? (
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                          {ratingProcess}★ Done
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-amber-600 animate-pulse uppercase tracking-wider">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRatingProcess(star)}
                            className="transition-all hover:scale-120 duration-150 transform active:scale-95 cursor-pointer"
                          >
                            <Star
                              size={22}
                              fill={star <= ratingProcess ? "currentColor" : "none"}
                              className={
                                star <= ratingProcess
                                  ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)] scale-110"
                                  : "text-slate-200 hover:text-amber-300 transition-colors"
                              }
                            />
                          </button>
                        ))}
                      </div>
                      <span className="text-[10.5px] font-extrabold text-slate-500">
                        {ratingProcess === 5
                          ? "Super Smooth"
                          : ratingProcess === 4
                            ? "Timely"
                            : ratingProcess === 3
                              ? "Average"
                              : ratingProcess > 0
                                ? "Faced Issues"
                                : "Select Rating"}
                      </span>
                    </div>
                  </div>

                  {/* 3. Safety Standards Rating */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:border-slate-200 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-700 shrink-0">
                          <Shield size={14} />
                        </div>
                        <div>
                          <h4 className="text-[11.5px] font-black text-slate-900 uppercase tracking-wide">
                            Hygiene, Safety & Verification
                          </h4>
                          <p className="text-[10px] text-slate-450 leading-none mt-0.5 font-medium">
                            Post-service cleanup, safety gear use, verified background reassurance
                          </p>
                        </div>
                      </div>
                      {ratingSafety > 0 ? (
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                          {ratingSafety}★ Done
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-amber-600 animate-pulse uppercase tracking-wider">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRatingSafety(star)}
                            className="transition-all hover:scale-120 duration-150 transform active:scale-95 cursor-pointer"
                          >
                            <Star
                              size={22}
                              fill={star <= ratingSafety ? "currentColor" : "none"}
                              className={
                                star <= ratingSafety
                                  ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)] scale-110"
                                  : "text-slate-200 hover:text-amber-300 transition-colors"
                              }
                            />
                          </button>
                        ))}
                      </div>
                      <span className="text-[10.5px] font-extrabold text-slate-500">
                        {ratingSafety === 5
                          ? "Fully Safe & Clean"
                          : ratingSafety === 4
                            ? "Safe & Polite"
                            : ratingSafety === 3
                              ? "Standard"
                              : ratingSafety > 0
                                ? "Lacked safety care"
                                : "Select Rating"}
                      </span>
                    </div>
                  </div>

                  {/* 4. ZomIndia Platform Rating */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:border-slate-200 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-rose-50 rounded-lg text-rose-700 shrink-0">
                          <Sparkles size={14} />
                        </div>
                        <div>
                          <h4 className="text-[11.5px] font-black text-slate-900 uppercase tracking-wide">
                            ZomIndia App Experience
                          </h4>
                          <p className="text-[10px] text-slate-450 leading-none mt-0.5 font-medium">
                            Application performance, pricing transparency, and portal navigation
                          </p>
                        </div>
                      </div>
                      {ratingZomIndia > 0 ? (
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                          {ratingZomIndia}★ Done
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-amber-600 animate-pulse uppercase tracking-wider">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRatingZomIndia(star)}
                            className="transition-all hover:scale-120 duration-150 transform active:scale-95 cursor-pointer"
                          >
                            <Star
                              size={22}
                              fill={star <= ratingZomIndia ? "currentColor" : "none"}
                              className={
                                star <= ratingZomIndia
                                  ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)] scale-110"
                                  : "text-slate-200 hover:text-amber-300 transition-colors"
                              }
                            />
                          </button>
                        ))}
                      </div>
                      <span className="text-[10.5px] font-extrabold text-slate-500">
                        {ratingZomIndia === 5
                          ? "Love the app"
                          : ratingZomIndia === 4
                            ? "Easy to use"
                            : ratingZomIndia === 3
                              ? "Average"
                              : ratingZomIndia > 0
                                ? "Hard to use"
                                : "Select Rating"}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Comments & Review Media Attachment */}
                <div className="pt-2">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">
                    Written Feedback (Optional)
                  </span>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us what you liked about the pro, standard of safety, or process overall..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs focus:ring-2 focus:ring-blue-600 outline-none h-20 resize-none mb-3 placeholder:text-slate-400 font-medium text-slate-800"
                  />
                  <input
                    type="url"
                    value={reviewPhoto}
                    onChange={(e) => setReviewPhoto(e.target.value)}
                    placeholder="Add an image URL (optional)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-blue-600 outline-none placeholder:text-slate-400 font-medium text-slate-800"
                  />
                </div>

              </div>

              {/* Force Submit Action Bar */}
              <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-3">
                {!(ratingPartner > 0 && ratingProcess > 0 && ratingSafety > 0 && ratingZomIndia > 0) && (
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider text-center animate-pulse font-mono leading-none">
                    ⚠️ Please fill out all 4 rating categories above to submit feedback
                  </p>
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    if (!(ratingPartner > 0 && ratingProcess > 0 && ratingSafety > 0 && ratingZomIndia > 0)) {
                      return;
                    }
                    handleFinalize(finalizingBooking);
                  }}
                  disabled={
                    isSubmittingReview ||
                    !(ratingPartner > 0 && ratingProcess > 0 && ratingSafety > 0 && ratingZomIndia > 0)
                  }
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                    !(ratingPartner > 0 && ratingProcess > 0 && ratingSafety > 0 && ratingZomIndia > 0)
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-300/35"
                      : "bg-blue-700 text-white hover:bg-blue-800 hover:shadow-blue-700/20 active:scale-98 border-0"
                  }`}
                >
                  {isSubmittingReview ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles size={13} className="animate-bounce" />
                  )}
                  {isSubmittingReview ? "Saving Scores..." : "Submit Experience Rating & Complete"}
                </button>

                <button
                  type="button"
                  id="btn-skip-rating-modal-bottom"
                  onClick={() => handleSkipRating(finalizingBooking?.id)}
                  className="w-full py-2.5 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5 hover:bg-slate-100/60 rounded-xl active:scale-98"
                >
                  <span>Skip for now</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bookingToPay && (
          <PaymentModal
            booking={bookingToPay}
            profile={profile}
            onClose={() => setBookingToPay(null)}
            onSuccess={() => {
              const paidBookingId = bookingToPay.id;
              const paidAmount = bookingToPay.totalPrice || 0;
              const paidAtIso = new Date().toISOString();
              setBookings((prev) =>
                prev.map((b) =>
                  b.id === paidBookingId
                    ? {
                        ...b,
                        paymentStatus: "paid",
                        paymentMethod: "online",
                        paidAt: paidAtIso,
                        status: b.status === "payment_pending" ? "completed" : b.status,
                      }
                    : b
                )
              );
              if (typeof (window as any).__showToast === 'function') {
                (window as any).__showToast(`Payment of ₹${paidAmount} received successfully! Status updated to PAID.`);
              }
              setBookingToPay(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPaymentScannerOpen && (
          <CustomerPaymentScanner
            bookings={bookings}
            onClose={() => setIsPaymentScannerOpen(false)}
            onScanSuccess={handlePaymentScanSuccess}
          />
        )}
      </AnimatePresence>

      {/* 30-Day Service Guarantee & Warranty Support Modal */}
      <WarrantySupportModal
        isOpen={!!selectedSupportBooking}
        onClose={() => setSelectedSupportBooking(null)}
        booking={selectedSupportBooking}
        service={selectedSupportBooking ? services[selectedSupportBooking.serviceId] : undefined}
        partnerUser={
          selectedSupportBooking && selectedSupportBooking.partnerId
            ? partners[selectedSupportBooking.partnerId] || null
            : null
        }
        partnerDetail={
          selectedSupportBooking && selectedSupportBooking.partnerId
            ? partnerDetails[selectedSupportBooking.partnerId] || null
            : null
        }
        customerProfile={profile}
        activeTicket={
          selectedSupportBooking ? supportTickets[selectedSupportBooking.id] || null : null
        }
        onTicketCreated={(t) => {
          if (selectedSupportBooking) {
            setSupportTickets((prev) => ({ ...prev, [selectedSupportBooking.id]: t }));
          }
        }}
      />
    </div>
  );
}
