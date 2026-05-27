import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  documentId,
  updateDoc,
  doc,
  Timestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Booking,
  UserProfile,
  PartnerProfile,
  Promotion,
  Category,
  Service,
} from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { motion, AnimatePresence } from "motion/react";
import ChatWindow from "./ChatWindow";
import { LoadingScreen } from "./LoadingIndicator";
import PaymentModal from "./PaymentModal";
import BookingModal from "./BookingModal";
import AudioCall from "./AudioCall";
import AiSupportChat from "./AiSupportChat";
import MarqueeCarousel from "./MarqueeCarousel";
import {
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { QRCodeSVG } from "qrcode.react";
import PartnerTrackingMap from "./PartnerTrackingMap";
import { CustomerPaymentScanner } from "./CustomerPaymentScanner";
import {
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
  ArrowRight,
  Compass,
  FileText,
  Phone,
  Sparkles,
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
}: {
  partnerId: string;
  destinationAddress: string;
  isOpen: boolean;
  onToggle: () => void;
  status: string;
  serviceOtp?: string;
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
            />
          </motion.div>
        )}
      </AnimatePresence>
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
  const [bookings, setBookings] = useState<Booking[]>([]);
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
          "confirmed",
          "assigned",
          "on_the_way",
          "arrived",
          "in_progress",
          "pending_parts",
          "payment_pending",
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
      ["pending", "assigned", "confirmed", "on_the_way", "arrived"].includes(
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
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        activeCall: {
          callerId: profile.uid,
          callerName: profile.displayName || "Customer",
          status: "ringing",
          timestamp: Timestamp.now(),
        },
      });
    } catch (err) {
      console.error("Error initiating firestore call: ", err);
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
    const q = query(
      collection(db, "bookings"),
      where("customerId", "==", profile.uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setBookings(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking),
        );
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "bookings"),
    );

    return () => unsubscribe();
  }, [profile.uid]);

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
        return "bg-blue-700 text-white";
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
      <div className="mt-8 pt-8 border-t border-slate-100 px-2 sm:px-6">
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
  const [comment, setComment] = useState("");
  const [reviewPhoto, setReviewPhoto] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

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

  const handleFinalize = async (booking: Booking) => {
    if (booking.paymentStatus === "unpaid" && booking.totalPrice > 0) {
      setBookingToPay(booking);
      setFinalizingBooking(null);
      return;
    }

    try {
      if (rating > 0) {
        setIsSubmittingReview(true);
        const reviewData: any = {
          bookingId: booking.id,
          customerId: profile.uid,
          partnerId: booking.partnerId,
          serviceId: booking.serviceId,
          rating,
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
          ((s?.rating || 4.8) * (s?.reviewCount || 10) + rating) /
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
              ((pData.rating || 4.8) * (pData.reviewCount || 10) + rating) /
              (pNewCount + 10);
            await updateDoc(doc(db, "partners", pDoc.id), {
              rating: Number(pNewRating.toFixed(1)),
              reviewCount: pNewCount,
            });
          }
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
      setComment("");
      setReviewPhoto("");
      setIsSubmittingReview(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
      setIsSubmittingReview(false);
    }
  };

  if (loading)
    return <LoadingScreen message="Personalizing your zomindia dashboard..." />;

  const filteredServices = allActiveServices.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !activeCategoryFilter || s.categoryId === activeCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const renderServiceThumbnail = (
    serviceId: string,
    size: "sm" | "md" = "md",
  ) => {
    const service = services[serviceId];
    const serviceName = service?.name || "";

    // Choose icon based on service name characteristics or default
    let IconComponent = Zap;
    let gradientClass = "from-indigo-600 to-blue-700 shadow-indigo-600/20";

    if (
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
      gradientClass = "from-rose-400 to-pink-600 shadow-rose-500/20";
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

    if (service?.imageURL) {
      return (
        <div
          className={`${dimensionClass} relative overflow-hidden shrink-0 border-2 border-white shadow-md bg-slate-100 group`}
        >
          <img
            src={service.imageURL}
            alt={serviceName}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    return (
      <div
        className={`${dimensionClass} bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white shrink-0 relative overflow-hidden shadow-md border-2 border-white`}
      >
        {/* Ambient radial reflection glare */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 skew-y-12 origin-top-left" />
        <IconComponent
          size={iconSize}
          className="relative z-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)] font-black"
        />
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 sm:py-20 lg:py-24">
      {/* Success Confirmation Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-blue-700/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[48px] p-8 sm:p-12 max-w-sm w-full text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)]"
            >
              <div className="w-20 h-20 bg-blue-700 text-white rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900 italic mb-4">
                Confirmed
              </h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-10">
                {showSuccessModal}
              </p>
              <button
                onClick={() => setShowSuccessModal(null)}
                className="w-full bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-blue-800 transition-all shadow-lg active:scale-95"
              >
                Acknowledge
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16 sm:mb-24 px-2 sm:px-0">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
            Digital Hub
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 mb-6 tracking-tighter leading-[0.85] uppercase italic">
            Hi, {(profile.displayName || "Guest").split(" ")[0]}
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-sm leading-relaxed">
            Your home ecosystem is{" "}
            <span className="text-slate-900 underline decoration-slate-200 decoration-4 underline-offset-8">
              synchronized
            </span>
            .
          </p>
        </div>
        <div className="relative w-full md:w-[400px] group">
          <Search
            className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors"
            size={24}
          />
          <input
            type="text"
            placeholder="Search service history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-slate-100 pl-20 pr-8 py-7 rounded-[40px] text-lg font-bold focus:outline-none focus:border-blue-700 transition-all shadow-xl shadow-slate-200/50"
          />
        </div>
      </div>

      <MarqueeCarousel
        promotions={promotions}
        services={allActiveServices}
        onServiceClick={setSelectedService}
      />

      {/* Active High-Visibility Status Ticker */}
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
              ].includes(booking.status);

              return (
                <div
                  key={booking.id}
                  className="bg-slate-900 border border-slate-800 text-white rounded-[40px] p-6 sm:p-10 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden mb-8"
                >
                  {/* Visual Ambient Blur Accent */}
                  <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl animate-pulse pointer-events-none" />

                  {/* Header Module */}
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-800 pb-6 mb-8">
                    <div className="flex items-center gap-4 sm:gap-6">
                      {renderServiceThumbnail(booking.serviceId, "md")}
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-mono tracking-widest text-slate-400 font-black uppercase">
                            ID: #{booking.id.toUpperCase()}
                          </span>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                          <span
                            className={`text-[8px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${getStatusColor(booking.status)}`}
                          >
                            {booking.status.replace("_", " ")}
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
                            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/10 flex items-center justify-center relative shadow-sm shrink-0 overflow-hidden font-black text-lg font-mono">
                              {partnerUser?.photoURL ? (
                                <img
                                  src={partnerUser.photoURL}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                (partnerUser?.displayName || "P")
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                              )}
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
                              </h5>
                              {partnerDetail && (
                                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-bold">
                                  <span className="flex items-center gap-1 text-slate-200">
                                    <Star
                                      size={12}
                                      className="text-amber-500 fill-amber-500"
                                    />
                                    {partnerDetail.rating
                                      ? partnerDetail.rating.toFixed(1)
                                      : "5.0"}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {partnerDetail.reviewCount || 0} reviews
                                  </span>
                                </div>
                              )}
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
                                onClick={() => handleInitiateCall(booking)}
                                className="flex-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white font-bold tracking-wider text-[11px] uppercase py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                              >
                                <Phone size={14} className="text-slate-300" />{" "}
                                Call
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
                                Service Completion Code
                              </span>
                            </div>

                            <div className="bg-white p-3.5 rounded-3xl inline-block shadow-md border-4 border-emerald-500/30">
                              <QRCodeSVG
                                value={`zomindia_completion:${booking.id}`}
                                size={120}
                                level="H"
                                fgColor="#0f172a"
                                bgColor="#ffffff"
                              />
                            </div>

                            <p className="text-[9px] font-bold text-slate-300 mt-4 uppercase tracking-widest leading-relaxed px-1">
                              Show this QR to the expert <br /> once the service
                              is fully complete.
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
        <div className="space-y-32">
          {activeBookings.length > 0 ? (
            <div className="mb-16">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-700 rounded-[16px] text-white shadow-2xl flex items-center justify-center">
                    <Calendar size={18} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">
                    Ongoing Jobs
                  </h2>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {activeBookings.map((booking) => (
                  <motion.div
                    layout
                    key={booking.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`bg-white border-2 transition-all duration-500 ${expandedBookingId === booking.id ? "border-blue-700 shadow-xl" : "border-slate-100 shadow-sm hover:border-slate-200"} rounded-[40px] p-6 sm:p-8 cursor-pointer relative overflow-hidden`}
                    onClick={() =>
                      setExpandedBookingId(
                        expandedBookingId === booking.id ? null : booking.id,
                      )
                    }
                  >
                    <div className="flex flex-col gap-6 relative z-10">
                      <div className="flex gap-6 items-start">
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
                                location to proceed with the service, or let
                                them scan the QR code to start.
                              </p>
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                                <div className="bg-white p-2.5 rounded-2xl border border-blue-100 flex flex-col items-center gap-1 shadow-sm">
                                  <QRCodeSVG
                                    value={`zomindia_start:${booking.id}:${bookingOtps[booking.id] || booking.serviceOtp || ""}`}
                                    size={80}
                                    level="L"
                                    fgColor="#050ca6"
                                  />
                                  <span className="text-[8px] font-black text-blue-700 uppercase tracking-wider">
                                    Start Service QR
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
                                ? services[booking.serviceId].predefinedTasks
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
                                <div className="mt-4 p-4 bg-blue-50/70 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                  <div className="text-left">
                                    <h5 className="text-[10px] font-black uppercase text-blue-700 tracking-wider">
                                      Awaiting Service Payment
                                    </h5>
                                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5 leading-tight">
                                      Pay instantly online or scan partner's QR code.
                                    </p>
                                  </div>
                                  <div className="flex gap-2 w-full sm:w-auto shrink-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setBookingToPay(booking);
                                      }}
                                      className="flex-1 sm:flex-initial text-[10px] font-black uppercase tracking-widest text-white bg-blue-700 hover:bg-blue-800 px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer text-center"
                                    >
                                      💳 Pay Online
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsPaymentScannerOpen(true);
                                      }}
                                      className="flex-1 sm:flex-initial text-[10px] font-black uppercase tracking-widest text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                      <QrCode size={12} /> Scan QR
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Technician Card or Assignment Status */}
                          {booking.partnerId ? (
                            <div className="flex gap-4 p-5 rounded-[28px] bg-slate-900 text-white items-center relative overflow-hidden group border border-slate-800 shadow-xl">
                              <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-blue-600/15 rounded-full blur-2xl group-hover:bg-blue-600/25 transition-all duration-500 pointer-events-none" />
                              <div className="w-12 h-12 rounded-2xl bg-white/10 overflow-hidden shrink-0 border border-white/10">
                                <img
                                  src={
                                    partners[booking.partnerId]?.photoURL ||
                                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${partners[booking.partnerId]?.displayName || booking.partnerId}`
                                  }
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <span className="text-[8px] font-black uppercase text-blue-400 tracking-widest leading-none">
                                  Your Assigned Expert
                                </span>
                                <h4 className="text-sm font-black tracking-tight text-white mt-1 truncate uppercase italic">
                                  {partners[booking.partnerId]?.displayName ||
                                    "Expert Technician"}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div className="flex items-center text-amber-400">
                                    <Star
                                      size={10}
                                      className="fill-amber-400"
                                    />
                                    <span className="text-[9px] font-black ml-1 text-amber-300">
                                      {(
                                        partnerDetails[booking.partnerId]
                                          ?.rating || 4.8
                                      ).toFixed(1)}
                                    </span>
                                  </div>
                                  <span className="text-slate-600 text-[10px]">
                                    •
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                    Verified Partner
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-2 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInitiateCall(booking);
                                  }}
                                  className="w-10 h-10 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-emerald-500/15"
                                  title="Voice Call Partner"
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
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            /* Discovery Grid when no active bookings */
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
          )}
        </div>
      )}

      {/* Promotions & Offers - Discovery */}
      {promotions.length > 0 && !searchQuery && (
        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-xl text-white shadow-lg shadow-amber-200">
                <Zap size={18} fill="currentColor" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight italic">
                Exclusive Deals
              </h2>
            </div>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {promotions.map((promo, idx) => {
              const bgColors = [
                "from-slate-900 to-slate-800",
                "from-indigo-600 to-blue-500",
                "from-emerald-600 to-teal-500",
                "from-rose-600 to-pink-500",
                "from-amber-600 to-orange-500",
                "from-purple-600 to-indigo-500",
              ];
              const bgColor = bgColors[idx % bgColors.length];

              return (
                <motion.div
                  whileHover={{ y: -5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={promo.id}
                  className={`flex-shrink-0 w-[300px] sm:w-96 bg-gradient-to-br ${bgColor} rounded-[40px] p-8 text-white relative overflow-hidden group shadow-2xl shadow-slate-200 cursor-pointer`}
                >
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-white/20 transition-all" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
                  <div className="absolute top-1/4 left-1/2 w-40 h-40 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 rotate-45 group-hover:rotate-90 transition-transform duration-1000" />

                  {promo.imageUrl && (
                    <div className="absolute inset-0 opacity-10 group-hover:opacity-30 transition-all duration-500 mix-blend-overlay">
                      <img
                        src={promo.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(promo.code);
                        }}
                        className="bg-white/20 backdrop-blur-xl border border-white/30 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 hover:bg-white/40 transition-all active:scale-95"
                      >
                        <Zap size={10} fill="currentColor" />
                        Code: {promo.code}
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black mb-3 leading-tight tracking-tight drop-shadow-sm">
                        {promo.name}
                      </h3>
                      <p className="text-white/80 text-sm mb-8 line-clamp-2 font-medium leading-relaxed">
                        {promo.description}
                      </p>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-1">
                          Exclusive Discount
                        </p>
                        <p className="text-4xl font-black tracking-tighter drop-shadow-md">
                          {promo.discountType === "percent"
                            ? `${promo.discountValue}%`
                            : `₹${promo.discountValue}`}{" "}
                          OFF
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 shadow-xl group-hover:translate-x-1 transition-transform">
                        <ChevronRight size={24} />
                      </div>
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
              <div className="w-10 h-10 bg-blue-700 rounded-[16px] text-white shadow-2xl flex items-center justify-center">
                <Compass size={18} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">
                Discovery
              </h2>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-8 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveCategoryFilter(null)}
              className={`flex-shrink-0 px-8 py-5 rounded-[24px] font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all shadow-sm active:scale-95 duration-500 ${!activeCategoryFilter ? "bg-blue-700 text-white shadow-slate-200" : "bg-slate-50 border-2 border-slate-50 text-slate-400 hover:text-blue-700 hover:bg-slate-100 hover:border-slate-100"}`}
            >
              All Assets
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={`flex-shrink-0 px-8 py-5 rounded-[24px] font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-4 shadow-sm active:scale-95 duration-500 ${activeCategoryFilter === cat.id ? "bg-blue-700 text-white shadow-slate-200" : "bg-slate-50 border-2 border-slate-50 text-slate-400 hover:text-blue-700 hover:bg-slate-100 hover:border-slate-100"}`}
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
        <div className="mb-20">
          {/* Header with search inputs */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-xl text-slate-400">
                <Clock size={18} />
              </div>
              <h2 className="text-xl font-black text-slate-400 tracking-tight italic uppercase tracking-widest">
                History
              </h2>
            </div>

            {/* Filtering Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full lg:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Search history by service..."
                  className="w-full bg-white border border-slate-200/80 rounded-2xl pl-10 pr-8 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-450 focus:outline-none focus:border-blue-700 transition-all font-sans"
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
                  className="w-full sm:w-48 bg-white border border-slate-200/80 text-xs font-bold text-slate-700 pl-4 pr-10 py-2.5 rounded-2xl focus:outline-none focus:border-blue-700 transition-all appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat font-sans"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(showAllHistory || historySearchQuery || historyCategoryFilter
              ? filteredPastBookings
              : filteredPastBookings.slice(0, 4)
            ).map((booking) => (
              <div
                key={booking.id}
                className="bg-white border border-slate-100 rounded-[32px] p-6 hover:border-slate-200 transition-all flex gap-4"
              >
                {renderServiceThumbnail(booking.serviceId, "sm")}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-slate-900 truncate text-sm">
                      {services[booking.serviceId]?.name}
                    </h4>
                    <div className="flex gap-1.5 items-center">
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
                  <p className="text-[9px] text-slate-400 mb-3 font-bold">
                    {booking.scheduledAt?.toDate?.()?.toLocaleDateString()}
                  </p>

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
                        />
                      </div>
                    </div>
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

                    {booking.status === "completed" &&
                      booking.paymentStatus === "paid" && (
                        <button
                          onClick={() => {
                            setRating(0);
                            setFinalizingBooking(booking);
                          }}
                          className="text-[9px] font-black uppercase tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-500 px-3 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer animate-pulse"
                        >
                          ⭐ Rate & Finalize
                        </button>
                      )}

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
                          Post-Service Care
                        </p>
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

      <AnimatePresence>
        {activeCoordinatedCallBooking && (
          <AudioCall
            bookingId={activeCoordinatedCallBooking.id}
            activeCall={activeCoordinatedCallBooking.activeCall}
            otherUser={
              partners[activeCoordinatedCallBooking.partnerId!] || null
            }
            isIncoming={
              activeCoordinatedCallBooking.activeCall?.callerId !== profile.uid
            }
            onAnswer={() => handleAnswerCall(activeCoordinatedCallBooking)}
            onEndCall={() => handleEndCall(activeCoordinatedCallBooking)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {finalizingBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFinalizingBooking(null)}
              className="absolute inset-0 bg-blue-700/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-blue-700 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Finalize Service
                  </h3>
                  <p className="text-slate-500">
                    Please review the final details before completing.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-6 mb-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                        Service
                      </p>
                      <p className="font-bold text-slate-900">
                        {services[finalizingBooking.serviceId]?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                        Total Paid
                      </p>
                      <p className="text-xl font-bold text-slate-900">
                        ₹{finalizingBooking.totalPrice}
                      </p>
                    </div>
                  </div>

                  {/* Rating & Review Section */}
                  <div className="pt-4 border-t border-slate-200/50">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 text-center">
                      Rate your Experience
                    </p>
                    <div className="flex justify-center gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="transition-transform active:scale-125 hover:scale-110 cursor-pointer"
                        >
                          <Star
                            size={28}
                            fill={star <= rating ? "currentColor" : "none"}
                            className={
                              star <= rating
                                ? "text-amber-400"
                                : "text-slate-200 hover:text-amber-300"
                            }
                          />
                        </button>
                      ))}
                    </div>
                    {rating === 0 &&
                      finalizingBooking.paymentStatus !== "unpaid" && (
                        <p className="text-[10px] text-amber-500 font-extrabold text-center uppercase tracking-wider mb-3 animate-pulse">
                          * Please pick a 1-5 star rating to submit review
                        </p>
                      )}
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us what you liked about the service..."
                      className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-700 outline-none h-24 resize-none mb-3"
                    />
                    <input
                      type="url"
                      value={reviewPhoto}
                      onChange={(e) => setReviewPhoto(e.target.value)}
                      placeholder="Add an image URL (optional)..."
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-blue-700 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                        Date & Time
                      </p>
                      <p className="text-xs font-bold text-slate-900">
                        {finalizingBooking.scheduledAt
                          ?.toDate?.()
                          ?.toLocaleDateString()}{" "}
                        at{" "}
                        {finalizingBooking.scheduledAt
                          ?.toDate?.()
                          ?.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                        Address
                      </p>
                      <p className="text-[10px] text-slate-600 line-clamp-1">
                        {finalizingBooking.address}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setFinalizingBooking(null)}
                    disabled={isSubmittingReview}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (
                        finalizingBooking.paymentStatus !== "unpaid" &&
                        (rating < 1 || rating > 5)
                      )
                        return;
                      handleFinalize(finalizingBooking);
                    }}
                    disabled={
                      isSubmittingReview ||
                      (finalizingBooking.paymentStatus !== "unpaid" &&
                        (rating < 1 || rating > 5))
                    }
                    className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                      finalizingBooking.paymentStatus !== "unpaid" &&
                      (rating < 1 || rating > 5)
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                        : "bg-blue-700 text-white hover:bg-blue-800 active:scale-95"
                    }`}
                  >
                    {isSubmittingReview ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : null}
                    {finalizingBooking.paymentStatus === "unpaid"
                      ? "Continue to Payment"
                      : "Confirm & Review"}
                  </button>
                </div>
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
