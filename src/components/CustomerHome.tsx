import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, doc, getDoc, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Category, Service, UserProfile, PartnerProfile, Promotion, Booking } from '../types';
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
  MapPin,
  Scissors,
  Tv,
  Brush,
  Hammer
} from 'lucide-react';

import heroImage from '../assets/images/regenerated_image_1779615433776.jpg';

interface Props {
  setActiveTab: (tab: any, arg?: any) => void;
  profile: UserProfile | null;
  onAuthRequired: () => void;
  onServiceSelect: (id: string) => void;
  initialCategoryId?: string | null;
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

const getCategoryIcon = (iconName: string): any => {
  if (!iconName) return Sparkles;
  const name = iconName.toLowerCase().trim();
  const map: Record<string, any> = {
    sparkles: Sparkles,
    wrench: Wrench,
    smartphone: Smartphone,
    paintbucket: PaintBucket,
    plug: Plug,
    wind: Wind,
    search: Search,
    star: Star,
    scissors: Scissors,
    tv: Tv,
    brush: Brush,
    hammer: Hammer
  };
  return map[name] || Sparkles;
};

const getCategoryIconColor = (iconName: string): string => {
  if (!iconName) return 'text-slate-600';
  const name = iconName.toLowerCase().trim();
  const map: Record<string, string> = {
    sparkles: 'text-rose-500',
    wrench: 'text-blue-500',
    smartphone: 'text-slate-700',
    paintbucket: 'text-amber-500',
    plug: 'text-emerald-500',
    wind: 'text-cyan-500',
    scissors: 'text-pink-500',
    tv: 'text-indigo-500',
    brush: 'text-orange-500',
    hammer: 'text-slate-500'
  };
  return map[name] || 'text-slate-600';
};

const CATEGORY_THEMES: Record<string, { iconColor: string; bgClass: string; borderClass: string; shadowClass: string; hoverBg: string; activeIconColor: string; textHoverColor: string; badgeColor?: string; badgeText?: string }> = {
  'cleaning': {
    iconColor: 'text-rose-500 bg-rose-50/50',
    bgClass: 'group-hover:bg-rose-500/[0.04] group-hover:border-rose-400/40',
    borderClass: 'border-slate-100/80',
    shadowClass: 'group-hover:shadow-[0_20px_35px_-8px_rgba(244,63,94,0.15)]',
    hoverBg: 'bg-rose-500/[0.08] shadow-[0_4px_12px_rgba(244,63,94,0.12)]',
    activeIconColor: 'text-rose-600',
    textHoverColor: 'group-hover:text-rose-700',
    badgeText: 'Popular',
    badgeColor: 'bg-rose-50 text-rose-600 border-rose-100'
  },
  'repairs': {
    iconColor: 'text-blue-500 bg-blue-50/50',
    bgClass: 'group-hover:bg-blue-500/[0.04] group-hover:border-blue-400/40',
    borderClass: 'border-slate-100/80',
    shadowClass: 'group-hover:shadow-[0_20px_35px_-8px_rgba(59,130,246,0.15)]',
    hoverBg: 'bg-blue-500/[0.08] shadow-[0_4px_12px_rgba(59,130,246,0.12)]',
    activeIconColor: 'text-blue-600',
    textHoverColor: 'group-hover:text-blue-700',
    badgeText: 'Instant',
    badgeColor: 'bg-blue-50 text-blue-600 border-blue-100'
  },
  'appliance': {
    iconColor: 'text-emerald-500 bg-emerald-50/50',
    bgClass: 'group-hover:bg-emerald-500/[0.04] group-hover:border-emerald-400/40',
    borderClass: 'border-slate-100/80',
    shadowClass: 'group-hover:shadow-[0_20px_35px_-8px_rgba(16,185,129,0.15)]',
    hoverBg: 'bg-emerald-500/[0.08] shadow-[0_4px_12px_rgba(16,185,129,0.12)]',
    activeIconColor: 'text-emerald-600',
    textHoverColor: 'group-hover:text-emerald-700'
  },
  'painting': {
    iconColor: 'text-amber-500 bg-amber-50/50',
    bgClass: 'group-hover:bg-amber-500/[0.04] group-hover:border-amber-400/40',
    borderClass: 'border-slate-100/80',
    shadowClass: 'group-hover:shadow-[0_20px_35px_-8px_rgba(245,158,11,0.15)]',
    hoverBg: 'bg-amber-500/[0.08] shadow-[0_4px_12px_rgba(245,158,11,0.12)]',
    activeIconColor: 'text-amber-600',
    textHoverColor: 'group-hover:text-amber-700',
    badgeText: 'Premium',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-100'
  },
  'beauty': {
    iconColor: 'text-pink-500 bg-pink-50/50',
    bgClass: 'group-hover:bg-pink-500/[0.04] group-hover:border-pink-400/40',
    borderClass: 'border-slate-100/80',
    shadowClass: 'group-hover:shadow-[0_20px_35px_-8px_rgba(236,72,153,0.15)]',
    hoverBg: 'bg-pink-500/[0.08] shadow-[0_4px_12px_rgba(236,72,153,0.12)]',
    activeIconColor: 'text-pink-600',
    textHoverColor: 'group-hover:text-pink-700',
    badgeText: 'Salon',
    badgeColor: 'bg-pink-50 text-pink-600 border-pink-100'
  },
  'appliance repair': {
    iconColor: 'text-emerald-500 bg-emerald-50/50',
    bgClass: 'group-hover:bg-emerald-500/[0.04] group-hover:border-emerald-400/40',
    borderClass: 'border-slate-100/80',
    shadowClass: 'group-hover:shadow-[0_20px_35px_-8px_rgba(16,185,129,0.15)]',
    hoverBg: 'bg-emerald-500/[0.08] shadow-[0_4px_12px_rgba(16,185,129,0.12)]',
    activeIconColor: 'text-emerald-600',
    textHoverColor: 'group-hover:text-emerald-700'
  },
  'phone repair': {
    iconColor: 'text-slate-700 bg-slate-100/50',
    bgClass: 'group-hover:bg-slate-500/[0.04] group-hover:border-slate-400/40',
    borderClass: 'border-slate-100/80',
    shadowClass: 'group-hover:shadow-[0_20px_35px_-8px_rgba(71,85,105,0.15)]',
    hoverBg: 'bg-slate-500/[0.08] shadow-[0_4px_12px_rgba(71,85,105,0.12)]',
    activeIconColor: 'text-slate-900',
    textHoverColor: 'group-hover:text-slate-900'
  },
  'ac repair': {
    iconColor: 'text-cyan-500 bg-cyan-50/50',
    bgClass: 'group-hover:bg-cyan-500/[0.04] group-hover:border-cyan-400/40',
    borderClass: 'border-slate-100/80',
    shadowClass: 'group-hover:shadow-[0_20px_35px_-8px_rgba(6,182,212,0.15)]',
    hoverBg: 'bg-cyan-500/[0.08] shadow-[0_4px_12px_rgba(6,182,212,0.12)]',
    activeIconColor: 'text-cyan-600',
    textHoverColor: 'group-hover:text-cyan-700',
    badgeText: 'Trending',
    badgeColor: 'bg-cyan-50 text-cyan-600 border-cyan-100'
  }
};

const getCategoryTheme = (categoryName: string) => {
  const name = categoryName.toLowerCase().trim();
  const theme = CATEGORY_THEMES[name];
  if (theme) return theme;
  
  if (name.includes('cleaning')) return CATEGORY_THEMES['cleaning'];
  if (name.includes('ac') || name.includes('air conditioner') || name.includes('cooling')) return CATEGORY_THEMES['ac repair'];
  if (name.includes('repair') || name.includes('wrench') || name.includes('service')) return CATEGORY_THEMES['repairs'];
  if (name.includes('appliance')) return CATEGORY_THEMES['appliance'];
  if (name.includes('paint')) return CATEGORY_THEMES['painting'];
  if (name.includes('beauty') || name.includes('salon') || name.includes('spa') || name.includes('parlour')) return CATEGORY_THEMES['beauty'];
  
  return {
    iconColor: 'text-slate-600 bg-slate-50/50',
    bgClass: 'group-hover:bg-slate-500/[0.03] group-hover:border-slate-300',
    borderClass: 'border-slate-100/80',
    shadowClass: 'group-hover:shadow-[0_20px_35px_-8px_rgba(148,163,184,0.15)]',
    hoverBg: 'bg-slate-500/[0.08] shadow-[0_4px_12px_rgba(148,163,184,0.12)]',
    activeIconColor: 'text-slate-800',
    textHoverColor: 'group-hover:text-blue-700'
  };
};

const getCategoryType = (categoryName: string): 'Home' | 'Professional' | 'Repair' => {
  const name = categoryName.toLowerCase().trim();
  if (name.includes('repair') || name.includes('appliance') || name.includes('wrench') || name.includes('ac ') || name.includes('phone') || name.includes('electrician') || name.includes('plumb') || name.includes('wiring') || name.includes('switch') || name.includes('device') || name.includes('gadget') || name.includes('purifier') || name.includes('geyser') || name.includes('heater') || name.includes('tv') || name.includes('refrigerat') || name.includes('fan') || name.includes('machine')) {
    return 'Repair';
  }
  if (name.includes('cleaning') || name.includes('paint') || name.includes('carpenter') || name.includes('house') || name.includes('wall') || name.includes('drill')) {
    return 'Home';
  }
  return 'Professional';
};

const CATEGORY_COLORS: Record<string, string> = {
  'Cleaning': 'text-rose-500 bg-rose-50',
  'Repairs': 'text-blue-500 bg-blue-50',
  'Appliance': 'text-emerald-500 bg-emerald-50',
  'Painting': 'text-amber-500 bg-amber-50',
  'Beauty': 'text-pink-500 bg-pink-50',
  'AC Repair': 'text-cyan-500 bg-cyan-50',
};

export default function CustomerHome({ setActiveTab, profile, onAuthRequired, onServiceSelect, initialCategoryId }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (initialCategoryId && allCategories.length > 0) {
      const cat = allCategories.find(c => c.id === initialCategoryId);
      if (cat) {
        setSelectedCategory(cat);
      }
    } else if (!initialCategoryId && allCategories.length > 0) {
      setSelectedCategory(null);
    }
  }, [initialCategoryId, allCategories]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriesSearchQuery, setCategoriesSearchQuery] = useState('');
  const [categoryTypeTab, setCategoryTypeTab] = useState<'All' | 'Home' | 'Professional' | 'Repair'>('All');
  const [currentPlaceholder, setCurrentPlaceholder] = useState('AC repair, ro service, washing machine repair...');

  useEffect(() => {
    const servicesList = [
      "AC Deep Cleaning",
      "TV Wall Mounting & Screen Fix",
      "Kitchen Exhaust & Chimney Clean",
      "Professional Fan Repair & Fixing",
      "RO Water Purifier Service",
      "Geyser Installation & Setup",
      "Microwave Heater Repairing",
      "Washing Machine Maintenance",
      "Refrigerator Gas Refilling",
      "Ceiling Fan Install & Wiring",
      "Drilling & Wall Hanging Service",
      "Home Fuse Switch Repairing"
    ];

    // Create a randomized copy and cycle through randomly
    const shuffled = [...servicesList].sort(() => Math.random() - 0.5);
    
    let isMounted = true;
    let serviceIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;

    const tick = () => {
      if (!isMounted) return;
      
      const currentService = shuffled[serviceIndex % shuffled.length];
      const prefix = "Search ";
      
      if (isDeleting) {
        // Deleting character by character
        setCurrentPlaceholder(prefix + currentService.substring(0, charIndex - 1));
        charIndex--;
        typingSpeed = 30; // Faster deletion
      } else {
        // Typing character by character
        setCurrentPlaceholder(prefix + currentService.substring(0, charIndex + 1));
        charIndex++;
        typingSpeed = 80; // Standard speed
      }

      // Check state transitions
      if (!isDeleting && charIndex === currentService.length) {
        // Entire phrase is typed out - pause before starting deletion
        typingSpeed = 1800; // Stay visible for 1.8s
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        // Fully erased - move to next random service
        isDeleting = false;
        serviceIndex++;
        typingSpeed = 400; // Small delay before typing next string
      }

      setTimeout(tick, typingSpeed);
    };

    // Begin typing sequence
    const timerId = setTimeout(tick, 500);
    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, []);

  const [partners, setPartners] = useState<PartnerWithInfo[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [tickerDismissed, setTickerDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (!profile) {
      setActiveBooking(null);
      return;
    }
    const q = query(
      collection(db, 'bookings'),
      where('customerId', '==', profile.uid),
      where('status', 'in', ['pending', 'confirmed', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'payment_pending', 'pending_parts', 'completed', 'finalized']),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const booking = { id: snap.docs[0].id, ...snap.docs[0].data() } as Booking;
        setActiveBooking(booking);
        const isDismissed = localStorage.getItem(`dismissed_ticker_${booking.id}`) === 'true';
        setTickerDismissed(isDismissed);
      } else {
        setActiveBooking(null);
        setTickerDismissed(false);
      }
    });
  }, [profile?.uid]);

  useEffect(() => {
     const q = query(collection(db, 'promotions'), where('active', '==', true));
     getDocs(q).then(snap => {
       const allPromos = snap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion));
       const customerPromos = allPromos.filter(promo => promo.targetAudience === 'customer' || !promo.targetAudience || promo.targetAudience === 'all');
       setPromotions(customerPromos);
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
            src={heroImage} 
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
               <input 
                 type="text" 
                 placeholder={currentPlaceholder}
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full px-6 py-4 bg-transparent focus:outline-none text-slate-800 font-bold text-base sm:text-lg placeholder:text-slate-400 placeholder:font-medium"
               />
               <button 
                 type="button"
                 className="bg-blue-700 hover:bg-blue-800 text-white p-4 rounded-xl transition-all shadow-lg shadow-blue-700/20 active:scale-95 shrink-0 flex items-center justify-center w-12 h-12"
                 aria-label="Search"
               >
                 <Search size={20} />
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
        
        {/* Active Booking Ticker */}
        {activeBooking && !tickerDismissed && (() => {
          const isNotAssigned = ['pending', 'pending_parts'].includes(activeBooking.status) || !activeBooking.partnerId;
          const isCompleted = ['completed', 'finalized', 'closed'].includes(activeBooking.status);
          
          let tickerClass = "bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 shadow-xl shadow-blue-700/20";
          let tickerStatusText = `Live Status: ${activeBooking.status.replace('_', ' ')}`;
          let tickerHeading = allServices.find(s => s.id === activeBooking.serviceId)?.name || 'Ongoing Service';
          let iconBg = "bg-white/10";
          let IconComponent = <Zap size={24} className="animate-pulse" />;
          let statusBadgeColor = "text-blue-200";
          let buttonHoverText = "group-hover:text-blue-700";
          let actionText = "Track Job";
          
          if (isNotAssigned) {
            tickerClass = "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 shadow-xl shadow-orange-500/20";
            tickerStatusText = "Finding the Best Expert for you";
            iconBg = "bg-white/20";
            IconComponent = <Clock size={24} className="animate-pulse" />;
            statusBadgeColor = "text-amber-100";
            buttonHoverText = "group-hover:text-orange-600";
            actionText = "View Slot";
            tickerHeading = `Matching Pro for ${tickerHeading}...`;
          } else if (isCompleted) {
            tickerClass = "bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-700 shadow-xl shadow-emerald-500/20";
            tickerStatusText = "Job Completed Successfully";
            iconBg = "bg-white/20";
            IconComponent = <CheckCircle2 size={24} className="animate-bounce" />;
            statusBadgeColor = "text-emerald-100";
            buttonHoverText = "group-hover:text-emerald-700";
            actionText = "Rate Service";
          } else {
            // Customize In Progress sub-statuses
            if (activeBooking.status === 'on_the_way') {
              tickerStatusText = "Pro is En-Route to Your Address";
            } else if (activeBooking.status === 'arrived') {
              tickerStatusText = "Pro has Arrived at Your Address";
            } else if (activeBooking.status === 'in_progress') {
              tickerStatusText = "Service is Actively In Progress";
            } else if (activeBooking.status === 'payment_pending') {
              tickerStatusText = "Invoice Ready • Payment Pending";
              actionText = "Pay Now";
            }
          }

          const handleDismiss = (e: React.MouseEvent) => {
            e.stopPropagation();
            localStorage.setItem(`dismissed_ticker_${activeBooking.id}`, 'true');
            setTickerDismissed(true);
          };

          return (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setActiveTab('bookings')}
              className={`mb-12 text-white p-6 rounded-[32px] cursor-pointer flex flex-col gap-5 group overflow-hidden relative transition-all duration-300 ${tickerClass}`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              
              {/* Header Section */}
              <div className="flex items-start justify-between relative z-10 w-full">
                <div className="flex items-center gap-4 min-w-0">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-inner ${iconBg}`}>
                      {IconComponent}
                   </div>
                   <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-white' : 'bg-emerald-400 animate-ping'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${statusBadgeColor}`}>{tickerStatusText}</span>
                      </div>
                      <h4 className="text-lg font-black italic tracking-tighter uppercase line-clamp-1">
                        {tickerHeading}
                      </h4>
                   </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/10 px-4 py-2 rounded-xl group-hover:bg-white ${buttonHoverText} transition-all border border-white/10 hidden sm:flex`}>
                     {actionText} <ArrowRight size={14} className="ml-1" />
                  </div>
                  <button 
                    onClick={handleDismiss}
                    className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                    title="Dismiss ticker"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Explainer / Informational text block */}
              <div className="relative z-10 bg-white/5 rounded-xl p-3 border border-white/5 text-[11px] text-white/95 leading-relaxed font-semibold">
                ℹ️ <strong className="font-extrabold uppercase text-[9px] tracking-wider text-white">Live Job Tracker Channel</strong>: 
                This tracking card is displaying progress for your most recent service request so you can monitor milestone status dynamically. Tap this card to request updates, chat with the pro, or make payments.
              </div>

              {/* Dynamic Info Grid */}
              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/15">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Reference ID</p>
                  <p className="font-mono text-xs font-black text-white">#{activeBooking.id.slice(-6).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Booking Scheduled</p>
                  <div className="flex items-center gap-1.5 text-xs font-black text-white">
                    <Clock size={11} className="opacity-70" />
                    <span>
                      {activeBooking.scheduledAt?.toDate?.()
                        ? activeBooking.scheduledAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' }) + " @ " + activeBooking.scheduledAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Scheduled Date'}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Estimation Price</p>
                  <p className="text-xs font-black text-white">₹{activeBooking.totalPrice}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-0.5">Service Venue</p>
                  <div className="flex items-center gap-1 text-xs font-semibold text-white">
                    <MapPin size={11} className="opacity-70 shrink-0" />
                    <span className="truncate max-w-[150px]" title={activeBooking.address}>{activeBooking.address}</span>
                  </div>
                </div>
              </div>

              {/* Mobile Action indicator */}
              <div className="sm:hidden relative z-10 w-full mt-1">
                <div className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white text-slate-900 py-2.5 rounded-xl transition-all">
                   {actionText} <ArrowRight size={14} className="ml-1" />
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* Categories Grid */}
        <section className="mb-12 animate-fade-in" id="categories-grid">
          <div className="bg-white rounded-[40px] border border-slate-100/90 shadow-[0_24px_50px_-12px_rgba(15,23,42,0.03),0_8px_20px_-6px_rgba(15,23,42,0.01)] p-6 sm:p-8 md:p-10 pb-20 sm:pb-24 relative overflow-hidden group">
            {/* Ambient gradient backdrops */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-50/20 to-slate-50/10 rounded-full blur-3xl pointer-events-none -translate-y-12 translate-x-12 transition-transform duration-1000 group-hover:scale-110" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-sky-50/20 to-slate-50/10 rounded-full blur-3xl pointer-events-none translate-y-12 -translate-x-12 transition-transform duration-1000 group-hover:scale-110" />
            
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 relative z-10">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600/90">{categories.length} Active Service Sectors</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                  Explore <span className="text-blue-700 font-black">Sectors</span>
                </h3>
              </div>
              
              {/* Compact Dynamic Badges */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="bg-slate-50 border border-slate-100/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                    <span className="text-slate-950 font-black">{partners.filter(p => p.availabilityStatus === 'Available').length || partners.length || 10} Experts</span> Live
                  </span>
                </div>
                <div className="bg-blue-50/50 border border-blue-100/50 px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm">
                  <span className="text-[9px] font-black uppercase tracking-wider text-blue-800">
                    🛡️ Zom-Shield Guarded
                  </span>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-2 relative z-10">
              {/* Tab Navigation */}
              <div className="flex border-b border-slate-100/80 overflow-x-auto gap-4 no-scrollbar scroll-smooth w-full md:w-auto">
                {(['All', 'Home', 'Professional', 'Repair'] as const).map((tab) => {
                  const isActive = categoryTypeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setCategoryTypeTab(tab)}
                      className={`px-3 py-2.5 font-bold text-xs select-none cursor-pointer tracking-wider uppercase transition-all border-b-2 whitespace-nowrap active:scale-95 duration-200 ${
                        isActive
                          ? 'border-blue-700 text-blue-700 font-black'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              {/* Search Bar específicamente de categorías */}
              <div className="relative w-full md:max-w-xs shrink-0">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  value={categoriesSearchQuery}
                  onChange={(e) => setCategoriesSearchQuery(e.target.value)}
                  placeholder="Filter categories or services..."
                  className="w-full bg-slate-50 border border-slate-200/60 focus:border-blue-700/50 rounded-2xl pl-10 pr-9 py-3 text-xs font-bold focus:ring-4 focus:ring-blue-700/5 outline-none transition-all placeholder:text-slate-400 font-sans"
                />
                {categoriesSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCategoriesSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer select-none"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Service Categories Grid */}
            <motion.div 
              layout
              className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-y-10 gap-x-3 sm:gap-x-4 items-center justify-items-center relative z-10 min-h-[140px]"
            >
              <AnimatePresence mode="popLayout">
                {categories.filter(cat => {
                  if (categoryTypeTab !== 'All') {
                    const type = getCategoryType(cat.name);
                    if (type !== categoryTypeTab) return false;
                  }
                  if (categoriesSearchQuery.trim() !== '') {
                    const queryStr = categoriesSearchQuery.toLowerCase().trim();
                    const catMatches = cat.name.toLowerCase().includes(queryStr);
                    if (catMatches) return true;
                    
                    const servicesInCat = allServices.filter(s => s.categoryId === cat.id);
                    return servicesInCat.some(s => 
                      s.name.toLowerCase().includes(queryStr) || 
                      (s.description && s.description.toLowerCase().includes(queryStr))
                    );
                  }
                  return true;
                }).map((cat, i) => {
                  const Icon = getCategoryIcon(cat.icon);
                  const theme = getCategoryTheme(cat.name);
                  const isFailedIcon = failedIcons[cat.id];
                  const hasValidIconURL = cat.iconURL && cat.iconURL.trim() !== '' && cat.iconURL.includes('/') && !isFailedIcon;
                  
                  return (
                    <motion.button
                      key={cat.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -15 }}
                      viewport={{ once: true }}
                      transition={{ 
                        type: 'spring',
                        stiffness: 300,
                        damping: 25,
                        layout: { duration: 0.3 }
                      }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        setSelectedCategory(cat);
                        e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="flex flex-col items-center group transition-all w-full cursor-pointer focus:outline-none relative"
                    >
                      {/* The Inner Card Container */}
                      <div className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white rounded-[24px] sm:rounded-[30px] flex items-center justify-center transition-all duration-300 mb-2 sm:mb-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)] border ${theme.borderClass} group-hover:-translate-y-1.5 ${theme.bgClass} group-hover:border-transparent ${theme.shadowClass} relative overflow-hidden`}>
                        
                        {/* Interactive Colorful Glow Backing */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        <div className="absolute -inset-10 bg-current filter blur-xl opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500 rounded-full pointer-events-none" style={{ color: 'inherit' }} />
                        
                        {theme.badgeText && (
                          <div className={`absolute top-1.5 sm:top-2 right-1.5 sm:right-2 px-1.5 py-0.5 rounded-full text-[6px] sm:text-[7px] font-black uppercase tracking-wider border z-20 ${theme.badgeColor || 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                            {theme.badgeText}
                          </div>
                        )}
                        
                        {/* Sub-container representing circle backdrop */}
                        <div className="w-13 h-13 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full bg-slate-50/60 group-hover:bg-white flex items-center justify-center transition-all duration-300 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.01)] group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] relative z-10 p-1.5 sm:p-2 sm:overflow-hidden">
                          {hasValidIconURL ? (
                            <motion.img 
                              whileHover={{ scale: 1.12, rotate: 4 }}
                              src={cat.iconURL} 
                              alt={cat.name} 
                              width={512}
                              height={512}
                              className="w-full h-full object-contain transition-transform duration-300" 
                              referrerPolicy="no-referrer" 
                              onError={() => {
                                setFailedIcons(prev => ({ ...prev, [cat.id]: true }));
                              }}
                            />
                          ) : (
                            <motion.div
                              whileHover={{ scale: 1.15 }}
                              transition={{ type: 'spring', stiffness: 420, damping: 9 }}
                              className={`${theme.iconColor} group-hover:${theme.activeIconColor}`}
                            >
                              <Icon size={30} className="sm:size-[34px] md:size-[40px] stroke-[1.5] transition-colors duration-300" />
                            </motion.div>
                          )}
                        </div>
                      </div>
                      {/* Text block label */}
                      <span className={`text-[10px] sm:text-[11px] md:text-xs font-bold text-slate-700 ${theme.textHoverColor} tracking-tight transition-colors duration-300 mt-1 text-center leading-tight max-w-[80px] sm:max-w-[95px] md:max-w-[110px] line-clamp-2 select-none`}>
                        {cat.name}
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>

              {/* Empty state overlay inside grid */}
              {categories.filter(cat => {
                if (categoryTypeTab !== 'All') {
                  const type = getCategoryType(cat.name);
                  if (type !== categoryTypeTab) return false;
                }
                if (categoriesSearchQuery.trim() !== '') {
                  const queryStr = categoriesSearchQuery.toLowerCase().trim();
                  const catMatches = cat.name.toLowerCase().includes(queryStr);
                  if (catMatches) return true;
                  
                  const servicesInCat = allServices.filter(s => s.categoryId === cat.id);
                  return servicesInCat.some(s => 
                    s.name.toLowerCase().includes(queryStr) || 
                    (s.description && s.description.toLowerCase().includes(queryStr))
                  );
                }
                return true;
              }).length === 0 && (
                <div className="col-span-full py-12 text-center w-full bg-slate-50/50 rounded-3xl border border-dashed border-slate-200/60 p-6 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">No Services Found</span>
                  <p className="text-xs text-slate-500 mt-1">Try adjusting your category filter or search keywords.</p>
                </div>
              )}
              
              {categoriesSearchQuery.trim() === '' && (
                <motion.button
                   layout
                   initial={{ opacity: 0, y: 15 }}
                   animate={{ opacity: 1, y: 0 }}
                   whileHover={{ scale: 1.03 }}
                   whileTap={{ scale: 0.95 }}
                   className="flex flex-col items-center group transition-all w-full cursor-pointer focus:outline-none"
                   onClick={() => {
                     const detailsSec = document.getElementById('categories-grid');
                     if (detailsSec) {
                       window.scrollTo({
                         top: detailsSec.offsetTop + detailsSec.offsetHeight + 100,
                         behavior: 'smooth'
                       });
                     }
                    }}
                >
                   <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white rounded-[24px] sm:rounded-[30px] flex items-center justify-center transition-all duration-300 mb-2 sm:mb-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)] border border-slate-100/80 group-hover:-translate-y-1.5 group-hover:bg-slate-500/[0.03] group-hover:border-slate-300 group-hover:shadow-[0_20px_35px_-8px_rgba(148,163,184,0.15)] relative overflow-hidden">
                      <div className="w-12 h-12 sm:w-15 sm:h-15 md:w-18 md:h-18 rounded-full bg-slate-50/60 group-hover:bg-white flex items-center justify-center transition-all duration-300 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.01)] group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] relative z-10">
                        <div className="flex gap-1 items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-300 group-hover:scale-125 group-hover:bg-blue-600" />
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-300 group-hover:scale-125 group-hover:bg-blue-600" />
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full transition-transform duration-300 group-hover:scale-125 group-hover:bg-blue-600" />
                        </div>
                      </div>
                   </div>
                   <span className="text-[10px] sm:text-[11px] md:text-xs font-bold text-slate-700 group-hover:text-blue-700 tracking-tight transition-colors duration-300 mt-1 text-center leading-tight select-none">
                     More
                   </span>
                </motion.button>
              )}
            </motion.div>

            {/* Persistent WhatsApp Support Button at bottom right corner of categories grid section */}
            <div className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 z-30 flex items-center">
              <a
                href={`https://wa.me/${(import.meta.env.VITE_WHATSAPP_SUPPORT_NUMBER || '919876543210').replace(/\D/g, '')}?text=${encodeURIComponent("Hello! I need assistance with a service.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-500/15 hover:shadow-emerald-500/30 transition-all duration-300 active:scale-95 group/wa cursor-pointer select-none text-xs font-black uppercase tracking-wider h-11"
              >
                <MessageCircle size={15} className="group-hover/wa:rotate-12 transition-transform duration-300" />
                <span>Direct Call</span>
              </a>
            </div>
          </div>
        </section>

        {/* Seasonal Offers & Trending Highlights */}
        <section className="mb-14 w-full" id="seasonal-deals">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: AC Cooling Promotion */}
            <motion.div 
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                navigator.clipboard.writeText("SUMMER20");
                setCopiedCode("SUMMER20");
                setTimeout(() => setCopiedCode(null), 2000);
              }}
              className="bg-gradient-to-br from-cyan-500/10 via-blue-500/[0.04] to-transparent rounded-[32px] p-6 sm:p-8 border border-cyan-100/70 hover:border-cyan-200 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-[0_20px_40px_rgba(6,182,212,0.08)] flex items-center justify-between relative overflow-hidden group cursor-pointer transition-all duration-300"
            >
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-cyan-100/20 -skew-x-12 translate-x-12 group-hover:translate-x-4 transition-transform duration-700" />
              {/* Interactive Radial glow */}
              <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-cyan-400/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-cyan-100 text-cyan-800 border border-cyan-200/50">Cooling deals</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AC Maintenance</span>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight mb-1">
                  Cool Summer <span className="text-cyan-600 font-extrabold uppercase italic">20% OFF</span>
                </h4>
                <p className="text-xs text-slate-500 font-medium mb-4">Complete sanitization & troubleshooting</p>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-colors duration-300 border ${
                  copiedCode === "SUMMER20"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-white/90 border-slate-100 text-slate-800 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-transparent"
                }`}>
                  {copiedCode === "SUMMER20" ? (
                    <>
                      <Check size={11} className="stroke-[2.5]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={10} className="stroke-[2.5]" />
                      <span>Code: SUMMER20</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="relative z-10 w-20 h-20 text-cyan-600/80 group-hover:text-cyan-600 transition-colors duration-300 transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 shrink-0 select-none">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h12"/><path d="M6 14h12"/></svg>
              </div>
            </motion.div>

            {/* Card 2: Home Cleaning Promotion */}
            <motion.div 
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                navigator.clipboard.writeText("CLEAN15");
                setCopiedCode("CLEAN15");
                setTimeout(() => setCopiedCode(null), 2000);
              }}
              className="bg-gradient-to-br from-rose-500/10 via-pink-500/[0.04] to-transparent rounded-[32px] p-6 sm:p-8 border border-rose-100/70 hover:border-rose-200 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-[0_20px_40px_rgba(244,63,94,0.08)] flex items-center justify-between relative overflow-hidden group cursor-pointer transition-all duration-300"
            >
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-rose-100/20 -skew-x-12 translate-x-12 group-hover:translate-x-4 transition-transform duration-700" />
              {/* Interactive Radial glow */}
              <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-rose-400/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200/50">Spotless Home</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Full Cleaning</span>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight mb-1">
                  Deep House <span className="text-rose-600 font-extrabold uppercase italic">15% OFF</span>
                </h4>
                <p className="text-xs text-slate-500 font-medium mb-4">Certified professional team & premium supplies</p>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-colors duration-300 border ${
                  copiedCode === "CLEAN15"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-white/90 border-slate-100 text-slate-800 group-hover:bg-rose-600 group-hover:text-white group-hover:border-transparent"
                }`}>
                  {copiedCode === "CLEAN15" ? (
                    <>
                      <Check size={11} className="stroke-[2.5]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={10} className="stroke-[2.5]" />
                      <span>Code: CLEAN15</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="relative z-10 w-20 h-20 text-rose-500/80 group-hover:text-rose-500 transition-colors duration-300 transform group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 shrink-0 select-none">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="m14 2 2-2 6 6-2 2Z"/><path d="M12 4H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h9Z"/><path d="M18 14h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z"/><path d="M2 17h20v2H2Z"/></svg>
              </div>
            </motion.div>

            {/* Card 3: Appliance Care Promotion */}
            <motion.div 
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                navigator.clipboard.writeText("FIXIT250");
                setCopiedCode("FIXIT250");
                setTimeout(() => setCopiedCode(null), 2000);
              }}
              className="bg-gradient-to-br from-amber-500/10 via-yellow-500/[0.04] to-transparent rounded-[32px] p-6 sm:p-8 border border-amber-100/70 hover:border-amber-200 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-[0_20px_40px_rgba(245,158,11,0.08)] md:col-span-2 lg:col-span-1 flex items-center justify-between relative overflow-hidden group cursor-pointer transition-all duration-300"
            >
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-amber-100/20 -skew-x-12 translate-x-12 group-hover:translate-x-4 transition-transform duration-700" />
              {/* Interactive Radial glow */}
              <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-amber-400/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200/50">Express Care</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Appliance Repair</span>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight mb-1">
                  Guaranteed <span className="text-amber-600 font-extrabold uppercase italic">Flat ₹250 Off</span>
                </h4>
                <p className="text-xs text-slate-500 font-medium mb-4">Fix washing machines, refrigerators & microwaves</p>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-colors duration-300 border ${
                  copiedCode === "FIXIT250"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-white/90 border-slate-100 text-slate-800 group-hover:bg-amber-600 group-hover:text-white group-hover:border-transparent"
                }`}>
                  {copiedCode === "FIXIT250" ? (
                    <>
                      <Check size={11} className="stroke-[2.5]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={10} className="stroke-[2.5]" />
                      <span>Code: FIXIT250</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="relative z-10 w-20 h-20 text-amber-500/80 group-hover:text-amber-500 transition-colors duration-300 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 shrink-0 select-none">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="mb-20 w-full" id="why-choose-us-mini">
          <div className="mb-6 px-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic md:not-italic">
              Why Choose <span className="text-blue-600 bg-blue-50/50 px-2.5 py-0.5 rounded-xl">zomindia</span>
            </h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
             <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100/95 flex items-center gap-4 hover:shadow-md hover:border-blue-100 hover:shadow-[0_12px_24px_rgba(29,78,216,0.04)] transition-all duration-300 cursor-default group">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                   <ShieldCheck size={20} className="stroke-[2.5]" />
                </div>
                <div className="flex flex-col">
                   <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-800 mb-0.5">Vetted</h4>
                   <span className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">Verified Professionals</span>
                   <span className="text-[9px] text-slate-500 font-bold mt-0.5 leading-none">100% Background-Checked</span>
                </div>
             </div>
             
             <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100/95 flex items-center gap-4 hover:shadow-md hover:border-blue-100 hover:shadow-[0_12px_24px_rgba(29,78,216,0.04)] transition-all duration-300 cursor-default group">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                   <Clock size={20} className="stroke-[2.5]" />
                </div>
                <div className="flex flex-col">
                   <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-800 mb-0.5">Transparent</h4>
                   <span className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">Upfront Pricing</span>
                   <span className="text-[9px] text-slate-500 font-bold mt-0.5 leading-none">Pay exactly what you see</span>
                </div>
             </div>

             <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100/95 flex items-center gap-4 hover:shadow-md hover:border-blue-100 hover:shadow-[0_12px_24px_rgba(29,78,216,0.04)] transition-all duration-300 cursor-default group">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                   <Zap size={20} className="stroke-[2.5]" />
                </div>
                <div className="flex flex-col">
                   <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-800 mb-0.5">Reliable</h4>
                   <span className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">On-Time Service</span>
                   <span className="text-[9px] text-slate-500 font-bold mt-0.5 leading-none">Punctual & equipped partners</span>
                </div>
             </div>

             <div className="bg-gradient-to-br from-amber-500/[0.04] to-yellow-500/[0.01] p-5 rounded-[24px] shadow-md border border-amber-200/60 flex items-center gap-4 hover:shadow-lg hover:border-amber-300 hover:shadow-[0_12px_28px_rgba(245,158,11,0.08)] transition-all duration-300 cursor-default group relative overflow-hidden">
                <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 relative z-10">
                   <Star size={20} className="stroke-[2.5] fill-amber-500/30" />
                </div>
                <div className="flex flex-col relative z-10 text-left">
                   <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-0.5">Guaranteed</h4>
                   <span className="text-xs sm:text-sm font-extrabold text-slate-950 leading-tight">100% Satisfaction</span>
                   <span className="text-[9px] text-amber-850 font-bold mt-0.5 leading-none">Free Re-work or Refund</span>
                </div>
             </div>
          </div>
        </section>

        {/* Promotions Carousel/Grid */}
        {promotions.length > 0 && (
          <section className="mb-20">
            <div className="flex justify-between items-end mb-8 px-2">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-1">Latest offers</h3>
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
                    className="flex-shrink-0 w-[320px] sm:w-[420px] h-[230px] rounded-[32px] relative overflow-hidden group shadow-xl transition-all hover:scale-[1.02] active:scale-95"
                  >
                    {/* Colorful Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
                    
                    {/* Decorative Circles */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-black/10 rounded-full blur-xl" />

                    {promo.imageUrl && (
                      <img src={promo.imageUrl} className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30" alt="" referrerPolicy="no-referrer" />
                    )}

                    <div className="relative h-full p-7 flex flex-col justify-between z-10 text-white">
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/20 select-none">
                            Special Offer
                          </span>
                          {promo.discountValue && (
                            <span className="text-2xl sm:text-3xl font-black italic tracking-tighter text-yellow-300 drop-shadow">
                              {promo.discountType === 'percent' ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xl sm:text-2xl font-black mb-1.5 leading-tight tracking-tight uppercase italic">{promo.name}</h4>
                        <p className="text-white/85 text-xs sm:text-sm line-clamp-1 font-medium leading-normal">{promo.description}</p>
                      </div>

                      <div className="flex items-end justify-between gap-4 mt-auto">
                        <div className="flex flex-col gap-1 text-left">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/60 font-mono select-none">Promo Code</span>
                          <div className="bg-black/25 backdrop-blur-md px-4 rounded-2xl border border-white/10 flex items-center justify-center min-w-[120px] h-11">
                            <code className="text-sm sm:text-base font-black tracking-widest font-mono text-emerald-300">{promo.code}</code>
                          </div>
                        </div>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(promo.code);
                            setCopiedCode(promo.code);
                            setTimeout(() => setCopiedCode(null), 2000);
                          }}
                          className="bg-white text-slate-900 border border-white hover:bg-slate-50 px-5 h-11 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95 select-none shrink-0"
                        >
                          {copiedCode === promo.code ? (
                            <><Check size={14} className="text-emerald-600 shrink-0" /> <span className="text-emerald-600 font-extrabold">Copied</span></>
                          ) : (
                            <><Copy size={13} className="text-slate-500 shrink-0" /> Copy Code</>
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
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic md:not-italic">
                Top Rated <span className="text-blue-600 bg-blue-50/50 px-2.5 py-0.5 rounded-xl">Home Services</span>
              </h3>
              <p className="text-slate-400 font-medium text-xs mt-1">Hand-picked services based on user satisfaction and premium reliability</p>
            </div>
            <button 
              onClick={() => {
                const el = document.getElementById('categories-grid');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors border-b-2 border-transparent hover:border-blue-600/30 pb-0.5"
            >
              See all categories
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
            {allServices
              .filter(s => s.rating && s.rating >= 4.5)
              .slice(0, 4)
              .map((service, idx) => (
                <motion.div 
                  key={service.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -8 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 260, 
                    damping: 20,
                    delay: idx * 0.05 
                  }}
                  onClick={() => onServiceSelect(service.id)}
                  className="bg-white rounded-[32px] border border-slate-100/90 p-5 hover:border-slate-200 transition-all duration-300 cursor-pointer group shadow-[0_8px_30px_rgba(15,23,42,0.015),0_1px_3px_rgba(15,23,42,0.01)] hover:shadow-[0_24px_50px_-8px_rgba(15,23,42,0.06)] flex flex-col justify-between text-left relative overflow-hidden h-full"
                >
                  {/* Hover Accent Light */}
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-indigo-600 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                  
                  <div className="flex flex-col w-full">
                    {/* Image Box */}
                    <div className="w-full aspect-square rounded-2xl overflow-hidden mb-4 bg-slate-50 border border-slate-100 relative shadow-sm">
                       <img 
                         src={service.imageURL || 'https://images.unsplash.com/photo-1581578731548-c64695ce6954?auto=format&fit=crop&q=80&w=400'} 
                         alt={service.name} 
                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                         referrerPolicy="no-referrer"
                       />
                       <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent pointer-events-none" />
                       
                       {/* Floating Badges */}
                       <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-wider text-slate-800 shadow-sm border border-slate-100/50 flex items-center gap-1.5">
                         <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                         <span>Top Choice</span>
                       </div>
                    </div>

                    {/* Meta section */}
                    <div className="flex items-center gap-2 mb-2 w-full">
                      <div className="px-2 py-0.5 bg-amber-500/10 text-amber-700 rounded-lg flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider border border-amber-500/20">
                        <Star size={9} fill="currentColor" className="stroke-[2.5]" /> {service.rating}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                        {allCategories.find(c => c.id === service.categoryId)?.name}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 mb-1 tracking-tight text-base sm:text-lg line-clamp-1 group-hover:text-blue-600 transition-colors duration-200">
                      {service.name}
                    </h4>
                    
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-semibold mt-0.5 mb-3">
                      {service.description}
                    </p>
                  </div>

                  {/* Actions & Price */}
                  <div className="mt-4 pt-4 border-t border-slate-100/80 flex items-center justify-between gap-3 w-full">
                     <div>
                        <p className="text-[8.5px] text-slate-400 font-black uppercase tracking-widest mb-0.5 leading-none">Starting from</p>
                        <p className="font-black text-base text-slate-900 tracking-tight">₹{service.basePrice}</p>
                     </div>
                     <div className="h-9 hover:bg-blue-600 hover:text-white bg-slate-50 border border-slate-100 hover:border-transparent text-slate-600 transition-all select-none rounded-xl flex items-center justify-center px-3 gap-1.5 shadow-sm">
                        <span className="text-[10px] font-black uppercase tracking-widest">Book</span>
                        <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                     </div>
                  </div>
                </motion.div>
              ))}
          </div>
        </section>

        {/* Services in Focus (Category Grouped) */}
        <section className="mb-20 px-4">
           <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-1">Services in Focus</h3>
                <p className="text-slate-500 font-medium">Premium offerings with exceptional track records</p>
              </div>
           </div>
           
           <div className="space-y-16">
              {(() => {
                const categoryImagesMap: Record<string, string> = {
                  '1': 'https://images.unsplash.com/photo-1581578731548-c64695ce6958?auto=format&fit=crop&q=80&w=600', // Cleaning
                  'Cleaning': 'https://images.unsplash.com/photo-1581578731548-c64695ce6958?auto=format&fit=crop&q=80&w=600',
                  '2': 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=600', // Repairs
                  'Repairs': 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=600',
                  '3': 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=600', // Appliance
                  'Appliance': 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=600',
                  '4': 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=600', // Painting
                  'Painting': 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=600',
                  '5': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=600', // Beauty
                  'Beauty': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=600',
                  '6': 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=600', // Appliance Repair
                  'Appliance Repair': 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=600',
                  'Phone Repair': 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&q=80&w=600'
                };
                
                const categoriesWithServices = allCategories.filter(cat => 
                  allServices.some(s => s.categoryId === cat.id)
                );
                
                return categoriesWithServices.map((category, catIdx) => {
                  const categoryServices = allServices.filter(s => s.categoryId === category.id);
                  if (categoryServices.length === 0) return null;
                  
                  const catImg = category.imageURL || categoryImagesMap[category.id] || categoryImagesMap[category.name] || 'https://images.unsplash.com/photo-1581578731548-c64695ce6958?auto=format&fit=crop&q=80&w=600';
                  const minPrice = categoryServices.length > 0 
                    ? Math.min(...categoryServices.map(s => s.basePrice)) 
                    : 199;
                  
                  return (
                    <div key={category.id} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch bg-slate-50/50 p-6 rounded-[48px] border border-slate-100">
                       {/* Left: Big Category Image Card */}
                       <motion.div 
                         initial={{ opacity: 0, scale: 0.98 }}
                         whileInView={{ opacity: 1, scale: 1 }}
                         viewport={{ once: true }}
                         whileHover={{ scale: 1.01 }}
                         onClick={() => {
                           setSelectedCategory(category);
                           window.scrollTo({ top: 0, behavior: 'smooth' });
                         }}
                         className="lg:col-span-1 rounded-[40px] overflow-hidden relative shadow-xl min-h-[350px] lg:min-h-full flex flex-col justify-between p-8 group border border-slate-800/80 bg-slate-950 cursor-pointer select-none text-left"
                       >
                          <img 
                            src={catImg} 
                            alt={category.name} 
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 opacity-55 mix-blend-overlay" 
                            referrerPolicy="no-referrer"
                          />
                          {/* Secure a deep dark overlay for flawless contrast and readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-900/40 pointer-events-none" />
                          
                          <div className="relative z-10 w-full flex flex-col h-full justify-between gap-8">
                             {/* Top Badge Row */}
                             <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 border border-blue-500/20 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-blue-500/20">
                                   <Sparkles size={11} className="animate-pulse" /> Spotlight
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/5">
                                   Starts ₹{minPrice}
                                </span>
                             </div>
                             
                             {/* Text & Content Block */}
                             <div className="space-y-4">
                                <div>
                                   <h4 className="text-3xl sm:text-4xl font-black tracking-tight leading-none uppercase italic text-white drop-shadow-md">
                                      {category.name}
                                   </h4>
                                   <p className="text-[11px] text-slate-300 font-medium leading-relaxed mt-2.5 line-clamp-3">
                                      {category.description || `Verified professional ${category.name.toLowerCase()} services customized for your daily comfort.`}
                                   </p>
                                </div>

                                <div className="border-t border-white/10 pt-4 flex items-center justify-between gap-4">
                                   <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-200">
                                      <CheckCircle2 size={12} className="text-emerald-400 fill-emerald-500/30" /> Free 7-Day Cover
                                   </div>
                                   <div className="text-[11px] font-black uppercase tracking-widest text-blue-400 group-hover:text-white flex items-center gap-1.5 transition-colors duration-300">
                                      Explore <ArrowRight size={13} className="group-hover:translate-x-1.5 transition-transform duration-300" />
                                   </div>
                                </div>
                             </div>
                          </div>
                       </motion.div>
                       
                       {/* Right: Dynamic Services List underneath this category */}
                       <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {categoryServices.map((service, sIdx) => (
                             <motion.div
                               key={service.id}
                               initial={{ opacity: 0, y: 15 }}
                               whileInView={{ opacity: 1, y: 0 }}
                               viewport={{ once: true }}
                               transition={{ delay: sIdx * 0.05 }}
                               onClick={() => onServiceSelect(service.id)}
                               className="bg-white p-6 rounded-3xl border border-slate-100 hover:border-blue-700 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group h-full text-left"
                             >
                               <div>
                                  <div className="flex justify-between items-start gap-4 mb-2">
                                     <h5 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1">{service.name}</h5>
                                     <span className="font-black text-xs text-slate-900 shrink-0">₹{service.basePrice}</span>
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed mb-4">{service.description}</p>
                               </div>
                               
                               <div className="flex items-center justify-between pt-3 border-t border-slate-50 w-full">
                                  <div className="flex items-center gap-3">
                                     <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                                        <Star size={11} fill="currentColor" />
                                        <span>{service.rating || 4.8}</span>
                                     </div>
                                     <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">• {service.duration || '60 mins'}</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
                                     Book <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                                  </span>
                               </div>
                             </motion.div>
                          ))}
                       </div>
                    </div>
                  );
                });
              })()}
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
        <section className="mb-20 px-2 lg:px-4">
          <div className="bg-slate-900 rounded-[48px] p-8 md:p-16 lg:p-20 overflow-hidden relative border border-slate-800 shadow-2xl">
            {/* Background glowing effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-500/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative z-10">
              {/* Header */}
              <div className="max-w-3xl mb-12 lg:mb-16 text-center md:text-left">
                <span className="text-xs font-black uppercase tracking-[0.25em] text-blue-500 mb-3 block">Why Choose Our Platform</span>
                <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight uppercase mb-4">
                  The Gold Standard of Home Care Guarantees
                </h2>
                <p className="text-slate-400 font-medium text-sm md:text-base leading-relaxed">
                  We are redefining urban home care in India by vetting, training, and backing every single service partner so that you can book with pure confidence.
                </p>
              </div>

              {/* Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                {/* Stats / Hero Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-blue-600/20 rounded-[32px] p-8 flex flex-col justify-between border border-blue-500/30 text-left min-h-[320px] lg:col-span-1"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-md">
                      <Star size={24} fill="currentColor" />
                    </div>
                    <div>
                      <h3 className="text-4xl font-extrabold text-white tracking-tight">4.85★</h3>
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-300 mt-1">Average Service Rating</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-6 border-t border-blue-500/20">
                    <p className="text-xs text-blue-100 font-medium leading-relaxed">
                      "Unmatched reliability. The repairs partner arrived in exactly 45 minutes, wore certified safety equipment, and solved my leakage issue cleanly under budget."
                    </p>
                    <span className="text-[10px] font-bold text-blue-300 block">—— Priya K., Mumbai</span>
                  </div>
                </motion.div>

                {/* Grid Item 1: 100% Verified Partners */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="bg-white/5 backdrop-blur-sm rounded-[32px] p-8 border border-white/10 hover:border-blue-500/50 transition-all group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <UserCheck size={22} />
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Multi-Tier Screening</h4>
                    <p className="text-slate-400 text-sm leading-relaxed font-normal">
                      Every partner undergoes rigorous identity checks, local police verification, and a 3-step technical assessment in our modern training classrooms.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-lg tracking-wider uppercase">Only Top 5% Hired</span>
                  </div>
                </motion.div>

                {/* Grid Item 2: Upfront Transparent Pricing */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 }}
                  className="bg-white/5 backdrop-blur-sm rounded-[32px] p-8 border border-white/10 hover:border-blue-500/50 transition-all group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <Sparkles size={22} />
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">No Haggling. No Secrets.</h4>
                    <p className="text-slate-400 text-sm leading-relaxed font-normal">
                      Get transparent estimates before the job starts. Standardized pricing guides prevent overcharging, so you pay only what's displayed on screen.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded-lg tracking-wider uppercase">Itemized Invoices</span>
                  </div>
                </motion.div>

                {/* Row 2 - Grid Item 3: Safety Controls */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/5 backdrop-blur-sm rounded-[32px] p-8 border border-white/10 hover:border-blue-500/50 transition-all group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <ShieldCheck size={22} />
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Secure OTP Inspections</h4>
                    <p className="text-slate-400 text-sm leading-relaxed font-normal">
                      Experience end-to-end security. Partners share a unique pin to initiate jobs, keeping authentication transparent and fully logged.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-lg tracking-wider uppercase">Fully Insured Jobs</span>
                  </div>
                </motion.div>

                {/* Row 2 - Grid Item 4: Quick-Turn Turnaround */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.25 }}
                  className="bg-white/5 backdrop-blur-sm rounded-[32px] p-8 border border-white/10 hover:border-blue-500/50 transition-all group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <Clock size={22} />
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Punctuality Promise</h4>
                    <p className="text-slate-400 text-sm leading-relaxed font-normal">
                      We value your time. If our professional partner is significantly delayed, receive proactive booking credits instantly credited to your account.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold rounded-lg tracking-wider uppercase">Swift Response</span>
                  </div>
                </motion.div>

                {/* Row 2 - Grid Item 5: Post-Service Support */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="bg-white/5 backdrop-blur-sm rounded-[32px] p-8 border border-white/10 hover:border-blue-500/50 transition-all group flex flex-col justify-between text-left lg:col-span-1"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                      <CheckCircle2 size={22} />
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Quality Warranty</h4>
                    <p className="text-slate-400 text-sm leading-relaxed font-normal">
                      Not fully satisfied? Our comprehensive care network handles complimentary re-work evaluations within 7 days of service completion.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded-lg tracking-wider uppercase">7-Day Free Cover</span>
                  </div>
                </motion.div>
              </div>
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

        {/* Support Chat Banner */}
        <section className="bg-gradient-to-r from-blue-700 to-indigo-900 rounded-[40px] p-8 md:p-12 text-white shadow-xl relative overflow-hidden mb-20 mx-2">
          <div className="absolute inset-0 bg-white/5 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            <div className="max-w-xl">
              <span className="px-3 py-1 bg-white/10 text-white text-[10px] font-bold rounded-lg tracking-wider uppercase inline-flex items-center gap-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Always Available
              </span>
              <h2 className="text-3xl font-black tracking-tight mb-4">
                Need Fast Help? Ask <span className="text-amber-300">zomindia AI</span>
              </h2>
              <p className="text-blue-100 text-sm leading-relaxed max-w-md">
                Get answers about booking states, refund policies, annual contracts, or service recommendations instantly from our conversational AI assistant.
              </p>
            </div>
            <button
              onClick={() => {
                if (!profile) {
                  onAuthRequired();
                } else {
                  window.dispatchEvent(new CustomEvent('toggle-ai-chat', { detail: { open: true } }));
                }
              }}
              className="bg-white text-slate-900 border border-transparent shadow-lg text-sm font-bold px-8 py-4 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all shrink-0 flex items-center gap-2 mx-auto md:mx-0"
            >
              <MessageCircle size={18} className="text-blue-700 animate-bounce" />
              Chat is Online
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}

