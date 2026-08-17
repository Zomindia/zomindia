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
  Zap
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
  Zap
};

const PROMO_ICONS: Record<string, any> = {
  'ZOMFIRST15%': Snowflake,
  'ZOMFIRST99': Smartphone,
  'INDORE50': Sparkles,
  'FUELBOOST': Zap,
  'WEEKENDPRO': TicketPercent,
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
      gradient: 'from-sky-100 to-blue-200 text-blue-900 border-blue-200/80',
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
      gradient: 'from-amber-100 to-orange-200 text-amber-950 border-amber-200/80',
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
      gradient: 'from-emerald-100 to-teal-200 text-emerald-900 border-emerald-200/80',
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
      gradient: 'from-amber-100 to-orange-200 text-amber-950 border-amber-200/80',
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
      gradient: 'from-indigo-100 to-purple-200 text-indigo-900 border-indigo-200/80',
      badgeText: 'Weekend Pro',
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

  const getPromoTheme = (promo: any, idx: number) => {
    const pastelThemes = [
      {
        gradientClass: 'from-sky-100 to-blue-200 text-blue-900 border-blue-200/80',
        badgeBg: 'bg-blue-50 text-blue-700 border-blue-200/70',
        badgeText: promo.badgeText || 'Special Offer',
        accentColor: 'text-blue-700'
      },
      {
        gradientClass: 'from-emerald-100 to-teal-200 text-emerald-900 border-emerald-200/80',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
        badgeText: promo.badgeText || 'Hot Deal',
        accentColor: 'text-emerald-700'
      },
      {
        gradientClass: 'from-rose-100 to-pink-200 text-rose-900 border-rose-200/80',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200/70',
        badgeText: promo.badgeText || 'Mega Savings',
        accentColor: 'text-rose-700'
      },
      {
        gradientClass: 'from-amber-100 to-orange-200 text-amber-950 border-amber-200/80',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200/70',
        badgeText: promo.badgeText || 'Limited Period',
        accentColor: 'text-amber-800'
      },
      {
        gradientClass: 'from-indigo-100 to-purple-200 text-indigo-900 border-indigo-200/80',
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
        badgeText: promo.badgeText || 'Member Special',
        accentColor: 'text-indigo-700'
      }
    ];

    if (promo.gradient && !promo.gradient.includes('slate') && !promo.gradient.includes('black') && !promo.gradient.includes('950')) {
      return {
        gradientClass: promo.gradient,
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
        badgeText: promo.badgeText || 'Exclusive Deal',
        accentColor: 'text-indigo-700'
      };
    }
    return pastelThemes[idx % pastelThemes.length];
  };

  if (loading) return <LoadingScreen message="Unlocking exclusive partner & customer rewards..." />;

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 pt-3 sm:pt-6 pb-12 sm:pb-16" id="offers-view-container">
      
      {/* Clean, Bright, Soft-Tinted Hero Header (No Black/Dark Colors) */}
      <div className="relative mb-4 bg-gradient-to-r from-sky-50 via-indigo-50/80 to-purple-50 border border-indigo-100/90 rounded-2xl p-4 sm:p-5 text-slate-800 shadow-2xs overflow-hidden" id="offers-hero-header">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white border border-indigo-200/70 text-indigo-700 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1 shadow-2xs">
              <Sparkles size={11} className="text-amber-500 animate-pulse" />
              {context === 'partner' ? 'Partner Rewards' : 'Special Indore Deals'}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {context === 'partner' ? 'Partner Boost & Rewards' : 'Exclusive Offers & Vouchers'}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {context === 'partner'
                ? 'Fuel bonuses, weekend surges, and direct payout incentives.'
                : 'Exclusive vouchers & booking rewards for Indore residents.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto bg-white border border-indigo-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 shadow-2xs">
            <TicketPercent size={14} className="text-indigo-600" />
            <span>{visiblePromotions.length} active vouchers</span>
          </div>
        </div>
      </div>

      {/* Category Filter Pills (Compact Segmented Controls) */}
      <div 
        className="flex gap-1.5 overflow-x-auto pb-2 mb-3.5 -mx-1 px-1 scroll-smooth items-center select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <button
          onClick={() => setSelectedCategoryFilter('all')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
            selectedCategoryFilter === 'all'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
          }`}
          id="filter-all-offers"
        >
          All Offers
        </button>
        {categories.map((cat) => {
          const count = visiblePromotions.filter(p => !p.applicableCategories || p.applicableCategories.length === 0 || p.applicableCategories.includes(cat.id)).length;
          if (count === 0) return null;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryFilter(cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                selectedCategoryFilter === cat.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
              }`}
              id={`filter-${cat.id}`}
            >
              {cat.name}
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                selectedCategoryFilter === cat.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ultra-Compact Coupon Cards (Zomato/Paytm Ticket Style) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3">
        {filteredPromotions.map((promo, i) => {
          const redeemed = isRedeemed(promo.id);
          const isApplied = activeCouponCode === promo.code;
          const theme = getPromoTheme(promo, i);

          return (
            <motion.div 
              key={promo.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className={`group relative bg-white border rounded-xl p-2.5 sm:p-3 transition-all duration-200 flex items-center justify-between gap-2.5 sm:gap-3 min-h-[75px] max-h-[88px] ${
                isApplied
                  ? 'border-emerald-400 ring-1 ring-emerald-300 bg-emerald-50/20'
                  : redeemed 
                    ? 'border-slate-200 bg-slate-50/70' 
                    : 'border-slate-200/90 hover:border-indigo-300 hover:shadow-xs'
              }`}
              id={`promo-card-${promo.id}`}
            >
              {/* Left Pastel Accent Block (Soft Pastel Gradient with Discount) */}
              <div className={`w-14 sm:w-16 h-13 sm:h-14 rounded-lg shrink-0 flex flex-col items-center justify-center bg-gradient-to-br ${theme.gradientClass} border shadow-2xs text-center px-1`}>
                <span className="text-[12px] sm:text-xs leading-none font-black uppercase">
                  {promo.discountType === 'percent' ? `${promo.discountValue}%` : `₹${promo.discountValue}`}
                </span>
                <span className="text-[9px] uppercase tracking-wider font-bold opacity-85 mt-0.5">
                  OFF
                </span>
              </div>

              {/* Center Details */}
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded leading-none">
                    {theme.badgeText}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                    <Clock size={10} /> Valid 7 Days
                  </span>
                </div>

                <h3 className="text-xs sm:text-sm font-bold text-gray-800 truncate">
                  {getElegantName(promo.name)}
                </h3>
                
                <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                  {promo.description}
                </p>
              </div>

              {/* Right Side Actions: Dashed Coupon Code + Apply Button */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(promo.code)}
                  className="font-mono text-[11px] sm:text-xs text-indigo-700 bg-indigo-50/90 hover:bg-indigo-100 border-dashed border border-indigo-200 px-2 py-0.5 rounded font-bold cursor-pointer transition-colors flex items-center gap-1"
                  title="Click to copy coupon code"
                  id={`copy-pod-${promo.id}`}
                >
                  <span>{promo.code}</span>
                  {copiedCode === promo.code ? (
                    <Check size={11} className="text-emerald-600 stroke-[3]" />
                  ) : (
                    <Copy size={10} className="text-slate-400" />
                  )}
                </button>

                {/* Apply / Applied Button */}
                <button 
                  onClick={() => applyCouponGlobally(promo)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                    isApplied
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                  id={`claim-btn-${promo.id}`}
                  title={isApplied ? 'Coupon currently applied' : 'Apply coupon to checkout'}
                >
                  {isApplied ? (
                    <>
                      <Check size={12} className="stroke-[3]" />
                      <span>Applied</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={11} />
                      <span>Apply</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {visiblePromotions.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-xs" id="empty-rewards-view">
           <Gift size={32} className="mx-auto text-slate-300 mb-2" />
           <p className="text-slate-700 font-bold text-sm">No rewards available yet</p>
           <p className="text-slate-400 text-xs mt-0.5">Check back soon for new vouchers and seasonal deals!</p>
        </div>
      ) : filteredPromotions.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-xs" id="empty-filtered-rewards">
           <Tag size={32} className="mx-auto text-slate-300 mb-2" />
           <p className="text-slate-700 font-bold text-sm">No promotions for this category</p>
           <p className="text-slate-400 text-xs mt-0.5">Try selecting another category or show all offers.</p>
           <button
             onClick={() => setSelectedCategoryFilter('all')}
             className="mt-3 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
             id="reset-category-filter"
           >
             Show All Offers
           </button>
        </div>
      ) : null}

      {/* Compact Categories Directory (Horizontal scroll row) */}
      <section className="mt-6 bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs" id="offers-directory">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-600" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Browse Categories to Apply Vouchers
            </h2>
          </div>
          <button 
            onClick={() => setActiveTab('home')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            View All <ArrowRight size={12} />
          </button>
        </div>

        <div 
          className="flex gap-2 overflow-x-auto pb-1 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((cat) => {
            const Icon = ICON_MAP[cat.icon] || Sparkles;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/70 hover:border-indigo-200 transition-all text-left shrink-0 cursor-pointer group"
                id={`directory-btn-${cat.id}`}
              >
                <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Icon size={12} />
                </div>
                <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-950 whitespace-nowrap">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Redemption Modal - Clean & Compact */}
      <AnimatePresence>
        {selectedPromo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs" id="redemption-modal">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-md rounded-2xl p-5 shadow-xl relative max-h-[90vh] overflow-y-auto flex flex-col border border-slate-100"
            >
              <div className="shrink-0 flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <TicketPercent size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Claim Voucher</h3>
                    <p className="text-slate-400 text-[10px] font-medium">Activate for checkout discount</p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setSelectedPromo(null);
                    setTargetCategory('');
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Close Modal"
                  id="close-redemption-modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 flex-1">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Voucher</p>
                  <h4 className="text-base font-bold text-slate-900 mt-0.5">{getElegantName(selectedPromo.name)}</h4>
                  <p className="text-indigo-600 text-xs font-semibold mt-0.5">
                    Discount: {selectedPromo.discountType === 'percent' ? `${selectedPromo.discountValue}% OFF` : `₹${selectedPromo.discountValue} FLAT OFF`}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
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
                              ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-bold shadow-2xs' 
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
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                    id="confirm-claim-btn"
                  >
                    {isRedeeming ? 'Validating...' : 'Activate Voucher'}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-2">
                    Applies automatically on your next booking checkout.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Non-intrusive iOS Safari PWA Install Bottom Sheet */}
      <AnimatePresence>
        {showIOSPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-4 left-3 right-3 md:left-auto md:right-6 md:w-80 bg-white border border-slate-200 text-slate-900 rounded-2xl p-4 shadow-xl z-[150] flex flex-col gap-2.5"
            id="ios-pwa-prompt"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Smartphone size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Add to Home Screen</h4>
                  <p className="text-[10px] text-slate-400">Zomindia Web App</p>
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
                className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Dismiss"
                id="dismiss-ios-prompt"
              >
                <X size={14} />
              </button>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              Tap <span className="font-bold text-indigo-600">Share [↑]</span> in Safari and choose <span className="font-bold text-indigo-600">"Add to Home Screen"</span> for instant access.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
