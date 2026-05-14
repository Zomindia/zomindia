import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Service, Review, FAQ, PartnerProfile, UserProfile, Category } from '../types';
import { motion, AnimatePresence } from 'motion/react';
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
  ArrowRight
} from 'lucide-react';
import BookingModal from './BookingModal';
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

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

function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) return null;

  return (
    <div className="relative w-full aspect-video rounded-[60px] overflow-hidden mb-16 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] border-8 border-white group">
      <AnimatePresence mode="wait">
        <motion.img
          key={images[index]}
          src={images[index]}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="w-full h-full object-cover"
        />
      </AnimatePresence>
      
      {images.length > 1 && (
        <>
          <div className="absolute inset-0 flex items-center justify-between px-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
              className="w-12 h-12 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-stone-900 shadow-xl hover:bg-white active:scale-90 transition-all"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
              className="w-12 h-12 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-stone-900 shadow-xl hover:bg-white active:scale-90 transition-all"
            >
              <ChevronRight size={24} />
            </button>
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
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
      navigator.geolocation.getCurrentPosition((pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  }, [availablePros.length === 0]); // Only update center if no pros found initially or list changes

  return (
    <div className="w-full h-80 rounded-[40px] overflow-hidden border border-stone-100 shadow-inner bg-stone-50 relative group">
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
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-stone-900 text-white px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap opacity-0 group-hover/marker:opacity-100 transition-opacity">
                {pro.displayName} · {pro.rating}★
              </div>
            </div>
          </AdvancedMarker>
        ))}
      </Map>
      <div className="absolute top-6 left-6 flex flex-col gap-2">
         <div className="bg-white/90 backdrop-blur shadow-xl border border-stone-100 p-4 rounded-3xl">
           <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Live Professionals</p>
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
             <span className="text-xs font-bold text-stone-900">{availablePros.length} Active in Area</span>
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-4">
           <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
           <p className="text-stone-500 font-medium">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-6 text-center">
        <AlertCircle size={48} className="text-stone-300 mb-4" />
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Service Not Found</h2>
        <p className="text-stone-500 mb-8 italic">The requested service might have been removed.</p>
        <button onClick={onBack} className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold">Back to Home</button>
      </div>
    );
  }

  const serviceImages = service.images || (service.imageURL ? [service.imageURL] : []);

  return (
    <div className="min-h-screen bg-stone-50/50">
      {/* Header Sticky */}
      <div className="bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-16 md:top-20 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
           <button 
             onClick={onBack} 
             className="flex items-center gap-2 text-stone-500 hover:text-stone-900 font-black text-xs uppercase tracking-widest transition-all hover:-translate-x-1"
           >
             <ChevronLeft size={16} /> Back to discover
           </button>
           <div className="flex items-center gap-6">
             <div className="hidden md:block text-right">
               <p className="text-[10px] text-stone-400 font-black uppercase tracking-[0.2em] mb-0.5">Investment</p>
               <p className="text-xl font-black text-stone-900 italic tracking-tighter">₹{service.basePrice}</p>
             </div>
             <button 
               onClick={() => profile ? setIsBookingModalOpen(true) : onAuthRequired()}
               className="bg-stone-900 text-white px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-stone-900/20 hover:bg-black transition-all active:scale-95"
             >
               Book Now
             </button>
           </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-20">
            {/* Hero Info */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {serviceImages.length > 0 && (
                <ImageCarousel images={serviceImages} />
              )}
              <div className="flex flex-wrap items-center gap-4 mb-8">
                <span className="px-4 py-1.5 bg-stone-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em]">
                  {category?.name || 'Expert Service'}
                </span>
                <span className="flex items-center gap-2 text-[10px] font-black text-stone-500 bg-white px-3 py-1.5 rounded-xl border border-stone-100 uppercase tracking-widest">
                  <Clock size={14} className="text-stone-300" /> {service.duration || '60 mins'} session
                </span>
                <span className="flex items-center gap-2 text-[10px] font-black text-stone-900 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 tracking-tighter italic">
                  <Star size={14} fill="currentColor" className="text-amber-500" /> {service.rating || 4.8} rating
                </span>
              </div>
              <h1 className="text-6xl md:text-8xl font-black text-stone-900 mb-8 tracking-tighter leading-none uppercase italic">{service.name}</h1>
              <p className="text-2xl text-stone-500 leading-relaxed max-w-3xl font-medium mb-12">{service.description}</p>
              
              <div className="flex flex-col sm:flex-row gap-6 mb-16">
                <button 
                  onClick={() => profile ? setIsBookingModalOpen(true) : onAuthRequired()}
                  className="bg-stone-900 text-white px-12 py-6 rounded-3xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-stone-900/30 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3 italic"
                >
                  <Calendar size={20} /> Book This Service Now
                </button>
                <div className="flex items-center gap-6 px-8 py-5 bg-stone-50 rounded-3xl border border-stone-100">
                  <div>
                    <p className="text-[10px] text-stone-400 font-black uppercase tracking-[0.2em] mb-1">Starting Price</p>
                    <p className="text-2xl font-black text-stone-900 italic tracking-tighter">₹{service.basePrice}</p>
                  </div>
                  <div className="w-px h-10 bg-stone-200" />
                  <div>
                    <p className="text-[10px] text-stone-400 font-black uppercase tracking-[0.2em] mb-1">Duration</p>
                    <p className="text-2xl font-black text-stone-900 italic tracking-tighter">{service.duration || '60m'}</p>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Price List Section */}
            {service.priceListPDF && (
              <section className="bg-stone-900 rounded-[50px] p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden group">
                {/* Decorative background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative z-10 max-w-md">
                   <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-8 border border-white/10">
                     <FileText size={32} />
                   </div>
                   <h2 className="text-3xl font-black text-white mb-4 tracking-tight uppercase">Rate Card.</h2>
                   <p className="text-stone-400 text-lg leading-relaxed font-medium">
                     Complete transparency on spares and labor. Download our verified price list for this category.
                   </p>
                </div>
                <a 
                  href={service.priceListPDF} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="relative z-10 bg-white text-stone-900 px-10 py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:bg-stone-100 transition-all shadow-2xl flex items-center gap-4 whitespace-nowrap italic active:scale-95"
                >
                  <FileText size={20} /> View Rate Card PDF
                </a>
              </section>
            )}

            {/* Available Pros Section */}
            <section className="bg-white rounded-[60px] p-10 md:p-16 border border-stone-100 shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                <div>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-stone-50 rounded-full text-stone-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6">
                    Available Pros
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-stone-900 tracking-tighter uppercase italic">Top <span className="text-stone-300 not-italic">Experts.</span></h2>
                  <p className="text-stone-500 font-medium text-lg mt-2">Highly rated professionals specializing in this service.</p>
                </div>
              </div>

              <div className="mb-12">
                <NearbyProsMap partners={partners} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {partners.slice(0, 3).map((partner) => (
                  <div key={partner.id} className="p-8 bg-stone-50/50 rounded-[40px] border border-stone-100 flex flex-col gap-6 group hover:bg-white hover:border-stone-900 transition-all duration-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <div className="w-20 h-20 rounded-[28px] overflow-hidden border-4 border-white shadow-xl transform group-hover:rotate-6 transition-transform">
                            <img 
                              src={partner.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.displayName}`} 
                              alt={partner.displayName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white ${
                            partner.availabilityStatus === 'Available' ? 'bg-emerald-500' :
                            partner.availabilityStatus === 'Busy' ? 'bg-amber-500' : 'bg-stone-300'
                          }`} />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-stone-900 italic tracking-tight">{partner.displayName}</h4>
                          <div className="flex items-center gap-4 mt-1">
                            <div className="flex items-center text-amber-500 font-black text-[10px]">
                              <Star size={10} fill="currentColor" /> {partner.rating}
                            </div>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${
                              partner.availabilityStatus === 'Available' ? 'text-emerald-500' : 'text-stone-400'
                            }`}>
                               {partner.availabilityStatus || 'Offline'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {partner.phoneNumber && (
                      <button 
                        onClick={() => window.location.href = `tel:${partner.phoneNumber}`}
                        className="w-full py-4 bg-white border border-stone-200 rounded-2xl text-[10px] font-black text-stone-900 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-stone-900 hover:text-white transition-all shadow-sm"
                      >
                        <Phone size={14} /> Contact Pro
                      </button>
                    )}
                  </div>
                ))}
                {partners.length === 0 && (
                   <div className="col-span-full py-20 text-center text-stone-400 font-medium bg-stone-50 rounded-[40px] border-2 border-dashed border-stone-100">
                     No experts found in this sector right now.
                   </div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
             <div className="sticky top-40 space-y-8">
               {/* Booking Summary Card */}
               <div className="bg-stone-900 rounded-[50px] p-10 text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-stone-500 mb-8">Summary.</p>
                  
                  <div className="space-y-6 mb-10">
                    <div className="flex justify-between items-center text-xl font-black italic tracking-tighter">
                       <span className="text-stone-500 not-italic uppercase text-[10px] tracking-widest">Base Rate</span>
                       <span>₹{service.basePrice}</span>
                    </div>
                    <div className="flex justify-between items-center text-xl font-black italic tracking-tighter">
                       <span className="text-stone-500 not-italic uppercase text-[10px] tracking-widest">Insurance</span>
                       <span className="text-emerald-400">Included</span>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/10 mb-10">
                     <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-4">You get.</p>
                     <ul className="space-y-4">
                        {[
                          'Verified mastery', 
                          'Service warranty', 
                          '24/7 Priority support'
                        ].map((item, i) => (
                           <li key={i} className="flex items-center gap-3 text-xs font-bold text-stone-300">
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
                    className="w-full bg-white text-stone-900 py-6 rounded-[28px] font-black uppercase tracking-[0.2em] text-xs italic hover:bg-stone-100 transition-all active:scale-95 shadow-xl shadow-black/20"
                  >
                    Confirm Booking
                  </button>
               </div>

               {/* Trust Indicators */}
               <div className="bg-white rounded-[40px] p-8 border border-stone-100 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-stone-50 rounded-2xl text-stone-900">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-stone-900 text-sm uppercase">Zom-Shield.</h4>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Premium cover active</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-stone-50 rounded-2xl text-stone-900">
                      <Clock size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-stone-900 text-sm uppercase">Priority.</h4>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Instant assignment</p>
                    </div>
                  </div>
               </div>
             </div>
          </div>
        </div>

        {/* Bottom Sections: FAQs & Reviews */}
        <div className="mt-32 space-y-32">
          {/* FAQs */}
          <section>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 px-4">
              <div>
                 <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-stone-100 rounded-full text-stone-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6">
                   Knowledge Base
                 </div>
                <h2 className="text-4xl md:text-5xl font-black text-stone-900 tracking-tighter uppercase italic">Insights <span className="text-stone-200 not-italic">& Assistance.</span></h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
              {faqs.map((faq) => (
                <div key={faq.id} className="p-10 bg-white border border-stone-100 rounded-[48px] hover:border-stone-900 transition-all duration-500 group">
                  <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-400 group-hover:bg-stone-900 group-hover:text-white transition-all duration-500 mb-8">
                    <HelpCircle size={24} />
                  </div>
                  <h3 className="text-xl font-black text-stone-900 mb-4 italic tracking-tight">{faq.question}</h3>
                  <p className="text-stone-500 font-medium leading-relaxed italic">{faq.answer}</p>
                </div>
              ))}
              {faqs.length === 0 && (
                <div className="col-span-full py-20 text-center text-stone-400 font-medium bg-stone-50 rounded-[48px] border-2 border-dashed border-stone-100">
                  No FAQs curated for this specialization yet.
                </div>
              )}
            </div>
          </section>

          {/* Reviews */}
          <section>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 px-4">
              <div>
                 <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-stone-100 rounded-full text-stone-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6">
                   Community Voice
                 </div>
                <h2 className="text-4xl md:text-5xl font-black text-stone-900 tracking-tighter uppercase italic">Verified <span className="text-stone-200 not-italic">Encounters.</span></h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
              {reviews.map((review) => (
                <div key={review.id} className="p-10 bg-white border border-stone-100 rounded-[48px] shadow-sm relative group hover:border-amber-200 transition-all duration-500">
                  <div className="flex gap-1 mb-8">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "text-amber-500" : "text-stone-100"} />
                    ))}
                  </div>
                  <p className="text-stone-900 text-lg font-bold italic leading-relaxed mb-10 group-hover:text-amber-700 transition-colors">"{review.comment}"</p>
                  <div className="flex items-center gap-4 pt-8 border-t border-stone-50">
                     <div className="w-10 h-10 rounded-2xl bg-stone-50 flex items-center justify-center text-[11px] font-black text-stone-400 border border-stone-100">
                       {review.customerId.slice(-2).toUpperCase()}
                     </div>
                     <div>
                       <p className="text-xs font-black text-stone-900 uppercase">Authenticated User</p>
                       <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mt-0.5">Verified Experience</p>
                     </div>
                  </div>
                </div>
              ))}
              {reviews.length === 0 && (
                 <div className="col-span-full py-20 text-center text-stone-400 font-medium bg-stone-200/20 rounded-[48px] border-2 border-dashed border-stone-100">
                   Awaiting the first expert encounter. Be the pioneer.
                 </div>
              )}
            </div>
          </section>
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
