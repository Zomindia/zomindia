import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Service, Review, FAQ, PartnerProfile, UserProfile, Category } from '../types';
import { handleMapsError } from '../lib/maps-errors';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Star, 
  Clock, 
  ChevronLeft, 
  CheckCircle2, 
  MessageCircle, 
  HelpCircle,
  Users,
  ShieldCheck,
  Calendar,
  AlertCircle,
  FileText,
  MapPin,
  Phone,
  ChevronRight,
  ArrowRight,
  Share2
} from 'lucide-react';
import BookingModal from './BookingModal';
import { LoadingScreen } from './LoadingIndicator';
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import FAQList from './FAQ';

interface ServiceDetailsProps {
  serviceId: string;
  profile: UserProfile | null;
  onBack: () => void;
  onAuthRequired: () => void;
  onSuccess: () => void;
}

interface PartnerWithUserInfo extends PartnerProfile {
  displayName: string;
  photoURL?: string;
  email: string;
  phoneNumber?: string;
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
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
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
            opacity: { duration: 0.2 }
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
                className={`h-1.5 rounded-full transition-all duration-300 pointer-events-auto ${i === index ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NearbyProsMap({ partners }: { partners: PartnerWithUserInfo[] }) {
  const availablePros = partners.filter(p => (p.availabilityStatus === 'Available' || p.availabilityStatus === 'Busy') && p.lat && p.lng);
  
  const [center, setCenter] = useState<{lat: number, lng: number}>({ lat: 28.6139, lng: 77.2090 }); // Default Delhi

  useEffect(() => {
    if (availablePros.length > 0) {
      setCenter({ lat: availablePros[0].lat!, lng: availablePros[0].lng! });
    } else if (navigator.geolocation) {
      const successPos = (pos: GeolocationPosition) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      };
      const errorPos = (err: GeolocationPositionError) => {
        if (err.code !== 1) console.error("Geolocation error:", err);
      };

      navigator.geolocation.getCurrentPosition(
        successPos,
        (err) => {
          if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
            navigator.geolocation.getCurrentPosition(
              successPos,
              errorPos,
              { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
            );
          } else {
            errorPos(err);
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  }, [availablePros.length]); 

  return (
    <div className="w-full h-80 rounded-[40px] overflow-hidden border border-slate-100 shadow-inner bg-slate-50 relative group">
      <Map
        defaultCenter={center}
        center={center}
        defaultZoom={12}
        mapId="NEARBY_PROS_MAP"
        className="w-full h-full"
        gestureHandling="greedy"
        disableDefaultUI
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      >
        {availablePros.map(pro => (
          <AdvancedMarker key={pro.id} position={{ lat: pro.lat!, lng: pro.lng! }}>
            <div className="relative group/marker">
              <div className={`p-2 rounded-full shadow-lg border-2 border-white text-white ${
                pro.availabilityStatus === 'Available' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}>
                <Users size={16} />
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-blue-700 text-white px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap opacity-0 group-hover/marker:opacity-100 transition-opacity">
                {pro.displayName} · {pro.rating}★
              </div>
            </div>
          </AdvancedMarker>
        ))}
      </Map>
      <div className="absolute top-6 left-6 flex flex-col gap-2">
         <div className="bg-white/90 backdrop-blur shadow-xl border border-slate-100 p-4 rounded-3xl">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Live Professionals</p>
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
             <span className="text-xs font-bold text-slate-900">{availablePros.length} Active in Area</span>
           </div>
         </div>
      </div>
    </div>
  );
}

export default function ServiceDetails({ serviceId, profile, onBack, onAuthRequired, onSuccess }: ServiceDetailsProps) {
  const [service, setService] = useState<Service | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [partners, setPartners] = useState<PartnerWithUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState<'overview' | 'experts' | 'reviews'>('overview');
  const [showPaymentQR, setShowPaymentQR] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch All Categories (needed for partner labels)
        const categoriesSnap = await getDocs(collection(db, 'categories'));
        const categoriesList = categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
        setCategories(categoriesList);

        // 2. Fetch Service
        const serviceSnap = await getDoc(doc(db, 'services', serviceId));
        if (serviceSnap.exists()) {
          const serviceData = { id: serviceSnap.id, ...serviceSnap.data() } as Service;
          setService(serviceData);

          // 3. Set Specific Category
          const foundCategory = categoriesList.find(c => c.id === serviceData.categoryId);
          if (foundCategory) {
            setCategory(foundCategory);
          }

          // 4. Fetch FAQs for this category
          const faqQuery = query(
            collection(db, 'faqs'),
            where('category', '==', serviceData.categoryId),
            where('isPublished', '==', true),
            limit(5)
          );
          const faqSnap = await getDocs(faqQuery);
          setFaqs(faqSnap.docs.map(d => ({ id: d.id, ...d.data() } as FAQ)));

          // 5. Fetch Partners for this category
          const partnerQuery = query(
            collection(db, 'partners'),
            where('categories', 'array-contains', serviceData.categoryId),
            where('status', '==', 'active'),
            orderBy('rating', 'desc'),
            limit(10)
          );
          const partnerSnap = await getDocs(partnerQuery);
          const partnerList = await Promise.all(partnerSnap.docs.map(async (d) => {
            const pData = d.data() as PartnerProfile;
            const uSnap = await getDoc(doc(db, 'users', pData.userId));
            const uData = uSnap.data() as UserProfile;
            return {
              ...pData,
              id: d.id,
              displayName: uData?.displayName || 'Service Pro',
              photoURL: uData?.photoURL,
              email: uData?.email,
              phoneNumber: uData?.phoneNumber
            };
          }));
          setPartners(partnerList);

          // 6. Fetch Reviews (Prioritize serviceId, filter by related partners if needed)
          const reviewQuery = query(
            collection(db, 'reviews'),
            where('serviceId', '==', serviceId),
            orderBy('createdAt', 'desc'),
            limit(10)
          );
          const reviewSnap = await getDocs(reviewQuery);
          let reviewList = reviewSnap.docs.map(d => ({ id: d.id, ...d.data() } as Review));
          
          // If no service-specific reviews, fallback to partner reviews in that category
          if (reviewList.length === 0 && partnerList.length > 0) {
            const partnerIds = partnerList.map(p => p.id);
            const fallbackQuery = query(
              collection(db, 'reviews'),
              where('partnerId', 'in', partnerIds.slice(0, 10)),
              orderBy('createdAt', 'desc'),
              limit(10)
            );
            const fallbackSnap = await getDocs(fallbackQuery);
            reviewList = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() } as Review));
          }
          setReviews(reviewList);
        }
      } catch (err) {
        console.error('Error fetching service details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [serviceId]);

  if (loading) {
    return <LoadingScreen message="Retrieving service specifications & ratings..." />;
  }

  if (!service) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <AlertCircle size={48} className="text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Service Not Found</h2>
        <p className="text-slate-500 mb-8 italic">The requested service might have been removed.</p>
        <button onClick={onBack} className="bg-blue-700 text-white px-8 py-3 rounded-xl font-bold">Back to Home</button>
      </div>
    );
  }

  const serviceImages = service.images || (service.imageURL ? [service.imageURL] : []);

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header Sticky */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-16 md:top-20 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
           <button 
             onClick={onBack} 
             className="flex items-center gap-2 text-slate-500 hover:text-blue-700 font-black text-xs uppercase tracking-widest transition-all hover:-translate-x-1"
           >
             <ChevronLeft size={16} /> Back to discover
           </button>
           <div className="flex items-center gap-6">
             <div className="hidden md:block text-right">
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-0.5">Investment</p>
               <p className="text-xl font-black text-slate-900 italic tracking-tighter">₹{service.basePrice}</p>
             </div>
             <button 
               onClick={() => profile ? setIsBookingModalOpen(true) : onAuthRequired()}
               className="bg-blue-700 text-white px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-700/20 hover:bg-blue-800 transition-all active:scale-95"
             >
               Book Now
             </button>
           </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-16">
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-12 md:space-y-20">
            {/* Hero Info */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-[32px] p-6 md:p-8 border border-slate-100 shadow-sm">
                {/* Left side: Title, Description, Pricing, Metadata */}
                <div className="lg:col-span-7 space-y-5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-3 py-1.5 bg-blue-700 text-white rounded-full text-[9px] font-black uppercase tracking-[0.25em]">
                      {category?.name || 'Expert Service'}
                    </span>
                    <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 uppercase tracking-widest">
                      <Clock size={12} className="text-slate-300" /> {service.duration || '60 mins'} session
                    </span>
                    <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-900 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-100 tracking-tighter italic">
                      <Star size={12} fill="currentColor" className="text-amber-500" /> {service.rating || 4.8} rating
                    </span>
                  </div>

                  <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight uppercase font-display">{service.name}</h1>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">{service.description}</p>
                  
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <button 
                      onClick={() => profile ? setIsBookingModalOpen(true) : onAuthRequired()}
                      className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-700/10 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Calendar size={14} /> Book Service
                    </button>
                    <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Price</p>
                        <p className="text-xs font-black text-slate-900 tracking-tight">₹{service.basePrice}</p>
                      </div>
                      <div className="w-px h-6 bg-slate-200" />
                      <div>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Time</p>
                        <p className="text-xs font-black text-slate-900 tracking-tight">{service.duration || '60m'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side: Imagecarousel */}
                <div className="lg:col-span-5 w-full">
                  {serviceImages.length > 0 && (
                    <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-150">
                      <ImageCarousel images={serviceImages} />
                    </div>
                  )}
                </div>
              </div>
            </motion.section>

            {/* Interactive Tab Switcher */}
            <div className="flex border-b border-slate-200 gap-6 my-6 overflow-x-auto no-scrollbar">
              {[
                { id: 'overview', label: 'Service Info ℹ️' },
                { id: 'experts', label: `Top Experts (${partners.length}) 👥` },
                { id: 'reviews', label: `Reviews & FAQs (${reviews.length}) 💬` }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveDetailsTab(t.id as any)}
                  className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeDetailsTab === t.id
                      ? 'border-blue-700 text-blue-700 font-extrabold'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tap Contents */}
            {activeDetailsTab === 'overview' && (
              <div className="space-y-6">
                {service.priceListPDF && (
                  <section className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden group shadow-lg">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 text-center sm:text-left">
                      <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
                        <FileText size={18} className="text-white/80" />
                        <h4 className="text-sm font-black text-white tracking-tight uppercase">Rate Card List</h4>
                      </div>
                      <p className="text-slate-200 text-xs font-medium leading-relaxed max-w-sm">
                        Complete transparency on spares and labor. Instantly download or view our verified rate list specs.
                      </p>
                    </div>
                    <a 
                      href={service.priceListPDF} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="relative z-10 bg-white text-slate-900 px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-slate-100 transition-all shadow-md flex items-center gap-1.5 whitespace-nowrap italic active:scale-95"
                    >
                      <FileText size={13} /> View Price Card
                    </a>
                  </section>
                )}

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-4 tracking-tight uppercase">Service Highlights</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { icon: ShieldCheck, title: "Zom-Shield Protection", desc: "100% secure with verified partner insurance coverage up to ₹10,000.", bg: "bg-emerald-500/10 text-emerald-800" },
                      { icon: Clock, title: "On-Time Guarantee", desc: "Partners arrive at scheduled slots with equipped kits or get ₹100 refund.", bg: "bg-blue-500/10 text-blue-800" },
                      { icon: Star, title: "High-Rated Professionals", desc: "Only top 2% of experts with background verification handle your place.", bg: "bg-amber-500/10 text-amber-800" },
                      { icon: AlertCircle, title: "No Hidden Costs", desc: "Upfront pricing transparently verified before starting real tasks.", bg: "bg-rose-500/10 text-rose-800" }
                    ].map((item, i) => {
                      const ItemIcon = item.icon;
                      return (
                        <div key={i} className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 hover:bg-white hover:border-slate-200 transition-all duration-300">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}>
                            <ItemIcon size={16} className="stroke-[2.5]" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-900 mb-0.5">{item.title}</h4>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeDetailsTab === 'experts' && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="mb-4">
                    <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase">Active Service Experts</h4>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">Verify live locations and credentials of background-checked partners.</p>
                  </div>
                  
                  <div className="mb-6">
                    <NearbyProsMap partners={partners} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {partners.slice(0, 4).map((partner) => (
                      <div key={partner.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col gap-4 group hover:bg-white hover:border-blue-700 transition-all duration-500">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white shadow-md transform group-hover:rotate-3 transition-transform">
                                <img 
                                  src={partner.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.displayName}`} 
                                  alt={partner.displayName}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-white ${
                                partner.availabilityStatus === 'Available' ? 'bg-emerald-500' :
                                partner.availabilityStatus === 'Busy' ? 'bg-amber-500' : 'bg-slate-300'
                              }`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-black text-slate-900">{partner.displayName}</h4>
                                <span className={`px-1 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-wider ${
                                  partner.availabilityStatus === 'Available' ? 'bg-emerald-50 text-emerald-700' : 
                                  partner.availabilityStatus === 'Busy' ? 'bg-amber-50 text-amber-700' : 
                                  'bg-slate-100 text-slate-400'
                                }`}>
                                  {partner.availabilityStatus || 'Offline'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 text-[9px] font-bold text-slate-500">
                                <Star size={9} fill="currentColor" className="text-amber-500" />
                                <span className="text-slate-900">{partner.rating || '4.9'}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-[8px] text-emerald-600 font-extrabold uppercase">KYC Verified</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {partner.phoneNumber && (
                          <button 
                            onClick={() => window.location.href = `tel:${partner.phoneNumber}`}
                            className="w-full py-2 bg-white border border-slate-200 rounded-lg text-[8px] font-black text-slate-950 uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-blue-700 hover:text-white transition-all shadow-sm cursor-pointer"
                          >
                            <Phone size={10} /> Contact Pro
                          </button>
                        )}
                      </div>
                    ))}
                    {partners.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-100">
                        No matches found in this sector right now.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeDetailsTab === 'reviews' && (
              <div className="space-y-6">
                {/* FAQs Accordion inside tab */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-4 tracking-tight uppercase flex items-center gap-2">
                    <HelpCircle size={15} className="text-blue-600" /> Insights & FAQs
                  </h3>
                  <FAQList faqs={faqs} />
                </div>

                {/* Reviews List inside tab */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-4 tracking-tight uppercase flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-amber-500 fill-amber-500/10" /> Real Experiences
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {reviews.map((review: any) => (
                      <div key={review.id} className="p-4 bg-slate-50 border border-slate-100/60 rounded-2xl shadow-sm relative group hover:border-amber-200 transition-all duration-300">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={10} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "text-amber-500" : "text-slate-250"} />
                            ))}
                          </div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Verified Encounter</span>
                        </div>
                        
                        {review.photoURL && (
                          <div className="mb-2.5 rounded-xl overflow-hidden max-h-32 border border-slate-100 bg-slate-200">
                            <img src={review.photoURL} alt="Review attachment" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        
                        <p className="text-slate-900 font-semibold text-xs leading-relaxed mb-2.5">"{review.comment}"</p>
                        
                        {review.partnerReply && (
                          <div className="mb-2.5 p-2.5 bg-white rounded-xl border border-slate-100">
                             <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Partner Response</p>
                             <p className="text-xxs font-medium text-slate-700">"{review.partnerReply}"</p>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                          <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[8px] font-black text-slate-400 border border-slate-100">
                            {review.customerId.slice(-2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-900 uppercase">Au. User</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {reviews.length === 0 && (
                      <div className="py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-100">
                        Awaiting the first expert encounter.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
             <div className="sticky top-40 space-y-8">
                {/* Booking Summary Card */}
                <div className="bg-blue-700 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-8">Summary</p>
                  
                  <div className="space-y-6 mb-10">
                    <div className="flex justify-between items-center text-xl font-bold tracking-tight">
                       <span className="text-slate-500 uppercase text-[10px] tracking-widest font-bold">Base Rate</span>
                       <span>₹{service.basePrice}</span>
                    </div>
                    <div className="flex justify-between items-center text-xl font-bold tracking-tight">
                       <span className="text-slate-500 uppercase text-[10px] tracking-widest font-bold">Insurance</span>
                       <span className="text-emerald-400">Included</span>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/10 mb-10">
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">You get</p>
                     <ul className="space-y-4">
                        {[
                          'Verified mastery', 
                          'Service warranty', 
                          '24/7 Priority support'
                        ].map((item, i) => (
                           <li key={i} className="flex items-center gap-3 text-xs font-bold text-slate-300">
                             <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-md">
                               <CheckCircle2 size={12} />
                             </div>
                             {item}
                           </li>
                        ))}
                     </ul>
                  </div>

                  <button 
                    onClick={() => profile ? setIsBookingModalOpen(true) : onAuthRequired()}
                    className="w-full bg-white text-slate-900 py-5 rounded-2xl font-bold tracking-tight text-base hover:bg-slate-100 transition-all active:scale-95 shadow-xl shadow-black/20"
                  >
                    Confirm Booking
                  </button>

                  <button 
                    onClick={() => {
                      const text = `Hi! I am planning to book the *${service.name}* home service on Zomato Home Services. The base price is only *₹${service.basePrice}* with premium insurance completely covered. Let me know what you think!`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    className="w-full mt-3 bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border border-white/10 flex items-center justify-center gap-2"
                  >
                    <Share2 size={13} /> Share Booking Info
                  </button>

                  <button 
                    onClick={() => {
                      const upiUrl = `upi://pay?pa=zomindia@oksbi&pn=ZomatoHomeServices&am=${service.basePrice}&cu=INR&tn=Service_${service.id.slice(-6).toUpperCase()}_${Date.now().toString().slice(-4)}`;
                      setQrCodeValue(upiUrl);
                      setShowPaymentQR(prev => !prev);
                    }}
                    className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border border-emerald-500/10 flex items-center justify-center gap-2"
                  >
                    ⚡ Generate Instant Payment QR
                  </button>

                  <AnimatePresence>
                    {showPaymentQR && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 p-4 bg-white rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-900 border border-slate-200 shadow-xl overflow-hidden"
                      >
                        <h5 className="font-extrabold text-[10px] uppercase tracking-widest text-slate-500">Scan to Pay Fee</h5>
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
                          <QRCodeSVG 
                            value={qrCodeValue} 
                            size={140}
                            level="H"
                            includeMargin={false}
                          />
                        </div>
                        <p className="text-[11px] font-black tracking-tight text-blue-700 max-w-[200px] text-center leading-normal">
                          ₹{service.basePrice} (UPI Auto-filled)
                        </p>
                        <p className="text-[8px] font-semibold text-slate-450 text-center uppercase tracking-wider max-w-[220px] leading-relaxed">
                          Scan via PhonePe, GPay, Paytm, or any UPI App to instant clear booking fee.
                        </p>
                        <button 
                          onClick={() => setShowPaymentQR(false)}
                          className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline cursor-pointer pt-1"
                        >
                          Close QR Code
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>

               {/* Trust Indicators */}
               <div className="bg-white rounded-[40px] p-8 border border-slate-100 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-900">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm uppercase">Zom-Shield.</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Premium cover active</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-900">
                      <Clock size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm uppercase">Priority.</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Instant assignment</p>
                    </div>
                  </div>
               </div>
             </div>
          </div>
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
