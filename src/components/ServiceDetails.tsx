import React, { useState, useEffect, useRef, useMemo } from "react";
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
  UserCheck,
  Zap,
  ChevronUp,
  ChevronDown,
  X,
  BadgePercent,
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
      x: direction > 0 ? 600 : -600,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 600 : -600,
      opacity: 0,
    }),
  };

  return (
    <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] md:h-[360px] rounded-3xl overflow-hidden shadow-lg border border-slate-200/90 bg-slate-100 group select-none touch-none">
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
            opacity: { duration: 0.25 },
          }}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </AnimatePresence>

      {images.length > 1 && (
        <>
          <div className="absolute inset-0 flex items-center justify-between px-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => paginate(-1)}
              className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-slate-800 shadow-lg hover:bg-white active:scale-90 transition-all cursor-pointer"
              aria-label="Previous image"
            >
              <ChevronLeft size={20} className="stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => paginate(1)}
              className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-slate-800 shadow-lg hover:bg-white active:scale-90 transition-all cursor-pointer"
              aria-label="Next image"
            >
              <ChevronRight size={20} className="stroke-[2.5]" />
            </button>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setDirection(i > index ? 1 : -1);
                  setIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
                aria-label={`Go to image ${i + 1}`}
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
  const [isMobileBillOpen, setIsMobileBillOpen] = useState(false);
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
          className="bg-blue-700 text-white px-8 py-3 rounded-xl font-bold cursor-pointer"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const serviceImages =
    service.images && service.images.length > 0
      ? service.images
      : service.imageURL
        ? [service.imageURL]
        : [];

  const originalMrp =
    (service as any).originalPrice ||
    (service as any).mrp ||
    Math.round(service.basePrice * 1.3);
  const savingAmount = Math.max(0, originalMrp - service.basePrice);
  const discountPercent =
    originalMrp > 0
      ? Math.max(12, Math.round((savingAmount / originalMrp) * 100))
      : 23;
  const ratingValue = Number(service.rating || 4.8).toFixed(1);

  const checklistItems: string[] =
    service.checklist && service.checklist.length > 0
      ? service.checklist
      : service.predefinedTasks && service.predefinedTasks.length > 0
        ? service.predefinedTasks
        : service.features && service.features.length > 0
          ? service.features
          : [
              "Complete diagnosis & operational error check",
              "Deep clean, component inspection & filter wash",
              "Post-service performance & cooling/function test",
              "Transparent digital invoice with warranty card",
            ];

  const handleStartBooking = () => {
    if (profile) {
      setIsBookingModalOpen(true);
    } else {
      onAuthRequired();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24 lg:pb-12 text-slate-900">
      {/* Header Sticky Navigation */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="sticky top-16 md:top-24 z-30 px-3 sm:px-6 lg:px-8 py-2.5"
      >
        <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-sm max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-slate-600 hover:text-blue-700 font-extrabold text-xs uppercase tracking-wider transition-all hover:-translate-x-1 py-1 cursor-pointer select-none"
          >
            <ChevronLeft size={16} className="stroke-[3]" />
            <span>Back to services</span>
          </button>

          <button
            onClick={() => {
              const shareUrl = window.location.href;
              const text = `Hi! Check out this *${service.name}* home service on Zomato Home Services for only *₹${service.basePrice}* with free warranty & Zom-Shield insurance: ${shareUrl}`;
              if (navigator.share) {
                navigator.share({
                  title: service.name,
                  text,
                  url: shareUrl,
                }).catch(() => {});
              } else {
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(text)}`,
                  "_blank"
                );
              }
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            title="Share service"
          >
            <Share2 size={13} />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Main Left Content Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. HERO MEDIA & FLOATING BADGES */}
            <motion.section
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-sm"
            >
              {/* Media Container with Zoom & Floating Glassmorphic Badges */}
              <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] md:h-[370px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-inner border border-slate-200/80 bg-slate-100 group mb-5">
                {serviceImages.length > 1 ? (
                  <ImageCarousel images={serviceImages} />
                ) : (
                  <img
                    src={
                      service.imageURL ||
                      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=800"
                    }
                    alt={service.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                )}

                {/* Floating Glassmorphic Pills (Top Left & Top Right) */}
                <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                  {/* Zomato-Style Emerald Rating Pill */}
                  <div className="bg-emerald-600/95 backdrop-blur-md text-white font-black text-xs px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-md border border-white/20 select-none">
                    <Star size={12} className="fill-white text-white shrink-0" />
                    <span>{ratingValue}</span>
                  </div>

                  {/* Category Badge Pill */}
                  <div className="bg-indigo-50/95 backdrop-blur-md text-indigo-700 ring-1 ring-indigo-200/80 font-bold text-[11px] px-2.5 py-1 rounded-xl shadow-xs select-none">
                    {category?.name || "Home Service"}
                  </div>
                </div>

                {/* Session Duration Pill (Top Right) */}
                <div className="absolute top-3 right-3 z-10 bg-slate-900/80 backdrop-blur-md text-white font-bold text-[11px] px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-xs select-none">
                  <Clock size={11} className="text-amber-400 shrink-0" />
                  <span>{service.duration || "45-60 mins"}</span>
                </div>
              </div>

              {/* Service Title & Dynamic Price Badge */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h1 className="text-2xl sm:text-3.5xl font-black text-slate-900 tracking-tight leading-tight">
                    {service.name}
                  </h1>
                </div>

                {/* Dynamic Price Highlight with Strikethrough & Savings Pill */}
                <div className="flex flex-wrap items-center gap-3 pt-1 pb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      STARTS AT
                    </span>
                    <span className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight">
                      ₹{service.basePrice}
                    </span>
                    {savingAmount > 0 && (
                      <span className="text-base sm:text-lg text-slate-400 line-through font-bold">
                        ₹{originalMrp}
                      </span>
                    )}
                  </div>

                  {savingAmount > 0 && (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
                      <BadgePercent size={13} className="stroke-[2.5]" />
                      <span>Save ₹{savingAmount} ({discountPercent}% OFF)</span>
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
                  {service.description}
                </p>

                {/* Desktop Quick Action */}
                <div className="hidden lg:flex items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={handleStartBooking}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm py-3 px-6 rounded-xl shadow-md hover:shadow-blue-500/25 active:scale-95 transition-all duration-200 flex items-center gap-2 cursor-pointer"
                  >
                    <Calendar size={15} />
                    <span>Book Service Now</span>
                    <ArrowRight size={14} className="stroke-[3]" />
                  </button>

                  <div className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 font-semibold">
                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                    <span>Free 30-Day Re-service Guarantee</span>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* 2. INTERACTIVE CHECKLIST & TRUST TILES */}
            <section className="space-y-5">
              {/* WHAT'S INCLUDED: Modern List with Emerald Checkmark Discs & Hover Lift */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg ring-1 ring-emerald-200/60">
                      <CheckCircle2 size={16} className="stroke-[2.5]" />
                    </span>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wider">
                      What's Included
                    </h2>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/70">
                    Verified Checklist
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {checklistItems.map((item, i) => (
                    <div
                      key={i}
                      className="group/item flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default"
                    >
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 ring-2 ring-emerald-500/20 flex items-center justify-center shrink-0 group-hover/item:scale-110 transition-transform">
                        <Check size={14} className="stroke-[3]" />
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust Badges (3-Column Micro-Cards with Soft Gradients & Glow) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* 30-Day Quality Warranty */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/90 to-indigo-50/40 border border-blue-100/90 shadow-xs flex items-center gap-3.5 hover:shadow-md hover:border-blue-300 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/25 group-hover:scale-105 transition-transform">
                    <ShieldCheck size={20} className="stroke-[2.3]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 leading-snug">
                      30-Day Quality Warranty
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                      Free rework if issue persists
                    </p>
                  </div>
                </div>

                {/* On-Time Doorstep Service */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 to-yellow-50/40 border border-amber-100/90 shadow-xs flex items-center gap-3.5 hover:shadow-md hover:border-amber-300 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/25 group-hover:scale-105 transition-transform">
                    <Clock size={20} className="stroke-[2.3]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 leading-snug">
                      On-Time Doorstep Service
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                      Punctual pros with toolkits
                    </p>
                  </div>
                </div>

                {/* 100% Verified Technicians */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-teal-50/40 border border-emerald-100/90 shadow-xs flex items-center gap-3.5 hover:shadow-md hover:border-emerald-300 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/25 group-hover:scale-105 transition-transform">
                    <UserCheck size={20} className="stroke-[2.3]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 leading-snug">
                      100% Verified Experts
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                      Police & background certified
                    </p>
                  </div>
                </div>
              </div>

              {/* Transparent Pricing Notice */}
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 sm:p-4.5 flex items-start gap-3 shadow-xs">
                <div className="p-1.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                  <Info size={16} className="stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider mb-0.5">
                    Clear & Transparent Spares Policy
                  </h4>
                  <p className="text-xs font-medium text-amber-900/90 leading-relaxed">
                    Spare parts and consumable fluids cost extra if required. The technician will provide an upfront digital rate-card estimate before beginning any replacement.
                  </p>
                </div>
              </div>

              {/* Rate Card Attachment if present */}
              {service.priceListPDF && (
                <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-white shadow-md">
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <FileText size={18} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider">
                        Official Rate Card PDF
                      </h4>
                      <p className="text-[11px] text-blue-100 font-medium">
                        Complete transparency on spare parts & standard labor charges.
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
            </section>
          </div>

          {/* 3. ZOMATO-STYLE BILL SUMMARY & GOLD SHIELD (Desktop Sticky Sidebar) */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28 space-y-4">
              {/* Receipt Style Bill Card */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-lg space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    Bill Summary
                  </p>
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70">
                    Guaranteed Pricing
                  </span>
                </div>

                {/* Urgent High Demand Mini-Banner */}
                <div className="p-3 bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border border-amber-200/90 rounded-2xl flex items-start gap-2.5 shadow-2xs">
                  <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-amber-900 uppercase tracking-wider">
                      High Demand in Indore
                    </p>
                    <p className="text-[11px] text-amber-800 font-medium leading-tight mt-0.5">
                      Slots filling rapidly in{" "}
                      <span className="font-bold underline decoration-amber-400">
                        {randomizedAreas.slice(0, 2).join(", ")}
                      </span>
                      .
                    </p>
                  </div>
                </div>

                {/* Clean Receipt Line Items */}
                <div className="space-y-2.5 text-xs font-bold text-slate-700 pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Service Base Rate</span>
                    <span className="text-slate-900 font-black">₹{originalMrp}</span>
                  </div>

                  {savingAmount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 font-extrabold">
                      <span className="flex items-center gap-1">
                        <span>Instant Discount</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-black">
                          {discountPercent}% OFF
                        </span>
                      </span>
                      <span>-₹{savingAmount}</span>
                    </div>
                  )}

                  {/* ZOM-SHIELD Luxury Gold Gradient Pill */}
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <span className="text-slate-600 font-bold">Insurance</span>
                      <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-xs tracking-wider">
                        <Sparkles size={10} className="fill-slate-950" />
                        ZOM-SHIELD
                      </span>
                    </span>
                    <span className="text-emerald-600 font-extrabold">FREE ₹0</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Convenience & Booking Fee</span>
                    <span className="text-emerald-600 font-extrabold">WAIVED ₹0</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Taxes & Safety Kit</span>
                    <span className="text-slate-900 font-semibold">Included</span>
                  </div>
                </div>

                {/* Dashed Receipt Divider */}
                <div className="border-t-2 border-dashed border-slate-200 my-2" />

                {/* Bold Final Total */}
                <div className="flex justify-between items-baseline pt-0.5">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      To Pay
                    </span>
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      ₹{service.basePrice}
                    </span>
                  </div>
                  {savingAmount > 0 && (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/60">
                      You Save ₹{savingAmount}
                    </span>
                  )}
                </div>

                {/* Privileges Checklist */}
                <div className="p-3 bg-slate-50 rounded-2xl space-y-1.5 text-[11px] font-semibold text-slate-600 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>30-Day post-service guarantee</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Zero charges if canceled 2 hrs prior</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Live location tracking of technician</span>
                  </div>
                </div>

                {/* Desktop Book Button */}
                <button
                  type="button"
                  onClick={handleStartBooking}
                  className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-xs uppercase tracking-wider py-3.5 px-6 rounded-2xl shadow-lg hover:shadow-blue-500/25 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                  <span>Confirm Booking</span>
                  <ArrowRight size={14} className="stroke-[3]" />
                </button>
              </div>

              {/* Quick Trust Badges */}
              <div className="bg-white rounded-3xl p-4.5 border border-slate-200/90 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
                    <ShieldCheck size={18} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 leading-tight">
                      Zomindia Shield Protection
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Up to ₹10,000 damage cover active
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                    <Zap size={18} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 leading-tight">
                      Priority Dispatch
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Average pro arrives within 60 mins
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. ALTERNATIVE SERVICES CAROUSEL */}
        <div className="mt-8 border-t border-slate-200/90 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4 pb-2 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-500" />
                Explore Other Services
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Recommended in Indore
              </h3>
            </div>

            {/* Category Quick Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 shrink-0 max-w-full scroll-smooth">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCarouselActiveCategoryId(cat.id)}
                  type="button"
                  className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold tracking-wider transition-all select-none cursor-pointer whitespace-nowrap active:scale-95 border ${
                    carouselActiveCategoryId === cat.id
                      ? "bg-blue-700 border-blue-700 text-white shadow-xs font-black"
                      : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="relative group/carousel">
            {/* Scroll Navigation Buttons */}
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
              className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 bg-white shadow-md border border-slate-200 text-slate-800 hover:text-blue-700 hover:scale-110 active:scale-95 w-10 h-10 rounded-full items-center justify-center transition-all cursor-pointer hidden md:flex opacity-0 group-hover/carousel:opacity-100"
              aria-label="Scroll left"
            >
              <ChevronLeft size={18} className="stroke-[3]" />
            </button>

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
              className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 bg-white shadow-md border border-slate-200 text-slate-800 hover:text-blue-700 hover:scale-110 active:scale-95 w-10 h-10 rounded-full items-center justify-center transition-all cursor-pointer hidden md:flex opacity-0 group-hover/carousel:opacity-100"
              aria-label="Scroll right"
            >
              <ChevronRight size={18} className="stroke-[3]" />
            </button>

            <div
              ref={carouselScrollRef}
              className="flex gap-4 overflow-x-auto no-scrollbar pb-3 pt-1 scroll-smooth"
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
                    className="flex-shrink-0 w-64 sm:w-72 group cursor-pointer"
                  >
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-3 hover:border-blue-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between gap-2.5 shadow-xs">
                      {/* Thumbnail */}
                      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden relative bg-slate-100 shrink-0">
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
                        <div className="absolute top-2 left-2 bg-emerald-600 text-white font-bold text-xs px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                          <Star size={10} className="fill-white text-white shrink-0" />
                          <span>{Number(srv.rating || 4.8).toFixed(1)}</span>
                        </div>
                      </div>

                      {/* Info */}
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {srv.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-medium">
                          {srv.description}
                        </p>
                      </div>

                      {/* Price & Action */}
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-auto">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase block leading-tight">
                            STARTS AT
                          </span>
                          <span className="text-sm font-black text-emerald-600">
                            ₹{srv.basePrice}
                          </span>
                        </div>
                        <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs py-1 px-3 rounded-lg shadow-sm group-hover:shadow-blue-500/25 transition-all">
                          Book
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

              {allServices.filter(
                (s) =>
                  s.categoryId === carouselActiveCategoryId &&
                  s.id !== currentServiceId,
              ).length === 0 && (
                <div className="w-full py-10 text-center text-slate-500 font-medium text-xs bg-white rounded-2xl border border-dashed border-slate-200">
                  No other active services in this category currently.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. STICKY BOTTOM CHECKOUT DOCK (Mobile & Small Screens) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden backdrop-blur-md bg-white/95 border-t border-slate-200 p-3 shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          {/* Left: Total & View Bill Trigger */}
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                ₹{service.basePrice}
              </span>
              {savingAmount > 0 && (
                <span className="text-xs text-slate-400 line-through font-bold">
                  ₹{originalMrp}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsMobileBillOpen(!isMobileBillOpen)}
              className="text-[10px] font-black text-blue-700 hover:text-blue-800 uppercase tracking-wider flex items-center gap-0.5 cursor-pointer select-none"
            >
              <span>VIEW BILL</span>
              {isMobileBillOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
          </div>

          {/* Right: CONFIRM BOOKING Pill Button with Scale-Bounce */}
          <button
            type="button"
            onClick={handleStartBooking}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm py-3 px-5 sm:px-6 rounded-2xl shadow-lg hover:shadow-blue-500/25 active:scale-95 transition-all duration-200 flex items-center gap-1.5 cursor-pointer shrink-0 select-none"
          >
            <span>CONFIRM BOOKING</span>
            <ArrowRight size={14} className="stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Mobile Expandable Bill Details Sheet */}
      <AnimatePresence>
        {isMobileBillOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileBillOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="relative bg-white rounded-t-3xl border-t border-slate-200 p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Bill Breakdown
                </h3>
                <button
                  type="button"
                  onClick={() => setIsMobileBillOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2.5 text-xs font-bold text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Service Base MRP</span>
                  <span className="text-slate-900 font-black">₹{originalMrp}</span>
                </div>
                {savingAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-extrabold">
                    <span>Instant Discount ({discountPercent}% OFF)</span>
                    <span>-₹{savingAmount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <span>Insurance Cover</span>
                    <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full">
                      ZOM-SHIELD
                    </span>
                  </span>
                  <span className="text-emerald-600 font-extrabold">FREE ₹0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Convenience & Safety Fee</span>
                  <span className="text-emerald-600 font-extrabold">WAIVED ₹0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxes</span>
                  <span className="text-slate-900">Included</span>
                </div>
              </div>

              <div className="border-t-2 border-dashed border-slate-200 pt-3 flex justify-between items-baseline">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    Total Payable
                  </span>
                  <span className="text-2xl font-black text-slate-900">
                    ₹{service.basePrice}
                  </span>
                </div>
                {savingAmount > 0 && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                    You Save ₹{savingAmount}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMobileBillOpen(false);
                  handleStartBooking();
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm py-3.5 rounded-2xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>Proceed to Book</span>
                <ArrowRight size={14} className="stroke-[3]" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking Modal */}
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
