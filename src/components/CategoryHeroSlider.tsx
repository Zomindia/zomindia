import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Category, Service, Booking, Banner, BannerTargetType } from '../types';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CategoryHeroSliderProps {
  categories: Category[];
  services?: Service[];
  onSelectCategory?: (category: Category) => void;
  onSelectService?: (serviceId: string) => void;
  onNavigateOffers?: () => void;
  activeBooking?: Booking | null;
  onTrackBooking?: () => void;
}

export const isVideoMedia = (url?: string, mediaType?: string): boolean => {
  if (mediaType === 'video') return true;
  if (!url) return false;
  const cleanUrl = url.toLowerCase().split('?')[0];
  return (
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.webm') ||
    cleanUrl.endsWith('.ogg') ||
    cleanUrl.endsWith('.mov') ||
    url.toLowerCase().includes('.mp4') ||
    url.toLowerCase().includes('.webm') ||
    url.toLowerCase().includes('/video/upload/') ||
    (url.toLowerCase().includes('firebasestorage.googleapis.com') && url.toLowerCase().includes('.mp4'))
  );
};

// Curated high-resolution designer banner images for popular categories
const CATEGORY_DEFAULT_BANNERS: Record<string, string> = {
  ac: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80',
  ro: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=1200&q=80',
  fridge: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=1200&q=80',
  washing: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=80',
  tv: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=1200&q=80',
};

const getFallbackBanner = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('ac') || lower.includes('air')) return CATEGORY_DEFAULT_BANNERS.ac;
  if (lower.includes('ro') || lower.includes('water') || lower.includes('purif')) return CATEGORY_DEFAULT_BANNERS.ro;
  if (lower.includes('fridge') || lower.includes('refrigerat')) return CATEGORY_DEFAULT_BANNERS.fridge;
  if (lower.includes('wash') || lower.includes('laundry')) return CATEGORY_DEFAULT_BANNERS.washing;
  if (lower.includes('tv') || lower.includes('televis')) return CATEGORY_DEFAULT_BANNERS.tv;
  return CATEGORY_DEFAULT_BANNERS.ac;
};

interface SlideItem {
  id: string;
  category?: Category;
  mediaURL: string;
  isVideo: boolean;
  title: string;
  subtitle?: string;
  badge?: string;
  promoCode?: string;
  targetType: BannerTargetType;
  categoryId?: string;
  serviceId?: string;
}

const DEFAULT_PROMO_CARDS: SlideItem[] = [
  {
    id: 'promo-ac',
    category: { id: 'ac', name: 'AC Service & Repair', icon: 'Wind' },
    mediaURL: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80',
    isVideo: false,
    title: 'AC Jet Service & Repair',
    subtitle: 'Deep anti-bacterial foam cleaning • 45 min doorstep',
    badge: 'SUMMER SPECIAL • 20% OFF',
    promoCode: 'SUMMER20',
    targetType: 'category',
    categoryId: 'ac',
  },
  {
    id: 'promo-washing',
    category: { id: 'washing', name: 'Washing Machine Repair', icon: 'RotateCcw' },
    mediaURL: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=80',
    isVideo: false,
    title: 'Washing Machine Checkup',
    subtitle: 'Motor, drum & spin drainage repair • 30-day warranty',
    badge: 'FLAT ₹99 OFF',
    promoCode: 'ZOMFIRST99',
    targetType: 'category',
    categoryId: 'washing',
  },
  {
    id: 'promo-ro',
    category: { id: 'ro', name: 'RO Water Purifier', icon: 'Droplets' },
    mediaURL: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=1200&q=80',
    isVideo: false,
    title: 'RO Water Purifier Service',
    subtitle: 'Genuine membrane replacement & multi-stage TDS calibration',
    badge: 'VERIFIED HOME SERVICES',
    promoCode: 'PUREWATER',
    targetType: 'category',
    categoryId: 'ro',
  },
  {
    id: 'promo-fridge',
    category: { id: 'fridge', name: 'Refrigerator Repair', icon: 'Zap' },
    mediaURL: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=1200&q=80',
    isVideo: false,
    title: 'Refrigerator Maintenance',
    subtitle: 'Cooling coil, thermostat & compressor diagnostics',
    badge: 'INDORE CERTIFIED',
    promoCode: 'COOLCARE',
    targetType: 'category',
    categoryId: 'fridge',
  },
];

export const CategoryHeroSlider: React.FC<CategoryHeroSliderProps> = ({
  categories,
  services,
  onSelectCategory,
  onSelectService,
  onNavigateOffers,
  activeBooking,
  onTrackBooking,
}) => {
  const [firestoreBanners, setFirestoreBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [failedMediaIds, setFailedMediaIds] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Subscribe to Firestore 'banners' collection in real-time
  useEffect(() => {
    let isMounted = true;
    try {
      const q = query(collection(db, 'banners'), orderBy('order', 'asc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;
          const list = snap.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              title: data.title || '',
              subtitle: data.subtitle || '',
              badge: data.badge || '',
              imageURL: data.imageURL || data.imageUrl || '',
              targetType: (data.targetType || 'category') as BannerTargetType,
              categoryId: data.categoryId || '',
              categoryName: data.categoryName || '',
              serviceId: data.serviceId || '',
              serviceName: data.serviceName || '',
              order: typeof data.order === 'number' ? data.order : 0,
              isActive: data.isActive !== undefined ? data.isActive : (data.active !== false),
            } as Banner;
          });

          // Filter only active banners
          const activeOnly = list.filter((b) => b && b.isActive !== false);
          setFirestoreBanners(activeOnly);
          try {
            localStorage.setItem('zomindia_banners_client_cache', JSON.stringify(activeOnly));
          } catch {
            // ignore
          }
        },
        (err) => {
          console.warn('banners collection subscription notice:', err);
          if (!isMounted) return;
          try {
            const cached = localStorage.getItem('zomindia_banners_client_cache');
            if (cached) {
              setFirestoreBanners(JSON.parse(cached));
            }
          } catch {
            // ignore
          }
        }
      );

      return () => {
        isMounted = false;
        unsub();
      };
    } catch {
      // safe fallback
    }
  }, []);

  // Compute slides: live active Firestore banners or authentic fallback promotional cards
  const slides = useMemo(() => {
    const items: SlideItem[] = [];

    // 1. If active Firestore banners exist, map them with highest priority
    if (firestoreBanners.length > 0) {
      firestoreBanners.forEach((banner, i) => {
        const matchedCat = categories.find(
          (c) => c.id === banner.categoryId || c.name.toLowerCase() === banner.categoryName?.toLowerCase()
        ) || categories[0];

        const rawUrl = banner.imageURL || (matchedCat ? matchedCat.imageURL : '') || getFallbackBanner(banner.title);
        const isVid = isVideoMedia(rawUrl);

        items.push({
          id: banner.id || `banner-${i}`,
          category: matchedCat,
          mediaURL: rawUrl,
          isVideo: isVid,
          title: banner.title || (matchedCat?.name ?? 'Home Service'),
          subtitle: banner.subtitle,
          badge: banner.badge,
          targetType: banner.targetType || 'category',
          categoryId: banner.categoryId,
          serviceId: banner.serviceId,
        });
      });
      return items;
    }

    // 2. Default clean promotional cards synchronized with live categories
    return DEFAULT_PROMO_CARDS.map((promo) => {
      const liveCat = categories.find(
        (c) =>
          c.id.toLowerCase() === promo.categoryId?.toLowerCase() ||
          c.name.toLowerCase().includes(promo.categoryId?.toLowerCase() || '')
      );
      return {
        ...promo,
        category: liveCat || promo.category,
      };
    });
  }, [categories, firestoreBanners]);

  // Auto slide interval
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [slides.length, isPaused]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 45;
    const isRightSwipe = distance < -45;

    if (isLeftSwipe) {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    } else if (isRightSwipe) {
      setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const currentSlide = slides[currentIndex] || slides[0];

  const handleSlideClick = (slide: SlideItem) => {
    if (!slide) return;

    // 1. If linked to Offers
    if (slide.targetType === 'offers') {
      if (onNavigateOffers) {
        onNavigateOffers();
        return;
      }
    }

    // 2. If linked to Specific Service
    if (slide.targetType === 'service' && slide.serviceId) {
      if (onSelectService) {
        onSelectService(slide.serviceId);
        return;
      }
    }

    // 3. If linked to Category
    let targetCat: Category | undefined = slide.category;
    if (!targetCat && slide.categoryId) {
      targetCat = categories.find((c) => c.id === slide.categoryId);
    }

    if (targetCat && onSelectCategory) {
      onSelectCategory(targetCat);
      setTimeout(() => {
        const target = document.getElementById('categories-grid') || document.getElementById('services-grid');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 80);
      return;
    }

    // Fallback scroll down to services
    const target = document.getElementById('categories-grid') || document.getElementById('services-grid');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!currentSlide) return null;

  const isMediaFailed = failedMediaIds[currentSlide.id];

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-2.5 mb-3 select-none">
      {/* Active Booking Mini-Banner Strip (if user has an in-flight booking) */}
      {activeBooking && (
        <div 
          onClick={onTrackBooking}
          className="mb-2 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl px-3 py-1.5 flex items-center justify-between shadow-xs border border-blue-700/40 cursor-pointer active:scale-98 transition-all"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold truncate">
              Active Booking: <span className="font-extrabold text-blue-200">#{activeBooking.id.slice(-6).toUpperCase()}</span> ({activeBooking.status.replace('_', ' ')})
            </span>
          </div>
          <button
            type="button"
            className="text-[10px] font-black uppercase tracking-wider bg-white/15 hover:bg-white/25 px-2.5 py-0.5 rounded-lg text-white flex items-center gap-1 shrink-0 ml-2"
          >
            Track <ArrowRight size={10} />
          </button>
        </div>
      )}

      {/* Sleek App-Grade Banner Frame: Edge-to-Edge Modern Frame */}
      <div 
        className="w-full aspect-[2.2/1] sm:aspect-[2.6/1] rounded-2xl overflow-hidden shadow-xs border border-slate-100 relative cursor-pointer group bg-gradient-to-r from-blue-50 to-indigo-50/80 active:scale-[0.99] transition-transform duration-200"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => handleSlideClick(currentSlide)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full h-full relative"
          >
            {!isMediaFailed && currentSlide.mediaURL ? (
              <>
                {currentSlide.isVideo ? (
                  /* Native high-performance HTML5 video player for MP4/WebM */
                  <video
                    key={currentSlide.mediaURL}
                    src={currentSlide.mediaURL}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover pointer-events-none"
                    onError={() => {
                      setFailedMediaIds((prev) => ({ ...prev, [currentSlide.id]: true }));
                    }}
                  />
                ) : (
                  /* High-resolution image banner */
                  <img
                    src={currentSlide.mediaURL}
                    alt={currentSlide.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    referrerPolicy="no-referrer"
                    loading="eager"
                    onError={() => {
                      setFailedMediaIds((prev) => ({ ...prev, [currentSlide.id]: true }));
                    }}
                  />
                )}

                {/* Modern Promotional Card Text Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent flex flex-col justify-end p-4 sm:p-7 text-white pointer-events-none">
                  {currentSlide.badge && (
                    <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-blue-600/90 backdrop-blur-xs text-white text-[9px] sm:text-[11px] font-black uppercase tracking-wider mb-1.5 shadow-sm">
                      {currentSlide.badge}
                    </div>
                  )}
                  <h3 className="text-sm sm:text-2xl font-black tracking-tight leading-tight uppercase font-display drop-shadow-md">
                    {currentSlide.title}
                  </h3>
                  {currentSlide.subtitle && (
                    <p className="text-[11px] sm:text-sm text-slate-200 font-medium mt-0.5 line-clamp-1 drop-shadow-sm">
                      {currentSlide.subtitle}
                    </p>
                  )}

                  {/* Clean Visible "Book Now ➔" Button */}
                  <div className="mt-2.5 sm:mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider px-3 sm:px-4 py-1.5 rounded-xl shadow-md backdrop-blur-xs transition-all pointer-events-auto">
                      <span>Book Now</span>
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </>
            ) : (
              /* Soft, elegant fallback gradient with subtle clean brand watermark */
              <div className="w-full h-full bg-gradient-to-r from-blue-50 via-indigo-50/70 to-sky-50 flex items-center justify-between p-6 sm:p-10">
                <div className="max-w-md">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100/70 text-blue-800 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-2">
                    Verified Home Service
                  </div>
                  <h3 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight leading-tight uppercase font-display">
                    {currentSlide.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    Doorstep service in 45 mins across Indore
                  </p>
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white font-black text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-xl shadow-sm">
                      <span>Book Now</span>
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
                <div className="opacity-25 select-none pointer-events-none hidden xs:block">
                  <img src="/logo-horizontal.png" alt="Zomindia" className="h-8 sm:h-10 w-auto object-contain" />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Carousel Arrow Controls (Visible on hover on desktop) */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/25 hover:bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs z-20 cursor-pointer shadow-sm"
              aria-label="Previous slide"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev + 1) % slides.length);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/25 hover:bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs z-20 cursor-pointer shadow-sm"
              aria-label="Next slide"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Minimal Modern Dots: Small, sleek sliding dots at bottom-center */}
        {slides.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 pointer-events-none bg-black/20 backdrop-blur-xs px-2.5 py-1 rounded-full">
            {slides.slice(0, 8).map((slide, idx) => (
              <span
                key={slide.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex % Math.min(slides.length, 8)
                    ? 'w-5 bg-white shadow-xs'
                    : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryHeroSlider;
