import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Promotion, Category, Redemption } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TicketPercent, 
  Gift, 
  Clock, 
  CheckCircle2, 
  X, 
  Sparkles, 
  Wrench, 
  Plug, 
  PaintBucket, 
  Smartphone, 
  Wind,
  Copy,
  Check,
  Tag,
  ArrowRight,
  Snowflake,
  Zap,
  Flame,
  ShieldCheck,
  Layers,
  Percent
} from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

// Modules
import { LoadingScreen } from './LoadingIndicator';

const ICON_MAP: Record<string, any> = {
  Sparkles,
  Wrench,
  Smartphone,
  PaintBucket,
  Plug,
  Wind,
  Snowflake,
  Zap,
  Flame,
  Layers,
  Percent
};

// Curated high-converting Indore-specific localized promotions
const LOCAL_PROMOTIONS: Record<'customer' | 'partner', any[]> = {
  customer: [
    {
      id: 'static_zomfirst15',
      name: 'Cool Summer Special',
      code: 'ZOMFIRST15%',
      discountType: 'percent',
      discountValue: 15,
      description: 'Conquer the intense Indore summer heat. Get a premium high-pressure jet AC service & gas level checks.',
      active: true,
      applicableCategories: [], // Global
      dealCategory: 'festive',
      badgeText: 'Summer Special',
    },
    {
      id: 'static_zomfirst99',
      name: 'Indore Appliance Shield',
      code: 'ZOMFIRST99',
      discountType: 'flat',
      discountValue: 99,
      description: "Protect your home appliances under Indore's climate. Flat ₹99 off on appliance checkup & diagnostics.",
      active: true,
      applicableCategories: [],
      dealCategory: 'flat',
      badgeText: 'Appliance Shield',
    },
    {
      id: 'static_indore50',
      name: 'Indore Deep Hygiene & Cleaning',
      code: 'INDORE50',
      discountType: 'percent',
      discountValue: 20,
      description: 'Premium home cleaning, wet sanitization, and dust prevention for Indore households.',
      active: true,
      applicableCategories: [],
      dealCategory: 'percent',
      badgeText: 'Hygiene Deal',
    },
  ],
  partner: [
    {
      id: 'static_fuelboost',
      name: 'Indore Fuel & Travel Boost',
      code: 'FUELBOOST',
      discountType: 'flat',
      discountValue: 150,
      description: 'Flat ₹150 fuel allowance added to your wallet upon delivering 5 bookings in Indore in a single day.',
      active: true,
      applicableCategories: [],
      dealCategory: 'flat',
      badgeText: 'Fuel Boost',
    },
    {
      id: 'static_weekendpro',
      name: 'Indore Weekend Surge Boost',
      code: 'WEEKENDPRO',
      discountType: 'percent',
      discountValue: 50,
      description: 'Earn 1.5x direct loyalty payouts and double Zomindia reward credits on weekend bookings.',
      active: true,
      applicableCategories: [],
      dealCategory: 'festive',
      badgeText: 'Weekend Surge',
    }
  ]
};

export default function OffersView({ 
  profile, 
  onAuthRequired, 
  setActiveTab, 
  context = 'customer' 
}: { 
  profile: UserProfile | null, 
  onAuthRequired: () => void, 
  setActiveTab: (tab: any) => void,
  context?: 'customer' | 'partner'
}) {
  // Top-level state declarations
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeCouponCode, setActiveCouponCode] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem('zomindia_active_coupon');
      if (stored) return stored;
      const jsonStored = localStorage.getItem('activeCoupon');
      if (jsonStored) {
        const parsed = JSON.parse(jsonStored);
        return parsed?.code || null;
      }
    } catch {
      // fallback
    }
    return null;
  });
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const getElegantName = useCallback((name: string) => {
    if (!name) return '';
    const upper = name.toUpperCase().trim();
    if (upper === 'COOLING DEALS/ COOL SUMMER 15% OFF' || upper.includes('COOLING DEALS') || upper.includes('COOL SUMMER 15%')) {
      return 'Cool Summer Special';
    }
    return name;
  }, []);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    if (isIOS && isSafari && !isStandalone) {
      let dismissed = false;
      try {
        dismissed = sessionStorage.getItem('ios-pwa-prompt-dismissed') === 'true';
      } catch (err) {
        console.warn('[PWA] Storage access denied', err);
      }
      if (!dismissed) {
        setShowIOSPrompt(true);
      }
    }
  }, []);

  useEffect(() => {
    const unsubPromos = onSnapshot(query(collection(db, 'promotions'), where('active', '==', true)), (snap) => {
      const dbPromos = snap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion));
      // Blend db promotions with our premium pre-defined Indore local promotions, filtering duplicate codes
      const localList = LOCAL_PROMOTIONS[context] || [];
      const merged = [...dbPromos];
      
      for (const local of localList) {
        if (!merged.some(p => p.code.toLowerCase() === local.code.toLowerCase())) {
          merged.push({
            ...local,
            createdAt: Timestamp.now()
          } as any);
        }
      }
      setPromotions(merged);
    });

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });

    if (profile) {
      const unsubRedemptions = onSnapshot(query(collection(db, 'redemptions'), where('userId', '==', profile.uid)), (snap) => {
        setRedemptions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Redemption)));
      });
      return () => { unsubPromos(); unsubCategories(); unsubRedemptions(); };
    }

    return () => { unsubPromos(); unsubCategories(); };
  }, [profile, context]);

  useEffect(() => {
    if (promotions.length > 0 && categories.length > 0) {
      setLoading(false);
    }
  }, [promotions, categories]);

  const visiblePromotions = useMemo(() => {
    return promotions.filter(promo => {
      if (context === 'partner') {
        return promo.targetAudience === 'partner';
      } else {
        return promo.targetAudience === 'customer' || !promo.targetAudience || promo.targetAudience === 'all';
      }
    });
  }, [promotions, context]);

  const filteredPromotions = useMemo(() => {
    return visiblePromotions.filter(promo => {
      if (selectedCategoryFilter === 'all') return true;
      return promo.applicableCategories?.includes(selectedCategoryFilter);
    });
  }, [visiblePromotions, selectedCategoryFilter]);

  const isRedeemed = useCallback((promoId: string) => {
    return redemptions.some(r => r.promotionId === promoId);
  }, [redemptions]);

  // Synchronized Global Coupon Application
  const applyCouponGlobally = useCallback(async (promo: Promotion) => {
    // 1. Copy code to clipboard
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopiedCode(promo.code);
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      // ignore clipboard failure
    }

    // 2. Persist active coupon in localStorage for BookingModal & CustomerDashboard sync
    try {
      localStorage.setItem('activeCoupon', JSON.stringify(promo));
      localStorage.setItem('zomindia_active_coupon', promo.code);
    } catch (err) {
      console.warn("Could not save coupon to localStorage", err);
    }

    setActiveCouponCode(promo.code);

    // 3. Dispatch window event for live in-session synchronization
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('coupon-applied', { detail: promo }));
    }

    // 4. Instant green toast notification
    const toastMsg = `Coupon ${promo.code} applied successfully! Check savings at checkout.`;
    if (typeof (window as any).__showToast === 'function') {
      (window as any).__showToast(toastMsg);
    } else if (typeof (window as any).__showCopyToast === 'function') {
      (window as any).__showCopyToast(promo.code);
    }

    // 5. Lazy sync promotion in Firestore if static
    if (promo.id.startsWith('static_')) {
      try {
        const promoRef = doc(db, 'promotions', promo.id);
        await setDoc(promoRef, {
          name: promo.name,
          code: promo.code,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          description: promo.description,
          active: true,
          applicableCategories: promo.applicableCategories || [],
          targetAudience: promo.targetAudience || 'customer',
          createdAt: Timestamp.now()
        }, { merge: true });
      } catch (err) {
        console.warn("Background promo sync error:", err);
      }
    }
  }, []);

  const handleRedeem = async () => {
    if (!profile) {
      onAuthRequired();
      return;
    }
    if (!selectedPromo) return;

    setIsRedeeming(true);
    try {
      // Lazy initialize static promotions in Firestore on first use
      if (selectedPromo.id.startsWith('static_')) {
        const promoRef = doc(db, 'promotions', selectedPromo.id);
        await setDoc(promoRef, {
          name: selectedPromo.name,
          code: selectedPromo.code,
          discountType: selectedPromo.discountType,
          discountValue: selectedPromo.discountValue,
          description: selectedPromo.description,
          active: true,
          applicableCategories: selectedPromo.applicableCategories || [],
          targetAudience: selectedPromo.targetAudience || 'customer',
          createdAt: Timestamp.now()
        }, { merge: true });
      }

      const redemptionData: Partial<Redemption> = {
        userId: profile.uid,
        promotionId: selectedPromo.id,
        redeemedAt: Timestamp.now(),
        status: 'active',
        appliedCategoryId: targetCategory || (selectedPromo.applicableCategories?.[0] || ''),
      };
      await addDoc(collection(db, 'redemptions'), redemptionData);
      
      // Auto-apply globally
      applyCouponGlobally(selectedPromo);

      setSelectedPromo(null);
      setTargetCategory('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'redemptions');
    } finally {
      setIsRedeeming(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    if (typeof (window as any).__showCopyToast === 'function') {
      (window as any).__showCopyToast(code);
    } else if (typeof (window as any).__showToast === 'function') {
      (window as any).__showToast(`Copied code: ${code}`);
    }
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Helper for Zomato/Swiggy/Paytm ticket pillar gradient styling
  const getTicketTheme = (promo: any) => {
    const code = (promo.code || '').toUpperCase();
    const name = (promo.name || '').toUpperCase();

    // 1. Festive / Special Hot Deals (Amber -> Orange)
    if (
      promo.dealCategory === 'festive' ||
      code.includes('SUMMER') ||
      code.includes('FESTIVE') ||
      code.includes('HOT') ||
      code.includes('WEEKEND') ||
      name.includes('SUMMER') ||
      name.includes('FESTIVE')
    ) {
      return {
        pillarGradient: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white',
        notchBorder: 'border-orange-500/20',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200/80',
        badgeText: promo.badgeText || '⚡ Hot Deal',
        tagBg: 'bg-amber-100/70 text-amber-800',
        accentColor: 'text-amber-600',
        icon: Flame
      };
    }

    // 2. Flat Cash Deals (Emerald -> Teal)
    if (
      promo.discountType === 'flat' ||
      promo.dealCategory === 'flat' ||
      code.includes('FLAT') ||
      code.includes('99') ||
      code.includes('150') ||
      code.includes('CASH')
    ) {
      return {
        pillarGradient: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
        notchBorder: 'border-emerald-500/20',
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
        badgeText: promo.badgeText || '💰 Cash Savings',
        tagBg: 'bg-emerald-100/70 text-emerald-800',
        accentColor: 'text-emerald-600',
        icon: ShieldCheck
      };
    }

    // 3. Percentage Deals (Blue -> Indigo)
    return {
      pillarGradient: 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white',
      notchBorder: 'border-blue-500/20',
      badgeBg: 'bg-blue-50 text-blue-800 border-blue-200/80',
      badgeText: promo.badgeText || '🎉 Best Value',
      tagBg: 'bg-blue-100/70 text-blue-800',
      accentColor: 'text-blue-600',
      icon: Sparkles
    };
  };

  const getCategoryIcon = (catId: string, iconName?: string) => {
    if (iconName && ICON_MAP[iconName]) {
      return ICON_MAP[iconName];
    }
    const lower = catId.toLowerCase();
    if (lower.includes('ac') || lower.includes('cool') || lower.includes('appliance')) return Snowflake;
    if (lower.includes('clean') || lower.includes('hygiene')) return Sparkles;
    if (lower.includes('electr') || lower.includes('power')) return Zap;
    if (lower.includes('plumb') || lower.includes('repair')) return Wrench;
    if (lower.includes('paint')) return PaintBucket;
    return Layers;
  };

  if (loading) return <LoadingScreen message="Unlocking exclusive vouchers & deals..." />;

  return (
    <div className="w-full max-w-5xl mx-auto px-3.5 sm:px-6 pt-3 sm:pt-6 pb-16 sm:pb-20" id="offers-view-container">
      
      {/* Premium Hero Header (Vibrant & Trust-Inspiring) */}
      <div className="relative mb-5 sm:mb-6 bg-gradient-to-r from-blue-50 via-indigo-50/70 to-emerald-50/60 border border-blue-100/90 rounded-3xl p-4 sm:p-6 text-slate-800 shadow-xs overflow-hidden" id="offers-hero-header">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-6 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-200/80 text-blue-700 rounded-full text-[11px] font-black uppercase tracking-wider mb-2 shadow-2xs">
              <Sparkles size={12} className="text-amber-500 animate-pulse" />
              {context === 'partner' ? 'Partner Rewards & Surge' : 'Zomindia Verified Vouchers'}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <span>{context === 'partner' ? 'Partner Boost & Rewards' : 'Offers & Vouchers'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 max-w-xl leading-relaxed">
              {context === 'partner'
                ? 'Claim direct fuel bonuses, surge earnings, and loyalty rewards.'
                : '1-tap coupon tickets for premium home services in Indore. Apply at checkout.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto bg-white/90 backdrop-blur-xs border border-blue-100/90 px-3.5 py-2 rounded-2xl text-xs font-black text-blue-900 shadow-xs">
            <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <TicketPercent size={14} className="stroke-[2.5]" />
            </div>
            <span>{visiblePromotions.length} Active Vouchers</span>
          </div>
        </div>
      </div>

      {/* 3. Category Filter Chips (Paytm Style Horizontal Scroller) */}
      <div className="mb-5 sm:mb-6">
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            Filter by Category
          </span>
          {selectedCategoryFilter !== 'all' && (
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>

        <div 
          className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth items-center select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* All Offers Filter Pill */}
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              selectedCategoryFilter === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
            }`}
            id="filter-all-offers"
          >
            <Sparkles size={13} className={selectedCategoryFilter === 'all' ? 'text-amber-300' : 'text-slate-500'} />
            <span>All Offers</span>
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              selectedCategoryFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
            }`}>
              {visiblePromotions.length}
            </span>
          </button>

          {/* Dynamic Categories Filter Pills */}
          {categories.map((cat) => {
            const count = visiblePromotions.filter(p => !p.applicableCategories || p.applicableCategories.length === 0 || p.applicableCategories.includes(cat.id)).length;
            if (count === 0) return null;

            const CatIcon = getCategoryIcon(cat.id, cat.icon);
            const isSelected = selectedCategoryFilter === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryFilter(cat.id)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                }`}
                id={`filter-${cat.id}`}
              >
                <CatIcon size={13} className={isSelected ? 'text-blue-100' : 'text-slate-500'} />
                <span>{cat.name}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Ticket-Style Coupon Cards Grid (Zomato/Swiggy UX with Notches & Left Badge Pillar) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5" id="vouchers-ticket-grid">
        {filteredPromotions.map((promo, i) => {
          const isApplied = activeCouponCode === promo.code;
          const theme = getTicketTheme(promo);
          const isCopied = copiedCode === promo.code;

          // Find associated category names
          const applicableCatNames = (promo.applicableCategories || [])
            .map(cid => categories.find(c => c.id === cid)?.name)
            .filter(Boolean);

          const categoryTag = applicableCatNames.length > 0 
            ? applicableCatNames.join(', ') 
            : 'All Services';

          return (
            <motion.div 
              key={promo.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all duration-300 flex flex-row items-stretch ${
                isApplied
                  ? 'border-emerald-400 ring-2 ring-emerald-400/30'
                  : 'border-slate-200/80 hover:border-blue-300'
              }`}
              id={`promo-ticket-${promo.id}`}
            >
              {/* Active Applied Banner Overlay Ribbon */}
              {isApplied && (
                <div className="absolute top-0 right-0 z-20">
                  <div className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-0.5 rounded-bl-xl shadow-xs flex items-center gap-1">
                    <Check size={10} className="stroke-[3]" />
                    <span>Applied</span>
                  </div>
                </div>
              )}

              {/* LEFT OFFER BADGE PILLAR (Vibrant Gradient with Big Bold Discount & OFF Pill) */}
              <div className={`w-24 sm:w-28 shrink-0 relative flex flex-col items-center justify-center p-3 text-center ${theme.pillarGradient} select-none overflow-hidden`}>
                {/* Decorative background circle sheen */}
                <div className="absolute -top-6 -left-6 w-20 h-20 bg-white/10 rounded-full blur-xs pointer-events-none" />
                <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-black/10 rounded-full blur-xs pointer-events-none" />

                {/* Big Bold Discount Value */}
                <span className="text-xl sm:text-2xl md:text-3xl font-black leading-none tracking-tight drop-shadow-xs">
                  {promo.discountType === 'percent' ? `${promo.discountValue}%` : `₹${promo.discountValue}`}
                </span>

                {/* OFF Pill */}
                <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] sm:text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mt-1.5 shadow-2xs border border-white/20">
                  OFF
                </span>

                {/* Deal nature micro-label */}
                <span className="text-[9px] font-bold text-white/90 uppercase tracking-wider mt-1.5 opacity-90 truncate max-w-full px-1">
                  {promo.discountType === 'percent' ? 'Discount' : 'Flat Off'}
                </span>
              </div>

              {/* TICKET DIVIDER WITH NOTCHED TEAR-STRIP EFFECT */}
              <div className="relative w-0 flex flex-col justify-between items-center z-10">
                {/* Top Semicircular Ticket Notch */}
                <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-slate-50 border-b border-slate-200/80 shadow-inner" />
                
                {/* Dashed vertical tear line */}
                <div className="h-full border-r-2 border-dashed border-slate-200/90 my-2" />

                {/* Bottom Semicircular Ticket Notch */}
                <div className="absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-slate-50 border-t border-slate-200/80 shadow-inner" />
              </div>

              {/* RIGHT CARD CONTENT & ACTIONS */}
              <div className="flex-1 p-3.5 sm:p-4 flex flex-col justify-between min-w-0 bg-white pl-4 sm:pl-5">
                <div>
                  {/* Top Metadata Row: Category Tag + Validity Micro-Badge */}
                  <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md leading-none truncate max-w-[140px]">
                      {categoryTag}
                    </span>
                    
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                      <Clock size={10} className="text-amber-600" />
                      <span>⚡ Valid 7 Days</span>
                    </span>
                  </div>

                  {/* High-Contrast Title */}
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug truncate">
                    {getElegantName(promo.name)}
                  </h3>

                  {/* 1-Line Crisp Description */}
                  <p className="text-xs text-slate-500 font-medium line-clamp-1 sm:line-clamp-2 mt-1">
                    {promo.description}
                  </p>
                </div>

                {/* BOTTOM INTERACTION ROW: Dashed Coupon Code Chip + Royal Blue Apply Button */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-100">
                  {/* Dashed Coupon Code Chip with 1-Tap Copy Feedback */}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(promo.code)}
                    className={`border-dashed border-2 px-2.5 py-1.5 rounded-lg text-xs font-mono font-black tracking-wider flex items-center gap-1.5 transition-all cursor-pointer select-all ${
                      isCopied
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-blue-300 bg-blue-50/50 hover:bg-blue-100/70 text-blue-700'
                    }`}
                    title="Click to copy coupon code"
                    id={`copy-chip-${promo.id}`}
                  >
                    <span>{promo.code}</span>
                    {isCopied ? (
                      <span className="text-[10px] font-sans font-bold text-emerald-600 flex items-center gap-0.5">
                        <Check size={12} className="stroke-[3]" /> Copied!
                      </span>
                    ) : (
                      <Copy size={11} className="text-blue-500 opacity-70 group-hover:opacity-100" />
                    )}
                  </button>

                  {/* Modern Royal Blue 'APPLY' CTA */}
                  <button
                    type="button"
                    onClick={() => applyCouponGlobally(promo)}
                    className={`text-xs font-black px-4 py-2 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                      isApplied
                        ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-500 shadow-xs'
                        : 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
                    }`}
                    id={`apply-btn-${promo.id}`}
                    title={isApplied ? 'Coupon is currently applied' : 'Apply voucher to your booking'}
                  >
                    {isApplied ? (
                      <>
                        <Check size={13} className="stroke-[3]" />
                        <span>Applied</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        <span>APPLY</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State when no visible promotions */}
      {visiblePromotions.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-xs mt-6" id="empty-rewards-view">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Gift size={32} />
          </div>
          <h3 className="text-slate-800 font-black text-base sm:text-lg">No Vouchers Available</h3>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-sm mx-auto">
            Check back soon for new seasonal discounts and exclusive Indore booking deals!
          </p>
        </div>
      ) : filteredPromotions.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-xs mt-6" id="empty-filtered-rewards">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Tag size={28} />
          </div>
          <h3 className="text-slate-800 font-black text-base">No Vouchers for this Category</h3>
          <p className="text-slate-500 text-xs mt-1">
            Try switching categories or view all active promotions.
          </p>
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all shadow-sm cursor-pointer"
            id="reset-category-filter"
          >
            Show All Offers
          </button>
        </div>
      ) : null}

      {/* Browse Categories Directory with Quick Action */}
      <section className="mt-8 sm:mt-10 bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-2xs" id="offers-directory">
        <div className="flex items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles size={14} />
            </div>
            <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
              Browse Categories to Redeem Vouchers
            </h2>
          </div>
          <button 
            onClick={() => setActiveTab('home')}
            className="text-xs font-black text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            View All Services <ArrowRight size={13} />
          </button>
        </div>

        <div 
          className="flex gap-2.5 overflow-x-auto pb-1.5 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat.id, cat.icon);
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200/70 hover:border-blue-200 transition-all text-left shrink-0 cursor-pointer group"
                id={`directory-btn-${cat.id}`}
              >
                <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Icon size={14} />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-blue-900 whitespace-nowrap">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Direct Claim / Activate Modal (Clean & Responsive) */}
      <AnimatePresence>
        {selectedPromo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs" id="redemption-modal">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto flex flex-col border border-slate-100"
            >
              <div className="shrink-0 flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <TicketPercent size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">Activate Voucher</h3>
                    <p className="text-slate-400 text-[11px] font-medium">Apply instant discount to next booking</p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setSelectedPromo(null);
                    setTargetCategory('');
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Close Modal"
                  id="close-redemption-modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 flex-1">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                    Selected Voucher
                  </span>
                  <h4 className="text-base font-black text-slate-900 mt-1.5">{getElegantName(selectedPromo.name)}</h4>
                  <p className="text-blue-700 text-xs font-black mt-1">
                    {selectedPromo.discountType === 'percent' ? `${selectedPromo.discountValue}% OFF` : `₹${selectedPromo.discountValue} FLAT OFF`}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Select category to apply:
                  </label>
                  <div className="max-h-48 overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-2">
                      {categories.filter(c => !selectedPromo.applicableCategories || selectedPromo.applicableCategories.length === 0 || selectedPromo.applicableCategories.includes(c.id)).map(cat => (
                        <button 
                          key={cat.id}
                          onClick={() => setTargetCategory(cat.id)}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-center text-center cursor-pointer ${
                            targetCategory === cat.id 
                              ? 'border-blue-600 bg-blue-50 text-blue-900 font-black shadow-xs' 
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium text-xs'
                          }`}
                          id={`select-cat-${cat.id}`}
                        >
                           <span className="text-xs truncate">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button 
                    disabled={!targetCategory || isRedeeming}
                    onClick={handleRedeem}
                    className="w-full bg-[#2563EB] hover:bg-blue-700 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    id="confirm-claim-btn"
                  >
                    {isRedeeming ? 'Validating...' : 'Activate & Apply to Checkout'}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-2">
                    Automatically applies discount when checking out your next booking.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Non-intrusive iOS Safari PWA Install Prompt */}
      <AnimatePresence>
        {showIOSPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-4 left-3 right-3 md:left-auto md:right-6 md:w-84 bg-white border border-slate-200 text-slate-900 rounded-3xl p-4 shadow-2xl z-[150] flex flex-col gap-2.5"
            id="ios-pwa-prompt"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                  <Smartphone size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Add to Home Screen</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Zomindia Web App</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowIOSPrompt(false);
                  try {
                    sessionStorage.setItem('ios-pwa-prompt-dismissed', 'true');
                  } catch (err) {
                    console.warn('[PWA] Storage access denied', err);
                  }
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Dismiss"
                id="dismiss-ios-prompt"
              >
                <X size={15} />
              </button>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Tap <span className="font-bold text-blue-600">Share [↑]</span> in Safari and choose <span className="font-bold text-blue-600">"Add to Home Screen"</span> for instant 1-tap booking access.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
