import { useState, useEffect, useMemo, useRef } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { CORPORATE_LANDLINE_GATEWAY } from "../lib/telephony";
import {
  Service,
  Review,
  FAQ,
  PartnerProfile,
  UserProfile,
  Category,
} from "../types";
import { handleMapsError } from "../lib/maps-errors";
import { motion, AnimatePresence } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import {
  Star,
  Clock,
  ChevronLeft,
  CheckCircle2,
  MessageCircle,
  HelpCircle,
  Users,
  ShieldCheck,
  Calendar,
  AlertCircle,
  FileText,
  MapPin,
  Phone,
  ChevronRight,
  ArrowRight,
  Share2,
  Sparkles,
  Sliders,
  Hourglass,
} from "lucide-react";
import BookingModal from "./BookingModal";
import PartnerIdentityMarker from "./PartnerIdentityMarker";
import { LoadingScreen } from "./LoadingIndicator";
import { Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import FAQList from "./FAQ";
import { getEstimatedDurationDetails } from "../lib/durationEstimator";

interface ServiceDetailsProps {
  serviceId: string;
  profile: UserProfile | null;
  onBack: () => void;
  onAuthRequired: () => void;
  onSuccess: () => void;
  onServiceSelect?: (id: string) => void;
}

interface PartnerWithUserInfo extends PartnerProfile {
  displayName: string;
  photoURL?: string;
  email: string;
  phoneNumber?: string;
}

export function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  if (!images || images.length === 0) return null;

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setIndex((prevIndex) => {
      let nextIndex = prevIndex + newDirection;
      if (nextIndex < 0) nextIndex = images.length - 1;
      if (nextIndex >= images.length) nextIndex = 0;
      return nextIndex;
    });
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  return (
    <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] md:h-[350px] rounded-[24px] md:rounded-[40px] overflow-hidden mb-6 shadow-md border-2 md:border-4 border-white group touch-none">
      <AnimatePresence initial={false} custom={direction}>
        <motion.img
          key={index}
          src={images[index]}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);

            if (swipe < -swipeConfidenceThreshold) {
              paginate(1);
            } else if (swipe > swipeConfidenceThreshold) {
              paginate(-1);
            }
          }}
          className="absolute inset-0 w-full h-full object-cover cursor-grab active:cursor-grabbing"
          referrerPolicy="no-referrer"
        />
      </AnimatePresence>

      {images.length > 1 && (
        <>
          <div className="absolute inset-0 flex items-center justify-between px-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => paginate(-1)}
              className="w-12 h-12 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-900 shadow-xl hover:bg-white active:scale-90 transition-all pointer-events-auto"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => paginate(1)}
              className="w-12 h-12 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-900 shadow-xl hover:bg-white active:scale-90 transition-all pointer-events-auto"
            >
              <ChevronRight size={24} />
            </button>
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setDirection(i > index ? 1 : -1);
                  setIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 pointer-events-auto ${i === index ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NearbyProsMap({ partners }: { partners: PartnerWithUserInfo[] }) {
  const availablePros = partners.filter(
    (p) =>
      (p.availabilityStatus === "Available" ||
        p.availabilityStatus === "Busy" ||
        p.availabilityStatus === "Offline") &&
      p.lat &&
      p.lng,
  );

  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 28.6139,
    lng: 77.209,
  }); // Default Delhi
  const [mapType, setMapType] = useState<"terrain" | "satellite">("terrain");

  useEffect(() => {
    if (availablePros.length > 0) {
      setCenter({ lat: availablePros[0].lat!, lng: availablePros[0].lng! });
    } else if (navigator.geolocation) {
      const successPos = (pos: GeolocationPosition) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      };
      const errorPos = (err: GeolocationPositionError) => {
        if (err.code !== 1) console.error("Geolocation error:", err);
      };

      navigator.geolocation.getCurrentPosition(successPos, errorPos, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    }
  }, [availablePros.length]);

  return (
    <div className="w-full h-80 rounded-[40px] overflow-hidden border border-slate-100 shadow-inner bg-slate-50 relative group">
      <Map
        defaultCenter={center}
        center={center}
        onCameraChanged={(e) => setCenter(e.detail.center)}
        defaultZoom={12}
        mapId="DEMO_MAP_ID"
        mapTypeId={mapType}
        className="w-full h-full"
        gestureHandling="greedy"
        disableDefaultUI
        internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
      >
        {availablePros.map((pro) => (
          <AdvancedMarker
            key={pro.id}
            position={{ lat: pro.lat!, lng: pro.lng! }}
          >
            <PartnerIdentityMarker
              status={
                pro.availabilityStatus === "Busy" ? "On Job" : "Available"
              }
              name={pro.displayName}
            />
          </AdvancedMarker>
        ))}
      </Map>
      <div className="absolute top-6 left-6 flex flex-col gap-2 z-10">
        <div className="bg-white/90 backdrop-blur shadow-xl border border-slate-100 p-4 rounded-3xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Live Professionals
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-slate-900">
              {availablePros.length} Active in Area
            </span>
          </div>
        </div>
      </div>

      {/* Floating Map View Controls */}
      <div className="absolute top-6 right-6 z-10 flex gap-2">
        <button
          type="button"
          onClick={() =>
            setMapType((prev) => (prev === "terrain" ? "satellite" : "terrain"))
          }
          className="bg-white/95 backdrop-blur shadow-lg border border-slate-200/80 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap select-none"
          title={`Switch map mode to ${mapType === "terrain" ? "Satellite" : "Terrain"}`}
        >
          {mapType === "terrain" ? "🛰️ Satellite view" : "🗺️ Terrain view"}
        </button>
      </div>
    </div>
  );
}

export default function ServiceDetails({
  serviceId,
  profile,
  onBack,
  onAuthRequired,
  onSuccess,
  onServiceSelect,
}: ServiceDetailsProps) {
  const [service, setService] = useState<Service | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [isDescOpen, setIsDescOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [carouselActiveCategoryId, setCarouselActiveCategoryId] = useState<
    string | null
  >(null);
  const [currentServiceId, setCurrentServiceId] = useState(serviceId);
  const carouselScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentServiceId(serviceId);
  }, [serviceId]);

  useEffect(() => {
    setIsDescOpen(false);
  }, [currentServiceId]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [partners, setPartners] = useState<PartnerWithUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState<
    "overview" | "experts" | "reviews"
  >("overview");
  const [durationScale, setDurationScale] = useState<'small' | 'medium' | 'large'>('medium');
  const [showPaymentQR, setShowPaymentQR] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState("");

  const durationDetails = useMemo(() => {
    if (!service) return null;
    return getEstimatedDurationDetails(
      service.name,
      category?.name || "General",
      service.duration,
      durationScale
    );
  }, [service, category, durationScale]);

  // Proximity-based dynamic sorting and coordinate states
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [typedAddress, setTypedAddress] = useState(profile?.address || "");
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [sortBy, setSortBy] = useState<"rating" | "distance">("rating");

  const haversineDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in km
  };

  const resolveAddressToCoords = async (addrStr: string) => {
    if (!addrStr || !addrStr.trim()) return;
    setIsResolvingAddress(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addrStr)}&limit=1`;
      const res = await fetch(url, {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "zomindia-app-preview",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]) {
          const resolved = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          };
          setSelectedLocation(resolved);
          setIsResolvingAddress(false);
          return;
        }
      }
    } catch (e) {
      console.warn("OSM geocoding failed, trying fallback:", e);
    }

    if (!selectedLocation) {
      setSelectedLocation({ lat: 28.6139, lng: 77.209 }); // Default Delhi
    }
    setIsResolvingAddress(false);
  };

  useEffect(() => {
    if (profile?.address) {
      resolveAddressToCoords(profile.address);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSelectedLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          setSelectedLocation({ lat: 28.6139, lng: 77.209 });
        },
      );
    } else {
      setSelectedLocation({ lat: 28.6139, lng: 77.209 });
    }
  }, [profile?.address]);

  const processedPartners = useMemo(() => {
    if (!partners || partners.length === 0) return [];

    const listWithDistance = partners.map((partner) => {
      let distance: number | null = null;
      if (partner.lat && partner.lng && selectedLocation) {
        distance = parseFloat(
          haversineDistance(
            selectedLocation.lat,
            selectedLocation.lng,
            partner.lat,
            partner.lng,
          ).toFixed(2),
        );
      }
      return {
        ...partner,
        distance,
      };
    });

    if (sortBy === "distance") {
      return [...listWithDistance].sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    } else {
      return [...listWithDistance].sort(
        (a, b) => (b.rating || 0) - (a.rating || 0),
      );
    }
  }, [partners, selectedLocation, sortBy]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch All Categories (needed for partner labels)
        const categoriesSnap = await getDocs(collection(db, "categories"));
        const categoriesList = categoriesSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Category,
        );
        setCategories(categoriesList);

        // Fetch All Services for the category carousel
        const servicesSnap = await getDocs(collection(db, "services"));
        const servicesList = servicesSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Service,
        );
        setAllServices(servicesList);

        // 2. Fetch Service
        const serviceSnap = await getDoc(doc(db, "services", currentServiceId));
        if (serviceSnap.exists()) {
          const serviceData = {
            id: serviceSnap.id,
            ...serviceSnap.data(),
          } as Service;
          setService(serviceData);

          // 3. Set Specific Category
          const foundCategory = categoriesList.find(
            (c) => c.id === serviceData.categoryId,
          );
          if (foundCategory) {
            setCategory(foundCategory);
            setCarouselActiveCategoryId(foundCategory.id);
          } else if (categoriesList.length > 0) {
            setCarouselActiveCategoryId(categoriesList[0].id);
          }

          // 4. Fetch FAQs for this category
          const faqQuery = query(
            collection(db, "faqs"),
            where("category", "==", serviceData.categoryId),
            where("isPublished", "==", true),
            limit(5),
          );
          const faqSnap = await getDocs(faqQuery);
          setFaqs(faqSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as FAQ));

          // 5. Fetch Partners for this category
          const partnerQuery = query(
            collection(db, "partners"),
            where("categories", "array-contains", serviceData.categoryId),
            where("status", "==", "active"),
            orderBy("rating", "desc"),
            limit(10),
          );
          const partnerSnap = await getDocs(partnerQuery);
          const partnerList = await Promise.all(
            partnerSnap.docs.map(async (d) => {
              const pData = d.data() as PartnerProfile;
              const uSnap = await getDoc(doc(db, "users", pData.userId));
              const uData = uSnap.data() as UserProfile;
              return {
                ...pData,
                id: d.id,
                displayName: uData?.displayName || "Service Pro",
                photoURL: uData?.photoURL,
                email: uData?.email,
                phoneNumber: uData?.phoneNumber,
              };
            }),
          );
          setPartners(partnerList);

          // 6. Fetch Reviews (Prioritize serviceId, filter by related partners if needed)
          const reviewQuery = query(
            collection(db, "reviews"),
            where("serviceId", "==", currentServiceId),
            orderBy("createdAt", "desc"),
            limit(10),
          );
          const reviewSnap = await getDocs(reviewQuery);
          let reviewList = reviewSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Review,
          );

          // If no service-specific reviews, fallback to partner reviews in that category
          if (reviewList.length === 0 && partnerList.length > 0) {
            const partnerIds = partnerList.map((p) => p.id);
            const fallbackQuery = query(
              collection(db, "reviews"),
              where("partnerId", "in", partnerIds.slice(0, 10)),
              orderBy("createdAt", "desc"),
              limit(10),
            );
            const fallbackSnap = await getDocs(fallbackQuery);
            reviewList = fallbackSnap.docs.map(
              (d) => ({ id: d.id, ...d.data() }) as Review,
            );
          }
          setReviews(reviewList);
        }
      } catch (err) {
        console.error("Error fetching service details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentServiceId]);

  if (loading) {
    return (
      <LoadingScreen message="Retrieving service specifications & ratings..." />
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <AlertCircle size={48} className="text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Service Not Found
        </h2>
        <p className="text-slate-500 mb-8 italic">
          The requested service might have been removed.
        </p>
        <button
          onClick={onBack}
          className="bg-blue-700 text-white px-8 py-3 rounded-xl font-bold"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const getScaleLabel = (scale: 'small' | 'medium' | 'large', categoryName: string) => {
    const cat = (categoryName || "").toLowerCase();
    if (cat.includes("cleaning") || cat.includes("painting")) {
      if (scale === 'small') return "1 BHK / Small Area";
      if (scale === 'medium') return "2 BHK (Standard)";
      return "3+ BHK (Premium)";
    }
    if (cat.includes("appliance") || cat.includes("repair") || cat.includes("phone")) {
      if (scale === 'small') return "Minor Fix / Quick Check";
      if (scale === 'medium') return "Standard Repair & Clean";
      return "Complex Overhaul";
    }
    if (cat.includes("beauty") || cat.includes("salon")) {
      if (scale === 'small') return "Express / Mini Session";
      if (scale === 'medium') return "Classic Package";
      return "Deluxe Treatment";
    }
    if (scale === 'small') return "Basic / Express";
    if (scale === 'medium') return "Standard Duration";
    return "Premium / Extended";
  };

  const serviceImages =
    service.images || (service.imageURL ? [service.imageURL] : []);

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header Sticky */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="sticky top-16 md:top-24 z-30 transition-all duration-300 px-0 sm:px-6 lg:px-8 sm:py-3"
      >
        <div className="bg-white/85 backdrop-blur-md border-b border-slate-100 sm:border sm:border-slate-100/85 sm:rounded-3xl sm:shadow-lg sm:shadow-slate-100/40 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-start transition-all duration-300">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-blue-700 font-black text-xs uppercase tracking-[0.18em] transition-all hover:-translate-x-1 py-1.5 cursor-pointer select-none"
          >
            <ChevronLeft size={15} className="stroke-[2.5]" /> Back to discover
          </button>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-4 md:pt-6 md:pb-4">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.12,
                delayChildren: 0.05,
              },
            },
          }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-16 items-start"
        >
          {/* Main Content */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: {
                opacity: 1,
                y: 0,
                transition: {
                  type: "spring",
                  stiffness: 70,
                  damping: 15,
                  duration: 0.6,
                },
              },
            }}
            className="lg:col-span-8 space-y-12 md:space-y-20"
          >
            {/* Hero Info */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start bg-white rounded-[32px] p-6 md:p-10 border border-slate-100 shadow-sm">
                {/* Left side: Title, Description, Pricing, Metadata */}
                <div className="lg:col-span-7 space-y-6 md:space-y-8">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-3 py-1.5 bg-blue-700 text-white rounded-full text-[9px] font-black uppercase tracking-[0.25em]">
                      {category?.name || "Expert Service"}
                    </span>
                    <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 uppercase tracking-widest">
                      <Clock size={12} className="text-slate-300" />{" "}
                      {service.duration || "60 mins"} session
                    </span>
                    <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-900 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-100 tracking-tighter italic">
                      <Star
                        size={12}
                        fill="currentColor"
                        className="text-amber-500"
                      />{" "}
                      {service.rating || 4.8} rating
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-8 border-b border-slate-100 pb-8 w-full">
                    {service.imageURL && (
                      <div className="w-full sm:w-80 h-40 sm:h-44 rounded-2xl overflow-hidden shadow-lg shrink-0 border-4 border-white ring-1 ring-slate-150 flex items-center justify-center bg-slate-50 transition-all duration-500 hover:scale-[1.02] hover:shadow-xl group">
                        <img
                          src={service.imageURL}
                          alt={service.name}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <h1 className="text-2xl sm:text-3.5xl md:text-4.5xl font-black text-slate-900 tracking-tight leading-tight uppercase font-display">
                        {service.name}
                      </h1>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <button
                      onClick={() =>
                        profile ? setIsBookingModalOpen(true) : onAuthRequired()
                      }
                      className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-700/15 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Calendar size={14} /> Book Service
                    </button>
                    <div className="flex items-center gap-5 px-5 py-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">
                          Price
                        </p>
                        <p className="text-sm font-black text-slate-920 tracking-tight">
                          ₹{service.basePrice}
                        </p>
                      </div>
                      <div className="w-px h-6 bg-slate-200" />
                      <div>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">
                          Time
                        </p>
                        <p className="text-sm font-black text-slate-920 tracking-tight">
                          {service.duration || "60m"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!isDescOpen ? (
                    <button
                      type="button"
                      onClick={() => setIsDescOpen(true)}
                      className="group w-full inline-flex items-center justify-between px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 hover:from-blue-700 hover:to-indigo-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-slate-950/10 hover:shadow-blue-700/20 active:scale-[0.99] transition-all duration-300 select-none cursor-pointer border border-slate-800 hover:border-blue-600"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="text-[14px] animate-pulse">💡</span>{" "}
                        Explore service description
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover:text-white transition-colors">
                        View Details ➔
                      </span>
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white border-2 border-indigo-150 rounded-3xl p-6 shadow-xl relative text-left overflow-hidden flex flex-col gap-4 w-full"
                    >
                      <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl opacity-70 pointer-events-none" />

                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-indigo-50 border border-indigo-100 text-indigo-750 rounded-lg">
                            <Sparkles size={14} />
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">
                            Service Overview
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDescOpen(false)}
                          className="p-1 text-slate-400 hover:text-slate-650 transition-colors"
                          title="Close details"
                        >
                          ✕
                        </button>
                      </div>

                      <p className="text-slate-800 text-base sm:text-lg font-bold leading-relaxed">
                        {service.description}
                      </p>

                      <button
                        type="button"
                        onClick={() => setIsDescOpen(false)}
                        className="self-end mt-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 select-none shadow-md shadow-slate-900/10"
                      >
                        Close Info ✕
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Right side: Imagecarousel */}
                <div className="lg:col-span-5 w-full lg:sticky lg:top-36">
                  {serviceImages.length > 0 && (
                    <div className="rounded-3xl overflow-hidden shadow-lg border border-slate-150">
                      <ImageCarousel images={serviceImages} />
                    </div>
                  )}
                </div>
              </div>
            </motion.section>

            {/* Interactive Tab Switcher */}
            <div className="flex border-b border-slate-200 gap-6 my-6 overflow-x-auto no-scrollbar">
              {[
                { id: "overview", label: "Service Info ℹ️" },
                { id: "experts", label: `Top Experts (${partners.length}) 👥` },
                {
                  id: "reviews",
                  label: `Reviews & FAQs (${reviews.length}) 💬`,
                },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveDetailsTab(t.id as any)}
                  className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeDetailsTab === t.id
                      ? "border-blue-700 text-blue-700 font-extrabold"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tap Contents */}
            {activeDetailsTab === "overview" && (
              <div className="space-y-6">
                {service.priceListPDF && (
                  <section className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden group shadow-lg">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 text-center sm:text-left">
                      <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
                        <FileText size={18} className="text-white/80" />
                        <h4 className="text-sm font-black text-white tracking-tight uppercase">
                          Rate Card List
                        </h4>
                      </div>
                      <p className="text-slate-200 text-xs font-medium leading-relaxed max-w-sm">
                        Complete transparency on spares and labor. Instantly
                        download or view our verified rate list specs.
                      </p>
                    </div>
                    <a
                      href={service.priceListPDF}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 bg-white text-slate-900 px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-slate-100 transition-all shadow-md flex items-center gap-1.5 whitespace-nowrap italic active:scale-95"
                    >
                      <FileText size={13} /> View Price Card
                    </a>
                  </section>
                )}

                {/* Dynamic Service Duration Estimator Card */}
                {durationDetails && (
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <span className="text-[9px] font-black uppercase text-blue-700 tracking-[0.2em] block mb-1">
                          ⏱️ Interactive Expectation Management
                        </span>
                        <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                          Smart Duration Estimator
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                          Calculated service timeframe based on your specific requirements.
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 rounded-2xl border border-slate-150/80 self-start sm:self-auto">
                        <Clock size={16} className="text-blue-700 animate-pulse" />
                        <div>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
                            Expected Time
                          </p>
                          <p className="text-xs font-black text-slate-900 leading-none">
                            ~{durationDetails.displayText}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Scale Slider / Tab Selector */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                          <Sliders size={12} /> Select Service Scope / Scale:
                        </label>
                        <span className="text-[9px] font-extrabold text-blue-700 bg-blue-50/50 px-2 py-0.5 rounded-lg border border-blue-100">
                          Interactive
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100/80 rounded-2xl border border-slate-150/50">
                        {(['small', 'medium', 'large'] as const).map((scale) => {
                          const isSelected = durationScale === scale;
                          return (
                            <button
                              key={scale}
                              type="button"
                              onClick={() => setDurationScale(scale)}
                              className={`py-2.5 px-2 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-center transition-all cursor-pointer select-none active:scale-95 flex flex-col items-center justify-center gap-0.5 ${
                                isSelected
                                  ? "bg-white text-blue-700 shadow-md border border-blue-100 font-extrabold"
                                  : "text-slate-400 hover:text-slate-650 hover:bg-white/50"
                              }`}
                            >
                              <span>{getScaleLabel(scale, category?.name || "")}</span>
                              <span className={`text-[8px] font-normal lowercase ${isSelected ? "text-blue-600 font-medium" : "text-slate-400"}`}>
                                {scale === 'small' ? '0.75x' : scale === 'medium' ? '1.0x' : '1.4x'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Proportional Stacked Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                        <span>Phase Breakdown Timeline</span>
                        <span className="text-slate-600 font-black italic">
                          Total: {durationDetails.totalMinutes} mins
                        </span>
                      </div>
                      <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200">
                        <div
                          style={{ width: `${(durationDetails.setupMinutes / durationDetails.totalMinutes) * 100}%` }}
                          className="h-full bg-indigo-500 hover:bg-indigo-600 transition-all duration-500 cursor-help"
                          title={`Setup phase: ${durationDetails.setupMinutes} mins`}
                        />
                        <div
                          style={{ width: `${(durationDetails.activeMinutes / durationDetails.totalMinutes) * 100}%` }}
                          className="h-full bg-blue-500 hover:bg-blue-600 transition-all duration-500 cursor-help"
                          title={`Core Active work: ${durationDetails.activeMinutes} mins`}
                        />
                        <div
                          style={{ width: `${(durationDetails.cleanupMinutes / durationDetails.totalMinutes) * 100}%` }}
                          className="h-full bg-emerald-500 hover:bg-emerald-600 transition-all duration-500 cursor-help"
                          title={`Testing & Cleanup phase: ${durationDetails.cleanupMinutes} mins`}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] font-extrabold text-slate-400 uppercase tracking-wider px-1">
                        <span className="text-indigo-600">● Setup ({durationDetails.setupMinutes}m)</span>
                        <span className="text-blue-600">● Core Job ({durationDetails.activeMinutes}m)</span>
                        <span className="text-emerald-600">● Wrap-up ({durationDetails.cleanupMinutes}m)</span>
                      </div>
                    </div>

                    {/* Step Timeline Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Setup Phase Card */}
                      <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-indigo-50/40 border border-indigo-100/50 hover:bg-indigo-50/70 transition-all duration-300">
                        <div className="flex items-center justify-between text-indigo-950 font-black text-[9px] uppercase tracking-wider">
                          <span className="flex items-center gap-1">🛠️ 1. Setup & Prep</span>
                          <span className="bg-indigo-100/60 text-indigo-700 px-1.5 py-0.5 rounded-lg text-[8px]">
                            {durationDetails.setupMinutes}m
                          </span>
                        </div>
                        <p className="text-[10px] text-indigo-900 font-semibold leading-relaxed">
                          {durationDetails.phases[0]?.description}
                        </p>
                      </div>

                      {/* Active Phase Card */}
                      <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-blue-50/40 border border-blue-100/50 hover:bg-blue-50/70 transition-all duration-300">
                        <div className="flex items-center justify-between text-blue-950 font-black text-[9px] uppercase tracking-wider">
                          <span className="flex items-center gap-1">⚡ 2. Core Execution</span>
                          <span className="bg-blue-100/60 text-blue-750 px-1.5 py-0.5 rounded-lg text-[8px]">
                            {durationDetails.activeMinutes}m
                          </span>
                        </div>
                        <p className="text-[10px] text-blue-900 font-semibold leading-relaxed">
                          {durationDetails.phases[1]?.description}
                        </p>
                      </div>

                      {/* Cleanup Phase Card */}
                      <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-100/50 hover:bg-emerald-50/70 transition-all duration-300">
                        <div className="flex items-center justify-between text-emerald-950 font-black text-[9px] uppercase tracking-wider">
                          <span className="flex items-center gap-1">✨ 3. Finalization</span>
                          <span className="bg-emerald-100/60 text-emerald-700 px-1.5 py-0.5 rounded-lg text-[8px]">
                            {durationDetails.cleanupMinutes}m
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-900 font-semibold leading-relaxed">
                          {durationDetails.phases[2]?.description}
                        </p>
                      </div>
                    </div>

                    {/* Factors and Expectations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Factors Affecting Duration:
                        </h4>
                        <ul className="space-y-1.5">
                          {durationDetails.affectingFactors.map((factor, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-[10px] text-slate-600 font-medium">
                              <span className="text-blue-600 text-xs mt-0.5">•</span>
                              <span>{factor}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-amber-50/40 rounded-2xl p-4 border border-amber-100/50 flex items-start gap-3">
                        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-[10px] font-black text-amber-800 uppercase tracking-wider mb-1">
                            Expectation Agreement
                          </h5>
                          <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                            {durationDetails.expectationNote}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-4 tracking-tight uppercase">
                    Service Highlights
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        icon: ShieldCheck,
                        title: "Zom-Shield Protection",
                        desc: "100% secure with verified partner insurance coverage up to ₹3,500.",
                        bg: "bg-emerald-500/10 text-emerald-800",
                      },
                      {
                        icon: Clock,
                        title: "On-Time Guarantee",
                        desc: "Partners arrive at scheduled slots with equipped kits or get ₹100 refund.",
                        bg: "bg-blue-500/10 text-blue-800",
                      },
                      {
                        icon: Star,
                        title: "High-Rated Professionals",
                        desc: "Only top 2% of experts with background verification handle your place.",
                        bg: "bg-amber-500/10 text-amber-800",
                      },
                      {
                        icon: AlertCircle,
                        title: "No Hidden Costs",
                        desc: "Upfront pricing transparently verified before starting real tasks.",
                        bg: "bg-rose-500/10 text-rose-800",
                      },
                    ].map((item, i) => {
                      const ItemIcon = item.icon;
                      return (
                        <div
                          key={i}
                          className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 hover:bg-white hover:border-slate-200 transition-all duration-300"
                        >
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}
                          >
                            <ItemIcon size={16} className="stroke-[2.5]" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-900 mb-0.5">
                              {item.title}
                            </h4>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeDetailsTab === "experts" && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="mb-4">
                    <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                      Active Service Experts
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      Verify live locations and credentials of
                      background-checked partners.
                    </p>
                  </div>

                  {/* Proximity Location / Sorting Header */}
                  <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-100/80 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="space-y-1.5 flex-1 max-w-lg">
                      <span className="text-[9px] font-black uppercase text-blue-700 tracking-[0.2em] block">
                        📌 Proximity Reference Location
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={typedAddress}
                          onChange={(e) => setTypedAddress(e.target.value)}
                          placeholder="Type address to see distances..."
                          className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => resolveAddressToCoords(typedAddress)}
                          disabled={isResolvingAddress}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all active:scale-95 whitespace-nowrap shadow-md shadow-blue-600/10 cursor-pointer select-none"
                        >
                          {isResolvingAddress ? "Solving..." : "Sort Live"}
                        </button>
                      </div>
                      {selectedLocation && (
                        <p className="text-[10px] text-slate-500 font-medium">
                          Active coordinates:{" "}
                          <span className="font-bold text-slate-700">
                            {selectedLocation.lat.toFixed(4)}°N,{" "}
                            {selectedLocation.lng.toFixed(4)}°E
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0 self-start md:self-auto">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] block">
                        Sort Professionals By
                      </span>
                      <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200/50">
                        <button
                          type="button"
                          onClick={() => setSortBy("rating")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none cursor-pointer ${
                            sortBy === "rating"
                              ? "bg-white text-slate-900 shadow-sm font-bold"
                              : "text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          Rating desc ★
                        </button>
                        <button
                          type="button"
                          onClick={() => setSortBy("distance")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none cursor-pointer ${
                            sortBy === "distance"
                              ? "bg-white text-slate-900 shadow-sm font-bold"
                              : "text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          Proximity 📍
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <NearbyProsMap partners={processedPartners} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {processedPartners.slice(0, 6).map((partner) => (
                      <div
                        key={partner.id}
                        className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col gap-4 group hover:bg-white hover:border-blue-700 transition-all duration-500 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#22c55e] shadow-md transform group-hover:rotate-3 transition-transform">
                                <img
                                  src={
                                    partner.photoURL ||
                                    "http://googleusercontent.com/image_collection/image_retrieval/16433425957912595047"
                                  }
                                  alt={partner.displayName}
                                  className="w-full h-full object-cover rounded-full"
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                />
                              </div>
                              <div
                                className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-white ${
                                  partner.availabilityStatus === "Available"
                                    ? "bg-emerald-500"
                                    : partner.availabilityStatus === "Busy"
                                      ? "bg-amber-500"
                                      : "bg-slate-300"
                                }`}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs font-black text-slate-900">
                                  {partner.displayName}
                                </h4>
                                <span
                                  className={`px-1 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-wider ${
                                    partner.availabilityStatus === "Available"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : partner.availabilityStatus === "Busy"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-slate-100 text-slate-400"
                                  }`}
                                >
                                  {partner.availabilityStatus || "Offline"}
                                </span>
                                {partner.distance !== undefined &&
                                  partner.distance !== null && (
                                    <span
                                      className="px-1.5 py-0.5 rounded-full text-[7px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-0.5"
                                      title={`Calculated from your sorting reference location`}
                                    >
                                      📍 {partner.distance} km
                                    </span>
                                  )}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 text-[9px] font-bold text-slate-500">
                                <Star
                                  size={9}
                                  fill="currentColor"
                                  className="text-amber-500"
                                />
                                <span className="text-slate-900">
                                  {partner.rating || "4.9"}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-[8px] text-emerald-600 font-extrabold uppercase">
                                  KYC Verified
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {partner.phoneNumber && (
                          <button
                            onClick={() => {
                              if (
                                typeof (window as any).__showToast ===
                                "function"
                              ) {
                                (window as any).__showToast(
                                  `Bridging secure masked call via Central Landline Gateway: ${CORPORATE_LANDLINE_GATEWAY}...`,
                                );
                              } else {
                                alert(
                                  `[Zomindia Telephony Bridge]\nConnecting you securely.\nCaller ID: ${CORPORATE_LANDLINE_GATEWAY}\nNo private phone numbers are exposed.`
                                );
                              }
                            }}
                            className="w-full py-2 bg-white border border-slate-200 rounded-lg text-[8px] font-black text-slate-950 uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-blue-700 hover:text-white transition-all shadow-sm cursor-pointer"
                          >
                            <Phone size={10} /> Contact Pro
                          </button>
                        )}
                      </div>
                    ))}
                    {processedPartners.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-100">
                        No matches found in this sector right now.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeDetailsTab === "reviews" && (
              <div className="space-y-6">
                {/* FAQs Accordion inside tab */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-4 tracking-tight uppercase flex items-center gap-2">
                    <HelpCircle size={15} className="text-blue-600" /> Insights
                    & FAQs
                  </h3>
                  <FAQList faqs={faqs} />
                </div>

                {/* Reviews List inside tab */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-4 tracking-tight uppercase flex items-center gap-2">
                    <CheckCircle2
                      size={15}
                      className="text-amber-500 fill-amber-500/10"
                    />{" "}
                    Real Experiences
                  </h3>

                  <div className="grid grid-cols-1 gap-4">
                    {reviews.map((review: any) => (
                      <div
                        key={review.id}
                        className="p-4 bg-slate-50 border border-slate-100/60 rounded-2xl shadow-sm relative group hover:border-amber-200 transition-all duration-300"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={10}
                                fill={
                                  i < review.rating ? "currentColor" : "none"
                                }
                                className={
                                  i < review.rating
                                    ? "text-amber-500"
                                    : "text-slate-250"
                                }
                              />
                            ))}
                          </div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            Verified Encounter
                          </span>
                        </div>

                        {review.photoURL && (
                          <div className="mb-2.5 rounded-xl overflow-hidden max-h-32 border border-slate-100 bg-slate-200">
                            <img
                              src={review.photoURL}
                              alt="Review attachment"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}

                        <p className="text-slate-900 font-semibold text-xs leading-relaxed mb-2.5">
                          "{review.comment}"
                        </p>

                        {review.partnerReply && (
                          <div className="mb-2.5 p-2.5 bg-white rounded-xl border border-slate-100">
                            <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                              Partner Response
                            </p>
                            <p className="text-xxs font-medium text-slate-700">
                              "{review.partnerReply}"
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                          <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[8px] font-black text-slate-400 border border-slate-100">
                            {review.customerId.slice(-2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-900 uppercase">
                              Au. User
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {reviews.length === 0 && (
                      <div className="py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-100">
                        Awaiting the first expert encounter.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Sidebar */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 40 },
              visible: {
                opacity: 1,
                y: 0,
                transition: {
                  type: "spring",
                  stiffness: 60,
                  damping: 14,
                  duration: 0.7,
                },
              },
            }}
            className="lg:col-span-4"
          >
            <div className="sticky top-40 space-y-8">
              {/* Booking Summary Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.4 }}
                className="bg-gradient-to-br from-blue-700 via-indigo-750 to-blue-900 rounded-[40px] p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden group border border-blue-600/50"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

                <div className="flex items-center justify-between mb-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200/90 flex items-center gap-1.5 leading-none">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />{" "}
                    Booking Summary
                  </p>
                </div>

                {/* High Conversion Banner */}
                <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-1 relative overflow-hidden">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-wider animate-pulse">
                    <Sparkles size={14} className="text-amber-400" /> High
                    Demand Spot
                  </div>
                  <p className="text-[11px] text-blue-100 font-bold leading-normal">
                    We are currently experiencing high demand in Indore's posh
                    areas like{" "}
                    <span className="text-amber-300 font-extrabold">
                      Vijay Nagar, Palasia, Nipania, Saket, and Mahalaxmi Nagar
                    </span>
                    . Lock in your booking now!
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center text-sm font-bold border-b border-white/5 pb-3">
                    <span className="text-blue-200 uppercase text-[10px] tracking-widest font-black">
                      Base Rate
                    </span>
                    <span className="font-display font-black text-lg">
                      ₹{service.basePrice}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold border-b border-white/5 pb-3">
                    <span className="text-blue-200 uppercase text-[10px] tracking-widest font-black">
                      Insurance (Zom-Shield)
                    </span>
                    <span className="text-emerald-400 text-xs font-black uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck size={13} /> FREE COVER
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold border-b border-white/5 pb-3">
                    <span className="text-blue-200 uppercase text-[10px] tracking-widest font-black">
                      Convenience Fee
                    </span>
                    <span className="text-emerald-400 text-xs font-black uppercase tracking-wider">
                      ₹0 (WAIVED)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold pt-1">
                    <span className="text-blue-200 uppercase text-[10px] tracking-widest font-black">
                      Estimated Taxes
                    </span>
                    <span className="text-white text-xs font-bold">
                      Inclusive
                    </span>
                  </div>
                  <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex justify-between items-center text-xl font-black mt-2">
                    <span className="text-emerald-300 uppercase text-[10px] tracking-[0.15em] font-black">
                      Total Price
                    </span>
                    <span className="font-display italic tracking-tight text-white">
                      ₹{service.basePrice}
                    </span>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 mb-8">
                  <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-4">
                    Immediate Privileges
                  </p>
                  <ul className="space-y-3.5">
                    {[
                      "100% Verified mastery & KYC cleared partner",
                      "30-day post-service quality warranty covered",
                      "24/7 Priority support with real-time tracking",
                      "Zero cancellation fee if cancelled 2 hours prior",
                    ].map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-[11px] font-bold text-slate-200 leading-snug"
                      >
                        <div className="p-0.5 bg-emerald-500/20 text-emerald-400 rounded-md shrink-0 mt-0.5">
                          <CheckCircle2
                            size={12}
                            fill="currentColor"
                            className="fill-emerald-500/10 text-emerald-400"
                          />
                        </div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() =>
                    profile ? setIsBookingModalOpen(true) : onAuthRequired()
                  }
                  className="w-full bg-white text-indigo-950 hover:bg-amber-300 hover:text-slate-955 py-5 rounded-2xl font-black text-center text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-black/20 border border-transparent hover:border-amber-400 cursor-pointer select-none group/btn flex items-center justify-center gap-2"
                >
                  Confirm Booking{" "}
                  <ArrowRight
                    size={14}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>

                <button
                  onClick={() => {
                    const text = `Hi! I am planning to book the *${service.name}* home service on Zomato Home Services. The base price is only *₹${service.basePrice}* with premium insurance completely covered. Let me know what you think!`;
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(text)}`,
                      "_blank",
                    );
                  }}
                  className="w-full mt-3 bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border border-white/10 flex items-center justify-center gap-2"
                >
                  <Share2 size={13} /> Share Booking Info
                </button>
              </motion.div>

              {/* Trust Indicators */}
              <div className="bg-white rounded-[40px] p-8 border border-slate-100 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-50 rounded-2xl text-slate-900">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm uppercase">
                      Zom-Shield.
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Premium cover active
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-50 rounded-2xl text-slate-900">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm uppercase">
                      Priority.
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Instant assignment
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Modern Categories & Services Carousel */}
        <div className="mt-8 border-t border-slate-100 pt-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 pb-4 border-b border-slate-50">
            <div>
              <span className="text-[10px] sm:text-xs font-black uppercase text-blue-700 tracking-[0.25em] mb-2 flex items-center gap-2">
                <Sparkles size={14} className="animate-pulse text-amber-500" />{" "}
                Discover Alternative Solutions
              </span>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase font-display">
                Browse Categories & Services
              </h3>
            </div>

            {/* Category Quick Filter Pills */}
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 shrink-0 max-w-full">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCarouselActiveCategoryId(cat.id)}
                  type="button"
                  className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all select-none cursor-pointer whitespace-nowrap active:scale-95 border ${
                    carouselActiveCategoryId === cat.id
                      ? "bg-blue-700 border-blue-700 text-white shadow-xl shadow-blue-700/15 font-bold"
                      : "bg-white border-slate-105 text-slate-400 hover:text-slate-950 hover:bg-slate-50"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="relative group/carousel">
            {/* Left Scroll Navigation Button */}
            <button
              onClick={() => {
                if (carouselScrollRef.current) {
                  carouselScrollRef.current.scrollBy({
                    left: -320,
                    behavior: "smooth",
                  });
                }
              }}
              type="button"
              className="absolute -left-4 top-[calc(50%-24px)] -translate-y-1/2 z-20 bg-white/95 backdrop-blur shadow-xl border border-slate-100 text-slate-800 hover:text-blue-700 hover:scale-110 active:scale-95 w-11 h-11 rounded-full items-center justify-center transition-all duration-300 cursor-pointer hidden md:flex opacity-0 group-hover/carousel:opacity-100 hover:bg-slate-50"
              title="Scroll alternative services left"
            >
              <ChevronLeft size={18} className="stroke-[2.5]" />
            </button>

            {/* Right Scroll Navigation Button */}
            <button
              onClick={() => {
                if (carouselScrollRef.current) {
                  carouselScrollRef.current.scrollBy({
                    left: 320,
                    behavior: "smooth",
                  });
                }
              }}
              type="button"
              className="absolute -right-4 top-[calc(50%-24px)] -translate-y-1/2 z-20 bg-white/95 backdrop-blur shadow-xl border border-slate-100 text-slate-800 hover:text-blue-700 hover:scale-110 active:scale-95 w-11 h-11 rounded-full items-center justify-center transition-all duration-300 cursor-pointer hidden md:flex opacity-0 group-hover/carousel:opacity-100 hover:bg-slate-50"
              title="Scroll alternative services right"
            >
              <ChevronRight size={18} className="stroke-[2.5]" />
            </button>

            <div
              ref={carouselScrollRef}
              className="flex gap-6 overflow-x-auto no-scrollbar pb-6 pt-2 scroll-smooth"
            >
              {allServices
                .filter(
                  (s) =>
                    s.categoryId === carouselActiveCategoryId &&
                    s.id !== currentServiceId,
                )
                .map((srv) => (
                  <div
                    key={srv.id}
                    onClick={() => {
                      setCurrentServiceId(srv.id);
                      if (onServiceSelect) onServiceSelect(srv.id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex-shrink-0 w-76 sm:w-80 group cursor-pointer"
                  >
                    <div className="bg-white border border-slate-105 rounded-[32px] p-5 hover:border-blue-700 hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300 flex flex-col gap-5 shadow-sm">
                      {/* Image container */}
                      <div className="w-full h-40 rounded-2xl overflow-hidden relative bg-slate-50 border border-slate-100 shrink-0">
                        {srv.imageURL ? (
                          <img
                            src={srv.imageURL}
                            alt={srv.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                            <span className="text-white/20 font-black text-3xl italic tracking-tighter uppercase">
                              {srv.name.slice(0, 2)}
                            </span>
                          </div>
                        )}
                        <span className="absolute top-3.5 right-3.5 px-3 py-1.5 bg-slate-950 text-white rounded-xl text-[9px] font-black italic tracking-widest uppercase">
                          ₹{srv.basePrice}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex flex-col justify-between flex-1 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-sm font-black text-slate-905 group-hover:text-blue-700 transition-colors uppercase tracking-tight line-clamp-1 font-display">
                            {srv.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 font-medium">
                            {srv.description}
                          </p>
                        </div>

                        <div className="w-full flex items-center justify-between border-t border-slate-105 pt-4 mt-1">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 leading-none">
                            ⏱️ {srv.duration || "60 mins"}
                          </span>
                          <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider flex items-center gap-1 group-hover:translate-x-1.5 transition-transform leading-none">
                            Book Service ➔
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

              {allServices.filter(
                (s) =>
                  s.categoryId === carouselActiveCategoryId &&
                  s.id !== currentServiceId,
              ).length === 0 && (
                <div className="w-full py-12 text-center text-slate-450 font-bold text-xs italic bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-105 flex flex-col items-center justify-center gap-2">
                  <span>
                    ✨ Exploring more services inside{" "}
                    {categories.find((c) => c.id === carouselActiveCategoryId)
                      ?.name || "this category"}
                    ...
                  </span>
                  <p className="text-[10px] text-slate-400 not-italic font-medium">
                    No alternative options are live right now.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isBookingModalOpen && (
        <BookingModal
          service={service}
          profile={profile}
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={() => {
            setIsBookingModalOpen(false);
            onSuccess();
          }}
        />
      )}
    </div>
  );
}
