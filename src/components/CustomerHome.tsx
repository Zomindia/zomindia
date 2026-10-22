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
  or,
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
import { useHeroCanvasConfig } from "../utils/heroCanvasConfig";
import PaymentModal from "./PaymentModal";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { fuzzyMatch } from "../utils/search";
import { formatTime12Hour, isValidCustomerService } from "../utils/formatters";
import ZomatoPageEndMarker from "./ZomatoPageEndMarker";
import { motion, AnimatePresence } from "motion/react";
import PWAUpdateRegister from "./PWAUpdateRegister";
import BookingModal from "./BookingModal";
import { ImageCarousel } from "./ServiceDetails";
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
  Clock,
  ShieldCheck,
  UserCheck,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  MessageCircle,
  Zap,
  Copy,
  Check,
  Plus,
  Scissors,
  Tv,
  Brush,
  Hammer,
  RotateCcw,
  PhoneCall,
  Droplets,
  MapPin,
} from "lucide-react";
import Avatar from "./Avatar";

interface Props {
  setActiveTab: (tab: any, arg?: any) => void;
  profile: UserProfile | null;
  onAuthRequired: () => void;
  onServiceSelect: (id: string) => void;
  initialCategoryId?: string | null;
  onOpenProfileMenu?: () => void;
  onOpenCitySelector?: () => void;
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
    return "Fridge";
  }
  if (lower.includes("washing")) {
    return "Washing Machine";
  }
  if (lower.includes("purifier") || lower.includes("ro ")) {
    return "RO Purifier";
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
    .replace(/Repair\s*&\s*Service/gi, "")
    .replace(/Repair\s*and\s*Service/gi, "")
    .replace(/Services?/gi, "")
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

export const getCategoryBadge = (cat: any): { text: string; className: string } | null => {
  if (!cat) return null;
  const explicitBadge = String(cat.badge || cat.tag || "").trim().toUpperCase();
  const name = String(cat.name || "").toLowerCase().trim();

  if (explicitBadge.includes("TREND") || explicitBadge.includes("POPULAR")) {
    return {
      text: "TRENDING 🔥",
      className: "bg-orange-50 text-orange-600 border border-orange-200/60 text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-tight shadow-2xs whitespace-nowrap",
    };
  }
  if (explicitBadge.includes("INSTANT") || explicitBadge.includes("FAST") || explicitBadge.includes("QUICK")) {
    return {
      text: "INSTANT ⚡",
      className: "bg-emerald-50 text-emerald-600 border border-emerald-200/60 text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-tight shadow-2xs whitespace-nowrap",
    };
  }

  // Demand-based assignment:
  if (name.includes("ac") || name.includes("air conditioner") || name.includes("cooling")) {
    return {
      text: "TRENDING 🔥",
      className: "bg-orange-50 text-orange-600 border border-orange-200/60 text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-tight shadow-2xs whitespace-nowrap",
    };
  }
  if (name.includes("electric") || name.includes("plumb") || name.includes("emergency") || name.includes("repair")) {
    return {
      text: "INSTANT ⚡",
      className: "bg-emerald-50 text-emerald-600 border border-emerald-200/60 text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-tight shadow-2xs whitespace-nowrap",
    };
  }

  return null;
};

const getCategoryIcon = (iconName: string): any => {
  if (!iconName) return Sparkles;
  return resolveCategoryIcon(iconName);
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

export const getCategoryType = (
  categoryName: string,
): "Home" | "Appliances" | "Repairs" => {
  const name = (categoryName || "").toLowerCase().trim();
  if (
    name.includes("ac") ||
    name.includes("air conditioner") ||
    name.includes("purifier") ||
    name.includes("ro ") ||
    name.includes("refrigerat") ||
    name.includes("fridge") ||
    name.includes("washing") ||
    name.includes("laundry") ||
    name.includes("tv") ||
    name.includes("television") ||
    name.includes("microwave") ||
    name.includes("oven") ||
    name.includes("geyser") ||
    name.includes("heater") ||
    name.includes("chimney") ||
    name.includes("appliance")
  ) {
    return "Appliances";
  }
  if (
    name.includes("repair") ||
    name.includes("electric") ||
    name.includes("plumb") ||
    name.includes("wiring") ||
    name.includes("switch") ||
    name.includes("pipe") ||
    name.includes("leak") ||
    name.includes("phone") ||
    name.includes("mobile") ||
    name.includes("device") ||
    name.includes("carpenter") ||
    name.includes("pest") ||
    name.includes("wrench") ||
    name.includes("drill")
  ) {
    return "Repairs";
  }
  return "Home";
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
  onOpenProfileMenu,
  onOpenCitySelector,
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
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentOfferIndex((prev) => (prev + 1) % CONSOLIDATED_OFFERS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

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
  const { heroBg } = useHeroCanvasConfig();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryTypeTab, setCategoryTypeTab] = useState<
    "All" | "Home" | "Appliances" | "Repairs"
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
  const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [zomatoActiveBooking, setZomatoActiveBooking] = useState<Booking | null>(null);
  const [zomatoBookingDismissedId, setZomatoBookingDismissedId] = useState<string | null>(null);
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
      setTickerDismissed(true);
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
      setTickerDismissed(true);
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
      setTickerDismissed(true);
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
      formatTime12Hour(bookingDate)
    );
  }, [activeBooking]);

  useEffect(() => {
    if (!profile?.uid) {
      setActiveBooking(null);
      setZomatoActiveBooking(null);
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
      const allowedStatuses = [
        "pending",
        "pending_acceptance",
        "confirmed",
        "assigned",
        "on_the_way",
        "arrived",
        "in_progress",
        "payment_pending",
        "pending_parts",
      ];
      const allDocs = Array.from(bookingsMap.values());
      allDocs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      // 1. Active banner booking
      const activeBannerList = allDocs.filter((b) => allowedStatuses.includes(b.status || ""));
      if (activeBannerList.length > 0) {
        const booking = activeBannerList[0];
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

      // 2. Zomato active overlay card
      const activeOverlay = allDocs.find((b) => {
        const s = (b.status || "").toLowerCase();
        return s !== "completed" && s !== "cancelled" && s !== "finalized" && s !== "closed";
      });
      setZomatoActiveBooking(activeOverlay || null);
    };

    // Primary query: customerUid (canonical standard)
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

    // Resilient Fallback query: legacy customerId
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

  const getZomatoStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Booking Received";
      case "pending_acceptance":
        return "Assigning Expert Partner";
      case "confirmed":
      case "assigned":
        return "Partner is assigned";
      case "on_the_way":
        return "Partner is arriving";
      case "arrived":
        return "Partner has arrived";
      case "in_progress":
        return "Service in progress";
      case "payment_pending":
        return "Payment pending";
      case "pending_parts":
        return "Awaiting parts";
      default:
        return status.replace("_", " ");
    }
  };

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
          .map((d) => ({ id: d.id, ...d.data() }) as Service)
          .filter(isValidCustomerService);
        setAllServices(validServices);
      },
      (err) => {
        if (!isMounted) return;
        console.error("Error subscribing to services:", err);
      },
    );
    return () => {
      isMounted = false;
      if (typeof unsubscribeServices === "function") unsubscribeServices();
    };
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

  const mostRecentService = (() => {
    const valid = (allServices || []).filter(isValidCustomerService);
    if (valid.length === 0) return null;
    return [...valid].sort((a, b) => {
      const timeA = a.createdAt?.seconds || a.createdAt?._seconds || 0;
      const timeB = b.createdAt?.seconds || b.createdAt?._seconds || 0;
      return timeB - timeA;
    })[0];
  })();

  const recentServiceCategory =
    mostRecentService && allCategories.length > 0
      ? allCategories.find((c) => c.id === mostRecentService.categoryId)
      : null;

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
              onSuccess={() => setActiveTab("home")}
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
      {/* Unified Top-to-Bottom Hero Canvas */}
      <section className="relative overflow-hidden rounded-b-[2.5rem] px-4 pt-3 pb-8 shadow-2xl transition-all mb-6">
        {/* Layer 1: Background Media */}
        {heroBg.bgType !== "gradient" && heroBg.bgUrl && (
          <img
            src={heroBg.bgUrl}
            alt="Hero BG"
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            loading="eager"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        )}

        {/* Dark Gradient Overlay - Disabled when overlayOpacity is 0 for 100% media visibility */}
        {heroBg.bgType === "gradient" ||
        (heroBg.bgUrl && (heroBg.overlayOpacity ?? 85) > 0) ? (
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#071435]/92 via-[#0f2868]/88 to-[#09173e]/96 pointer-events-none transition-opacity duration-150"
            style={{
              opacity:
                heroBg.bgType !== "gradient" && heroBg.bgUrl
                  ? (heroBg.overlayOpacity ?? 85) / 100
                  : 1,
            }}
          />
        ) : null}

        {/* Layer 2: Content Layer */}
        <div className="relative z-10 text-white w-full max-w-5xl mx-auto">
          {/* Top Header Bar */}
          <div className="flex items-center justify-between gap-3 pt-1 pb-3">
            {/* White horizontal logo */}
            <div
              onClick={() => {
                if (setActiveTab) setActiveTab("home");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex items-center cursor-pointer select-none shrink-0 group"
            >
              <img
                src="/logo-horizontal-white.png"
                alt="Zomindia"
                className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
              />
            </div>

            {/* Location Dropdown: Scheme 54, Vijay Nagar, Indore ▾ */}
            <button
              type="button"
              onClick={() => {
                if (onOpenCitySelector) onOpenCitySelector();
                else if (onOpenProfileMenu) onOpenProfileMenu();
              }}
              className="flex items-center gap-1.5 text-blue-100 hover:text-white font-medium text-xs sm:text-sm cursor-pointer transition-colors max-w-[210px] sm:max-w-xs truncate select-none bg-transparent border-0 p-0"
              title="Scheme 54, Vijay Nagar, Indore - Click to change"
            >
              <MapPin size={15} className="text-yellow-400 shrink-0" />
              <span className="truncate">Scheme 54, Vijay Nagar, Indore ▾</span>
            </button>

            {/* Login / Profile button on top-right */}
            <div className="flex items-center gap-2 shrink-0">
              {profile ? (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenProfileMenu) onOpenProfileMenu();
                    else if (setActiveTab) setActiveTab("profile");
                  }}
                  className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity cursor-pointer"
                  title="Open Profile"
                >
                  <Avatar
                    photoURL={profile?.photoURL}
                    displayName={profile?.displayName || profile?.fullName}
                    email={profile?.email}
                    sizeClass="w-8 h-8 sm:w-9 sm:h-9 border border-white/30"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (onAuthRequired) onAuthRequired();
                  }}
                  className="border border-white/20 text-white hover:bg-white/10 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  Login
                </button>
              )}
            </div>
          </div>

          {/* Floating Search Bar */}
          <div className="w-full relative mb-4">
            <div
              className="relative flex items-center h-12 bg-white text-slate-800 rounded-2xl shadow-lg border-0 px-4 py-2 mt-4 focus-within:ring-2 focus-within:ring-blue-400/30"
              onTouchStartCapture={(e) => e.stopPropagation()}
              onMouseDownCapture={(e) => e.stopPropagation()}
            >
            <div className="text-slate-400 flex items-center shrink-0 mr-2.5">
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
                className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all active:scale-90 cursor-pointer"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}

            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Search Results Dropdown - High Elevation */}
          <AnimatePresence>
            {searchQuery.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,46,110,0.3)] border border-slate-200/90 overflow-hidden z-[80] text-left text-slate-800"
              >
                {filteredSearchResults.length > 0 ? (
                  <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 p-2 overscroll-contain">
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

        {/* Active Ongoing Booking Bar (Slim Minimal Pill, shown only when an active booking exists) */}
        {activeBooking && !recentCardDismissed && (
          <div className="w-full max-w-5xl mx-auto mb-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md text-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    Active Booking: {activeBooking.serviceName || "Appliance Service"}
                  </p>
                  <p className="text-[11px] text-blue-200 font-medium truncate">
                    Technician assigned • Tap to track live
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("bookings", activeBooking.id)}
                className="px-3.5 py-1.5 rounded-xl bg-white text-blue-950 font-bold text-xs shrink-0 cursor-pointer shadow-sm hover:bg-blue-50 transition-colors"
              >
                Track
              </button>
            </div>
          </div>
        )}

        {/* Explore Services & Filter Pills */}
        <div className="w-full relative z-20 mt-6" id="categories-grid">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 mb-2.5 pb-2 border-b border-white/10 relative z-10">
            <div>
              <h3 className="text-white font-bold tracking-tight text-lg">
                Explore Services ⚡
              </h3>
            </div>
          </div>

          {/* Category Tabs: ALL, HOME, APPLIANCES, REPAIRS */}
          <div className="mb-3.5 pb-0.5 relative z-10">
            <div className="overflow-x-auto no-scrollbar whitespace-nowrap flex gap-2 py-1 w-full">
              {(["All", "Home", "Appliances", "Repairs"] as const).map(
                (tab) => {
                  const isActive = categoryTypeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setCategoryTypeTab(tab)}
                      className={`px-3.5 sm:px-4 py-1.5 rounded-xl text-[11px] sm:text-xs select-none cursor-pointer tracking-wider uppercase transition-all whitespace-nowrap active:scale-95 duration-200 ${
                        isActive
                          ? "bg-white text-blue-950 font-bold shadow-sm"
                          : "bg-white/10 text-blue-100 hover:bg-white/20 border border-white/15 backdrop-blur-xs font-medium"
                      }`}
                    >
                      {tab}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Service Categories Grid: grid-cols-3 gap-2 sm:gap-2.5 */}
          {loading && categories.length === 0 ? (
            <SkeletonCategoryGrid count={14} />
          ) : (
            <motion.div
              layout
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-2.5 items-stretch relative z-10 min-h-[110px]"
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
                    const badge = getCategoryBadge(cat);
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
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        viewport={{ once: true }}
                        transition={{
                          type: "spring",
                          stiffness: 320,
                          damping: 26,
                          layout: { duration: 0.25 },
                        }}
                        whileHover={{ 
                          y: -2,
                          transition: { type: "spring", stiffness: 400, damping: 15 }
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          setSelectedCategory(cat);
                          e.currentTarget.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                        className="group relative flex flex-col items-center justify-between bg-white border border-slate-150/80 rounded-2xl p-2 sm:p-2.5 shadow-md hover:shadow-lg active:scale-95 transition-all w-full cursor-pointer focus:outline-none min-h-[105px] sm:min-h-[115px] text-center"
                      >
                        {/* Micro Badge Slot */}
                        <div className="w-full flex justify-end h-4 mb-0.5 pointer-events-none">
                          {badge && (
                            <span className={badge.className}>
                              {badge.text}
                            </span>
                          )}
                        </div>

                        {/* Icon / Image Slot */}
                        <div
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 overflow-hidden my-1"
                        >
                          {hasValidIconURL ? (
                            <img
                              src={cat.iconURL}
                              alt={cat.name}
                              width={36}
                              height={36}
                              className="w-6 h-6 sm:w-7 sm:h-7 object-contain transition-transform duration-200 group-hover:scale-110"
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
                              size={20}
                              className="sm:size-[22px] stroke-[1.8] text-slate-400 transition-transform duration-200 group-hover:scale-110"
                            />
                          )}
                        </div>

                        {/* Category Title: Clean Modern Slate, text-[11px] sm:text-xs leading-tight line-clamp-2 max-w-[90%] */}
                        <span className="text-slate-800 font-semibold text-[11px] sm:text-xs text-center leading-tight line-clamp-2 max-w-[90%] select-none group-hover:text-blue-700 transition-colors">
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
                return true;
              }).length === 0 && (
                <div className="col-span-full py-8 text-center w-full bg-white/5 rounded-2xl border border-dashed border-white/20 p-4 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">
                    No Services Found
                  </span>
                  <p className="text-xs text-blue-100 mt-1">
                    Try selecting another category tab above.
                  </p>
                </div>
              )}

              <motion.button
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ 
                  y: -2,
                  transition: { type: "spring", stiffness: 400, damping: 15 }
                }}
                whileTap={{ scale: 0.95 }}
                className="group relative flex flex-col items-center justify-between bg-white border border-slate-150/80 rounded-2xl p-2 sm:p-2.5 shadow-md hover:shadow-lg active:scale-95 transition-all w-full cursor-pointer focus:outline-none min-h-[105px] sm:min-h-[115px] text-center"
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
                <div className="w-full h-4 mb-0.5" />
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 overflow-hidden my-1">
                  <div className="flex gap-1 items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-200 group-hover:scale-125 group-hover:bg-slate-700" />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-200 group-hover:scale-125 group-hover:bg-slate-700" />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-200 group-hover:scale-125 group-hover:bg-slate-700" />
                  </div>
                </div>
                <span className="text-slate-800 font-semibold text-[11px] sm:text-xs text-center leading-tight line-clamp-2 max-w-[90%] select-none group-hover:text-blue-700 transition-colors">
                  More
                </span>
              </motion.button>
            </motion.div>
          )}
        </div>
        </div>
      </section>

      {/* Sticky Top Bar on scroll */}
      {isScrolled && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 w-full bg-blue-950/95 backdrop-blur-md px-4 py-2.5 shadow-md border-b border-blue-900/50 transition-all"
          style={{
            WebkitBackdropFilter: "blur(12px)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="w-full max-w-5xl mx-auto relative flex items-center gap-2.5">
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
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain shrink-0"
              />
            </button>

            <div className="relative flex-1 min-w-0">
              <div 
                className="relative flex items-center h-10 bg-white rounded-xl shadow-md border-0 px-3"
                onTouchStartCapture={(e) => e.stopPropagation()} 
                onMouseDownCapture={(e) => e.stopPropagation()}
              >
                <div className="text-slate-400 flex items-center shrink-0 mr-2">
                  <Search size={16} className="stroke-[2.2]" />
                </div>
                <input
                  type="text"
                  inputMode="text"
                  enterKeyHint="search"
                  placeholder={currentPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full py-1.5 bg-transparent focus:outline-none text-slate-800 font-bold text-xs sm:text-sm placeholder:text-slate-400 placeholder:font-medium min-w-0 ${searchQuery.trim().length > 0 ? "pr-18" : "pr-8"}`}
                />
                {searchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all active:scale-90 cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white h-8 w-8 rounded-lg flex items-center justify-center transition-all shadow-xs cursor-pointer"
                  aria-label="Search"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pt-1 pb-4 sm:pt-2 sm:pb-6 relative z-20"
      >

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
            {allServices.length === 0 ? (
              <SkeletonServiceCardGrid count={4} />
            ) : (
              allServices
                .filter((s) => s.rating && s.rating >= 4.5)
                .slice(0, 4)
                .map((service, idx) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    categoryName={allCategories.find((c) => c.id === service.categoryId)?.name}
                    onSelect={onServiceSelect}
                    idx={idx}
                  />
                ))
            )}
          </div>
        </section>

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
                    whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.2 } }}
                    whileTap={{ scale: 0.99 }}
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
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:brightness-105 active:scale-[0.98] transition-all duration-200 shrink-0 font-sans cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span>Instant Booking</span>
                            <span>⚡</span>
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
                <span className="text-amber-300 drop-shadow-sm font-black">ZOMINI</span>
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

      <AnimatePresence>
        {zomatoActiveBooking && (zomatoBookingDismissedId !== zomatoActiveBooking.id) && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed top-24 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md bg-[#0a2540]/95 backdrop-blur-md text-white py-2 px-3.5 rounded-full shadow-xl border border-white/10 z-[110000] overflow-hidden flex items-center justify-between gap-3"
            id="zomato-active-booking-overlay"
          >
            {/* Pulse glow background */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent pointer-events-none animate-pulse" />
            
            <div className="relative z-10 flex items-center gap-2.5 flex-1 min-w-0">
              <div className="bg-emerald-500/15 p-1.5 rounded-full text-emerald-400 shrink-0 border border-emerald-500/20">
                <Zap className="w-3.5 h-3.5 animate-bounce" />
              </div>
              <div className="text-left font-sans min-w-0 flex-1">
                <h4 className="text-[11px] font-extrabold tracking-tight text-white line-clamp-1 leading-normal">
                  {allServices.find((s) => s.id === zomatoActiveBooking?.serviceId)?.name || (zomatoActiveBooking as any)?.serviceName || "Service Booking"}
                </h4>
                <p className="text-[10px] font-bold text-[#22c55e] uppercase tracking-wider flex items-center gap-1.5 leading-none mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-ping shrink-0" />
                  {getZomatoStatusText(zomatoActiveBooking.status)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab("bookings", zomatoActiveBooking.id)}
                className="bg-[#22c55e] hover:bg-[#1eb050] text-[#0a2540] text-[10px] font-black py-1.5 px-3 rounded-full transition duration-150 flex items-center gap-1 shadow-md cursor-pointer uppercase tracking-wider border-0"
              >
                Track
                <ArrowRight className="w-3 h-3" />
              </button>
              
              <button
                onClick={() => setZomatoBookingDismissedId(zomatoActiveBooking.id)}
                className="w-6 h-6 rounded-full border border-white/10 hover:border-white/25 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title="Dismiss"
              >
                <X size={11} className="stroke-[2.5]" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ZomatoPageEndMarker pageName="Zomindia Home" isDark={false} />
      <PWAUpdateRegister />
    </div>
  );
}
