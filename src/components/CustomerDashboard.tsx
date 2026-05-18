import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, documentId, updateDoc, doc, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, UserProfile, PartnerProfile, Promotion, Category, Service } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import ChatWindow from './ChatWindow';
import PaymentModal from './PaymentModal';
import BookingModal from './BookingModal';
import AudioCall from './AudioCall';
import AiSupportChat from './AiSupportChat';
import MarqueeCarousel from './MarqueeCarousel';
import { Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import PartnerTrackingMap from './PartnerTrackingMap';
import { 
  Clock, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  Navigation,
  MessageSquare,
  User,
  Zap,
  Search,
  ChevronRight,
  Star,
  Shield,
  ArrowRight,
  Compass,
  FileText,
  Phone,
  Sparkles
} from 'lucide-react';

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY as string) || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

function PartnerLiveStatus({ 
  partnerId, 
  destinationAddress,
  isOpen,
  onToggle,
  status,
  serviceOtp
}: { 
  partnerId: string;
  destinationAddress: string;
  isOpen: boolean;
  onToggle: () => void;
  status: string;
  serviceOtp?: string;
}) {
  const statusLabel = 
    status === 'on_the_way' ? 'Partner Navigating' : 
    status === 'arrived' ? 'Partner Arrived' : 
    status === 'in_progress' ? 'Job in Progress' : 'Update Logged';
    
  const statusColor = 
    status === 'on_the_way' ? 'bg-indigo-600' : 
    status === 'arrived' ? 'bg-amber-500' : 
    status === 'in_progress' ? 'bg-blue-600 animate-pulse' : 'bg-blue-700';

  return (
    <div className="mt-8 pt-8 border-t border-slate-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className={`flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest ${statusColor} px-4 py-2 rounded-2xl shadow-lg`}>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            {statusLabel}
          </div>
          {serviceOtp && (status === 'on_the_way' || status === 'arrived') && (
             <div className="flex items-center gap-3 bg-amber-50 px-5 py-2 rounded-2xl border border-amber-200 shadow-sm animate-bounce-subtle">
               <Shield size={14} className="text-amber-600" />
               <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest">
                 Share OTP: <span className="text-lg font-black ml-2 tracking-[0.2em]">{serviceOtp}</span>
               </span>
             </div>
          )}
        </div>
        <button 
          onClick={onToggle}
          className="w-full sm:w-auto text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 transition-all px-6 py-3 border-2 border-slate-100 rounded-2xl flex items-center justify-center gap-3 bg-white shadow-sm hover:shadow-md"
        >
          <Compass size={16} className="text-slate-900" />
          {isOpen ? 'Minimize Live Tracker' : 'Open Live Tracker'}
        </button>
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <PartnerTrackingMap 
              partnerId={partnerId} 
              destinationAddress={destinationAddress} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Props {
  profile: UserProfile;
  onServiceSelect?: (serviceId: string) => void;
  initialExpandedBookingId?: string | null;
  setActiveTab?: (tab: string, arg?: string | null) => void;
}

export default function CustomerDashboard({ profile, onServiceSelect, initialExpandedBookingId, setActiveTab }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [partners, setPartners] = useState<Record<string, UserProfile>>({});
  const [partnerDetails, setPartnerDetails] = useState<Record<string, PartnerProfile>>({});
  const [services, setServices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [trackingBookingId, setTrackingBookingId] = useState<string | null>(null);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(initialExpandedBookingId || null);
  const [bookingOtps, setBookingOtps] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialExpandedBookingId) {
      setExpandedBookingId(initialExpandedBookingId);
    }
  }, [initialExpandedBookingId]);

  const activeBookings = useMemo(() => bookings.filter(b => ['pending', 'confirmed', 'assigned', 'on_the_way', 'in_progress', 'pending_parts'].includes(b.status)), [bookings]);
  const pastBookings = useMemo(() => bookings.filter(b => ['completed', 'finalized', 'cancelled'].includes(b.status)), [bookings]);

  const activeBookingIds = activeBookings.map(b => b.id).join(',');

  useEffect(() => {
    const activeWithOtpBookings = activeBookings.filter(b => ['pending', 'assigned', 'confirmed', 'on_the_way', 'arrived'].includes(b.status));
    if (activeWithOtpBookings.length === 0) return;

    const unsubscribes = activeWithOtpBookings.map(booking => {
      return onSnapshot(doc(db, `bookings/${booking.id}/secrets`, 'otp'), (snap) => {
        if (snap.exists()) {
          setBookingOtps(prev => ({ ...prev, [booking.id]: snap.data().code }));
        }
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [activeBookingIds, activeBookings]);
  const [activeBookingChat, setActiveBookingChat] = useState<Booking | null>(null);
  const [activeCallBooking, setActiveCallBooking] = useState<Booking | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<string | null>(null);
  const [finalizingBooking, setFinalizingBooking] = useState<Booking | null>(null);
  const [bookingToPay, setBookingToPay] = useState<Booking | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allActiveServices, setAllActiveServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  // Fetch Categories & Services for discovery
  useEffect(() => {
    const fetchDiscoveryData = async () => {
      try {
        const catsSnap = await getDocs(query(collection(db, 'categories'), orderBy('name', 'asc')));
        setAllCategories(catsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
        
        const servicesSnap = await getDocs(collection(db, 'services'));
        setAllActiveServices(servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
      } catch (err) {
        console.error("Error fetching discovery data:", err);
      }
    };
    fetchDiscoveryData();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'promotions'),
      where('active', '==', true),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setPromotions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion)));
    }, (err) => console.error("Error fetching promotions:", err));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'bookings'), 
      where('customerId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bookings'));

    return () => unsubscribe();
  }, [profile.uid]);

  // Fetch partner profiles (UserProfile) for bookings
  useEffect(() => {
    const fetchPartners = async () => {
      const partnerIds = bookings
        .map(b => b.partnerId)
        .filter((id): id is string => !!id && !partners[id]);
      
      const uniqueMissingIds = Array.from(new Set(partnerIds));
      
      if (uniqueMissingIds.length === 0) return;

      try {
        const batchSize = 10;
        for (let i = 0; i < uniqueMissingIds.length; i += batchSize) {
          const chunk = uniqueMissingIds.slice(i, i + batchSize);
          const uq = query(collection(db, 'users'), where('uid', 'in', chunk));
          const uSnap = await getDocs(uq);
          const fetched: Record<string, UserProfile> = {};
          uSnap.forEach(doc => {
            const data = doc.data() as UserProfile;
            fetched[data.uid] = data;
          });
          setPartners(prev => ({ ...prev, ...fetched }));
        }
      } catch (err) {
        console.error("Error fetching partner profiles:", err);
      }
    };

    if (bookings.length > 0) {
      fetchPartners();
    }
  }, [bookings, partners]);

  // Fetch Partner details (PartnerProfile) for bookings
  useEffect(() => {
    const fetchPartnerDetails = async () => {
      const partnerIds = bookings
        .map(b => b.partnerId)
        .filter((id): id is string => !!id && !partnerDetails[id]);
      
      const uniqueMissingIds = Array.from(new Set(partnerIds));
      
      if (uniqueMissingIds.length === 0) return;

      try {
        // Partners collection uses userId field to link to UserProfile
        const batchSize = 10;
        for (let i = 0; i < uniqueMissingIds.length; i += batchSize) {
          const chunk = uniqueMissingIds.slice(i, i + batchSize);
          const pq = query(collection(db, 'partners'), where('userId', 'in', chunk));
          const pSnap = await getDocs(pq);
          const fetched: Record<string, PartnerProfile> = {};
          pSnap.forEach(doc => {
            const data = doc.data() as PartnerProfile;
            fetched[data.userId] = { id: doc.id, ...data };
          });
          setPartnerDetails(prev => ({ ...prev, ...fetched }));
        }
      } catch (err) {
        console.error("Error fetching partner details:", err);
      }
    };

    if (bookings.length > 0) {
      fetchPartnerDetails();
    }
  }, [bookings, partnerDetails]);

  // Fetch service details for bookings
  useEffect(() => {
    const fetchServices = async () => {
      const serviceIds = bookings
        .map(b => b.serviceId)
        .filter(id => id && !services[id]);
      
      const uniqueMissingIds = Array.from(new Set(serviceIds));
      
      if (uniqueMissingIds.length === 0) return;

      try {
        const batchSize = 10;
        for (let i = 0; i < uniqueMissingIds.length; i += batchSize) {
          const chunk = uniqueMissingIds.slice(i, i + batchSize);
          const uq = query(collection(db, 'services'), where(documentId(), 'in', chunk));
          const sSnap = await getDocs(uq);
          const fetched: Record<string, any> = {};
          sSnap.forEach(doc => {
            fetched[doc.id] = { id: doc.id, ...doc.data() };
          });
          setServices(prev => ({ ...prev, ...fetched }));
        }
      } catch (err) {
        console.error("Error fetching services:", err);
      }
    };

    if (bookings.length > 0) {
      fetchServices();
    }
  }, [bookings, services]);

  const getStatusColor = (status: Booking['status']) => {
    switch (status) {
      case 'finalized': 
      case 'closed':
        return 'bg-emerald-100 text-emerald-700';
      case 'completed': 
        return 'bg-emerald-600 text-white';
      case 'cancelled': 
        return 'bg-rose-100 text-rose-700';
      case 'in_progress': 
        return 'bg-blue-600 text-white animate-pulse';
      case 'on_the_way': 
        return 'bg-indigo-600 text-white';
      case 'arrived': 
        return 'bg-amber-500 text-white';
      case 'confirmed': 
      case 'assigned':
        return 'bg-blue-700 text-white';
      case 'pending':
      case 'pending_parts':
        return 'bg-amber-100 text-amber-700';
      case 'payment_pending':
        return 'bg-rose-600 text-white';
      default: return 'bg-slate-50 text-slate-400';
    }
  };

  const BookingStatusTracker = ({ status }: { status: Booking['status'] }) => {
    const stages: { key: Booking['status'][]; label: string; icon: any }[] = [
      { key: ['pending', 'pending_parts'], label: 'Booking Placed', icon: Clock },
      { key: ['confirmed', 'assigned'], label: 'Professional Assigned', icon: User },
      { key: ['on_the_way'], label: 'On The Way', icon: Navigation },
      { key: ['arrived'], label: 'Arrived', icon: MapPin },
      { key: ['in_progress'], label: 'In Progress', icon: Zap },
      { key: ['completed', 'finalized', 'closed'], label: 'Finished', icon: CheckCircle2 },
    ];

    const currentStageIndex = stages.findIndex(s => s.key.includes(status));
    
    return (
      <div className="mt-8 pt-8 border-t border-slate-100 px-2 sm:px-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
          {stages.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex || (status === 'completed' || status === 'finalized' || status === 'closed');
            const isCurrent = idx === currentStageIndex;
            const Icon = stage.icon;

            return (
              <div key={idx} className="relative z-10 flex flex-col items-center gap-3">
                <div 
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isCompleted ? 'bg-emerald-500 text-white' : 
                    isCurrent ? 'bg-blue-700 text-white ring-4 ring-blue-700/10' : 
                    'bg-white border-2 border-slate-100 text-slate-200'
                  }`}
                >
                  <Icon size={16} />
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest text-center max-w-[60px] hidden sm:block ${
                  isCurrent ? 'text-slate-900' : 'text-slate-300'
                }`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const handleFinalize = async (booking: Booking) => {
    if (booking.paymentStatus === 'unpaid' && booking.totalPrice > 0) {
      setBookingToPay(booking);
      setFinalizingBooking(null);
      return;
    }

    try {
      if (rating > 0) {
        setIsSubmittingReview(true);
        const reviewData: any = {
          bookingId: booking.id,
          customerId: profile.uid,
          partnerId: booking.partnerId,
          serviceId: booking.serviceId,
          rating,
          comment,
          createdAt: Timestamp.now()
        };
        if (reviewPhoto) reviewData.photoURL = reviewPhoto;
        
        await addDoc(collection(db, 'reviews'), reviewData);

        // Update service rating (simplified sync)
        const serviceRef = doc(db, 'services', booking.serviceId);
        const s = services[booking.serviceId];
        const newCount = (s?.reviewCount || 0) + 1;
        const newRating = ((s?.rating || 4.8) * (s?.reviewCount || 10) + rating) / (newCount + 10); // Pseudo weighted average
        
        await updateDoc(serviceRef, {
          rating: Number(newRating.toFixed(1)),
          reviewCount: newCount
        });

        // Update partner rating
        if (booking.partnerId) {
          const partnerQuery = query(collection(db, 'partners'), where('userId', '==', booking.partnerId));
          const pSnap = await getDocs(partnerQuery);
          if (!pSnap.empty) {
            const pDoc = pSnap.docs[0];
            const pData = pDoc.data() as PartnerProfile;
            const pNewCount = (pData.reviewCount || 0) + 1;
            const pNewRating = ((pData.rating || 4.8) * (pData.reviewCount || 10) + rating) / (pNewCount + 10);
            await updateDoc(doc(db, 'partners', pDoc.id), {
              rating: Number(pNewRating.toFixed(1)),
              reviewCount: pNewCount
            });
          }
        }
      }

      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'finalized',
        updatedAt: Timestamp.now()
      });
      setShowSuccessModal("Review submitted! Thank you for helping us maintain service quality.");
      setFinalizingBooking(null);
      setRating(5);
      setComment('');
      setReviewPhoto('');
      setIsSubmittingReview(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
      setIsSubmittingReview(false);
    }
  };

  if (loading) return <div className="p-20 text-center text-slate-400">Loading your personalized dashboard...</div>;

  const filteredServices = allActiveServices.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !activeCategoryFilter || s.categoryId === activeCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 sm:py-20 lg:py-24">
      {/* Success Confirmation Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-blue-700/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[48px] p-8 sm:p-12 max-w-sm w-full text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)]"
            >
              <div className="w-20 h-20 bg-blue-700 text-white rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900 italic mb-4">Confirmed</h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-10">{showSuccessModal}</p>
              <button 
                onClick={() => setShowSuccessModal(null)}
                className="w-full bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-blue-800 transition-all shadow-lg active:scale-95"
              >
                Acknowledge
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16 sm:mb-24 px-2 sm:px-0">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
            Digital Hub
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 mb-6 tracking-tighter leading-[0.85] uppercase italic">
            Hi, {(profile.displayName || 'Guest').split(' ')[0]}
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-sm leading-relaxed">
            Your home ecosystem is <span className="text-slate-900 underline decoration-slate-200 decoration-4 underline-offset-8">synchronized</span>.
          </p>
        </div>
        <div className="relative w-full md:w-[400px] group">
          <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={24} />
          <input 
            type="text" 
            placeholder="Search service history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-slate-100 pl-20 pr-8 py-7 rounded-[40px] text-lg font-bold focus:outline-none focus:border-blue-700 transition-all shadow-xl shadow-slate-200/50"
          />
        </div>
      </div>

      <MarqueeCarousel 
        promotions={promotions}
        services={allActiveServices}
        onServiceClick={setSelectedService}
      />

      {/* Active High-Visibility Status Ticker */}
      {activeBookings.some(b => ['pending', 'assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress'].includes(b.status)) && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {activeBookings.filter(b => ['pending', 'assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress'].includes(b.status)).map(booking => (
            <div key={booking.id} className="bg-blue-700 text-white rounded-[48px] p-8 sm:p-12 shadow-2xl shadow-blue-700/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl animate-pulse" />
              <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center gap-12">
                <div className="flex items-center gap-10">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-blue-600 rounded-[40px] border border-white/10 flex items-center justify-center relative shadow-2xl overflow-hidden shrink-0">
                    {services[booking.serviceId]?.imageURL ? (
                      <img src={services[booking.serviceId].imageURL} alt="" className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000" referrerPolicy="no-referrer" />
                    ) : (
                      <Zap size={48} className="text-slate-700" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-3 h-3 rounded-full animate-ping ${booking.status === 'in_progress' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${booking.status === 'in_progress' ? 'text-blue-400' : 'text-emerald-400'}`}>
                        {booking.status === 'confirmed' || booking.status === 'assigned' ? 'Agent Assigned' : 
                         booking.status === 'pending' ? 'Looking for Partner' : 
                         booking.status === 'in_progress' ? 'Service In Progress' : 'Live Arrival Status'}
                      </span>
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase mb-2">
                       {booking.status === 'confirmed' || booking.status === 'assigned' ? 'Ready for Pro' : 
                        booking.status === 'pending' ? 'Connecting...' : 
                        booking.status === 'in_progress' ? 'Pro is working' : 'Pro is arriving'}
                    </h3>
                    <p className="text-slate-400 font-medium">Your {services[booking.serviceId]?.name} service starts soon.</p>
                  </div>
                </div>

                {bookingOtps[booking.id] && (
                  <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[48px] text-center w-full sm:w-auto shadow-2xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4">Security Verification OTP</p>
                    <div className="flex items-center justify-center gap-4">
                      {bookingOtps[booking.id].split('').map((digit, i) => (
                        <div key={i} className="w-14 h-18 bg-white text-slate-900 rounded-2xl flex items-center justify-center text-4xl font-black italic shadow-xl">
                          {digit}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 mt-6 uppercase tracking-widest leading-relaxed px-6">
                      Share this code ONLY with the partner <br/> once they arrive at your location.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Active Bookings - High Priority if exists */}
      {!searchQuery && activeBookings.length > 0 && (
        <div className="mb-32">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-700 rounded-[16px] text-white shadow-2xl flex items-center justify-center">
                <Calendar size={18} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Live Jobs</h2>
            </div>
          </div>
          <div className="space-y-8">
            {activeBookings.map((booking) => (
              <motion.div 
                layout
                key={booking.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-white border-2 transition-all duration-500 ${expandedBookingId === booking.id ? 'border-blue-700 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)]' : 'border-slate-100 shadow-sm hover:border-slate-200'} rounded-[48px] sm:rounded-[64px] p-8 sm:p-12 cursor-pointer relative overflow-hidden`}
                onClick={() => setExpandedBookingId(expandedBookingId === booking.id ? null : booking.id)}
              >
                {/* Visual Accent for Status */}
                {['on_the_way', 'arrived', 'in_progress'].includes(booking.status) && (
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl animate-pulse" />
                )}

                <div className="flex flex-col lg:flex-row justify-between gap-12 relative z-10">
                  <div className="flex gap-8 sm:gap-10 items-start">
                    <div className="w-20 h-20 sm:w-32 sm:h-32 bg-slate-50 rounded-[32px] sm:rounded-[48px] flex items-center justify-center text-slate-900 overflow-hidden shrink-0 shadow-inner group">
                      {services[booking.serviceId]?.imageURL ? (
                        <img src={services[booking.serviceId].imageURL} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                      ) : (
                        <Zap size={40} className="text-slate-200" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-2">
                      <div className="flex items-center gap-4 mb-4">
                         <span className={`text-[9px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest ${getStatusColor(booking.status)} shadow-sm border border-black/5`}>
                           {booking.status.replace('_', ' ')}
                         </span>
                         <span className="text-[10px] text-slate-300 font-mono font-bold tracking-[0.2em] uppercase">ID: {booking.id.slice(0, 8)}</span>
                      </div>
                      <h3 className="text-3xl sm:text-4xl font-black mb-4 text-slate-900 tracking-tighter uppercase italic leading-none">
                        {services[booking.serviceId]?.name || 'Professional Service'}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 text-xs sm:text-sm text-slate-500">
                        <div className="flex items-center gap-4 font-black uppercase tracking-widest text-slate-900">
                          <Calendar size={18} className="text-slate-300" /> {booking.scheduledAt?.toDate?.()?.toLocaleDateString([], { month: 'long', day: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-4 font-black uppercase tracking-widest text-slate-900">
                          <Clock size={18} className="text-slate-300" /> {booking.scheduledAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex items-center gap-4 col-span-full font-bold text-slate-400">
                          <MapPin size={18} className="shrink-0" /> <span className="truncate">{booking.address}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row lg:flex-col justify-between items-end gap-6 pt-8 lg:pt-2">
                    <div className="text-left lg:text-right">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] mb-2 leading-none">Project Value</p>
                      <p className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter italic leading-none">₹{booking.totalPrice}</p>
                    </div>
                    <div className="flex gap-4">
                      {booking.partnerId && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCallBooking(booking);
                            }}
                            className="bg-emerald-500 text-white px-6 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-2xl shadow-emerald-500/20 flex items-center gap-3 active:scale-95"
                          >
                            <Phone size={16} />
                            Call
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveBookingChat(booking);
                            }}
                            className="bg-blue-700 text-white px-6 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-800 transition-all shadow-2xl shadow-blue-700/20 flex items-center gap-3 active:scale-95"
                          >
                            <MessageSquare size={16} />
                            Chat
                          </button>
                        </>
                       )}
                      <button className="bg-slate-50 text-slate-400 hover:text-blue-700 p-4 rounded-[20px] transition-all border border-slate-100 flex items-center justify-center">
                        <HelpCircle size={24} />
                      </button>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookingId === booking.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-10 pt-10 border-t border-slate-50 grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="md:col-span-2">
                           <BookingStatusTracker status={booking.status} />
                        </div>
                        <div className="space-y-8">
                          <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Service Details</h4>
                            <div className="space-y-6">
                              <div>
                                <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Core Service</p>
                                <p className="text-xl font-bold text-slate-900">{services[booking.serviceId]?.name}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Insight</p>
                                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                  {services[booking.serviceId]?.description}
                                </p>
                              </div>
                              {booking.notes && (
                                <div className="p-6 bg-amber-50 border border-amber-100 rounded-[32px]">
                                  <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <FileText size={14} /> Special Instructions
                                  </p>
                                  <p className="text-sm text-amber-900 italic font-medium leading-relaxed">"{booking.notes}"</p>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Additional Charges Breakdown */}
                          {(booking.additionalCharges?.length || 0) > 0 && (
                            <div className="p-8 bg-slate-50 border border-slate-100 rounded-[32px] space-y-4">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Itemized Add-ons</p>
                              <div className="space-y-3">
                                {booking.additionalCharges?.map((charge, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-sm font-bold">
                                    <span className="text-slate-500">{charge.reason}</span>
                                    <span className="text-slate-900">₹{charge.amount}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="pt-4 border-t border-slate-200 flex justify-between items-center font-black text-slate-900 text-lg">
                                <span>Subtotal Add-ons</span>
                                <span>₹{booking.additionalCharges?.reduce((sum, c) => sum + c.amount, 0)}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Your Professional</h4>
                          {booking.partnerId ? (
                            <>
                              <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                                <div className="w-16 h-16 bg-white rounded-2xl shadow-lg shadow-slate-200 flex items-center justify-center overflow-hidden border-2 border-white">
                                  {partners[booking.partnerId]?.photoURL ? (
                                    <img src={partners[booking.partnerId].photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <User size={32} className="text-slate-200" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-lg font-black text-slate-900">{partners[booking.partnerId]?.displayName}</p>
                                    {partnerDetails[booking.partnerId]?.isVerified && (
                                      <div className="text-emerald-500 bg-emerald-50 p-1 rounded-full shadow-sm" title="Verified Professional">
                                        <CheckCircle2 size={14} fill="currentColor" className="text-white fill-emerald-500" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                                      partnerDetails[booking.partnerId]?.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}>
                                       {partnerDetails[booking.partnerId]?.isVerified ? 'Platinum Verified' : 'Checking Credentials'}
                                    </span>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-900 ml-auto">
                                      <Star size={12} fill="currentColor" className="text-amber-400" /> {partnerDetails[booking.partnerId]?.rating || 4.9}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {partners[booking.partnerId]?.phoneNumber && (
                                      <a 
                                        href={`tel:${partners[booking.partnerId].phoneNumber}`} 
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-xs font-black text-slate-900 hover:underline flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
                                      >
                                        Contact Pro
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Live Chat Integration */}
                              <div className="mt-8">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Direct Message</h4>
                                <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden">
                                  <ChatWindow 
                                    booking={booking}
                                    otherUser={partners[booking.partnerId] || null}
                                    isEmbedded={true}
                                  />
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="p-10 bg-slate-50 rounded-[32px] border-2 border-slate-200 border-dashed text-center">
                              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <Search size={20} className="text-slate-300" />
                              </div>
                              <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Assigning Pro</p>
                              <p className="text-xs text-slate-400 font-medium">Sit back! We're matching you with the best available expert in your area.</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {['in_progress', 'completed'].includes(booking.status) && (
                        <div className="mt-12 flex justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFinalizingBooking(booking);
                            }}
                            className={`${
                              booking.status === 'completed' 
                                ? 'bg-emerald-600 shadow-emerald-200' 
                                : 'bg-blue-700 shadow-slate-200'
                            } w-full sm:w-auto text-white px-16 py-5 rounded-[24px] font-black uppercase tracking-widest text-sm hover:opacity-90 transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3`}
                          >
                            <CheckCircle2 size={24} />
                            {booking.status === 'completed' ? (
                              booking.paymentStatus === 'unpaid' ? 'Pay & Close Service' : 'Confirm Service Completion'
                            ) : 'Mark Task as Completed'}
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {(['on_the_way', 'arrived', 'in_progress'].includes(booking.status)) && booking.partnerId && (
                  <PartnerLiveStatus 
                    partnerId={booking.partnerId}
                    destinationAddress={booking.address}
                    isOpen={trackingBookingId === booking.id}
                    onToggle={() => setTrackingBookingId(trackingBookingId === booking.id ? null : booking.id)}
                    status={booking.status}
                    serviceOtp={booking.serviceOtp}
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Promotions & Offers - Discovery */}
      {promotions.length > 0 && !searchQuery && (
        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-xl text-white shadow-lg shadow-amber-200">
                <Zap size={18} fill="currentColor" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight italic">Exclusive Deals</h2>
            </div>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {promotions.map((promo, idx) => {
              const bgColors = [
                'from-slate-900 to-slate-800',
                'from-indigo-600 to-blue-500',
                'from-emerald-600 to-teal-500',
                'from-rose-600 to-pink-500',
                'from-amber-600 to-orange-500',
                'from-purple-600 to-indigo-500'
              ];
              const bgColor = bgColors[idx % bgColors.length];

              return (
                <motion.div 
                  whileHover={{ y: -5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={promo.id}
                  className={`flex-shrink-0 w-[300px] sm:w-96 bg-gradient-to-br ${bgColor} rounded-[40px] p-8 text-white relative overflow-hidden group shadow-2xl shadow-slate-200 cursor-pointer`}
                >
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-white/20 transition-all" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
                  <div className="absolute top-1/4 left-1/2 w-40 h-40 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 rotate-45 group-hover:rotate-90 transition-transform duration-1000" />

                  {promo.imageUrl && (
                    <div className="absolute inset-0 opacity-10 group-hover:opacity-30 transition-all duration-500 mix-blend-overlay">
                      <img src={promo.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}

                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(promo.code);
                        }}
                        className="bg-white/20 backdrop-blur-xl border border-white/30 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 hover:bg-white/40 transition-all active:scale-95"
                      >
                        <Zap size={10} fill="currentColor" />
                        Code: {promo.code}
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black mb-3 leading-tight tracking-tight drop-shadow-sm">{promo.name}</h3>
                      <p className="text-white/80 text-sm mb-8 line-clamp-2 font-medium leading-relaxed">{promo.description}</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-1">Exclusive Discount</p>
                        <p className="text-4xl font-black tracking-tighter drop-shadow-md">
                          {promo.discountType === 'percent' ? `${promo.discountValue}%` : `₹${promo.discountValue}`} OFF
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 shadow-xl group-hover:translate-x-1 transition-transform">
                        <ChevronRight size={24} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Categories Discovery */}
      {!searchQuery && (
        <div className="mb-24">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-700 rounded-[16px] text-white shadow-2xl flex items-center justify-center">
                <Compass size={18} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Discovery</h2>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-8 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <button 
              onClick={() => setActiveCategoryFilter(null)}
              className={`flex-shrink-0 px-8 py-5 rounded-[24px] font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all shadow-sm active:scale-95 duration-500 ${!activeCategoryFilter ? 'bg-blue-700 text-white shadow-slate-200' : 'bg-slate-50 border-2 border-slate-50 text-slate-400 hover:text-blue-700 hover:bg-slate-100 hover:border-slate-100'}`}
            >
              All Assets
            </button>
            {allCategories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={`flex-shrink-0 px-8 py-5 rounded-[24px] font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-4 shadow-sm active:scale-95 duration-500 ${activeCategoryFilter === cat.id ? 'bg-blue-700 text-white shadow-slate-200' : 'bg-slate-50 border-2 border-slate-50 text-slate-400 hover:text-blue-700 hover:bg-slate-100 hover:border-slate-100'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Services Grid or Filtered Results */}
      {(activeCategoryFilter || searchQuery) && (
        <div className="mb-32">
           <div className="flex items-center justify-between mb-16">
            <div>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-4">
                {searchQuery ? `Results: "${searchQuery}"` : allCategories.find(c => c.id === activeCategoryFilter)?.name}
              </h2>
              <p className="text-slate-400 font-medium">Refining your selection for <span className="text-slate-900 border-b border-blue-700">verified pros</span>.</p>
            </div>
            <button 
              onClick={() => { setSearchQuery(''); setActiveCategoryFilter(null); }}
              className="px-6 py-3 bg-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:text-blue-700 hover:bg-slate-200 uppercase tracking-widest transition-all"
            >
              Reset View
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredServices.map(service => (
              <motion.div 
                layout
                key={service.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -8 }}
                className="bg-white border-2 border-slate-50 rounded-[48px] p-8 sm:p-10 shadow-sm hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] hover:border-blue-700 transition-all duration-500 group flex flex-col h-full overflow-hidden"
              >
                {service.imageURL && (
                  <div className="w-full h-48 sm:h-56 rounded-[32px] overflow-hidden mb-8 bg-slate-50 shadow-inner group-hover:shadow-2xl transition-all duration-700">
                    <img src={service.imageURL} alt="" className="w-full h-full object-cover grayscale transition-all duration-1000 group-hover:grayscale-0 group-hover:scale-110" referrerPolicy="no-referrer" />
                  </div>
                )}
                  <div 
                    onClick={() => onServiceSelect?.(service.id)}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase italic">{service.name}</h3>
                      <div className="flex items-center gap-1.5 text-amber-500 font-black text-sm bg-amber-50 px-3 py-1 rounded-full">
                        <Star size={14} fill="currentColor" /> {service.rating || 4.8}
                      </div>
                    </div>
                    <p className="text-slate-500 text-sm line-clamp-3 mb-10 font-medium leading-relaxed">{service.description}</p>
                  </div>
                <div className="flex justify-between items-center pt-8 border-t border-slate-100 mt-auto">
                  <div>
                    <p className="text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] leading-none mb-2 italic">Operational Base</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{service.basePrice}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedService(service)}
                    className="bg-blue-700 text-white px-8 py-5 rounded-[22px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-800 transition-all active:scale-95 shadow-2xl shadow-blue-700/10"
                  >
                    Deploy Pro
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
          {filteredServices.length === 0 && (
            <div className="py-20 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
              <Search size={32} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">No services found matching your criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* Past Bookings - Collapsible Section */}
      {!searchQuery && pastBookings.length > 0 && (
        <div className="mb-20">
           <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-slate-100 rounded-xl text-slate-400">
                <Clock size={18} />
              </div>
              <h2 className="text-xl font-black text-slate-400 tracking-tight italic uppercase tracking-widest">History</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {pastBookings.slice(0, 4).map(booking => (
                 <div 
                   key={booking.id}
                   className="bg-white border border-slate-100 rounded-[32px] p-6 hover:border-slate-200 transition-all flex gap-4"
                 >
                   <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0">
                      {services[booking.serviceId]?.imageURL ? (
                        <img src={services[booking.serviceId].imageURL} alt="" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                      ) : (
                        <CheckCircle2 size={24} className="text-slate-300" />
                      )}
                   </div>
                   <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-slate-900 truncate text-sm">{services[booking.serviceId]?.name}</h4>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{booking.status}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 mb-3 font-bold">{booking.scheduledAt?.toDate?.()?.toLocaleDateString()}</p>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setSelectedService(services[booking.serviceId])}
                          className="text-[9px] font-black uppercase tracking-widest text-slate-900 border-b-2 border-blue-700 pb-0.5 hover:text-slate-500 hover:border-slate-500 transition-colors"
                        >
                          Book Again
                        </button>
                        {['completed', 'finalized'].includes(booking.status) && (
                          <div className="flex flex-col items-end gap-2">
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none">Post-Service Care Available</p>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`mailto:support@zomindia.com?subject=Support Request: Booking ${booking.id}&body=Hi Support Team,%0D%0A%0D%0AI need assistance with my booking ${booking.id} (${services[booking.serviceId]?.name}).%0D%0A%0D%0A[Please describe your issue here]`);
                              }}
                              className="text-[9px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition-all shadow-sm"
                              title="Our experts are here 24/7 to resolve any post-service concerns or quality issues."
                            >
                              <HelpCircle size={10} /> Resolve Issue / Get Support
                            </button>
                          </div>
                        )}
                      </div>
                   </div>
                 </div>
               ))}
            </div>
            {pastBookings.length > 4 && (
              <button className="w-full mt-6 py-4 bg-white border border-slate-100 rounded-2xl text-xs font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-colors">
                View Full Service History
              </button>
            )}
        </div>
      )}

      {/* Discovery Section - If no active results */}
      {!searchQuery && activeBookings.length === 0 && !activeCategoryFilter && (
        <div className="text-center py-20 bg-slate-50 rounded-[48px] border-2 border-white shadow-inner">
           <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-slate-200">
             <Sparkles size={32} className="text-slate-900" />
           </div>
           <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter">Start your first project</h2>
           <p className="text-slate-500 max-w-sm mx-auto mb-10 font-medium leading-relaxed">
             From plumbing to home beauty, we have the best professionals ready to help. Discover top services in your area.
           </p>
           <div className="flex flex-wrap justify-center gap-4">
              {allCategories.slice(0, 3).map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => setActiveCategoryFilter(cat.id)}
                  className="bg-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-900 shadow-lg shadow-slate-200 hover:scale-105 transition-all"
                >
                  {cat.name}
                </button>
              ))}
           </div>
        </div>
      )}

      {/* Booking Modal Integration */}
      <AnimatePresence>
        {selectedService && (
          <BookingModal 
            service={selectedService}
            profile={profile}
            onClose={() => setSelectedService(null)}
            onSuccess={() => {
              setSelectedService(null);
              setExpandedBookingId(null);
              if (setActiveTab) setActiveTab('home');
            }}
          />
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {activeBookingChat && (
          <ChatWindow 
            booking={activeBookingChat}
            otherUser={partners[activeBookingChat.partnerId!] || null}
            onClose={() => setActiveBookingChat(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeCallBooking && (
          <AudioCall 
            otherUser={partners[activeCallBooking.partnerId!] || null}
            onEndCall={() => setActiveCallBooking(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {finalizingBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFinalizingBooking(null)}
              className="absolute inset-0 bg-blue-700/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-blue-700 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Finalize Service</h3>
                  <p className="text-slate-500">Please review the final details before completing.</p>
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-6 mb-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Service</p>
                      <p className="font-bold text-slate-900">{services[finalizingBooking.serviceId]?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Paid</p>
                      <p className="text-xl font-bold text-slate-900">₹{finalizingBooking.totalPrice}</p>
                    </div>
                  </div>

                  {/* Rating & Review Section */}
                  <div className="pt-4 border-t border-slate-200/50">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 text-center">Rate your Experience</p>
                    <div className="flex justify-center gap-2 mb-4">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button 
                            key={star} 
                            type="button"
                            onClick={() => setRating(star)}
                            className="transition-transform active:scale-125"
                          >
                            <Star 
                              size={28} 
                              fill={star <= rating ? "currentColor" : "none"} 
                              className={star <= rating ? "text-amber-400" : "text-slate-300"} 
                            />
                          </button>
                        ))}
                    </div>
                    <textarea 
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us what you liked about the service..."
                      className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-700 outline-none h-24 resize-none mb-3"
                    />
                    <input
                      type="url"
                      value={reviewPhoto}
                      onChange={(e) => setReviewPhoto(e.target.value)}
                      placeholder="Add an image URL (optional)..."
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-blue-700 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Date & Time</p>
                      <p className="text-xs font-bold text-slate-900">
                        {finalizingBooking.scheduledAt?.toDate?.()?.toLocaleDateString()} at {finalizingBooking.scheduledAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Address</p>
                      <p className="text-[10px] text-slate-600 line-clamp-1">{finalizingBooking.address}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setFinalizingBooking(null)}
                    disabled={isSubmittingReview}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleFinalize(finalizingBooking)}
                    disabled={isSubmittingReview}
                    className="flex-1 px-6 py-4 bg-blue-700 text-white rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {isSubmittingReview ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : null}
                    {finalizingBooking.paymentStatus === 'unpaid' ? 'Continue to Payment' : 'Confirm & Review'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bookingToPay && (
          <PaymentModal 
            booking={bookingToPay}
            profile={profile}
            onClose={() => setBookingToPay(null)}
            onSuccess={() => {
              setBookingToPay(null);
            }}
          />
        )}
      </AnimatePresence>

      <AiSupportChat userProfile={profile} isPartner={false} bookings={bookings} />
    </div>
  );
}
