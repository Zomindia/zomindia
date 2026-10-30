import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { LogoIcon } from "./BrandLogo";
import {
  Category,
  Service,
  UserProfile,
  PartnerProfile,
  Promotion,
  Booking,
} from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { fuzzyMatch } from "../utils/search";
import { isValidCustomerService } from "../utils/formatters";
import ZomatoPageEndMarker from "./ZomatoPageEndMarker";
import { motion, AnimatePresence } from "motion/react";
import PWAUpdateRegister from "./PWAUpdateRegister";
import BookingModal from "./BookingModal";
import { BrandedButtonSpinner } from "./LoadingIndicator";
import {
  SkeletonCategoryGrid,
  SkeletonServiceCardGrid,
} from "./HomeSkeletons";
import ServiceCard from "./ServiceCard";
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
  ShieldCheck,
  UserCheck,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Zap,
  Copy,
  Check,
  Plus,
  Scissors,
  Tv,
  Hammer,
  RotateCcw,
  PhoneCall,
  Droplets,
  BadgePercent,
} from "lucide-react";

interface Props {
  setActiveTab: (tab: any, arg?: any) => void;
  profile: UserProfile | null;
  onAuthRequired: () => void;
  onServiceSelect: (id: string) => void;
  initialCategoryId?: string | null;
  onOpenProfileMenu?: () => void;
}

interface PartnerWithInfo extends PartnerProfile {
  displayName: string;
  photoURL?: string;
}

const CONSOLIDATED_OFFERS = [
  {
    id: "summer20",
    tag: "Cooling Deals",
    title: "Cool Summer 20% OFF",
    desc: "Complete AC sanitization, jet wash & repair at doorstep in Indore",
    code: "SUMMER20",
    discount: "20% OFF",
  },
  {
    id: "clean15",
    tag: "Spotless Home",
    title: "Deep House Cleaning 15% OFF",
    desc: "Certified professional team with mechanized sanitization equipment",
    code: "CLEAN15",
    discount: "15% OFF",
  },
  {
    id: "fixit250",
    tag: "Appliance Care",
    title: "Guaranteed Flat ₹250 Off",
    desc: "Fix washing machines, refrigerators, microwaves & RO water purifiers",
    code: "FIXIT250",
    discount: "FLAT ₹250",
  },
];

const SAMPLE_CATEGORIES = [
  {
    id: "ac",
    name: "AC Repair & Service",
    icon: "Wind",
    description: "Jet service, gas refill, installation",
  },
  {
    id: "washing",
    name: "Washing Machine",
    icon: "RotateCcw",
    description: "Drum repair, motor fix, spin issue",
  },
  {
    id: "ro",
    name: "RO Water Purifier",
    icon: "Droplets",
    description: "Filter change, membrane replacement",
  },
  {
    id: "fridge",
    name: "Refrigerator",
    icon: "Zap",
    description: "Cooling check, gas charging",
  },
  {
    id: "tv",
    name: "TV Repair",
    icon: "Tv",
    description: "LED/LCD screen, motherboard, sound",
  },
  {
    id: "electrical",
    name: "Electrician",
    icon: "Plug",
    description: "Wiring, switchboard, fuse repair",
  },
  {
    id: "plumbing",
    name: "Plumber",
    icon: "Wrench",
    description: "Pipe leak, tap fittings, motor pump",
  },
  {
    id: "cleaning",
    name: "Home Cleaning",
    icon: "Sparkles",
    description: "Deep bathroom & kitchen sanitization",
  },
];

export const formatCategoryShortLabel = (name: string): string => {
  if (!name) return "";
  const lower = name.toLowerCase().trim();
  if (lower.includes("ac ") || lower.includes("air conditioner") || lower === "ac repair & service" || lower === "ac service" || lower === "ac") {
    return "AC Service";
  }
  if (lower.includes("refrigerat") || lower.includes("fridge")) {
    return "Refrigerator";
  }
  if (lower.includes("washing")) {
    return "Washing Machine";
  }
  if (lower.includes("purifier") || lower.includes("ro ")) {
    return "RO Purifier";
  }
  if (lower.includes("electronic")) {
    return "Electronics";
  }
  if (lower.includes("tv") || lower.includes("television") || lower.includes("audio")) {
    return "TV & Audio";
  }
  if (lower.includes("electric")) {
    return "Electrician";
  }
  if (lower.includes("plumb")) {
    return "Plumbing";
  }
  if (lower.includes("clean") || lower.includes("sanitiz")) {
    return "Cleaning";
  }
  if (lower.includes("paint")) {
    return "Painting";
  }
  if (lower.includes("beauty") || lower.includes("salon")) {
    return "Salon Care";
  }
  if (lower.includes("phone") || lower.includes("mobile")) {
    return "Phone Repair";
  }
  if (lower.includes("geyser") || lower.includes("water heater")) {
    return "Geyser Repair";
  }
  if (lower.includes("microwave") || lower.includes("oven")) {
    return "Microwave";
  }
  if (lower.includes("chimney")) {
    return "Chimney";
  }
  if (lower.includes("pest")) {
    return "Pest Control";
  }
  if (lower.includes("carpenter") || lower.includes("wood")) {
    return "Carpentry";
  }
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/Repair\s*&\s*Service/gi, "")
    .replace(/Repair\s*and\s*Service/gi, "")
    .replace(/Services?/gi, "")
    .replace(/Repair/gi, "")
    .trim() || name;
};

export const getCategoryTileStyle = (categoryName: string): { bg: string; text: string; border: string; hoverBg: string } => {
  const name = (categoryName || "").toLowerCase().trim();

  // • AC: bg-sky-100 text-sky-600
  if (name.includes("ac") || name.includes("air conditioner") || name.includes("cooling")) {
    return {
      bg: "bg-sky-100",
      text: "text-sky-600",
      border: "border-sky-200/70",
      hoverBg: "group-hover:bg-sky-200/80",
    };
  }

  // • Fridge: bg-teal-100 text-teal-600
  if (name.includes("refrigerat") || name.includes("fridge")) {
    return {
      bg: "bg-teal-100",
      text: "text-teal-600",
      border: "border-teal-200/70",
      hoverBg: "group-hover:bg-teal-200/80",
    };
  }

  // • Washing Machine: bg-purple-100 text-purple-600
  if (name.includes("washing") || name.includes("laundry")) {
    return {
      bg: "bg-purple-100",
      text: "text-purple-600",
      border: "border-purple-200/70",
      hoverBg: "group-hover:bg-purple-200/80",
    };
  }

  // • RO Purifier: bg-cyan-100 text-cyan-600
  if (name.includes("ro") || name.includes("purifier") || name.includes("water")) {
    return {
      bg: "bg-cyan-100",
      text: "text-cyan-600",
      border: "border-cyan-200/70",
      hoverBg: "group-hover:bg-cyan-200/80",
    };
  }

  // • TV & Electronics: bg-indigo-100 text-indigo-600
  if (name.includes("tv") || name.includes("television") || name.includes("electronic") || name.includes("audio")) {
    return {
      bg: "bg-indigo-100",
      text: "text-indigo-600",
      border: "border-indigo-200/70",
      hoverBg: "group-hover:bg-indigo-200/80",
    };
  }

  // Electrician: bg-amber-100 text-amber-600
  if (name.includes("electric") || name.includes("wiring") || name.includes("switch")) {
    return {
      bg: "bg-amber-100",
      text: "text-amber-600",
      border: "border-amber-200/70",
      hoverBg: "group-hover:bg-amber-200/80",
    };
  }

  // Cleaning: bg-rose-100 text-rose-600
  if (name.includes("clean") || name.includes("sanitiz")) {
    return {
      bg: "bg-rose-100",
      text: "text-rose-600",
      border: "border-rose-200/70",
      hoverBg: "group-hover:bg-rose-200/80",
    };
  }

  // Plumbing: bg-blue-100 text-blue-600
  if (name.includes("plumb") || name.includes("pipe") || name.includes("leak")) {
    return {
      bg: "bg-blue-100",
      text: "text-blue-600",
      border: "border-blue-200/70",
      hoverBg: "group-hover:bg-blue-200/80",
    };
  }

  // Painting: bg-orange-100 text-orange-600
  if (name.includes("paint")) {
    return {
      bg: "bg-orange-100",
      text: "text-orange-600",
      border: "border-orange-200/70",
      hoverBg: "group-hover:bg-orange-200/80",
    };
  }

  // Beauty & Salon: bg-pink-100 text-pink-600
  if (name.includes("beauty") || name.includes("salon") || name.includes("spa")) {
    return {
      bg: "bg-pink-100",
      text: "text-pink-600",
      border: "border-pink-200/70",
      hoverBg: "group-hover:bg-pink-200/80",
    };
  }

  // Smartphone: bg-slate-100 text-slate-600
  if (name.includes("phone") || name.includes("mobile")) {
    return {
      bg: "bg-slate-100",
      text: "text-slate-600",
      border: "border-slate-200/70",
      hoverBg: "group-hover:bg-slate-200/80",
    };
  }

  return {
    bg: "bg-emerald-100",
    text: "text-emerald-600",
    border: "border-emerald-200/70",
    hoverBg: "group-hover:bg-emerald-200/80",
  };
};

export const resolveCategoryIcon = (iconName?: string, catName?: string): any => {
  const iconLower = (iconName || "").toLowerCase().trim();
  const nameLower = (catName || "").toLowerCase().trim();

  if (iconLower === "wind" || nameLower.includes("ac") || nameLower.includes("air conditioner")) return Wind;
  if (iconLower === "droplets" || nameLower.includes("ro") || nameLower.includes("purifier") || nameLower.includes("water")) return Droplets;
  if (iconLower === "rotateccw" || nameLower.includes("washing")) return RotateCcw;
  if (iconLower === "zap" || nameLower.includes("fridge") || nameLower.includes("refrigerat")) return Zap;
  if (iconLower === "tv" || nameLower.includes("tv") || nameLower.includes("television") || nameLower.includes("electronic") || nameLower.includes("audio")) return Tv;
  if (iconLower === "plug" || nameLower.includes("electric")) return Plug;
  if (iconLower === "wrench" || nameLower.includes("plumb")) return Wrench;
  if (iconLower === "brush" || iconLower === "paintbucket" || nameLower.includes("paint")) return PaintBucket;
  if (iconLower === "scissors" || nameLower.includes("beauty") || nameLower.includes("salon")) return Scissors;
  if (iconLower === "smartphone" || nameLower.includes("phone")) return Smartphone;
  if (iconLower === "hammer" || nameLower.includes("carpenter")) return Hammer;

  return Sparkles;
};

export const resolveBadge = (cat: any): string => {
  if (cat?.badge && String(cat.badge).trim()) return String(cat.badge).trim().toUpperCase();
  if (cat?.tag && String(cat.tag).trim()) return String(cat.tag).trim().toUpperCase();

  const name = String(cat?.name || cat?.title || '').toLowerCase();
  if (name.includes('ro') || name.includes('purifier') || name.includes('water')) return 'ESSENTIAL';
  if (name.includes('ac') || name.includes('cooling')) return 'TRENDING';
  if (name.includes('fridge') || name.includes('refrigerator')) return 'INSTANT';
  if (name.includes('washing') || name.includes('laundry')) return 'TRENDING';
  if (name.includes('electric') || name.includes('plumb')) return 'FAST';

  // Fallback for any newly added category in the future:
  return 'POPULAR';
};

export const getCategoryBadgeConfig = (badgeText: string, _categoryName: string = ''): string => {
  const upper = (badgeText || '').trim().toUpperCase();
  if (upper === 'TRENDING' || upper === 'HOT' || upper.includes('TREND') || upper.includes('HOT')) {
    return 'bg-amber-500/15 text-amber-700 border-amber-300/60';
  }
  if (
    upper === 'INSTANT' ||
    upper === 'FAST' ||
    upper === '30 MINS' ||
    upper.includes('INSTANT') ||
    upper.includes('FAST') ||
    upper.includes('30 MIN')
  ) {
    return 'bg-emerald-500/15 text-emerald-700 border-emerald-300/60';
  }
  if (upper === 'ESSENTIAL' || upper === 'POPULAR' || upper.includes('ESSENTIAL') || upper.includes('POPULAR')) {
    return 'bg-blue-500/15 text-blue-700 border-blue-300/60';
  }
  if (upper === 'BESTSELLER' || upper === 'TOP RATED' || upper.includes('BESTSELLER') || upper.includes('TOP RATED')) {
    return 'bg-indigo-500/15 text-indigo-700 border-indigo-300/60';
  }
  if (upper === 'NEW' || upper === 'OFFER' || upper.includes('NEW') || upper.includes('OFFER')) {
    return 'bg-rose-500/15 text-rose-700 border-rose-300/60';
  }
  return 'bg-slate-100 text-slate-700 border-slate-300/60';
};

export const getCategoryBadge = (cat: any): { text: string; className: string } | null => {
  if (!cat) return null;
  const badgeText = resolveBadge(cat);
  const colorClasses = getCategoryBadgeConfig(badgeText, cat.name || cat.title || '');
  return {
    text: badgeText,
    className: `text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border shadow-2xs ${colorClasses}`,
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

export default function CustomerHome({
  setActiveTab,
  profile,
  onAuthRequired,
  onServiceSelect,
  initialCategoryId,
  onOpenProfileMenu,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [viewDetailsModalService, setViewDetailsModalService] =
    useState<Service | null>(null);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    setViewDetailsModalService(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [selectedCategory]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

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
  const [categoryTypeTab, setCategoryTypeTab] = useState<
    "All" | "Home" | "Professional" | "Repair"
  >("All");
  const INDORE_TYPEWRITER_SERVICES = useMemo(
    () => [
      "Search 'Split AC Service'...",
      "Search 'RO Water Purifier Repair'...",
      "Search 'Front Load Washing Machine'...",
      "Search 'Refrigerator Gas Refilling'...",
      "Search 'Doorstep TV Repair'...",
    ],
    [],
  );

  const [currentPlaceholder, setCurrentPlaceholder] = useState(
    "Search 'Split AC Service'...",
  );

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 30;
      setIsScrolled((prev) => (prev !== scrolled ? scrolled : prev));
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let serviceIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (!isMounted) return;

      const currentService =
        INDORE_TYPEWRITER_SERVICES[
          serviceIndex % INDORE_TYPEWRITER_SERVICES.length
        ];

      if (isDeleting) {
        setCurrentPlaceholder(currentService.substring(0, charIndex - 1));
        charIndex--;
      } else {
        setCurrentPlaceholder(currentService.substring(0, charIndex + 1));
        charIndex++;
      }

      let delay = isDeleting ? 25 : 65;

      if (!isDeleting && charIndex === currentService.length) {
        delay = 1900;
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        serviceIndex++;
        delay = 350;
      }

      timeoutId = setTimeout(tick, delay);
    };

    timeoutId = setTimeout(tick, 450);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [INDORE_TYPEWRITER_SERVICES]);

  const [partners, setPartners] = useState<PartnerWithInfo[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [activeOfferIndex, setActiveOfferIndex] = useState<number>(0);
  const [isOfferPaused, setIsOfferPaused] = useState<boolean>(false);

  const consolidatedOffers = useMemo(() => {
    const dynamic = promotions.map((p) => ({
      id: p.id,
      tag: p.discountType === "percent" ? `${p.discountValue}% OFF` : `₹${p.discountValue} OFF`,
      title: p.name,
      desc: p.description,
      code: p.code,
      discount: p.discountType === "percent" ? `${p.discountValue}% OFF` : `₹${p.discountValue} OFF`,
    }));

    return dynamic.length > 0 ? [...dynamic, ...CONSOLIDATED_OFFERS] : CONSOLIDATED_OFFERS;
  }, [promotions]);

  useEffect(() => {
    if (isOfferPaused || consolidatedOffers.length <= 1) return;
    const interval = setInterval(() => {
      setActiveOfferIndex((prev) => (prev + 1) % consolidatedOffers.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isOfferPaused, consolidatedOffers.length]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});
  const [failedServiceImages, setFailedServiceImages] = useState<Record<string, boolean>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [isPillDismissed, setIsPillDismissed] = useState(false);
  const [bookingPartner, setBookingPartner] = useState<{
    name: string;
    id: string;
    phone?: string;
  } | null>(null);

  const hasActiveBooking = Boolean(
    activeBooking &&
      ["assigned", "on_the_way", "arrived", "in_progress"].includes(
        (activeBooking.status || "").toLowerCase()
      )
  );
  const isPillVisible = hasActiveBooking && !isPillDismissed;

  useEffect(() => {
    if (activeBooking?.status) {
      setIsPillDismissed(false);
    }
  }, [activeBooking?.id, activeBooking?.status]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("zomini-pill-visibility", {
        detail: { isPillVisible },
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("zomini-pill-visibility", {
          detail: { isPillVisible: false },
        })
      );
    };
  }, [isPillVisible]);

  useEffect(() => {
    const handleOpenBookingModal = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.service) {
        if (!profile) {
          onAuthRequired();
          return;
        }
        setSelectedService(customEvent.detail.service);
      }
    };
    window.addEventListener("open-booking-modal", handleOpenBookingModal);
    return () => {
      window.removeEventListener("open-booking-modal", handleOpenBookingModal);
    };
  }, [profile, onAuthRequired]);

  // Force-review popup rating states
  const [ratedBookings, setRatedBookings] = useState<Record<string, boolean>>({});
  const [showForceFeedbackPopup, setShowForceFeedbackPopup] = useState<boolean>(false);
  const [popupWizardStep, setPopupWizardStep] = useState<number>(1);
  const [popupRatingPartner, setPopupRatingPartner] = useState<number>(0);
  const [popupRatingProcess, setPopupRatingProcess] = useState<number>(0);
  const [popupRatingSafety, setPopupRatingSafety] = useState<number>(0);
  const [popupRatingZomIndia, setPopupRatingZomIndia] = useState<number>(0);
  const [popupComment, setPopupComment] = useState<string>("");
  const [isSubmittingPopupReview, setIsSubmittingPopupReview] = useState<boolean>(false);

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

    setTimeout(() => {
      setPopupWizardStep((prev) => Math.min(prev + 1, 5));
    }, 350);
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
              "Amit Singh",
            id: activeBooking.partnerId,
            phone:
              userData?.phoneNumber ||
              userData?.mobile ||
              partnerData?.phoneNumber ||
              (activeBooking as any).partnerPhone ||
              "",
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

  useEffect(() => {
    if (!profile?.uid) {
      setActiveBooking(null);
      return;
    }
    let isMounted = true;
    const unsubscribes: (() => void)[] = [];
    const bookingsMap = new Map<string, Booking>();

    const normalizeBooking = (id: string, data: any): Booking => {
      const activeCustomerId = data.customerUid || data.customerId || data.userId || "";
      return {
        id,
        ...data,
        customerUid: activeCustomerId,
        customerId: activeCustomerId,
        userId: activeCustomerId,
      } as Booking;
    };

    const processBookings = () => {
      if (!isMounted) return;
      const pillStatuses = [
        "assigned",
        "on_the_way",
        "arrived",
        "in_progress",
      ];
      const allDocs = Array.from(bookingsMap.values());
      allDocs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      const activePillBooking = allDocs.find((b) =>
        pillStatuses.includes((b.status || "").toLowerCase())
      );
      setActiveBooking(activePillBooking || null);
    };

    const q1 = query(
      collection(db, "bookings"),
      where("customerUid", "==", profile.uid)
    );
    const unsub1 = onSnapshot(
      q1,
      (snap) => {
        snap.docs.forEach((doc) => {
          bookingsMap.set(doc.id, normalizeBooking(doc.id, doc.data()));
        });
        processBookings();
      },
      (err) => {
        if (!isMounted) return;
        console.warn("CustomerHome customerUid bookings query notice:", err);
      }
    );
    unsubscribes.push(unsub1);

    const q2 = query(
      collection(db, "bookings"),
      where("customerId", "==", profile.uid)
    );
    const unsub2 = onSnapshot(
      q2,
      (snap) => {
        snap.docs.forEach((doc) => {
          const existing = bookingsMap.get(doc.id);
          bookingsMap.set(doc.id, {
            ...(existing || {}),
            ...normalizeBooking(doc.id, doc.data()),
          });
        });
        processBookings();
      },
      (err) => {
        if (!isMounted) return;
        console.warn("CustomerHome legacy customerId bookings notice:", err);
      }
    );
    unsubscribes.push(unsub2);

    return () => {
      isMounted = false;
      unsubscribes.forEach((u) => u());
    };
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
    let isMounted = true;
    const q = query(collection(db, "categories"), orderBy("name", "asc"));
    const unsubscribeCategories = onSnapshot(
      q,
      (snap) => {
        if (!isMounted) return;
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
        if (!isMounted) return;
        console.error("Error subscribing to categories:", err);
        setCategories(SAMPLE_CATEGORIES as Category[]);
        setLoading(false);
      },
    );
    return () => {
      isMounted = false;
      if (typeof unsubscribeCategories === "function") unsubscribeCategories();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const unsubscribeServices = onSnapshot(
      collection(db, "services"),
      (snap) => {
        if (!isMounted) return;
        const validServices = snap.docs
          .map((d) => {
            const raw = d.data() as Record<string, any>;
            const resolvedName = raw.name || raw.title || "";
            const resolvedPrice = Number(
              raw.discountedPrice ?? raw.basePrice ?? raw.price ?? 0
            );
            const resolvedImage =
              raw.imageURL ||
              raw.imageUrl ||
              raw.image ||
              (Array.isArray(raw.images) && raw.images.length > 0
                ? raw.images[0]
                : undefined);
            return {
              ...raw,
              id: d.id,
              name: resolvedName,
              basePrice: resolvedPrice,
              categoryId: raw.categoryId || raw.category || "",
              imageURL: resolvedImage,
            } as Service;
          })
          .filter(
            (s) =>
              (s as any).isActive !== false && isValidCustomerService(s)
          );
        setAllServices(validServices);
        setServicesLoading(false);
      },
      (err) => {
        if (!isMounted) return;
        console.error("Error subscribing to services:", err);
        setServicesLoading(false);
      },
    );
    return () => {
      isMounted = false;
      if (typeof unsubscribeServices === "function") unsubscribeServices();
    };
  }, []);

  const groupedCategoryServices = useMemo(() => {
    if (allServices.length === 0) return [];

    const groupsMap = new Map<
      string,
      {
        key: string;
        category: Category | null;
        categoryName: string;
        categoryDescription?: string;
        services: Service[];
      }
    >();

    allServices.forEach((service) => {
      const rawCatKey = String(
        service.categoryId || (service as any).category || ""
      ).trim();
      if (!rawCatKey) return;

      const matchedCat =
        allCategories.find(
          (c) =>
            c.id === rawCatKey ||
            c.name.toLowerCase().trim() === rawCatKey.toLowerCase()
        ) || null;

      const groupKey = matchedCat ? matchedCat.id : rawCatKey;
      const existing = groupsMap.get(groupKey);
      if (existing) {
        existing.services.push(service);
      } else {
        groupsMap.set(groupKey, {
          key: groupKey,
          category: matchedCat,
          categoryName: matchedCat?.name || rawCatKey,
          categoryDescription: matchedCat?.description,
          services: [service],
        });
      }
    });

    const orderedGroups: Array<{
      key: string;
      category: Category | null;
      categoryName: string;
      categoryDescription?: string;
      services: Service[];
    }> = [];

    allCategories.forEach((cat) => {
      const group = groupsMap.get(cat.id);
      if (group && group.services.length > 0) {
        orderedGroups.push(group);
        groupsMap.delete(cat.id);
      }
    });

    groupsMap.forEach((group) => {
      if (group.services.length > 0) {
        orderedGroups.push(group);
      }
    });

    return orderedGroups;
  }, [allServices, allCategories]);

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
          const loadedServices = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Service)
            .filter(isValidCustomerService);
          setServices(loadedServices);
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, path);
        }
      };

      const fetchPartners = async () => {
        try {
          let snapDocs: any[] = [];
          try {
            const q = query(
              collection(db, "partners"),
              where("categories", "array-contains", selectedCategory.id),
              where("status", "==", "active"),
            );
            const snap = await getDocs(q);
            snapDocs = snap.docs;
          } catch (compositeErr) {
            console.warn("Falling back to single-field partners query:", compositeErr);
            const fallbackQ = query(
              collection(db, "partners"),
              where("status", "==", "active")
            );
            const fallbackSnap = await getDocs(fallbackQ);
            snapDocs = fallbackSnap.docs.filter((d) => {
              const data = d.data();
              return Array.isArray(data.categories) && data.categories.includes(selectedCategory.id);
            });
          }

          const partnerList = await Promise.all(
            snapDocs.map(async (d) => {
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

  if (selectedCategory) {
    const validCategoryServices = services.filter(isValidCustomerService);

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-blue-700 mb-4 font-semibold text-sm transition-all hover:translate-x-[-3px] cursor-pointer"
        >
          <ChevronLeft size={18} /> Back to home
        </button>

        {/* Clean, Non-Repetitive Category Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 px-1">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold uppercase tracking-wider mb-1.5">
              <Sparkles size={11} /> Verified Category
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight uppercase font-display">
              {selectedCategory.name}
            </h2>
            {selectedCategory.description && (
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 max-w-2xl line-clamp-2">
                {selectedCategory.description}
              </p>
            )}
          </div>

          {selectedCategory.imageURL && (
            <div className="hidden sm:block w-24 h-24 rounded-2xl overflow-hidden border border-slate-100 shadow-sm shrink-0 bg-slate-50">
              <img
                src={selectedCategory.imageURL}
                alt={selectedCategory.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            </div>
          )}
        </div>

        {/* Urban Company-Style Compact Horizontal Row Layout for Service Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-1 mb-4">
          {validCategoryServices.map((service, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={service.id}
              className="bg-white border border-slate-200/80 hover:border-blue-600/70 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-4 group"
            >
              {/* Left Column (Text & Details) */}
              <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                <div>
                  <h3
                    onClick={() => onServiceSelect(service.id)}
                    className="text-base sm:text-lg font-bold text-slate-900 hover:text-blue-700 transition-colors line-clamp-1 cursor-pointer leading-snug"
                  >
                    {service.name}
                  </h3>

                  {/* Rating badge & duration: subtle gray/amber */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-100/70 text-amber-700 rounded-md text-[11px] font-bold">
                      <Star size={11} fill="currentColor" className="text-amber-500" />
                      <span>{service.rating || 4.8}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      ({service.duration || "45-60 mins"})
                    </span>
                  </div>

                  {/* Price display with helper text */}
                  <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="text-xs text-slate-400 font-semibold">Starting from</span>
                    <span className="text-base sm:text-lg font-extrabold text-slate-900">
                      ₹{service.basePrice}
                    </span>
                  </div>

                  {/* 1-line key benefit bullet */}
                  <p className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1.5 line-clamp-1">
                    <CheckCircle2 size={12} className="shrink-0 text-emerald-600" />
                    <span>Free 30-day post-service warranty</span>
                  </p>
                </div>

                {/* View Details bottom sheet / modal trigger */}
                <button
                  type="button"
                  onClick={() => setViewDetailsModalService(service)}
                  className="mt-3 text-[11px] font-bold text-blue-700 hover:text-blue-800 self-start cursor-pointer inline-flex items-center gap-1 hover:underline select-none"
                >
                  View Details ▾
                </button>
              </div>

              {/* Right Column (Visual & Action) */}
              <div className="relative shrink-0 flex flex-col items-center">
                {/* Compact rounded image thumbnail approx 84x84px */}
                <div
                  onClick={() => onServiceSelect(service.id)}
                  className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-inner flex items-center justify-center cursor-pointer group-hover:scale-[1.02] transition-transform"
                >
                  {service.imageURL ? (
                    <img
                      src={service.imageURL}
                      alt={service.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                      {service.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Overlapping bottom-anchored sleek [+ ADD] pill button in brand blue */}
                <button
                  type="button"
                  onClick={() =>
                    profile ? setSelectedService(service) : onAuthRequired()
                  }
                  className="absolute -bottom-2.5 px-4 py-1.5 bg-[#050ca6] hover:bg-[#04098c] active:scale-95 text-white text-[11px] font-bold rounded-full shadow-md hover:shadow-lg transition-all duration-150 uppercase tracking-wider cursor-pointer border border-blue-500/20 flex items-center gap-1 whitespace-nowrap z-10"
                >
                  <Plus size={12} strokeWidth={2.5} /> ADD
                </button>
              </div>
            </motion.div>
          ))}

          {validCategoryServices.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No services found in this category. We are working on it!
            </div>
          )}
        </div>

        {/* Sleek Centered 'End of List' Notice directly after the last service card */}
        {validCategoryServices.length > 0 && (
          <div className="flex items-center justify-center gap-3 my-4 sm:my-5 px-4">
            <div className="h-px bg-slate-200/80 flex-1 max-w-[80px] sm:max-w-[140px]" />
            <span className="text-xs text-slate-400 font-medium tracking-wide text-center flex items-center gap-2 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
              You have reached the end of {selectedCategory.name} services
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
            </span>
            <div className="h-px bg-slate-200/80 flex-1 max-w-[80px] sm:max-w-[140px]" />
          </div>
        )}

        {partners.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-end mb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-0.5">
                  Featured Partners
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Top-rated professionals specializing in{" "}
                  {selectedCategory.name}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="bg-slate-50/80 p-5 rounded-2xl flex flex-col sm:flex-row gap-5 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all group"
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={
                        partner.photoURL && !partner.photoURL.includes("googleusercontent.com/image_collection")
                          ? partner.photoURL
                          : LogoIcon
                      }
                      alt={partner.displayName}
                      className="w-16 h-16 rounded-full object-cover bg-white border-2 border-[#22c55e]"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    <div className="absolute -bottom-1 -right-1 flex flex-col items-end gap-1">
                      <div
                        className={`p-1 bg-white rounded-full shadow-sm border border-slate-100 ${partner.isVerified ? "text-emerald-500" : "text-slate-300"}`}
                      >
                        {partner.isVerified ? (
                          <CheckCircle2
                            size={14}
                            fill="currentColor"
                            className="text-white fill-emerald-500"
                          />
                        ) : (
                          <div className="w-3.5 h-3.5 bg-slate-100 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="mb-1">
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
                    <div className="flex justify-between items-start mb-1.5">
                      <h4 className="text-base font-bold text-slate-900">
                        {partner.displayName}
                      </h4>
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-900 border border-slate-200 px-2.5 py-0.5 rounded-full bg-white">
                        <Star
                          size={12}
                          fill="currentColor"
                          className="text-amber-400"
                        />{" "}
                        {partner.rating || "New"}
                      </div>
                    </div>
                    {partner.bio && (
                      <p className="text-slate-500 text-xs mb-2.5 line-clamp-1 italic">
                        "{partner.bio}"
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {partner.categories.slice(0, 3).map((catId) => {
                        const cat = categories.find((c) => c.id === catId);
                        return cat ? (
                          <span
                            key={catId}
                            className="text-[9px] uppercase font-bold tracking-widest text-slate-400"
                          >
                            #{cat.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <button className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 transition-all cursor-pointer">
                      View Profile <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {selectedService && (
            <BookingModal
              service={selectedService}
              profile={profile}
              onClose={() => setSelectedService(null)}
              onSuccess={(bookingId?: string) => {
                setSelectedService(null);
                if (bookingId) {
                  setActiveTab("bookings", bookingId);
                } else {
                  setActiveTab("bookings");
                }
              }}
            />
          )}

          {/* Urban Company-Style View Details Bottom Sheet / Modal */}
          {viewDetailsModalService && (
            <div 
              className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pb-28 sm:pb-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setViewDetailsModalService(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col overflow-hidden relative"
              >
                {/* Fixed Top Header */}
                <div className="flex items-start justify-between gap-4 p-5 sm:p-6 pb-4 border-b border-slate-100 shrink-0">
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-slate-900 leading-tight">
                      {viewDetailsModalService.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-md text-xs font-bold">
                        <Star size={12} fill="currentColor" className="text-amber-500" />
                        <span>{viewDetailsModalService.rating || 4.8}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        • {viewDetailsModalService.duration || "45-60 mins"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewDetailsModalService(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scrollable Content Body with smooth overscroll */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 overscroll-contain">
                  {viewDetailsModalService.imageURL && (
                    <div className="w-full h-44 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
                      <img
                        src={viewDetailsModalService.imageURL}
                        alt={viewDetailsModalService.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Service Description
                    </h4>
                    <p className="text-sm text-slate-700 font-medium leading-relaxed">
                      {viewDetailsModalService.description || "Comprehensive service delivered by certified background-verified professionals."}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/80 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      What's Included
                    </h4>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      <span>30-Day Post Service Guarantee</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      <span>Standard spare parts & complete diagnostics</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      <span>Post-service cleanup & doorstep testing</span>
                    </div>
                  </div>
                </div>

                {/* Sticky / Floating Bottom CTA Action Row - Always 100% visible and clickable */}
                <div className="sticky bottom-0 z-30 bg-white/98 backdrop-blur-md px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex items-center justify-between gap-4 shrink-0 rounded-b-none sm:rounded-b-3xl">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Price
                    </p>
                    <p className="text-xl font-black text-slate-900 tracking-tight">
                      ₹{viewDetailsModalService.basePrice}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const s = viewDetailsModalService;
                      setViewDetailsModalService(null);
                      if (profile) {
                        setSelectedService(s);
                      } else {
                        onAuthRequired();
                      }
                    }}
                    className="flex-1 max-w-[200px] py-3 bg-[#050ca6] hover:bg-[#04098c] active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all uppercase tracking-wider text-center cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Book Now
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="pb-28 sm:pb-16 w-full">
      {/* Soft semi-transparent backdrop overlay when search is active */}
      {searchQuery.trim().length > 0 && (
        <div
          onClick={() => setSearchQuery("")}
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40"
          aria-hidden="true"
        />
      )}

      {/* Dynamic Sticky/Fixed Search Bar (Zomato Pattern) */}
      <div 
        className={
          isScrolled 
            ? "fixed top-0 left-0 right-0 z-50 w-full bg-white/95 backdrop-blur-md px-4 py-2.5 shadow-sm border-b border-slate-100 transition-all"
            : "relative z-50 w-full max-w-5xl mx-auto mt-2 px-3 sm:px-6 transition-all"
        }
      >
        <div className="w-full max-w-5xl mx-auto relative z-50 flex items-center gap-2.5">
          {/* ONLY when sticky/fixed, a prominent Zomindia brand icon appears on the left */}
          {isScrolled && (
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="shrink-0 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              title="Back to top"
              aria-label="Back to top"
            >
              <img
                src="/icon-512.png"
                alt="Zomindia"
                className="h-10 w-10 sm:h-11 sm:w-11 object-contain shrink-0"
              />
            </button>
          )}

          {/* Search Input Container - Flexes to fill full width */}
          <div className="relative z-50 flex-1 min-w-0">
            <div 
              className="relative flex items-center h-11 bg-slate-50 hover:bg-slate-100/70 focus-within:bg-white border border-slate-200/90 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/10 rounded-2xl shadow-xs transition-all duration-200 px-3"
              onTouchStartCapture={(e) => e.stopPropagation()} 
              onMouseDownCapture={(e) => e.stopPropagation()}
            >
              <div className="text-slate-400 focus-within:text-blue-600 flex items-center shrink-0 mr-2">
                <Search size={18} className="stroke-[2.2]" />
              </div>

              <input
                type="text"
                inputMode="text"
                enterKeyHint="search"
                placeholder={currentPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full py-2 bg-transparent focus:outline-none text-slate-800 font-bold text-xs sm:text-base placeholder:text-slate-400 placeholder:font-medium min-w-0 ${searchQuery.trim().length > 0 ? "pr-20" : "pr-10"}`}
              />

              {searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-11 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-all active:scale-90 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}

              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white h-8 w-8 rounded-lg flex items-center justify-center transition-all shadow-xs cursor-pointer"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

          {/* Search Results Dropdown - High Elevation & App-like Styling */}
          <AnimatePresence>
            {searchQuery.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-[75vh] overflow-y-auto text-left"
              >
                {filteredSearchResults.length > 0 ? (
                  <div className="divide-y divide-slate-100 p-2 overscroll-contain">
                    {filteredSearchResults.map((service) => {
                      const category = allCategories.find((c) => c.id === service.categoryId);
                      return (
                        <div
                          key={service.id}
                          onClick={() => {
                            onServiceSelect(service.id);
                            setSearchQuery("");
                          }}
                          className="group flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-blue-50/60 active:bg-blue-100/60 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                              <img
                                src={service.imageURL || '/pwa-192x192.png'}
                                alt={service.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLElement).setAttribute('src', '/pwa-192x192.png');
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-700 leading-tight">
                                {service.name}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                {category && (
                                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md truncate max-w-[140px]">
                                    {category.name}
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                                  ★ 4.8
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 pl-2">
                            <div className="text-right">
                              <span className="block text-[9px] font-medium text-slate-400 leading-none">Starting</span>
                              <span className="text-sm font-extrabold text-[#002e6e]">₹{service.basePrice}</span>
                            </div>
                            <button
                              type="button"
                              className="bg-[#002e6e] group-hover:bg-[#00baf2] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                            >
                              Book
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-sm font-semibold text-slate-600 mb-2">No services matching "{searchQuery}"</p>
                    <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                      {['AC Service', 'RO Purifier', 'Washing Machine', 'Refrigerator', 'TV Repair'].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setSearchQuery(chip)}
                          className="text-xs font-medium bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 px-2.5 py-1 rounded-full transition-colors"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Placeholder spacer when fixed to prevent layout jump */}
      {isScrolled && <div className="h-14 sm:h-16 w-full shrink-0" aria-hidden="true" />}

      {/* Main Container */}
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 mt-2.5 sm:mt-3 pb-4 sm:pb-6 relative z-10"
      >
        {/* Categories Grid */}
        <motion.section
          layout="position"
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 animate-fade-in relative z-10"
          id="categories-grid"
        >
          <div className="bg-white rounded-[28px] sm:rounded-[36px] border border-slate-100/90 shadow-xs pt-3 sm:pt-4 px-3.5 sm:px-8 pb-5 sm:pb-7 relative overflow-hidden group">
            {/* Ambient gradient backdrops */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-50/20 to-slate-50/10 rounded-full blur-3xl pointer-events-none -translate-y-12 translate-x-12 transition-transform duration-1000 group-hover:scale-110" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-sky-50/20 to-slate-50/10 rounded-full blur-3xl pointer-events-none translate-y-12 -translate-x-12 transition-transform duration-1000 group-hover:scale-110" />

            {/* Category Tabs: ALL, HOME, PROFESSIONAL, REPAIR */}
            <div className="mb-3 sm:mb-4 relative z-10">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5">
                {(
                  [
                    { id: "All", label: "✨ All" },
                    { id: "Home", label: "🏠 Home" },
                    { id: "Professional", label: "💼 Professional" },
                    { id: "Repair", label: "🔧 Repair" },
                  ] as const
                ).map((tab) => {
                  const isActive = categoryTypeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCategoryTypeTab(tab.id)}
                      className={
                        isActive
                          ? "bg-slate-900 text-white font-bold text-xs px-3.5 py-1.5 rounded-full shadow-md shadow-slate-900/20 ring-1 ring-slate-900 flex items-center gap-1.5 shrink-0 active:scale-95 transition-all duration-150 cursor-pointer"
                          : "bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-semibold text-xs px-3.5 py-1.5 rounded-full border border-slate-250 shadow-2xs hover:border-slate-400 flex items-center gap-1.5 shrink-0 active:scale-95 transition-all duration-150 cursor-pointer"
                      }
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Service Categories Grid */}
            {loading && categories.length === 0 ? (
              <SkeletonCategoryGrid count={14} />
            ) : (
              <motion.div
                layout
                className="grid grid-cols-4 sm:grid-cols-6 gap-x-2 gap-y-4 my-3 px-1 relative z-10"
              >
                <AnimatePresence mode="popLayout">
                  {categories
                    .filter((cat) => {
                      if (categoryTypeTab !== "All") {
                        const type = getCategoryType(cat.name);
                        if (type !== categoryTypeTab) return false;
                      }
                      return true;
                    })
                    .map((cat) => {
                      const Icon = resolveCategoryIcon(cat.icon, cat.name);
                      const tileStyle = getCategoryTileStyle(cat.name);
                      const badgeText = resolveBadge(cat);
                      const badgeColorClass = getCategoryBadgeConfig(badgeText, cat.name);
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
                          initial={{ opacity: 0, scale: 0.95, y: 12 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -12 }}
                          viewport={{ once: true }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 25,
                            layout: { duration: 0.3 },
                          }}
                          onClick={(e) => {
                            setSelectedCategory(cat);
                            e.currentTarget.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          }}
                          className="group relative flex flex-col items-center justify-start p-1 bg-transparent border-0 shadow-none cursor-pointer active:scale-95 transition-all duration-200 select-none focus:outline-none"
                        >
                          {/* Category Badge Chip Above Icon */}
                          {badgeText && (
                            <span
                              className={`mb-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border shadow-2xs whitespace-nowrap leading-none ${badgeColorClass}`}
                            >
                              {badgeText}
                            </span>
                          )}

                          {/* Swiggy/Zomato Icon Avatar (The Hero Element) */}
                          <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-slate-50 to-slate-100/90 border border-slate-200/60 shadow-sm group-hover:shadow-md group-hover:border-blue-300 group-hover:scale-105 transition-all duration-200 flex items-center justify-center p-2.5 overflow-visible">
                            {hasValidIconURL ? (
                              <img
                                src={cat.iconURL}
                                alt={cat.name}
                                width={48}
                                height={48}
                                className="w-full h-full object-contain drop-shadow-xs transition-transform duration-200 group-hover:scale-110"
                                referrerPolicy="no-referrer"
                                onError={() => {
                                  setFailedIcons((prev) => ({
                                    ...prev,
                                    [cat.id]: true,
                                  }));
                                }}
                              />
                            ) : (
                              <Icon
                                size={28}
                                className={`w-full h-full object-contain drop-shadow-xs transition-transform duration-200 group-hover:scale-110 ${tileStyle.text}`}
                              />
                            )}
                          </div>

                          {/* Typography (Clean, Centered, No Cramping) */}
                          <span className="mt-2 text-slate-800 font-semibold text-[11px] sm:text-xs leading-snug line-clamp-2 max-w-[76px] sm:max-w-[88px] text-center select-none">
                            {formatCategoryShortLabel(cat.name)}
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
                  return true;
                }).length === 0 && (
                  <div className="col-span-full py-12 text-center w-full bg-slate-50/50 rounded-3xl border border-dashed border-slate-200/60 p-6 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      No Services Found
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      Try selecting another category tab above.
                    </p>
                  </div>
                )}

                <motion.button
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative flex flex-col items-center justify-start p-1 bg-transparent border-0 shadow-none cursor-pointer active:scale-95 transition-all duration-200 select-none focus:outline-none"
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
                  <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl sm:rounded-3xl bg-slate-100 border border-slate-200/60 shadow-sm group-hover:shadow-md group-hover:border-blue-300 group-hover:scale-105 transition-all duration-200 flex items-center justify-center p-2.5 overflow-visible">
                    <div className="flex gap-1 items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-200 group-hover:scale-125 group-hover:bg-slate-700" />
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-200 group-hover:scale-125 group-hover:bg-slate-700" />
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-200 group-hover:scale-125 group-hover:bg-slate-700" />
                    </div>
                  </div>
                  <span className="mt-2 text-slate-800 font-semibold text-[11px] sm:text-xs leading-snug line-clamp-2 max-w-[76px] sm:max-w-[88px] text-center select-none">
                    More
                  </span>
                </motion.button>
              </motion.div>
            )}
          </div>
        </motion.section>

        {/* Consolidated Offers Auto-Slider Banner (Single card with indicator dots) */}
        <section
          className="mb-8 w-full max-w-6xl mx-auto"
          id="offers-slider"
          onMouseEnter={() => setIsOfferPaused(true)}
          onMouseLeave={() => setIsOfferPaused(false)}
        >
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white">
            <AnimatePresence mode="wait">
              {(() => {
                const currentOffer = consolidatedOffers[activeOfferIndex] || consolidatedOffers[0];
                if (!currentOffer) return null;

                return (
                  <motion.div
                    key={currentOffer.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    onClick={() => {
                      navigator.clipboard.writeText(currentOffer.code);
                      setCopiedCode(currentOffer.code);
                      (window as any).__showCopyToast?.(currentOffer.code);
                      setTimeout(() => setCopiedCode(null), 2000);
                    }}
                    className="p-5 sm:p-7 md:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 cursor-pointer group relative overflow-hidden"
                  >
                    {/* Background glows */}
                    <div className="absolute -right-16 -bottom-16 w-56 h-56 rounded-full bg-blue-500/15 blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
                    <div className="absolute top-0 right-1/4 w-32 h-32 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-white/15 text-white border border-white/20 backdrop-blur-xs">
                          {currentOffer.tag}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold text-amber-300 uppercase tracking-widest bg-amber-400/10">
                          {currentOffer.discount}
                        </span>
                      </div>

                      <h4 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight mb-1.5">
                        {currentOffer.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-300 font-medium line-clamp-2 max-w-xl mb-3.5 leading-relaxed">
                        {currentOffer.desc}
                      </p>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-sm transition-all duration-300 border ${
                            copiedCode === currentOffer.code
                              ? "bg-emerald-500 text-white border-emerald-400"
                              : "bg-white text-slate-900 border-white group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent"
                          }`}
                        >
                          {copiedCode === currentOffer.code ? (
                            <>
                              <Check size={12} className="stroke-[3]" />
                              <span>Code Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} className="stroke-[2.5]" />
                              <span>Code: {currentOffer.code}</span>
                            </>
                          )}
                        </button>
                        <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                          Tap to copy & use at checkout
                        </span>
                      </div>
                    </div>

                    {/* Decorative Visual / Badge */}
                    <div className="relative z-10 hidden sm:flex flex-col items-center justify-center shrink-0 w-24 h-24 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs p-3 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Offer</span>
                      <span className="text-xl font-black text-amber-400 tracking-tight">{currentOffer.discount}</span>
                      <span className="text-[8px] font-semibold text-slate-300 uppercase tracking-widest mt-0.5">Indore Only</span>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Slider Dots Indicator */}
            {consolidatedOffers.length > 1 && (
              <div className="relative z-10 flex items-center justify-center gap-1.5 pb-3">
                {consolidatedOffers.map((offer, idx) => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveOfferIndex(idx);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      activeOfferIndex === idx
                        ? "w-6 bg-blue-500"
                        : "w-2 bg-white/30 hover:bg-white/60"
                    }`}
                    aria-label={`Go to offer ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Most Booked in Indore (Top 4 Services with Clear Pricing & Direct Book) */}
        {(servicesLoading || allServices.length > 0) && (
          <section
            className="mb-8 w-full max-w-6xl mx-auto"
            id="most-booked-section"
          >
            <div className="flex flex-row items-center justify-between mb-4 px-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                    Indore Verified
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top Rated</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  Most Booked in Indore
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("categories-grid");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
              >
                See all
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {servicesLoading ? (
                <SkeletonServiceCardGrid count={4} />
              ) : (
                [...allServices]
                  .sort(
                    (a, b) =>
                      Number(b.rating || b.averageRating || 4.8) -
                      Number(a.rating || a.averageRating || 4.8)
                  )
                  .slice(0, 4)
                  .map((service, idx) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      categoryName={
                        allCategories.find((c) => c.id === service.categoryId)?.name
                      }
                      onSelect={onServiceSelect}
                      idx={idx}
                    />
                  ))
              )}
            </div>
          </section>
        )}

        {/* Clean Single-Row Trust Guarantee Banner & Support Action */}
        <section className="mb-12 w-full max-w-6xl mx-auto" id="trust-guarantee-banner">
          <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              {/* 3 Guarantees in a clean row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <ShieldCheck size={20} className="stroke-[2.2]" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                      100% Police Verified Experts
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">Background checked & ID certified</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} className="stroke-[2.2]" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                      Transparent Upfront Pricing
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">Standard rate card, no surprise bills</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <RotateCcw size={20} className="stroke-[2.2]" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                      7-Day Free Rework Warranty
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">100% satisfaction or full rework</p>
                  </div>
                </div>
              </div>

              {/* Subtle 1-tap "Need help booking? Call Support" quick action link for elderly users */}
              <div className="pt-3 lg:pt-0 lg:pl-6 border-t lg:border-t-0 lg:border-l border-slate-200 flex items-center justify-center lg:justify-end shrink-0">
                <a
                  href="tel:+919630234563"
                  className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-blue-700 font-bold transition-all shadow-xs group"
                >
                  <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                    <PhoneCall size={15} className="stroke-[2.5]" />
                  </span>
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider leading-none mb-0.5">
                      Senior & Quick Help
                    </span>
                    <span className="text-xs font-black text-slate-900 group-hover:text-blue-700">
                      Need help booking? Call Support
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Category-Wise Service Carousels from Firestore */}
        {servicesLoading ? (
          <div className="mb-8 w-full max-w-6xl mx-auto">
            <SkeletonServiceCardGrid count={4} />
          </div>
        ) : (
          groupedCategoryServices.map((group) => {
            const tileStyle = getCategoryTileStyle(group.categoryName);
            const CategoryFallbackIcon = resolveCategoryIcon(
              group.category?.icon,
              group.categoryName
            );

            return (
              <section
                key={group.key}
                className="mb-8 w-full max-w-6xl mx-auto"
              >
                <div className="flex flex-row items-center justify-between mb-3.5 px-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${tileStyle.bg} ${tileStyle.text}`}
                      >
                        {formatCategoryShortLabel(group.categoryName)}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck size={11} /> 30-Day Warranty
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                      {group.categoryName}
                    </h3>
                    {group.categoryDescription && (
                      <p className="text-[11px] sm:text-xs text-slate-500 font-medium line-clamp-1">
                        {group.categoryDescription}
                      </p>
                    )}
                  </div>

                  {group.category && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(group.category);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
                    >
                      See all
                    </button>
                  )}
                </div>

                <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 snap-x snap-mandatory">
                  {group.services.map((service) => {
                    const title = service.name || (service as any).title || "Service";
                    const displayPrice = Number(
                      (service as any).discountedPrice ??
                        service.basePrice ??
                        (service as any).price ??
                        0
                    );
                    const originalPrice = Number(
                      (service as any).originalPrice ??
                        ((service as any).discountedPrice
                          ? service.basePrice ?? (service as any).price
                          : 0)
                    );
                    const hasDiscount = originalPrice > displayPrice && displayPrice > 0;
                    const discountPercent = hasDiscount
                      ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
                      : 0;
                    const ratingValue = Number(
                      service.rating || service.averageRating || 4.8
                    ).toFixed(1);
                    const reviewCount = service.reviewCount || service.totalReviews;
                    const imageSrc =
                      service.imageURL ||
                      (service as any).imageUrl ||
                      (service as any).image ||
                      (Array.isArray(service.images) && service.images.length > 0
                        ? service.images[0]
                        : "");
                    const showImage = Boolean(
                      imageSrc && !failedServiceImages[service.id]
                    );

                    return (
                      <div
                        key={service.id}
                        onClick={() => onServiceSelect(service.id)}
                        className="min-w-[230px] sm:min-w-[255px] max-w-[255px] snap-start bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between shrink-0 group cursor-pointer"
                      >
                        <div>
                          <div
                            className={`relative w-full h-32 rounded-xl overflow-hidden ${tileStyle.bg} mb-2.5 border border-slate-100 flex items-center justify-center`}
                          >
                            {showImage ? (
                              <img
                                src={imageSrc}
                                alt={title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                onError={() => {
                                  setFailedServiceImages((prev) => ({
                                    ...prev,
                                    [service.id]: true,
                                  }));
                                }}
                              />
                            ) : (
                              <CategoryFallbackIcon
                                size={36}
                                className={`${tileStyle.text} opacity-80 group-hover:scale-110 transition-transform duration-300`}
                              />
                            )}
                            <div className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-xs">
                              <span>{ratingValue}★</span>
                              {reviewCount ? (
                                <span className="text-[9px] opacity-90">
                                  ({reviewCount})
                                </span>
                              ) : null}
                            </div>
                            {hasDiscount && discountPercent > 0 && (
                              <div className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shadow-xs">
                                {discountPercent}% OFF
                              </div>
                            )}
                            <div className="absolute bottom-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <ShieldCheck size={10} className="text-emerald-400" />
                              <span>30-Day Warranty</span>
                            </div>
                          </div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                            {title}
                          </h4>
                          {service.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                              {service.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-2.5 mt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm sm:text-base font-black text-slate-900">
                                ₹{displayPrice.toLocaleString("en-IN")}
                              </span>
                              {hasDiscount && (
                                <span className="text-[11px] text-slate-400 line-through font-semibold">
                                  ₹{originalPrice.toLocaleString("en-IN")}
                                </span>
                              )}
                            </div>
                            {hasDiscount && (
                              <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider block">
                                Save ₹{(originalPrice - displayPrice).toLocaleString("en-IN")}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (profile) {
                                setSelectedService(service);
                              } else {
                                onAuthRequired();
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                          >
                            Book
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        {/* Compact Urban Company Style Trust Section */}
        <section className="py-6 sm:py-8 px-4 max-w-5xl mx-auto">
          <div className="text-center">
            <span className="bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full inline-flex items-center gap-1">
              THE ZOMINDIA PROMISE
            </span>
            <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight mt-1.5 flex items-center justify-center gap-1.5">
              <span>Gold Standard Home Care</span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4 sm:mt-5">
            {/* Card 1 */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-blue-400 hover:bg-white transition-all shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5 shrink-0">
                <ShieldCheck size={17} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                  30-Day Guarantee
                </h4>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-1">
                  Free rework & ₹0 re-visit cover.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-blue-400 hover:bg-white transition-all shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5 shrink-0">
                <UserCheck size={17} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                  Verified Indore Pros
                </h4>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-1">
                  Background-checked specialists.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-blue-400 hover:bg-white transition-all shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2.5 shrink-0">
                <BadgePercent size={17} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                  Transparent Rates
                </h4>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-1">
                  Fixed pricing, ₹0 surge charge.
                </p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-blue-400 hover:bg-white transition-all shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2.5 shrink-0">
                <Zap size={17} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                  Instant Refund
                </h4>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-1">
                  100% money back before arrival.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-6 sm:py-8 px-4 max-w-5xl mx-auto">
          <div className="text-center">
            <span className="bg-slate-100 text-slate-700 text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full inline-flex items-center gap-1">
              HOW IT WORKS
            </span>
            <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight mt-1.5">
              Seamless Service in 4 Steps
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4 sm:mt-5">
            {/* Step 1 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
              <div>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black tracking-wider text-blue-600 bg-blue-50">
                  01
                </span>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-2">
                  Pick Service
                </h4>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 leading-tight">
                Fixed, transparent rates.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
              <div>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black tracking-wider text-indigo-600 bg-indigo-50">
                  02
                </span>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-2">
                  Choose Slot
                </h4>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 leading-tight">
                Instant or scheduled.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
              <div>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black tracking-wider text-amber-600 bg-amber-50">
                  03
                </span>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-2">
                  Doorstep OTP
                </h4>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 leading-tight">
                Safe verified arrival.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
              <div>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black tracking-wider text-emerald-600 bg-emerald-50">
                  04
                </span>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-2">
                  Relax & Pay
                </h4>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 leading-tight">
                Pay post service + cover.
              </p>
            </div>
          </div>
        </section>

        {/* Support Chat Banner */}
        <section className="max-w-5xl mx-auto px-4 py-4 sm:py-6">
          <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 rounded-3xl p-5 sm:p-6 text-center sm:text-left relative overflow-hidden border border-indigo-500/20 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ZOMINI AI • ALWAYS LIVE
              </span>
              <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight mt-2">
                Need Quick Help? Ask <span className="text-amber-400">ZOMINI</span>
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-lg leading-relaxed">
                Track active visits, reschedule slots, or ask for instant appliance repair estimates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-zomini'))}
              className="relative z-10 bg-white hover:bg-slate-100 text-slate-900 font-black text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer inline-flex items-center gap-2 shrink-0 group"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Chat with Zomini</span>
              <span className="group-hover:translate-x-1 transition-transform">➔</span>
            </button>
          </div>
        </section>

        {/* Force review feedback popup with skip option */}
        <AnimatePresence>
          {selectedService && (
            <BookingModal
              service={selectedService}
              profile={profile}
              onClose={() => setSelectedService(null)}
              onSuccess={(bookingId?: string) => {
                setSelectedService(null);
                if (bookingId) {
                  setActiveTab("bookings", bookingId);
                } else {
                  setActiveTab("bookings");
                }
              }}
            />
          )}
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

      {/* Sleek Floating Bottom Pill (Swiggy / Zomato Style) */}
      {hasActiveBooking && !isPillDismissed && activeBooking && (
        <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 mx-auto pointer-events-none">
          <div className="pointer-events-auto bg-white/80 backdrop-blur-xl border border-white/70 shadow-xl shadow-slate-900/10 rounded-2xl p-3 flex items-center justify-between gap-2.5 transition-all animate-in slide-in-from-bottom duration-300">
            {/* Left Section: Live Status & Partner Info */}
            <div
              onClick={() => setActiveTab("bookings", activeBooking.id)}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
            >
              <div className="relative w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <span className="text-base leading-none select-none">
                  {activeBooking.status === "on_the_way"
                    ? "🛵"
                    : activeBooking.status === "arrived"
                      ? "📍"
                      : activeBooking.status === "in_progress"
                        ? "🔧"
                        : "👨‍🔧"}
                </span>
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white" />
                </span>
              </div>

              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {activeBooking.status === "on_the_way"
                      ? "Partner on the way"
                      : activeBooking.status === "arrived"
                        ? "Partner at doorstep"
                        : activeBooking.status === "in_progress"
                          ? "Service in progress"
                          : "Partner assigned"}
                  </span>
                  {(activeBooking.serviceOtp || (activeBooking as any).startOtp || (activeBooking as any).otp) &&
                    activeBooking.status !== "in_progress" && (
                      <span className="shrink-0 bg-slate-100 border border-slate-200 text-slate-800 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-md">
                        OTP: {activeBooking.serviceOtp || (activeBooking as any).startOtp || (activeBooking as any).otp}
                      </span>
                    )}
                </div>
                <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                  {bookingPartner?.name || (activeBooking as any).partnerName || "Amit Singh"} •{" "}
                  {bookingService?.name || (activeBooking as any).serviceName || "RO Water Purifier Repair"}
                </p>
              </div>
            </div>

            {/* Right Section: Quick Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {(bookingPartner?.phone || (activeBooking as any).partnerPhone) && (
                <a
                  href={`tel:${bookingPartner?.phone || (activeBooking as any).partnerPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                  title="Call Partner"
                >
                  <PhoneCall size={14} />
                </a>
              )}
              <button
                type="button"
                onClick={() => setActiveTab("bookings", activeBooking.id)}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
              >
                <span>Track</span>
                <ArrowRight size={13} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPillDismissed(true);
                }}
                className="w-6 h-6 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer text-xs shrink-0 ml-1"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
      <ZomatoPageEndMarker pageName="Zomindia Home" isDark={false} />
      <PWAUpdateRegister />
    </div>
  );
}
