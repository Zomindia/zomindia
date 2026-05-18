import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Category, Service, UserProfile, PartnerProfile, Promotion } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import BookingModal from './BookingModal';
import { ImageCarousel } from './ServiceDetails';
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
  CheckCircle2,
  PhoneCall,
  MessageCircle,
  Zap,
  Copy,
  Check,
  Plus,
  MapPin
} from 'lucide-react';

interface Props {
  setActiveTab: (tab: any) => void;
  profile: UserProfile | null;
  onAuthRequired: () => void;
  onServiceSelect: (id: string) => void;
}

interface PartnerWithInfo extends PartnerProfile {
  displayName: string;
  photoURL?: string;
}

const SAMPLE_CATEGORIES = [
  { id: '1', name: 'Cleaning', icon: 'Sparkles', description: 'Deep cleaning, sofa & carpet' },
  { id: '2', name: 'Repairs', icon: 'Wrench', description: 'Plumbing, Electrician, Carpenter' },
  { id: '3', name: 'Appliance', icon: 'Smartphone', description: 'AC, TV, Refrigerator, RO' },
  { id: '4', name: 'Painting', icon: 'PaintBucket', description: 'Full house painting' },
  { id: '5', name: 'Beauty', icon: 'Sparkles', description: 'Salon at home for women' },
  { id: '6', name: 'Appliance Repair', icon: 'Smartphone', description: 'Repair services for electronics, home appliances, and gadgets' },
  { id: 'Phone Repair', name: 'Phone Repair', icon: 'Smartphone', description: 'Expert repair services for all smartphone brands' },
];

const ICON_MAP: Record<string, any> = {
  Sparkles,
  Wrench,
  Smartphone,
  PaintBucket,
  Plug,
  Wind
};

const ICON_COLORS: Record<string, string> = {
  Sparkles: 'text-rose-500',
  Wrench: 'text-blue-500',
  Smartphone: 'text-slate-700',
  PaintBucket: 'text-amber-500',
  Plug: 'text-emerald-500',
  Wind: 'text-cyan-500',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Cleaning': 'text-rose-500 bg-rose-50',
  'Repairs': 'text-blue-500 bg-blue-50',
  'Appliance': 'text-emerald-500 bg-emerald-50',
  'Painting': 'text-amber-500 bg-amber-50',
  'Beauty': 'text-pink-500 bg-pink-50',
  'AC Repair': 'text-cyan-500 bg-cyan-50',
};

export default function CustomerHome({ setActiveTab, profile, onAuthRequired, onServiceSelect }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [partners, setPartners] = useState<PartnerWithInfo[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
     const q = query(collection(db, 'promotions'), where('active', '==', true));
     getDocs(q).then(snap => {
       setPromotions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion)));
     }).catch(err => console.error("Error fetching promos:", err));
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      const path = 'categories';
      try {
        const q = query(collection(db, path), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        const cats = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        
        if (cats.length === 0) {
          setCategories(SAMPLE_CATEGORIES as Category[]);
          setAllCategories(SAMPLE_CATEGORIES as Category[]);
        } else {
          setCategories(cats);
          setAllCategories(cats);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
        setCategories(SAMPLE_CATEGORIES as Category[]);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchAllServices = async () => {
      try {
        const snap = await getDocs(collection(db, 'services'));
        setAllServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
      } catch (err) {
        console.error("Error fetching all services:", err);
      }
    };
    fetchAllServices();
  }, []);

  const filteredSearchResults = searchQuery.trim() === '' 
    ? [] 
    : allServices.filter(service => {
        const query = searchQuery.toLowerCase();
        const category = allCategories.find(c => c.id === service.categoryId);
        return (
          service.name.toLowerCase().includes(query) ||
          service.description.toLowerCase().includes(query) ||
          category?.name.toLowerCase().includes(query)
        );
      });

  useEffect(() => {
    if (selectedCategory) {
      const fetchServices = async () => {
        const path = 'services';
        try {
          const q = query(collection(db, path), where('categoryId', '==', selectedCategory.id));
          const snap = await getDocs(q);
          setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, path);
        }
      };

      const fetchPartners = async () => {
        try {
          const q = query(
            collection(db, 'partners'), 
            where('categories', 'array-contains', selectedCategory.id),
            where('status', '==', 'active')
          );
          const snap = await getDocs(q);
          const partnerList = await Promise.all(snap.docs.map(async (d) => {
            const data = d.data() as PartnerProfile;
            const userDoc = await getDoc(doc(db, 'users', data.userId));
            const userData = userDoc.data() as UserProfile;
            return {
              ...data,
              id: d.id,
              displayName: userData?.displayName || 'Service Pro',
              photoURL: userData?.photoURL
            };
          }));
          setPartners(partnerList);
        } catch (err) {
          console.warn('Silent skip partner fetch:', err);
        }
      };

      fetchServices();
      fetchPartners();
    }
  }, [selectedCategory]);

  if (selectedCategory) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button 
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-700 mb-12 font-semibold transition-all hover:translate-x-[-4px]"
        >
          <ChevronLeft size={20} /> Back to home
        </button>

        <div className="flex flex-col lg:flex-row justify-between items-start gap-12 mb-16 px-2">
          <div className="flex-1">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider mb-6"
            >
              <Sparkles size={12} /> {selectedCategory.name}
            </motion.div>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-6">{selectedCategory.name}</h2>
            <p className="text-lg text-slate-500 max-w-xl font-medium leading-relaxed">{selectedCategory.description || 'Verified professional home services delivered with care.'}</p>
          </div>
          {selectedCategory.images && selectedCategory.images.length > 0 ? (
             <div className="w-full lg:w-1/3">
                <ImageCarousel images={selectedCategory.images} />
             </div>
          ) : selectedCategory.imageURL ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-full lg:w-1/3 aspect-video lg:aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-slate-100"
            >
              <img src={selectedCategory.imageURL} className="w-full h-full object-cover" alt={selectedCategory.name} referrerPolicy="no-referrer" />
            </motion.div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
          {services.map((service, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={service.id}
              onClick={() => onServiceSelect(service.id)}
              className="bg-white p-8 border border-slate-100 rounded-3xl hover:border-blue-700 transition-all shadow-sm hover:shadow-xl group flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                   <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-900 group-hover:bg-blue-700 group-hover:text-white transition-all duration-300">
                     <Zap size={22} strokeWidth={1.5} />
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Starting from</p>
                      <p className="text-xl font-bold text-slate-900">₹{service.basePrice}</p>
                   </div>
                </div>
                <h3 
                  className="text-xl font-bold mb-3 hover:text-slate-600 transition-colors"
                >
                  {service.name}
                </h3>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center text-amber-500">
                    <Star size={12} fill="currentColor" />
                    <span className="text-xs font-bold text-slate-900 ml-1">{service.rating || 4.8}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium tracking-wide">• {service.duration || '60 mins'}</span>
                </div>
                {service.imageURL && (
                  <div className="w-full h-40 rounded-2xl overflow-hidden mb-6 bg-slate-50 border border-slate-100">
                    <img src={service.imageURL} alt={service.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" />
                  </div>
                )}
                <p className="text-slate-500 text-sm mb-8 leading-relaxed line-clamp-2 font-medium opacity-80">{service.description}</p>
              </div>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => profile ? setSelectedService(service) : onAuthRequired()}
                  className="w-full bg-blue-700 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-blue-800 transition-all active:scale-95 shadow-lg shadow-blue-700/5"
                >
                  Book now
                </button>
                <button 
                  onClick={() => onServiceSelect(service.id)}
                  className="w-full py-2 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-blue-700 transition-colors"
                >
                  View details
                </button>
              </div>
            </motion.div>
          ))}
          {services.length === 0 && (
             <div className="col-span-full py-20 text-center text-slate-400 font-medium bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-100">
               No services found in this category. We are working on it!
             </div>
          )}
        </div>

        {partners.length > 0 && (
          <div className="mt-20">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Featured Partners</h3>
                <p className="text-slate-500">Top-rated professionals specializing in {selectedCategory.name}.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {partners.map((partner) => (
                <div key={partner.id} className="bg-slate-50 p-8 rounded-[40px] flex flex-col sm:flex-row gap-8 hover:bg-white border border-transparent hover:border-slate-200 transition-all group">
                  <div className="relative flex-shrink-0">
                    <img 
                      src={partner.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.displayName}`} 
                      alt={partner.displayName}
                      className="w-24 h-24 rounded-3xl object-cover bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -bottom-2 -right-2 flex flex-col items-end gap-1">
                      <div className={`p-1.5 bg-white rounded-full shadow-sm border border-slate-100 ${partner.isVerified ? 'text-emerald-500' : 'text-slate-300'}`}>
                         {partner.isVerified ? (
                           <CheckCircle2 size={16} fill="currentColor" className="text-white fill-emerald-500" />
                         ) : (
                           <div className="w-4 h-4 bg-slate-100 rounded-full" />
                         )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="mb-2">
                       <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                         partner.isVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                       }`}>
                          {partner.isVerified ? 'KYC Verified' : 'KYC Not Verified'}
                       </span>
                    </div>
                    <div className="flex justify-between items-start mb-2">
                       <h4 className="text-xl font-bold text-slate-900">{partner.displayName}</h4>
                       <div className="flex items-center gap-1 text-sm font-bold text-slate-900 border border-slate-200 px-3 py-1 rounded-full bg-white">
                         <Star size={14} fill="currentColor" className="text-amber-400" /> {partner.rating || 'New'}
                       </div>
                    </div>
                    {partner.bio && <p className="text-slate-500 text-sm mb-4 line-clamp-2 italic">"{partner.bio}"</p>}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {partner.categories.slice(0, 3).map((catId) => {
                        const cat = categories.find(c => c.id === catId);
                        return cat ? (
                          <span key={catId} className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                            #{cat.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <button className="text-sm font-bold text-slate-900 flex items-center gap-2 group-hover:gap-3 transition-all">
                      View Profile <ArrowRight size={16} />
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
              onSuccess={() => setActiveTab('home')}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-20">
      {profile?.role === 'partner' && (
        <div className="bg-amber-50 border-b border-amber-100 py-3 px-4 flex items-center justify-center gap-3 sticky top-20 z-[40]">
          <div className="p-1.5 bg-amber-500 rounded-lg text-white">
            <ShieldCheck size={16} />
          </div>
          <p className="text-amber-900 text-xs font-bold uppercase tracking-widest leading-none">
            Partner Reference Mode: <span className="font-medium normal-case tracking-normal text-amber-700 ml-1">You can explore services but booking is restricted for partners.</span>
          </p>
        </div>
      )}      {/* Hero Section */}
      <section className="relative h-[400px] md:h-[500px] flex items-center justify-center overflow-hidden bg-blue-700">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1581578731548-c64695ce6958?auto=format&fit=crop&q=80&w=2000" 
            className="w-full h-full object-cover opacity-40 mix-blend-multiply"
            alt="Cleaner working"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/60 via-blue-900/40 to-slate-900/90" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center mt-12">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight font-display drop-shadow-lg"
            >
              Quality home services, on demand
            </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-blue-50 mb-8 font-medium drop-shadow-md max-w-2xl mx-auto"
          >
            Trusted experts for cleaning, repairs, and beauty at home.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative max-w-3xl mx-auto mb-10"
          >
            <div className="relative flex items-center bg-white rounded-[24px] shadow-2xl p-2 border border-white/20 backdrop-blur-sm">
               <div className="flex items-center px-4 gap-2 border-r border-slate-100">
                  <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm font-black text-xs tracking-tighter">
                    Z
                  </div>
                  <span className="hidden sm:block text-xs font-black text-slate-900 italic tracking-tighter">zomindia</span>
               </div>
              <input 
                type="text" 
                placeholder="Search AC repair, cleaning, plumbing..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 sm:px-6 py-4 bg-transparent focus:outline-none text-slate-800 font-bold text-base sm:text-lg placeholder:text-slate-400 placeholder:font-medium"
              />
              <button 
                className="bg-blue-700 text-white px-6 sm:px-8 py-4 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/20 active:scale-95 shrink-0"
              >
                Search
              </button>
            </div>
            {/* Search Results Dropdown */}
            <AnimatePresence>
              {searchQuery && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 right-0 top-full mt-4 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 text-left"
                >
                   {filteredSearchResults.length > 0 ? (
                      <div className="max-h-[300px] overflow-y-auto py-2">
                        {filteredSearchResults.map(service => (
                          <button
                            key={service.id}
                            onClick={() => {
                              onServiceSelect(service.id);
                              setSearchQuery('');
                            }}
                            className="w-full px-6 py-4 hover:bg-slate-50 flex items-center gap-4 transition-colors"
                          >
                             <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden">
                               <img src={service.imageURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                             </div>
                             <div>
                               <p className="font-bold text-slate-900">{service.name}</p>
                               <p className="text-xs text-slate-400">Starting from ₹{service.basePrice}</p>
                             </div>
                          </button>
                        ))}
                      </div>
                   ) : (
                      <div className="p-8 text-center text-slate-400 font-medium text-sm">
                        No results found for "{searchQuery}"
                      </div>
                   )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 relative z-20">
        
        {/* Categories Grid */}
        <section className="mb-8" id="categories-grid">
          <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-y-6 gap-x-2">
            {categories.map((cat, i) => {
              const Icon = ICON_MAP[cat.icon] || Sparkles;
              return (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  onClick={(e) => {
                    setSelectedCategory(cat);
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="flex flex-col items-center group transition-all"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl flex items-center justify-center transition-all duration-300 mb-2 shadow-sm border border-slate-100 group-hover:border-blue-500 group-hover:shadow-md">
                    {cat.iconURL ? (
                      <motion.img 
                        whileHover={{ scale: 1.1, rotate: 3 }}
                        src={cat.iconURL} 
                        alt={cat.name} 
                        className="w-6 h-6 object-contain" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <motion.div
                        whileHover={{ scale: 1.15 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                      >
                        <Icon size={24} className={`transition-colors duration-300 ${ICON_COLORS[cat.icon] || 'text-slate-600'} group-hover:text-blue-700`} />
                      </motion.div>
                    )}
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-600 text-center px-1 tracking-tight leading-tight">
                    {cat.name}
                  </span>
                </motion.button>
              );
            })}
            
            <motion.button
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ delay: categories.length * 0.05 }}
               className="flex flex-col items-center group transition-all"
            >
               <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl flex items-center justify-center transition-all duration-300 mb-2 shadow-sm border border-slate-100 group-hover:border-blue-500 group-hover:shadow-md">
                 <div className="flex gap-1">
                   <div className="w-1 h-1 bg-slate-400 rounded-full" />
                   <div className="w-1 h-1 bg-slate-400 rounded-full" />
                   <div className="w-1 h-1 bg-slate-400 rounded-full" />
                 </div>
               </div>
               <span className="text-[10px] sm:text-xs font-semibold text-slate-600 text-center px-1 tracking-tight leading-tight">
                 More
               </span>
            </motion.button>
          </div>
        </section>

        {/* Promo Banner - AC Service mock */}
        <section className="mb-10 max-w-3xl">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100/50 shadow-sm flex items-center justify-between relative overflow-hidden group cursor-pointer">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-blue-100/30 -skew-x-12 translate-x-10 group-hover:translate-x-0 transition-transform duration-500" />
            <div className="relative z-10 w-2/3">
              <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-1 block">AC Service</span>
              <h3 className="text-2xl font-black text-blue-700 mb-1 tracking-tight">Up to 20% OFF</h3>
              <p className="text-xs text-slate-600 font-medium">Cool Summer Deals</p>
            </div>
            <div className="relative z-10 w-[80px] h-[60px] opacity-80 group-hover:opacity-100 transition-opacity">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-blue-600"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h12"/><path d="M6 14h12"/></svg>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="mb-20 max-w-3xl">
          <h3 className="text-sm font-bold text-slate-800 mb-4 px-1">Why Choose Us?</h3>
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                   <ShieldCheck size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight">Verified<br className="hidden sm:block"/> Professionals</span>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                   <Clock size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight">Upfront<br className="hidden sm:block"/> Pricing</span>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                   <Zap size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight">On-Time<br className="hidden sm:block"/> Service</span>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                   <Star size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight">100%<br className="hidden sm:block"/> Satisfaction</span>
             </div>
          </div>
        </section>

        {/* Promotions Carousel/Grid */}
        {promotions.length > 0 && (
          <section className="mb-20">
            <div className="flex justify-between items-end mb-8 px-2">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-1">New and noteworthy</h3>
                <p className="text-slate-500 font-medium">Exclusive offers for premium home care</p>
              </div>
              <button 
                onClick={() => setActiveTab('offers')}
                className="text-sm font-bold text-slate-900 hover:underline"
              >
                See all
              </button>
            </div>
            <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8 px-2">
              {promotions.map((promo, idx) => {
                const gradients = [
                  'from-blue-600 to-indigo-700',
                  'from-rose-500 to-pink-600',
                  'from-amber-500 to-orange-600',
                  'from-emerald-500 to-teal-600',
                ];
                const gradient = gradients[idx % gradients.length];
                
                return (
                  <div 
                    key={promo.id}
                    className="flex-shrink-0 w-[320px] sm:w-[420px] h-[220px] rounded-[32px] relative overflow-hidden group shadow-xl transition-all hover:scale-[1.02] active:scale-95"
                  >
                    {/* Colorful Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
                    
                    {/* Decorative Circles */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-black/10 rounded-full blur-xl" />

                    {promo.imageUrl && (
                      <img src={promo.imageUrl} className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30" alt="" referrerPolicy="no-referrer" />
                    )}

                    <div className="relative h-full p-8 flex flex-col justify-between z-10 text-white">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/20">
                            Special Offer
                          </span>
                          {promo.discountValue && (
                            <span className="text-3xl font-black italic tracking-tighter">
                              {promo.discountType === 'percent' ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`}
                            </span>
                          )}
                        </div>
                        <h4 className="text-2xl font-bold mb-2 leading-tight">{promo.name}</h4>
                        <p className="text-white/80 text-sm line-clamp-1 font-medium">{promo.description}</p>
                      </div>

                      <div className="flex items-center justify-between gap-4 mt-auto">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/60 mb-1 font-mono">Promo Code</span>
                          <div className="bg-black/20 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
                            <code className="text-lg font-black tracking-widest font-mono">{promo.code}</code>
                          </div>
                        </div>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(promo.code);
                            setCopiedCode(promo.code);
                            setTimeout(() => setCopiedCode(null), 2000);
                          }}
                          className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-slate-100 transition-all shadow-lg active:scale-95"
                        >
                          {copiedCode === promo.code ? (
                            <><Check size={16} /> Copied</>
                          ) : (
                            <><Copy size={16} /> Copy Code</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Value Props / Trust */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 flex items-start gap-5">
             <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-900 shrink-0">
                <ShieldCheck size={24} />
             </div>
             <div>
                <h4 className="font-bold text-slate-900 mb-2">Verified Experts</h4>
                <p className="text-sm text-slate-500 font-medium">Every professional on zomindia is background-checked and vetted for quality.</p>
             </div>
          </div>
          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 flex items-start gap-5">
             <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-900 shrink-0">
                <Clock size={24} />
             </div>
             <div>
                <h4 className="font-bold text-slate-900 mb-2">On-time Every time</h4>
                <p className="text-sm text-slate-500 font-medium">We value your time. Our partners are trained to be punctual for every booking.</p>
             </div>
          </div>
          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 flex items-start gap-5">
             <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-900 shrink-0">
                <Star size={24} />
             </div>
             <div>
                <h4 className="font-bold text-slate-900 mb-2">Quality Guaranteed</h4>
                <p className="text-sm text-slate-500 font-medium">Not satisfied with the service? We will rework it for free or refund your payment.</p>
             </div>
          </div>
        </section>

        {/* Top Rated Services */}
        <section className="mb-20 px-2" id="categories-section">
          <div className="flex justify-between items-end mb-8 px-2">
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">Top Rated Home Services</h3>
              <p className="text-slate-500 font-medium">Hand-picked services based on user satisfaction</p>
            </div>
            <button 
              onClick={() => {
                const el = document.getElementById('categories-grid');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-bold text-slate-900 hover:underline"
            >
              See all categories
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
            {allServices
              .filter(s => s.rating && s.rating >= 4.5)
              .slice(0, 4)
              .map((service, idx) => (
                <motion.div 
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => onServiceSelect(service.id)}
                  className="bg-white rounded-3xl border border-slate-100 p-6 hover:border-blue-700 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-square rounded-2xl overflow-hidden mb-4 bg-slate-50 border border-slate-100">
                       <img src={service.imageURL || 'https://images.unsplash.com/photo-1581578731548-c64695cc6954?auto=format&fit=crop&q=80&w=400'} alt={service.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-lg flex items-center gap-1 text-[10px] font-bold">
                        <Star size={10} fill="currentColor" /> {service.rating}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{allCategories.find(c => c.id === service.categoryId)?.name}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">{service.name}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{service.description}</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                     <p className="font-bold text-sm text-slate-900">₹{service.basePrice}</p>
                     <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-700 transition-all group-hover:translate-x-1" />
                  </div>
                </motion.div>
              ))}
          </div>
        </section>

        {/* Featured Spotlight */}
        <section className="mb-20 px-4">
           <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-1">Services in Focus</h3>
                <p className="text-slate-500 font-medium">Premium offerings with exceptional track records</p>
              </div>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {allServices
                .filter(s => s.imageURL)
                .slice(4, 6)
                .map((service, idx) => (
                  <motion.div 
                    key={service.id}
                    initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    onClick={() => onServiceSelect(service.id)}
                    className="group relative h-80 rounded-[40px] overflow-hidden cursor-pointer shadow-xl"
                  >
                    <img 
                      src={service.imageURL} 
                      alt={service.name} 
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute inset-x-8 bottom-8 text-white">
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2 block">{allCategories.find(c => c.id === service.categoryId)?.name}</span>
                       <h4 className="text-3xl font-bold mb-3">{service.name}</h4>
                       <div className="flex items-center gap-6">
                          <p className="text-xl font-bold">₹{service.basePrice}</p>
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                             <Star size={14} fill="currentColor" className="text-amber-400" />
                             <span className="text-sm font-bold">{service.rating}</span>
                          </div>
                          <button className="ml-auto w-10 h-10 bg-white text-slate-900 rounded-full flex items-center justify-center group-hover:bg-blue-700 group-hover:text-white transition-all shadow-lg active:scale-95">
                             <ArrowRight size={20} />
                          </button>
                       </div>
                    </div>
                  </motion.div>
                ))}
           </div>
        </section>

        {/* Recently Launched */}
        <section className="mb-20 px-2 overflow-hidden">
           <div className="px-4 mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-1">Recently Launched</h3>
              <p className="text-slate-500 font-medium">New additions to our service portfolio</p>
           </div>
           
           <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8 px-4">
              {allServices
                .slice(6, 12)
                .map((service, idx) => (
                  <motion.div 
                    key={service.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => onServiceSelect(service.id)}
                    className="flex-shrink-0 w-[280px] bg-white rounded-3xl border border-slate-100 p-6 hover:shadow-xl transition-all cursor-pointer group"
                  >
                    <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-4 bg-slate-50 border border-slate-100">
                       <img src={service.imageURL || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=400'} alt={service.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">New Arrival</span>
                    <h4 className="font-bold text-slate-900 mb-4 line-clamp-1">{service.name}</h4>
                    <div className="flex items-center justify-between">
                       <p className="font-bold text-slate-900">₹{service.basePrice}</p>
                       <div className="flex items-center gap-1 text-amber-500">
                          <Star size={12} fill="currentColor" />
                          <span className="text-xs font-bold text-slate-900">New</span>
                       </div>
                    </div>
                  </motion.div>
                ))}
                {allServices.length < 8 && (
                   <div className="flex-shrink-0 w-[280px] bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                      <Plus size={32} className="mb-4 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest">More coming soon</p>
                   </div>
                )}
           </div>
        </section>

        {/* Why Choose Us */}
        <section className="mb-20 px-4">
          <div className="flex flex-col md:flex-row items-center gap-16 bg-blue-700 rounded-[48px] p-12 md:p-20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="flex-1 space-y-8 z-10 text-center md:text-left">
               <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
                 We are changing the way India lives.
               </h2>
               <div className="space-y-6">
                  {[
                    { title: 'Standardized Prices', desc: 'No hidden costs. Pay exactly what you see on the app.' },
                    { title: 'Professional Experts', desc: 'Background-verified and trained by industry leaders.' },
                    { title: 'Service Warranty', desc: 'Every service is backed by our protection program.' }
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col md:flex-row items-center md:items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-1">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <h4 className="text-white font-bold mb-1">{item.title}</h4>
                        <p className="text-slate-400 text-sm">{item.desc}</p>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
            
            <div className="flex-1 relative">
               <img 
                 src="https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&q=80&w=1000" 
                 alt="Professional Service" 
                 className="w-full h-[400px] object-cover rounded-3xl shadow-2xl relative z-10"
                 referrerPolicy="no-referrer"
               />
               <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-slate-100 rounded-3xl -z-0" />
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="bg-slate-50 rounded-[40px] py-20 px-8 mb-20 border border-slate-100">
          <div className="text-center mb-16">
             <h2 className="text-3xl font-bold text-slate-900 mb-4">How it works</h2>
             <p className="text-slate-500 font-medium max-w-lg mx-auto italic">Simple, transparent, and reliable service at your doorstep in 4 easy steps.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
             {[
               { title: 'Choose a service', desc: 'Select from our wide range of documented home services.', icon: Search },
               { title: 'Choose a slot', desc: 'Pick a time that works best for your schedule.', icon: Clock },
               { title: 'OTP Verification', desc: 'Secure handshake with your service partner upon arrival.', icon: ShieldCheck },
               { title: 'Relax', desc: 'Our experts handle everything while you sit back and enjoy.', icon: Zap }
             ].map((item, i) => (
               <div key={i} className="flex flex-col items-center text-center group">
                 <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-900 mb-6 group-hover:bg-blue-700 group-hover:text-white transition-all duration-300">
                   <item.icon size={28} strokeWidth={1.5} />
                 </div>
                 <h4 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h4>
                 <p className="text-sm text-slate-500 font-medium leading-relaxed px-4">{item.desc}</p>
               </div>
             ))}
          </div>
        </section>



      </div>
    </div>
  );
}

