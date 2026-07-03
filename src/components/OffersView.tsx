import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, getDocs, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Promotion, Category, Redemption } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TicketPercent, 
  Gift, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
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
  TrendingUp,
  Award,
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
      description: 'Conquer the intense Indore summer heat. Get a premium high-pressure jet AC service, deep cooling coil sanitization & gas level checks by our top-tier rated professionals.',
      active: true,
      applicableCategories: [], // Global
      gradient: 'from-cyan-500 via-blue-600 to-indigo-700',
      badgeText: 'Indore Heatwave Deal',
    },
    {
      id: 'static_zomfirst99',
      name: 'Indore Appliance Shield',
      code: 'ZOMFIRST99',
      discountType: 'flat',
      discountValue: 99,
      description: "Protect your home appliances under Indore's extreme climate. Book any home appliance checkup, fault diagnostics, or safety inspection at a flat rate.",
      active: true,
      applicableCategories: [],
      gradient: 'from-[#ff2d55] via-[#ff3b30] to-[#ff9500]',
      badgeText: 'Ultimate Protection',
    },
    {
      id: 'static_indore50',
      name: 'Indore Deep Hygiene & Cleaning',
      code: 'INDORE50',
      discountType: 'percent',
      discountValue: 20,
      description: 'Premium home cleaning, wet sanitization, and dust prevention. Perfect for Indore households fighting seasonal dust, pollen, and high humidity.',
      active: true,
      applicableCategories: [],
      gradient: 'from-[#bf5af2] via-[#ff375f] to-[#ff2d55]',
      badgeText: 'Dust & Hygiene Buster',
    },
  ],
  partner: [
    {
      id: 'static_fuelboost',
      name: 'Indore Fuel & Travel Boost',
      code: 'FUELBOOST',
      discountType: 'flat',
      discountValue: 150,
      description: 'Maximize your field profits. Get a flat ₹150 fuel allowance added to your wallet upon successfully delivering 5 on-site bookings in Indore in a single day.',
      active: true,
      applicableCategories: [],
      gradient: 'from-[#ff9f0a] via-[#ff375f] to-[#bf5af2]',
      badgeText: 'Fuel Supercharge',
    },
    {
      id: 'static_weekendpro',
      name: 'Indore Weekend Surge Boost',
      code: 'WEEKENDPRO',
      discountType: 'percent',
      discountValue: 50,
      description: 'Earn 1.5x direct loyalty payouts and double Zomindia reward credits on all appliance repair and home deep cleaning bookings accomplished during weekends.',
      active: true,
      applicableCategories: [],
      gradient: 'from-[#30d158] via-[#00c7be] to-[#007aff]',
      badgeText: 'Weekend Pro Surge',
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
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  const getElegantName = (name: string) => {
    if (!name) return '';
    const upper = name.toUpperCase().trim();
    if (upper === 'COOLING DEALS/ COOL SUMMER 15% OFF' || upper.includes('COOLING DEALS') || upper.includes('COOL SUMMER 15%')) {
      return 'Cool Summer Special';
    }
    return name;
  };

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

  const handleRedeem = async () => {
    if (!profile) {
      onAuthRequired();
      return;
    }
    if (!selectedPromo) return;
    setIsRedeeming(true);
    try {
      // Lazy initialize static promotions in Firestore on first use so the BookingModal checkout flow can find them perfectly
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
        });
      }

      const redemptionData: Partial<Redemption> = {
        userId: profile.uid,
        promotionId: selectedPromo.id,
        redeemedAt: Timestamp.now(),
        status: 'active',
        appliedCategoryId: targetCategory || (selectedPromo.applicableCategories?.[0] || ''),
      };
      await addDoc(collection(db, 'redemptions'), redemptionData);
      
      if (typeof (window as any).__showToast === 'function') {
        (window as any).__showToast(`Successfully claimed! ${selectedPromo.code} is active on your checkout.`);
      }

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

  const isRedeemed = (promoId: string) => redemptions.some(r => r.promotionId === promoId);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const visiblePromotions = promotions.filter(promo => {
    if (context === 'partner') {
      return promo.targetAudience === 'partner';
    } else {
      return promo.targetAudience === 'customer' || !promo.targetAudience || promo.targetAudience === 'all';
    }
  });

  const filteredPromotions = visiblePromotions.filter(promo => {
    if (selectedCategoryFilter === 'all') return true;
    return promo.applicableCategories?.includes(selectedCategoryFilter);
  });

  const getPromoTheme = (promo: any, idx: number) => {
    if (promo.gradient) {
      return {
        gradientClass: promo.gradient,
        badgeBg: 'bg-white/15 backdrop-blur-md border border-white/20 text-white shadow-lg shadow-black/10',
        glowBg: 'bg-white/10',
        badgeText: promo.badgeText || 'Exclusive Deal'
      };
    }
    
    // Fallback premium gradients for database-seeded promos
    const fallbacks = [
      {
        gradientClass: 'from-[#007aff] via-[#5856d6] to-[#af52de]', // Indigo - Violet - Purple
        badgeBg: 'bg-white/20 backdrop-blur-md border border-white/25 text-white shadow-lg shadow-indigo-950/20',
        glowBg: 'bg-white/10',
        badgeText: 'Member Special'
      },
      {
        gradientClass: 'from-[#ff2d55] via-[#ff3b30] to-[#ff9500]', // Red - Orange - Coral
        badgeBg: 'bg-white/20 backdrop-blur-md border border-white/25 text-white shadow-lg shadow-rose-950/20',
        glowBg: 'bg-white/10',
        badgeText: 'Hot Deal'
      },
      {
        gradientClass: 'from-[#34c759] via-[#00c7be] to-[#007aff]', // Green - Teal - Blue
        badgeBg: 'bg-white/20 backdrop-blur-md border border-white/25 text-white shadow-lg shadow-emerald-950/20',
        glowBg: 'bg-white/10',
        badgeText: 'Pro Choice'
      }
    ];
    
    return fallbacks[idx % fallbacks.length];
  };

  // Removed full-screen loading check for beautiful inline skeletons

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-12 pb-14 sm:pb-24 overflow-x-hidden" id="offers-view-container">
      
      {/* Premium Hero and Title section */}
      <div className="relative mb-6 sm:mb-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute -top-16 -left-16 w-48 sm:w-80 h-48 sm:h-80 bg-gradient-to-r from-blue-600/10 to-indigo-600/5 rounded-full blur-[100px] pointer-events-none"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          className="absolute -top-20 -right-20 w-64 sm:w-96 h-64 sm:h-96 bg-gradient-to-r from-purple-600/10 to-pink-500/5 rounded-full blur-[120px] pointer-events-none"
        />

        <div className="relative z-10 text-center sm:text-left flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-6 pb-5 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-2.5">
              <Sparkles size={10} className="fill-current animate-pulse text-blue-600" />
              {context === 'partner' ? 'Partner Club' : 'Exclusive Access'}
            </div>
            <h2 className="text-xl sm:text-4xl md:text-5xl font-medium text-slate-900 tracking-wide leading-none uppercase">
              {context === 'partner' ? 'Partner' : 'Member'} <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 italic font-black">Privilege</span> Rewards
            </h2>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm font-medium max-w-sm mx-auto sm:mx-0 sm:text-right leading-relaxed">
            {context === 'partner' 
              ? 'Accelerate and amplify your earnings with high-tier partner benefits and loyalty payouts.'
              : 'Unlock premium incentives curated specifically for loyal patrons. Activate voucher keys to save on your next checkout.'}
          </p>
        </div>
      </div>

      {/* Category Filter Pills (Sleek Modern Segmented Controls) */}
      <div 
        className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth items-center select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <button
          onClick={() => setSelectedCategoryFilter('all')}
          className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
            selectedCategoryFilter === 'all'
              ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-md shadow-blue-700/20'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80 shadow-xs'
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
              className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                selectedCategoryFilter === cat.id
                  ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-md shadow-blue-700/20'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80 shadow-xs'
              }`}
              id={`filter-${cat.id}`}
            >
              {cat.name}
              <span className={`text-[8px] font-black leading-none px-1.5 py-0.5 rounded-full ${
                selectedCategoryFilter === cat.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid of Redesigned Offers using Vibrant Gradients & Glassmorphism */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 justify-center">
        {loading ? (
          [1, 2, 3].map((idx) => (
            <div key={idx} className="animate-pulse bg-white border border-slate-100 rounded-[32px] p-8 flex flex-col min-h-[380px] sm:min-h-[430px] justify-between shadow-sm select-none">
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl" />
                  <div className="w-20 h-6 bg-slate-100 rounded-full" />
                </div>
                <div className="space-y-3">
                  <div className="w-1/3 h-4.5 bg-slate-100 rounded" />
                  <div className="w-full h-8 bg-slate-100 rounded-xl" />
                  <div className="w-5/6 h-4 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="space-y-4 pt-6 border-t border-slate-50">
                <div className="flex justify-between items-center">
                  <div className="w-24 h-4 bg-slate-100 rounded" />
                  <div className="w-16 h-4 bg-slate-100 rounded" />
                </div>
                <div className="w-full h-12 bg-slate-100 rounded-2xl" />
              </div>
            </div>
          ))
        ) : (
          filteredPromotions.map((promo, i) => {
          const redeemed = isRedeemed(promo.id);
          const theme = getPromoTheme(promo, i);
          const IconComponent = PROMO_ICONS[promo.code] || ICON_MAP[promo.applicableCategories?.[0]] || Gift;

          return (
            <motion.div 
              key={promo.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ 
                y: -6, 
                scale: 1.02,
              }}
              whileTap={{ scale: 0.98 }}
              className={`group relative rounded-[32px] overflow-hidden flex flex-col min-h-[380px] sm:min-h-[430px] transition-all duration-300 bg-gradient-to-br ${theme.gradientClass} ${
                redeemed ? 'opacity-85 grayscale-[15%]' : 'shadow-lg hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.3)]'
              } border border-white/10`}
              id={`promo-card-${promo.id}`}
            >
              {/* Absolute Decorative Shining Overlay */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/15 rounded-full blur-3xl group-hover:bg-white/25 transition-all duration-500 pointer-events-none" />
              <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] transition-all duration-500 group-hover:backdrop-blur-0 z-0 pointer-events-none" />

              {/* Main Content Body */}
              <div className="relative z-10 p-6 sm:p-8 flex flex-col h-full justify-between flex-1">
                
                {/* Header Row: Floating Glassmorphic Badge & Clock */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-6">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md border border-white/25 text-white shadow-lg shadow-black/10`}>
                      <Tag size={11} className="stroke-[2.5]" />
                      {promo.discountType === 'percent' ? `${promo.discountValue}% OFF` : `Flat ₹${promo.discountValue} OFF`}
                    </span>
                    <span className="text-[10px] text-white/90 font-bold flex items-center gap-1 px-2 py-1 bg-black/15 rounded-lg border border-white/5 backdrop-blur-sm">
                      <Clock size={11} className="text-white/80" /> 7 Days Left
                    </span>
                  </div>

                  {/* Icon Area: Large Elegant Glass Circle */}
                  <div className="mb-6 flex justify-start">
                    <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-md shadow-black/5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      <IconComponent size={24} className="stroke-[2]" />
                    </div>
                  </div>

                  {/* Title & Description with Premium Typography */}
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug italic drop-shadow-sm mb-2.5">
                    {getElegantName(promo.name)}
                  </h3>
                  <p className="text-white/85 text-xs sm:text-sm font-medium leading-relaxed mb-6 drop-shadow-xs line-clamp-3">
                    {promo.description}
                  </p>
                </div>

                {/* Footer Section: Promo Code Box & CTA */}
                <div className="space-y-4">
                  {/* Coupon Copy Pod */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(promo.code);
                    }}
                    className="group/code flex items-center justify-between gap-2 p-3 rounded-2xl bg-black/25 hover:bg-black/35 border border-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer shadow-inner"
                    title="Click to copy coupon code"
                    id={`copy-pod-${promo.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <TicketPercent size={14} className="text-white/70 group-hover/code:text-white shrink-0 animate-pulse" />
                      <span className="font-mono text-xs sm:text-sm font-black text-white tracking-widest truncate">
                        {promo.code}
                      </span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/75 group-hover/code:text-white flex items-center gap-1 shrink-0 transition-colors">
                      {copiedCode === promo.code ? (
                        <>
                          <Check size={11} className="stroke-[3] text-emerald-400" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={11} /> Copy Code
                        </>
                      )}
                    </span>
                  </div>

                  {/* Main Action Button */}
                  <div>
                    {redeemed ? (
                      <div className="w-full bg-white/10 backdrop-blur-md border border-white/10 text-white/95 py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest select-none shadow-sm">
                        <CheckCircle2 size={14} className="stroke-[3] text-emerald-400" /> Active in Account
                      </div>
                    ) : (
                      <button 
                        onClick={() => setSelectedPromo(promo)}
                        className="w-full py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-950 font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 shadow-md cursor-pointer duration-200"
                        id={`claim-btn-${promo.id}`}
                      >
                        Redeem Reward
                        <ArrowRight size={14} className="stroke-[2.5]" />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          );
        })
        )}
      </div>

      {visiblePromotions.length === 0 ? (
        <div className="bg-slate-50 rounded-3xl p-16 text-center border border-slate-100 shadow-sm" id="empty-rewards-view">
           <Gift size={48} className="mx-auto text-slate-300 mb-4 animate-bounce" />
           <p className="text-slate-500 font-bold text-lg">No rewards available yet</p>
           <p className="text-slate-400 text-xs mt-1">Make sure you have active bookings or check back later!</p>
        </div>
      ) : filteredPromotions.length === 0 ? (
        <div className="bg-slate-50 rounded-3xl p-16 text-center border border-slate-100 shadow-sm" id="empty-filtered-rewards">
           <Tag size={48} className="mx-auto text-slate-300 mb-4 animate-pulse" />
           <p className="text-slate-500 font-bold text-lg">No promotions here</p>
           <p className="text-slate-400 text-xs mt-1">Try another category or view all available rewards</p>
           <button
             onClick={() => setSelectedCategoryFilter('all')}
             className="mt-4 px-5 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:opacity-90 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md cursor-pointer"
             id="reset-category-filter"
           >
             Show All Offers
           </button>
        </div>
      ) : null}

      {/* Directory Block with Sleek Glassmorphism */}
      <section className="mt-12 sm:mt-24 rounded-[32px] sm:rounded-[40px] bg-slate-950 border border-slate-800 p-6 sm:p-12 md:p-16 relative overflow-hidden shadow-2xl" id="offers-directory">
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-gradient-to-r from-blue-500/10 to-purple-500/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-gradient-to-r from-pink-500/10 to-rose-500/5 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-white/5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 text-white/85 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-4 border border-white/10">
                <Sparkles size={10} className="text-yellow-400" />
                Service Directory
              </div>
              <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight uppercase leading-none">
                Apply Rewards <br />
                <span className="text-slate-500 italic font-medium lowercase">to top categories</span>
              </h3>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm md:text-right max-w-xs leading-relaxed font-medium">
              Pick a category to instantly browse our high-end professional roster and secure booking credits.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((cat) => {
              const Icon = ICON_MAP[cat.icon] || Sparkles;
              return (
                <motion.button
                  key={cat.id}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('home')}
                  className="flex flex-col items-center p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all duration-300 group cursor-pointer"
                  id={`directory-btn-${cat.id}`}
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/85 group-hover:bg-white group-hover:text-blue-700 group-hover:scale-110 shadow-lg group-hover:shadow-white/5 transition-all duration-300 mb-3">
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 group-hover:text-white text-center uppercase tracking-widest transition-colors line-clamp-1 w-full px-1">
                    {cat.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Redemption Modal - Centered with Slide-In Sheet */}
      <AnimatePresence>
        {selectedPromo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md" id="redemption-modal">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.3 }}
              className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col"
            >
              <div className="shrink-0 flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shadow-inner">
                    <TicketPercent size={20} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-none uppercase">Claim Reward</h3>
                    <p className="text-slate-400 text-[10px] font-bold tracking-wider mt-1 uppercase">Vouch for Service Credit</p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setSelectedPromo(null);
                    setTargetCategory('');
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors cursor-pointer"
                  title="Close Modal"
                  id="close-redemption-modal"
                >
                  <X size={18} className="stroke-[2.5]" />
                </button>
              </div>

              <div className="space-y-6 flex-1">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Offer Selected</p>
                  <h4 className="text-xl font-black text-slate-900 mt-1 uppercase italic tracking-tight">{selectedPromo.name}</h4>
                  <p className="text-slate-500 text-xs font-semibold mt-1">
                    Value: {selectedPromo.discountType === 'percent' ? `${selectedPromo.discountValue}% Discount` : `₹${selectedPromo.discountValue} Off`}
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 text-center">
                    Apply this discount to:
                  </label>
                  <div className="max-h-48 sm:max-h-64 overflow-y-auto pr-1 select-none">
                    <div className="grid grid-cols-2 gap-3 pb-1">
                      {categories.filter(c => !selectedPromo.applicableCategories || selectedPromo.applicableCategories.length === 0 || selectedPromo.applicableCategories.includes(c.id)).map(cat => (
                        <button 
                          key={cat.id}
                          onClick={() => setTargetCategory(cat.id)}
                          className={`p-3 sm:p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer ${
                            targetCategory === cat.id 
                              ? 'border-blue-700 bg-blue-50/40 text-blue-800 font-extrabold shadow-sm' 
                              : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 text-slate-600 font-semibold'
                          }`}
                          id={`select-cat-${cat.id}`}
                        >
                           <span className="text-xs sm:text-sm tracking-tight text-center">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button 
                    disabled={!targetCategory || isRedeeming}
                    onClick={handleRedeem}
                    className="w-full bg-gradient-to-r from-blue-700 to-indigo-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-95 transition-all shadow-xl shadow-blue-700/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    id="confirm-claim-btn"
                  >
                    {isRedeeming ? 'Validating Voucher...' : 'Confirm Activation'}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-4 italic font-medium">
                    This reward ticket will lock as active and automatically apply on your checkout summary page.
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
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[380px] bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white rounded-2xl p-5 shadow-2xl z-[150] flex flex-col gap-3"
            id="ios-pwa-prompt"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Smartphone size={18} className="text-white shrink-0" />
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-wider uppercase text-blue-400">Add to Home Screen</h4>
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest mt-0.5">Zomindia Web App</p>
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
                className="p-1 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors cursor-pointer"
                title="Dismiss Guide"
                id="dismiss-ios-prompt"
              >
                <X size={14} className="stroke-[2.5]" />
              </button>
            </div>
            
            <p className="text-xs text-white/85 font-medium leading-relaxed">
              Experience Zomindia directly from your iOS Home Screen. To install, tap the <span className="font-extrabold text-blue-400">Share [↑]</span> button in Safari and select <span className="font-extrabold text-blue-400">"Add to Home Screen"</span>.
            </p>
            
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-white/50 pt-2 border-t border-white/5">
              <span>⚡ Offline Access Active</span>
              <span>• Secure & Masked</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
