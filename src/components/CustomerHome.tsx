import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  limit,
  onSnapshot,
  updateDoc,
  Timestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Category,
  Service,
  UserProfile,
  PartnerProfile,
  Promotion,
  Booking,
} from "../types";
import PaymentModal from "./PaymentModal";
import { QRCodeSVG } from "qrcode.react";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { fuzzyMatch } from "../utils/search";
import { motion, AnimatePresence } from "motion/react";
import BookingModal from "./BookingModal";
import { ImageCarousel } from "./ServiceDetails";
import { BrandedButtonSpinner } from "./LoadingIndicator";
import {
  Wrench,
  Sparkles,
  Plug,
  PaintBucket,
  Smartphone,
  Wind,
  Search,
  ArrowRight,
  Star,
  Clock,
  ShieldCheck,
  UserCheck,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PhoneCall,
  MessageCircle,
  Zap,
  Copy,
  Check,
  Plus,
  MapPin,
  Scissors,
  Tv,
  Brush,
  Hammer,
  CreditCard,
} from "lucide-react";

import heroImage from "../assets/images/regenerated_image_1780966635884.jpg";

interface Props {
  setActiveTab: (tab: any, arg?: any) => void;
  profile: UserProfile | null;
  onAuthRequired: () => void;
  onServiceSelect: (id: string) => void;
  initialCategoryId?: string | null;
}

interface PartnerWithInfo extends PartnerProfile {
  displayName: string;
  photoURL?: string;
}

const SAMPLE_CATEGORIES = [
  {
    id: "1",
    name: "Cleaning",
    icon: "Sparkles",
    description: "Deep cleaning, sofa & carpet",
  },
  {
    id: "2",
    name: "Repairs",
    icon: "Wrench",
    description: "Plumbing, Electrician, Carpenter",
  },
  {
    id: "3",
    name: "Appliance",
    icon: "Smartphone",
    description: "AC, TV, Refrigerator, RO",
  },
  {
    id: "4",
    name: "Painting",
    icon: "PaintBucket",
    description: "Full house painting",
  },
  {
    id: "5",
    name: "Beauty",
    icon: "Sparkles",
    description: "Salon at home for women",
  },
  {
    id: "6",
    name: "Appliance Repair",
    icon: "Smartphone",
    description:
      "Repair services for electronics, home appliances, and gadgets",
  },
  {
    id: "Phone Repair",
    name: "Phone Repair",
    icon: "Smartphone",
    description: "Expert repair services for all smartphone brands",
  },
];

const getCategoryIcon = (iconName: string): any => {
  if (!iconName) return Sparkles;
  const name = iconName.toLowerCase().trim();
  const map: Record<string, any> = {
    sparkles: Sparkles,
    wrench: Wrench,
    smartphone: Smartphone,
    paintbucket: PaintBucket,
    plug: Plug,
    wind: Wind,
    search: Search,
    star: Star,
    scissors: Scissors,
    tv: Tv,
    brush: Brush,
    hammer: Hammer,
  };
  return map[name] || Sparkles;
};

const getCategoryIconColor = (iconName: string): string => {
  if (!iconName) return "text-slate-600";
  const name = iconName.toLowerCase().trim();
  const map: Record<string, string> = {
    sparkles: "text-rose-500",
    wrench: "text-blue-500",
    smartphone: "text-slate-700",
    paintbucket: "text-amber-500",
    plug: "text-emerald-500",
    wind: "text-cyan-500",
    scissors: "text-pink-500",
    tv: "text-indigo-500",
    brush: "text-orange-500",
    hammer: "text-slate-500",
  };
  return map[name] || "text-slate-600";
};

const CATEGORY_THEMES: Record<
  string,
  {
    iconColor: string;
    bgClass: string;
    borderClass: string;
    shadowClass: string;
    hoverBg: string;
    activeIconColor: string;
    textHoverColor: string;
    badgeColor?: string;
    badgeText?: string;
  }
> = {
  cleaning: {
    iconColor: "text-rose-500 bg-rose-50/50",
    bgClass: "group-hover:bg-rose-500/[0.04] group-hover:border-rose-400/40",
    borderClass: "border-slate-100/80",
    shadowClass: "group-hover:shadow-[0_20px_35px_-8px_rgba(244,63,94,0.15)]",
    hoverBg: "bg-rose-500/[0.08] shadow-[0_4px_12px_rgba(244,63,94,0.12)]",
    activeIconColor: "text-rose-600",
    textHoverColor: "group-hover:text-rose-700",
    badgeText: "Popular",
    badgeColor: "bg-rose-50 text-rose-600 border-rose-100",
  },
  repairs: {
    iconColor: "text-blue-500 bg-blue-50/50",
    bgClass: "group-hover:bg-blue-500/[0.04] group-hover:border-blue-400/40",
    borderClass: "border-slate-100/80",
    shadowClass: "group-hover:shadow-[0_20px_35px_-8px_rgba(59,130,246,0.15)]",
    hoverBg: "bg-blue-500/[0.08] shadow-[0_4px_12px_rgba(59,130,246,0.12)]",
    activeIconColor: "text-blue-600",
    textHoverColor: "group-hover:text-blue-700",
    badgeText: "Instant",
    badgeColor: "bg-blue-50 text-blue-600 border-blue-100",
  },
  appliance: {
    iconColor: "text-emerald-500 bg-emerald-50/50",
    bgClass:
      "group-hover:bg-emerald-500/[0.04] group-hover:border-emerald-400/40",
    borderClass: "border-slate-100/80",
    shadowClass: "group-hover:shadow-[0_20px_35px_-8px_rgba(16,185,129,0.15)]",
    hoverBg: "bg-emerald-500/[0.08] shadow-[0_4px_12px_rgba(16,185,129,0.12)]",
    activeIconColor: "text-emerald-600",
    textHoverColor: "group-hover:text-emerald-700",
  },
  painting: {
    iconColor: "text-amber-500 bg-amber-50/50",
    bgClass: "group-hover:bg-amber-500/[0.04] group-hover:border-amber-400/40",
    borderClass: "border-slate-100/80",
    shadowClass: "group-hover:shadow-[0_20px_35px_-8px_rgba(245,158,11,0.15)]",
    hoverBg: "bg-amber-500/[0.08] shadow-[0_4px_12px_rgba(245,158,11,0.12)]",
    activeIconColor: "text-amber-600",
    textHoverColor: "group-hover:text-amber-700",
    badgeText: "Premium",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-100",
  },
  beauty: {
    iconColor: "text-pink-500 bg-pink-50/50",
    bgClass: "group-hover:bg-pink-500/[0.04] group-hover:border-pink-400/40",
    borderClass: "border-slate-100/80",
    shadowClass: "group-hover:shadow-[0_20px_35px_-8px_rgba(236,72,153,0.15)]",
    hoverBg: "bg-pink-500/[0.08] shadow-[0_4px_12px_rgba(236,72,153,0.12)]",
    activeIconColor: "text-pink-600",
    textHoverColor: "group-hover:text-pink-700",
    badgeText: "Salon",
    badgeColor: "bg-pink-50 text-pink-600 border-pink-100",
  },
  "appliance repair": {
    iconColor: "text-emerald-500 bg-emerald-50/50",
    bgClass:
      "group-hover:bg-emerald-500/[0.04] group-hover:border-emerald-400/40",
    borderClass: "border-slate-100/80",
    shadowClass: "group-hover:shadow-[0_20px_35px_-8px_rgba(16,185,129,0.15)]",
    hoverBg: "bg-emerald-500/[0.08] shadow-[0_4px_12px_rgba(16,185,129,0.12)]",
    activeIconColor: "text-emerald-600",
    textHoverColor: "group-hover:text-emerald-700",
  },
  "phone repair": {
    iconColor: "text-slate-700 bg-slate-100/50",
    bgClass: "group-hover:bg-slate-500/[0.04] group-hover:border-slate-400/40",
    borderClass: "border-slate-100/80",
    shadowClass: "group-hover:shadow-[0_20px_35px_-8px_rgba(71,85,105,0.15)]",
    hoverBg: "bg-slate-500/[0.08] shadow-[0_4px_12px_rgba(71,85,105,0.12)]",
    activeIconColor: "text-slate-900",
    textHoverColor: "group-hover:text-slate-900",
  },
  "ac repair": {
    iconColor: "text-cyan-500 bg-cyan-50/50",
    bgClass: "group-hover:bg-cyan-500/[0.04] group-hover:border-cyan-400/40",
    borderClass: "border-slate-100/80",
    shadowClass: "group-hover:shadow-[0_20px_35px_-8px_rgba(6,182,212,0.15)]",
    hoverBg: "bg-cyan-500/[0.08] shadow-[0_4px_12px_rgba(6,182,212,0.12)]",
    activeIconColor: "text-cyan-600",
    textHoverColor: "group-hover:text-cyan-700",
    badgeText: "Trending",
    badgeColor: "bg-cyan-50 text-cyan-600 border-cyan-100",
  },
};

const getCategoryTheme = (categoryName: string) => {
  const name = categoryName.toLowerCase().trim();
  const theme = CATEGORY_THEMES[name];
  if (theme) return theme;

  if (name.includes("cleaning")) return CATEGORY_THEMES["cleaning"];
  if (
    name.includes("ac") ||
    name.includes("air conditioner") ||
    name.includes("cooling")
  )
    return CATEGORY_THEMES["ac repair"];
  if (
    name.includes("repair") ||
    name.includes("wrench") ||
    name.includes("service")
  )
    return CATEGORY_THEMES["repairs"];
  if (name.includes("appliance")) return CATEGORY_THEMES["appliance"];
  if (name.includes("paint")) return CATEGORY_THEMES["painting"];
  if (
    name.includes("beauty") ||
    name.includes("salon") ||
    name.includes("spa") ||
    name.includes("parlour")
  )
    return CATEGORY_THEMES["beauty"];

  return {
    iconColor: "text-slate-600 bg-slate-50/50",
    bgClass: "group-hover:bg-slate-500/[0.03] group-hover:border-slate-300",
    borderClass: "border-slate-100/80",
    shadowClass: "group-hover:shadow-[0_20px_35px_-8px_rgba(148,163,184,0.15)]",
    hoverBg: "bg-slate-500/[0.08] shadow-[0_4px_12px_rgba(148,163,184,0.12)]",
    activeIconColor: "text-slate-800",
    textHoverColor: "group-hover:text-blue-700",
  };
};

const getCategoryType = (
  categoryName: string,
): "Home" | "Professional" | "Repair" => {
  const name = categoryName.toLowerCase().trim();
  if (
    name.includes("repair") ||
    name.includes("appliance") ||
    name.includes("wrench") ||
    name.includes("ac ") ||
    name.includes("phone") ||
    name.includes("electrician") ||
    name.includes("plumb") ||
    name.includes("wiring") ||
    name.includes("switch") ||
    name.includes("device") ||
    name.includes("gadget") ||
    name.includes("purifier") ||
    name.includes("geyser") ||
    name.includes("heater") ||
    name.includes("tv") ||
    name.includes("refrigerat") ||
    name.includes("fan") ||
    name.includes("machine")
  ) {
    return "Repair";
  }
  if (
    name.includes("cleaning") ||
    name.includes("paint") ||
    name.includes("carpenter") ||
    name.includes("house") ||
    name.includes("wall") ||
    name.includes("drill")
  ) {
    return "Home";
  }
  return "Professional";
};

const CATEGORY_COLORS: Record<string, string> = {
  Cleaning: "text-rose-500 bg-rose-50",
  Repairs: "text-blue-500 bg-blue-50",
  Appliance: "text-emerald-500 bg-emerald-50",
  Painting: "text-amber-500 bg-amber-50",
  Beauty: "text-pink-500 bg-pink-50",
  "AC Repair": "text-cyan-500 bg-cyan-50",
};

export default function CustomerHome({
  setActiveTab,
  profile,
  onAuthRequired,
  onServiceSelect,
  initialCategoryId,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    setIsInfoOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [selectedCategory]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const recentlyLaunchedScrollRef = useRef<HTMLDivElement>(null);

  const [specCarouselActiveCatId, setSpecCarouselActiveCatId] =
    useState<string>("");
  const specCategoryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (allCategories.length > 0 && !specCarouselActiveCatId) {
      setSpecCarouselActiveCatId(
        selectedCategory ? selectedCategory.id : allCategories[0].id,
      );
    }
  }, [allCategories, selectedCategory]);

  const scrollSpecCategory = (direction: "left" | "right") => {
    if (specCategoryScrollRef.current) {
      const scrollAmount = 350;
      specCategoryScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (initialCategoryId && allCategories.length > 0) {
      const cat = allCategories.find((c) => c.id === initialCategoryId);
      if (cat) {
        setSelectedCategory(cat);
      }
    } else if (!initialCategoryId && allCategories.length > 0) {
      setSelectedCategory(null);
    }
  }, [initialCategoryId, allCategories]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoriesSearchQuery, setCategoriesSearchQuery] = useState("");
  const [categoryTypeTab, setCategoryTypeTab] = useState<
    "All" | "Home" | "Professional" | "Repair"
  >("All");
  const [currentPlaceholder, setCurrentPlaceholder] = useState(
    "AC repair, ro service, washing machine repair...",
  );

  useEffect(() => {
    const servicesList = [
      "AC Deep Cleaning",
      "TV Wall Mounting & Screen Fix",
      "Kitchen Exhaust & Chimney Clean",
      "Professional Fan Repair & Fixing",
      "RO Water Purifier Service",
      "Geyser Installation & Setup",
      "Microwave Heater Repairing",
      "Washing Machine Maintenance",
      "Refrigerator Gas Refilling",
      "Ceiling Fan Install & Wiring",
      "Drilling & Wall Hanging Service",
      "Home Fuse Switch Repairing",
    ];

    // Create a randomized copy and cycle through randomly
    const shuffled = [...servicesList].sort(() => Math.random() - 0.5);

    let isMounted = true;
    let serviceIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;

    const tick = () => {
      if (!isMounted) return;

      const currentService = shuffled[serviceIndex % shuffled.length];
      const prefix = "";

      if (isDeleting) {
        // Deleting character by character
        setCurrentPlaceholder(
          prefix + currentService.substring(0, charIndex - 1),
        );
        charIndex--;
        typingSpeed = 30; // Faster deletion
      } else {
        // Typing character by character
        setCurrentPlaceholder(
          prefix + currentService.substring(0, charIndex + 1),
        );
        charIndex++;
        typingSpeed = 80; // Standard speed
      }

      // Check state transitions
      if (!isDeleting && charIndex === currentService.length) {
        // Entire phrase is typed out - pause before starting deletion
        typingSpeed = 1800; // Stay visible for 1.8s
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        // Fully erased - move to next random service
        isDeleting = false;
        serviceIndex++;
        typingSpeed = 400; // Small delay before typing next string
      }

      setTimeout(tick, typingSpeed);
    };

    // Begin typing sequence
    const timerId = setTimeout(tick, 500);
    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, []);

  const [partners, setPartners] = useState<PartnerWithInfo[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [tickerDismissed, setTickerDismissed] = useState<boolean>(false);
  const [spotlightDismissed, setSpotlightDismissed] = useState<boolean>(false);

  const [recentCardDismissed, setRecentCardDismissed] =
    useState<boolean>(false);
  const [bookingPartner, setBookingPartner] = useState<{
    name: string;
    id: string;
  } | null>(null);
  const [showPaymentModalForHome, setShowPaymentModalForHome] =
    useState<Booking | null>(null);
  const [showHomePaymentQR, setShowHomePaymentQR] = useState<boolean>(false);
  const [homeQrCodeValue, setHomeQrCodeValue] = useState<string>("");
  const [paymentHasError, setPaymentHasError] = useState<boolean>(false);

  // Home card & force-review popup rating states
  const [homeRating, setHomeRating] = useState<number>(0);
  const [homeComment, setHomeComment] = useState<string>("");
  const [isSubmittingHomeReview, setIsSubmittingHomeReview] = useState<boolean>(false);
  const [ratedBookings, setRatedBookings] = useState<Record<string, boolean>>({});

  const [showForceFeedbackPopup, setShowForceFeedbackPopup] = useState<boolean>(false);
  const [popupWizardStep, setPopupWizardStep] = useState<number>(1);
  const [popupRatingPartner, setPopupRatingPartner] = useState<number>(0);
  const [popupRatingProcess, setPopupRatingProcess] = useState<number>(0);
  const [popupRatingSafety, setPopupRatingSafety] = useState<number>(0);
  const [popupRatingZomIndia, setPopupRatingZomIndia] = useState<number>(0);
  const [popupComment, setPopupComment] = useState<string>("");
  const [isSubmittingPopupReview, setIsSubmittingPopupReview] = useState<boolean>(false);

  const submitCardReview = async () => {
    if (!activeBooking || !profile) return;
    if (homeRating < 1 || homeRating > 5) {
      alert("Please select a star rating first!");
      return;
    }
    
    try {
      setIsSubmittingHomeReview(true);
      
      const reviewData = {
        bookingId: activeBooking.id,
        customerId: profile.uid,
        partnerId: activeBooking.partnerId || "",
        serviceId: activeBooking.serviceId,
        rating: homeRating,
        comment: homeComment,
        createdAt: Timestamp.now(),
        ratingDetails: {
          partner: homeRating,
          process: homeRating,
          safety: homeRating,
          zomindia: homeRating,
        }
      };
      
      await addDoc(collection(db, "reviews"), reviewData);
      
      setRatedBookings(prev => ({ ...prev, [activeBooking.id]: true }));
      setRecentCardDismissed(true);
      localStorage.setItem(`dismissed_ticker_${activeBooking.id}`, "true");
      
      setHomeRating(0);
      setHomeComment("");
    } catch (err) {
      console.error("Error submitting card rating:", err);
    } finally {
      setIsSubmittingHomeReview(false);
    }
  };

  const submitPopupReview = async () => {
    if (!activeBooking || !profile) return;
    const finalRating = Math.round((popupRatingPartner + popupRatingProcess + popupRatingSafety + popupRatingZomIndia) / 4) || 5;
    
    try {
      setIsSubmittingPopupReview(true);
      
      const reviewData = {
        bookingId: activeBooking.id,
        customerId: profile.uid,
        partnerId: activeBooking.partnerId || "",
        serviceId: activeBooking.serviceId,
        rating: finalRating,
        comment: popupComment,
        createdAt: Timestamp.now(),
        ratingDetails: {
          partner: popupRatingPartner || 5,
          process: popupRatingProcess || 5,
          safety: popupRatingSafety || 5,
          zomindia: popupRatingZomIndia || 5,
        }
      };
      
      await addDoc(collection(db, "reviews"), reviewData);
      
      setRatedBookings(prev => ({ ...prev, [activeBooking.id]: true }));
      setRecentCardDismissed(true);
      localStorage.setItem(`dismissed_ticker_${activeBooking.id}`, "true");
      setShowForceFeedbackPopup(false);
      
      setPopupWizardStep(1);
      setPopupRatingPartner(0);
      setPopupRatingProcess(0);
      setPopupRatingSafety(0);
      setPopupRatingZomIndia(0);
      setPopupComment("");
    } catch (err) {
      console.error("Error submitting popup rating:", err);
    } finally {
      setIsSubmittingPopupReview(false);
    }
  };

  const handleStarClick = (stepNum: number, ratingVal: number) => {
    if (stepNum === 1) setPopupRatingPartner(ratingVal);
    else if (stepNum === 2) setPopupRatingProcess(ratingVal);
    else if (stepNum === 3) setPopupRatingSafety(ratingVal);
    else if (stepNum === 4) setPopupRatingZomIndia(ratingVal);

    // Dynamic auto-advance to the next step after a light visual feedback lock-delay
    setTimeout(() => {
      setPopupWizardStep((prev) => Math.min(prev + 1, 5));
    }, 350);
  };

  const handleCloseCard = () => {
    if (!activeBooking) return;
    
    const isCompletedAndPaid = ["completed", "finalized", "closed"].includes(activeBooking.status) && activeBooking.paymentStatus === "paid";
    const hasAlreadyRated = ratedBookings[activeBooking.id] || localStorage.getItem(`dismissed_ticker_${activeBooking.id}`) === "true";
    
    if (isCompletedAndPaid && !hasAlreadyRated) {
      setPopupWizardStep(1);
      setShowForceFeedbackPopup(true);
    } else {
      setRecentCardDismissed(true);
      localStorage.setItem(`dismissed_ticker_${activeBooking.id}`, "true");
    }
  };

  useEffect(() => {
    if (!activeBooking?.partnerId) {
      setBookingPartner(null);
      return;
    }
    const fetchBookingPartner = async () => {
      try {
        const partnerDoc = await getDoc(
          doc(db, "partners", activeBooking.partnerId),
        );
        if (partnerDoc.exists()) {
          const partnerData = partnerDoc.data();
          const userDoc = await getDoc(doc(db, "users", partnerData.userId));
          const userData = userDoc.data();
          setBookingPartner({
            name:
              userData?.displayName ||
              partnerData.companyName ||
              "Expert Partner",
            id: activeBooking.partnerId,
          });
        }
      } catch (e) {
        console.error("Error fetching booking partner:", e);
      }
    };
    fetchBookingPartner();
  }, [activeBooking?.partnerId]);

  const bookingService = useMemo(() => {
    return activeBooking
      ? allServices.find((s) => s.id === activeBooking.serviceId)
      : null;
  }, [activeBooking, allServices]);

  const bookingCategory = useMemo(() => {
    return bookingService
      ? allCategories.find((c) => c.id === bookingService.categoryId)
      : null;
  }, [bookingService, allCategories]);

  const bookingCategoryIconName = bookingCategory?.icon || "sparkles";
  const BookingIcon = getCategoryIcon(bookingCategoryIconName);

  const formattedDate = useMemo(() => {
    if (!activeBooking) return "";
    const bookingDate =
      activeBooking.scheduledAt?.toDate?.() ||
      (activeBooking.scheduledAt
        ? new Date(activeBooking.scheduledAt)
        : new Date());
    return (
      bookingDate.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " @ " +
      bookingDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }, [activeBooking]);

  useEffect(() => {
    if (!profile) {
      setActiveBooking(null);
      return;
    }
    const q = query(
      collection(db, "bookings"),
      where("customerId", "==", profile.uid),
      where("status", "in", [
        "pending",
        "confirmed",
        "assigned",
        "on_the_way",
        "arrived",
        "in_progress",
        "payment_pending",
        "pending_parts",
        "completed",
        "finalized",
      ]),
      orderBy("createdAt", "desc"),
      limit(1),
    );
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const booking = {
          id: snap.docs[0].id,
          ...snap.docs[0].data(),
        } as Booking;
        setActiveBooking(booking);
        const isDismissed =
          localStorage.getItem(`dismissed_ticker_${booking.id}`) === "true";
        setTickerDismissed(isDismissed);
        setRecentCardDismissed(isDismissed);
      } else {
        setActiveBooking(null);
        setTickerDismissed(false);
        setRecentCardDismissed(false);
      }
    });
  }, [profile?.uid]);

  useEffect(() => {
    const q = query(collection(db, "promotions"), where("active", "==", true));
    getDocs(q)
      .then((snap) => {
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
      })
      .catch((err) => console.error("Error fetching promos:", err));
  }, []);

  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("name", "asc"));
    const unsubscribeCategories = onSnapshot(
      q,
      (snap) => {
        const cats = snap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Category,
        );
        if (cats.length === 0) {
          setCategories(SAMPLE_CATEGORIES as Category[]);
          setAllCategories(SAMPLE_CATEGORIES as Category[]);
        } else {
          setCategories(cats);
          setAllCategories(cats);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to categories:", err);
        setCategories(SAMPLE_CATEGORIES as Category[]);
        setLoading(false);
      },
    );
    return () => unsubscribeCategories();
  }, []);

  useEffect(() => {
    const unsubscribeServices = onSnapshot(
      collection(db, "services"),
      (snap) => {
        setAllServices(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Service),
        );
      },
      (err) => {
        console.error("Error subscribing to services:", err);
      },
    );
    return () => unsubscribeServices();
  }, []);

  const filteredSearchResults = useMemo(() => {
    if (searchQuery.trim() === "") return [];

    const results = allServices
      .map((service) => {
        const category = allCategories.find((c) => c.id === service.categoryId);
        const nameMatch = fuzzyMatch(service.name, searchQuery);
        const descMatch = fuzzyMatch(service.description, searchQuery);
        const catMatch = category
          ? fuzzyMatch(category.name, searchQuery)
          : { matches: false, score: 0 };

        const bestScore = Math.max(
          nameMatch.score,
          descMatch.score * 0.8,
          catMatch.score * 0.9,
        );
        const matches =
          nameMatch.matches || descMatch.matches || catMatch.matches;

        return { service, matches, score: bestScore };
      })
      .filter((item) => item.matches);

    results.sort((a, b) => b.score - a.score);
    return results.map((r) => r.service);
  }, [allServices, searchQuery, allCategories]);

  useEffect(() => {
    if (selectedCategory) {
      const fetchServices = async () => {
        const path = "services";
        try {
          const q = query(
            collection(db, path),
            where("categoryId", "==", selectedCategory.id),
          );
          const snap = await getDocs(q);
          setServices(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Service),
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, path);
        }
      };

      const fetchPartners = async () => {
        try {
          const q = query(
            collection(db, "partners"),
            where("categories", "array-contains", selectedCategory.id),
            where("status", "==", "active"),
          );
          const snap = await getDocs(q);
          const partnerList = await Promise.all(
            snap.docs.map(async (d) => {
              const data = d.data() as PartnerProfile;
              const userDoc = await getDoc(doc(db, "users", data.userId));
              const userData = userDoc.data() as UserProfile;
              return {
                ...data,
                id: d.id,
                displayName: userData?.displayName || "Service Pro",
                photoURL: userData?.photoURL,
              };
            }),
          );
          setPartners(partnerList);
        } catch (err) {
          console.warn("Silent skip partner fetch:", err);
        }
      };

      fetchServices();
      fetchPartners();
    }
  }, [selectedCategory]);

  const mostRecentService = (() => {
    if (!allServices || allServices.length === 0) return null;
    return [...allServices].sort((a, b) => {
      const timeA = a.createdAt?.seconds || a.createdAt?._seconds || 0;
      const timeB = b.createdAt?.seconds || b.createdAt?._seconds || 0;
      return timeB - timeA;
    })[0];
  })();

  const recentServiceCategory =
    mostRecentService && allCategories.length > 0
      ? allCategories.find((c) => c.id === mostRecentService.categoryId)
      : null;

  const scrollRecentlyLaunched = (direction: "left" | "right") => {
    if (recentlyLaunchedScrollRef.current) {
      const scrollAmount = 370;
      recentlyLaunchedScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (selectedCategory) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <button
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-700 mb-6 font-semibold transition-all hover:translate-x-[-4px]"
        >
          <ChevronLeft size={20} /> Back to home
        </button>

        <div className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-10 px-2">
          <div className="flex-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider mb-3"
            >
              <Sparkles size={12} /> {selectedCategory.name}
            </motion.div>
            <h2 className="text-3.5xl md:text-4.5xl font-black text-slate-900 tracking-tight leading-tight uppercase font-display">
              {selectedCategory.name}
            </h2>
          </div>
          {selectedCategory.images && selectedCategory.images.length > 0 ? (
            <div className="w-full lg:w-1/3 flex flex-col gap-5">
              <ImageCarousel images={selectedCategory.images} />
              {!isInfoOpen ? (
                <button
                  type="button"
                  onClick={() => setIsInfoOpen(true)}
                  className="group w-full inline-flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700 to-[#050ca6] hover:from-blue-800 hover:to-[#04098c] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/10 hover:shadow-blue-700/20 active:scale-[0.98] transition-all duration-300 select-none cursor-pointer border border-blue-600 hover:border-blue-700"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] animate-pulse">💡</span>{" "}
                    Explore service details
                  </span>
                  <span className="text-[10px] text-blue-105 group-hover:text-white transition-colors">
                    More Info ➔
                  </span>
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border-2 border-indigo-100 rounded-3xl p-6 shadow-xl relative text-left overflow-hidden flex flex-col gap-4"
                >
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl opacity-70 pointer-events-none" />

                  <div className="flex items-center gap-2 mb-1">
                    <span className="p-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg">
                      <Sparkles size={14} />
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">
                      Category Insights
                    </h4>
                  </div>

                  <p className="text-slate-700 text-sm font-semibold leading-relaxed">
                    {selectedCategory.description ||
                      "Verified professional home services delivered with care."}
                  </p>

                  <button
                    type="button"
                    onClick={() => setIsInfoOpen(false)}
                    className="self-end mt-2 px-4 py-2 bg-blue-750 hover:bg-blue-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 select-none shadow-md shadow-blue-500/10"
                  >
                    <span>Close Insights ✕</span>
                  </button>
                </motion.div>
              )}
            </div>
          ) : selectedCategory.imageURL ? (
            <div className="w-full lg:w-1/3 flex flex-col gap-5">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-full aspect-video lg:aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-slate-105 group cursor-pointer"
              >
                <img
                  src={selectedCategory.imageURL}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 animate-in fade-in"
                  alt={selectedCategory.name}
                  referrerPolicy="no-referrer"
                />
              </motion.div>
              {!isInfoOpen ? (
                <button
                  type="button"
                  onClick={() => setIsInfoOpen(true)}
                  className="group w-full inline-flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700 to-[#050ca6] hover:from-blue-800 hover:to-[#04098c] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/10 hover:shadow-blue-700/20 active:scale-[0.98] transition-all duration-300 select-none cursor-pointer border border-blue-600 hover:border-blue-700"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] animate-pulse">💡</span>{" "}
                    Explore service details
                  </span>
                  <span className="text-[10px] text-blue-105 group-hover:text-white transition-colors">
                    More Info ➔
                  </span>
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border-2 border-indigo-100 rounded-3xl p-6 shadow-xl relative text-left overflow-hidden flex flex-col gap-4"
                >
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl opacity-70 pointer-events-none" />

                  <div className="flex items-center gap-2 mb-1">
                    <span className="p-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg">
                      <Sparkles size={14} />
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">
                      Category Insights
                    </h4>
                  </div>

                  <p className="text-slate-700 text-sm font-semibold leading-relaxed">
                    {selectedCategory.description ||
                      "Verified professional home services delivered with care."}
                  </p>

                  <button
                    type="button"
                    onClick={() => setIsInfoOpen(false)}
                    className="self-end mt-2 px-4 py-2 bg-blue-750 hover:bg-blue-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 select-none shadow-md shadow-blue-500/10"
                  >
                    <span>Close Insights ✕</span>
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="w-full lg:w-1/3 flex flex-col gap-5">
              {!isInfoOpen ? (
                <button
                  type="button"
                  onClick={() => setIsInfoOpen(true)}
                  className="group w-full inline-flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700 to-[#050ca6] hover:from-blue-800 hover:to-[#04098c] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/10 hover:shadow-blue-700/20 active:scale-[0.98] transition-all duration-300 select-none cursor-pointer border border-blue-600 hover:border-blue-700"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] animate-pulse">💡</span>{" "}
                    Explore service details
                  </span>
                  <span className="text-[10px] text-blue-105 group-hover:text-white transition-colors">
                    More Info ➔
                  </span>
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border-2 border-indigo-100 rounded-3xl p-6 shadow-xl relative text-left overflow-hidden flex flex-col gap-4"
                >
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl opacity-70 pointer-events-none" />

                  <div className="flex items-center gap-2 mb-1">
                    <span className="p-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg">
                      <Sparkles size={14} />
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">
                      Category Insights
                    </h4>
                  </div>

                  <p className="text-slate-700 text-sm font-semibold leading-relaxed">
                    {selectedCategory.description ||
                      "Verified professional home services delivered with care."}
                  </p>

                  <button
                    type="button"
                    onClick={() => setIsInfoOpen(false)}
                    className="self-end mt-2 px-4 py-2 bg-blue-750 hover:bg-blue-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 select-none shadow-md shadow-blue-500/10"
                  >
                    <span>Close Insights ✕</span>
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
          {services.map((service, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={service.id}
              onClick={() => onServiceSelect(service.id)}
              className="bg-white/70 backdrop-blur-md p-8 border border-white/60 rounded-3xl hover:border-blue-700 transition-all shadow-sm hover:shadow-xl group flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-900 group-hover:bg-blue-700 group-hover:text-white transition-all duration-300">
                    <Zap size={22} strokeWidth={1.5} />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                      Starting from
                    </p>
                    <p className="text-xl font-bold text-slate-900">
                      ₹{service.basePrice}
                    </p>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3 hover:text-slate-600 transition-colors">
                  {service.name}
                </h3>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center text-amber-500">
                    <Star size={12} fill="currentColor" />
                    <span className="text-xs font-bold text-slate-900 ml-1">
                      {service.rating || 4.8}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium tracking-wide">
                    • {service.duration || "60 mins"}
                  </span>
                </div>
                {service.imageURL && (
                  <div className="w-full h-32 sm:h-40 rounded-2xl overflow-hidden mb-4 sm:mb-6 bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner relative">
                    <img
                      src={service.imageURL}
                      alt={service.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <p className="text-slate-500 text-sm mb-8 leading-relaxed line-clamp-2 font-medium opacity-80">
                  {service.description}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() =>
                    profile ? setSelectedService(service) : onAuthRequired()
                  }
                  className="w-full bg-blue-700 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-blue-800 transition-all active:scale-95 shadow-lg shadow-blue-700/5"
                >
                  Book now
                </button>
                <button
                  onClick={() => onServiceSelect(service.id)}
                  className="w-full py-2 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-blue-700 transition-colors"
                >
                  View details
                </button>
              </div>
            </motion.div>
          ))}
          {services.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400 font-medium bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-100">
              No services found in this category. We are working on it!
            </div>
          )}
        </div>

        {partners.length > 0 && (
          <div className="mt-20">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  Featured Partners
                </h3>
                <p className="text-slate-500">
                  Top-rated professionals specializing in{" "}
                  {selectedCategory.name}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="bg-slate-50 p-8 rounded-[40px] flex flex-col sm:flex-row gap-8 hover:bg-white border border-transparent hover:border-slate-200 transition-all group"
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={
                        partner.photoURL ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.displayName}`
                      }
                      alt={partner.displayName}
                      className="w-24 h-24 rounded-3xl object-cover bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -bottom-2 -right-2 flex flex-col items-end gap-1">
                      <div
                        className={`p-1.5 bg-white rounded-full shadow-sm border border-slate-100 ${partner.isVerified ? "text-emerald-500" : "text-slate-300"}`}
                      >
                        {partner.isVerified ? (
                          <CheckCircle2
                            size={16}
                            fill="currentColor"
                            className="text-white fill-emerald-500"
                          />
                        ) : (
                          <div className="w-4 h-4 bg-slate-100 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="mb-2">
                      <span
                        className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                          partner.isVerified
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {partner.isVerified
                          ? "KYC Verified"
                          : "KYC Not Verified"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-xl font-bold text-slate-900">
                        {partner.displayName}
                      </h4>
                      <div className="flex items-center gap-1 text-sm font-bold text-slate-900 border border-slate-200 px-3 py-1 rounded-full bg-white">
                        <Star
                          size={14}
                          fill="currentColor"
                          className="text-amber-400"
                        />{" "}
                        {partner.rating || "New"}
                      </div>
                    </div>
                    {partner.bio && (
                      <p className="text-slate-500 text-sm mb-4 line-clamp-2 italic">
                        "{partner.bio}"
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {partner.categories.slice(0, 3).map((catId) => {
                        const cat = categories.find((c) => c.id === catId);
                        return cat ? (
                          <span
                            key={catId}
                            className="text-[10px] uppercase font-bold tracking-widest text-slate-400"
                          >
                            #{cat.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <button className="text-sm font-bold text-slate-900 flex items-center gap-2 group-hover:gap-3 transition-all">
                      View Profile <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global/Explore Services Carousel & Navigation */}
        <div className="mt-16 border-t border-slate-100 pt-12 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 pb-4 border-b border-slate-50">
            <div>
              <span className="text-[10px] sm:text-xs font-black uppercase text-blue-700 tracking-[0.25em] mb-2 flex items-center gap-2">
                <Sparkles size={14} className="animate-pulse text-amber-500" />{" "}
                Discover All Service Categories
              </span>
              <h3 className="text-2.5xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase font-display">
                Browse Alternative Specialties
              </h3>
            </div>

            <div className="flex items-center gap-4">
              {/* Category Quick Filter Pills */}
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1.5 shrink-0 max-w-full">
                {allCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSpecCarouselActiveCatId(cat.id)}
                    type="button"
                    className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all select-none cursor-pointer whitespace-nowrap active:scale-95 border ${
                      specCarouselActiveCatId === cat.id
                        ? "bg-blue-700 border-blue-700 text-white shadow-xl shadow-blue-700/15"
                        : "bg-white border-slate-200 text-slate-400 hover:text-slate-950 hover:bg-slate-50"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Symmetrical Left/Right Arrows for Desk Desktop Browsing */}
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => scrollSpecCategory("left")}
                  className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-700 hover:border-blue-500 hover:shadow-md transition-all active:scale-95 cursor-pointer"
                  aria-label="Scroll left"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollSpecCategory("right")}
                  className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-700 hover:border-blue-500 hover:shadow-md transition-all active:scale-95 cursor-pointer"
                  aria-label="Scroll right"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="relative">
            <div
              ref={specCategoryScrollRef}
              className="flex gap-6 overflow-x-auto no-scrollbar pb-6 pt-2 scroll-smooth"
            >
              {allServices
                .filter((s) => s.categoryId === specCarouselActiveCatId)
                .map((srv) => (
                  <motion.div
                    key={srv.id}
                    whileHover={{ y: -4 }}
                    onClick={() => {
                      if (onServiceSelect) onServiceSelect(srv.id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex-shrink-0 w-76 sm:w-80 group cursor-pointer"
                  >
                    <div className="bg-white border border-slate-100 rounded-[32px] p-5 hover:border-blue-700 hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300 flex flex-col gap-5 shadow-sm">
                      {/* Image container */}
                      <div className="w-full h-40 rounded-2xl overflow-hidden relative bg-slate-50 border border-slate-100 shrink-0">
                        {srv.imageURL ? (
                          <img
                            src={srv.imageURL}
                            alt={srv.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-150 to-blue-50 flex items-center justify-center">
                            <span className="text-blue-700/60 font-black text-3xl italic tracking-tighter uppercase">
                              {srv.name.slice(0, 2)}
                            </span>
                          </div>
                        )}
                        <span className="absolute bottom-3.5 right-3.5 px-3 py-1.5 bg-blue-700 text-white rounded-xl text-[9px] font-black italic tracking-widest uppercase shadow-md border border-white/20">
                          ₹{srv.basePrice}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex flex-col justify-between flex-1 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors uppercase tracking-tight line-clamp-1 font-display">
                            {srv.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 font-medium">
                            {srv.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-50 w-full min-w-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
                              <Star size={11} fill="currentColor" />
                              <span className="text-[10px] font-bold text-slate-800">
                                {srv.rating || 4.8}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                              • {srv.duration || "60 mins"}
                            </span>
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-blue-700 group-hover:text-blue-800 transition-colors flex items-center gap-1">
                            Book{" "}
                            <ArrowRight
                              size={10}
                              className="group-hover:translate-x-0.5 transition-transform"
                            />
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              {allServices.filter(
                (s) => s.categoryId === specCarouselActiveCatId,
              ).length === 0 && (
                <div className="w-full py-12 text-center text-slate-400 font-medium bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                  No additional services listed inside this category.
                </div>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {selectedService && (
            <BookingModal
              service={selectedService}
              profile={profile}
              onClose={() => setSelectedService(null)}
              onSuccess={() => setActiveTab("home")}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-20">
      {profile?.role === "partner" && (
        <div className="bg-amber-50 border-b border-amber-100 py-3 px-4 flex items-center justify-center gap-3 sticky top-20 z-[40]">
          <div className="p-1.5 bg-amber-500 rounded-lg text-white">
            <ShieldCheck size={16} />
          </div>
          <p className="text-amber-900 text-xs font-bold uppercase tracking-widest leading-none">
            Partner Reference Mode:{" "}
            <span className="font-medium normal-case tracking-normal text-amber-700 ml-1">
              You can explore services but booking is restricted for partners.
            </span>
          </p>
        </div>
      )}

      {/* Hero Section */}
      <section className={`relative min-h-[400px] md:min-h-[500px] py-12 flex items-center justify-center bg-blue-700 transition-all ${searchQuery ? 'z-[45] overflow-visible' : 'z-10 overflow-hidden'}`}>
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            className="w-full h-full object-cover opacity-40 mix-blend-multiply"
            alt="Cleaner working"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/60 via-blue-900/40 to-slate-900/90" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
          {activeBooking && !recentCardDismissed ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">
              {/* Left Column: Welcome Message and Search Input */}
              <div className="lg:col-span-6 space-y-6">
                <motion.h1
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-4xl md:text-5xl font-bold text-white tracking-tight font-display drop-shadow-lg"
                >
                  Quality home services, on demand
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-base text-blue-50 font-medium drop-shadow-md"
                >
                  Trusted experts for cleaning, repairs, and beauty at home.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative w-full shadow-2xl rounded-[24px]"
                >
                  <div className="relative flex items-center bg-white rounded-[24px] p-2 border border-white/20 backdrop-blur-sm" onTouchStartCapture={(e) => e.stopPropagation()} onMouseDownCapture={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      inputMode="text"
                      enterKeyHint="search"
                      placeholder={currentPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-6 py-4 bg-transparent focus:outline-none text-slate-800 font-bold text-base placeholder:text-slate-400 placeholder:font-medium"
                    />
                    <button
                      type="button"
                      className="bg-blue-700 hover:bg-blue-800 text-white p-4 rounded-xl transition-all shadow-lg active:scale-95 shrink-0 flex items-center justify-center w-12 h-12 cursor-pointer"
                      aria-label="Search"
                    >
                      <Search size={20} />
                    </button>
                  </div>
                  {/* Search Results Dropdown */}
                  <AnimatePresence>
                    {searchQuery && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-0 right-0 top-full mt-4 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 text-left"
                      >
                        {filteredSearchResults.length > 0 ? (
                          <div className="max-h-[300px] overflow-y-auto py-2">
                            {filteredSearchResults.map((service) => (
                              <button
                                key={service.id}
                                onClick={() => {
                                  onServiceSelect(service.id);
                                  setSearchQuery("");
                                }}
                                className="w-full px-6 py-4 hover:bg-slate-50 flex items-center gap-4 transition-colors text-left"
                              >
                                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                                  <img
                                    src={service.imageURL}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">
                                    {service.name}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    Starting from ₹{service.basePrice}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-slate-400 font-medium text-sm">
                            No results found for "{searchQuery}"
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* Right Column: Sleek, compact main booking details card */}
              <div className="lg:col-span-5 w-full flex items-center justify-center lg:justify-end">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 100,
                    damping: 15,
                  }}
                  className="bg-white rounded-[24px] p-4 shadow-2xl border border-slate-100 relative flex flex-col gap-2.5 text-slate-800 transition-all duration-300 hover:shadow-blue-900/5 hover:border-slate-200/60 w-full max-w-[320px] text-left shrink-0 overflow-hidden"
                >
                  {/* Top-right close symbol with dynamic review feedback pop interception */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseCard();
                    }}
                    className="absolute top-3.5 right-3.5 p-1.5 bg-slate-50 hover:bg-slate-100/80 text-slate-400 hover:text-slate-600 rounded-full transition-all border border-slate-100 cursor-pointer z-20"
                    title="Dismiss booking card"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>

                  {/* Top Header Row with pulsator and Status Badge */}
                  <div className="flex items-center justify-between pr-6">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        {!["completed", "finalized", "closed"].includes(activeBooking.status) && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${["completed", "finalized", "closed"].includes(activeBooking.status) ? "bg-emerald-500" : "bg-blue-600"}`}></span>
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        #{activeBooking.id.slice(-6).toUpperCase()}
                      </span>
                    </div>

                    {(() => {
                      const isNotAssigned = ["pending", "pending_parts"].includes(activeBooking.status) || !activeBooking.partnerId;
                      const isCompleted = ["completed", "finalized", "closed"].includes(activeBooking.status);
                      
                      let statusBadgeColor = "bg-blue-50 text-blue-700 border-blue-105";
                      let statusText = activeBooking.status.replace("_", " ");
                      
                      if (isNotAssigned) {
                        statusBadgeColor = "bg-amber-50 text-amber-700 border-amber-100";
                        statusText = "Assigning Pro";
                      } else if (isCompleted) {
                        statusBadgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                        statusText = "Completed";
                      } else if (activeBooking.status === "on_the_way") {
                        statusText = "Pro En-Route";
                      } else if (activeBooking.status === "arrived") {
                        statusBadgeColor = "bg-indigo-50 text-indigo-700 border-indigo-100";
                        statusText = "Pro Arrived";
                      } else if (activeBooking.status === "in_progress") {
                        statusBadgeColor = "bg-blue-50 text-blue-700 border-blue-100";
                        statusText = "In Progress";
                      } else if (activeBooking.status === "payment_pending") {
                        statusBadgeColor = "bg-orange-50 text-orange-700 border-orange-100 animate-pulse";
                        statusText = "Pay Invoice";
                      }
                      
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusBadgeColor}`}>
                          {statusText}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Service Type Compact Display */}
                  <div className="flex items-center gap-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
                      {bookingService?.imageURL ? (
                        <img
                          src={bookingService.imageURL}
                          alt={bookingService.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Zap size={16} className="text-blue-600 animate-pulse" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[8px] font-black text-slate-450 uppercase tracking-widest leading-none mb-0.5">
                        {["completed", "finalized", "closed"].includes(activeBooking.status) ? "Completed Service" : "Active Service"}
                      </span>
                      <h4 className="text-xs font-black text-slate-950 leading-tight truncate uppercase italic tracking-tight">
                        {bookingService?.name || "Home Maintenance"}
                      </h4>
                    </div>
                  </div>

                  {/* Service details fields (Time and Assigned Expert) */}
                  <div className="space-y-1.5 text-[11px] text-slate-600 font-medium px-0.5">
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate text-slate-705 font-semibold">{formattedDate}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {bookingPartner ? (
                        <>
                          <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 flex items-center justify-center text-[9px] font-black text-emerald-700 shrink-0">
                            {bookingPartner.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate text-slate-700">
                            Pro Expert: <span className="text-emerald-600 font-bold">{bookingPartner.name}</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-4.5 h-4.5 rounded-full bg-amber-50 flex items-center justify-center text-[9px] font-black text-amber-700 shrink-0 border border-amber-100">
                            ?
                          </div>
                          <span className="text-slate-500 italic">Matching Best Expert Pro...</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Price Value and Track Action Footer */}
                  <div className="flex items-center justify-between pt-2.5 mt-0.5 border-t border-slate-100">
                    <div>
                      <span className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-0.5">
                        Est. Price
                      </span>
                      <span className="text-base font-black text-slate-900 font-display italic">
                        ₹{activeBooking.totalPrice}
                      </span>
                    </div>

                    {!["completed", "finalized", "closed"].includes(activeBooking.status) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab("bookings", activeBooking.id);
                        }}
                        className="bg-blue-700 hover:bg-blue-800 text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-md shadow-blue-700/10 active:scale-95 flex items-center gap-1.5 border-0 cursor-pointer"
                      >
                        Track Job <ArrowRight size={11} strokeWidth={2.5} />
                      </button>
                    ) : activeBooking.paymentStatus !== "paid" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPaymentModalForHome(activeBooking);
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1.5 border-0 cursor-pointer animate-pulse"
                      >
                        Pay Invoice <ArrowRight size={11} strokeWidth={2.5} />
                      </button>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-150">
                        Paid & Completed
                      </span>
                    )}
                  </div>

                  {/* Rating & Review option at bottom of completed card */}
                  {["completed", "finalized", "closed"].includes(activeBooking.status) && (
                    <div className="mt-2.5 pt-3 border-t border-slate-100 flex flex-col gap-2 relative z-30" onClick={(e) => e.stopPropagation()}>
                      {ratedBookings[activeBooking.id] ? (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-2.5 rounded-2xl text-center space-y-0.5 shadow-sm">
                          <p className="text-[9.5px] font-black uppercase tracking-widest text-emerald-700">Thank you!</p>
                          <p className="text-[9px] font-bold text-slate-650">Your review has been successfully submitted.</p>
                        </div>
                      ) : activeBooking.paymentStatus !== "paid" ? (
                        <div className="bg-amber-50/50 border border-amber-100 p-2.5 rounded-xl text-center space-y-1">
                          <p className="text-[9.5px] font-black text-amber-800 uppercase tracking-wide">Payment Needed</p>
                          <p className="text-[9px] font-semibold text-slate-500">
                            Please complete payment first to share experience rating & feedback.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 leading-none pl-0.5">
                            Rate & Review Service
                          </p>
                          
                          {/* Mini star selector */}
                          <div className="flex items-center gap-1.5 pl-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setHomeRating(star)}
                                className="transition-transform active:scale-130 hover:scale-110 cursor-pointer"
                              >
                                <Star
                                  size={18}
                                  fill={star <= homeRating ? "currentColor" : "none"}
                                  className={star <= homeRating ? "text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.3)]" : "text-slate-200 hover:text-amber-300"}
                                />
                              </button>
                            ))}
                            {homeRating > 0 && (
                              <span className="text-[9px] font-black text-amber-600 uppercase font-mono bg-amber-50 px-2 py-0.5 rounded-md">
                                {homeRating} Star{homeRating > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>

                          {/* Quick comment feedback */}
                          <div className="relative">
                            <input
                              type="text"
                              value={homeComment}
                              onChange={(e) => setHomeComment(e.target.value)}
                              placeholder="Add feedback? (excellence behavior, prompt)..."
                              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-[10px] focus:ring-2 focus:ring-blue-600/50 outline-none placeholder:text-slate-400 font-medium text-slate-800"
                            />
                          </div>

                          {/* Action Submission Button */}
                          <button
                            type="button"
                            onClick={submitCardReview}
                            disabled={homeRating === 0 || isSubmittingHomeReview}
                            className={`w-full py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                              homeRating === 0 || isSubmittingHomeReview
                                ? "bg-slate-100 text-slate-405 border border-slate-200/50 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-705 text-white shadow-md active:scale-97 cursor-pointer"
                            }`}
                          >
                            {isSubmittingHomeReview ? (
                              <BrandedButtonSpinner className="w-3.5 h-3.5" />
                            ) : (
                              <Sparkles size={11} className="animate-pulse" />
                            )}
                            {isSubmittingHomeReview ? "Submitting..." : "Submit Experience Feedback"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto text-center">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight font-display drop-shadow-lg"
              >
                Quality home services, on demand
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg md:text-xl text-blue-50 mb-8 font-medium drop-shadow-md max-w-2xl mx-auto"
              >
                Trusted experts for cleaning, repairs, and beauty at home.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative max-w-3xl mx-auto mb-10"
              >
                <div className="relative flex items-center bg-white rounded-[24px] shadow-2xl p-2 border border-white/20 backdrop-blur-sm" onTouchStartCapture={(e) => e.stopPropagation()} onMouseDownCapture={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    inputMode="text"
                    enterKeyHint="search"
                    placeholder={currentPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-6 py-4 bg-transparent focus:outline-none text-slate-800 font-bold text-base sm:text-lg placeholder:text-slate-400 placeholder:font-medium"
                  />
                  <button
                    type="button"
                    className="bg-blue-700 hover:bg-blue-800 text-white p-4 rounded-xl transition-all shadow-lg shadow-blue-700/20 active:scale-95 shrink-0 flex items-center justify-center w-12 h-12"
                    aria-label="Search"
                  >
                    <Search size={20} />
                  </button>
                </div>
                {/* Search Results Dropdown */}
                <AnimatePresence>
                  {searchQuery && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 right-0 top-full mt-4 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 text-left"
                    >
                      {filteredSearchResults.length > 0 ? (
                        <div className="max-h-[300px] overflow-y-auto py-2">
                          {filteredSearchResults.map((service) => (
                            <button
                              key={service.id}
                              onClick={() => {
                                onServiceSelect(service.id);
                                setSearchQuery("");
                              }}
                              className="w-full px-6 py-4 hover:bg-slate-50 flex items-center gap-4 transition-colors"
                            >
                              <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden">
                                <img
                                  src={service.imageURL}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">
                                  {service.name}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Starting from ₹{service.basePrice}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-400 font-medium text-sm">
                          No results found for "{searchQuery}"
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          )}
        </div>
      </section>

      {/* Main Container */}
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 relative z-20"
      >
        {/* Top Feature / Spotlight Spot wrapper */}
        {mostRecentService && !spotlightDismissed ? (
          <motion.div
            layout="position"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="-mt-24 sm:-mt-28 md:-mt-32 mb-12 relative z-30"
            id="top-spot-container"
          >
            <motion.div
              layout
              className="grid grid-cols-1 gap-6 items-stretch"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {/* Admin Launch Spotlight Banner */}
                {mostRecentService && !spotlightDismissed && (
                  <motion.div
                    key={`spotlight-${mostRecentService.id}`}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    onClick={() => onServiceSelect(mostRecentService.id)}
                    className="bg-white text-slate-900 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] cursor-pointer flex flex-col justify-between gap-3 sm:gap-5 group overflow-hidden relative border border-slate-205 hover:border-blue-500/40 hover:shadow-2xl hover:shadow-blue-900/5 transition-all duration-300 w-full shadow-xl"
                  >
                    {/* Close/Skip Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSpotlightDismissed(true);
                      }}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all cursor-pointer absolute top-3 right-3 sm:top-5 sm:right-5 z-20 hover:scale-105 active:scale-95 border border-slate-200 shadow-sm"
                      title="Skip recently added service"
                    >
                      <X size={14} className="sm:w-4 sm:h-4" />
                    </button>

                    {/* Decorative Glowing Backdrop Orbits */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[60px] pointer-events-none group-hover:bg-blue-500/10 group-hover:scale-110 transition-all duration-500" />
                    <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-500" />

                    <div className="space-y-3 sm:space-y-4 relative z-10">
                      {/* Header Row */}
                      <div className="flex items-center justify-between gap-2 sm:gap-4 w-full pr-7 sm:pr-9">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          {mostRecentService.imageURL ? (
                            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 border border-slate-205 shrink-0 shadow-sm animate-in fade-in">
                              <img
                                src={mostRecentService.imageURL}
                                alt={mostRecentService.name}
                                className="w-full h-full object-cover opacity-100 group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 font-black text-white flex items-center justify-center text-xs sm:text-sm shrink-0 shadow-md">
                              {mostRecentService.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="flex h-1 w-1 sm:h-1.5 sm:w-1.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1 w-1 sm:h-1.5 sm:w-1.5 bg-blue-600" />
                              </span>
                              <span className="text-[7.5px] sm:text-[9px] font-black uppercase tracking-[0.1em] sm:tracking-[0.18em] text-blue-700 font-mono">
                                Recently Added Service
                              </span>
                            </div>
                            <h4 className="text-sm sm:text-lg font-extrabold tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors duration-200 truncate pr-1 sm:pr-4">
                              {mostRecentService.name}
                            </h4>
                          </div>
                        </div>

                        {/* Launch pricing badge */}
                        <div className="text-right shrink-0 pl-1">
                          <span className="text-[7px] sm:text-[8px] text-slate-550 uppercase font-black tracking-widest block mb-0.5">
                            Launches @
                          </span>
                          <span className="text-xs sm:text-base font-black text-emerald-805">
                            ₹{mostRecentService.basePrice}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Row */}
                    <div className="flex flex-row items-center justify-between pt-2.5 sm:pt-4 border-t border-slate-200 relative z-10 gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {recentServiceCategory && (
                          <span className="text-[8px] sm:text-[9px] bg-blue-50/80 border border-blue-200/50 text-blue-700 font-extrabold uppercase px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl tracking-wider font-mono">
                            {recentServiceCategory.name}
                          </span>
                        )}
                        {mostRecentService.duration && (
                          <span className="text-[8px] sm:text-[9px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg border border-slate-200 font-mono">
                            ⏱️ {mostRecentService.duration}
                          </span>
                        )}
                      </div>

                      <span className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-[#050ca6] select-none pr-1 transition-colors group-hover:text-amber-600">
                        Tap to Book{" "}
                        <ArrowRight
                          size={12}
                          className="text-[#050ca6] transition-all group-hover:translate-x-1 group-hover:text-amber-600"
                        />
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ) : null}

        {/* Categories Grid */}
        <motion.section
          layout="position"
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className={`mb-12 animate-fade-in ${(activeBooking && !tickerDismissed) || (mostRecentService && !spotlightDismissed) ? "mt-4" : "-mt-24 sm:-mt-28 md:-mt-32 relative z-30"}`}
          id="categories-grid"
        >
          <div className="bg-white rounded-[40px] border border-slate-100/90 shadow-[0_24px_50px_-12px_rgba(15,23,42,0.03),0_8px_20px_-6px_rgba(15,23,42,0.01)] pt-3 sm:pt-6 md:pt-6 px-4 sm:px-8 md:px-10 pb-16 sm:pb-24 relative overflow-hidden group">
            {/* Ambient gradient backdrops */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-50/20 to-slate-50/10 rounded-full blur-3xl pointer-events-none -translate-y-12 translate-x-12 transition-transform duration-1000 group-hover:scale-110" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-sky-50/20 to-slate-50/10 rounded-full blur-3xl pointer-events-none translate-y-12 -translate-x-12 transition-transform duration-1000 group-hover:scale-110" />

            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-slate-100 relative z-10">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                  Explore{" "}
                  <span className="text-blue-700 font-black">Services</span>
                </h3>
              </div>
            </div>

            {/* Filter and Search Bar Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 sm:mb-10 pb-1 sm:pb-2 relative z-10">
              {/* Tab Navigation */}
              <div className="flex border-b border-slate-100/80 overflow-x-auto gap-4 sm:gap-5 no-scrollbar scroll-smooth w-full md:w-auto">
                {(["All", "Home", "Professional", "Repair"] as const).map(
                  (tab) => {
                    const isActive = categoryTypeTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setCategoryTypeTab(tab)}
                        className={`px-3 md:px-4 py-3 sm:py-3.5 font-bold text-[11px] sm:text-xs select-none cursor-pointer tracking-wider uppercase transition-all border-b-2 whitespace-nowrap active:scale-95 duration-200 ${
                          isActive
                            ? "border-blue-700 text-blue-700 font-black"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {tab}
                      </button>
                    );
                  },
                )}
              </div>

              {/* Local Category & Service Search */}
              <div className="relative w-full md:w-64 shrink-0 transition-all duration-300 focus-within:md:w-72">
                <Search
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={categoriesSearchQuery}
                  onChange={(e) => setCategoriesSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 md:py-2.5 bg-slate-50 border border-slate-100/90 rounded-full text-xs font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-4 focus:ring-blue-700/5 focus:border-blue-700 focus:bg-white transition-all shadow-inner"
                />
                {categoriesSearchQuery && (
                  <button
                    onClick={() => setCategoriesSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    aria-label="Clear filter"
                  >
                    <X size={12} className="stroke-[3]" />
                  </button>
                )}
              </div>
            </div>

            {/* Service Categories Grid */}
            <motion.div
              layout
              className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-y-5 sm:gap-y-10 gap-x-2 sm:gap-x-4 items-center justify-items-center relative z-10 min-h-[140px]"
            >
              <AnimatePresence mode="popLayout">
                {categories
                  .filter((cat) => {
                    if (categoryTypeTab !== "All") {
                      const type = getCategoryType(cat.name);
                      if (type !== categoryTypeTab) return false;
                    }
                    if (categoriesSearchQuery.trim() !== "") {
                      const queryStr = categoriesSearchQuery
                        .toLowerCase()
                        .trim();
                      const catMatches = cat.name
                        .toLowerCase()
                        .includes(queryStr);
                      if (catMatches) return true;

                      const servicesInCat = allServices.filter(
                        (s) => s.categoryId === cat.id,
                      );
                      return servicesInCat.some(
                        (s) =>
                          s.name.toLowerCase().includes(queryStr) ||
                          (s.description &&
                            s.description.toLowerCase().includes(queryStr)),
                      );
                    }
                    return true;
                  })
                  .map((cat, i) => {
                    const Icon = getCategoryIcon(cat.icon);
                    const theme = getCategoryTheme(cat.name);
                    const isFailedIcon = failedIcons[cat.id];
                    const hasValidIconURL =
                      cat.iconURL &&
                      cat.iconURL.trim() !== "" &&
                      cat.iconURL.includes("/") &&
                      !isFailedIcon;

                    return (
                      <motion.button
                        key={cat.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -15 }}
                        viewport={{ once: true }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 25,
                          layout: { duration: 0.3 },
                        }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          setSelectedCategory(cat);
                          e.currentTarget.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                        className="flex flex-col items-center group transition-all w-full cursor-pointer focus:outline-none relative"
                      >
                        {/* The Inner Card Container */}
                        <div
                          className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white rounded-[24px] sm:rounded-[30px] flex items-center justify-center transition-all duration-300 mb-2 sm:mb-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)] border ${theme.borderClass} group-hover:-translate-y-1.5 ${theme.bgClass} group-hover:border-transparent ${theme.shadowClass} relative overflow-hidden`}
                        >
                          {/* Interactive Colorful Glow Backing */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                          <div
                            className="absolute -inset-10 bg-current filter blur-xl opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500 rounded-full pointer-events-none"
                            style={{ color: "inherit" }}
                          />

                          {theme.badgeText && (
                            <div
                              className={`absolute top-1.5 sm:top-2 right-1.5 sm:right-2 px-1.5 py-0.5 rounded-full text-[6px] sm:text-[7px] font-black uppercase tracking-wider border z-20 ${theme.badgeColor || "bg-blue-50 text-blue-600 border-blue-100"}`}
                            >
                              {theme.badgeText}
                            </div>
                          )}

                          {/* Sub-container representing circle backdrop */}
                          <div className="w-13 h-13 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full bg-slate-50/60 group-hover:bg-white flex items-center justify-center transition-all duration-300 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.01)] group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] relative z-10 p-1.5 sm:p-2 sm:overflow-hidden">
                            {hasValidIconURL ? (
                              <motion.img
                                whileHover={{ scale: 1.12, rotate: 4 }}
                                src={cat.iconURL}
                                alt={cat.name}
                                width={512}
                                height={512}
                                className="w-full h-full object-contain transition-transform duration-300"
                                referrerPolicy="no-referrer"
                                onError={() => {
                                  setFailedIcons((prev) => ({
                                    ...prev,
                                    [cat.id]: true,
                                  }));
                                }}
                              />
                            ) : (
                              <motion.div
                                whileHover={{ scale: 1.15 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 420,
                                  damping: 9,
                                }}
                                className={`${theme.iconColor} group-hover:${theme.activeIconColor}`}
                              >
                                <Icon
                                  size={30}
                                  className="sm:size-[34px] md:size-[40px] stroke-[1.5] transition-colors duration-300"
                                />
                              </motion.div>
                            )}
                          </div>
                        </div>
                        {/* Text block label */}
                        <span
                          className={`text-[10px] sm:text-[11px] md:text-xs font-bold text-slate-700 ${theme.textHoverColor} tracking-tight transition-colors duration-300 mt-1 text-center leading-tight max-w-[80px] sm:max-w-[95px] md:max-w-[110px] line-clamp-2 select-none`}
                        >
                          {cat.name}
                        </span>
                      </motion.button>
                    );
                  })}
              </AnimatePresence>

              {/* Empty state overlay inside grid */}
              {categories.filter((cat) => {
                if (categoryTypeTab !== "All") {
                  const type = getCategoryType(cat.name);
                  if (type !== categoryTypeTab) return false;
                }
                if (categoriesSearchQuery.trim() !== "") {
                  const queryStr = categoriesSearchQuery.toLowerCase().trim();
                  const catMatches = cat.name.toLowerCase().includes(queryStr);
                  if (catMatches) return true;

                  const servicesInCat = allServices.filter(
                    (s) => s.categoryId === cat.id,
                  );
                  return servicesInCat.some(
                    (s) =>
                      s.name.toLowerCase().includes(queryStr) ||
                      (s.description &&
                        s.description.toLowerCase().includes(queryStr)),
                  );
                }
                return true;
              }).length === 0 && (
                <div className="col-span-full py-12 text-center w-full bg-slate-50/50 rounded-3xl border border-dashed border-slate-200/60 p-6 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    No Services Found
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    Try adjusting your category filter or search keywords.
                  </p>
                </div>
              )}

              {categoriesSearchQuery.trim() === "" && (
                <motion.button
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center group transition-all w-full cursor-pointer focus:outline-none"
                  onClick={() => {
                    const detailsSec =
                      document.getElementById("categories-grid");
                    if (detailsSec) {
                      window.scrollTo({
                        top:
                          detailsSec.offsetTop + detailsSec.offsetHeight + 100,
                        behavior: "smooth",
                      });
                    }
                  }}
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white rounded-[24px] sm:rounded-[30px] flex items-center justify-center transition-all duration-300 mb-2 sm:mb-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)] border border-slate-100/80 group-hover:-translate-y-1.5 group-hover:bg-slate-500/[0.03] group-hover:border-slate-300 group-hover:shadow-[0_20px_35px_-8px_rgba(148,163,184,0.15)] relative overflow-hidden">
                    <div className="w-12 h-12 sm:w-15 sm:h-15 md:w-18 md:h-18 rounded-full bg-slate-50/60 group-hover:bg-white flex items-center justify-center transition-all duration-300 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.01)] group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] relative z-10">
                      <div className="flex gap-1 items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-300 group-hover:scale-125 group-hover:bg-blue-600" />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-300 group-hover:scale-125 group-hover:bg-blue-600" />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-300 group-hover:scale-125 group-hover:bg-blue-600" />
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-[11px] md:text-xs font-bold text-slate-700 group-hover:text-blue-700 tracking-tight transition-colors duration-300 mt-1 text-center leading-tight select-none">
                    More
                  </span>
                </motion.button>
              )}
            </motion.div>
          </div>
        </motion.section>

        {/* Seasonal Offers & Trending Highlights */}
        <section className="mb-14 w-full" id="seasonal-deals">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: AC Cooling Promotion */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                navigator.clipboard.writeText("SUMMER20");
                setCopiedCode("SUMMER20");
                (window as any).__showCopyToast?.("SUMMER20");
                setTimeout(() => setCopiedCode(null), 2000);
              }}
              className="bg-gradient-to-br from-cyan-500/10 via-blue-500/[0.04] to-transparent rounded-[32px] p-6 sm:p-8 border border-cyan-100/70 hover:border-cyan-200 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-[0_20px_40px_rgba(6,182,212,0.08)] flex items-center justify-between relative overflow-hidden group cursor-pointer transition-all duration-300"
            >
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-cyan-100/20 -skew-x-12 translate-x-12 group-hover:translate-x-4 transition-transform duration-700" />
              {/* Interactive Radial glow */}
              <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-cyan-400/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-cyan-100 text-cyan-800 border border-cyan-200/50">
                    Cooling deals
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    AC Maintenance
                  </span>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight mb-1">
                  Cool Summer{" "}
                  <span className="text-cyan-600 font-extrabold uppercase italic">
                    20% OFF
                  </span>
                </h4>
                <p className="text-xs text-slate-500 font-medium mb-4">
                  Complete sanitization & troubleshooting
                </p>
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-colors duration-300 border ${
                    copiedCode === "SUMMER20"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white/90 border-slate-100 text-slate-800 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-transparent"
                  }`}
                >
                  {copiedCode === "SUMMER20" ? (
                    <>
                      <Check size={11} className="stroke-[2.5]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={10} className="stroke-[2.5]" />
                      <span>Code: SUMMER20</span>
                    </>
                  )}
                </div>
              </div>

              <div className="relative z-10 w-20 h-20 text-cyan-600/80 group-hover:text-cyan-600 transition-colors duration-300 transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 shrink-0 select-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-full h-full"
                >
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M6 10h12" />
                  <path d="M6 14h12" />
                </svg>
              </div>
            </motion.div>

            {/* Card 2: Home Cleaning Promotion */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                navigator.clipboard.writeText("CLEAN15");
                setCopiedCode("CLEAN15");
                (window as any).__showCopyToast?.("CLEAN15");
                setTimeout(() => setCopiedCode(null), 2000);
              }}
              className="bg-gradient-to-br from-rose-500/10 via-pink-500/[0.04] to-transparent rounded-[32px] p-6 sm:p-8 border border-rose-100/70 hover:border-rose-200 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-[0_20px_40px_rgba(244,63,94,0.08)] flex items-center justify-between relative overflow-hidden group cursor-pointer transition-all duration-300"
            >
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-rose-100/20 -skew-x-12 translate-x-12 group-hover:translate-x-4 transition-transform duration-700" />
              {/* Interactive Radial glow */}
              <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-rose-400/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200/50">
                    Spotless Home
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Full Cleaning
                  </span>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight mb-1">
                  Deep House{" "}
                  <span className="text-rose-600 font-extrabold uppercase italic">
                    15% OFF
                  </span>
                </h4>
                <p className="text-xs text-slate-500 font-medium mb-4">
                  Certified professional team & premium supplies
                </p>
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-colors duration-300 border ${
                    copiedCode === "CLEAN15"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white/90 border-slate-100 text-slate-800 group-hover:bg-rose-600 group-hover:text-white group-hover:border-transparent"
                  }`}
                >
                  {copiedCode === "CLEAN15" ? (
                    <>
                      <Check size={11} className="stroke-[2.5]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={10} className="stroke-[2.5]" />
                      <span>Code: CLEAN15</span>
                    </>
                  )}
                </div>
              </div>

              <div className="relative z-10 w-20 h-20 text-rose-500/80 group-hover:text-rose-500 transition-colors duration-300 transform group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 shrink-0 select-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-full h-full"
                >
                  <path d="m14 2 2-2 6 6-2 2Z" />
                  <path d="M12 4H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h9Z" />
                  <path d="M18 14h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z" />
                  <path d="M2 17h20v2H2Z" />
                </svg>
              </div>
            </motion.div>

            {/* Card 3: Appliance Care Promotion */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                navigator.clipboard.writeText("FIXIT250");
                setCopiedCode("FIXIT250");
                (window as any).__showCopyToast?.("FIXIT250");
                setTimeout(() => setCopiedCode(null), 2000);
              }}
              className="bg-gradient-to-br from-amber-500/10 via-yellow-500/[0.04] to-transparent rounded-[32px] p-6 sm:p-8 border border-amber-100/70 hover:border-amber-200 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-[0_20px_40px_rgba(245,158,11,0.08)] md:col-span-2 lg:col-span-1 flex items-center justify-between relative overflow-hidden group cursor-pointer transition-all duration-300"
            >
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-amber-100/20 -skew-x-12 translate-x-12 group-hover:translate-x-4 transition-transform duration-700" />
              {/* Interactive Radial glow */}
              <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-amber-400/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200/50">
                    Express Care
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Appliance Repair
                  </span>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight mb-1">
                  Guaranteed{" "}
                  <span className="text-amber-600 font-extrabold uppercase italic">
                    Flat ₹250 Off
                  </span>
                </h4>
                <p className="text-xs text-slate-500 font-medium mb-4">
                  Fix washing machines, refrigerators & microwaves
                </p>
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-colors duration-300 border ${
                    copiedCode === "FIXIT250"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white/90 border-slate-100 text-slate-800 group-hover:bg-amber-600 group-hover:text-white group-hover:border-transparent"
                  }`}
                >
                  {copiedCode === "FIXIT250" ? (
                    <>
                      <Check size={11} className="stroke-[2.5]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={10} className="stroke-[2.5]" />
                      <span>Code: FIXIT250</span>
                    </>
                  )}
                </div>
              </div>

              <div className="relative z-10 w-20 h-20 text-amber-500/80 group-hover:text-amber-500 transition-colors duration-300 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 shrink-0 select-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-full h-full"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Promotions Carousel/Grid */}
        {promotions.length > 0 && (
          <section className="mb-12 sm:mb-20 w-full" id="promotions-section">
            <div className="flex justify-between items-end mb-5 sm:mb-8 px-2">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-1 tracking-tight uppercase italic md:not-italic">
                  Latest offers
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Exclusive offers for premium home care
                </p>
              </div>
              <button
                onClick={() => setActiveTab("offers")}
                className="text-xs sm:text-sm font-black uppercase tracking-wider text-blue-700 bg-blue-50/50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                See all
              </button>
            </div>
            <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar pb-6 px-2 scroll-smooth">
              {promotions.map((promo, idx) => {
                const gradients = [
                  "from-blue-600 to-indigo-700",
                  "from-rose-500 to-pink-600",
                  "from-amber-500 to-orange-600",
                  "from-emerald-500 to-teal-600",
                ];
                const gradient = gradients[idx % gradients.length];

                return (
                  <div
                    key={promo.id}
                    onClick={() => {
                      navigator.clipboard.writeText(promo.code);
                      setCopiedCode(promo.code);
                      (window as any).__showCopyToast?.(promo.code);
                      setTimeout(() => setCopiedCode(null), 2000);
                    }}
                    className="flex-shrink-0 w-[280px] sm:w-[380px] h-[155px] sm:h-[195px] rounded-[20px] sm:rounded-[28px] relative overflow-hidden group shadow-md hover:shadow-xl transition-all hover:scale-[1.01] active:scale-95 duration-300 cursor-pointer"
                  >
                    {/* Colorful Gradient Background */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`}
                    />

                    {/* Decorative Circles */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-black/10 rounded-full blur-xl pointer-events-none" />

                    {promo.imageUrl && (
                      <img
                        src={promo.imageUrl}
                        className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30"
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    )}

                    <div className="relative h-full p-5 sm:p-6 flex flex-col justify-between z-10 text-white">
                      <div>
                        <div className="flex justify-between items-center mb-2 sm:mb-3">
                          <span className="px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[9px] sm:text-[10px] font-semibold font-display uppercase tracking-widest border border-white/15 select-none text-white/90">
                            SPECIAL OFFER
                          </span>
                          {promo.discountValue && (
                            <span className="text-xl sm:text-2xl font-black font-display tracking-tight text-yellow-300 drop-shadow-md">
                              {promo.discountType === "percent"
                                ? `${promo.discountValue}% OFF`
                                : `₹${promo.discountValue} OFF`}
                            </span>
                          )}
                        </div>
                        <h4 className="text-base sm:text-xl font-bold font-display leading-tight tracking-tight text-white mb-1 truncate">
                          {promo.name}
                        </h4>
                        <p className="text-white/80 text-[11px] sm:text-xs line-clamp-1 font-medium font-sans max-w-[85%]">
                          {promo.description}
                        </p>
                      </div>

                      <div className="flex items-end justify-between gap-1.5 mt-auto">
                        <div className="flex flex-col gap-1 text-left min-w-0">
                          <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-widest text-white/50 font-mono select-none">
                            Code
                          </span>
                          <div className="bg-black/30 backdrop-blur-md px-3 sm:px-4 h-8 sm:h-10 rounded-xl border border-white/10 flex items-center justify-center gap-2 min-w-[110px] sm:min-w-[140px] select-none transition-all duration-300 hover:bg-black/40">
                            <code className="text-xs sm:text-sm font-bold tracking-widest font-mono text-emerald-300">
                              {promo.code}
                            </code>
                            {copiedCode === promo.code ? (
                              <Check
                                size={12}
                                className="text-emerald-400 shrink-0 stroke-[3]"
                              />
                            ) : (
                              <Copy
                                size={12}
                                className="text-white/60 group-hover:text-white/90 transition-colors shrink-0 stroke-[2]"
                              />
                            )
                            }
                          </div>
                        </div>

                        <span className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-widest text-white/70 pb-1.5 flex items-center gap-1.5 select-none pr-1">
                          {copiedCode === promo.code ? (
                            <span className="text-emerald-400 font-bold">
                              Copied!
                            </span>
                          ) : (
                            <>
                              Tap to copy <ArrowRight size={11} className="text-white/50" />
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Value Props / Trust */}
        <section
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8 mb-12 sm:mb-20"
          id="trust-value-props"
        >
          <motion.div
            whileHover={{ y: -6, scale: 1.01 }}
            className="bg-white p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-slate-100/95 shadow-sm hover:shadow-md hover:border-blue-100/80 hover:shadow-[0_12px_24px_rgba(29,78,216,0.03)] flex items-start gap-4 sm:gap-5 group transition-all duration-300 cursor-default"
          >
            <div className="w-12 h-12 bg-blue-500/10 text-blue-700 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-all duration-500 shadow-sm">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 4,
                  ease: "easeInOut",
                }}
              >
                <ShieldCheck size={24} className="stroke-[2.25]" />
              </motion.div>
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md inline-block mb-1.5 prose-sm">
                Secure Care
              </span>
              <h4 className="font-extrabold text-slate-900 text-sm sm:text-base mb-1 tracking-tight">
                Verified Experts
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                Every professional on zomindia is background-checked and vetted
                for quality.
              </p>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -6, scale: 1.01 }}
            className="bg-white p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-slate-100/95 shadow-sm hover:shadow-md hover:border-emerald-100/80 hover:shadow-[0_12px_24px_rgba(16,185,129,0.03)] flex items-start gap-4 sm:gap-5 group transition-all duration-300 cursor-default"
          >
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500 shadow-sm">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut",
                }}
              >
                <Clock size={24} className="stroke-[2.25]" />
              </motion.div>
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mb-1.5 prose-sm">
                Punctual
              </span>
              <h4 className="font-extrabold text-slate-900 text-sm sm:text-base mb-1 tracking-tight">
                On-time Every time
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                We value your time. Our partners are trained to be punctual for
                every booking.
              </p>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -6, scale: 1.01 }}
            className="bg-white p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-slate-100/95 shadow-sm hover:shadow-md hover:border-amber-100/85 hover:shadow-[0_12px_24px_rgba(245,158,11,0.03)] flex items-start gap-4 sm:gap-5 group transition-all duration-300 cursor-default sm:col-span-2 lg:col-span-1"
          >
            <div className="w-12 h-12 bg-amber-500/10 text-amber-700 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-all duration-500 shadow-sm">
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.5,
                  ease: "easeInOut",
                }}
              >
                <Star
                  size={24}
                  className="stroke-[2.25] fill-amber-500/10 group-hover:fill-white/20"
                />
              </motion.div>
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md inline-block mb-1.5 prose-sm">
                Satisfaction
              </span>
              <h4 className="font-extrabold text-slate-900 text-sm sm:text-base mb-1 tracking-tight">
                Quality Guaranteed
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                Not satisfied with the service? We will rework it for free or
                refund your payment.
              </p>
            </div>
          </motion.div>
        </section>

        {/* Top Rated Services */}
        <section
          className="mb-12 sm:mb-20 px-3 sm:px-4 w-full"
          id="categories-section"
        >
          <div className="flex flex-row items-center justify-between mb-5 sm:mb-8 px-1">
            <div className="min-w-0">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase italic md:not-italic truncate">
                Popular{" "}
                <span className="text-blue-600 bg-blue-50/50 px-2 sm:px-2.5 py-0.5 rounded-xl">
                  Services
                </span>
              </h3>
              <p className="text-slate-400 font-medium text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate">
                Hand-picked services based on user satisfaction and premium
                reliability
              </p>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById("categories-grid");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50/50 hover:bg-blue-100/85 px-2.5 py-1.5 rounded-lg sm:rounded-xl transition-all select-none shrink-0 cursor-pointer"
            >
              See all
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 px-1">
            {allServices
              .filter((s) => s.rating && s.rating >= 4.5)
              .slice(0, 4)
              .map((service, idx) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -6, scale: 1.01 }}
                  transition={{
                    type: "spring",
                    stiffness: 240,
                    damping: 18,
                    delay: idx * 0.04,
                  }}
                  onClick={() => onServiceSelect(service.id)}
                  className="bg-white/70 backdrop-blur-md rounded-[20px] sm:rounded-[28px] border border-slate-100 p-3 sm:p-5 hover:border-blue-100 transition-all duration-300 cursor-pointer group shadow-sm hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.06)] flex flex-col justify-between text-left relative overflow-hidden h-full"
                >
                  {/* Hover Accent Light */}
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-indigo-600 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />

                  <div className="flex flex-col w-full min-w-0">
                    {/* Image Box */}
                    <div className="w-full aspect-[4/3] sm:aspect-square rounded-xl sm:rounded-2xl overflow-hidden mb-2.5 sm:mb-4 bg-slate-50 border border-slate-100 relative shadow-sm">
                      <img
                        src={
                          service.imageURL ||
                          "https://images.unsplash.com/photo-1581578731548-c64695ce6954?auto=format&fit=crop&q=80&w=400"
                        }
                        alt={service.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent pointer-events-none" />

                      {/* Floating Badges */}
                      <div className="absolute top-2 left-2 bg-blue-100/95 text-blue-800 backdrop-blur-md px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-xl text-[7px] sm:text-[8px] font-black uppercase tracking-wider shadow-sm border border-blue-200/50 flex items-center gap-1">
                        <motion.div
                          animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 10, -10, 0],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 3,
                            ease: "easeInOut",
                          }}
                        >
                          <Sparkles
                            size={8}
                            className="text-yellow-400 fill-yellow-400"
                          />
                        </motion.div>
                        <span className="truncate">Popular</span>
                      </div>
                    </div>

                    {/* Meta section */}
                    <div className="flex items-center gap-1.5 mb-1 sm:mb-2 w-full min-w-0">
                      <div className="px-1.5 py-0.5 bg-amber-500/10 text-amber-700 rounded-lg flex items-center gap-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-wider border border-amber-500/15">
                        <Star
                          size={8}
                          fill="currentColor"
                          className="stroke-[2.5]"
                        />{" "}
                        {service.rating}
                      </div>
                      <span className="text-[8px] sm:text-[9px] text-slate-400 font-black uppercase tracking-widest truncate">
                        {
                          allCategories.find((c) => c.id === service.categoryId)
                            ?.name
                        }
                      </span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 mb-0.5 sm:mb-1 tracking-tight text-xs sm:text-base line-clamp-1 group-hover:text-blue-600 transition-colors duration-200">
                      {service.name}
                    </h4>

                    <p className="text-[10px] sm:text-xs text-slate-400 line-clamp-2 leading-tight sm:leading-relaxed font-semibold mt-0.5 mb-2 sm:mb-3">
                      {service.description}
                    </p>
                  </div>

                  {/* Actions & Price */}
                  <div className="mt-2.5 pt-2.5 sm:mt-4 sm:pt-4 border-t border-slate-100 flex items-center justify-between gap-2 w-full min-w-0">
                    <div className="min-w-0">
                      <p className="text-[7.5px] sm:text-[8.5px] text-slate-450 font-black uppercase tracking-wider mb-0.5 leading-none">
                        Price
                      </p>
                      <p className="font-black text-xs sm:text-base text-slate-900 tracking-tight truncate">
                        ₹{service.basePrice}
                      </p>
                    </div>
                    <div className="h-7.5 sm:h-9 hover:bg-blue-600 hover:text-white bg-slate-50 border border-slate-100 hover:border-transparent text-slate-600 transition-all select-none rounded-lg sm:rounded-xl flex items-center justify-center px-2.5 sm:px-3 gap-1 shadow-sm shrink-0">
                      <span className="text-[8.5px] sm:text-[10px] font-black uppercase tracking-widest">
                        Book
                      </span>
                      <ArrowRight
                        size={10}
                        className="sm:size-3 transition-transform group-hover:translate-x-0.5"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
          </div>
        </section>

        {/* Services in Focus (Category Grouped) */}
        <section
          className="mb-12 sm:mb-20 px-3 sm:px-4 w-full"
          id="services-in-focus"
        >
          <div className="flex flex-row items-center justify-between mb-5 sm:mb-8 px-1">
            <div className="min-w-0">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase italic md:not-italic truncate">
                Services in{" "}
                <span className="text-blue-600 bg-blue-50/50 px-2 sm:px-2.5 py-0.5 rounded-xl">
                  Focus
                </span>
              </h3>
              <p className="text-slate-400 font-medium text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate">
                Premium offerings with exceptional track records
              </p>
            </div>
          </div>

          <div className="space-y-8 sm:space-y-12 lg:space-y-16">
            {(() => {
              const categoryImagesMap: Record<string, string> = {
                "1": "https://images.unsplash.com/photo-1581578731548-c64695ce6958?auto=format&fit=crop&q=80&w=800", // Cleaning
                "Cleaning & Pest Control":
                  "https://images.unsplash.com/photo-1581578731548-c64695ce6958?auto=format&fit=crop&q=80&w=800",
                cleaning_pest_control:
                  "https://images.unsplash.com/photo-1581578731548-c64695ce6958?auto=format&fit=crop&q=80&w=800",
                "2": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800", // Repairs
                "Carpentry & Repairs":
                  "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800",
                carpentry_repairs:
                  "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800",
                "3": "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=800", // Appliance
                "AC & Appliance Repair":
                  "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=800",
                ac_appliance_repair:
                  "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=800",
                "4": "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=800", // Painting
                "Home Painting & Decorating":
                  "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=800",
                home_painting_decorating:
                  "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=800",
                "5": "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=800", // Beauty
                "Beauty & Saloon":
                  "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=800",
                beauty_saloon:
                  "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=800",
                "6": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800", // Appliance Repair
                "Appliance Repair":
                  "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=800",
                "Phone Repair":
                  "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&q=80&w=800",
              };

              const getServiceThumbnail = (
                name: string,
                categoryName: string,
              ): string => {
                const nm = name.toLowerCase();
                const cn = categoryName.toLowerCase();

                if (
                  nm.includes("ac") ||
                  nm.includes("air conditioner") ||
                  nm.includes("split") ||
                  nm.includes("filter") ||
                  nm.includes("gas")
                ) {
                  return "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=300";
                }
                if (
                  nm.includes("deep clean") ||
                  nm.includes("sofa") ||
                  nm.includes("home clean") ||
                  nm.includes("bathroom") ||
                  nm.includes("kitchen") ||
                  nm.includes("cleaning")
                ) {
                  return "https://images.unsplash.com/photo-1581578731548-c64695ce6958?auto=format&fit=crop&q=80&w=300";
                }
                if (
                  nm.includes("pest") ||
                  nm.includes("saniti") ||
                  nm.includes("bug") ||
                  nm.includes("termite") ||
                  nm.includes("insect")
                ) {
                  return "https://images.unsplash.com/photo-1604147706283-d7119b5b822c?auto=format&fit=crop&q=80&w=300";
                }
                if (
                  nm.includes("plumb") ||
                  nm.includes("leak") ||
                  nm.includes("pipe") ||
                  nm.includes("water") ||
                  nm.includes("tap") ||
                  nm.includes("basin") ||
                  nm.includes("sink")
                ) {
                  return "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=300";
                }
                if (
                  nm.includes("electric") ||
                  nm.includes("switch") ||
                  nm.includes("wiring") ||
                  nm.includes("short") ||
                  nm.includes("fan") ||
                  nm.includes("light")
                ) {
                  return "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=300";
                }
                if (
                  nm.includes("carpenter") ||
                  nm.includes("wood") ||
                  nm.includes("door") ||
                  nm.includes("hinge") ||
                  nm.includes("furniture")
                ) {
                  return "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=300";
                }
                if (
                  nm.includes("paint") ||
                  nm.includes("wall") ||
                  nm.includes("waterproofing") ||
                  nm.includes("texture")
                ) {
                  return "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=300";
                }
                if (
                  nm.includes("massage") ||
                  nm.includes("spa") ||
                  nm.includes("salon") ||
                  nm.includes("groom") ||
                  nm.includes("hair") ||
                  nm.includes("facial")
                ) {
                  return "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=300";
                }
                if (
                  nm.includes("fridge") ||
                  nm.includes("refrigerator") ||
                  nm.includes("microwave") ||
                  nm.includes("oven") ||
                  nm.includes("washing") ||
                  nm.includes("geyser") ||
                  nm.includes("appliance")
                ) {
                  return "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=300";
                }

                // Default fallbacks by category name
                if (cn.includes("clean") || cn.includes("pest")) {
                  return "https://images.unsplash.com/photo-1581578731548-c64695ce6958?auto=format&fit=crop&q=80&w=300";
                }
                if (
                  cn.includes("ac") ||
                  cn.includes("appliance") ||
                  cn.includes("repair")
                ) {
                  return "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=300";
                }
                if (cn.includes("paint")) {
                  return "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=300";
                }
                if (
                  cn.includes("electric") ||
                  cn.includes("plumb") ||
                  cn.includes("carpenter") ||
                  cn.includes("repair")
                ) {
                  return "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=300";
                }

                return "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=300";
              };

              const categoriesWithServices = allCategories.filter((cat) =>
                allServices.some((s) => s.categoryId === cat.id),
              );

              return categoriesWithServices.map((category, catIdx) => {
                const categoryServices = allServices.filter(
                  (s) => s.categoryId === category.id,
                );
                if (categoryServices.length === 0) return null;

                const catImg =
                  category.imageURL ||
                  categoryImagesMap[category.id] ||
                  categoryImagesMap[category.name] ||
                  "https://images.unsplash.com/photo-1581578731548-c64695ce6958?auto=format&fit=crop&q=80&w=600";
                const minPrice =
                  categoryServices.length > 0
                    ? Math.min(...categoryServices.map((s) => s.basePrice))
                    : 199;

                return (
                  <div
                    key={category.id}
                    className={`grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 items-stretch p-3.5 sm:p-5 lg:p-6 rounded-[24px] sm:rounded-[36px] lg:rounded-[44px] transition-all duration-300 ${
                      catIdx === 0
                        ? "bg-[#fafbff] border-2 border-indigo-100/90 shadow-[0_20px_50px_rgba(79,70,229,0.04)]"
                        : "bg-slate-50/40 border border-slate-100/85"
                    }`}
                  >
                    {/* Left: Big Category Image Card */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      whileHover={{ scale: 1.002 }}
                      onClick={() => {
                        setSelectedCategory(category);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`lg:col-span-1 rounded-[20px] sm:rounded-[28px] lg:rounded-[36px] overflow-hidden relative shadow-md min-h-[220px] sm:min-h-[280px] lg:min-h-full flex flex-col justify-between p-6 sm:p-7 lg:p-8 group cursor-pointer select-none text-left duration-300 ${
                        catIdx === 0
                          ? "border border-indigo-100 bg-indigo-50/20"
                          : "border border-blue-150 bg-blue-50/50"
                      }`}
                    >
                      <img
                        src={catImg}
                        alt={category.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 opacity-20 mix-blend-multiply"
                        referrerPolicy="no-referrer"
                      />
                      {/* Secure an premium gradient overlay for flawless contrast and readability */}
                      <div className={`absolute inset-0 bg-gradient-to-t pointer-events-none ${
                        catIdx === 0
                          ? "from-indigo-100/95 via-indigo-50/90 to-transparent"
                          : "from-blue-50/95 via-blue-100/90 to-transparent"
                      }`} />

                      <div className="relative z-10 w-full flex flex-col h-full justify-between gap-6 sm:gap-8">
                        {/* Top Badge Row */}
                        <div className="flex items-center justify-between gap-2">
                          {catIdx === 0 ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 border border-indigo-500/25 text-white rounded-xl text-[9px] sm:text-[11px] font-semibold font-display uppercase tracking-widest shadow-lg shadow-indigo-500/20">
                              <Sparkles
                                size={11}
                                className="animate-pulse text-yellow-300"
                              />{" "}
                              FEATURED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1 bg-blue-600 border border-blue-500/25 text-white rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-extrabold uppercase tracking-wider sm:tracking-widest shadow-lg shadow-blue-500/25">
                              <Sparkles
                                size={10}
                                className="animate-pulse text-yellow-300 hidden sm:block"
                              />
                              <Sparkles
                                size={8}
                                className="animate-pulse text-yellow-300 sm:hidden"
                              />{" "}
                              Featured
                            </span>
                          )}

                          <span className={`text-[8px] sm:text-[9.5px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-xl border whitespace-nowrap ${
                            catIdx === 0
                              ? "text-indigo-800 bg-indigo-100/80 border-indigo-200"
                              : "text-[#050ca6] bg-blue-105/90 border-blue-200"
                          }`}>
                            Starts ₹{minPrice}
                          </span>
                        </div>

                        {/* Text & Content Block */}
                        <div className="space-y-3 sm:space-y-4">
                          <div>
                            <span className={`text-[8.5px] font-bold uppercase tracking-widest block mb-1.5 ${
                              catIdx === 0 ? "text-indigo-700/90 font-display" : "text-blue-750"
                            }`}>
                              ★ TOP RATED CATEGORY
                            </span>
                            <h4 className={`font-bold tracking-tight uppercase ${
                              catIdx === 0
                                ? "text-2xl sm:text-3.5xl lg:text-4xl text-indigo-950 font-display leading-none"
                                : "text-xl sm:text-2.5xl lg:text-3xl font-black italic text-[#050ca6]"
                            }`}>
                              {category.name}
                            </h4>
                            <p className={`line-clamp-3 leading-relaxed mt-2 sm:mt-3 ${
                              catIdx === 0
                                ? "text-slate-600 text-xs sm:text-[13px] font-normal font-sans"
                                : "text-[10px] sm:text-[11px] text-slate-700 font-bold"
                            }`}>
                              {category.description ||
                                `Verified professional ${category.name.toLowerCase()} services customized for your daily comfort.`}
                            </p>
                          </div>

                          <div className={`space-y-1.5 pt-2 border-t ${
                            catIdx === 0 ? "border-indigo-200/60" : "border-t border-blue-100/80"
                          }`}>
                            <div className={`flex items-center gap-1.5 font-sans leading-none ${
                              catIdx === 0 ? "text-[10px] sm:text-xs text-slate-600 font-normal" : "text-[9px] text-slate-700 font-bold"
                            }`}>
                              <span className={catIdx === 0 ? "text-emerald-500 text-sm font-bold" : "text-emerald-600 text-xs"}>
                                ✓
                              </span>{" "}
                              Background-verified professionals
                            </div>
                            <div className={`flex items-center gap-1.5 font-sans leading-none ${
                              catIdx === 0 ? "text-[10px] sm:text-xs text-slate-600 font-normal" : "text-[9px] text-slate-700 font-bold"
                            }`}>
                              <span className={catIdx === 0 ? "text-emerald-500 text-sm font-bold" : "text-emerald-600 text-xs"}>
                                ✓
                              </span>{" "}
                              Multi-point safety protocols applied
                            </div>
                          </div>

                          <div className={`pt-3 flex items-center justify-between gap-3 sm:gap-4 border-t ${
                            catIdx === 0 ? "border-indigo-200/60" : "border-blue-100/80"
                          }`}>
                            <div className={`flex items-center gap-1.5 text-slate-700 min-w-0 ${
                              catIdx === 0 ? "text-[10px] sm:text-xs font-medium font-sans" : "text-[9px] sm:text-[10px] font-bold"
                            }`}>
                              <CheckCircle2
                                size={11}
                                className="text-emerald-600 fill-emerald-100 shrink-0"
                              />{" "}
                              <span className="truncate">Free 7-Day Cover</span>
                            </div>
                            <div className={`text-[9.5px] sm:text-[11px] font-medium font-display uppercase tracking-widest flex items-center gap-1 transition-colors duration-300 shrink-0 ${
                              catIdx === 0
                                ? "text-indigo-700 group-hover:text-indigo-900"
                                : "text-blue-750 group-hover:text-blue-900"
                            }`}>
                              Explore{" "}
                              <ArrowRight
                                size={11}
                                className="sm:size-3.5 group-hover:translate-x-1.5 transition-transform duration-300"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Right: Dynamic Services List underneath this category */}
                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 lg:gap-5">
                      {categoryServices.map((service, sIdx) => (
                        <motion.div
                          key={service.id}
                          initial={{ opacity: 0, y: 15 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: sIdx * 0.05 }}
                          onClick={() => onServiceSelect(service.id)}
                          className="bg-white p-3.5 sm:p-4.5 rounded-[22px] sm:rounded-[26px] border border-slate-100 hover:border-blue-500/30 hover:shadow-[0_12px_24px_rgba(37,99,235,0.03)] transition-all duration-300 cursor-pointer flex flex-row items-stretch gap-3 sm:gap-4 group h-full text-left relative overflow-hidden"
                        >
                          {/* Left: Beautiful Service Thumbnail with hover scaling effect */}
                          <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-[16px] sm:rounded-[20px] overflow-hidden shrink-0 bg-slate-50 border border-slate-100 relative shadow-sm">
                            <img
                              src={
                                service.imageURL ||
                                getServiceThumbnail(service.name, category.name)
                              }
                              alt={service.name}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent pointer-events-none" />
                            <div className="absolute bottom-1 right-1 bg-emerald-500 text-white font-black text-[7px] sm:text-[8px] uppercase tracking-wider px-1 px-[3px] py-0.5 rounded-md shadow-xs">
                              Pro
                            </div>
                          </div>

                          {/* Right: Rich Service Info */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                            <div>
                              <div className="flex justify-between items-start gap-1 w-full min-w-0">
                                <h5 className="font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 text-xs sm:text-base pr-1.5 min-w-0">
                                  {service.name}
                                </h5>
                                <span className="font-black text-xs sm:text-sm text-slate-950 shrink-0">
                                  ₹{service.basePrice}
                                </span>
                              </div>
                              <p className="text-[10px] sm:text-[11.5px] text-slate-450 font-semibold line-clamp-2 leading-tight sm:leading-relaxed mt-0.5 mb-2">
                                {service.description}
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-1 sm:pt-2 border-t border-slate-50 w-full min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                                <div className="flex items-center gap-0.5 text-[10px] sm:text-xs font-black text-amber-500 shrink-0">
                                  <motion.div
                                    animate={{ scale: [1, 1.15, 1] }}
                                    transition={{
                                      repeat: Infinity,
                                      duration: 3,
                                      ease: "easeInOut",
                                    }}
                                    className="shrink-0"
                                  >
                                    <Star size={10} fill="currentColor" />
                                  </motion.div>
                                  <span className="text-[9.5px] sm:text-[11.5px] font-black">
                                    {service.rating || 4.8}
                                  </span>
                                </div>
                                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 font-black uppercase tracking-widest leading-none truncate">
                                  • {service.duration || "60 mins"}
                                </span>
                              </div>
                              <span className="text-[9.5px] sm:text-xs font-black text-blue-700 uppercase tracking-wider flex items-center justify-center gap-0.5 group-hover:gap-1.5 transition-all duration-300 shrink-0">
                                Book{" "}
                                <ArrowRight
                                  size={10}
                                  className="sm:size-3.5 transition-transform group-hover:translate-x-0.5"
                                />
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </section>

        {/* Recently Launched */}
        <section
          className="mb-12 sm:mb-20 px-3 sm:px-4 w-full overflow-hidden"
          id="recently-launched-section"
        >
          <div className="flex flex-row items-center justify-between mb-5 sm:mb-8 px-1">
            <div className="min-w-0">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase italic md:not-italic truncate">
                Recently{" "}
                <span className="text-blue-600 bg-blue-50/50 px-2 sm:px-2.5 py-0.5 rounded-xl">
                  Launched
                </span>
              </h3>
              <p className="text-slate-400 font-medium text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate">
                New additions to our service portfolio, added in admin
              </p>
            </div>
            {/* Symmetrical Navigation Controls */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => scrollRecentlyLaunched("left")}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-700 hover:border-blue-500 hover:shadow-md transition-all active:scale-95 cursor-pointer"
                aria-label="Scroll left"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => scrollRecentlyLaunched("right")}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-700 hover:border-blue-500 hover:shadow-md transition-all active:scale-95 cursor-pointer"
                aria-label="Scroll right"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div
            ref={recentlyLaunchedScrollRef}
            className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar pb-6 px-1 scroll-smooth"
          >
            {(() => {
              const getMs = (item: any) => {
                if (!item) return 0;
                if (item.createdAt) {
                  if (typeof item.createdAt.toMillis === "function") {
                    return item.createdAt.toMillis();
                  }
                  if (item.createdAt.seconds) {
                    return item.createdAt.seconds * 1000;
                  }
                  if (item.createdAt instanceof Date) {
                    return item.createdAt.getTime();
                  }
                  return new Date(item.createdAt).getTime() || 0;
                }
                return 0;
              };

              const sorted = [...allServices].sort((a, b) => {
                const aMs = getMs(a);
                const bMs = getMs(b);
                if (aMs !== bMs) {
                  return bMs - aMs; // newest first
                }
                return b.id.localeCompare(a.id);
              });

              // Take up to 8 of the absolute newest service offerings
              const recentServices = sorted.slice(0, 8);

              return recentServices.map((service, idx) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  transition={{
                    type: "spring",
                    stiffness: 240,
                    damping: 20,
                    delay: idx * 0.05,
                  }}
                  onClick={() => onServiceSelect(service.id)}
                  className="flex-shrink-0 w-[220px] sm:w-[260px] bg-white border border-slate-100 rounded-[28px] p-5 hover:border-blue-200/80 hover:shadow-[0_24px_48px_-12px_rgba(37,99,235,0.08)] transition-all duration-300 cursor-pointer group flex flex-col justify-between h-[250px] sm:h-[285px] text-left relative overflow-hidden"
                >
                  {/* Dynamic Ambient Card Glow on Hover */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/0 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/[0.03] transition-colors duration-500" />

                  <div className="relative z-10">
                    {/* Image Frame */}
                    <div className="aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden mb-3 bg-slate-50 border border-slate-100 relative shadow-sm">
                      <img
                        src={
                          service.imageURL ||
                          "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=400"
                        }
                        alt={service.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent pointer-events-none" />

                      {/* Glowing Badge */}
                      <div className="absolute top-2.5 left-2.5 bg-rose-500 text-white font-extrabold px-2.5 py-1 rounded-xl text-[8px] sm:text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-rose-500/20 select-none">
                        <motion.div
                          animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 15, -15, 0],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 2,
                            ease: "easeInOut",
                          }}
                        >
                          <Zap size={9.5} className="fill-white text-white" />
                        </motion.div>
                        <span>New</span>
                      </div>
                    </div>

                    <h4 className="font-extrabold text-slate-900 text-sm sm:text-base line-clamp-1 group-hover:text-blue-600 transition-colors duration-200">
                      {service.name}
                    </h4>
                  </div>

                  {/* Pricing & Booking Anchor */}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/85 relative z-10">
                    <div>
                      <p className="text-[7.5px] sm:text-[8px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">
                        Starting from
                      </p>
                      <p className="font-black text-sm sm:text-lg text-slate-900 tracking-tight">
                        ₹{service.basePrice}
                      </p>
                    </div>
                    <div className="h-8 sm:h-9 w-8 sm:w-9 rounded-xl bg-slate-50 border border-slate-150 group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent flex items-center justify-center transition-all duration-300 shadow-sm">
                      <ArrowRight
                        size={13}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </div>
                  </div>
                </motion.div>
              ));
            })()}
            {allServices.length < 8 && (
              <div className="flex-shrink-0 w-[220px] sm:w-[260px] h-[250px] sm:h-[285px] bg-slate-50 border border-dashed border-slate-200 rounded-[28px] flex flex-col items-center justify-center p-6 text-center text-slate-400 group transition-all duration-300 hover:bg-slate-100/50">
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 3,
                    ease: "easeInOut",
                  }}
                >
                  <Plus size={28} className="mb-3 text-slate-350" />
                </motion.div>
                <p className="text-[10px] sm:text-xs text-slate-500 font-extrabold uppercase tracking-widest">
                  More coming soon
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="mb-20 px-2 lg:px-4">
          <div className="bg-white rounded-[48px] p-8 md:p-16 lg:p-20 overflow-hidden relative border border-slate-150 shadow-xl">
            {/* Background glowing effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-300/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-500/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10">
              {/* Header */}
              <div className="max-w-3xl mb-12 lg:mb-16 text-center md:text-left">
                <span className="text-xs font-bold uppercase tracking-[0.25em] text-blue-700 mb-3 block font-sans">
                  Why Choose Our Platform
                </span>
                <h2 className="text-3xl md:text-5xl font-extrabold font-display text-blue-950 tracking-tight leading-tight mb-4">
                  The Gold Standard of Home Care Guarantees
                </h2>
                <p className="text-indigo-950/70 font-medium font-sans text-sm md:text-base leading-relaxed">
                  We are redefining urban home care in India by vetting,
                  training, and backing every single service partner so that you
                  can book with pure confidence.
                </p>
              </div>

              {/* Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                {/* Spotlight Card: Most Recent Service Added in Admin */}
                {mostRecentService && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                    className="bg-gradient-to-br from-indigo-50/50 via-blue-50/50 to-white rounded-[32px] p-8 border border-indigo-150 text-left relative overflow-hidden group lg:col-span-2 flex flex-col justify-between min-h-[320px] shadow-xl hover:shadow-2xl hover:border-blue-300 transition-all cursor-pointer"
                    onClick={() => {
                      if (profile) {
                        setSelectedService(mostRecentService);
                      } else {
                        onAuthRequired();
                      }
                    }}
                  >
                    {/* Decorative background glow elements */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-indigo-500/10 transition-all" />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/5 rounded-full blur-[50px] pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6 h-full w-full">
                      <div className="flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          {/* Badge */}
                          <div className="flex items-center gap-2 mb-4">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
                            </span>
                            <span className="text-[10px] font-bold uppercase text-indigo-900 tracking-wider font-mono">
                              Featured Service
                            </span>
                          </div>

                          <h4 className="text-2xl md:text-3xl font-bold font-display text-blue-950 mb-2 tracking-tight leading-tight hover:text-blue-700 transition-colors">
                            {mostRecentService.name}
                          </h4>

                          <div className="flex items-center gap-2 mb-4">
                            {recentServiceCategory && (
                              <span className="text-[10px] bg-indigo-55/65 border border-indigo-200/50 text-indigo-900 font-semibold font-sans px-2.5 py-1 rounded-lg">
                                Category: {recentServiceCategory.name}
                              </span>
                            )}
                            <span className="text-xs text-indigo-950/70 font-semibold font-mono bg-blue-50/50 px-2 py-1 rounded-lg">
                              ⏱️ {mostRecentService.duration || "2 Hours"}
                            </span>
                          </div>

                          <p className="text-indigo-950/75 text-sm font-normal font-sans leading-relaxed max-w-md line-clamp-2">
                            {mostRecentService.description ||
                              "Freshly certified category-specific professional assistance delivered on-demand to your doorstep."}
                          </p>
                        </div>

                        <div className="pt-4 border-t border-slate-150 flex items-center justify-between w-full font-sans">
                          <div>
                            <span className="text-[10px] text-indigo-950/50 uppercase font-semibold tracking-widest block mb-0.5">
                              Premium Launch Price
                            </span>
                            <span className="text-2xl font-bold font-display text-blue-950">
                              ₹{mostRecentService.basePrice}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (profile) {
                                setSelectedService(mostRecentService);
                              } else {
                                onAuthRequired();
                              }
                            }}
                            className="px-6 py-3 bg-blue-950 text-white rounded-2xl text-xs font-semibold uppercase tracking-widest hover:bg-blue-900 active:scale-95 transition-all shadow-md shrink-0 font-sans"
                          >
                            Instant Booking ⚡
                          </button>
                        </div>
                      </div>

                      {/* Right side illustration / card styling */}
                      {mostRecentService.imageURL && (
                        <div className="w-full md:w-[220px] aspect-video md:aspect-[4/3] rounded-2xl overflow-hidden bg-white border border-slate-150 shrink-0 relative flex items-center justify-center self-center transition-all duration-500 shadow-sm">
                          <img
                            src={mostRecentService.imageURL}
                            alt={mostRecentService.name}
                            className="w-full h-full object-cover opacity-100 transition-transform duration-700 ease-out group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Stats / Hero Card */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-blue-55 rounded-[32px] p-8 flex flex-col justify-between border border-blue-150 text-left min-h-[320px] lg:col-span-1"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                      <Star size={24} fill="currentColor" />
                    </div>
                    <div>
                      <h3 className="text-4xl font-bold font-display text-blue-950 tracking-tight">
                        4.85★
                      </h3>
                      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-900 mt-1 font-sans">
                        Average Service Rating
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-6 border-t border-blue-150">
                    <p className="text-xs text-indigo-950/80 font-medium font-sans leading-relaxed">
                      "Unmatched reliability. The repairs partner arrived in
                      exactly 45 minutes, wore certified safety equipment, and
                      solved my leakage issue cleanly under budget."
                    </p>
                    <span className="text-[10px] font-semibold text-blue-900 block font-sans">
                      —— Priya K., Mumbai
                    </span>
                  </div>
                </motion.div>

                {/* Grid Item 1: 100% Verified Partners */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="bg-slate-50/80 rounded-[32px] p-8 border border-slate-150 hover:border-blue-300 transition-all group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <UserCheck size={22} />
                    </div>
                    <h4 className="text-xl font-bold font-display text-blue-950 mb-2">
                      Multi-Tier Screening
                    </h4>
                    <p className="text-indigo-950/70 text-sm leading-relaxed font-normal font-sans">
                      Every partner undergoes rigorous identity checks, local
                      police verification, and a 3-step technical assessment in
                      our modern training classrooms.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-emerald-50/50 text-emerald-800 text-[10px] font-semibold font-sans border border-emerald-100/60 rounded-xl tracking-wider uppercase">
                      Only Top 5% Hired
                    </span>
                  </div>
                </motion.div>

                {/* Grid Item 2: Upfront Transparent Pricing */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 }}
                  className="bg-slate-50/80 rounded-[32px] p-8 border border-slate-150 hover:border-blue-300 transition-all group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <Sparkles size={22} />
                    </div>
                    <h4 className="text-xl font-bold font-display text-blue-950 mb-2">
                      No Haggling. No Secrets.
                    </h4>
                    <p className="text-indigo-950/70 text-sm leading-relaxed font-normal font-sans">
                      Get transparent estimates before the job starts.
                      Standardized pricing guides prevent overcharging, so you
                      pay only what's displayed on screen.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-indigo-50/50 text-indigo-900 text-[10px] font-semibold font-sans border border-indigo-100/60 rounded-xl tracking-wider uppercase">
                      Itemized Invoices
                    </span>
                  </div>
                </motion.div>

                {/* Row 2 - Grid Item 3: Safety Controls */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="bg-slate-50/80 rounded-[32px] p-8 border border-slate-150 hover:border-blue-300 transition-all group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-805 border border-amber-100 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <ShieldCheck size={22} />
                    </div>
                    <h4 className="text-xl font-bold font-display text-blue-950 mb-2">
                      Secure OTP Inspections
                    </h4>
                    <p className="text-indigo-950/70 text-sm leading-relaxed font-normal font-sans">
                      Experience end-to-end security. Partners share a unique
                      pin to initiate jobs, keeping authentication transparent
                      and fully logged.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-amber-50/50 text-amber-800 text-[10px] font-semibold font-sans border border-amber-100/65 rounded-xl tracking-wider uppercase">
                      Fully Insured Jobs
                    </span>
                  </div>
                </motion.div>

                {/* Row 2 - Grid Item 4: Quick-Turn Turnaround */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.25 }}
                  className="bg-slate-50/80 rounded-[32px] p-8 border border-slate-150 hover:border-blue-300 transition-all group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-750 border border-cyan-100 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <Clock size={22} />
                    </div>
                    <h4 className="text-xl font-bold font-display text-blue-950 mb-2">
                      Punctuality Promise
                    </h4>
                    <p className="text-indigo-950/70 text-sm leading-relaxed font-normal font-sans">
                      We value your time. If our professional partner is
                      significantly delayed, receive proactive booking credits
                      instantly credited to your account.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-cyan-50/50 text-cyan-800 text-[10px] font-semibold font-sans border border-cyan-100/65 rounded-xl tracking-wider uppercase">
                      Swift Response
                    </span>
                  </div>
                </motion.div>

                {/* Row 2 - Grid Item 5: Post-Service Support */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="bg-slate-50/80 rounded-[32px] p-8 border border-slate-150 hover:border-blue-300 transition-all group flex flex-col justify-between text-left lg:col-span-1"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <CheckCircle2 size={22} />
                    </div>
                    <h4 className="text-xl font-bold font-display text-blue-950 mb-2">
                      Quality Warranty
                    </h4>
                    <p className="text-indigo-950/70 text-sm leading-relaxed font-normal font-sans">
                      Not fully satisfied? Our comprehensive care network
                      handles complimentary re-work evaluations within 7 days of
                      service completion.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-rose-50/50 text-rose-800 text-[10px] font-semibold font-sans border border-rose-100/65 rounded-xl tracking-wider uppercase">
                      7-Day Free Cover
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="bg-slate-50 rounded-[40px] py-20 px-8 mb-20 border border-slate-100">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              How it works
            </h2>
            <p className="text-slate-500 font-medium max-w-lg mx-auto italic">
              Simple, transparent, and reliable service at your doorstep in 4
              easy steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
            {[
              {
                title: "Choose a service",
                desc: "Select from our wide range of documented home services.",
                icon: Search,
              },
              {
                title: "Choose a slot",
                desc: "Pick a time that works best for your schedule.",
                icon: Clock,
              },
              {
                title: "OTP Verification",
                desc: "Secure handshake with your service partner upon arrival.",
                icon: ShieldCheck,
              },
              {
                title: "Relax",
                desc: "Our experts handle everything while you sit back and enjoy.",
                icon: Zap,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-center text-center group"
              >
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-900 mb-6 group-hover:bg-blue-700 group-hover:text-white transition-all duration-300">
                  <item.icon size={28} strokeWidth={1.5} />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">
                  {item.title}
                </h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed px-4">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Support Chat Banner */}
        <section className="bg-gradient-to-r from-blue-700 to-indigo-900 rounded-[40px] p-8 md:p-12 text-white shadow-xl relative overflow-hidden mb-20 mx-2">
          <div className="absolute inset-0 bg-white/5 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            <div className="max-w-xl">
              <span className="px-3 py-1 bg-white/10 text-white text-[10px] font-bold rounded-lg tracking-wider uppercase inline-flex items-center gap-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
                Always Available
              </span>
              <h2 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight mb-4">
                Need Fast Help? Ask{" "}
                <span className="text-amber-300 drop-shadow-sm font-black">ZomIndia AI</span>
              </h2>
              <p className="text-blue-100 text-sm leading-relaxed max-w-md">
                Get answers about booking states, refund policies, annual
                contracts, or service recommendations instantly from our
                conversational AI assistant.
              </p>
            </div>
            <button
              onClick={() => {
                if (!profile) {
                  onAuthRequired();
                } else {
                  window.dispatchEvent(
                    new CustomEvent("toggle-ai-chat", {
                      detail: { open: true },
                    }),
                  );
                }
              }}
              className="bg-white text-slate-900 border border-transparent shadow-lg text-sm font-bold px-8 py-4 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all shrink-0 flex items-center gap-2 mx-auto md:mx-0"
            >
              <MessageCircle
                size={18}
                className="text-blue-700 animate-bounce"
              />
              Chat is Online
            </button>
          </div>
        </section>

        {showPaymentModalForHome && profile && (
          <PaymentModal
            booking={showPaymentModalForHome}
            profile={profile}
            onClose={() => setShowPaymentModalForHome(null)}
            onSuccess={() => {
              setShowPaymentModalForHome(null);
            }}
          />
        )}

        {/* Force review feedback popup with skip option */}
        <AnimatePresence>
          {showForceFeedbackPopup && activeBooking && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 180 }}
                className="relative bg-white w-full max-w-[390px] rounded-[30px] shadow-[0_24px_60px_rgba(15,23,42,0.15)] overflow-hidden max-h-[85vh] flex flex-col border border-slate-100/80 z-10 font-sans"
              >
                {/* Custom Progress Bar header with prominent Skip button */}
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between shrink-0 bg-white">
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                      Step {popupWizardStep} of 5
                    </span>
                    <div className="flex gap-1 py-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <div
                          key={s}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            s === popupWizardStep 
                              ? "w-7 bg-blue-600" 
                              : s < popupWizardStep 
                                ? "w-2.5 bg-blue-200" 
                                : "w-1.5 bg-slate-150"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Elegant top skip button */}
                  <button
                    type="button"
                    onClick={() => {
                      setRecentCardDismissed(true);
                      localStorage.setItem(`dismissed_ticker_${activeBooking.id}`, "true");
                      setShowForceFeedbackPopup(false);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-full transition-all text-xs font-semibold flex items-center gap-1 border-0 cursor-pointer"
                    title="Skip Feedback"
                  >
                    Skip All <X size={12} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Step Carousel Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-center min-h-[265px]">
                  <AnimatePresence mode="wait">
                    {popupWizardStep === 1 && (
                      <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6 text-center flex flex-col items-center"
                      >
                        <div className="space-y-1.5">
                          <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-snug font-sans">
                            How was {bookingPartner?.name || "your service partner"}?
                          </h3>
                          <p className="text-xs text-slate-500 max-w-[270px] mx-auto leading-relaxed font-sans">
                            Please rate their skill level, behavior, and professional guidelines.
                          </p>
                        </div>

                        {/* Stars */}
                        <div className="flex flex-col items-center gap-2 pb-2">
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleStarClick(1, star)}
                                className="transition-all active:scale-125 transform hover:scale-110 cursor-pointer p-1"
                              >
                                <Star
                                  size={34}
                                  fill={star <= popupRatingPartner ? "#FBBF24" : "none"}
                                  className={star <= popupRatingPartner ? "text-amber-400 filter drop-shadow-sm" : "text-slate-200 hover:text-amber-300"}
                                />
                              </button>
                            ))}
                          </div>
                          {popupRatingPartner > 0 && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full animate-fade-in font-sans">
                              {popupRatingPartner === 1 && "Poor"}
                              {popupRatingPartner === 2 && "Fair"}
                              {popupRatingPartner === 3 && "Good"}
                              {popupRatingPartner === 4 && "Great"}
                              {popupRatingPartner === 5 && "Excellent!"}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {popupWizardStep === 2 && (
                      <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6 text-center flex flex-col items-center"
                      >
                        <div className="space-y-1.5">
                          <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-snug font-sans">
                            Was the service done on time?
                          </h3>
                          <p className="text-xs text-slate-500 max-w-[270px] mx-auto leading-relaxed font-sans">
                            Please rate their punctual arrival, completion speed, and workflow.
                          </p>
                        </div>

                        {/* Stars */}
                        <div className="flex flex-col items-center gap-2 pb-2">
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleStarClick(2, star)}
                                className="transition-all active:scale-125 transform hover:scale-110 cursor-pointer p-1"
                              >
                                <Star
                                  size={34}
                                  fill={star <= popupRatingProcess ? "#FBBF24" : "none"}
                                  className={star <= popupRatingProcess ? "text-amber-400 filter drop-shadow-sm" : "text-slate-200 hover:text-amber-300"}
                                />
                              </button>
                            ))}
                          </div>
                          {popupRatingProcess > 0 && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full animate-fade-in font-sans">
                              {popupRatingProcess === 1 && "Poor"}
                              {popupRatingProcess === 2 && "Fair"}
                              {popupRatingProcess === 3 && "Good"}
                              {popupRatingProcess === 4 && "Great"}
                              {popupRatingProcess === 5 && "Excellent!"}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {popupWizardStep === 3 && (
                      <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6 text-center flex flex-col items-center"
                      >
                        <div className="space-y-1.5">
                          <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-snug font-sans">
                            Was it safe and clean?
                          </h3>
                          <p className="text-xs text-slate-500 max-w-[270px] mx-auto leading-relaxed font-sans">
                            Rate their hygiene practices, precautions, and clean-up after work.
                          </p>
                        </div>

                        {/* Stars */}
                        <div className="flex flex-col items-center gap-2 pb-2">
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleStarClick(3, star)}
                                className="transition-all active:scale-125 transform hover:scale-110 cursor-pointer p-1"
                              >
                                <Star
                                  size={34}
                                  fill={star <= popupRatingSafety ? "#FBBF24" : "none"}
                                  className={star <= popupRatingSafety ? "text-amber-400 filter drop-shadow-sm" : "text-slate-200 hover:text-amber-300"}
                                />
                              </button>
                            ))}
                          </div>
                          {popupRatingSafety > 0 && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full animate-fade-in font-sans">
                              {popupRatingSafety === 1 && "Poor"}
                              {popupRatingSafety === 2 && "Fair"}
                              {popupRatingSafety === 3 && "Good"}
                              {popupRatingSafety === 4 && "Great"}
                              {popupRatingSafety === 5 && "Excellent!"}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {popupWizardStep === 4 && (
                      <motion.div
                        key="step4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6 text-center flex flex-col items-center"
                      >
                        <div className="space-y-1.5">
                          <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-snug font-sans">
                            How is our mobile app?
                          </h3>
                          <p className="text-xs text-slate-500 max-w-[270px] mx-auto leading-relaxed font-sans">
                            Please rate your booking experience, interface, and speed.
                          </p>
                        </div>

                        {/* Stars */}
                        <div className="flex flex-col items-center gap-2 pb-2">
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleStarClick(4, star)}
                                className="transition-all active:scale-125 transform hover:scale-110 cursor-pointer p-1"
                              >
                                <Star
                                  size={34}
                                  fill={star <= popupRatingZomIndia ? "#FBBF24" : "none"}
                                  className={star <= popupRatingZomIndia ? "text-amber-400 filter drop-shadow-sm" : "text-slate-200 hover:text-amber-300"}
                                />
                              </button>
                            ))}
                          </div>
                          {popupRatingZomIndia > 0 && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full animate-fade-in font-sans">
                              {popupRatingZomIndia === 1 && "Poor"}
                              {popupRatingZomIndia === 2 && "Fair"}
                              {popupRatingZomIndia === 3 && "Good"}
                              {popupRatingZomIndia === 4 && "Great"}
                              {popupRatingZomIndia === 5 && "Excellent!"}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {popupWizardStep === 5 && (
                      <motion.div
                        key="step5"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-4 text-center flex flex-col"
                      >
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-snug font-sans">
                            Any feedback for us?
                          </h3>
                          <p className="text-xs text-slate-500 max-w-[270px] mx-auto leading-relaxed font-sans">
                            Optional notes or comments about your experience.
                          </p>
                        </div>

                        <div className="space-y-2 text-left pt-2">
                          <textarea
                            value={popupComment}
                            onChange={(e) => setPopupComment(e.target.value)}
                            placeholder="Type any comments here..."
                            className="w-full bg-slate-50 border border-slate-200/80 focus:border-blue-500 focus:bg-white rounded-2xl p-3.5 text-xs focus:ring-2 focus:ring-blue-100/50 outline-none h-24 resize-none placeholder:text-slate-400 text-slate-700 font-medium font-sans transition-all"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-slate-50 bg-slate-50/40 flex gap-3 shrink-0">
                  {popupWizardStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setPopupWizardStep((prev) => prev - 1)}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-xs transition-colors border-0 cursor-pointer flex items-center justify-center gap-1 font-sans"
                    >
                      <ChevronLeft size={14} /> Back
                    </button>
                  )}

                  {popupWizardStep < 5 ? (
                    <button
                      type="button"
                      onClick={() => setPopupWizardStep((prev) => prev + 1)}
                      className={`flex-1 py-3 rounded-xl font-semibold text-xs tracking-wide transition-all border-0 cursor-pointer flex items-center justify-center gap-1 font-sans ${
                        (popupWizardStep === 1 && popupRatingPartner > 0) ||
                        (popupWizardStep === 2 && popupRatingProcess > 0) ||
                        (popupWizardStep === 3 && popupRatingSafety > 0) ||
                        (popupWizardStep === 4 && popupRatingZomIndia > 0)
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-98"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      }`}
                    >
                      {((popupWizardStep === 1 && popupRatingPartner > 0) ||
                        (popupWizardStep === 2 && popupRatingProcess > 0) ||
                        (popupWizardStep === 3 && popupRatingSafety > 0) ||
                        (popupWizardStep === 4 && popupRatingZomIndia > 0)) ? (
                        <>
                          Next Step <ChevronRight size={14} />
                        </>
                      ) : (
                        <>
                          Skip Step <ChevronRight size={14} />
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submitPopupReview}
                      disabled={isSubmittingPopupReview}
                      className={`flex-1 py-3 rounded-xl font-semibold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 border-0 font-sans ${
                        isSubmittingPopupReview
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-transparent"
                          : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-98"
                      }`}
                    >
                      {isSubmittingPopupReview ? (
                        <BrandedButtonSpinner className="w-4 h-4" />
                      ) : (
                        <Check size={14} className="stroke-[2.5]" />
                      )}
                      {isSubmittingPopupReview ? "Submitting..." : "Finish & Submit"}
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
