import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Service,
  UserProfile,
  Category,
} from "../types";
import { motion, AnimatePresence } from "motion/react";
import {
  Star,
  Clock,
  ChevronLeft,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  AlertCircle,
  FileText,
  ChevronRight,
  ArrowRight,
  Share2,
  Sparkles,
  Info,
  Wrench,
  Check,
} from "lucide-react";
import BookingModal from "./BookingModal";
import { LoadingScreen } from "./LoadingIndicator";
import { getSampledIndoreHighDemandAreas } from "../utils/indoreDemandAreas";
import { isValidCustomerService } from "../utils/formatters";

interface ServiceDetailsProps {
  serviceId: string;
  profile: UserProfile | null;
  onBack: () => void;
  onAuthRequired: () => void;
  onSuccess: () => void;
  onServiceSelect?: (id: string) => void;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [carouselActiveCategoryId, setCarouselActiveCategoryId] = useState<
    string | null
  >(null);
  const [currentServiceId, setCurrentServiceId] = useState(serviceId);
  const [loading, setLoading] = useState(true);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const carouselScrollRef = useRef<HTMLDivElement>(null);

  // Dynamic Posh Areas Rotation with Smart Local Area Inclusion
  const randomizedAreas = useMemo(() => {
    return getSampledIndoreHighDemandAreas(profile);
  }, [profile]);

  useEffect(() => {
    setCurrentServiceId(serviceId);
  }, [serviceId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch All Categories
        const categoriesSnap = await getDocs(collection(db, "categories"));
        const categoriesList = categoriesSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Category,
        );
        setCategories(categoriesList);

        // 2. Fetch All Services for the category carousel
        const servicesSnap = await getDocs(collection(db, "services"));
        const servicesList = servicesSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Service)
          .filter(isValidCustomerService);
        setAllServices(servicesList);

        // 3. Fetch Service
        const serviceSnap = await getDoc(doc(db, "services", currentServiceId));
        if (serviceSnap.exists()) {
          const serviceData = {
            id: serviceSnap.id,
            ...serviceSnap.data(),
          } as Service;
          setService(serviceData);

          // 4. Set Specific Category
          const foundCategory = categoriesList.find(
            (c) => c.id === serviceData.categoryId,
          );
          if (foundCategory) {
            setCategory(foundCategory);
            setCarouselActiveCategoryId(foundCategory.id);
          } else if (categoriesList.length > 0) {
            setCarouselActiveCategoryId(categoriesList[0].id);
          }
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

  const serviceImages =
    service.images || (service.imageURL ? [service.imageURL] : []);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-4 md:pb-6">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 md:pt-6 md:pb-3">
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
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start"
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
            className="lg:col-span-8 space-y-4 md:space-y-6"
          >
            {/* Hero Info */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start bg-white rounded-3xl p-5 md:p-7 border border-slate-100 shadow-sm">
                {/* Left side: Title, Description, Pricing, Metadata */}
                <div className="lg:col-span-7 space-y-4">
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

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-slate-100 pb-4 w-full">
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

                  {/* Clean Service Description */}
                  <div className="pt-2">
                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
                      {service.description}
                    </p>
                  </div>
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

            {/* Admin-Driven Service Checklist */}
            {(() => {
              const checklistItems: string[] =
                service.checklist && service.checklist.length > 0
                  ? service.checklist
                  : service.predefinedTasks && service.predefinedTasks.length > 0
                    ? service.predefinedTasks
                    : service.features && service.features.length > 0
                      ? service.features
                      : [
                          "Complete diagnosis & error check",
                          "Deep cleaning and filter wash",
                          "Post-service operational testing",
                        ];

              return (
                <div className="space-y-5 my-6">
                  {/* What's Included (✓) */}
                  <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                          <CheckCircle2 size={16} className="stroke-[2.5]" />
                        </span>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                          What's Included (✓)
                        </h3>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                        Verified Checklist
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 pt-1">
                      {checklistItems.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100/80 hover:bg-slate-50 transition-colors"
                        >
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Check size={12} className="stroke-[3]" />
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                            {item}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Zomindia Promise (3 Clean Badges) - Placed directly below the checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-3.5 hover:border-blue-200 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
                        <ShieldCheck size={20} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 leading-snug">
                          🛡️ 30-Day Quality Warranty
                        </h4>
                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                          Free rework if issue persists
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-3.5 hover:border-blue-200 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                        <Clock size={20} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 leading-snug">
                          ⏱️ On-Time Doorstep Service
                        </h4>
                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                          Punctual pros with toolkits
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-3.5 hover:border-blue-200 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                        <Wrench size={20} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 leading-snug">
                          👨‍🔧 100% Verified Technicians
                        </h4>
                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                          Police & background verified
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Please Note (ℹ️) */}
                  <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4.5 sm:p-5 flex items-start gap-3.5 shadow-xs">
                    <div className="p-1.5 bg-amber-100/90 text-amber-700 rounded-xl shrink-0 mt-0.5">
                      <Info size={18} className="stroke-[2.5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        Please Note (ℹ️)
                      </h4>
                      <p className="text-xs font-semibold text-amber-900/90 leading-relaxed">
                        Spare parts & gas refilling cost extra if required (transparent quotation before repair).
                      </p>
                    </div>
                  </div>

                  {/* Rate Card List if available */}
                  {service.priceListPDF && (
                    <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-white shadow-md">
                      <div className="flex items-center gap-3 text-center sm:text-left">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                          <FileText size={18} className="text-white" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider">
                            Rate Card List
                          </h4>
                          <p className="text-[11px] text-blue-100 font-medium">
                            Complete transparency on spares & labor charges.
                          </p>
                        </div>
                      </div>
                      <a
                        href={service.priceListPDF}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-100 transition-all shrink-0 active:scale-95 shadow-xs"
                      >
                        View Price Card ➔
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}
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
            <div className="sticky top-28 space-y-4">
              {/* Booking Summary Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.4 }}
                className="bg-gradient-to-br from-blue-700 via-indigo-750 to-blue-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden group border border-blue-600/50"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200/90 flex items-center gap-1.5 leading-none">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />{" "}
                    Booking Summary
                  </p>
                </div>

                {/* High Conversion Banner */}
                <div className="mb-4 p-3.5 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-1 relative overflow-hidden">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-wider animate-pulse">
                    <Sparkles size={14} className="text-amber-400" /> High
                    Demand Spot
                  </div>
                  <p className="text-[11px] text-blue-100 font-bold leading-normal">
                    We are currently experiencing high demand in Indore's posh
                    areas like{" "}
                    <span className="text-amber-300 font-extrabold">
                      {randomizedAreas.join(", ")}
                    </span>
                    . Lock in your booking now!
                  </p>
                </div>

                <div className="space-y-2.5 mb-4">
                  <div className="flex justify-between items-center text-sm font-bold border-b border-white/5 pb-2.5">
                    <span className="text-blue-200 uppercase text-[10px] tracking-widest font-black">
                      Base Rate
                    </span>
                    <span className="font-display font-black text-lg">
                      ₹{service.basePrice}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold border-b border-white/5 pb-2.5">
                    <span className="text-blue-200 uppercase text-[10px] tracking-widest font-black">
                      Insurance (Zom-Shield)
                    </span>
                    <span className="text-emerald-400 text-xs font-black uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck size={13} /> FREE COVER
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold border-b border-white/5 pb-2.5">
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
                  <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex justify-between items-center text-xl font-black mt-2">
                    <span className="text-emerald-300 uppercase text-[10px] tracking-[0.15em] font-black">
                      Total Price
                    </span>
                    <span className="font-display italic tracking-tight text-white">
                      ₹{service.basePrice}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 mb-4">
                  <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-3">
                    Immediate Privileges
                  </p>
                  <ul className="space-y-2.5">
                    {[
                      "100% Verified mastery & KYC cleared partner",
                      "30-day post-service quality warranty covered",
                      "24/7 Priority support with real-time tracking",
                      "Zero cancellation fee if cancelled 2 hours prior",
                    ].map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-[11px] font-bold text-slate-200 leading-snug"
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
                  className="w-full bg-white text-indigo-950 hover:bg-amber-300 hover:text-slate-955 py-3.5 rounded-xl font-black text-center text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-black/20 border border-transparent hover:border-amber-400 cursor-pointer select-none group/btn flex items-center justify-center gap-2"
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
                  className="w-full mt-2.5 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border border-white/10 flex items-center justify-center gap-2"
                >
                  <Share2 size={13} /> Share Booking Info
                </button>
              </motion.div>

              {/* Trust Indicators */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-slate-50 rounded-xl text-slate-900">
                    <ShieldCheck size={22} />
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
                  <div className="p-2.5 bg-slate-50 rounded-xl text-slate-900">
                    <Clock size={22} />
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
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-3 pb-3 border-b border-slate-50">
            <div>
              <span className="text-[10px] font-black uppercase text-blue-700 tracking-[0.2em] mb-1 flex items-center gap-1.5">
                <Sparkles size={12} className="animate-pulse text-amber-500" />{" "}
                Discover Alternative Solutions
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase font-display">
                Browse Categories & Services
              </h3>
            </div>

            {/* Category Quick Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 shrink-0 max-w-full scroll-smooth">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCarouselActiveCategoryId(cat.id)}
                  type="button"
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all select-none cursor-pointer whitespace-nowrap active:scale-95 border ${
                    carouselActiveCategoryId === cat.id
                      ? "bg-blue-700 border-blue-700 text-white shadow-md shadow-blue-700/15 font-bold"
                      : "bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
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
              className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar pb-3 pt-2 scroll-smooth"
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
                    className="flex-shrink-0 w-68 sm:w-72 group cursor-pointer"
                  >
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 hover:border-blue-600 hover:shadow-lg transition-all duration-200 flex flex-col justify-between gap-3 shadow-xs">
                      {/* Top: Image & Price badge */}
                      <div className="w-full h-32 rounded-xl overflow-hidden relative bg-slate-50 border border-slate-100 shrink-0">
                        {srv.imageURL ? (
                          <img
                            src={srv.imageURL}
                            alt={srv.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm">
                            {srv.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 bg-slate-900/90 text-white rounded-lg text-[10px] font-extrabold shadow-sm">
                          ₹{srv.basePrice}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex flex-col justify-between flex-1 gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1">
                            {srv.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                              ★ {srv.rating || 4.8}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              • {srv.duration || "45-60m"}
                            </span>
                          </div>
                        </div>

                        <div className="w-full flex items-center justify-between border-t border-slate-100 pt-2.5">
                          <span className="text-[10px] font-semibold text-slate-400">
                            Starting price
                          </span>
                          <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            View ➔
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

        {/* Sleek Centered 'End of List' Notice */}
        <div className="flex items-center justify-center gap-3 my-4 sm:my-5 px-4">
          <div className="h-px bg-slate-200/80 flex-1 max-w-[80px] sm:max-w-[140px]" />
          <span className="text-xs text-slate-400 font-medium tracking-wide text-center flex items-center gap-2 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
            You have reached the end of {category?.name || service.name} services
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
          </span>
          <div className="h-px bg-slate-200/80 flex-1 max-w-[80px] sm:max-w-[140px]" />
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
