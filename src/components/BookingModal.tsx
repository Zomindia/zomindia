import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, Timestamp, query, where, getDocs, limit, doc, getDoc, updateDoc, setDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Service, UserProfile, Promotion, Redemption, PartnerProfile, BookingStatus, AMC } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { sendNotification } from '../lib/notifications';
import { getWhatsAppBookingLink } from '../lib/whatsapp';
import { handleMapsError } from '../lib/maps-errors';
import AuthModal from './AuthModal';
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
  MessageCircle,
  Tag,
  Building,
  Home
} from 'lucide-react';
import PartnerIdentityMarker from './PartnerIdentityMarker';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY as string) || '';

interface Props {
  service: Service;
  profile: UserProfile | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface AddressPrediction {
  id: string;
  mainText: string;
  secondaryText: string;
  description: string;
  isOsm?: boolean;
  latLng?: { lat: number; lng: number };
}

function AddressAutocomplete({ 
  value, 
  onChange, 
  onAddressSelect,
  onEditClick
}: { 
  value: string; 
  onChange: (val: string) => void; 
  onAddressSelect: (address: string, lat: number, lng: number) => void;
  onEditClick?: () => void;
}) {
  const placesLib = useMapsLibrary('places');
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (placesLib) {
      try {
        autocompleteService.current = new placesLib.AutocompleteService();
        const div = document.createElement('div');
        placesService.current = new placesLib.PlacesService(div);
      } catch (e) {
        console.warn("Failed to initialize Google Places services, using robust OSM fallback:", e);
      }
    }
  }, [placesLib]);

  const fetchOsmPredictions = async (queryStr: string) => {
    try {
      setIsLoading(true);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&countrycodes=in&limit=5`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'zomindia-app-preview'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: AddressPrediction[] = data.map((item: any, idx: number) => {
            const displayName = item.display_name || '';
            const parts = displayName.split(',').map((p: string) => p.trim());
            const mainText = parts[0] || '';
            const secondaryText = parts.slice(1).join(', ') || '';
            return {
              id: `osm-${item.place_id || idx}`,
              mainText,
              secondaryText,
              description: displayName,
              isOsm: true,
              latLng: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) }
            };
          });
          setPredictions(mapped);
        }
      }
    } catch (e) {
      console.warn("OSM prediction fallback search failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);

    if (val.length < 3) {
      setPredictions([]);
      return;
    }

    if (autocompleteService.current) {
      setIsLoading(true);
      autocompleteService.current.getPlacePredictions(
        { input: val, componentRestrictions: { country: 'in' } },
        (results, status) => {
          if (status === 'OK' && results && results.length > 0) {
            const mapped: AddressPrediction[] = results.map(r => ({
              id: r.place_id,
              mainText: r.structured_formatting?.main_text || r.description,
              secondaryText: r.structured_formatting?.secondary_text || '',
              description: r.description,
              isOsm: false
            }));
            setPredictions(mapped);
            setIsLoading(false);
          } else {
            // Google Autocomplete failed, fallback to OSM
            fetchOsmPredictions(val);
          }
        }
      );
    } else {
      // Direct OSM Fallback
      fetchOsmPredictions(val);
    }
  };

  const fallbackGeocodeText = async (text: string) => {
    try {
      setIsLoading(true);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'zomindia-app-preview'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          onAddressSelect(text, lat, lng);
          return;
        }
      }
    } catch (e) {
      console.warn("OSM fallback geocoding failed:", e);
    } finally {
      setIsLoading(false);
    }
    // Final absolute default coordinates
    onAddressSelect(text, 28.6139, 77.2090);
  };

  const handleSelectPrediction = (prediction: AddressPrediction) => {
    setInputValue(prediction.description);
    onChange(prediction.description);
    setPredictions([]);

    if (prediction.isOsm && prediction.latLng) {
      onAddressSelect(prediction.description, prediction.latLng.lat, prediction.latLng.lng);
    } else if (placesService.current) {
      setIsLoading(true);
      placesService.current.getDetails(
        { placeId: prediction.id, fields: ['formatted_address', 'geometry', 'name'] },
        (place, status) => {
          setIsLoading(false);
          if (status === 'OK' && place?.formatted_address && place.geometry?.location) {
            onAddressSelect(
              place.formatted_address,
              place.geometry.location.lat(),
              place.geometry.location.lng()
            );
          } else {
            console.warn("Google Place details failed, using OSM fallback geocoding:", status);
            fallbackGeocodeText(prediction.description);
          }
        }
      );
    } else {
      fallbackGeocodeText(prediction.description);
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
          className={`w-full bg-white border border-slate-200 pl-11 ${value ? 'pr-20' : 'pr-4'} py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all text-sm font-medium text-slate-900 placeholder:text-slate-300`}
        />
        {isLoading && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
          </div>
        )}
        {value && onEditClick && (
          <button
            type="button"
            onClick={onEditClick}
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-black uppercase rounded-lg border border-blue-200 transition-all shadow-sm cursor-pointer select-none"
            title="Edit address manually to fix typos"
          >
            ✏️ Edit
          </button>
        )}
      </div>
      
      {predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto">
          {predictions.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectPrediction(p)}
              className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-slate-300 mt-0.5 group-hover:text-blue-700 transition-colors shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{p.mainText}</p>
                  {p.secondaryText && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{p.secondaryText}</p>
                  )}
                  {p.isOsm && (
                    <p className="text-[9px] text-emerald-600 font-extrabold uppercase tracking-wider mt-1">🌍 Universal Pin</p>
                  )}
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
  // Load saved progress if it exists and matches the current service
  const savedState = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('zomindia_pending_booking');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.serviceId === service.id) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to retrieve pending booking progress:", e);
    }
    return null;
  }, [service.id]);

  const [step, setStep] = useState(savedState?.step || 1);
  const geocodingLib = useMapsLibrary('geocoding');
  const [isIncompleteAddress, setIsIncompleteAddress] = useState(false);
  const [address, setAddress] = useState(savedState?.address || profile?.address || '');
  const [isManualEdit, setIsManualEdit] = useState(savedState?.isManualEdit || false);
  const [isEditingAddressOnConfirm, setIsEditingAddressOnConfirm] = useState(savedState?.isEditingAddressOnConfirm || false);
  const [addressDetails, setAddressDetails] = useState(savedState?.addressDetails || '');

  // Structured manual address states for error-resistant manual typing
  const [manualHouse, setManualHouse] = useState('');
  const [manualStreet, setManualStreet] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualLandmark, setManualLandmark] = useState('');

  // Synchronize parsed components whenever address/addressDetails changes from auto-selected or parent props
  useEffect(() => {
    if (address) {
      const parts = address.split(',').map(p => p.trim());
      if (parts.length > 1) {
        setManualCity(prev => prev || parts[parts.length - 1]);
        setManualStreet(prev => prev || parts.slice(0, parts.length - 1).join(', '));
      } else {
        setManualStreet(prev => prev || address);
      }
    }
  }, [address]);

  useEffect(() => {
    if (addressDetails) {
      if (addressDetails.includes('(Landmark:')) {
        const parts = addressDetails.split('(Landmark:');
        setManualHouse(prev => prev || parts[0].trim());
        setManualLandmark(prev => prev || parts[1].replace(')', '').trim());
      } else {
        setManualHouse(prev => prev || addressDetails);
      }
    }
  }, [addressDetails]);

  // Re-compose standard address & addressDetails state strings from structured components in real-time
  const updateAddressFromManual = (house: string, street: string, city: string, landmark: string) => {
    const combinedAddr = [street, city].filter(p => p && p.trim()).join(', ');
    setAddress(combinedAddr);
    
    const combinedDetails = house.trim() && landmark.trim()
      ? `${house.trim()} (Landmark: ${landmark.trim()})`
      : (house.trim() || landmark.trim() || '');
    setAddressDetails(combinedDetails);
  };
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(savedState?.location || null);
  const [date, setDate] = useState(savedState?.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(savedState?.time || '');
  const [loading, setLoading] = useState(false);
  const [isFetchingGps, setIsFetchingGps] = useState(false);
  const [mapZoom, setMapZoom] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>(savedState?.paymentMethod || 'cash');
  const [availablePromos, setAvailablePromos] = useState<Promotion[]>([]);
  const [showPromos, setShowPromos] = useState(false);
  const [slotNotAvailablePopup, setSlotNotAvailablePopup] = useState(false);
  
  // AMC State
  const [activeAmc, setActiveAmc] = useState<AMC | null>(savedState?.activeAmc || null);
  const [useAmc, setUseAmc] = useState(savedState?.useAmc ?? false);

  // Auto-save progress effect
  useEffect(() => {
    if (service?.id) {
      try {
        localStorage.setItem('zomindia_pending_booking', JSON.stringify({
          serviceId: service.id,
          step,
          address,
          isManualEdit,
          isEditingAddressOnConfirm,
          addressDetails,
          location,
          date,
          time,
          paymentMethod,
          useAmc,
          activeAmc,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.warn("Failed to auto-save pending booking state:", err);
      }
    }
  }, [service.id, step, address, isManualEdit, isEditingAddressOnConfirm, addressDetails, location, date, time, paymentMethod, useAmc, activeAmc]);

  const [busySlots, setBusySlots] = useState<{ [date: string]: string[] }>({});

  const [simulatedPros, setSimulatedPros] = useState<{ id: string; name: string; lat: number; lng: number; status: 'Available' | 'On Job' | 'In Transit'; serviceType: string; rating: number }[]>([]);

  const [realEligiblePartners, setRealEligiblePartners] = useState<PartnerProfile[]>([]);
  const [realPartnersNames, setRealPartnersNames] = useState<Record<string, string>>({});

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in km
  };

  const getScoredNearbyPartners = () => {
    if (!location) return [];
    
    const combined: {
      id: string;
      name: string;
      lat: number;
      lng: number;
      status: 'Available' | 'On Job' | 'In Transit';
      rating: number;
      reviewCount: number;
      isReal: boolean;
      distance: number;
      score: number;
    }[] = [];

    // Add simulated pros
    simulatedPros.forEach((p) => {
      const dist = haversineDistance(location.lat, location.lng, p.lat, p.lng);
      let score = 0;

      if (p.status === 'Available') {
        score += 150;
      } else if (p.status === 'In Transit') {
        score += 60;
      } else {
        score += 10;
      }

      if (dist <= 2) {
        score += 200;
      } else if (dist <= 5) {
        score += 130;
      } else if (dist <= 10) {
        score += 80;
      } else if (dist <= 20) {
        score += 30;
      } else {
        score -= 30;
      }

      score += (p.rating - 4.0) * 100;

      combined.push({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        status: p.status,
        rating: p.rating,
        reviewCount: 15 + Math.floor(Math.random() * 40),
        isReal: false,
        distance: dist,
        score: score
      });
    });

    // Add real database partners
    realEligiblePartners.forEach((p) => {
      const name = realPartnersNames[p.userId] || p.bio || "Verified Service Professional";
      if (p.lat && p.lng) {
        const dist = haversineDistance(location.lat, location.lng, p.lat, p.lng);
        let score = 0;

        if (p.availabilityStatus === 'Available') {
          score += 150;
        } else if (p.availabilityStatus === 'Busy') {
          score += 40;
        }

        if (dist <= 2) {
          score += 200;
        } else if (dist <= 5) {
          score += 130;
        } else if (dist <= 10) {
          score += 80;
        } else if (dist <= 20) {
          score += 30;
        } else {
          score -= 30;
        }

        const rating = p.rating || 0;
        score += (rating - 4.0) * 100;

        if (!combined.some(c => c.id === p.id)) {
          combined.push({
            id: p.userId || p.id,
            name,
            lat: p.lat,
            lng: p.lng,
            status: p.availabilityStatus === 'Available' ? 'Available' : (p.availabilityStatus === 'Busy' ? 'On Job' : 'Available'),
            rating: p.rating || 4.7,
            reviewCount: p.reviewCount || 12,
            isReal: true,
            distance: dist,
            score: score
          });
        }
      }
    });

    return combined.sort((a, b) => b.score - a.score);
  };

  useEffect(() => {
    if (location) {
      // Generate 10 mock pros: 5 Available, 3 On Job, 2 In Transit to show partner visibility perfectly
      const firstNames = ["Arjun", "Rahul", "Vijay", "Deepak", "Karan", "Amit", "Rajesh", "Manoj", "Vikram", "Sanjay", "Rohan", "Kunal", "Anil"];
      const lastNames = ["Verma", "Sharma", "Kumar", "Gupta", "Singh", "Mishra", "Patel", "Yadav", "Rathore", "Rao", "Malhotra", "Sen", "Joshi"];
      
      const newPros: typeof simulatedPros = [];
      
      // Total 10 pros: i in [0..4] => Available, i in [5..7] => On Job, i in [8..9] => In Transit
      for (let i = 0; i < 10; i++) {
        const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
        const distanceMeters = 300 + Math.random() * 1200; // Scattered within 300m - 1500m
        const angle = Math.random() * 2 * Math.PI;
        const earthRadius = 6371000;
        
        const dLat = (distanceMeters * Math.cos(angle)) / earthRadius * (180 / Math.PI);
        const dLng = (distanceMeters * Math.sin(angle)) / (earthRadius * Math.cos((location.lat * Math.PI) / 180)) * (180 / Math.PI);
        
        const status = i < 5 ? 'Available' : i < 8 ? 'On Job' : 'In Transit';
        
        newPros.push({
          id: `booking_sim_pro_${i}`,
          name,
          serviceType: service?.name || "Specialist",
          lat: location.lat + dLat,
          lng: location.lng + dLng,
          status,
          rating: +(4.5 + Math.random() * 0.5).toFixed(1)
        });
      }
      setSimulatedPros(newPros);
    }
  }, [location, service?.name]);

  // Periodic drift simulation to make the moving partners actively travel towards the target location
  useEffect(() => {
    if (simulatedPros.length === 0 || !location) return;

    const interval = setInterval(() => {
      setSimulatedPros(prev => prev.map(pro => {
        if (pro.status === 'In Transit') {
          let nextLat = pro.lat;
          let nextLng = pro.lng;
          
          const dy = location.lat - pro.lat;
          const dx = (location.lng - pro.lng) * Math.cos((location.lat * Math.PI) / 180);
          const angle = Math.atan2(dy, dx);
          
          // Organic drift speed
          const speed = 0.000025;
          nextLat += Math.sin(angle) * speed;
          nextLng += Math.cos(angle) * speed / Math.cos((location.lat * Math.PI) / 180);
          
          return {
            ...pro,
            lat: nextLat,
            lng: nextLng
          };
        }
        return pro;
      }));
    }, 2500);

    return () => clearInterval(interval);
  }, [simulatedPros.length, location]);

  const [contactEmail, setContactEmail] = useState(profile?.email || '');
  const [contactPhone, setContactPhone] = useState(profile?.phoneNumber || '');

  useEffect(() => {
    if (profile) {
      if (!contactEmail && profile.email) setContactEmail(profile.email);
      if (!contactPhone && profile.phoneNumber) setContactPhone(profile.phoneNumber);
    }
  }, [profile]);

  // Fetch busy/unavailable slots in real-time
  useEffect(() => {
    if (!auth.currentUser) return;

    const today = new Date();
    const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
    const minTimestamp = Timestamp.fromDate(minDate);
    const maxTimestamp = Timestamp.fromDate(maxDate);

    // Use a query that matches our deployed security rules and limits to +/- 30 days to improve performance and prevent overload
    const q = query(
      collection(db, 'bookings'),
      where('status', 'not-in', ['cancelled', 'rejected']),
      where('scheduledAt', '>=', minTimestamp),
      where('scheduledAt', '<=', maxTimestamp)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const busyMap: { [date: string]: string[] } = {};
        
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data.scheduledAt) return;
          
          let bookingDateObj: Date;
          if (data.scheduledAt instanceof Timestamp) {
            bookingDateObj = data.scheduledAt.toDate();
          } else if (data.scheduledAt.toDate && typeof data.scheduledAt.toDate === 'function') {
            bookingDateObj = data.scheduledAt.toDate();
          } else if (data.scheduledAt.seconds) {
            bookingDateObj = new Date(data.scheduledAt.seconds * 1000);
          } else {
            bookingDateObj = new Date(data.scheduledAt);
          }
          
          // Form local YYYY-MM-DD
          const year = bookingDateObj.getFullYear();
          const month = String(bookingDateObj.getMonth() + 1).padStart(2, '0');
          const day = String(bookingDateObj.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          // Form local HH:MM (e.g., "09:00", "13:00")
          const hours = String(bookingDateObj.getHours()).padStart(2, '0');
          const minutes = String(bookingDateObj.getMinutes()).padStart(2, '0');
          const timeStr = `${hours}:${minutes}`;
          
          if (!busyMap[dateStr]) {
            busyMap[dateStr] = [];
          }
          if (!busyMap[dateStr].includes(timeStr)) {
            busyMap[dateStr].push(timeStr);
          }
        });
        
        setBusySlots(busyMap);
      },
      (err) => {
        try {
          // Gracefully report and fallback if required
          handleFirestoreError(err, OperationType.LIST, 'bookings');
        } catch (logErr) {
          console.error("Availability listener query fallback warning:", logErr);
        }
      }
    );

    return () => unsubscribe();
  }, [profile]);

  // Fetch available promos & AMCs
  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      try {
        // Fetch Promos
        const qPromos = query(collection(db, 'promotions'), where('active', '==', true), limit(5));
        const promoSnap = await getDocs(qPromos);
        const fetchedPromos = promoSnap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion));
        const customerPromos = fetchedPromos.filter(promo => promo.targetAudience === 'customer' || !promo.targetAudience || promo.targetAudience === 'all');
        setAvailablePromos(customerPromos);

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

  useEffect(() => {
    const fetchRealPartners = async () => {
      try {
        const partnersSnap = await getDocs(collection(db, 'partners'));
        const partners = partnersSnap.docs.map(d => ({ id: d.id, ...d.data() } as PartnerProfile));
        
        const eligible = partners.filter(p => p.isVerified && p.status === 'active' && p.categories.includes(service.categoryId));
        setRealEligiblePartners(eligible);

        const userIds = eligible.map(p => p.userId).filter(Boolean);
        if (userIds.length > 0) {
          const namesMap: Record<string, string> = {};
          const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'partner')));
          usersSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.uid) {
              namesMap[data.uid] = data.displayName || data.email || "Verified Pro";
            }
          });
          setRealPartnersNames(namesMap);
        }
      } catch (err) {
        console.error("Error loading real partners for preview:", err);
      }
    };
    fetchRealPartners();
  }, [service.categoryId]);

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
    
    // Check if slot has already been booked (busy / unavailable) in real-time
    if (busySlots[d] && busySlots[d].includes(slotValue)) {
      return 'expired';
    }
    
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

  const isCurrentDateFullyBooked = date ? timeSlots.every(slot => getSlotStatus(slot.value, date) === 'expired') : false;

  const getNearestAvailableDates = () => {
    const dates = [];
    const current = new Date();
    // Start looking from tomorrow onwards
    current.setDate(current.getDate() + 1);
    
    // Scan up to 15 days out to suggest up to 3 days that have available slots
    for (let i = 0; i < 15 && dates.length < 3; i++) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const hasAvailableSlot = timeSlots.some(slot => getSlotStatus(slot.value, dateStr) === 'available');
      if (hasAvailableSlot) {
        dates.push({
          value: dateStr,
          label: current.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        });
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
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
    if (redemptions.length > 0 && service && !appliedPromo && (step === 2 || step === 3)) {
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
    if (!time || !date) return false;

    const now = new Date();
    // Use local YYYY-MM-DD for comparison
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // If customer is booking today for tomorrow or any future date, no surge applies
    if (date !== todayStr) {
      return false;
    }

    // If same day, surge only applies for slot at 7:00 PM (19:00) or later. No surge for before 7:00 PM.
    const [h] = time.split(':').map(Number);
    if (h >= 19) {
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
  const [showLocalLogin, setShowLocalLogin] = useState(false);

  const handleConfirmServiceClick = () => {
    setError(null);
    
    // Check if email is missing and needs validation
    if (!profile?.email) {
      const emailTrimmed = contactEmail.trim();
      if (!emailTrimmed) {
        setError("Please enter your email address to continue.");
        return;
      }
      // Simple email pattern check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        setError("Please enter a valid email address.");
        return;
      }
    }
    
    // Check if phone is missing and needs validation
    if (!profile?.phoneNumber) {
      const phoneDigits = contactPhone.replace('+91', '').trim();
      if (!phoneDigits) {
        setError("Please enter your 10-digit mobile number to continue.");
        return;
      }
      if (phoneDigits.length !== 10) {
        setError("Please enter a valid 10-digit mobile number.");
        return;
      }
    }

    setShowFinalConfirmation(true);
  };

  const handleBooking = async () => {
    if (!profile) {
      setError("User profile not found. Please log in again.");
      setLoading(false);
      return;
    }

    if (!auth.currentUser) {
      setError("You must be logged in to book a service.");
      setLoading(false);
      return;
    }

    if (profile.role !== 'customer' && profile.role !== 'admin') {
      setError(`Invalid user role: ${profile.role}. Only standard users and administrators can submit service bookings.`);
      setLoading(false);
      return;
    }

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
      let eligiblePartnersList: PartnerProfile[] = [];

      try {
        const partnersSnap = await getDocs(collection(db, 'partners'));
        const partners = partnersSnap.docs.map(d => ({ id: d.id, ...d.data() } as PartnerProfile));

        // Haversine formula to compute exact physical distance in kilometers
        const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371; // Earth's radius in km
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c; // distance in km
        };

        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const scheduledDayName = daysOfWeek[scheduledAt.getDay()];

        // 1. Filter eligible partners
        // A partner is eligible if:
        // - Verified and active
        // - Has expertise in the service category
        // - Not completely offline
        // - Active schedule: has booking scheduled time overlapping active working hours for that day of week (if working hour settings are present)
        const eligiblePartners = partners.filter(p => {
          const isCoreEligible = p.isVerified && 
                                 p.status === 'active' && 
                                 p.availabilityStatus !== 'Offline' &&
                                 p.categories.includes(service.categoryId);
          if (!isCoreEligible) return false;

          // Optional schedule filter: if the partner has configured schedule, make sure they are active at scheduled day/time.
          if (p.workingHours && p.workingHours.length > 0) {
            const daySched = p.workingHours.find(wh => wh.day.toLowerCase() === scheduledDayName.toLowerCase());
            if (daySched && !daySched.enabled) {
              return false; // Not working this day!
            }
            if (daySched && daySched.startTime && daySched.endTime && time) {
              const [sHour, sMin] = time.split(':').map(Number);
              const [startHour, startMin] = daySched.startTime.split(':').map(Number);
              const [endHour, endMin] = daySched.endTime.split(':').map(Number);
              
              const sMinutes = sHour * 60 + sMin;
              const startMinutes = startHour * 60 + startMin;
              const endMinutes = endHour * 60 + endMin;
              
              if (sMinutes < startMinutes || sMinutes > endMinutes) {
                return false; // Time booking falls outside of partner scheduled hours!
              }
            }
          }
          return true;
        });

        eligiblePartnersList = eligiblePartners;

        if (eligiblePartners.length > 0) {
          // 2. Score according to proximity (Haversine), category rating, reviews volume, and real-time availability status
          const scoredPartners = eligiblePartners.map(p => {
            let score = 0;

            // Aspect A: Real-time Availability
            if (p.availabilityStatus === 'Available') {
              score += 150; // Heavily favor available professionals
            } else if (p.availabilityStatus === 'Busy') {
              score += 40; // Backup option
            }

            // Aspect B: Proximity (Haversine Distance matching)
            let distanceInKm = 9999;
            if (location && p.lat && p.lng) {
              distanceInKm = haversineDistance(location.lat, location.lng, p.lat, p.lng);
              if (distanceInKm <= 2) {
                score += 200; // Extremely close
              } else if (distanceInKm <= 5) {
                score += 130; // Very close
              } else if (distanceInKm <= 10) {
                score += 80;  // Standard range
              } else if (distanceInKm <= 20) {
                score += 30;  // Moderate commute
              } else {
                score -= 30;  // Commute distance penalty
              }
            }

            // Aspect C: Category Rating & Completed Experience
            const rating = p.rating || 0;
            if (rating >= 4.8) {
              score += 60;
            } else if (rating >= 4.5) {
              score += 40;
            } else if (rating >= 4.0) {
              score += 20;
            }

            // Experience volume weight (proxied by completed review counts)
            const reviews = p.reviewCount || 0;
            if (reviews >= 50) {
              score += 40;
            } else if (reviews >= 20) {
              score += 25;
            } else if (reviews >= 5) {
              score += 10;
            }

            return { partner: p, score, distance: distanceInKm };
          });

          // Sort descending by calculated score
          scoredPartners.sort((a, b) => b.score - a.score);

          const bestMatchObj = scoredPartners[0];
          console.log(`Matched partner ${bestMatchObj.partner.userId} with Score: ${bestMatchObj.score}, Distance: ${bestMatchObj.distance.toFixed(2)}km`);
          
          assignedPartnerId = bestMatchObj.partner.userId;
          bookingStatus = 'assigned';
        } else {
          // No real eligible partners found: fall back to nominating the closest simulated pro as auto-assigned!
          const scoredNearby = getScoredNearbyPartners();
          if (scoredNearby.length > 0) {
            const bestSim = scoredNearby[0];
            assignedPartnerId = bestSim.id;
            bookingStatus = 'assigned';
            console.log(`Matched simulated partner ${bestSim.id} / ${bestSim.name} with Distance: ${bestSim.distance.toFixed(2)}km`);
          }
        }
      } catch (matchErr) {
        console.error("Partner matching failed, falling back to manual assignment:", matchErr);
      }

      const bookingRef = doc(collection(db, bookingPath));
      const bookingId = bookingRef.id;
      setLastBookingId(bookingId);

      // SILENT TOKEN SILENT REFRESH (Robust verification)
      let idToken = "";
      try {
        if (!auth.currentUser) {
          throw new Error("You must be logged in to book a service.");
        }
        idToken = await auth.currentUser.getIdToken(true);
      } catch (tokenErr: any) {
        console.error("Token silent refresh failed:", tokenErr);
        try {
          localStorage.setItem('zomindia_pending_booking', JSON.stringify({
            serviceId: service.id,
            step,
            address: fullAddress,
            location,
            date,
            time,
            paymentMethod,
            activeAmc,
            useAmc
          }));
        } catch (saveErr) {}
        setShowLocalLogin(true);
        throw new Error("Your session is expired or invalid. Saving your booking draft. Please sign in again.");
      }

      // Prepare simulated partner data if assigned
      let simulatedPartner = null;
      if (assignedPartnerId && assignedPartnerId.startsWith('booking_sim_pro_')) {
        const scoredNearby = getScoredNearbyPartners();
        const matchedPro = scoredNearby.find(p => p.id === assignedPartnerId);
        if (matchedPro) {
          simulatedPartner = {
            id: matchedPro.id,
            name: matchedPro.name,
            rating: matchedPro.rating,
            reviewCount: matchedPro.reviewCount,
            lat: matchedPro.lat,
            lng: matchedPro.lng,
            categoryId: service.categoryId
          };
        }
      }

      // Submit booking details secure full-stack API route (resolves authorization, RBAC role-checking & transactional DB commits)
      const submitResponse = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          bookingId,
          serviceId: service.id,
          partnerId: assignedPartnerId,
          status: bookingStatus,
          paymentStatus: useAmc ? 'paid' : 'unpaid',
          scheduledAtIso: scheduledAt.toISOString(),
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
          customerBookedEmail: contactEmail.trim(),
          customerBookedPhone: contactPhone.trim(),
          simulatedPartner
        })
      });

      if (!submitResponse.ok) {
        const errData = await submitResponse.json().catch(() => ({}));
        const errMsg = errData.error || `Server returned error status code: ${submitResponse.status}`;
        
        if (submitResponse.status === 401 || submitResponse.status === 403) {
          try {
            localStorage.setItem('zomindia_pending_booking', JSON.stringify({
              serviceId: service.id,
              step,
              address: fullAddress,
              location,
              date,
              time,
              paymentMethod,
              activeAmc,
              useAmc
            }));
          } catch (saveErr) {}
          setShowLocalLogin(true);
        }
        throw new Error(errMsg);
      }

      // Notify key stakeholders (wrapped inside safety block to ensure notification dispatch failure never halts booking completion)
      try {
        await sendNotification(profile?.uid || auth.currentUser?.uid || '', 'Booking Placed!', assignedPartnerId ? `Your request for ${service.name} has been received and partner has been assigned.` : `Your request for ${service.name} has been received. Waiting for partner assignment.`, 'new_booking', bookingRef.id);
        
        if (assignedPartnerId) {
          await sendNotification(assignedPartnerId, 'New Job Assigned', `You have been automatically matched for a ${service.name} booking at ${date} ${time}.`, 'new_booking', bookingRef.id);
        } else {
          await sendNotification('sarthakwebtech@gmail.com', 'New Booking Received', `Customer ${profile?.displayName || 'A User'} booked ${service.name}. No partner could be auto-assigned.`, 'new_booking', bookingRef.id);
        }

        // Notify other active, qualified partners nearby so they receive alerts for newly published booking requests
        const matchingPartnersToNotify = eligiblePartnersList.filter(p => (p.userId || p.id) !== assignedPartnerId);
        for (const pt of matchingPartnersToNotify) {
          const partnerUid = pt.userId || pt.id;
          if (partnerUid) {
            await sendNotification(
              partnerUid,
              'New Booking Request Nearby!',
              `A new request for ${service.name} has been published in your area. Accept it now!`,
              'new_booking',
              bookingRef.id
            );
          }
        }
      } catch (notifyErr) {
        console.warn("Non-fatal booking notifications dispatch error:", notifyErr);
      }

      // Live SMS & WhatsApp Gateway trigger
      try {
        await fetch('/api/alerts/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateName: 'booking_confirmation',
            payload: {
              to: contactPhone.trim(),
              recipientName: profile?.displayName || 'Customer',
              bookingId: bookingRef.id,
              serviceName: service.name,
              scheduledTime: `${date} at ${time}`,
              price: finalPrice
            }
          })
        });
      } catch (alertError) {
        console.warn("SMS/WhatsApp gateway alert bypassed or offline:", alertError);
      }
      
      setShowFinalConfirmation(false);
      try {
        localStorage.removeItem('zomindia_pending_booking');
      } catch (cacheErr) {}
      setShowSuccessModal(true);
      setStep(4);
    } catch (err: any) {
      console.error("Booking error:", err);
      // Try to parse JSON from handleFirestoreError if possible, or just use message
      let msg = "An error occurred while placing your booking. Please try again.";
      let isPermissionDenied = false;
      let errorDetails = "";

      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) {
          msg = parsed.error;
          errorDetails = parsed.error;
        }
      } catch {
        if (err.message && !err.message.includes('{')) {
          msg = err.message;
          errorDetails = err.message;
        }
      }

      // Check if this error is due to permission denied / authentication issues
      const errLower = errorDetails.toLowerCase();
      if (
        errLower.includes('permission') || 
        errLower.includes('denied') || 
        errLower.includes('unauthorized') ||
        errLower.includes('insufficient_permissions') ||
        errLower.includes('permission-denied')
      ) {
        isPermissionDenied = true;
      }

      if (isPermissionDenied) {
        const friendlyMsg = "Permission Denied: You do not have permissions to submit this booking. Please ensure you are logged in with an active customer account.";
        // Trigger a user-friendly toast notification when the booking fails due to permission denied errors.
        if (typeof (window as any).__showToast === 'function') {
          (window as any).__showToast(friendlyMsg);
        }
        msg = friendlyMsg;
      }

      setError(msg);
      setShowFinalConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    let resolvedAddress = '';
    let resolvedStreet = '';
    let resolvedCity = '';
    let isAddressIncomplete = false;

    // 1. Try Google Maps Reverse Geocoding FIRST (with precise extraction)
    if (geocodingLib) {
      try {
        const geocoder = new geocodingLib.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response && response.results && response.results[0]) {
          const result = response.results[0];
          const components = result.address_components;

          let premise = '';
          let route = '';
          let sublocality2 = '';
          let sublocality1 = '';
          let neighborhood = '';
          let locality = ''; // City
          let administrativeArea1 = ''; // State
          let postalCode = '';

          for (const comp of components) {
            const types = comp.types;
            if (types.includes('premise') || types.includes('subpremise') || types.includes('building')) {
              premise = comp.long_name;
            }
            if (types.includes('route')) {
              route = comp.long_name;
            }
            if (types.includes('sublocality_level_2')) {
              sublocality2 = comp.long_name;
            }
            if (types.includes('sublocality_level_1')) {
              sublocality1 = comp.long_name;
            }
            if (types.includes('neighborhood')) {
              neighborhood = comp.long_name;
            }
            if (types.includes('locality')) {
              locality = comp.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
              administrativeArea1 = comp.long_name;
            }
            if (types.includes('postal_code')) {
              postalCode = comp.long_name;
            }
          }

          // Check if key fields are missing to determine incomplete address
          isAddressIncomplete = !premise && !route && !sublocality1 && !sublocality2 && !neighborhood;

          // Build manualStreet and manualCity
          const streetComponents = [
            premise,
            route,
            sublocality2,
            sublocality1,
            neighborhood
          ].filter(p => p && p.trim());

          resolvedStreet = streetComponents.join(', ');
          resolvedCity = [locality, administrativeArea1, postalCode].filter(p => p && p.trim()).join(', ');

          if (!resolvedStreet && result.formatted_address) {
            resolvedStreet = result.formatted_address;
            const parts = result.formatted_address.split(',');
            if (parts.length > 1) {
              resolvedCity = parts[parts.length - 1].trim();
            }
          }

          resolvedAddress = [resolvedStreet, resolvedCity].filter(p => p && p.trim()).join(', ');

          // Preload manual states
          setManualHouse(premise);
          setManualStreet(resolvedStreet);
          setManualCity(resolvedCity);
          
          if (isAddressIncomplete) {
            setManualHouse('');
          }
        }
      } catch (err) {
        console.warn("Google Maps reverse geocoding failed, trying Nominatim fallback:", err);
      }
    }

    // 2. Try Nominatim fallback if Google Maps geocoder didn't return a resolved address
    if (!resolvedAddress) {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'zomindia-app-preview'
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            resolvedAddress = data.display_name;
            isAddressIncomplete = !data.address?.house_number && !data.address?.road && !data.address?.suburb;
            
            const osHouse = data.address?.house_number || data.address?.building || '';
            const osStreet = [
              data.address?.road,
              data.address?.neighbourhood,
              data.address?.suburb,
              data.address?.sublocality
            ].filter(p => p && p.trim()).join(', ');
            
            const osCity = [
              data.address?.city || data.address?.town || data.address?.village,
              data.address?.state,
              data.address?.postcode
            ].filter(p => p && p.trim()).join(', ');

            setManualHouse(osHouse);
            setManualStreet(osStreet || data.display_name);
            setManualCity(osCity);
          }
        }
      } catch (err) {
        console.warn("OSM Nominatim reverse-geocode failed, trying coordinate fallback:", err);
      }
    }

    // 3. Fallback to basic coordinates label if Nominatim failed too
    if (!resolvedAddress) {
      resolvedAddress = `Point: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      resolvedStreet = `Point Coordinate Area`;
      resolvedCity = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      isAddressIncomplete = true;

      setManualHouse('');
      setManualStreet(resolvedStreet);
      setManualCity(resolvedCity);
    }

    setAddress(resolvedAddress);
    setIsIncompleteAddress(isAddressIncomplete);
    setIsGeocoding(false);
  };

  const getEventLatLng = (e: any): { lat: number, lng: number } | null => {
    let lat: any = null;
    let lng: any = null;

    if (e.detail?.latLng) {
      lat = e.detail.latLng.lat;
      lng = e.detail.latLng.lng;
    } else if (e.latLng) {
      lat = e.latLng.lat;
      lng = e.latLng.lng;
    } else if (e.target && 'position' in e.target && e.target.position) {
      lat = e.target.position.lat;
      lng = e.target.position.lng;
    } else if (e.currentTarget && 'position' in e.currentTarget && e.currentTarget.position) {
      lat = e.currentTarget.position.lat;
      lng = e.currentTarget.position.lng;
    }

    if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
      const latVal = typeof lat === 'function' ? lat() : lat;
      const lngVal = typeof lng === 'function' ? lng() : lng;
      if (typeof latVal === 'number' && typeof lngVal === 'number') {
        return { lat: latVal, lng: lngVal };
      }
    }
    return null;
  };

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
          // Disabled double-click overlay dismissal to avoid losing typed address or search keyboard state
          onDoubleClick={undefined}
          className="absolute inset-0 bg-blue-700/60 backdrop-blur-sm" 
        />
        {/* Disabled click overlay dismissal to avoid losing typed address or search keyboard state */}
        <div className="absolute inset-0 hidden md:block" onClick={undefined} />
        
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
          // Disabled double-click overlay dismissal to avoid losing typed address or search keyboard state
          onDoubleClick={undefined}
          className="absolute inset-0 bg-blue-700/60 backdrop-blur-sm" 
        />
        {/* Disabled click overlay dismissal to avoid losing typed address or search keyboard state */}
        <div className="absolute inset-0 hidden md:block" onClick={undefined} />
        
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

          {step <= 3 && (
            <div className="bg-slate-50/50 border-b border-slate-100 px-6 sm:px-10 py-3 shrink-0">
              <div className="flex items-center justify-between relative max-w-sm mx-auto">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-250/70 -translate-y-1/2 z-0" />
                <motion.div 
                  className="absolute top-1/2 left-0 h-0.5 bg-blue-600 -translate-y-1/2 z-0 origin-left"
                  initial={{ width: '0%' }}
                  animate={{ 
                    width: step === 1 ? '0%' : step === 2 ? '50%' : '100%'
                  }}
                  transition={{ duration: 0.3 }}
                />
                
                {[
                  { key: 1, label: "Schedule", desc: "Select Slot" },
                  { key: 2, label: "Address", desc: "Service Location" },
                  { key: 3, label: "Review", desc: "Confirm & Pay" }
                ].map((s) => {
                  const isCompleted = step > s.key;
                  const isCurrent = step === s.key;
                  return (
                    <div key={s.key} className="relative z-10 flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (s.key < step) {
                            setStep(s.key);
                          }
                        }}
                        disabled={s.key >= step}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all shadow-sm ${
                          isCompleted
                            ? "bg-emerald-500 text-white cursor-pointer hover:scale-105"
                            : isCurrent
                              ? "bg-blue-600 text-white ring-4 ring-blue-100"
                              : "bg-white border border-slate-200 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        {isCompleted ? "✓" : s.key}
                      </button>
                      <div className="text-center mt-1">
                        <p className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {s.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 md:space-y-8"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full inline-block">Step 1 of 3</span>
                    <h4 className="text-base font-bold text-slate-900 mt-2">Schedule Your Service Slot</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Pick a convenient arrival date and time slot for our professional technician.</p>
                  </div>

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

                  <div className="space-y-4">
                    <div className="relative group">
                      <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={16} />
                      <input 
                        type="date" 
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value || '');
                          setTime('');
                        }}
                        min={new Date().toLocaleDateString('en-CA')}
                        className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 sm:py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all font-bold text-sm text-slate-900 placeholder:text-slate-300"
                      />
                    </div>

                    {date && !isCurrentDateFullyBooked && (
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

                    {date && isCurrentDateFullyBooked && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-amber-50 border border-amber-200 rounded-[20px] p-4 sm:p-5 space-y-4"
                      >
                        <div className="flex gap-3">
                          <Clock size={18} className="text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                          <div>
                            <h5 className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-1">
                              All Slots Booked / Past
                            </h5>
                            <p className="text-xs text-amber-700 leading-relaxed font-semibold">
                              All time slots for <span className="font-extrabold text-amber-900 border-b border-amber-300/40">{new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span> are fully booked or have expired. Please choose a future date:
                            </p>
                          </div>
                        </div>

                        {/* Quick select suggestions */}
                        <div className="space-y-2 pt-1 border-t border-amber-200/50">
                          <p className="text-[9px] uppercase font-bold tracking-widest text-slate-400">
                            Suggested Future Dates
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {getNearestAvailableDates().map((suggestion) => (
                              <button
                                type="button"
                                key={suggestion.value}
                                onClick={() => {
                                  setDate(suggestion.value);
                                  setTime('');
                                }}
                                className="px-3.5 py-2.5 bg-white border border-slate-200 hover:border-blue-500 rounded-xl text-xs font-bold text-slate-800 hover:text-blue-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                              >
                                <CalendarIcon size={12} className="text-slate-400" />
                                {suggestion.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 sm:p-6 mt-6 -mx-4 sm:-mx-8 z-30 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] flex flex-col pt-4">
                    <button 
                      disabled={!date || !time}
                      onClick={() => setStep(2)}
                      className="w-full bg-blue-700 text-white py-4.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] italic hover:bg-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-blue-700/20 active:scale-[0.98]"
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full inline-block">Step 2 of 3</span>
                    <h4 className="text-base font-bold text-slate-900 mt-2">Enter Service Address</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Please provide the address where you want our technician to arrive.</p>
                  </div>

                  {/* Clean Tab Switcher */}
                  <div className="bg-slate-50 p-1 rounded-xl border border-slate-100 flex gap-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setIsManualEdit(false)}
                      className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                        !isManualEdit
                          ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <MapPin size={14} /> Search on Map
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsManualEdit(true)}
                      className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                        isManualEdit
                          ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      ✏️ Type Address Manually
                    </button>
                  </div>

                  {!isManualEdit ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3">
                        <label className="block text-xs font-semibold text-slate-600">Search for your area / colony</label>
                        <AddressAutocomplete 
                          value={address}
                          onChange={(val) => {
                            setAddress(val);
                            if (!location) setLocation({ lat: 28.6139, lng: 77.2090 });
                          }}
                          onAddressSelect={(addr, lat, lng) => {
                            setAddress(addr);
                            setLocation({ lat, lng });
                            setMapCenter({ lat, lng });
                          }} 
                          onEditClick={() => setIsManualEdit(true)}
                        />

                        <button 
                          type="button"
                          disabled={isFetchingGps}
                          onClick={async () => {
                            setIsFetchingGps(true);
                            if (navigator.permissions) {
                              try {
                                const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                                if (permissionStatus.state === 'denied') {
                                  alert("Location permission is blocked. Please enable map/device location settings manually.");
                                  setIsFetchingGps(false);
                                  return;
                                }
                              } catch (e) {}
                            }

                            if (navigator.geolocation) {
                              const successCallback = async (pos: GeolocationPosition) => {
                                  const lat = pos.coords.latitude;
                                  const lng = pos.coords.longitude;
                                  setLocation({ lat, lng });
                                  setMapCenter({ lat, lng });
                                  setMapZoom(17);
                                  await reverseGeocode(lat, lng);
                                  setIsFetchingGps(false);
                              };
                              
                              const errorCallback = (err: GeolocationPositionError) => {
                                alert("Could not fetch GPS location. Please search for your area above or use code/typing mode.");
                                setIsFetchingGps(false);
                              };

                              navigator.geolocation.getCurrentPosition(
                                successCallback,
                                (err) => {
                                  if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
                                    navigator.geolocation.getCurrentPosition(
                                      successCallback,
                                      errorCallback,
                                      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
                                    );
                                  } else {
                                    errorCallback(err);
                                  }
                                },
                                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                              );
                            } else {
                               alert("Geolocation is not supported by your browser.");
                               setIsFetchingGps(false);
                            }
                          }}
                          className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold border transition-all cursor-pointer ${
                            isFetchingGps 
                              ? "bg-slate-100 text-slate-400 border-slate-200 animate-pulse" 
                              : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm"
                          }`}
                        >
                          <span className={isFetchingGps ? "animate-spin text-slate-400" : ""}>📍</span>
                          {isFetchingGps ? "Detecting location..." : "Use Current Location (GPS)"}
                        </button>
                      </div>

                      {address && location && (
                        <div className="space-y-2 mt-4 text-left">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] font-semibold text-slate-500">
                              Confirm location on map:
                            </span>
                            {address.trim() && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!address.trim()) return;
                                  setIsGeocoding(true);
                                  let resolvedLocation: { lat: number, lng: number } | null = null;
                                  try {
                                    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
                                    const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'zomindia-app-preview' } });
                                    if (res.ok) {
                                      const data = await res.json();
                                      if (data?.[0]) {
                                        resolvedLocation = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                                      }
                                    }
                                  } catch (e) {
                                    console.warn("OSM resolution failed:", e);
                                  }
                                  if (resolvedLocation) {
                                    setLocation(resolvedLocation);
                                    setMapCenter(resolvedLocation);
                                    setMapZoom(17);
                                  } else {
                                    alert("Could not locate address. Please position the pin manually on map.");
                                  }
                                  setIsGeocoding(false);
                                }}
                                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                              >
                                {isGeocoding ? "Locating..." : "Pin to address"}
                              </button>
                            )}
                          </div>

                          <div className="w-full h-40 rounded-xl overflow-hidden border border-slate-200 relative bg-slate-50 shadow-sm">
                            <Map
                              defaultCenter={location}
                              center={mapCenter}
                              zoom={mapZoom}
                              onZoomChanged={(e) => setMapZoom(e.detail.zoom)}
                              defaultZoom={15}
                              mapId="DEMO_MAP_ID"
                              gestureHandling="greedy"
                              disableDefaultUI={false}
                              zoomControl={true}
                              streetViewControl={false}
                              mapTypeControl={false}
                              fullscreenControl={false}
                              className="w-full h-full"
                              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                              onClick={(e) => {
                                const coords = getEventLatLng(e);
                                if (coords) {
                                  setLocation(coords);
                                  setMapCenter(coords);
                                  reverseGeocode(coords.lat, coords.lng);
                                }
                              }}
                            >
                              <AdvancedMarker 
                                position={location}
                                draggable={true}
                                onDragEnd={(e) => {
                                  const coords = getEventLatLng(e);
                                  if (coords) {
                                    setLocation(coords);
                                    setMapCenter(coords);
                                    reverseGeocode(coords.lat, coords.lng);
                                  }
                                }}
                              >
                                <Pin background="#2563eb" glyphColor="#fff" borderColor="#1e40af" />
                              </AdvancedMarker>

                              {simulatedPros.map((pro) => (
                                <AdvancedMarker 
                                  key={pro.id} 
                                  position={{ lat: pro.lat, lng: pro.lng }}
                                >
                                  <PartnerIdentityMarker
                                    status={pro.status}
                                    name={pro.name}
                                  />
                                </AdvancedMarker>
                              ))}
                            </Map>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">
                            💡 Drag the blue map pin or tap any spot to point out your doorstep exactly.
                          </p>

                          {/* Assigned Pro (Compact & Clean) */}
                          {(() => {
                            const nearby = getScoredNearbyPartners();
                            if (nearby.length > 0) {
                              const optimalMatch = nearby[0];
                              return (
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between text-xs mt-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="font-semibold text-slate-600">Assigned Pro:</span>
                                    <span className="font-bold text-slate-900">{optimalMatch.name}</span>
                                  </div>
                                  <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold">
                                    Arriving in ~{Math.max(3, Math.round(optimalMatch.distance * 3.5 + 3))} mins
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}

                      <div className="space-y-1 mt-3 text-left">
                        <label className="block text-xs font-semibold text-slate-600">House / Flat No., Floor, Apartment Name</label>
                        <input 
                          type="text"
                          value={addressDetails}
                          onChange={(e) => setAddressDetails(e.target.value)}
                          placeholder="e.g. Flat 402, Building 3B, Sector 5..."
                          className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs sm:text-sm font-medium text-slate-900"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Structured Manual Input Mode - Highly Accessible & Super Simple */
                    <div className="space-y-4 text-left">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          House / Flat / Floor / Building Name
                        </label>
                        <input
                          type="text"
                          value={manualHouse}
                          onChange={(e) => {
                            setManualHouse(e.target.value);
                            updateAddressFromManual(e.target.value, manualStreet, manualCity, manualLandmark);
                          }}
                          placeholder="e.g. Apartment 304, Rosewood Residency"
                          className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-medium text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Street / Sector / Block / Colony <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={manualStreet}
                          onChange={(e) => {
                            setManualStreet(e.target.value);
                            updateAddressFromManual(manualHouse, e.target.value, manualCity, manualLandmark);
                          }}
                          placeholder="e.g. Sector 56, Golf Course Road"
                          className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-medium text-slate-900"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            City, State & Pincode <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={manualCity}
                            onChange={(e) => {
                              setManualCity(e.target.value);
                              updateAddressFromManual(manualHouse, manualStreet, e.target.value, manualLandmark);
                            }}
                            placeholder="e.g. Gurgaon, Haryana - 122011"
                            className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-medium text-slate-900"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Landmark (Optional)
                          </label>
                          <input
                            type="text"
                            value={manualLandmark}
                            onChange={(e) => {
                              setManualLandmark(e.target.value);
                              updateAddressFromManual(manualHouse, manualStreet, manualCity, e.target.value);
                            }}
                            placeholder="e.g. Opposite Central School"
                            className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-medium text-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subtle, beautiful pricing & checkout footer */}
                  <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 sm:p-5 mt-6 -mx-4 sm:-mx-8 z-30 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] flex flex-col gap-4">
                    <div className="flex justify-between items-center px-1">
                      <div className="text-left">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Estimated Total</p>
                        <p className="text-2xl font-bold text-slate-900">₹{calculateFinalPrice()}</p>
                      </div>
                      {appliedPromo && (
                        <div className="text-right">
                          <p className="text-xs text-slate-400 line-through">₹{service.basePrice + getSurgeAmount()}</p>
                          <p className="text-xs text-emerald-600 font-bold">You saved ₹{(service.basePrice + getSurgeAmount()) - calculateFinalPrice()}</p>
                        </div>
                      )}
                    </div>

                    <button 
                      disabled={!isManualEdit ? !address : !manualStreet}
                      onClick={() => setStep(3)}
                      className="w-full bg-blue-700 text-white py-4 rounded-xl font-bold text-sm tracking-wide hover:bg-blue-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
                    >
                      Continue
                    </button>
                  </div>
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
                  <div className="border-b border-slate-100 pb-3">
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full inline-block">Step 3 of 3</span>
                    <h4 className="text-base font-bold text-slate-900 mt-2">Confirm & Review Order</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Please review your selected date, appointment location, and final pricing details before booking.</p>
                  </div>

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
                          {!isEditingAddressOnConfirm ? (
                            <button 
                              type="button"
                              onClick={() => {
                                setIsEditingAddressOnConfirm(true);
                              }}
                              className="text-[10px] font-black uppercase text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-full transition-all border border-blue-100 cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              ✏️ Edit
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button 
                                type="button"
                                onClick={() => {
                                  setIsEditingAddressOnConfirm(false);
                                }}
                                className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-all border border-emerald-150 cursor-pointer"
                              >
                                Done
                              </button>
                              <button 
                                type="button"
                                onClick={() => {
                                  setIsEditingAddressOnConfirm(false);
                                }}
                                className="text-[10px] font-black uppercase text-slate-400 hover:bg-slate-50 px-2 py-1.5 rounded-full transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                        {isEditingAddressOnConfirm ? (
                          <div className="space-y-3">
                            <textarea
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              rows={2}
                              className="w-full bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 transition-all font-sans leading-normal resize-none"
                              placeholder="Complete address (e.g. House No, Street name, landmark...)"
                            />
                            <p className="text-[9px] text-slate-400 leading-normal font-medium">✏️ Edit the address details directly above to resolve any typos or missing unit numbers.</p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-700 font-bold leading-relaxed">
                            {addressDetails && <span className="block text-slate-900 mb-1">{addressDetails}</span>}
                            {address}
                          </p>
                        )}
                      </div>

                      {/* Offers & Promos Section (Zomato/Urban Company Inspired - Highly accessible & simple for all ages) */}
                      <div className="bg-white rounded-[28px] border border-slate-100 p-5 group transition-all hover:shadow-md">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600 block">
                              <Tag size={16} className="fill-emerald-100" />
                            </span>
                            <div className="text-left">
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Coupons & Offers</p>
                              <p className="font-bold text-slate-900 text-sm">Save on your booking</p>
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setShowPromos(!showPromos)}
                            className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-full transition-all border border-rose-100 cursor-pointer"
                          >
                            {showPromos ? 'Hide Offers' : 'View Offers'}
                          </button>
                        </div>

                        {/* Input Promo Field */}
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={promoInput}
                            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                            placeholder="Type Coupon Code here..."
                            className="flex-1 bg-slate-50 px-4 py-3.5 rounded-xl border border-slate-100 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-700/10 transition-all font-mono text-sm font-bold uppercase tracking-widest text-slate-900 placeholder:text-slate-350 placeholder:normal-case"
                          />
                          {promoInput.trim() && !appliedPromo && (
                            <button 
                              type="button"
                              onClick={handleApplyPromo}
                              disabled={isVerifyingPromo}
                              className="bg-blue-700 text-white px-5 py-3.5 rounded-xl font-bold text-xs hover:bg-blue-800 transition-all disabled:opacity-50 tracking-wider font-sans uppercase shrink-0"
                            >
                              {isVerifyingPromo ? '...' : 'APPLY'}
                            </button>
                          )}
                        </div>

                        {promoError && (
                          <p className="text-[11px] text-rose-500 font-semibold mt-2 ml-1 text-left">
                            ⚠️ {promoError}
                          </p>
                        )}

                        {/* Active Promo Success Message */}
                        {appliedPromo && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.98 }} 
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center justify-between bg-emerald-50/70 border border-emerald-100/80 p-4 rounded-2xl mt-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-500 rounded-xl text-white">
                                <CheckCircle2 size={16} />
                              </div>
                              <div className="text-left">
                                <span className="text-xs font-black text-emerald-900 uppercase tracking-widest block font-mono">
                                  🎟️ {appliedPromo.code} Applied
                                </span>
                                <span className="text-[11px] font-bold text-emerald-700 block mt-0.5">
                                  You saved ₹{appliedPromo.discountType === 'percent' 
                                    ? Math.round((service.basePrice * appliedPromo.discountValue) / 100) 
                                    : appliedPromo.discountValue} with this coupon!
                                </span>
                              </div>
                            </div>
                            <button 
                              type="button"
                              onClick={() => {
                                setAppliedPromo(null);
                                setPromoInput('');
                              }} 
                              className="bg-white p-2 rounded-xl text-rose-500 hover:bg-rose-50 border border-emerald-100 transition-colors cursor-pointer shrink-0"
                              title="Delete Coupon"
                            >
                              <X size={14} />
                            </button>
                          </motion.div>
                        )}

                        {/* Available Promos Area */}
                        <AnimatePresence>
                          {showPromos && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden mt-4 pt-4 border-t border-slate-100 space-y-3 text-left"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Offers ({availablePromos.length})</span>
                                <button type="button" onClick={() => setShowPromos(false)} className="text-slate-400 p-1 hover:text-slate-600">
                                  <X size={14} />
                                </button>
                              </div>
                              {availablePromos.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto no-scrollbar pt-1">
                                  {availablePromos.map(p => {
                                    const isSelected = appliedPromo?.id === p.id;
                                    const expectedSavings = p.discountType === 'percent' 
                                      ? Math.round((service.basePrice * p.discountValue) / 100) 
                                      : p.discountValue;
                                    
                                    return (
                                      <div 
                                        key={p.id} 
                                        onClick={() => {
                                          if (isSelected) {
                                            setAppliedPromo(null);
                                            setPromoInput('');
                                          } else {
                                            setAppliedPromo(p);
                                            setPromoInput(p.code);
                                            setShowPromos(false);
                                          }
                                        }}
                                        className={`group relative p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                                          isSelected 
                                            ? 'bg-emerald-50/60 border-emerald-400 hover:border-emerald-500' 
                                            : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm'
                                        }`}
                                        style={{ borderStyle: 'dashed' }}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-grow text-left">
                                            <div className="flex items-center gap-2 mb-1.5">
                                              <span className="bg-blue-50 text-blue-700 text-xs font-black px-2.5 py-0.5 rounded uppercase tracking-wider font-mono border border-blue-100">
                                                {p.code}
                                              </span>
                                              {isSelected && (
                                                <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 leading-none shadow-sm shadow-emerald-500/10">
                                                  <CheckCircle2 size={10} /> Active
                                                </span>
                                              )}
                                            </div>
                                            <h5 className="font-extrabold text-slate-800 text-xs tracking-tight line-clamp-1">{p.name}</h5>
                                            <p className="text-[11px] text-emerald-600 font-bold mt-1">
                                              💰 Saves ₹{expectedSavings} on this service!
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                              {p.discountType === 'percent' ? `${p.discountValue}%` : `₹${p.discountValue}`} off on booking
                                            </p>
                                          </div>
                                          <button 
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isSelected) {
                                                setAppliedPromo(null);
                                                setPromoInput('');
                                              } else {
                                                setAppliedPromo(p);
                                                setPromoInput(p.code);
                                                setShowPromos(false);
                                              }
                                            }}
                                            className={`text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-sm shrink-0 select-none ${
                                              isSelected 
                                                ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 active:scale-95' 
                                                : 'bg-slate-100 text-slate-800 hover:bg-blue-600 hover:text-white active:scale-95'
                                            }`}
                                          >
                                            {isSelected ? 'Remove' : 'Apply'}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-450 italic text-center py-4">No exclusive offers found for you yet.</p>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Contact Accuracy, Accessibility, & Security */}
                      {(!profile?.email || !profile?.phoneNumber) && (
                        <div className="bg-white rounded-[28px] border border-slate-200 p-5 space-y-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-3 bg-blue-700 rounded-full" />
                            <p className="text-[10px] text-slate-900 font-black uppercase tracking-widest">Contact Accuracy & Security</p>
                          </div>
                          
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            For security, accessibility, and real-time booking updates, please fill in your missing info.
                          </p>

                          {!profile?.email && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block">Your Email Address</label>
                              <input 
                                type="email"
                                value={contactEmail}
                                onChange={(e) => setContactEmail(e.target.value)}
                                placeholder="name@domain.com"
                                className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 transition-all placeholder:text-slate-300"
                              />
                            </div>
                          )}

                          {!profile?.phoneNumber && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block">Your Mobile Number</label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">+91</span>
                                <input 
                                  type="tel"
                                  value={contactPhone.replace('+91', '')}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
                                    setContactPhone(raw ? `+91${raw}` : '');
                                  }}
                                  placeholder="Enter 10-digit number"
                                  className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 pl-16 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 transition-all placeholder:text-slate-300"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

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

                  <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 sm:p-6 mt-6 -mx-4 sm:-mx-8 z-30 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] flex flex-col pt-4">
                    <button 
                      disabled={loading}
                      onClick={handleConfirmServiceClick}
                      className="w-full bg-blue-700 text-white py-4.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] italic hover:bg-blue-800 transition-all flex justify-center items-center gap-2 shadow-xl shadow-blue-700/20 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {loading ? 'Processing...' : 'Confirm Service'}
                    </button>
                  </div>
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

            {showLocalLogin && (
              <AuthModal
                isOpen={showLocalLogin}
                onClose={() => setShowLocalLogin(false)}
                onSuccess={() => {
                  setShowLocalLogin(false);
                  handleBooking();
                }}
              />
            )}
          </div>

          <AnimatePresence>
            {showFinalConfirmation && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 z-[120] bg-white backdrop-blur-xl flex flex-col justify-between p-6 sm:p-8 overflow-y-auto"
              >
                <div>
                  <div className="w-16 h-16 bg-blue-700 text-white rounded-full flex items-center justify-center mx-auto mb-4 mt-2 shadow-xl shrink-0">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 tracking-tight font-display text-center">Confirm Selection</h3>
                  
                  <div className="w-full bg-slate-50 p-5 sm:p-6 rounded-3xl border border-slate-100 mb-4 text-left space-y-3.5">
                     <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service</span>
                        <span className="text-xs font-bold text-slate-900 text-right ml-4">{service.name}</span>
                     </div>
                     <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timeline</span>
                        <span className="text-xs font-bold text-slate-900 text-right">{date} at {time}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Amount</span>
                        <span className="text-lg font-black text-slate-900 tracking-tight">₹{calculateFinalPrice()}</span>
                     </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3.5 w-full">
                    <button 
                      disabled={loading}
                      onClick={() => {
                        setShowFinalConfirmation(false);
                        setStep(1);
                      }} 
                      className="py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all active:scale-95"
                    >
                      Modify Selection
                    </button>
                    <button 
                      disabled={loading}
                      onClick={handleBooking} 
                      className="py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-blue-700 text-white hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/20 active:scale-95"
                    >
                      {loading ? 'Confirming...' : 'Continue'}
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-xs mx-auto text-center">
                    By finalizing, you agree to our terms of service and convenience fee policy.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
