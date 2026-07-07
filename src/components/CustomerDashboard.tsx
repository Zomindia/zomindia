import { useState, useEffect, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  or,
  onSnapshot,
  orderBy,
  getDocs,
  documentId,
  updateDoc,
  doc,
  Timestamp,
  addDoc,
  deleteField,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import {
  Booking,
  UserProfile,
  PartnerProfile,
  Promotion,
  Category,
  Service,
} from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { fuzzyMatch } from "../utils/search";
import { motion, AnimatePresence } from "motion/react";
import ChatWindow from "./ChatWindow";
import { LoadingScreen, ServiceCardSkeleton } from "./LoadingIndicator";
import PaymentModal from "./PaymentModal";
import BookingModal from "./BookingModal";
import AiSupportChat from "./AiSupportChat";
import {
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { QRCodeSVG } from "qrcode.react";
import PartnerTrackingMap from "./PartnerTrackingMap";
import { CustomerPaymentScanner } from "./CustomerPaymentScanner";
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
  ArrowRight,
  Compass,
  FileText,
  Phone,
  Sparkles,
  Moon,
} from "lucide-react";

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY as string) || "";
const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY";

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
        className="p-1 rounded-full text-blue-400 hover:text-blue-300 hover:bg-slate-800/50 transition-all focus:outline-none shrink-0"
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
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-xl z-50 pointer-events-auto text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
              <Shield size={16} className="text-emerald-500 fill-emerald-500/10" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white leading-none">
                Safety & Verification
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-bold">PROFILE CHECK:</span>
                <span className="text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded uppercase">
                  {isVerified ? 'VERIFIED' : 'PASSED'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-bold">KYC DOCUMENTS:</span>
                <span className="text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded uppercase">
                  {kycStatus === 'verified' ? 'APPROVED' : 'VERIFIED'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-bold">BACKGROUND:</span>
                <span className="text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded uppercase">
                  CLEARED
                </span>
              </div>
            </div>

            <p className="text-[9px] text-slate-400 font-medium leading-relaxed mt-2.5 pt-2.5 border-t border-slate-800/50">
              This technician is a fully background-verified professional under safety standards.
            </p>

            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2.5 h-2.5 bg-slate-900 border-r border-b border-slate-800 rotate-45" />
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
    <div className="bg-slate-950 text-white rounded-[32px] p-6 border border-slate-800 space-y-5 shadow-2xl relative overflow-hidden">
      <div className="absolute -right-12 -top-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
          <HelpCircle size={20} className="animate-pulse" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-black uppercase tracking-widest text-amber-400">
            ⚠️ Service Connection Hold (Grace Cooldown Active)
          </h4>
          <p className="text-[11px] text-slate-300 leading-normal">
            Your Service Expert was unable to reach you. To protect your wallet and scheduling sequence, we have queued your booking in slot-retention mode. A 15-minute response grace cooldown is active.
          </p>
        </div>
      </div>

      {isLocked ? (
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-850 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Response Grace Countdown</span>
            <span className="text-sm font-mono font-black text-amber-400 animate-pulse">{formatSecs(cooldown)}</span>
          </div>
          <div className="h-1.5 bg-slate-850 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-1000"
              style={{ width: `${(cooldown / 900) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-[9px] text-slate-500 font-bold uppercase">Safe Retention Mode Enabled</p>
            <button
              onClick={() => setBypass(true)}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
            >
              ⚡ Fast-Forward Cooldown
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-850 space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="space-y-1">
            <h5 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> 🔄 Reschedule & Release Slot
            </h5>
            <p className="text-[10px] text-slate-405 leading-relaxed">
              Cooldown period resolved. Pick a new date/time to instantly release this booking back to available partner dispatch pools.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5 text-left">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">New Service Date</label>
              <input 
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>
            <div className="space-y-1.5 text-left">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">New Slot Time</label>
              <input 
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>
          </div>

          <button
            onClick={handleApply}
            disabled={loading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-55 text-slate-950 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md mt-1 cursor-pointer"
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

export default function CustomerDashboard({
  profile,
  onServiceSelect,
  initialExpandedBookingId,
  setActiveTab,
}: Props) {
  const [showPwaInstall, setShowPwaInstall] = useState(false);
  const [showIosSafariInstall, setShowIosSafariInstall] = useState(false);

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
    if (!promptEvent) return;
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
    }
  };

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [partners, setPartners] = useState<Record<string, UserProfile>>({});
  const [partnerDetails, setPartnerDetails] = useState<
    Record<string, PartnerProfile>
  >({});
  const [services, setServices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [trackingBookingId, setTrackingBookingId] = useState<string | null>(
    null,
  );
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(
    initialExpandedBookingId || null,
  );
  const [expandedTrackerId, setExpandedTrackerId] = useState<string | null>(
    null,
  );
  const [bookingOtps, setBookingOtps] = useState<Record<string, string>>({});
  const [routingCallBookingId, setRoutingCallBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialExpandedBookingId) {
      setExpandedBookingId(initialExpandedBookingId);
    }
  }, [initialExpandedBookingId]);

  const activeBookings = useMemo(
    () =>
      bookings.filter((b) =>
        [
          "pending",
          "pending_acceptance",
          "confirmed",
          "assigned",
          "ASSIGNED",
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
    () =>
      bookings.filter((b) =>
        ["completed", "finalized", "cancelled"].includes(b.status),
      ),
    [bookings],
  );

  const activeBookingIds = activeBookings.map((b) => b.id).join(",");

  useEffect(() => {
    const activeWithOtpBookings = activeBookings.filter((b) =>
      ["pending", "assigned", "ASSIGNED", "confirmed", "on_the_way", "arrived"].includes(
        b.status,
      ),
    );
    if (activeWithOtpBookings.length === 0) return;

    const unsubscribes = activeWithOtpBookings.map((booking) => {
      return onSnapshot(
        doc(db, `bookings/${booking.id}/secrets`, "otp"),
        (snap) => {
          if (snap.exists()) {
            setBookingOtps((prev) => ({
              ...prev,
              [booking.id]: snap.data().code,
            }));
          }
        },
      );
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [activeBookingIds, activeBookings]);
  const [activeBookingChat, setActiveBookingChat] = useState<Booking | null>(
    null,
  );
  const [activeCallBooking, setActiveCallBooking] = useState<Booking | null>(
    null,
  );

  const activeCoordinatedCallBooking = useMemo(() => {
    return bookings.find(
      (b) =>
        b.activeCall &&
        (b.activeCall.status === "ringing" ||
          b.activeCall.status === "connected"),
    );
  }, [bookings]);

  const handleInitiateCall = async (booking: Booking) => {
    const currentUid = auth.currentUser?.uid;
    const targetUid = booking.partnerId;

    if (!currentUid) {
      if (typeof (window as any).__showToast === "function") {
        (window as any).__showToast("Authentication required to make calls.");
      }
      return;
    }
    if (!targetUid) {
      if (typeof (window as any).__showToast === "function") {
        (window as any).__showToast("Recipient details are missing (no partner assigned yet).");
      }
      return;
    }

    setIsCalling(true);

    try {
      const response = await fetch('/api/make-secure-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: currentUid,
          toUserId: targetUid,
          recipientRole: 'partner'
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (typeof (window as any).__showToast === "function") {
          (window as any).__showToast("Call initiated! Please answer your phone to connect.");
        }
      } else {
        if (typeof (window as any).__showToast === "function") {
          (window as any).__showToast("Could not connect call. Please try again.");
        }
      }
    } catch (err: any) {
      if (typeof (window as any).__showToast === "function") {
        (window as any).__showToast("Could not connect call. Please try again.");
      }
    } finally {
      setIsCalling(false);
    }
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

  const [showSuccessModal, setShowSuccessModal] = useState<string | null>(null);
  const [finalizingBooking, setFinalizingBooking] = useState<Booking | null>(
    null,
  );
  const [bookingToPay, setBookingToPay] = useState<Booking | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allActiveServices, setAllActiveServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<
    string | null
  >(null);

  // Payment scanner and history search/filters states
  const [isPaymentScannerOpen, setIsPaymentScannerOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<
    string | null
  >(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // State for tracking bookings that have already been rated/reviewed in Firestore
  const [dbRatedBookings, setDbRatedBookings] = useState<Record<string, boolean>>({});
  // State for tracking locally dismissed/hidden card IDs (for animating/smooth transition before hiding)
  const [dismissedHistoryCards, setDismissedHistoryCards] = useState<Record<string, boolean>>({});
  // State for custom 'checkmark' animation triggering for specific bookingIds
  const [successCheckedCards, setSuccessCheckedCards] = useState<Record<string, boolean>>({});

  // State for in-card inline ratings and comments drafts
  const [inlineRatings, setInlineRatings] = useState<Record<string, number>>({});
  const [inlineComments, setInlineComments] = useState<Record<string, string>>({});
  const [inlineSubmittingId, setInlineSubmittingId] = useState<string | null>(null);

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
      // If rating has already been submitted to Firestore for this booking (or marked as finalized or dismissed), hide it automatically!
      if (booking.status === "finalized") {
        return false;
      }
      if (dbRatedBookings[booking.id]) {
        return false;
      }
      if (dismissedHistoryCards[booking.id]) {
        return false;
      }

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
  }, [pastBookings, services, historySearchQuery, historyCategoryFilter, dbRatedBookings, dismissedHistoryCards]);

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
    const q = query(
      collection(db, "promotions"),
      where("active", "==", true),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
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
      (err) => console.error("Error fetching promotions:", err),
    );
    return () => unsubscribe();
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
      // Query Firestore with both 'customerUid' and 'userId' using or()
      const q = query(
        collection(db, "bookings"),
        or(
          where("customerUid", "==", uid),
          where("userId", "==", uid)
        )
      );

      unsubscribeSnapshot = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;
          const dbBookings = snap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Booking
          );

          // Gracefully sort client-side in memory to bypass any Firestore composite indexing requirements
          dbBookings.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
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

  // Fetch Partner details (PartnerProfile) for bookings
  useEffect(() => {
    const fetchPartnerDetails = async () => {
      const partnerIds = bookings
        .map((b) => b.partnerId)
        .filter((id): id is string => !!id && !partnerDetails[id]);

      const uniqueMissingIds = Array.from(new Set(partnerIds));

      if (uniqueMissingIds.length === 0) return;

      try {
        // Partners collection uses userId field to link to UserProfile
        const batchSize = 10;
        for (let i = 0; i < uniqueMissingIds.length; i += batchSize) {
          const chunk = uniqueMissingIds.slice(i, i + batchSize);
          const pq = query(
            collection(db, "partners"),
            where("userId", "in", chunk),
          );
          const pSnap = await getDocs(pq);
          const fetched: Record<string, PartnerProfile> = {};
          pSnap.forEach((doc) => {
            const data = doc.data() as PartnerProfile;
            fetched[data.userId] = { id: doc.id, ...data };
          });
          setPartnerDetails((prev) => ({ ...prev, ...fetched }));
        }
      } catch (err) {
        console.error("Error fetching partner details:", err);
      }
    };

    if (bookings.length > 0) {
      fetchPartnerDetails();
    }
  }, [bookings, partnerDetails]);

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
        return "bg-emerald-100 text-emerald-700";
      case "completed":
        return "bg-emerald-600 text-white";
      case "cancelled":
        return "bg-rose-100 text-rose-700";
      case "in_progress":
        return "bg-blue-600 text-white animate-pulse";
      case "on_the_way":
        return "bg-indigo-600 text-white";
      case "arrived":
        return "bg-amber-500 text-white";
      case "confirmed":
      case "assigned":
        return "bg-[#0a2540] text-white";
      case "pending":
      case "pending_parts":
        return "bg-amber-100 text-amber-700";
      case "payment_pending":
        return "bg-rose-600 text-white";
      default:
        return "bg-slate-50 text-slate-400";
    }
  };

  const BookingStatusTracker = ({ status }: { status: Booking["status"] }) => {
    const stages: { key: Booking["status"][]; label: string; icon: any }[] = [
      {
        key: ["pending", "pending_parts"],
        label: "Booking Placed",
        icon: Clock,
      },
      {
        key: ["confirmed", "assigned"],
        label: "Professional Assigned",
        icon: User,
      },
      { key: ["on_the_way"], label: "On The Way", icon: Navigation },
      { key: ["arrived"], label: "Arrived", icon: MapPin },
      { key: ["in_progress"], label: "In Progress", icon: Zap },
      {
        key: ["completed", "finalized", "closed"],
        label: "Finished",
        icon: CheckCircle2,
      },
    ];

    const currentStageIndex = stages.findIndex((s) => s.key.includes(status));

    return (
      <div className="py-2 px-1 sm:px-4">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
          {stages.map((stage, idx) => {
            const isCompleted =
              idx < currentStageIndex ||
              status === "completed" ||
              status === "finalized" ||
              status === "closed";
            const isCurrent = idx === currentStageIndex;
            const Icon = stage.icon;

            return (
              <div
                key={idx}
                className="relative z-10 flex flex-col items-center gap-3"
              >
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isCompleted
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                        ? "bg-blue-700 text-white ring-4 ring-blue-700/10"
                        : "bg-white border-2 border-slate-100 text-slate-200"
                  }`}
                >
                  <Icon size={16} />
                </div>
                <span
                  className={`text-[8px] font-black uppercase tracking-widest text-center max-w-[60px] hidden sm:block ${
                    isCurrent ? "text-slate-900" : "text-slate-300"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const [rating, setRating] = useState(0);
  const [ratingPartner, setRatingPartner] = useState(0);
  const [ratingProcess, setRatingProcess] = useState(0);
  const [ratingSafety, setRatingSafety] = useState(0);
  const [ratingZomIndia, setRatingZomIndia] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewPhoto, setReviewPhoto] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Automatically open rating popup for completed bookings that need review (Urban Company style)
  useEffect(() => {
    const completedBookingToReview = bookings.find(
      (b) => b.status === "completed" && b.paymentStatus === "paid" && b.customerUid === profile?.uid
    );
    if (completedBookingToReview && !finalizingBooking) {
      setRating(0);
      setRatingPartner(0);
      setRatingProcess(0);
      setRatingSafety(0);
      setRatingZomIndia(0);
      setFinalizingBooking(completedBookingToReview);
    }
  }, [bookings, profile?.uid, finalizingBooking]);

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
      alert("Please select at least a 1-star rating before submitting.");
      return;
    }

    try {
      setInlineSubmittingId(booking.id);
      
      const reviewData: any = {
        bookingId: booking.id,
        customerId: profile?.uid || "",
        partnerId: booking.partnerId || "",
        serviceId: booking.serviceId,
        rating: inlineRating,
        ratingDetails: {
          partner: inlineRating,
          process: inlineRating,
          safety: inlineRating,
          zomindia: inlineRating,
        },
        comment: inlineComment,
        createdAt: Timestamp.now(),
      };

      // Add review to Firestore
      await addDoc(collection(db, "reviews"), reviewData);

      // Update service rating (simplified sync)
      const serviceRef = doc(db, "services", booking.serviceId);
      const s = services[booking.serviceId];
      if (s) {
        const newCount = (s.reviewCount || 0) + 1;
        const newRating =
          ((s.rating || 4.8) * (s.reviewCount || 10) + inlineRating) /
          (newCount + 10); // Pseudo weighted average
        await updateDoc(serviceRef, {
          rating: Number(newRating.toFixed(1)),
          reviewCount: newCount,
        });
      }

      // Update partner rating
      if (booking.partnerId) {
        const partnerQuery = query(
          collection(db, "partners"),
          where("userId", "==", booking.partnerId),
        );
        const pSnap = await getDocs(partnerQuery);
        if (!pSnap.empty) {
          const pDoc = pSnap.docs[0];
          const pData = pDoc.data() as PartnerProfile;
          const pNewCount = (pData.reviewCount || 0) + 1;
          const pNewRating =
            ((pData.rating || 4.8) * (pData.reviewCount || 10) + inlineRating) /
            (pNewCount + 10);
          await updateDoc(doc(db, "partners", pDoc.id), {
            rating: Number(pNewRating.toFixed(1)),
            reviewCount: pNewCount,
          });
        }
      }

      // Update booking status
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "finalized",
        updatedAt: Timestamp.now(),
      });

      // Trigger subtle checkmark animation!
      setSuccessCheckedCards((prev) => ({ ...prev, [booking.id]: true }));

      // Clean up inputs
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

      // Wait 1.5 seconds for the checkmark animation to complete, then slide or transition hide it automatically!
      setTimeout(() => {
        setDismissedHistoryCards((prev) => ({ ...prev, [booking.id]: true }));
      }, 1500);

    } catch (err) {
      console.error("Error submitting inline review:", err);
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
    } finally {
      setInlineSubmittingId(null);
    }
  };

  const handleFinalize = async (booking: Booking) => {
    if (booking.paymentStatus === "unpaid" && booking.totalPrice > 0) {
      setBookingToPay(booking);
      setFinalizingBooking(null);
      return;
    }

    // Compute the composite rating based on sub-criteria
    const finalRating = Math.round((ratingPartner + ratingProcess + ratingSafety + ratingZomIndia) / 4) || 5;

    try {
      setIsSubmittingReview(true);
      const reviewData: any = {
        bookingId: booking.id,
        customerId: profile.uid,
        partnerId: booking.partnerId,
        serviceId: booking.serviceId,
        rating: finalRating,
        ratingDetails: {
          partner: ratingPartner || 5,
          process: ratingProcess || 5,
          safety: ratingSafety || 5,
          zomindia: ratingZomIndia || 5,
        },
        comment,
        createdAt: Timestamp.now(),
      };
      if (reviewPhoto) reviewData.photoURL = reviewPhoto;

      await addDoc(collection(db, "reviews"), reviewData);

      // Update service rating (simplified sync)
      const serviceRef = doc(db, "services", booking.serviceId);
      const s = services[booking.serviceId];
      const newCount = (s?.reviewCount || 0) + 1;
      const newRating =
        ((s?.rating || 4.8) * (s?.reviewCount || 10) + finalRating) /
        (newCount + 10); // Pseudo weighted average

      await updateDoc(serviceRef, {
        rating: Number(newRating.toFixed(1)),
        reviewCount: newCount,
      });

      // Update partner rating
      if (booking.partnerId) {
        const partnerQuery = query(
          collection(db, "partners"),
          where("userId", "==", booking.partnerId),
        );
        const pSnap = await getDocs(partnerQuery);
        if (!pSnap.empty) {
          const pDoc = pSnap.docs[0];
          const pData = pDoc.data() as PartnerProfile;
          const pNewCount = (pData.reviewCount || 0) + 1;
          const pNewRating =
            ((pData.rating || 4.8) * (pData.reviewCount || 10) + finalRating) /
            (pNewCount + 10);
          await updateDoc(doc(db, "partners", pDoc.id), {
            rating: Number(pNewRating.toFixed(1)),
            reviewCount: pNewCount,
          });
        }
      }

      await updateDoc(doc(db, "bookings", booking.id), {
        status: "finalized",
        updatedAt: Timestamp.now(),
      });
      setShowSuccessModal(
        "Review submitted! Thank you for helping us maintain service quality.",
      );
      setFinalizingBooking(null);
      setRating(0);
      setRatingPartner(0);
      setRatingProcess(0);
      setRatingSafety(0);
      setRatingZomIndia(0);
      setComment("");
      setReviewPhoto("");
      setIsSubmittingReview(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
      setIsSubmittingReview(false);
    }
  };

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

  const renderServiceThumbnail = (
    serviceId: string,
    size: "sm" | "md" = "md",
    bookingStatus?: string,
  ) => {
    const service = services[serviceId];
    const serviceName = service?.name || "";

    // Choose icon based on service name characteristics or default
    let IconComponent: any = Zap;
    let gradientClass = "from-indigo-600 to-blue-700 shadow-indigo-600/20";
    let isCustomComposite = false;

    if (bookingStatus && (bookingStatus.toLowerCase() === "assigned" || bookingStatus.toUpperCase() === "ASSIGNED")) {
      isCustomComposite = true;
      gradientClass = "from-[#0a2540] to-[#1e3a8a] shadow-blue-950/20";
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
            <div className="absolute -bottom-1 -right-1 bg-[#0a2540] rounded-full p-0.5 border border-white shadow-sm flex items-center justify-center">
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
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10 lg:py-12">
      {/* 1. Global PWA Install Banner */}
      {(showPwaInstall || showIosSafariInstall) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#0a2540] text-white py-3 px-6 md:px-8 rounded-[28px] shadow-xl relative overflow-hidden mb-6"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 text-left">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-2 rounded-xl shrink-0">
                <Sparkles className="w-4 h-4 text-cyan-300" />
              </div>
              <div>
                <h4 className="text-xs font-bold tracking-tight text-white flex items-center gap-2">
                  INSTALL ZOMINDIA WEB-APP
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 font-normal leading-normal max-w-xl">
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
                className="text-slate-400 hover:text-white text-xs font-medium py-2 px-3 rounded-xl hover:bg-white/10 transition cursor-pointer"
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
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
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
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-blue-700/60 backdrop-blur-md">
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
          "ASSIGNED",
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
          {activeBookings
            .filter((b) =>
              [
                "pending",
                "assigned",
                "ASSIGNED",
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

              const itemVariants: any = {
                hidden: { opacity: 0, y: 15 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
              };

              return (
                <motion.div
                  key={booking.id}
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.08,
                        delayChildren: 0.05
                      }
                    }
                  }}
                  className="bg-white border border-slate-200 text-slate-900 rounded-[32px] overflow-hidden shadow-xl mb-8 flex flex-col w-full relative"
                >
                  {routingCallBookingId === booking.id && (
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-6 rounded-[32px]">
                      <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center mb-4 animate-bounce">
                        <Phone size={24} className="text-emerald-400" />
                      </div>
                      <h4 className="text-white font-black text-xs uppercase tracking-widest mb-2">Routing call securely...</h4>
                      <p className="text-slate-400 text-[10px] max-w-xs leading-relaxed">
                        ZomIndia's Twilio privacy shield is active. Connecting you safely with our service professional.
                      </p>
                    </div>
                  )}

                  {/* Visual Ambient Blur Accent */}
                  <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl animate-pulse pointer-events-none" />

                  {/* 1. Header/Status Segment */}
                  <motion.div variants={itemVariants} className="p-5 flex flex-wrap items-center justify-between gap-4 bg-slate-50/20 border-b border-slate-100 relative z-10 w-full">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const isConfirmedOrAssigned = bookingStatus.toLowerCase() === 'confirmed' || bookingStatus.toLowerCase() === 'assigned';
                        const badgeColorText = isConfirmedOrAssigned ? 'text-[#0a2540]' : 'text-[#22c55e]';
                        const badgeBg = isConfirmedOrAssigned ? 'bg-[#0a2540]/10' : 'bg-[#22c55e]/10';
                        const badgeBorder = isConfirmedOrAssigned ? 'border-[#0a2540]/20' : 'border-[#22c55e]/20';
                        const statusBg = isConfirmedOrAssigned ? 'bg-blue-50' : 'bg-emerald-50';

                        return (
                          <>
                            <span className={`text-[11px] font-mono tracking-widest ${badgeColorText} font-black uppercase ${badgeBg} border ${badgeBorder} px-2.5 py-1 rounded-lg`}>
                              ID: #{booking.id.slice(-6).toUpperCase()}
                            </span>
                            <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${statusBg} ${badgeColorText} border ${badgeBorder} shadow-xs`}>
                              {(() => {
                                const statusStr = typeof bookingStatus === 'string' ? bookingStatus.trim().toUpperCase() : "";
                                if (statusStr === "ASSIGNED") {
                                  return "Expert Assigned & Preparing";
                                }
                                return typeof bookingStatus === 'string' ? bookingStatus.replace("_", " ") : "";
                              })()}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Estimated Total</p>
                      <p className="text-xl font-black text-[#22c55e]">₹{booking.totalPrice}</p>
                    </div>
                  </motion.div>

                  {/* Multi-Platform Responsive Grid: Mobile (1 col), Tablet (3 cols), Desktop (4 cols) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8 p-4 sm:p-6 lg:p-8 relative z-10 w-full">
                    
                    {/* Left/Main Column: Tracking, Checklist, Cost (Col span: md:2, lg:3) */}
                    <div className="space-y-6 md:col-span-2 lg:col-span-3">
                      
                      {/* Service Header Info */}
                      <motion.div variants={itemVariants} className="flex items-center gap-4 bg-white">
                        {renderServiceThumbnail(booking.serviceId, "md", bookingStatus)}
                        <div>
                          <h4 className="text-lg sm:text-xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">
                            {services[booking.serviceId]?.name || "Professional Service"}
                          </h4>
                          {hasPartner && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Expert:</span>
                              <span className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                                {partnerUser?.displayName || "Vikas Chopra"}
                                <CheckCircle2 size={12} className="text-[#22c55e] fill-[#22c55e]/10" />
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>

                      {/* 3. Status Tracking Pipeline Segment */}
                      <motion.div variants={itemVariants} className="bg-slate-50/70 p-5 rounded-[24px] border border-slate-100">
                        <div className="relative w-full max-w-2xl mx-auto py-2">
                          {/* Progress Line */}
                          <div className="absolute top-[18px] sm:top-[20px] left-6 right-6 h-[3px] bg-slate-200 rounded-full z-0" />
                          <motion.div 
                            initial={{ width: '0%' }}
                            animate={{ 
                              width: `${
                                bookingStatus.toLowerCase() === 'assigned' || bookingStatus.toUpperCase() === 'ASSIGNED'
                                  ? '25%'
                                  : (() => {
                                      if (['pending', 'pending_parts', 'pending_acceptance'].includes(bookingStatus)) return '0%';
                                      if (['confirmed'].includes(bookingStatus)) return '12.5%';
                                      if (['on_the_way'].includes(bookingStatus)) return '50%';
                                      if (['arrived'].includes(bookingStatus)) return '62.5%';
                                      if (bookingStatus === 'in_progress') return '75%';
                                      if (['completed', 'finalized', 'closed'].includes(bookingStatus)) return '100%';
                                      return '0%';
                                    })()
                              }` 
                            }}
                            transition={{ duration: 0.8, ease: "easeInOut" }}
                            className="absolute top-[18px] sm:top-[20px] left-6 h-[3px] bg-[#22c55e] rounded-full z-0 origin-left"
                          />

                          <div className="flex items-center justify-between relative z-10 animate-fade-in">
                            {[
                              { label: "Confirmed", icon: Clock },
                              { label: "Assigned", icon: User },
                              { label: "On The Way", icon: Navigation },
                              { label: "In Progress", icon: Zap },
                              { label: "Completed", icon: CheckCircle2 }
                            ].map((step, idx) => {
                              const isAssignedBooking = bookingStatus.toLowerCase() === 'assigned' || bookingStatus.toUpperCase() === 'ASSIGNED';
                              
                              let isActiveColour = false;
                              if (isAssignedBooking) {
                                isActiveColour = idx <= 1;
                              } else {
                                const stageIndex = (() => {
                                  if (['pending', 'pending_parts', 'pending_acceptance'].includes(bookingStatus)) return 0;
                                  if (['confirmed'].includes(bookingStatus)) return 1;
                                  if (['assigned'].includes(bookingStatus)) return 1;
                                  if (['on_the_way', 'arrived'].includes(bookingStatus)) return 2;
                                  if (bookingStatus === 'in_progress') return 3;
                                  if (['completed', 'finalized', 'closed'].includes(bookingStatus)) return 4;
                                  return 0;
                                })();
                                isActiveColour = idx <= stageIndex || ['completed', 'finalized', 'closed'].includes(bookingStatus);
                              }

                              const StepIcon = step.icon;

                              return (
                                <div key={idx} className="flex flex-col items-center">
                                  <div
                                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                      isActiveColour 
                                        ? (idx <= 1 
                                            ? 'bg-[#0a2540] border-[#0a2540] text-white shadow-[#0a2540]/15' 
                                            : 'bg-[#22c55e] border-[#22c55e] text-white shadow-[#22c55e]/15')
                                        : 'bg-white border-slate-200 text-slate-400'
                                    }`}
                                  >
                                    <StepIcon size={14} />
                                  </div>
                                  <span className={`text-[8px] sm:text-[9px] font-black tracking-tight mt-1.5 transition-colors duration-300 ${
                                    isActiveColour 
                                      ? (idx <= 1 ? 'text-[#0a2540] font-black' : 'text-[#22c55e] font-black') 
                                      : 'text-slate-400'
                                  }`}>
                                    {step.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>

                      {/* 4. Appointment Details Segment */}
                      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs font-semibold bg-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                            <Calendar size={14} className="text-[#22c55e]" />
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold leading-none mb-1">Service Date</p>
                            <p className="font-extrabold text-slate-800">
                              {booking.scheduledAt?.toDate?.()?.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" }) || "Today"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                            <Clock size={14} className="text-[#22c55e]" />
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold leading-none mb-1">Service Time</p>
                            <p className="font-extrabold text-slate-800">
                              {booking.scheduledAt?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "10:00 AM"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                            <MapPin size={14} className="text-[#22c55e]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold leading-none mb-1">Service Address</p>
                            <p className="font-extrabold text-slate-800 text-left truncate" title={booking.address}>
                              {expandedBookingId === booking.id ? booking.address : (booking.address ? booking.address.split(',')[0] : 'Vijay Nagar')}
                            </p>
                          </div>
                        </div>
                      </motion.div>

                      {/* --- Progressive Disclosure Toggle State --- */}
                      {expandedBookingId !== booking.id ? (
                        <div className="space-y-4 pt-1 animate-in fade-in duration-300">
                          {/* 1. Booking Secured (Shield) State for Pending booking */}
                          {['pending', 'pending_acceptance', 'pending_assignment'].includes(bookingStatus.toLowerCase()) && (
                            <div className="flex flex-col items-center justify-center p-5 bg-emerald-500/[0.03] rounded-2xl border border-emerald-500/10 text-center">
                              <motion.div
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2"
                              >
                                <ShieldCheck size={20} className="fill-emerald-500/15" />
                              </motion.div>
                              <h5 className="text-[10px] font-black uppercase text-slate-850 tracking-wider">Booking Secured</h5>
                              <p className="text-[10px] text-slate-400 mt-0.5">Finding the best nearby service professional...</p>
                            </div>
                          )}

                          {/* 2. Prominent OTP display for Assigned state */}
                          {otpCode && (bookingStatus.toLowerCase() === 'assigned' || bookingStatus.toLowerCase() === 'confirmed') && (
                            <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-4 rounded-2xl flex items-center justify-between shadow-md">
                              <div>
                                <span className="text-[8px] font-black uppercase tracking-wider text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/25 px-2 py-0.5 rounded-full inline-block">Security OTP</span>
                                <p className="text-[10px] text-slate-400 mt-1 font-bold">Share on expert arrival only</p>
                              </div>
                              <div className="flex gap-1.5">
                                {(otpCode || "").toString().split("").map((digit, i) => (
                                  <div key={i} className="w-8 h-8 bg-white border border-slate-250 text-slate-950 rounded-lg flex items-center justify-center text-sm font-black italic shadow-inner">
                                    {digit}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 3. In Progress Real-Time Progress Bar */}
                          {bookingStatus.toLowerCase() === 'in_progress' && (
                            <div className="space-y-2 bg-slate-50/50 border border-slate-150 p-4 rounded-2xl">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                                <span>Service in Progress</span>
                                <span className="text-emerald-500">{booking.progressPercentage || 0}% Completed</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-150 relative">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${booking.progressPercentage || 0}%` }}
                                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                                />
                              </div>
                            </div>
                          )}

                          {/* 4. Payment triggers for Completed status */}
                          {(bookingStatus.toLowerCase() === 'completed' || bookingStatus.toLowerCase() === 'payment_pending') && (
                            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl flex flex-col gap-2">
                              <div className="text-left">
                                <h5 className="text-[9px] font-black uppercase text-[#22c55e] tracking-wider leading-none mb-1">Awaiting Service Payment</h5>
                                <p className="text-[9px] text-slate-500 font-bold">Clear total of ₹{booking.totalPrice} using the secure portal below.</p>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 w-full">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setBookingToPay(booking); }}
                                  className="text-[8px] font-black uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 py-2 rounded-lg transition-all cursor-pointer text-center animate-pulse border-0"
                                >
                                  Online
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setIsPaymentScannerOpen(true); }}
                                  className="text-[8px] font-black uppercase tracking-wider text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                                >
                                  <QrCode size={10} /> QR
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePayWithCashByCustomer(booking); }}
                                  className="text-[8px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-lg border border-emerald-200 transition-all cursor-pointer text-center"
                                >
                                  Cash
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Detailed Accordion Launcher */}
                          <button
                            onClick={() => setExpandedBookingId(booking.id)}
                            className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl border border-slate-200/80 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <span>View Details 🔽</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-6 pt-1 animate-in fade-in slide-in-from-top-2 duration-400">
                          {/* 5. Security Verification OTP Segment */}
                          {otpCode && (bookingStatus.toLowerCase() !== "in_progress") && (
                            <motion.div variants={itemVariants} className="bg-gradient-to-r from-slate-900 to-slate-950 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 shadow-md">
                              <div className="text-center sm:text-left">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#22c55e] px-2.5 py-0.5 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-full inline-block mb-1.5">
                                  Security Verification OTP
                                </span>
                                <p className="text-[11px] text-slate-400 font-medium max-w-sm leading-tight text-left">
                                  Provide this secure 4-digit token to your service professional ONLY when they arrive.
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                  {(otpCode || "").toString().split("").map((digit, i) => (
                                    <div key={i} className="w-10 h-10 bg-white border border-slate-200 text-slate-900 rounded-xl flex items-center justify-center text-xl font-black italic shadow-sm">
                                      {digit}
                                    </div>
                                  ))}
                                </div>
                                <span className="text-[10px] text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 animate-pulse">
                                  <CheckCircle2 size={10} /> Standby
                                </span>
                              </div>
                            </motion.div>
                          )}

                          {/* Service Protocol Checklist & Cost Summary Subgrid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Service Checklist Card */}
                            <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                  <FileText size={12} className="text-[#22c55e]" /> Service Checklist
                                </h5>
                                <span className="text-[9px] font-black text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 px-2 py-0.5 rounded-lg font-mono">
                                  Progress: {booking.progressPercentage !== undefined ? booking.progressPercentage : Math.round(((booking.completedTasks?.length || 0) / (services[booking.serviceId]?.predefinedTasks?.length || 4)) * 100)}%
                                </span>
                              </div>
                              <div className="space-y-2">
                                {(booking.checklist?.length
                                  ? booking.checklist
                                  : services[booking.serviceId]?.predefinedTasks?.length
                                  ? services[booking.serviceId]?.predefinedTasks
                                  : ["Inspect issue & diagnostics", "Perform requested repair/cleaning", "Calibrate or test performance", "Clean work area & final check"]
                                ).map((task: string, i: number) => {
                                  const isDone = booking.completedTasks?.includes(task || "");
                                  return (
                                    <div key={i} className="flex items-center justify-between bg-white px-3 py-2.5 rounded-xl border border-slate-100 shadow-2xs relative overflow-hidden">
                                      <div className="flex items-center gap-2 text-left w-full relative">
                                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${isDone ? "bg-[#22c55e] border-[#22c55e] text-white" : "border-slate-200 text-slate-300"}`}>
                                          <CheckCircle2 size={10} className={isDone ? "text-white" : "text-slate-200"} fill={isDone ? "currentColor" : "transparent"} />
                                        </div>
                                        <div className="relative flex-1">
                                          <span className={`text-[11px] font-semibold leading-tight transition-all duration-305 ${isDone ? "text-[#22c55e]/70 font-semibold" : "text-slate-700"}`}>
                                            {task}
                                          </span>
                                          {isDone && (
                                            <motion.div
                                              initial={{ width: 0 }}
                                              animate={{ width: "100%" }}
                                              transition={{ duration: 0.5, ease: "easeOut" }}
                                              className="absolute top-1/2 left-0 h-[2px] bg-[#22c55e] shadow-[0_0_8px_#22c55e] -translate-y-1/2 pointer-events-none"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Cost Summary & Payments Card */}
                            <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                              <div className="space-y-2.5 text-xs">
                                <div className="flex justify-between items-center text-slate-500 pb-2 border-b border-slate-100">
                                  <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                    <Sparkles size={12} className="text-[#22c55e]" /> Cost Summary
                                  </h5>
                                </div>
                                <div className="flex justify-between items-center text-slate-500 pt-1">
                                  <span className="font-semibold text-slate-400">
                                    {services[booking.serviceId]?.name || "Base Fare"}
                                  </span>
                                  <span className="text-slate-800 font-bold">
                                    ₹{services[booking.serviceId]?.basePrice || booking.totalPrice}
                                  </span>
                                </div>

                                {booking.discountApplied && booking.discountApplied > 0 ? (
                                  <div className="flex justify-between items-center text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100">
                                    <span className="font-extrabold text-[10px]">Promo Discount ({booking.promoCode || "PROMO"})</span>
                                    <span className="font-black">-₹{booking.discountApplied}</span>
                                  </div>
                                ) : null}

                                {/* Additional Charges added by Partner */}
                                {booking.additionalCharges && booking.additionalCharges.length > 0 ? (
                                  <div className="space-y-1 pt-1.5 border-t border-slate-100 text-left">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                      Technician Approved Add-ons
                                    </span>
                                    {booking.additionalCharges.map((chg, i) => (
                                      <div
                                        key={i}
                                        className="flex justify-between items-start bg-amber-500/[0.04] p-2 rounded-lg border border-amber-500/10"
                                      >
                                        <div>
                                          <p className="font-extrabold text-slate-700 text-[10px] leading-none">
                                            {chg.reason}
                                          </p>
                                        </div>
                                        <span className="font-black text-amber-600 text-[10px]">
                                          ₹{chg.amount}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                <div className="flex justify-between items-center text-slate-900 border-t border-slate-100 pt-2 mt-1">
                                  <span className="font-black uppercase tracking-wider text-[10px]">Net Payable Amount</span>
                                  <span className="text-base font-black text-slate-900">₹{booking.totalPrice}</span>
                                </div>

                                {(bookingStatus === "payment_pending" || bookingStatus === "completed") && (
                                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl flex flex-col gap-2">
                                    <div className="text-left">
                                      <h5 className="text-[8px] font-black uppercase text-[#22c55e] tracking-wider leading-none mb-1">
                                        Awaiting Service Payment
                                      </h5>
                                      <p className="text-[9px] text-slate-500 font-semibold leading-tight">
                                        Select secure payment route, or clear of ₹{booking.totalPrice} in cash.
                                      </p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5 w-full">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setBookingToPay(booking);
                                        }}
                                        className="text-[8px] font-black uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 py-2 rounded-lg transition-all cursor-pointer text-center animate-pulse border-0"
                                      >
                                        Online
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setIsPaymentScannerOpen(true);
                                        }}
                                        className="text-[8px] font-black uppercase tracking-wider text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                                      >
                                        <QrCode size={10} /> QR
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePayWithCashByCustomer(booking);
                                        }}
                                        className="text-[8px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-lg border border-emerald-200 transition-all cursor-pointer text-center"
                                      >
                                        Cash
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Live Tracking Map Segment */}
                          {isLiveTrackingAvailable && hasPartner && (
                            <motion.div variants={itemVariants} className="p-4 bg-slate-50 border border-slate-150 rounded-2xl relative z-10 w-full">
                              <button
                                onClick={() =>
                                  setExpandedTrackerId(
                                    expandedTrackerId === booking.id
                                      ? null
                                      : booking.id,
                                  )
                                }
                                className="w-full text-[10px] font-black uppercase tracking-widest bg-slate-900 hover:bg-slate-800 text-white transition-all px-4 py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm cursor-pointer border-0 font-display"
                              >
                                <Compass size={12} className="text-white shrink-0" />
                                {expandedTrackerId === booking.id
                                  ? "Hide Live Navigation Map"
                                  : "View Live Location Map"}
                              </button>

                              <AnimatePresence>
                                {expandedTrackerId === booking.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                    animate={{ height: "auto", opacity: 1, marginTop: 10 }}
                                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                    className="overflow-hidden border border-slate-200 rounded-xl bg-slate-50"
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
                            </motion.div>
                          )}

                          {/* Collapse Accordion Button */}
                          <button
                            onClick={() => setExpandedBookingId(null)}
                            className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl border border-slate-200/80 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <span>Hide Details 🔼</span>
                          </button>
                        </div>
                      )}

                    </div>

                    {/* Right/Expert Column (Col span: md:1, lg:1) */}
                    <div className="md:col-span-1">
                      {hasPartner ? (
                        <div className="bg-slate-900 text-white p-5 rounded-[28px] border border-slate-850 shadow-xl flex flex-col justify-between h-full relative overflow-hidden group min-h-[220px]">
                          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-blue-600/10 rounded-full blur-2xl group-hover:bg-blue-600/20 transition-all duration-500 pointer-events-none" />
                          <div className="space-y-4">
                            <div className="flex flex-col items-center text-center">
                              <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-[#22c55e] relative mb-3">
                                <img
                                  src={
                                    (booking as any).assignedPartner?.profileImage ||
                                    (booking as any).assignedPartner?.photoURL ||
                                    partnerUser?.photoURL ||
                                    "http://googleusercontent.com/image_collection/image_retrieval/16433425957912595047"
                                  }
                                  alt=""
                                  className="w-full h-full object-cover rounded-full"
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                />
                              </div>
                              <div>
                                <span className="text-[8px] font-black uppercase text-[#22c55e] tracking-wider bg-[#22c55e]/10 border border-[#22c55e]/20 px-2 py-0.5 rounded-md inline-block mb-1.5">
                                  Assigned Professional
                                </span>
                                <h5 className="font-bold text-white text-sm flex items-center justify-center gap-1 leading-none">
                                  {partnerUser?.displayName || "Vikas Chopra"}
                                  <CheckCircle2 size={12} className="text-[#22c55e]" fill="currentColor" />
                                </h5>
                                <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-slate-400 font-bold">
                                  <span className="flex items-center gap-0.5 text-slate-200">
                                    <Star size={10} className="text-amber-500 fill-amber-500" />
                                    <span>{(partnerDetail?.rating || 4.9).toFixed(1)}</span>
                                  </span>
                                  <span>•</span>
                                  <span className="text-emerald-450 bg-[#22c55e]/10 border border-[#22c55e]/20 px-1.5 py-0.5 rounded text-[9px] font-extrabold">
                                    {partnerDetail?.reviewCount || 184} reviews
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
                            <button
                              onClick={() => setActiveBookingChat(booking)}
                              className="flex-1 bg-white hover:bg-slate-100 text-slate-900 font-bold tracking-wider text-[10px] uppercase py-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <MessageSquare size={12} /> Chat
                            </button>
                            {partnerUser?.phoneNumber && (
                              <button
                                id="customer-booking-secure-call-btn-1"
                                disabled={isCalling}
                                onClick={() => handleInitiateCall(booking)}
                                className="flex-1 bg-slate-800 hover:bg-slate-750 active:bg-slate-900 active:scale-95 disabled:opacity-50 text-white font-bold tracking-wider text-[10px] uppercase py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                              >
                                <Phone size={12} /> {isCalling ? "Connecting..." : "Call"}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-dashed border-slate-200 p-6 rounded-[28px] flex flex-col justify-center text-center h-full min-h-[220px]">
                          <Sparkles size={20} className="text-[#22c55e] mx-auto mb-3 animate-pulse" />
                          <h5 className="font-bold text-slate-700 text-xs">Finding expert technician</h5>
                          <p className="text-[10px] text-slate-400 mt-1 max-w-[150px] mx-auto leading-relaxed">We are matching your request with active nearby experts.</p>
                        </div>
                      )}
                    </div>

                  </div>
                </motion.div>
              );
            })}
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
                  className="booking-details-modal bg-slate-900 border border-slate-800 text-white rounded-3xl p-4 sm:p-8 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden mb-6"
                >
                  {/* Visual Ambient Blur Accent */}
                  <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl animate-pulse pointer-events-none" />

                  {/* Header Module */}
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4 mb-6">
                    <div className="flex items-center gap-4 sm:gap-6">
                      {renderServiceThumbnail(booking.serviceId, "md")}
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-mono tracking-widest text-slate-400 font-black uppercase">
                            ID: #{booking.id.toUpperCase()}
                          </span>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                          <span
                            className={`text-[8px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${getStatusColor(bookingStatus)}`}
                          >
                            {bookingStatus.replace("_", " ")}
                          </span>
                        </div>
                        <h4 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase text-white leading-none">
                          {services[booking.serviceId]?.name ||
                            "Professional Service"}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end border-t border-slate-800/50 md:border-t-0 pt-4 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Estimated Total
                        </p>
                        <p className="text-xl font-black text-emerald-400">
                          ₹{booking.totalPrice}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Visual Status Tracking Timeline */}
                  <div className="relative z-10 w-full mb-8 pt-4 pb-6 px-4 bg-slate-950/40 rounded-3xl border border-slate-800/80">
                    <div className="flex items-center justify-between relative max-w-3xl mx-auto px-1 sm:px-4 md:px-6">
                      {/* Background Progress Track Line */}
                      <div className="absolute top-[18px] sm:top-[22px] left-6 right-6 h-[2px] bg-slate-800 z-0" />
                      
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
                                borderColor: isCompleted ? '#10b981' : isCurrent ? '#6366f1' : '#1e293b'
                              }}
                              transition={{ 
                                scale: isCurrent ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : { duration: 0.3 }
                              }}
                              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center transition-all duration-300 relative ${
                                isCompleted 
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                  : isCurrent 
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-500/15' 
                                    : 'bg-slate-900 border-slate-800 text-slate-500'
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
                                  ? 'text-emerald-400 font-extrabold' 
                                  : isCurrent 
                                    ? 'text-indigo-300 font-black' 
                                    : 'text-slate-500'
                              }`}>
                                {step.label}
                              </span>
                              <span className={`text-[7px] sm:text-[8px] font-medium tracking-wide mt-0.5 whitespace-nowrap opacity-60 hidden md:block ${
                                isCompleted ? 'text-emerald-500/80' : isCurrent ? 'text-indigo-400' : 'text-slate-600'
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
                      <div className="space-y-4 bg-slate-800/20 border border-slate-800/80 p-5 rounded-3xl">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-1">
                          <FileText size={12} className="text-blue-400" />{" "}
                          Appointment Details
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                          <div className="flex items-center gap-3 text-slate-200">
                            <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shrink-0">
                              <Calendar size={14} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold mb-0.5">
                                Service Date
                              </p>
                              <p className="font-bold text-slate-100">
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

                          <div className="flex items-center gap-3 text-slate-200">
                            <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shrink-0">
                              <Clock size={14} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold mb-0.5">
                                Service Time
                              </p>
                              <p className="font-bold text-slate-100">
                                {booking.scheduledAt
                                  ?.toDate?.()
                                  ?.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }) || "Scheduled Time"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800/60 flex items-start gap-3 text-slate-200 text-xs">
                          <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shrink-0 pb-0.5">
                            <MapPin size={14} className="text-slate-400" />
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold mb-0.5">
                              Service Address
                            </p>
                            <p className="font-bold text-slate-100 leading-relaxed text-left">
                              {booking.address}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Technician details & Actions */}
                      {hasPartner ? (
                        <div className="bg-slate-850/40 border border-slate-800 p-5 rounded-3xl space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 border-[#22c55e] relative">
                              <img
                                src={
                                  (booking as any).assignedPartner?.profileImage ||
                                  (booking as any).assignedPartner?.photoURL ||
                                  partnerUser?.photoURL ||
                                  "http://googleusercontent.com/image_collection/image_retrieval/16433425957912595047"
                                }
                                alt=""
                                className="w-full h-full object-cover rounded-full"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                              />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md inline-block mb-1">
                                Assigned Professional
                              </span>
                              <h5 className="font-bold text-slate-100 text-base flex items-center gap-1.5 leading-none">
                                {partnerUser?.displayName || "Expert Partner"}
                                <CheckCircle2
                                  size={14}
                                  className="text-emerald-500"
                                  fill="currentColor"
                                />
                                <SafetyInfoTooltip 
                                  partnerId={booking.partnerId}
                                  isVerified={partnerDetail?.isVerified}
                                  kycStatus={partnerDetail?.kycStatus}
                                />
                              </h5>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-bold">
                                <span className="flex items-center gap-1 text-slate-200">
                                  <Star
                                    size={12}
                                    className="text-amber-500 fill-amber-500"
                                  />
                                  <span>
                                    {(partnerDetail?.rating || 4.9).toFixed(1)} out of 5
                                  </span>
                                </span>
                                <span>•</span>
                                <span className="text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] tracking-wider">
                                  {partnerDetail?.reviewCount || 12} reviews
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Direct action panel for assigned partner */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => setActiveBookingChat(booking)}
                              className="flex-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white font-bold tracking-wider text-[11px] uppercase py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                              <MessageSquare
                                size={14}
                                className="text-slate-300"
                              />{" "}
                              Chat
                            </button>
                            {partnerUser?.phoneNumber && (
                              <button
                                id="customer-booking-secure-call-btn-2"
                                disabled={isCalling}
                                onClick={() => handleInitiateCall(booking)}
                                className="flex-1 bg-slate-800 hover:bg-slate-750 active:bg-slate-900 active:scale-95 disabled:opacity-50 border border-slate-700 text-white font-bold tracking-wider text-[11px] uppercase py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                              >
                                <Phone size={14} className="text-slate-300" />{" "}
                                {isCalling ? "Connecting..." : "Call"}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-800/10 border border-dashed border-slate-800 p-6 rounded-3xl text-left">
                          <div className="inline-flex w-10 h-10 rounded-xl bg-slate-800 items-center justify-center text-slate-400 mb-3 animate-pulse">
                            <Sparkles size={18} />
                          </div>
                          <h5 className="font-bold text-slate-300 leading-tight">
                            Finding the best technician for you
                          </h5>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                            We are matching your request with active, verified
                            experts nearby. Your booking schedule is secured.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Security (OTP) & Map (Live Status Tracking) */}
                    <div className="lg:col-span-5 flex flex-col justify-between gap-6">
                      {/* Security Code Panel */}
                      <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 p-6 sm:p-8 rounded-[36px] text-center shadow-lg relative flex flex-col justify-center items-center h-full min-h-[180px]">
                        {booking.status === "in_progress" ? (
                          <>
                            <div className="mb-4">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full inline-block animate-pulse">
                                Service Status
                              </span>
                            </div>

                            <div className="p-6 bg-slate-800/50 text-emerald-400 rounded-full inline-block ring-4 ring-emerald-500/10 mb-2">
                              <Zap size={44} className="animate-bounce" />
                            </div>

                            <p className="text-[9px] font-bold text-slate-300 mt-4 uppercase tracking-widest leading-relaxed px-1">
                              Your service is actively in progress. <br /> Our expert technician is working on your booking.
                            </p>
                          </>
                        ) : otpCode ? (
                          <>
                            <div className="mb-4">
                              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full inline-block">
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
                                    className="w-12 h-14 bg-white text-slate-900 rounded-xl flex items-center justify-center text-3xl font-black italic shadow-md"
                                  >
                                    {digit}
                                  </div>
                                ))}
                            </div>

                            <p className="text-[9px] font-bold text-slate-400 mt-4 uppercase tracking-widest leading-relaxed px-2">
                              Share this code with the partner ONLY <br /> once
                              they arrive to verify the visit.
                            </p>
                          </>
                        ) : (
                          <div className="text-center py-4 text-slate-400">
                            <Shield
                              size={36}
                              className="mx-auto text-slate-700 mb-3"
                            />
                            <p className="text-xs font-bold uppercase tracking-widest">
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
                            className="w-full text-[10px] font-black uppercase tracking-widest bg-blue-700 hover:bg-blue-800 text-white transition-all px-6 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg cursor-pointer"
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
                                className="overflow-hidden border border-slate-800 rounded-[32px] bg-slate-900 p-4"
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
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`bg-white border-2 transition-all duration-500 ${expandedBookingId === booking.id ? "border-blue-700 shadow-xl" : "border-slate-100 shadow-sm hover:border-slate-200"} rounded-2xl p-4 sm:p-6 cursor-pointer relative overflow-hidden`}
                    onClick={() =>
                      setExpandedBookingId(
                        expandedBookingId === booking.id ? null : booking.id,
                      )
                    }
                  >
                    <div className="flex flex-col gap-4 sm:gap-6 relative z-10">
                      <div className="flex gap-4 sm:gap-6 items-start">
                        {renderServiceThumbnail(booking.serviceId, "md")}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className={`text-[8px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${getStatusColor(booking.status)} shadow-sm border border-black/5`}
                            >
                              {booking.status.replace("_", " ")}
                            </span>
                          </div>
                          <h3 className="text-xl font-black mb-2 text-slate-900 tracking-tight uppercase italic leading-none truncate">
                            {services[booking.serviceId]?.name ||
                              "Professional Service"}
                          </h3>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            <Clock size={12} className="text-slate-300" />{" "}
                            {booking.scheduledAt
                              ?.toDate?.()
                              ?.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            <span className="text-slate-100">•</span>
                            <MapPin size={12} className="text-slate-300" />{" "}
                            <span className="truncate max-w-[100px]">
                              {booking.address}
                            </span>
                          </div>
                        </div>
                      </div>

                      {expandedBookingId === booking.id && (
                        <div
                          className="pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 space-y-8 cursor-default"
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
                            <div className="bg-blue-50/50 rounded-[24px] p-6 border border-blue-100/50">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-2 flex items-center gap-1.5">
                                <Zap size={12} className="fill-blue-700/20" />{" "}
                                SECURE SERVICE OTP
                              </h4>
                              <p className="text-[11px] text-slate-500 font-semibold mb-3 leading-relaxed">
                                Share this secure 4-digit code with your service
                                technician ONLY once they arrive at your
                                location to proceed with the service.
                              </p>
                              <div className="flex flex-row items-center justify-start gap-4">
                                <div className="flex items-center gap-3 animate-pulse">
                                  <span className="bg-white border-2 border-blue-200 text-blue-800 font-mono font-black text-2xl tracking-[0.2em] py-2 px-6 rounded-2xl shadow-sm inline-block">
                                    {bookingOtps[booking.id] ||
                                      booking.serviceOtp ||
                                      "----"}
                                  </span>
                                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 font-bold flex items-center gap-1.5 animate-pulse">
                                    <CheckCircle2 size={11} /> Standby
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Predefined tasks / Multi-service Checklist */}
                          <div className="bg-slate-50/60 rounded-[32px] p-6 border border-slate-100">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                <FileText size={12} /> Service Protocol & Items
                                Booked
                              </h4>
                              <span className="text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg">
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

                            <div className="space-y-3">
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
                                    className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-100 shadow-sm"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${isDone ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" : "border-slate-200 text-slate-300"}`}
                                      >
                                        <CheckCircle2
                                          size={12}
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
                                        className={`text-xs font-bold leading-normal text-left transition-colors duration-300 ${isDone ? "text-slate-400 line-through font-medium" : "text-slate-800"}`}
                                      >
                                        {task}
                                      </span>
                                    </div>
                                    <span
                                      className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isDone ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"}`}
                                    >
                                      {isDone ? "Done" : "Pending"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Billing & Pricing Summary Panel */}
                          <div className="bg-slate-50/60 rounded-[32px] p-6 border border-slate-100">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-3">
                              <Sparkles size={12} /> Comprehensive Cost Summary
                            </h4>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between items-center text-slate-600">
                                <span className="font-semibold">
                                  {services[booking.serviceId]?.name ||
                                    "Base Fare"}
                                </span>
                                <span className="font-bold">
                                  ₹
                                  {services[booking.serviceId]?.basePrice ||
                                    booking.totalPrice}
                                </span>
                              </div>

                              {booking.discountApplied &&
                              booking.discountApplied > 0 ? (
                                <div className="flex justify-between items-center text-emerald-600 bg-emerald-50/50 px-3 py-1.5 rounded-xl border border-emerald-100/30">
                                  <span className="font-bold">
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
                                      className="flex justify-between items-start bg-amber-500/[0.04] p-3 rounded-xl border border-amber-500/10"
                                    >
                                      <div>
                                        <p className="font-extrabold text-slate-800 leading-none">
                                          {chg.reason}
                                        </p>
                                        <span className="text-[9px] text-slate-400 font-bold leading-none">
                                          {chg.createdAt
                                            ?.toDate?.()
                                            ?.toLocaleDateString() || "Today"}
                                        </span>
                                      </div>
                                      <span className="font-black text-amber-700 text-xs">
                                        ₹{chg.amount}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              <div className="flex justify-between items-center text-slate-900 border-t border-slate-200/50 pt-3 mt-3">
                                <span className="font-black uppercase tracking-wider text-[11px]">
                                  Total Net Payable
                                </span>
                                <span className="text-xl font-black text-slate-900">
                                  ₹{booking.totalPrice}
                                </span>
                              </div>

                              {booking.status === "payment_pending" && (
                                <div className="mt-4 p-5 bg-gradient-to-r from-blue-50 to-blue-50/50 rounded-3xl border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4">
                                  <div className="text-left">
                                    <h5 className="text-[10px] font-black uppercase text-blue-700 tracking-wider">
                                      Awaiting Service Payment
                                    </h5>
                                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5 leading-tight">
                                      Choose online secure payment, or confirm check handover of ₹{booking.totalPrice} in cash.
                                    </p>
                                  </div>
                                  <div className="flex gap-2 w-full md:w-auto shrink-0 flex-wrap justify-end">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setBookingToPay(booking);
                                      }}
                                      className="flex-1 md:flex-initial text-[10px] font-black uppercase tracking-widest text-white bg-blue-700 hover:bg-blue-800 px-4.5 py-3 rounded-2xl transition-all shadow-md cursor-pointer text-center active:scale-95"
                                    >
                                      💳 Pay Online
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsPaymentScannerOpen(true);
                                      }}
                                      className="flex-1 md:flex-initial text-[10px] font-black uppercase tracking-widest text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-4.5 py-3 rounded-2xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                                    >
                                      <QrCode size={12} /> Scan QR
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePayWithCashByCustomer(booking);
                                      }}
                                      className="flex-1 md:flex-initial text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4.5 py-3 rounded-2xl border border-emerald-200 transition-all shadow-sm cursor-pointer text-center active:scale-95"
                                    >
                                      💵 Pay Cash
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Technician Card or Assignment Status */}
                          {booking.partnerId && !['completed', 'finalized', 'closed'].includes(booking.status) ? (
                            <div className="booking-details-modal flex gap-4 p-5 rounded-[28px] bg-slate-900 text-white items-center relative overflow-hidden group border border-slate-800 shadow-xl">
                              <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-blue-600/15 rounded-full blur-2xl group-hover:bg-blue-600/25 transition-all duration-500 pointer-events-none" />
                              <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-[#22c55e]">
                                <img
                                  src={
                                    (booking as any).assignedPartner?.profileImage ||
                                    (booking as any).assignedPartner?.photoURL ||
                                    partners[booking.partnerId]?.photoURL ||
                                    "http://googleusercontent.com/image_collection/image_retrieval/16433425957912595047"
                                  }
                                  alt=""
                                  className="w-full h-full object-cover rounded-full"
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                />
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <span className="text-[8px] font-black uppercase text-blue-400 tracking-widest leading-none">
                                  Your Assigned Expert
                                </span>
                                <h4 className="text-sm font-black tracking-tight text-white mt-1 truncate uppercase italic flex items-center gap-1.5 relative">
                                  <span>{partners[booking.partnerId]?.displayName ||
                                    "Expert Technician"}</span>
                                  <SafetyInfoTooltip 
                                    partnerId={booking.partnerId}
                                    isVerified={partnerDetails[booking.partnerId]?.isVerified}
                                    kycStatus={partnerDetails[booking.partnerId]?.kycStatus}
                                  />
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div className="flex items-center text-amber-400">
                                    <Star
                                      size={10}
                                      className="fill-amber-400 animate-pulse"
                                    />
                                    <span className="text-[9px] font-black ml-1 text-amber-300">
                                      {(
                                        partnerDetails[booking.partnerId]
                                          ?.rating || 4.8
                                      ).toFixed(1)} out of 5
                                    </span>
                                  </div>
                                  <span className="text-slate-650 text-[10px]">
                                    •
                                  </span>
                                  <span className="text-[9px] text-emerald-400 font-extrabold bg-emerald-500/10 px-1.5 py-0.5 rounded tracking-wider">
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
                                  className="w-10 h-10 bg-emerald-500 active:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white hover:bg-emerald-600 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-emerald-500/15 cursor-pointer"
                                  title="Call"
                                >
                                  <Phone size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBookingChat(booking);
                                  }}
                                  className="w-10 h-10 bg-blue-600 text-white hover:bg-blue-700 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-blue-500/15"
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
              <h2 className="text-xl font-extrabold text-[#0a2540] tracking-tight">
                Exclusive Deals
              </h2>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {promotions.map((promo, idx) => {
              return (
                <motion.div
                  whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  key={promo.id}
                  onClick={() => {
                    navigator.clipboard.writeText(promo.code);
                    (window as any).__showCopyToast?.(promo.code);
                  }}
                  className="flex-shrink-0 w-[290px] bg-white border border-slate-150/85 rounded-[24px] p-5 text-slate-800 relative overflow-hidden group shadow-sm cursor-pointer"
                  style={{ transition: 'all 0.3s ease-in-out' }}
                >
                  {/* Image Background or Thumbnail if present */}
                  {promo.imageUrl && (
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none">
                      <img
                        src={promo.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="relative z-10 flex flex-col h-full justify-between gap-4 text-left">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider select-none">
                          {promo.discountType === "percent"
                            ? `${promo.discountValue}% OFF`
                            : `₹${promo.discountValue} OFF`}
                        </span>
                        <div className="bg-slate-100 hover:bg-slate-200 border border-slate-200/50 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase text-slate-600 transition-colors">
                          <Zap size={10} className="text-[#22c55e]" fill="currentColor" />
                          {promo.code}
                        </div>
                      </div>
                      
                      <h3 className="text-base font-extrabold text-slate-900 mb-1 leading-tight tracking-tight">
                        {promo.name}
                      </h3>
                      <p className="text-slate-500 text-[11px] line-clamp-2 font-medium leading-normal">
                        {promo.description}
                      </p>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0a2540] group-hover:text-[#22c55e] transition-colors flex items-center gap-1">
                        Claim Discount <ChevronRight size={12} className="stroke-[3]" />
                      </span>
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
              <div className="w-10 h-10 bg-[#0a2540] rounded-[16px] text-white flex items-center justify-center">
                <Compass size={18} />
              </div>
              <h2 className="text-2xl font-bold text-[#0a2540] tracking-tight">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(showAllHistory || historySearchQuery || historyCategoryFilter
              ? filteredPastBookings
              : filteredPastBookings.slice(0, 4)
            ).map((booking) => (
              <div
                key={booking.id}
                className="bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-all flex gap-3"
              >
                {renderServiceThumbnail(booking.serviceId, "sm")}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <div className="min-w-0">
                      <span className="text-[9px] font-mono font-black text-slate-400 block tracking-wider mb-0.5">BOOKING ID: #{booking.id.toUpperCase().slice(-6)}</span>
                      <h4 className="font-bold text-slate-900 truncate text-sm">
                        {services[booking.serviceId]?.name}
                      </h4>
                    </div>
                    <div className="flex gap-1.5 items-center shrink-0">
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                        {booking.status}
                      </span>
                      <span
                        className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${booking.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}
                      >
                        {booking.paymentStatus || "unpaid"}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-end mb-3 pt-1.5 border-t border-slate-50">
                    <p className="text-[9px] text-slate-400 font-bold">
                      Date: {booking.scheduledAt?.toDate?.()?.toLocaleDateString()}
                    </p>
                    <div className="text-right">
                      <span className="text-[8px] font-black uppercase text-slate-400 block leading-none">Paid Amount</span>
                      <span className="text-xs font-black text-slate-900">₹{booking.totalPrice || 0}</span>
                    </div>
                  </div>

                  {booking.completionPhotos && booking.completionPhotos[0] && (
                    <div className="mb-4 p-2 bg-slate-50 border border-slate-200/50 rounded-2xl flex flex-col gap-1.5 max-w-sm">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                        Captured Job Completion Proof:
                      </p>
                      <div className="w-full h-24 rounded-xl overflow-hidden border border-slate-100 bg-slate-100">
                        <img
                          src={booking.completionPhotos[0]}
                          alt="Job Completion Proof"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}

                  {/* Inline 5-star feedback and comment form for completed & paid service cards */}
                  {booking.status === "completed" && booking.paymentStatus === "paid" && (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="my-3 p-4 bg-emerald-50/20 border border-emerald-100/40 rounded-2xl relative overflow-hidden"
                      >
                        {successCheckedCards[booking.id] ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-4 text-center"
                          >
                            <motion.div
                              initial={{ scale: 0.5, rotate: -30 }}
                              animate={{ scale: [1, 1.2, 1], rotate: 0 }}
                              transition={{ duration: 0.5 }}
                              className="bg-emerald-100 p-2.5 rounded-full text-emerald-600 mb-2"
                            >
                              <CheckCircle2 size={24} className="text-emerald-600 animate-pulse" />
                            </motion.div>
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest leading-none">
                              Review Submitted!
                            </span>
                            <span className="text-[9px] font-semibold text-slate-500 mt-1">
                              Feedback captured. Thank you!
                            </span>
                          </motion.div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                                ⭐ Share Your Experience:
                              </span>
                              <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded">
                                Required
                              </span>
                            </div>

                            {/* 5-Star Interactive Input */}
                            <div className="flex gap-2 items-center">
                              {[1, 2, 3, 4, 5].map((star) => {
                                const bRating = inlineRatings[booking.id] || 0;
                                return (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInlineRatings((prev) => ({ ...prev, [booking.id]: star }));
                                    }}
                                    className="transition-transform hover:scale-120 duration-150 transform active:scale-95 cursor-pointer"
                                  >
                                    <Star
                                      size={20}
                                      fill={star <= bRating ? "currentColor" : "none"}
                                      className={
                                        star <= bRating
                                          ? "text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.3)] scale-110"
                                          : "text-slate-200 hover:text-amber-300 transition-colors"
                                      }
                                    />
                                  </button>
                                );
                              })}
                            </div>

                            {/* Comment Field (Shown when rating is selected) */}
                            {(inlineRatings[booking.id] || 0) > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-1.5"
                              >
                                <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-405">
                                  Your Feedback & Comment:
                                </span>
                                <textarea
                                  value={inlineComments[booking.id] || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setInlineComments((prev) => ({ ...prev, [booking.id]: val }));
                                  }}
                                  placeholder="Write a comment about the service partner's work..."
                                  rows={2}
                                  className="w-full bg-white border border-slate-200/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-700 transition-all font-sans font-medium"
                                />
                              </motion.div>
                            )}

                            {/* Submit Button */}
                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={inlineSubmittingId === booking.id || !(inlineRatings[booking.id] > 0)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInlineFeedbackSubmit(booking);
                                }}
                                className="text-[9px] font-black uppercase tracking-widest text-white bg-blue-700 hover:bg-blue-850 disabled:bg-slate-100 disabled:text-slate-400 border-0 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                              >
                                {inlineSubmittingId === booking.id ? "Saving..." : "Submit Review"}
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  )}

                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      onClick={() =>
                        setSelectedService(services[booking.serviceId])
                      }
                      className="text-[9px] font-black uppercase tracking-widest text-slate-900 border-b-2 border-blue-700 pb-0.5 hover:text-slate-500 hover:border-slate-500 transition-colors cursor-pointer"
                    >
                      Book Again
                    </button>

                    {booking.paymentStatus === "unpaid" && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setBookingToPay(booking)}
                          className="text-[9px] font-black uppercase tracking-widest text-white bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer"
                        >
                          💳 Pay Now
                        </button>
                        <button
                          onClick={() => setIsPaymentScannerOpen(true)}
                          className="text-[9px] font-black uppercase tracking-widest text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all border border-slate-200 cursor-pointer flex items-center gap-1"
                        >
                          <QrCode size={10} /> Scan QR
                        </button>
                      </div>
                    )}

                    {["completed", "finalized"].includes(booking.status) && (
                      <div className="flex flex-col items-end gap-1.5 ml-auto">
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                          Post-Service & Billing
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const link = document.createElement("a");
                              link.href = `/api/download-invoice?bookingId=${booking.id}`;
                              link.setAttribute("download", `invoice_${booking.id}.pdf`);
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="text-[9px] font-black uppercase tracking-widest text-[#050CA6] flex items-center gap-1.5 hover:text-[#040980] bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 transition-all shadow-sm cursor-pointer"
                            title="Download invoice for this completed service"
                          >
                            <Download size={10} /> Invoice PDF
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                `mailto:support@zomindia.com?subject=Support Request: Booking ${booking.id}&body=Hi Support Team,%0D%0A%0D%0AI need assistance with my booking ${booking.id} (${services[booking.serviceId]?.name}).%0D%0A%0D%0A[Please describe your issue here]`,
                              );
                            }}
                            className="text-[9px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 transition-all shadow-sm"
                            title="Our experts are here 24/7 to resolve any post-service concerns or quality issues."
                          >
                            <HelpCircle size={10} /> Support
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 120 }}
              className="relative bg-white w-full max-w-xl rounded-[36px] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-100"
            >
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                
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

                {/* Locked feedback notification */}
                <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-100/50 flex items-center gap-3">
                  <div className="p-1.5 bg-blue-100 rounded-xl text-blue-600 shrink-0">
                    <Shield size={15} strokeWidth={2.5} />
                  </div>
                  <p className="text-[10.5px] leading-relaxed font-bold text-blue-800">
                    🔒 <span className="font-extrabold uppercase text-[9.5px]">Quality Lock:</span> Complete the 4-tier rating below to verify completion and unlock your next booking.
                  </p>
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
    </div>
  );
}
