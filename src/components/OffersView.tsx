import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, getDocs, Timestamp } from 'firebase/firestore';
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
  ArrowRight
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
  Wind
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

  useEffect(() => {
    const unsubPromos = onSnapshot(query(collection(db, 'promotions'), where('active', '==', true)), (snap) => {
      setPromotions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion)));
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
  }, [profile]);

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
      const redemptionData: Partial<Redemption> = {
        userId: profile.uid,
        promotionId: selectedPromo.id,
        redeemedAt: Timestamp.now(),
        status: 'active',
        appliedCategoryId: targetCategory || (selectedPromo.applicableCategories?.[0] || ''),
      };
      await addDoc(collection(db, 'redemptions'), redemptionData);
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
    (window as any).__showCopyToast?.(code);
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

  if (loading) return <LoadingScreen message="Unlocking exclusive partner & customer rewards..." />;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-12 pb-14 sm:pb-24 overflow-x-hidden">
      
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
              <Sparkles size={10} className="fill-current animate-pulse" />
              {context === 'partner' ? 'Partner Club' : 'Exclusive Access'}
            </div>
            <h2 className="text-xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none uppercase">
              {context === 'partner' ? 'Partner' : 'Member'} <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 italic">Privilege</span> Rewards
            </h2>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm font-medium max-w-sm mx-auto sm:mx-0 sm:text-right leading-relaxed">
            {context === 'partner' 
              ? 'Accelerate and amplify your earnings with high-tier partner benefits and loyalty payouts.'
              : 'Unlock premium incentives curated specifically for loyal patrons. Activate voucher keys to save on your next checkout.'}
          </p>
        </div>
      </div>

      {/* Category Filter Pills (Optimized Touch Carousel) */}
      <div 
        className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth items-center select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <button
          onClick={() => setSelectedCategoryFilter('all')}
          className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
            selectedCategoryFilter === 'all'
              ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20 ring-1 ring-blue-700'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
          }`}
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
              className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                selectedCategoryFilter === cat.id
                  ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20 ring-1 ring-blue-700'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
              }`}
            >
              {cat.name}
              <span className={`text-[8px] font-black leading-none px-1.5 py-0.5 rounded-full ${
                selectedCategoryFilter === cat.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid of Offers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 justify-center">
        {filteredPromotions.map((promo, i) => {
          const redeemed = isRedeemed(promo.id);
          // Cyclic palettes for high visual flavor
          const stylePalette = [
            { bg: 'from-blue-500/10 to-indigo-600/10', text: 'text-blue-600', badge: 'bg-blue-600 text-white shadow-blue-500/30', border: 'hover:border-blue-200', ripple: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/10' },
            { bg: 'from-rose-500/10 to-pink-600/10', text: 'text-rose-600', badge: 'bg-rose-600 text-white shadow-rose-500/30', border: 'hover:border-rose-200', ripple: 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10' },
            { bg: 'from-amber-500/10 to-orange-600/10', text: 'text-amber-600', badge: 'bg-amber-600 text-white shadow-amber-500/30', border: 'hover:border-amber-200', ripple: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/10' },
          ][i % 3];

          return (
            <motion.div 
              key={promo.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -6 }}
              className={`group relative bg-white rounded-3xl overflow-hidden border border-slate-100/90 flex flex-col min-h-[340px] sm:min-h-[440px] md:min-h-[470px] transition-all duration-300 ${
                redeemed ? 'opacity-80' : 'shadow-[0_16px_32px_-12px_rgba(15,23,42,0.04)] hover:shadow-[0_48px_64px_-24px_rgba(15,23,42,0.12)]'
              } ${stylePalette.border}`}
            >
              {/* Media Container */}
              <div className="relative h-32 sm:h-44 md:h-48 w-full overflow-hidden bg-slate-50">
                <div className={`absolute inset-0 bg-gradient-to-br ${stylePalette.bg} mix-blend-multiply opacity-100`} />
                
                {promo.imageUrl ? (
                  <motion.img 
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.6 }}
                    src={promo.imageUrl} 
                    alt={promo.name} 
                    className="w-full h-full object-cover mix-blend-multiply filter contrast-[1.02] brightness-95 opacity-90" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Gift size={64} strokeWidth={1} className="opacity-40" />
                  </div>
                )}

                {/* Glow Overlay with accent */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent pointer-events-none" />

                {/* Floating Discount Badge */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider ${stylePalette.badge} shadow-lg backdrop-blur-md`}>
                    <Tag size={10} className="stroke-[2.5]" />
                    {promo.discountType === 'percent' ? `${promo.discountValue}% Off` : `₹${promo.discountValue} Off`}
                  </span>
                </div>

                {/* Urgency Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div className="h-full bg-white/85 animate-[pulse_2s_infinite] w-[85%]" />
                </div>
              </div>

              {/* Informative Content Area */}
              <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#2563eb] bg-blue-50/70 px-2.5 py-1 rounded-lg">
                      {promo.applicableCategories && promo.applicableCategories.length > 0 ? 'Category Specific' : 'Global Saver'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Clock size={11} /> 7 Days Left
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 line-clamp-1 truncate uppercase italic tracking-tight mb-1.5">
                    {promo.name}
                  </h3>
                  <p className="text-slate-500 text-xs md:text-sm leading-relaxed line-clamp-3 mb-4 sm:mb-6 font-medium">
                    {promo.description}
                  </p>
                </div>

                {/* Promo Code Copy and Claim CTA */}
                <div className="space-y-3 sm:space-y-4 mt-auto">
                  {/* Coupon Copy Pod */}
                  <div 
                    onClick={() => copyToClipboard(promo.code)}
                    className="group/code flex flex-row items-center justify-between gap-1.5 p-2 px-3 sm:p-3 rounded-xl sm:rounded-2xl border-2 border-dashed border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 cursor-pointer overflow-hidden"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TicketPercent size={13} className="text-slate-400 group-hover/code:text-slate-600 shrink-0" />
                      <span className="font-mono text-[11px] sm:text-xs font-black text-slate-700 tracking-wider truncate">
                        {promo.code}
                      </span>
                    </div>

                    <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider flex items-center gap-1 text-slate-400 group-hover/code:text-blue-700 transition-colors shrink-0">
                      {copiedCode === promo.code ? (
                        <>
                          <Check size={10} className="stroke-[3]" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={10} /> Copy Code
                        </>
                      )}
                    </div>
                  </div>

                  {/* Main Action Button */}
                  <div>
                    {redeemed ? (
                      <div className="w-full bg-emerald-50 text-emerald-600 py-3.5 sm:py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest border border-emerald-100 select-none">
                        <CheckCircle2 size={14} className="stroke-[3]" /> Active in Account
                      </div>
                    ) : (
                      <button 
                        onClick={() => setSelectedPromo(promo)}
                        className={`w-full py-3.5 sm:py-4 rounded-2xl text-white font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-lg cursor-pointer ${stylePalette.ripple}`}
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
        })}
      </div>

      {visiblePromotions.length === 0 ? (
        <div className="bg-slate-50 rounded-3xl p-16 text-center border border-slate-100">
           <Gift size={48} className="mx-auto text-slate-300 mb-4 animate-bounce" />
           <p className="text-slate-500 font-bold text-lg">No rewards available yet</p>
           <p className="text-slate-400 text-xs mt-1">Make sure you have active bookings or check back later!</p>
        </div>
      ) : filteredPromotions.length === 0 ? (
        <div className="bg-slate-50 rounded-3xl p-16 text-center border border-slate-100">
           <Tag size={48} className="mx-auto text-slate-300 mb-4 animate-pulse" />
           <p className="text-slate-500 font-bold text-lg">No promotions here</p>
           <p className="text-slate-400 text-xs mt-1">Try another category or view all available rewards</p>
           <button
             onClick={() => setSelectedCategoryFilter('all')}
             className="mt-4 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md cursor-pointer"
           >
             Show All Offers
           </button>
        </div>
      ) : null}

      {/* High-End Sector Explorer Block with Dark Sleek Glassmorphism */}
      <section className="mt-12 sm:mt-24 rounded-[24px] sm:rounded-[40px] bg-slate-900 border border-slate-800 p-6 sm:p-12 md:p-16 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-gradient-to-r from-blue-500/20 to-purple-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-gradient-to-r from-pink-500/15 to-rose-500/5 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-white/5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-white/90 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-4 border border-white/10">
                <Sparkles size={10} className="text-yellow-400" />
                Service Directory
              </div>
              <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight uppercase leading-none">
                Apply Rewards <br />
                <span className="text-slate-400 italic font-medium lowercase">to top categories</span>
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
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80 group-hover:bg-white group-hover:text-blue-700 group-hover:scale-110 shadow-lg group-hover:shadow-white/5 transition-all duration-300 mb-3">
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

      {/* Redemption Modal - Centered and Slide-In Slide-Out Sheet */}
      <AnimatePresence>
        {selectedPromo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.3 }}
              className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col"
            >
              <div className="shrink-0 flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
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
                          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer ${
                            targetCategory === cat.id 
                              ? 'border-blue-700 bg-blue-50/40 text-blue-800 font-extrabold shadow-sm' 
                              : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 text-slate-600 font-semibold'
                          }`}
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
                    className="w-full bg-blue-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
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
    </div>
  );
}
