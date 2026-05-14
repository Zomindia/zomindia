import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, Timestamp, query, where, getDocs, limit, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Service, UserProfile, Promotion, Redemption } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { sendNotification } from '../lib/notifications';
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
  Zap
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
        { placeId: prediction.place_id, fields: ['formatted_address', 'geometry'] },
        (place) => {
          if (place?.formatted_address && place.geometry?.location) {
            onAddressSelect(
              place.formatted_address,
              place.geometry.location.lat(),
              place.geometry.location.lng()
            );
          }
        }
      );
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
        <input 
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Search for your area, colony, or landmark..."
          className="w-full bg-stone-50 pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-500 transition-all font-medium text-stone-900"
        />
      </div>
      
      {predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden max-h-60 overflow-y-auto">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              onClick={() => handleSelectPrediction(p)}
              className="w-full px-5 py-4 text-left hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-none group"
            >
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-stone-300 mt-0.5 group-hover:text-stone-900 transition-colors" />
                <div>
                  <p className="text-sm font-bold text-stone-900">{p.structured_formatting.main_text}</p>
                  <p className="text-xs text-stone-400">{p.structured_formatting.secondary_text}</p>
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
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [availablePromos, setAvailablePromos] = useState<Promotion[]>([]);
  const [showPromos, setShowPromos] = useState(false);

  // Fetch available promos
  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const q = query(collection(db, 'promotions'), where('active', '==', true), limit(5));
        const snap = await getDocs(q);
        setAvailablePromos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion)));
      } catch (err) {
        console.error("Error fetching available promos:", err);
      }
    };
    fetchPromos();
  }, []);

  const timeSlots = [
    { label: '09:00 AM', value: '09:00' },
    { label: '11:00 AM', value: '11:00' },
    { label: '01:00 PM', value: '13:00' },
    { label: '03:00 PM', value: '15:00' },
    { label: '05:00 PM', value: '17:00' },
    { label: '07:00 PM', value: '19:00' },
  ];

  const getSlotStatus = (slotValue: string) => {
    if (!date) return 'available';
    
    const now = new Date();
    // Use local YYYY-MM-DD for comparison
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    if (date > todayStr) return 'available';
    if (date < todayStr) return 'expired';
    
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

  const calculateFinalPrice = () => {
    let price = service.basePrice;
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

  const handleBooking = async () => {
    if (!profile) return;
    setLoading(true);
    const bookingPath = 'bookings';
    try {
      const scheduledAt = new Date(`${date}T${time}`);
      const fullAddress = `${addressDetails ? addressDetails + ', ' : ''}${address}`;
      const finalPrice = calculateFinalPrice();
      
      const docRef = await addDoc(collection(db, bookingPath), {
        customerId: profile.uid,
        serviceId: service.id,
        status: 'pending',
        paymentStatus: 'unpaid',
        scheduledAt: Timestamp.fromDate(scheduledAt),
        address: fullAddress,
        lat: location?.lat || null,
        lng: location?.lng || null,
        totalPrice: finalPrice,
        promoCode: appliedPromo?.code || null,
        discountApplied: appliedPromo ? (service.basePrice - finalPrice) : 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Generate security OTP (4 digits)
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      await setDoc(doc(db, `bookings/${docRef.id}/secrets/otp`), {
        code: otp,
        createdAt: Timestamp.now()
      });
      
      // Notify customer
      await sendNotification(profile.uid, 'Booking Placed!', `Your request for ${service.name} has been received. Waiting for admin approval.`, 'new_booking', docRef.id);
      // Notify admin (sarthakwebtech@gmail.com)
      await sendNotification('sarthakwebtech@gmail.com', 'New Booking Received', `Customer ${profile.displayName} booked ${service.name}.`, 'new_booking', docRef.id);
      
      // Update redemption if applied
      if (appliedPromo) {
        const match = redemptions.find(r => r.promotionId === appliedPromo.id);
        if (match) {
          await updateDoc(doc(db, 'redemptions', match.id), { status: 'used', updatedAt: Timestamp.now() });
        }
      }

      setStep(4);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, bookingPath);
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
          onClick={onClose}
          className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" 
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-10 text-center"
        >
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Info size={40} />
          </div>
          <h3 className="text-2xl font-bold text-stone-900 mb-4">Partner Restriction</h3>
          <p className="text-stone-500 mb-8 leading-relaxed">
            As a registered <b>Service Partner</b>, you cannot book services for yourself. The home page is available for your reference only to see how your services appear to customers.
          </p>
          <button 
            onClick={onClose}
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all"
          >
            I Understand
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" 
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
        >
          <div className="p-8 pb-4 flex justify-between items-center border-b border-stone-100">
            <div className="flex items-center gap-3">
               { (step === 2 || step === 3) && (
                 <button onClick={() => setStep(step - 1)} className="p-2 hover:bg-stone-50 rounded-full transition-colors text-stone-900">
                   <ArrowLeft size={18} />
                 </button>
               )}
               <h3 className="font-bold text-xl text-stone-900">
                 {step === 4 ? 'Booking Confirmed' : step === 3 ? 'Review & Finalize' : 'Book Service'}
               </h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-stone-50 p-6 rounded-3xl border border-stone-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs text-stone-400 uppercase font-bold tracking-widest mb-1">Selected Service</p>
                        <h4 className="text-xl font-bold text-stone-900">{service.name}</h4>
                      </div>
                      {service.priceListPDF && (
                        <a 
                          href={service.priceListPDF} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-3 bg-white text-stone-900 rounded-xl border border-stone-200 shadow-sm hover:bg-stone-50 transition-colors"
                          title="View detailed pricing list"
                        >
                          <FileText size={18} />
                        </a>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm text-stone-500">
                      <span className="flex items-center gap-1"><Clock size={14} className="text-stone-400" /> {service.duration}</span>
                      <span className="flex items-center gap-1 font-bold text-stone-900">₹{service.basePrice}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                          type="date" 
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          min={new Date().toLocaleDateString('en-CA')}
                          className="w-full bg-stone-50 pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-500 transition-all font-bold text-stone-900"
                        />
                      </div>
                      <div className="relative group">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <select 
                          value={time}
                          onChange={(e) => {
                            const status = getSlotStatus(e.target.value);
                            if (status === 'available') {
                              setTime(e.target.value);
                            }
                          }}
                          className={`w-full bg-stone-50 pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-500 transition-all appearance-none font-bold text-stone-900 ${!date ? 'opacity-50 grayscale' : ''}`}
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
                                py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2
                                ${status === 'expired' ? 'bg-rose-50 border-rose-100 text-rose-300 cursor-not-allowed opacity-50' : 
                                  isSelected ? 'bg-stone-900 border-stone-900 text-white shadow-lg' : 'bg-white border-stone-100 text-stone-500 hover:border-stone-200'}
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
                    className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-stone-200"
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
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2 ml-1">Search Location</label>
                      <AddressAutocomplete 
                        onAddressSelect={(addr, lat, lng) => {
                          setAddress(addr);
                          setLocation({ lat, lng });
                        }} 
                      />
                    </div>

                    {address && location && (
                      <div className="w-full h-40 rounded-2xl overflow-hidden border border-stone-200 mt-2 shadow-inner bg-stone-100">
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
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2 ml-1">Flat / House / Landmark details</label>
                      <div className="relative">
                        <Info className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                          type="text"
                          value={addressDetails}
                          onChange={(e) => setAddressDetails(e.target.value)}
                          placeholder="e.g. Flat 402, Green Apartments..."
                          className="w-full bg-stone-50 pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-500 transition-all font-medium text-stone-900"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                       <div className="flex justify-between items-center mb-2 ml-1">
                         <label className="block text-xs font-bold text-stone-400 uppercase">Offers & Promos</label>
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
                           className="flex-1 bg-stone-50 px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500 transition-all font-mono text-sm font-bold uppercase tracking-widest text-stone-900 placeholder:text-stone-300"
                         />
                         <button 
                           onClick={handleApplyPromo}
                           disabled={isVerifyingPromo || !promoInput.trim()}
                           className="bg-stone-900 text-white px-6 py-4 rounded-xl font-bold text-xs hover:bg-black transition-all disabled:opacity-50"
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
                             className="mt-4 p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3"
                           >
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Available Offers</span>
                                <button onClick={() => setShowPromos(false)} className="text-stone-400 px-2 py-1">
                                  <X size={14} />
                                </button>
                              </div>
                              {availablePromos.length > 0 ? (
                                <div className="space-y-3">
                                  {availablePromos.map(p => (
                                    <div key={p.id} className="bg-white border border-stone-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
                                      <div>
                                        <p className="font-black text-stone-900 text-sm tracking-tight">{p.name}</p>
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase">CODE: {p.code}</p>
                                      </div>
                                      <button 
                                        onClick={() => {
                                          setAppliedPromo(p);
                                          setShowPromos(false);
                                        }}
                                        className="text-[10px] font-black text-stone-900 px-4 py-2 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors"
                                      >
                                        Apply
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-stone-400 italic text-center py-4">No exclusive offers found for you yet.</p>
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
                            className="bg-white p-2 rounded-lg text-stone-400 hover:text-stone-900 border border-emerald-100 transition-colors"
                           >
                             <X size={14} />
                           </button>
                         </motion.div>
                       )}
                    </div>
                  </div>

                  <div className="bg-stone-900 p-6 rounded-3xl text-white shadow-xl shadow-stone-900/10">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-white/60 font-medium">Final Price</span>
                      <div className="text-right">
                        {appliedPromo && (
                          <span className="text-xs text-white/40 line-through block font-medium">₹{service.basePrice}</span>
                        )}
                        <span className="text-2xl font-bold">₹{calculateFinalPrice()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase tracking-wider font-bold">
                      <CreditCard size={12} /> Secure online or cash payments available
                    </div>
                  </div>

                  <button 
                    disabled={!address}
                    onClick={() => setStep(3)}
                    className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-lg shadow-stone-900/20 disabled:opacity-50"
                  >
                    Review Details
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
                  <div className="bg-stone-50 rounded-3xl p-6 border border-stone-200">
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest mb-1">Service</p>
                        <p className="font-bold text-stone-900">{service.name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest mb-1">Date</p>
                          <p className="font-bold text-stone-900">{date}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest mb-1">Time</p>
                          <p className="font-bold text-stone-900">{time}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest mb-1">Full Address</p>
                        <p className="text-sm text-stone-600 font-medium leading-relaxed">
                          {addressDetails && <span className="block font-bold text-stone-900 mb-0.5">{addressDetails}</span>}
                          {address}
                        </p>
                      </div>
                      <div className="pt-4 border-t border-stone-200">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-bold text-stone-500">Service Base Price</p>
                          <p className="text-sm font-bold text-stone-900">₹{service.basePrice}</p>
                        </div>
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
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-bold text-stone-500">Convenience & Service Tax</p>
                          <p className="text-sm font-bold text-stone-900 italic">Excluded / On Arrival</p>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-stone-900 border-dashed">
                          <div>
                            <p className="text-xs font-black text-stone-400 uppercase tracking-widest leading-none mb-1">Final Payable</p>
                            <p className="text-2xl font-black text-stone-900 tracking-tighter">₹{calculateFinalPrice()}</p>
                          </div>
                          <div className="text-stone-300">
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
                    onClick={handleBooking}
                    className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all flex justify-center items-center gap-2 shadow-lg shadow-stone-900/20"
                  >
                    {loading ? 'Processing...' : 'Finalize & Pay'}
                  </button>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={40} />
                  </div>
                  <h4 className="text-2xl font-bold text-stone-900 mb-2">Success!</h4>
                  <p className="text-stone-500 mb-6 leading-relaxed">
                    Your booking for <b>{service.name}</b> has been received.<br /> A partner will be assigned shortly for you.
                  </p>
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mb-10 bg-rose-50 p-4 rounded-2xl border border-rose-100">
                    Note: If you deny our partner for service for any reason upon arrival, you will have to pay the convenience charges.
                  </p>
                  <button 
                    onClick={() => { onSuccess(); onClose(); }}
                    className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black shadow-lg shadow-stone-200"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }
