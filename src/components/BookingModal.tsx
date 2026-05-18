import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, Timestamp, query, where, getDocs, limit, doc, getDoc, updateDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Service, UserProfile, Promotion, Redemption, PartnerProfile, BookingStatus, AMC } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { sendNotification } from '../lib/notifications';
import { getWhatsAppBookingLink } from '../lib/whatsapp';
import { handleMapsError } from '../lib/maps-errors';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Map,
  AdvancedMarker,
  Pin,
  useMapsLibrary
} from '@vis.gl/react-google-maps';
import { 
  X, 
  Clock, 
  MapPin, 
  CreditCard,
  Calendar as CalendarIcon,
  CheckCircle2,
  ArrowLeft,
  Navigation,
  Info,
  Zap,
  FileText,
  AlertCircle,
  MessageCircle
} from 'lucide-react';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY as string) || '';

interface Props {
  service: Service;
  profile: UserProfile | null;
  onClose: () => void;
  onSuccess: () => void;
}

function AddressAutocomplete({ onAddressSelect }: { onAddressSelect: (address: string, lat: number, lng: number) => void }) {
  const placesLib = useMapsLibrary('places');
  const [inputValue, setInputValue] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (placesLib) {
      autocompleteService.current = new placesLib.AutocompleteService();
      // Dummy element for PlacesService
      const div = document.createElement('div');
      placesService.current = new placesLib.PlacesService(div);
    }
  }, [placesLib]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.length > 2 && autocompleteService.current) {
      autocompleteService.current.getPlacePredictions(
        { input: value, componentRestrictions: { country: 'in' } },
        (results) => setPredictions(results || [])
      );
    } else {
      setPredictions([]);
    }
  };

  const handleSelectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    setInputValue(prediction.description);
    setPredictions([]);

    if (placesService.current) {
      placesService.current.getDetails(
        { placeId: prediction.place_id, fields: ['formatted_address', 'geometry', 'name'] },
        (place, status) => {
          if (status === 'OK' && place?.formatted_address && place.geometry?.location) {
            onAddressSelect(
              place.formatted_address,
              place.geometry.location.lat(),
              place.geometry.location.lng()
            );
          } else {
            const errorMsg = handleMapsError(status === 'OK' ? place : { status });
            alert(errorMsg);
          }
        }
      );
    }
  };

  return (
    <div className="relative">
      <div className="relative group">
        <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={16} />
        <input 
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Search area, colony, or landmark..."
          className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all text-sm font-medium text-slate-900 placeholder:text-slate-300"
        />
      </div>
      
      {predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              onClick={() => handleSelectPrediction(p)}
              className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none group"
            >
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-slate-300 mt-0.5 group-hover:text-blue-700 transition-colors" />
                <div>
                  <p className="text-sm font-bold text-slate-900">{p.structured_formatting.main_text}</p>
                  <p className="text-xs text-slate-400">{p.structured_formatting.secondary_text}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BookingModal({ service, profile, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState(profile?.address || '');
  const [addressDetails, setAddressDetails] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('cash');
  const [availablePromos, setAvailablePromos] = useState<Promotion[]>([]);
  const [showPromos, setShowPromos] = useState(false);
  const [slotNotAvailablePopup, setSlotNotAvailablePopup] = useState(false);
  
  // AMC State
  const [activeAmc, setActiveAmc] = useState<AMC | null>(null);
  const [useAmc, setUseAmc] = useState(false);

  // Fetch available promos & AMCs
  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      try {
        // Fetch Promos
        const qPromos = query(collection(db, 'promotions'), where('active', '==', true), limit(5));
        const promoSnap = await getDocs(qPromos);
        setAvailablePromos(promoSnap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion)));

        // Fetch user's active AMC for this service
        const qAmc = query(
          collection(db, 'amcs'), 
          where('customerId', '==', profile.uid),
          where('serviceId', '==', service.id),
          where('status', '==', 'active')
        );
        const amcSnap = await getDocs(qAmc);
        if (!amcSnap.empty) {
          const amcData = { id: amcSnap.docs[0].id, ...amcSnap.docs[0].data() } as AMC;
          // Check if frequency not exceeded
          if (amcData.serviceBookingIds.length < amcData.frequency) {
            setActiveAmc(amcData);
            setUseAmc(true); // Default to using AMC if available
          }
        }
      } catch (err) {
        console.error("Error fetching booking data:", err);
      }
    };
    fetchData();
  }, [profile, service.id]);

  const timeSlots = [
    { label: '09:00 AM', value: '09:00' },
    { label: '11:00 AM', value: '11:00' },
    { label: '01:00 PM', value: '13:00' },
    { label: '03:00 PM', value: '15:00' },
    { label: '05:00 PM', value: '17:00' },
    { label: '07:00 PM', value: '19:00' },
  ];

  const getSlotStatus = (slotValue: string, testDate?: string) => {
    const d = testDate || date;
    if (!d) return 'available';
    
    const now = new Date();
    // Use local YYYY-MM-DD for comparison
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    if (d > todayStr) return 'available';
    if (d < todayStr) return 'expired';
    
    // It's today. Construct the slot time in local time.
    const [hours, minutes] = slotValue.split(':').map(Number);
    const slotTime = new Date(now);
    slotTime.setHours(hours, minutes, 0, 0);
    
    // Calculate difference in hours
    const diffInMs = slotTime.getTime() - now.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    
    // Slot must be at least 2 hours in the future
    if (diffInHours < 2) return 'expired';
    return 'available';
  };

  // Promo Code State
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoError, setPromoError] = useState('');
  const [isVerifyingPromo, setIsVerifyingPromo] = useState(false);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  useEffect(() => {
    if (!profile) return;
    const fetchRedemptions = async () => {
      try {
        const q = query(collection(db, 'redemptions'), where('userId', '==', profile.uid), where('status', '==', 'active'));
        const snap = await getDocs(q);
        setRedemptions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Redemption)));
      } catch (err) {
        console.error("Error fetching redemptions:", err);
      }
    };
    fetchRedemptions();
  }, [profile]);

  useEffect(() => {
    if (redemptions.length > 0 && service && !appliedPromo && step === 2) {
      const match = redemptions.find(r => r.appliedCategoryId === service.categoryId);
      if (match) {
        getDoc(doc(db, 'promotions', match.promotionId)).then(dsnap => {
          if (dsnap.exists()) {
             setAppliedPromo({ id: dsnap.id, ...dsnap.data() } as Promotion);
          }
        });
      }
    }
  }, [redemptions, service, appliedPromo, step]);

  const isSurgePricingActive = () => {
    if (profile?.isPremium) return false; // Zero surge for Prime
    if (!time) return false;
    const [h] = time.split(':').map(Number);
    // Surge during 8-10 AM or 17-20 PM
    if ((h >= 8 && h <= 10) || (h >= 17 && h <= 20)) {
      return true;
    }
    return false;
  };

  const getSurgeAmount = () => {
    if (profile?.isPremium) return 0;
    return isSurgePricingActive() ? Math.round(service.basePrice * 0.20) : 0;
  };

  const getPrimeDiscountAmount = () => {
    return profile?.isPremium ? Math.round(service.basePrice * 0.15) : 0;
  };

  const calculateFinalPrice = () => {
    if (useAmc && activeAmc) return 0;
    
    let price = service.basePrice + getSurgeAmount() - getPrimeDiscountAmount();
    if (appliedPromo) {
      if (appliedPromo.discountType === 'percent') {
        const discountAmount = (price * appliedPromo.discountValue) / 100;
        price -= discountAmount;
      } else {
        price -= appliedPromo.discountValue;
      }
    }
    return Math.max(0, Math.round(price));
  };

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    
    setIsVerifyingPromo(true);
    setPromoError('');
    try {
      const q = query(
        collection(db, 'promotions'), 
        where('code', '==', promoInput.trim().toUpperCase()),
        where('active', '==', true),
        limit(1)
      );
      
      const snap = await getDocs(q);
      if (snap.empty) {
        setPromoError('Invalid or expired code.');
        setAppliedPromo(null);
      } else {
        const promoData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Promotion;
        
        // Check restrictions
        const hasCategoriesList = promoData.applicableCategories && promoData.applicableCategories.length > 0;
        const hasServicesList = promoData.applicableServices && promoData.applicableServices.length > 0;

        if (hasServicesList && !promoData.applicableServices?.includes(service.id)) {
          setPromoError('This code is not valid for this specific service.');
          setAppliedPromo(null);
          return;
        }

        if (hasCategoriesList && !promoData.applicableCategories?.includes(service.categoryId)) {
          // If a category was specified, make sure this service belongs to it
          // Note: If both categories and services are specified, we check if service matches OR category matches?
          // Usually if services are specified, they should be the ultimate source of truth.
          // But here let's stick to: must match service if list exists, AND must match category if list exists.
          setPromoError('This code is not valid for services in this category.');
          setAppliedPromo(null);
          return;
        }
        if (promoData.expiryDate) {
          const expiry = new Date(promoData.expiryDate);
          if (expiry < new Date()) {
            setPromoError('This code has expired.');
            setAppliedPromo(null);
            return;
          }
        }

        setAppliedPromo(promoData);
        setPromoInput(''); // Clear input on success
      }
    } catch (err) {
      console.error('Promo error:', err);
      setPromoError('Failed to verify code.');
    } finally {
      setIsVerifyingPromo(false);
    }
  };

  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastBookingId, setLastBookingId] = useState<string | null>(null);

  const handleBooking = async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    const bookingPath = 'bookings';
    try {
      // Re-verify promo if it exists before finalizing
      if (appliedPromo) {
        const pRef = doc(db, 'promotions', appliedPromo.id);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          const pData = pSnap.data();
          if (pData.usageLimit && (pData.usageCount || 0) >= pData.usageLimit) {
            throw new Error("This promotion has reached its maximum usage limit.");
          }
          // Increment usage count atomically (we use increment in a transaction or update)
          // For now, simple updateDoc with old value is safer in this context if we don't have firestore increment imported
        }
      }

      const scheduledAt = new Date(`${date}T${time}`);
      const fullAddress = `${addressDetails ? addressDetails + ', ' : ''}${address}`;
      const finalPrice = calculateFinalPrice();
      
      const serviceOtp = Math.floor(1000 + Math.random() * 9000).toString();

      // PARTNER MATCHING LOGIC
      let assignedPartnerId: string | null = null;
      let bookingStatus: BookingStatus = 'pending';

      try {
        const partnersSnap = await getDocs(collection(db, 'partners'));
        const partners = partnersSnap.docs.map(d => ({ id: d.id, ...d.data() } as PartnerProfile));

        // 1. Filter eligible partners
        const eligiblePartners = partners.filter(p => 
          p.isVerified && 
          p.status === 'active' && 
          p.categories.includes(service.categoryId) &&
          p.availabilityStatus !== 'Offline'
        );

        if (eligiblePartners.length > 0) {
          // 2. Sort according to criteria
          const sortedPartners = [...eligiblePartners].sort((a, b) => {
            // Priority 1: Availability
            if (a.availabilityStatus === 'Available' && b.availabilityStatus !== 'Available') return -1;
            if (a.availabilityStatus !== 'Available' && b.availabilityStatus === 'Available') return 1;

            // Priority 2: Proximity (if location is available)
            if (location && a.lat && a.lng && b.lat && b.lng) {
              const distA = Math.sqrt(Math.pow(a.lat - location.lat, 2) + Math.pow(a.lng - location.lng, 2));
              const distB = Math.sqrt(Math.pow(b.lat - location.lat, 2) + Math.pow(b.lng - location.lng, 2));
              if (Math.abs(distA - distB) > 0.0001) { // 0.0001 deg is ~11m
                return distA - distB;
              }
            }

            // Priority 3: Rating
            return (b.rating || 0) - (a.rating || 0);
          });

          const bestPartner = sortedPartners[0];
          assignedPartnerId = bestPartner.userId;
          bookingStatus = 'assigned';
        }
      } catch (matchErr) {
        console.error("Partner matching failed, falling back to manual assignment:", matchErr);
      }

      const batch = writeBatch(db);
      const bookingRef = doc(collection(db, bookingPath));
      setLastBookingId(bookingRef.id);
      
      batch.set(bookingRef, {
        customerId: profile?.uid || auth.currentUser?.uid,
        serviceId: service.id,
        partnerId: assignedPartnerId,
        status: bookingStatus,
        paymentStatus: useAmc ? 'paid' : 'unpaid',
        scheduledAt: Timestamp.fromDate(scheduledAt),
        address: fullAddress,
        lat: location?.lat || null,
        lng: location?.lng || null,
        totalPrice: finalPrice,
        promoCode: appliedPromo?.code || null,
        discountApplied: useAmc ? service.basePrice : (appliedPromo ? (service.basePrice - finalPrice) : 0),
        paymentMethod: useAmc ? 'wallet' : paymentMethod,
        isAmcBooking: useAmc,
        amcId: useAmc ? activeAmc?.id : null,
        serviceOtp,
        otpVerified: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Update AMC usage if applicable
      if (useAmc && activeAmc) {
        const amcRef = doc(db, 'amcs', activeAmc.id);
        batch.update(amcRef, {
          serviceBookingIds: [...activeAmc.serviceBookingIds, bookingRef.id],
          updatedAt: Timestamp.now()
        });
      }

      // Increment promo usage
      if (appliedPromo && !useAmc) {
        batch.update(doc(db, 'promotions', appliedPromo.id), {
          usageCount: (appliedPromo.usageCount || 0) + 1,
          updatedAt: Timestamp.now()
        });
        
        const match = redemptions.find(r => r.promotionId === appliedPromo.id);
        if (match) {
          batch.update(doc(db, 'redemptions', match.id), { status: 'used', updatedAt: Timestamp.now() });
        }
      }

      // OTP Secret
      batch.set(doc(db, `bookings/${bookingRef.id}/secrets`, 'otp'), { code: serviceOtp });
      
      await batch.commit();

      // Notify customer
      await sendNotification(profile?.uid || auth.currentUser?.uid || '', 'Booking Placed!', assignedPartnerId ? `Your request for ${service.name} has been received and partner has been assigned.` : `Your request for ${service.name} has been received. Waiting for partner assignment.`, 'new_booking', bookingRef.id);
      
      if (assignedPartnerId) {
        // Notify assigned partner
        await sendNotification(assignedPartnerId, 'New Job Assigned', `You have been automatically matched for a ${service.name} booking at ${date} ${time}.`, 'new_booking', bookingRef.id);
      } else {
        // Notify admin (sarthakwebtech@gmail.com)
        await sendNotification('sarthakwebtech@gmail.com', 'New Booking Received', `Customer ${profile?.displayName || 'A User'} booked ${service.name}. No partner could be auto-assigned.`, 'new_booking', bookingRef.id);
      }
      
      setShowFinalConfirmation(false);
      setShowSuccessModal(true);
      setStep(4);
    } catch (err: any) {
      console.error("Booking error:", err);
      // Try to parse JSON from handleFirestoreError if possible, or just use message
      let msg = "An error occurred while placing your booking. Please try again.";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) msg = parsed.error;
      } catch {
        if (err.message && !err.message.includes('{')) msg = err.message;
      }
      setError(msg);
      setShowFinalConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (location) {
      setMapCenter(location);
    }
  }, [location]);

  if (profile?.role === 'partner') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onDoubleClick={onClose}
          className="absolute inset-0 bg-blue-700/60 backdrop-blur-sm" 
        />
        <div className="absolute inset-0 hidden md:block" onClick={onClose} />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-10 text-center"
        >
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Info size={40} />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">Partner Restriction</h3>
          <p className="text-slate-500 mb-8 leading-relaxed">
            As a registered <b>Service Partner</b>, you cannot book services for yourself. The home page is available for your reference only to see how your services appear to customers.
          </p>
          <button 
            onClick={onClose}
            className="w-full bg-blue-700 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all"
          >
            I Understand
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onDoubleClick={onClose}
          className="absolute inset-0 bg-blue-700/60 backdrop-blur-sm" 
        />
        <div className="absolute inset-0 hidden md:block" onClick={onClose} />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 100 }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="relative bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95dvh] sm:max-h-[92vh]"
        >
          {error && (
            <div className="absolute top-0 left-0 right-0 bg-rose-500 text-white py-3 px-6 text-[10px] md:text-xs font-bold flex justify-between items-center z-[60]">
              <span className="flex items-center gap-2 italic tracking-tight"><Info size={14} /> {error}</span>
              <button onClick={() => setError(null)}><X size={14} /></button>
            </div>
          )}
          <div className="p-4 sm:p-8 pb-4 flex justify-between items-center border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
            <div className="flex items-center gap-3">
               { (step === 2 || step === 3) && (
                 <button onClick={() => setStep(step - 1)} className="p-2 hover:bg-white rounded-full transition-all text-slate-900 shadow-sm border border-slate-100">
                   <ArrowLeft size={16} />
                 </button>
               )}
               <div>
                 <h3 className="font-bold text-base sm:text-xl text-slate-900 tracking-tight font-display">
                   {step === 4 ? 'Confirmed' : step === 3 ? 'Final Review' : 'Book Service'}
                 </h3>
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Step {step > 3 ? 3 : step} of 3</p>
               </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 sm:p-8 overflow-y-auto flex-1 no-scrollbar relative min-h-0">
            <AnimatePresence mode="wait">
              {showSuccessModal && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 z-[80] bg-white backdrop-blur-xl flex flex-col items-center justify-center p-6 md:p-10 text-center overflow-y-auto no-scrollbar"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-6 shadow-xl shrink-0">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 tracking-tight font-display italic">Booking Finalized!</h3>
                  <p className="text-slate-400 text-xs font-medium mb-8">Your service request has been successfully queued.</p>
                  
                  <div className="w-full bg-slate-50 p-6 md:p-8 rounded-[32px] border border-slate-100 mb-8 text-left space-y-4">
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2 border-b border-slate-100 pb-2">Record Summary</p>
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service</span>
                        <span className="text-xs font-bold text-slate-900 text-right ml-4">{service.name}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Window</span>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-900">{date} at {time}</p>
                          <p className="text-[9px] text-slate-400 font-medium italic">Est. finish by {(() => {
                            const d = new Date(`${date}T${time}`);
                            const durationMinutes = parseInt(service.duration) * (service.duration.includes('hr') ? 60 : 1);
                            d.setMinutes(d.getMinutes() + (isNaN(durationMinutes) ? 60 : durationMinutes));
                            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          })()}</p>
                        </div>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</span>
                        <span className="text-xs font-bold text-slate-900 truncate ml-4 max-w-[150px]">{address}</span>
                     </div>
                     <div className="pt-4 border-t border-slate-200 mt-4 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Final Amount</span>
                        <span className="text-xl font-bold text-slate-900 tracking-tight">₹{calculateFinalPrice()}</span>
                     </div>
                  </div>

                  <div className="flex flex-col gap-3 w-full">
                    {lastBookingId && (
                      <button 
                        onClick={() => {
                          const link = getWhatsAppBookingLink(lastBookingId, service.name, date, time);
                          if (link) window.open(link, '_blank');
                        }}
                        className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 italic flex items-center justify-center gap-2"
                      >
                        <MessageCircle size={16} /> Confirm via WhatsApp
                      </button>
                    )}
                    
                    <button 
                      onClick={() => {
                        setShowSuccessModal(false);
                        onSuccess();
                      }} 
                      className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] bg-blue-700 text-white hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/20 active:scale-95 italic"
                    >
                      Go to Dashboard
                    </button>
                  </div>
                </motion.div>
              )}
              {showFinalConfirmation && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 z-[70] bg-white/98 backdrop-blur-xl flex flex-col items-center justify-center p-6 md:p-10 text-center overflow-y-auto"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-700 text-white rounded-full flex items-center justify-center mb-6 shadow-xl shrink-0">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4 tracking-tight font-display">Confirm Selection</h3>
                  
                  <div className="w-full bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-100 mb-8 text-left space-y-4">
                     <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service</span>
                        <span className="text-xs font-bold text-slate-900 text-right ml-4">{service.name}</span>
                     </div>
                     <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timeline</span>
                        <span className="text-xs font-bold text-slate-900">{date} at {time}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Amount</span>
                        <span className="text-xl font-bold text-slate-900 tracking-tight">₹{calculateFinalPrice()}</span>
                     </div>
                  </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full">
                      <button 
                        disabled={loading}
                        onClick={() => {
                          setShowFinalConfirmation(false);
                          setStep(1);
                        }} 
                        className="flex-1 py-4 md:py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] bg-slate-100 text-slate-400 hover:text-blue-700 transition-all active:scale-95 italic"
                      >
                        Modify Selection
                      </button>
                      <button 
                      disabled={loading}
                      onClick={handleBooking} 
                      className="flex-1 py-4 md:py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] bg-blue-700 text-white hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/20 active:scale-95 italic"
                    >
                      {loading ? 'Confirming...' : 'Continue'}
                    </button>
                  </div>
                  <p className="mt-8 text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-xs mx-auto">By finalizing, you agree to our terms of service and convenience fee policy.</p>
                </motion.div>
              )}
              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 md:space-y-8"
                >
                  <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200">
                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Service Selection</p>
                        <h4 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-display">{service.name}</h4>
                      </div>
                      {service.priceListPDF && (
                        <a 
                          href={service.priceListPDF} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all active:scale-95"
                          title="View detailed pricing list"
                        >
                          <FileText size={16} />
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-4 text-[11px] sm:text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-100"><Clock size={12} className="text-slate-300" /> {service.duration}</span>
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-100 font-bold text-slate-900">₹{service.basePrice}</span>
                    </div>
                  </div>

                  {activeAmc && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-5 rounded-[24px] border-2 transition-all cursor-pointer ${useAmc ? 'bg-blue-700 border-blue-700 text-white shadow-xl' : 'bg-emerald-50 border-emerald-100 text-emerald-900'}`}
                      onClick={() => setUseAmc(!useAmc)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                           <Zap size={16} className={useAmc ? 'text-white' : 'text-emerald-500'} />
                           <span className="text-[10px] font-black uppercase tracking-widest">Active AMC Plan</span>
                        </div>
                        <input type="checkbox" checked={useAmc} readOnly className="rounded-full border-white/20 bg-transparent text-white" />
                      </div>
                      <p className="text-sm font-bold tracking-tight mb-1">{activeAmc.planName}</p>
                      <p className={`text-[10px] font-medium ${useAmc ? 'text-blue-100' : 'text-emerald-600'}`}>
                        {activeAmc.frequency - activeAmc.serviceBookingIds.length} of {activeAmc.frequency} services remaining
                      </p>
                    </motion.div>
                  )}

                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative group">
                        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={16} />
                        <input 
                          type="date" 
                          value={date}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            if (newDate) {
                              const allExpired = timeSlots.every(slot => getSlotStatus(slot.value, newDate) === 'expired');
                              if (allExpired) {
                                setSlotNotAvailablePopup(true);
                                setDate('');
                                setTime('');
                              } else {
                                setDate(newDate);
                              }
                            } else {
                              setDate('');
                            }
                          }}
                          min={new Date().toLocaleDateString('en-CA')}
                          className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all font-bold text-sm text-slate-900 placeholder:text-slate-300"
                        />
                      </div>
                      <div className="relative group">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={16} />
                        <select 
                          value={time}
                          onChange={(e) => {
                            const status = getSlotStatus(e.target.value);
                            if (status === 'available') {
                              setTime(e.target.value);
                            }
                          }}
                          className={`w-full bg-white border border-slate-200 pl-11 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all appearance-none font-bold text-sm text-slate-900 ${!date ? 'opacity-40 grayscale' : ''}`}
                          disabled={!date}
                        >
                          <option value="">Select Slot</option>
                          {timeSlots.map(slot => {
                            const status = getSlotStatus(slot.value);
                            return (
                              <option 
                                key={slot.value} 
                                value={slot.value} 
                                disabled={status === 'expired'}
                                className={status === 'expired' ? 'text-rose-500' : ''}
                              >
                                {slot.label} {status === 'expired' ? '(Unavailable)' : ''}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    </div>

                    {date && (
                      <div className="grid grid-cols-3 gap-2 px-1">
                        {timeSlots.map(slot => {
                          const status = getSlotStatus(slot.value);
                          const isSelected = time === slot.value;
                          return (
                            <button
                              key={slot.value}
                              onClick={() => status === 'available' && setTime(slot.value)}
                              disabled={status === 'expired'}
                              className={`
                                py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border-2
                                ${status === 'expired' ? 'bg-rose-50 border-rose-100 text-rose-300 cursor-not-allowed opacity-50' : 
                                  isSelected ? 'bg-blue-700 border-blue-700 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}
                              `}
                            >
                              {slot.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <button 
                    disabled={!date || !time}
                    onClick={() => setStep(2)}
                    className="w-full bg-blue-700 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200"
                  >
                    Continue
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase ml-1">Search Location</label>
                      <button 
                        onClick={async () => {
                          if (navigator.permissions) {
                            try {
                              const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                              if (permissionStatus.state === 'denied') {
                                alert("Location permission is blocked. Please enable it in your browser/device settings to use this feature.");
                                return;
                              }
                            } catch (e) {
                              // Permissions API not supported or error, continue to fallback
                            }
                          }

                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              async (pos) => {
                                const lat = pos.coords.latitude;
                                const lng = pos.coords.longitude;
                                setLocation({ lat, lng });
                                setMapCenter({ lat, lng });
                                
                                try {
                                  const geocoder = new google.maps.Geocoder();
                                  const response = await geocoder.geocode({ location: { lat, lng } });
                                  if (response.results[0]) {
                                    setAddress(response.results[0].formatted_address);
                                  } else {
                                    setAddress(`[Point: ${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
                                  }
                                } catch (e) {
                                  alert(handleMapsError(e));
                                  setAddress(`[Location detected: ${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
                                }
                              },
                              (err) => {
                                alert(handleMapsError(err));
                              },
                              { timeout: 10000 }
                            );
                          } else {
                             alert("Geolocation is not supported by your browser.");
                          }
                        }}
                        className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full hover:bg-emerald-100 transition-colors flex items-center gap-1"
                      >
                        <MapPin size={12} /> Use Current
                      </button>
                    </div>
                      <div>
                        <AddressAutocomplete 
                          onAddressSelect={(addr, lat, lng) => {
                            setAddress(addr);
                            setLocation({ lat, lng });
                            setMapCenter({ lat, lng });
                          }} 
                        />
                        <div className="mt-2 text-center">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-2">Or type manually below</p>
                          <input 
                            type="text"
                            value={address}
                            onChange={(e) => {
                               setAddress(e.target.value);
                               if (!location) setLocation({ lat: 28.6139, lng: 77.2090 }); // Default to Delhi if typing manually without autocomplete
                            }}
                            placeholder="Enter detailed address..."
                            className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700 transition-all"
                          />
                        </div>
                      </div>

                    {address && location && (
                      <div className="w-full h-40 rounded-2xl overflow-hidden border border-slate-200 mt-2 shadow-inner bg-slate-100">
                        <Map
                          defaultCenter={location}
                          center={mapCenter}
                          defaultZoom={15}
                          mapId="DEMO_MAP_ID"
                          gestureHandling="none"
                          disableDefaultUI={true}
                          className="w-full h-full"
                          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                        >
                          <AdvancedMarker position={location}>
                            <Pin background="#1c1917" glyphColor="#fff" borderColor="#000" />
                          </AdvancedMarker>
                        </Map>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Flat / House / Landmark details</label>
                      <div className="relative">
                        <Info className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text"
                          value={addressDetails}
                          onChange={(e) => setAddressDetails(e.target.value)}
                          placeholder="e.g. Flat 402, Green Apartments..."
                          className="w-full bg-slate-50 pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all font-medium text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                       <div className="flex justify-between items-center mb-2 ml-1">
                         <label className="block text-xs font-bold text-slate-400 uppercase">Offers & Promos</label>
                         <button 
                           onClick={() => setShowPromos(true)}
                           className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                         >
                           View Available
                         </button>
                       </div>
                       <div className="flex gap-2">
                         <input 
                           type="text"
                           value={promoInput}
                           onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                           placeholder="ENTER CODE"
                           className="flex-1 bg-slate-50 px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all font-mono text-sm font-bold uppercase tracking-widest text-slate-900 placeholder:text-slate-300"
                         />
                         <button 
                           onClick={handleApplyPromo}
                           disabled={isVerifyingPromo || !promoInput.trim()}
                           className="bg-blue-700 text-white px-6 py-4 rounded-xl font-bold text-xs hover:bg-blue-800 transition-all disabled:opacity-50"
                         >
                           {isVerifyingPromo ? '...' : 'APPLY'}
                         </button>
                       </div>

                       {/* Available Promos Overlay/Section */}
                       <AnimatePresence>
                         {showPromos && (
                           <motion.div 
                             initial={{ opacity: 0, scale: 0.95 }}
                             animate={{ opacity: 1, scale: 1 }}
                             exit={{ opacity: 0, scale: 0.95 }}
                             className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3"
                           >
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Offers</span>
                                <button onClick={() => setShowPromos(false)} className="text-slate-400 px-2 py-1">
                                  <X size={14} />
                                </button>
                              </div>
                              {availablePromos.length > 0 ? (
                                <div className="space-y-3">
                                  {availablePromos.map(p => (
                                    <div key={p.id} className="bg-white border border-slate-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
                                      <div>
                                        <p className="font-black text-slate-900 text-sm tracking-tight">{p.name}</p>
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase">CODE: {p.code}</p>
                                      </div>
                                      <button 
                                        onClick={() => {
                                          setAppliedPromo(p);
                                          setShowPromos(false);
                                        }}
                                        className="text-[10px] font-black text-slate-900 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                                      >
                                        Apply
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400 italic text-center py-4">No exclusive offers found for you yet.</p>
                              )}
                           </motion.div>
                         )}
                       </AnimatePresence>

                       {promoError && <p className="text-[10px] text-rose-500 font-bold mt-1.5 ml-1">{promoError}</p>}
                       {appliedPromo && (
                         <motion.div 
                           initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                           className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded-xl mt-4"
                         >
                           <div className="flex items-center gap-3">
                             <div className="p-1.5 bg-emerald-500 rounded-lg text-white">
                               <CheckCircle2 size={16} />
                             </div>
                             <div>
                               <span className="text-xs font-black text-emerald-900 uppercase tracking-widest block">
                                 {appliedPromo.code} Applied
                               </span>
                               <span className="text-[10px] font-bold text-emerald-600">
                                 {appliedPromo.discountType === 'percent' ? `${appliedPromo.discountValue}%` : `₹${appliedPromo.discountValue}`} discount saved
                               </span>
                             </div>
                           </div>
                           <button 
                            onClick={() => {
                              setAppliedPromo(null);
                              setPromoInput('');
                            }} 
                            className="bg-white p-2 rounded-lg text-slate-400 hover:text-blue-700 border border-emerald-100 transition-colors"
                           >
                             <X size={14} />
                           </button>
                         </motion.div>
                       )}
                    </div>
                  </div>

                  <div className="bg-blue-700 p-5 sm:p-8 rounded-3xl text-white shadow-2xl shadow-blue-700/30 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />
                    
                    <div className="flex justify-between items-end mb-4 sm:mb-6 relative z-10">
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-2">Total Amount</span>
                        <div className="flex items-baseline gap-2">
                           <span className="text-3xl sm:text-4xl font-bold tracking-tight">₹{calculateFinalPrice()}</span>
                           <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Base Rate</span>
                        </div>
                      </div>
                      {appliedPromo && (
                        <div className="text-right">
                          <span className="text-xs text-white/40 line-through block font-medium">₹{service.basePrice + getSurgeAmount()}</span>
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Saved ₹{(service.basePrice + getSurgeAmount()) - calculateFinalPrice()}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-white/40 text-[9px] font-black uppercase tracking-widest relative z-10">
                      <div className="p-1.5 bg-white/5 rounded-lg border border-white/10">
                        <CreditCard size={12} />
                      </div>
                      Priority checkout with premium support
                    </div>
                  </div>

                  <button 
                    disabled={!address}
                    onClick={() => setStep(3)}
                    className="w-full bg-blue-700 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] italic hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/20 disabled:opacity-50 active:scale-[0.98]"
                  >
                    Continue
                  </button>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200">
                    {error && (
                      <div className="mb-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-2 text-rose-600 text-xs font-bold">
                        <AlertCircle size={14} /> {error}
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Service</p>
                        <p className="font-bold text-slate-900">{service.name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Date</p>
                          <p className="font-bold text-slate-900">{date}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Time</p>
                          <p className="font-bold text-slate-900">{time}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-[28px] border border-slate-100 p-5 group transition-all hover:shadow-md">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Service Destination</p>
                          <button 
                            onClick={() => {
                              const newAddress = prompt("Enter complete address manually:", address);
                              if (newAddress !== null && newAddress.trim() !== "") {
                                setAddress(newAddress);
                              }
                            }}
                            className="text-[10px] font-black uppercase text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-full transition-all border border-blue-100"
                          >
                            Edit Manually
                          </button>
                        </div>
                        <p className="text-sm text-slate-700 font-bold leading-relaxed">
                          {addressDetails && <span className="block text-slate-900 mb-1">{addressDetails}</span>}
                          {address}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-200">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-3">Preferred Settlement Mode</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button 
                            onClick={() => setPaymentMethod('cash')}
                            className={`flex flex-col items-center justify-center gap-1 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'cash' ? 'border-blue-700 bg-blue-700 text-white shadow-lg' : 'border-slate-100 bg-slate-50/50 text-slate-400 hover:border-slate-200'}`}
                          >
                             <CheckCircle2 size={16} className={paymentMethod === 'cash' ? 'opacity-100' : 'opacity-0'} />
                             <span className="text-xs font-bold uppercase tracking-widest">Pay on Arrival</span>
                          </button>
                          <button 
                            onClick={() => setPaymentMethod('online')}
                            className={`flex flex-col items-center justify-center gap-1 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'online' ? 'border-blue-700 bg-blue-700 text-white shadow-lg' : 'border-slate-100 bg-slate-50/50 text-slate-400 hover:border-slate-200'}`}
                          >
                            <CheckCircle2 size={16} className={paymentMethod === 'online' ? 'opacity-100' : 'opacity-0'} />
                            <span className="text-xs font-bold uppercase tracking-widest">Pay Online</span>
                          </button>
                        </div>
                        {profile?.walletBalance !== undefined && profile.walletBalance > 0 && (
                          <div className="mt-3">
                            <button 
                              onClick={() => setPaymentMethod('wallet' as any)}
                              className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${paymentMethod === ('wallet' as any) ? 'border-blue-700 bg-blue-700 text-white shadow-lg' : 'border-slate-100 bg-emerald-50/50 text-slate-600 hover:border-slate-200'}`}
                            >
                              <div className="flex items-center gap-2">
                                <CheckCircle2 size={16} className={paymentMethod === ('wallet' as any) ? 'opacity-100' : 'opacity-0'} />
                                <span className="text-xs font-bold uppercase tracking-widest">Use Wallet Balance</span>
                              </div>
                              <span className="text-xs font-bold tracking-tight">Available: ₹{profile.walletBalance}</span>
                            </button>
                          </div>
                        )}
                        <p className="text-[9px] text-slate-400 mt-2 italic font-medium">Selected mode can be changed before final settlement.</p>
                      </div>

                      <div className="pt-4 border-t border-slate-200">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-bold text-slate-500">Service Base Price</p>
                          <p className="text-sm font-bold text-slate-900">₹{service.basePrice}</p>
                        </div>
                        {isSurgePricingActive() && (
                          <div className="flex justify-between items-center mb-2 bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                            <div className="flex items-center gap-2">
                              <Zap size={14} className="text-rose-600 fill-rose-600" />
                              <p className="text-sm font-black text-rose-600 uppercase tracking-tight">Prime Time Surge</p>
                            </div>
                            <p className="text-sm font-black text-rose-600">
                              +₹{getSurgeAmount()}
                            </p>
                          </div>
                        )}
                        {appliedPromo && (
                          <div className="flex justify-between items-center mb-2 bg-emerald-50/50 p-3 rounded-xl">
                            <div className="flex items-center gap-2">
                              <Zap size={14} className="text-emerald-600 fill-emerald-600" />
                              <p className="text-sm font-black text-emerald-600 uppercase tracking-tight">Promo Discount ({appliedPromo.code})</p>
                            </div>
                            <p className="text-sm font-black text-emerald-600">
                              -₹{appliedPromo.discountType === 'percent' 
                                ? Math.round((service.basePrice * appliedPromo.discountValue) / 100) 
                                : appliedPromo.discountValue}
                            </p>
                          </div>
                        )}
                        {profile?.isPremium && (
                          <div className="flex justify-between items-center mb-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                            <div className="flex items-center gap-2">
                              <Zap size={14} className="text-indigo-600 fill-indigo-600" />
                              <p className="text-sm font-black text-indigo-600 uppercase tracking-tight">Prime Member (15% Off)</p>
                            </div>
                            <p className="text-sm font-black text-indigo-600">
                              -₹{getPrimeDiscountAmount()}
                            </p>
                          </div>
                        )}
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-bold text-slate-500">Convenience & Service Tax</p>
                          <p className="text-sm font-bold text-slate-900 italic">Excluded / On Arrival</p>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-blue-700 border-dashed">
                          <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Final Payable</p>
                            <p className="text-2xl font-black text-slate-900 tracking-tighter">₹{calculateFinalPrice()}</p>
                          </div>
                          <div className="text-slate-300">
                             <CheckCircle2 size={32} />
                          </div>
                        </div>
                        <div className="mt-4 p-4 bg-rose-50/50 rounded-xl border border-rose-100 flex items-start gap-3">
                           <Info size={16} className="text-rose-500 shrink-0 mt-0.5" />
                           <p className="text-xs text-rose-900 font-medium leading-relaxed">
                             <strong className="font-bold text-rose-700">Note:</strong> If you deny our partner for service for any reason upon arrival, you will have to pay the convenience charges.
                           </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button 
                    disabled={loading}
                    onClick={() => setShowFinalConfirmation(true)}
                    className="w-full bg-blue-700 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all flex justify-center items-center gap-2 shadow-lg shadow-blue-700/20"
                  >
                    {loading ? 'Processing...' : 'Confirm Service'}
                  </button>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={40} />
                  </div>
                  <h4 className="text-2xl font-bold text-slate-900 mb-2">Success!</h4>
                  <p className="text-slate-500 mb-6 leading-relaxed">
                    Your booking for <b>{service.name}</b> has been received.<br /> A partner will be assigned shortly for you.
                  </p>
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mb-10 bg-rose-50 p-4 rounded-2xl border border-rose-100">
                    Note: If you deny our partner for service for any reason upon arrival, you will have to pay the convenience charges.
                  </p>
                  <button 
                    onClick={() => { onSuccess(); onClose(); }}
                    className="bg-blue-700 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-800 shadow-lg shadow-slate-200"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        
        <AnimatePresence>
          {slotNotAvailablePopup && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSlotNotAvailablePopup(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6 border border-rose-100">
                   <Clock size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight font-display">Slots Unavailable</h3>
                <p className="text-slate-500 mb-8 leading-relaxed">
                  All time slots for the selected date are fully booked or have expired. Please choose the next available date.
                </p>
                <button
                  onClick={() => setSlotNotAvailablePopup(false)}
                  className="w-full bg-slate-100 text-slate-900 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Choose Another Date
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }
