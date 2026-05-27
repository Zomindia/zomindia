import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Promotion, Category, Redemption } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TicketPercent, Gift, Clock, CheckCircle2, ChevronRight, X, Sparkles, Wrench, Plug, PaintBucket, Smartphone, Wind } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

// Modules
import AuthModal from './AuthModal';
import { LoadingScreen } from './LoadingIndicator';

const ICON_MAP: Record<string, any> = {
  Sparkles,
  Wrench,
  Smartphone,
  PaintBucket,
  Plug,
  Wind
};

const CATEGORY_COLORS: Record<string, string> = {
  'Cleaning': 'text-rose-500 bg-rose-50',
  'Repairs': 'text-blue-500 bg-blue-50',
  'Appliance': 'text-emerald-500 bg-emerald-50',
  'Painting': 'text-amber-500 bg-amber-50',
  'Beauty': 'text-pink-500 bg-pink-50',
  'AC Repair': 'text-cyan-500 bg-cyan-50',
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

  const isRedeemed = (promoId: string) => redemptions.some(r => r.promotionId === promoId);

  const visiblePromotions = promotions.filter(promo => {
    if (context === 'partner') {
      return promo.targetAudience === 'partner';
    } else {
      return promo.targetAudience === 'customer' || !promo.targetAudience || promo.targetAudience === 'all';
    }
  });

  if (loading) return <LoadingScreen message="Unlocking exclusive partner & customer rewards..." />;

  return (
    <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-6 md:px-8 py-8 sm:py-16 pb-32 sm:pb-20">
      <div className="relative mb-12 sm:mb-20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-12 sm:-top-24 -left-12 sm:-left-24 w-40 sm:w-64 h-40 sm:h-64 bg-indigo-500/20 rounded-full blur-[100px]"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-10 sm:-top-20 -right-10 sm:-right-20 w-48 sm:w-80 h-48 sm:h-80 bg-violet-600/10 rounded-full blur-[120px]"
        />

        <div className="relative z-10 text-center sm:text-left">
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-display font-black text-slate-900 italic tracking-tighter leading-none mb-4 sm:mb-6">
            {context === 'partner' ? 'Partner' : 'Exclusive'} <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">{context === 'partner' ? 'Rewards' : 'Unbeatable'}</span> Offers
          </h2>
          <p className="text-slate-500 text-base sm:text-lg font-medium max-w-xl leading-relaxed mx-auto sm:mx-0">
            {context === 'partner' 
              ? 'Maximize your earnings with exclusive partner rewards and bonuses.'
              : 'Premium rewards for our frequent users. Redeem exclusive promotions and save on high-end services.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
        {visiblePromotions.map((promo, i) => {
          const redeemed = isRedeemed(promo.id);
          const accentColor = i % 3 === 0 ? 'rose' : i % 3 === 1 ? 'amber' : 'stone';
          
          return (
            <motion.div 
              key={promo.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8 }}
              className={`group bg-white rounded-[48px] overflow-hidden border border-slate-100 transition-all flex flex-col h-[520px] ${redeemed ? 'opacity-70' : 'shadow-[0_32px_64px_-12px_rgba(0,0,0,0.05)] hover:shadow-[0_48px_96px_-12px_rgba(0,0,0,0.12)] hover:border-slate-200'}`}
            >
              <div className="relative h-56 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br transition-opacity duration-500 ${
                  accentColor === 'rose' ? 'from-rose-500/20 to-orange-500/20' :
                  accentColor === 'amber' ? 'from-amber-400/20 to-orange-500/20' :
                  'from-slate-900/10 to-slate-400/10'
                }`} />
                
                {promo.imageUrl ? (
                  <motion.img 
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                    src={promo.imageUrl} 
                    alt={promo.name} 
                    className="w-full h-full object-cover mix-blend-multiply opacity-80" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-200">
                    <TicketPercent size={80} strokeWidth={1} />
                  </div>
                )}
                
                <div className="absolute top-8 left-8">
                  <div className={`${
                    accentColor === 'rose' ? 'bg-rose-500' :
                    accentColor === 'amber' ? 'bg-amber-500' :
                    'bg-blue-700'
                  } text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-black/10`}>
                    <Sparkles size={14} /> {promo.discountType === 'percent' ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`}
                  </div>
                </div>
              </div>

              <div className="p-10 flex-1 flex flex-col">
                <div className="mb-auto">
                  <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight group-hover:text-rose-500 transition-colors uppercase italic">{promo.name}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 font-medium">{promo.description}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-300 mt-8 mb-10">
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl group-hover:bg-rose-50 group-hover:text-rose-400 transition-colors">
                    <Clock size={12} /> Ends in 7d
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-dashed border-slate-200">
                    <TicketPercent size={12} /> {promo.code}
                  </div>
                </div>

                <div className="mt-auto">
                  {redeemed ? (
                    <div className="w-full bg-emerald-50 text-emerald-600 py-5 rounded-3xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest border border-emerald-100">
                      <CheckCircle2 size={18} /> Offer Activated
                    </div>
                  ) : (
                    <button 
                      onClick={() => setSelectedPromo(promo)}
                      className={`w-full py-5 rounded-3xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-700/10 active:scale-95 ${
                        accentColor === 'rose' ? 'bg-rose-500 text-white hover:bg-rose-600' :
                        accentColor === 'amber' ? 'bg-amber-500 text-white hover:bg-amber-600' :
                        'bg-blue-700 text-white hover:bg-blue-800'
                      }`}
                    >
                      Redeem Reward <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {visiblePromotions.length === 0 && (
        <div className="bg-white p-20 rounded-[48px] border border-slate-100 text-center mb-16">
           <Gift size={48} className="mx-auto text-slate-100 mb-6" />
           <p className="text-slate-400 font-medium italic">No active promotions at the moment. Check back soon!</p>
        </div>
      )}

      {/* Categories Grid - Urban Company Style with Gradient Background */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[56px] p-10 sm:p-14 md:p-20 shadow-2xl relative overflow-hidden mb-24 sm:mb-20" id="categories-grid">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] -z-0" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] -z-0" />
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-6">
                Explore Sectors
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                What are <br className="hidden sm:block" />
                <span className="text-slate-500 not-italic">you looking for?</span>
              </h2>
            </div>
            <p className="text-slate-400 font-medium text-lg max-w-xs md:text-right">Select a sector to apply your exclusive rewards.</p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-6 gap-6 sm:gap-8">
            {categories.map((cat) => {
              const Icon = ICON_MAP[cat.icon] || Sparkles;
              return (
                <motion.button
                  key={cat.id}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setActiveTab('home');
                  }}
                  className="flex flex-col items-center group transition-all"
                >
                  <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-[28px] sm:rounded-[32px] bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center transition-all duration-500 mb-4 group-hover:bg-white group-hover:scale-110 shadow-xl group-hover:shadow-white/10 text-white group-hover:text-blue-700 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Icon size={24} className="sm:hidden relative z-10" strokeWidth={1.5} />
                    <Icon size={32} className="hidden sm:block relative z-10" strokeWidth={1.5} />
                  </div>
                  <span className="text-[8px] sm:text-[10px] font-black text-slate-400 group-hover:text-white text-center uppercase tracking-widest transition-colors line-clamp-1 w-full px-1">
                    {cat.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Redemption Modal */}
      <AnimatePresence>
        {selectedPromo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-700/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[48px] p-10 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col"
            >
              <div className="shrink-0">
                <button 
                  onClick={() => setSelectedPromo(null)}
                  className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors z-10"
                >
                  <X size={20} />
                </button>

                <div className="mb-10 text-center">
                   <div className="w-20 h-20 bg-blue-700 text-white rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-700/20">
                      <TicketPercent size={32} />
                   </div>
                   <h3 className="text-2xl font-bold text-slate-900 italic">Activate Promotion</h3>
                   <p className="text-slate-400 text-sm mt-2">Select a category to apply your {selectedPromo.discountType === 'percent' ? `${selectedPromo.discountValue}%` : `₹${selectedPromo.discountValue}`} discount.</p>
                </div>
              </div>

              <div className="space-y-6 flex-1">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 text-center">Target Category</label>
                  <div className="grid grid-cols-2 gap-3">
                    {categories.filter(c => !selectedPromo.applicableCategories || selectedPromo.applicableCategories.length === 0 || selectedPromo.applicableCategories.includes(c.id)).map(cat => (
                      <button 
                        key={cat.id}
                        onClick={() => setTargetCategory(cat.id)}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 group ${targetCategory === cat.id ? 'border-blue-700 bg-slate-50' : 'border-slate-50 bg-slate-50/50 hover:border-slate-100'}`}
                      >
                         <span className={`text-sm font-bold ${targetCategory === cat.id ? 'text-slate-900' : 'text-slate-500'}`}>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    disabled={!targetCategory || isRedeeming}
                    onClick={handleRedeem}
                    className="w-full bg-blue-700 text-white py-5 rounded-3xl font-bold hover:bg-blue-800 transition-all shadow-2xl shadow-blue-700/20 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-xs font-black"
                  >
                    {isRedeeming ? 'Validating...' : 'Claim Reward'}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-6 italic font-medium">This offer will be automatically applied at your next checkout in the selected category.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
