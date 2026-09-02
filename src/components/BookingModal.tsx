import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, 
  Timestamp, 
  query, 
  where, 
  getDocs, 
  limit, 
  doc, 
  updateDoc, 
  setDoc, 
  onSnapshot, 
  runTransaction 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Service, UserProfile, Promotion, Redemption, PartnerProfile, AMC } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { getWhatsAppBookingLink } from '../lib/whatsapp';
import { generateGoogleCalendarUrl } from '../utils/calendar';
import { formatTime12Hour } from '../utils/formatTime';
import AuthModal from './AuthModal';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Map,
  AdvancedMarker,
  Pin
} from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_MAP_ID } from '../lib/maps-config';
import { 
  X, 
  Clock, 
  MapPin, 
  CreditCard,
  Calendar as CalendarIcon,
  CheckCircle2,
  Navigation,
  Info,
  Zap,
  FileText,
  AlertCircle,
  MessageCircle,
  Tag,
  Wallet,
  Banknote,
  ShieldCheck,
  Check
} from 'lucide-react';
import PartnerIdentityMarker from './PartnerIdentityMarker';
import OnlinePaymentGatewayModal, { PaymentSuccessData } from './OnlinePaymentGatewayModal';

interface Props {
  service: Service;
  profile: UserProfile | null;
  onClose: () => void;
  onSuccess: () => void;
}

const INDORE_FALLBACK_LOCATIONS = [
  { placeId: 'indore_1', name: 'Vijay Nagar', area: 'Vijay Nagar, Indore, Madhya Pradesh', description: 'Vijay Nagar, Indore, Madhya Pradesh', lat: 22.7533, lng: 75.8937 },
  { placeId: 'indore_2', name: 'Palasia / New Palasia', area: 'New Palasia, Indore, Madhya Pradesh', description: 'New Palasia, Indore, Madhya Pradesh', lat: 22.7244, lng: 75.8839 },
  { placeId: 'indore_3', name: 'Bhawarkua', area: 'Bhawarkua Square, Indore, Madhya Pradesh', description: 'Bhawarkua, Indore, Madhya Pradesh', lat: 22.6926, lng: 75.8676 },
  { placeId: 'indore_4', name: 'Sapna Sangeeta', area: 'Sapna Sangeeta Road, Indore, Madhya Pradesh', description: 'Sapna Sangeeta Road, Indore, Madhya Pradesh', lat: 22.7056, lng: 75.8648 },
  { placeId: 'indore_5', name: 'Super Corridor', area: 'Super Corridor, Indore, Madhya Pradesh', description: 'Super Corridor, Indore, Madhya Pradesh', lat: 22.7663, lng: 75.8194 },
  { placeId: 'indore_6', name: 'Saket Nagar', area: 'Saket Nagar, Indore, Madhya Pradesh', description: 'Saket Nagar, Indore, Madhya Pradesh', lat: 22.7215, lng: 75.8988 },
  { placeId: 'indore_7', name: 'Mahalaxmi Nagar', area: 'Mahalaxmi Nagar, Indore, Madhya Pradesh', description: 'Mahalaxmi Nagar, Indore, Madhya Pradesh', lat: 22.7627, lng: 75.9038 },
  { placeId: 'indore_8', name: 'AB Road', area: 'A.B. Road, Indore, Madhya Pradesh', description: 'A.B. Road, Indore, Madhya Pradesh', lat: 22.7383, lng: 75.8872 },
  { placeId: 'indore_9', name: 'Rau', area: 'Rau, Indore, Madhya Pradesh', description: 'Rau, Indore, Madhya Pradesh', lat: 22.6288, lng: 75.8058 },
  { placeId: 'indore_10', name: 'Annapurna', area: 'Annapurna Road, Indore, Madhya Pradesh', description: 'Annapurna Road, Indore, Madhya Pradesh', lat: 22.6983, lng: 75.8398 },
  { placeId: 'indore_11', name: 'Khajrana', area: 'Khajrana, Indore, Madhya Pradesh', description: 'Khajrana, Indore, Madhya Pradesh', lat: 22.7297, lng: 75.9084 },
  { placeId: 'indore_12', name: 'LIG Colony', area: 'LIG Colony, Indore, Madhya Pradesh', description: 'LIG Colony, Indore, Madhya Pradesh', lat: 22.7391, lng: 75.8856 },
  { placeId: 'indore_13', name: 'Chappan Dukan', area: 'Chappan Dukan, New Palasia, Indore, Madhya Pradesh', description: 'Chappan Dukan, New Palasia, Indore, Madhya Pradesh', lat: 22.7247, lng: 75.8805 },
  { placeId: 'indore_14', name: 'Rajendra Nagar', area: 'Rajendra Nagar, Indore, Madhya Pradesh', description: 'Rajendra Nagar, Indore, Madhya Pradesh', lat: 22.6738, lng: 75.8315 },
  { placeId: 'indore_15', name: 'Khandwa Road', area: 'Khandwa Road, Indore, Madhya Pradesh', description: 'Khandwa Road, Indore, Madhya Pradesh', lat: 22.6782, lng: 75.8724 },
  { placeId: 'indore_16', name: 'Bengali Square', area: 'Bengali Square, Indore, Madhya Pradesh', description: 'Bengali Square, Indore, Madhya Pradesh', lat: 22.7161, lng: 75.9103 },
  { placeId: 'indore_17', name: 'Geeta Bhawan', area: 'Geeta Bhawan, AB Road, Indore, Madhya Pradesh', description: 'Geeta Bhawan, Indore, Madhya Pradesh', lat: 22.7188, lng: 75.8812 },
  { placeId: 'indore_18', name: 'Sudama Nagar', area: 'Sudama Nagar, Indore, Madhya Pradesh', description: 'Sudama Nagar, Indore, Madhya Pradesh', lat: 22.6934, lng: 75.8317 },
  { placeId: 'indore_19', name: 'Tilak Nagar', area: 'Tilak Nagar, Indore, Madhya Pradesh', description: 'Tilak Nagar, Indore, Madhya Pradesh', lat: 22.7139, lng: 75.8983 },
  { placeId: 'indore_20', name: 'Rajwada', area: 'Rajwada, Old Indore, Madhya Pradesh', description: 'Rajwada, Indore, Madhya Pradesh', lat: 22.7186, lng: 75.8553 },
  { placeId: 'indore_21', name: 'Nipania', area: 'Nipania, Indore, Madhya Pradesh', description: 'Nipania, Indore, Madhya Pradesh', lat: 22.7725, lng: 75.9189 },
  { placeId: 'indore_22', name: 'Silicon City', area: 'Silicon City, Rau, Indore, Madhya Pradesh', description: 'Silicon City, Indore, Madhya Pradesh', lat: 22.6371, lng: 75.8211 },
  { placeId: 'indore_23', name: 'Bypass Road', area: 'Indore Bypass Road, Madhya Pradesh', description: 'Indore Bypass Road, Madhya Pradesh', lat: 22.7485, lng: 75.9281 }
];

export default function BookingModal({ service, profile, onClose, onSuccess }: Props) {
  // Load saved progress if it exists and matches the current service
  const savedState = useMemo(() => {
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

  // Dates computation for horizontal date picker (Today, Tomorrow, and next 8 days)
  const availableDates = useMemo(() => {
    const dates = [];
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateValue = `${year}-${month}-${day}`;
      
      let label = '';
      let subLabel = '';
      if (i === 0) {
        label = 'Today';
        subLabel = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      } else if (i === 1) {
        label = 'Tomorrow';
        subLabel = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      } else {
        label = d.toLocaleDateString('en-US', { weekday: 'short' });
        subLabel = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      }
      dates.push({ dateValue, label, subLabel });
    }
    return dates;
  }, []);

  const [date, setDate] = useState<string>(
    savedState?.date || availableDates[0]?.dateValue || new Date().toISOString().split('T')[0]
  );
  const [time, setTime] = useState<string>(savedState?.time || '');
  const [address, setAddress] = useState<string>(
    savedState?.address || profile?.address || profile?.customerData?.address || ''
  );
  const [houseNumber, setHouseNumber] = useState<string>(
    savedState?.houseNumber || ''
  );
  const [isChangingAddress, setIsChangingAddress] = useState<boolean>(
    !savedState?.address && !profile?.address && !profile?.customerData?.address
  );
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(
    savedState?.location && typeof savedState.location.lat !== 'undefined' && typeof savedState.location.lng !== 'undefined'
      ? { lat: Number(savedState.location.lat), lng: Number(savedState.location.lng) }
      : { lat: 22.7196, lng: 75.8577 }
  );
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(
    savedState?.location && typeof savedState.location.lat !== 'undefined' && typeof savedState.location.lng !== 'undefined'
      ? { lat: Number(savedState.location.lat), lng: Number(savedState.location.lng) }
      : { lat: 22.7196, lng: 75.8577 }
  );
  const [mapZoom, setMapZoom] = useState(15);
  const [isFetchingGps, setIsFetchingGps] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Address search & autocomplete
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedFromDropdown, setSelectedFromDropdown] = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState<{ placeId: string; name: string; area: string; description: string; lat?: number; lng?: number }[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState(false);

  // Payment Options & Wallet Balance
  // 'cash' = Pay After Service, 'online' = Instant UPI / Cards, 'amc' = AMC Pass
  const [paymentOption, setPaymentOption] = useState<'cash' | 'online' | 'amc'>(
    savedState?.paymentMethod === 'cash' ? 'cash' : (savedState?.paymentMethod === 'online' ? 'online' : 'cash')
  );
  const [useWalletBalance, setUseWalletBalance] = useState<boolean>(false);

  // AMC state
  const [activeAmc, setActiveAmc] = useState<AMC | null>(savedState?.activeAmc || null);
  const [useAmc, setUseAmc] = useState<boolean>(savedState?.useAmc ?? false);

  // Promos & Discounts
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoError, setPromoError] = useState('');
  const [isVerifyingPromo, setIsVerifyingPromo] = useState(false);
  const [availablePromos, setAvailablePromos] = useState<Promotion[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  // Modals & Gateway States
  const [showOnlineGateway, setShowOnlineGateway] = useState<boolean>(false);
  const [onlineBookingAmount, setOnlineBookingAmount] = useState<number>(0);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [lastBookingId, setLastBookingId] = useState<string | null>(null);
  const [showLocalLogin, setShowLocalLogin] = useState<boolean>(false);
  const [showContactPopup, setShowContactPopup] = useState<boolean>(false);
  const [popupEmail, setPopupEmail] = useState('');
  const [popupPhone, setPopupPhone] = useState('');
  const [popupError, setPopupError] = useState<string | null>(null);

  // General Loading & Error
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Submission & Idempotency Refs
  const isSubmittingRef = useRef<boolean>(false);
  const draftBookingIdRef = useRef<string>('');

  const cleanPhoneTo10 = (ph: string) => {
    let cleaned = (ph || '').replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return cleaned.substring(2);
    }
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      return cleaned.substring(1);
    }
    return cleaned.slice(0, 10);
  };

  const [contactEmail, setContactEmail] = useState(profile?.email || '');
  const [contactPhone, setContactPhone] = useState(cleanPhoneTo10(profile?.phoneNumber || profile?.mobile || ''));

  useEffect(() => {
    if (!draftBookingIdRef.current) {
      draftBookingIdRef.current = doc(collection(db, 'bookings')).id;
    }
    return () => {
      draftBookingIdRef.current = '';
      isSubmittingRef.current = false;
    };
  }, [service?.id]);

  const handleModalClose = () => {
    draftBookingIdRef.current = '';
    isSubmittingRef.current = false;
    onClose();
  };

  useEffect(() => {
    if (profile) {
      if (!contactEmail && profile.email) setContactEmail(profile.email);
      const initialPhone = cleanPhoneTo10(profile.phoneNumber || profile.mobile || '');
      if (!contactPhone && initialPhone) setContactPhone(initialPhone);
      if (!address && (profile.address || profile.customerData?.address)) {
        setAddress(profile.address || profile.customerData?.address || '');
      }
    }
  }, [profile]);

  // Real-time busy slots listener
  const [busySlots, setBusySlots] = useState<{ [date: string]: string[] }>({});
  useEffect(() => {
    if (!auth.currentUser) return;

    const today = new Date();
    const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
    const minTimestamp = Timestamp.fromDate(minDate);
    const maxTimestamp = Timestamp.fromDate(maxDate);

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
          
          const year = bookingDateObj.getFullYear();
          const month = String(bookingDateObj.getMonth() + 1).padStart(2, '0');
          const day = String(bookingDateObj.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
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
          handleFirestoreError(err, OperationType.LIST, 'bookings');
        } catch (logErr) {
          console.error("Availability listener query fallback warning:", logErr);
        }
      }
    );

    return () => unsubscribe();
  }, [profile]);

  // Fetch available promotions and active AMC plans
  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      try {
        const qPromos = query(collection(db, 'promotions'), where('active', '==', true), limit(5));
        const promoSnap = await getDocs(qPromos);
        const fetchedPromos = promoSnap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion));
        const customerPromos = fetchedPromos.filter(promo => promo.targetAudience === 'customer' || !promo.targetAudience || promo.targetAudience === 'all');
        setAvailablePromos(customerPromos);

        const qAmc = query(
          collection(db, 'amcs'), 
          where('customerId', '==', profile.uid),
          where('serviceId', '==', service.id),
          where('status', '==', 'active')
        );
        const amcSnap = await getDocs(qAmc);
        if (!amcSnap.empty) {
          const amcData = { id: amcSnap.docs[0].id, ...amcSnap.docs[0].data() } as AMC;
          if (amcData.serviceBookingIds.length < amcData.frequency) {
            setActiveAmc(amcData);
            setUseAmc(true);
            setPaymentOption('amc');
          }
        }
      } catch (err) {
        console.error("Error fetching booking data:", err);
      }
    };
    fetchData();
  }, [profile, service.id]);

  // Eligible verified partners for proximity map view
  const [realEligiblePartners, setRealEligiblePartners] = useState<PartnerProfile[]>([]);
  const [realPartnersNames, setRealPartnersNames] = useState<Record<string, string>>({});
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

  // Synchronize active coupon from offers view
  useEffect(() => {
    if (!appliedPromo && service) {
      try {
        const storedCoupon = localStorage.getItem('activeCoupon');
        if (storedCoupon) {
          const promo = JSON.parse(storedCoupon) as Promotion;
          const isCategoryValid = !promo.applicableCategories || promo.applicableCategories.length === 0 || promo.applicableCategories.includes(service.categoryId);
          const isServiceValid = !promo.applicableServices || promo.applicableServices.length === 0 || promo.applicableServices.includes(service.id);
          if (isCategoryValid && isServiceValid) {
            setAppliedPromo(promo);
          }
        }
      } catch (err) {
        console.warn("Could not read activeCoupon from localStorage:", err);
      }
    }
  }, [service, appliedPromo]);

  // Time Slots Configuration
  const timeSlots = [
    { label: '09:00 AM', value: '09:00' },
    { label: '11:00 AM', value: '11:00' },
    { label: '01:00 PM', value: '13:00' },
    { label: '03:00 PM', value: '15:00' },
    { label: '05:00 PM', value: '17:00' },
    { label: '07:00 PM', value: '19:00' },
  ];

  const getSlotStatus = (slotValue: string, testDate?: string) => {
    const [h] = slotValue.split(':').map(Number);
    if (h > 19) return 'expired';

    const d = testDate || date;
    if (!d) return 'available';
    
    if (busySlots[d] && busySlots[d].includes(slotValue)) {
      return 'expired';
    }
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    if (d > todayStr) return 'available';
    if (d < todayStr) return 'expired';
    
    const [hours, minutes] = slotValue.split(':').map(Number);
    const slotTime = new Date(now);
    slotTime.setHours(hours, minutes, 0, 0);
    
    const diffInMs = slotTime.getTime() - now.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    
    if (diffInHours < 2) return 'expired';
    return 'available';
  };

  const isCurrentDateFullyBooked = date ? timeSlots.every(slot => getSlotStatus(slot.value, date) === 'expired') : false;

  // Auto-select first available slot when date changes
  useEffect(() => {
    if (!time || getSlotStatus(time, date) === 'expired') {
      const firstAvail = timeSlots.find(slot => getSlotStatus(slot.value, date) === 'available');
      if (firstAvail) {
        setTime(firstAvail.value);
      } else {
        setTime('');
      }
    }
  }, [date, busySlots]);

  // Pricing calculations
  const isSurgePricingActive = () => {
    if (profile?.isPremium) return false;
    if (!time) return false;
    if (time === '19:00') return true;
    if (!date) return false;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (date !== todayStr) return false;

    const [h] = time.split(':').map(Number);
    return h >= 19;
  };

  const getSurgeAmount = () => {
    if (profile?.isPremium) return 0;
    return isSurgePricingActive() ? Math.round(service.basePrice * 0.20) : 0;
  };

  const getPrimeDiscountAmount = () => {
    return profile?.isPremium ? Math.round(service.basePrice * 0.15) : 0;
  };

  const getPromoDiscountAmount = () => {
    if (!appliedPromo) return 0;
    const base = service.basePrice + getSurgeAmount() - getPrimeDiscountAmount();
    if (appliedPromo.discountType === 'percent') {
      return Math.round((base * appliedPromo.discountValue) / 100);
    }
    return appliedPromo.discountValue;
  };

  const calculateFinalPrice = () => {
    if (useAmc && activeAmc) return 0;
    let price = service.basePrice + getSurgeAmount() - getPrimeDiscountAmount() - getPromoDiscountAmount();
    return Math.max(0, Math.round(price));
  };

  // Promo code apply
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
        const hasCategoriesList = promoData.applicableCategories && promoData.applicableCategories.length > 0;
        const hasServicesList = promoData.applicableServices && promoData.applicableServices.length > 0;

        if (hasServicesList && !promoData.applicableServices?.includes(service.id)) {
          setPromoError('This code is not valid for this specific service.');
          setAppliedPromo(null);
          return;
        }

        if (hasCategoriesList && !promoData.applicableCategories?.includes(service.categoryId)) {
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
        setPromoInput('');
      }
    } catch (err) {
      console.error('Promo error:', err);
      setPromoError('Failed to verify code.');
    } finally {
      setIsVerifyingPromo(false);
    }
  };

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Dynamic Google Places / Geocoder autocomplete search lookup with local fallback
  useEffect(() => {
    if (address.trim().length < 2 || selectedFromDropdown) {
      if (!selectedFromDropdown) setLiveSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      const q = address.trim().toLowerCase();
      const getLocalSuggestions = () => {
        const filtered = INDORE_FALLBACK_LOCATIONS.filter(item => 
          item.name.toLowerCase().includes(q) || item.area.toLowerCase().includes(q)
        );
        if (filtered.length > 0) return filtered;
        return [{
          placeId: 'indore_custom',
          name: address.trim(),
          area: `${address.trim()}, Indore, Madhya Pradesh`,
          description: `${address.trim()}, Indore, Madhya Pradesh`,
          lat: 22.7196,
          lng: 75.8577
        }];
      };

      setIsSearchingLive(true);

      // 1. Attempt google.maps.Geocoder first
      try {
        if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
          const geocoder = new (window as any).google.maps.Geocoder();
          const queryText = q.includes("indore") ? address : `${address}, Indore, India`;
          const response = await geocoder.geocode({ address: queryText });
          if (response && response.results && response.results.length > 0) {
            const formatted = response.results.slice(0, 5).map((item: any, idx: number) => ({
              placeId: item.place_id || `g_${idx}`,
              name: item.address_components?.[0]?.long_name || item.formatted_address.split(',')[0],
              area: item.formatted_address,
              description: item.formatted_address,
              lat: item.geometry.location.lat(),
              lng: item.geometry.location.lng()
            }));
            setLiveSuggestions(formatted);
            setIsSearchingLive(false);
            return;
          }
        }
      } catch (gErr) {
        console.warn("[Google Geocoder Autocomplete Notice - Non-blocking]:", gErr);
      }

      // 2. Seamless local Indore fallback without rate limits or UI freezing
      setIsSearchingLive(false);
      setLiveSuggestions(getLocalSuggestions());
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [address, selectedFromDropdown]);

  const handleSelectSuggestion = (suggestion: { placeId: string; description: string; name: string; area: string; lat?: number; lng?: number }) => {
    setAddress(suggestion.description);
    setSelectedFromDropdown(true);
    setShowSearchSuggestions(false);
    setIsChangingAddress(false);

    if (suggestion.lat !== undefined && suggestion.lng !== undefined && !isNaN(Number(suggestion.lat)) && !isNaN(Number(suggestion.lng))) {
      const newPos = { lat: Number(suggestion.lat), lng: Number(suggestion.lng) };
      setLocation(newPos);
      setMapCenter(newPos);
      return;
    }

    const indoreCenter = { lat: 22.7196, lng: 75.8577 };
    setLocation(indoreCenter);
    setMapCenter(indoreCenter);
  };

  const reverseGeocodeLocation = async (lat: number, lng: number) => {
    setIsGeocoding(true);

    // 1. Attempt google.maps.Geocoder first
    try {
      if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
        const geocoder = new (window as any).google.maps.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response && response.results && response.results.length > 0) {
          const formatted = response.results[0].formatted_address;
          if (formatted) {
            setAddress(formatted);
            setIsGeocoding(false);
            return true;
          }
        }
      }
    } catch (gErr) {
      console.warn("[Google Geocoder Reverse Notice - Non-blocking]:", gErr);
    }

    // 2. Seamless local Indore landmark fallback (instant, zero network latency, no 429 errors)
    let nearest = INDORE_FALLBACK_LOCATIONS[0];
    let minDistance = 999999;
    for (const loc of INDORE_FALLBACK_LOCATIONS) {
      if (loc.lat && loc.lng) {
        const d = haversineDistance(lat, lng, loc.lat, loc.lng);
        if (d < minDistance) {
          minDistance = d;
          nearest = loc;
        }
      }
    }

    if (nearest) {
      setAddress(`${nearest.name}, Indore, Madhya Pradesh`);
      setIsGeocoding(false);
      return true;
    }

    setAddress(`Indore, Madhya Pradesh (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    setIsGeocoding(false);
    return false;
  };

  // Address Specificity Guard Check
  const isGenericAddress = (
    addr: string, 
    houseNo?: string, 
    coords?: { lat: number; lng: number } | null
  ): boolean => {
    // If coordinates (lat, lng) exist AND the user has entered their House/Flat number, treat the address as 100% valid!
    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number' && houseNo && houseNo.trim().length >= 1) {
      return false;
    }

    const combined = [houseNo?.trim(), addr?.trim()].filter(Boolean).join(', ');
    if (!combined || combined.trim().length < 3) return true;

    const clean = combined.trim().toLowerCase();
    const genericList = [
      'indore',
      'indore, madhya pradesh',
      'indore, madhya pradesh, india',
      'indore, mp',
      'indore, mp, india',
      'madhya pradesh',
      'madhya pradesh, india',
      'india'
    ];
    if (genericList.includes(clean)) return true;

    // If coordinates exist and there is either a house number or an address string
    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number' && ((houseNo && houseNo.trim().length > 0) || addr.trim().length >= 3)) {
      return false;
    }

    const parts = clean.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length < 2 && clean.length < 8) return true;

    return false;
  };

  // Primary CTA Click Trigger
  const handlePrimaryCheckoutClick = () => {
    setError(null);
    setPopupError(null);

    if (!date || !time) {
      setError("Please select a convenient date and time slot for your service.");
      return;
    }

    if (isGenericAddress(address, houseNumber, location)) {
      setIsChangingAddress(true);
      setError("Please enter your Flat / House No. and confirm your area in Indore.");
      return;
    }

    const totalBill = calculateFinalPrice();
    const walletDeduction = useWalletBalance ? Math.min(profile?.walletBalance || 0, totalBill) : 0;
    const remainingDue = Math.max(0, totalBill - walletDeduction);
    const isWalletCoveringAll = useWalletBalance && (profile?.walletBalance || 0) >= totalBill;
    const isPayOnline = paymentOption === 'online' && remainingDue > 0 && !useAmc && !isWalletCoveringAll;

    const emailToUse = contactEmail || profile?.email || '';
    const rawPhone = contactPhone || profile?.phoneNumber || profile?.mobile || '';
    const cleanedPhone = cleanPhoneTo10(rawPhone);

    if (!cleanedPhone || cleanedPhone.length !== 10) {
      setPopupEmail(emailToUse);
      setPopupPhone(cleanedPhone);
      setShowContactPopup(true);
      return;
    }

    setContactEmail(emailToUse);
    setContactPhone(cleanedPhone);

    // If User chose Pay Online: Open full-screen Centralized Payment Gateway Modal
    if (isPayOnline) {
      if (!auth.currentUser) {
        setShowLocalLogin(true);
        setError("Please sign in with your customer account to complete online payment.");
        return;
      }
      setOnlineBookingAmount(remainingDue);
      setShowOnlineGateway(true);
      return;
    }

    // Pay After Service, 100% Wallet, or AMC
    handleBooking(emailToUse, cleanedPhone);
  };

  // Core Booking Execution & Firestore State Machine
  const handleBooking = async (
    overrideEmail?: string, 
    overridePhone?: string,
    onlinePaymentData?: PaymentSuccessData
  ) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setLoading(true);
    setError(null);

    // Authentication Guard
    if (!auth.currentUser) {
      setShowLocalLogin(true);
      setError("Please sign in with an active customer account to confirm your booking.");
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    const activeMode = profile?.currentMode || (localStorage.getItem('zomindia_current_mode') as 'customer' | 'partner') || 'customer';
    if (activeMode === 'partner') {
      setError("Bookings can only be created in Customer Mode. Please switch to Customer Mode to book.");
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    if (isGenericAddress(address, houseNumber, location)) {
      setError("Please enter your Flat / House No. and select your area in Indore.");
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    const emailToUse = (overrideEmail || contactEmail).trim();
    const phoneToUse = (overridePhone || contactPhone).trim();
    const activeUid = auth.currentUser.uid;

    let cleanPhone = phoneToUse.replace(/\D/g, "");
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.substring(2);
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }
    const formattedPrimaryPhone = `+91${cleanPhone}`;
    const emailLower = emailToUse.toLowerCase();

    // Dual-field cross-validation
    try {
      const phoneQ1 = query(collection(db, "users"), where("phoneNumber", "==", formattedPrimaryPhone));
      const phoneQ2 = query(collection(db, "users"), where("mobile", "==", formattedPrimaryPhone));
      const phoneQ3 = query(collection(db, "users"), where("phoneNumber", "==", cleanPhone));
      const phoneQ4 = query(collection(db, "users"), where("mobile", "==", cleanPhone));
      const phoneQ5 = query(collection(db, "users"), where("phoneNumber", "==", `91${cleanPhone}`));
      const phoneQ6 = query(collection(db, "users"), where("mobile", "==", `91${cleanPhone}`));
      const emailQ1 = query(collection(db, "users"), where("email", "==", emailToUse));
      const emailQ2 = query(collection(db, "users"), where("email", "==", emailLower));

      const [pSnap1, pSnap2, pSnap3, pSnap4, pSnap5, pSnap6, eSnap1, eSnap2] = await Promise.all([
        getDocs(phoneQ1),
        getDocs(phoneQ2),
        getDocs(phoneQ3),
        getDocs(phoneQ4),
        getDocs(phoneQ5),
        getDocs(phoneQ6),
        getDocs(emailQ1),
        getDocs(emailQ2)
      ]);

      const phoneDocIds = Array.from(new Set([
        ...pSnap1.docs.map(d => d.id),
        ...pSnap2.docs.map(d => d.id),
        ...pSnap3.docs.map(d => d.id),
        ...pSnap4.docs.map(d => d.id),
        ...pSnap5.docs.map(d => d.id),
        ...pSnap6.docs.map(d => d.id)
      ].filter(id => id !== activeUid)));

      const emailDocIds = Array.from(new Set([
        ...eSnap1.docs.map(d => d.id),
        ...eSnap2.docs.map(d => d.id)
      ].filter(id => id !== activeUid)));

      await runTransaction(db, async (transaction) => {
        for (const docId of phoneDocIds) {
          const docRef = doc(db, "users", docId);
          const snap = await transaction.get(docRef);
          if (snap.exists()) {
            const docEmail = (snap.data().email || "").trim().toLowerCase();
            if (docEmail && docEmail !== emailLower) {
              throw new Error("This mobile number is already linked to another account.");
            }
          }
        }

        for (const docId of emailDocIds) {
          const docRef = doc(db, "users", docId);
          const snap = await transaction.get(docRef);
          if (snap.exists()) {
            const data = snap.data();
            const docPhone = (data.phoneNumber || data.mobile || "").replace(/\D/g, "");
            let cleanDocPhone = docPhone;
            if (cleanDocPhone.length === 12 && cleanDocPhone.startsWith('91')) {
              cleanDocPhone = cleanDocPhone.substring(2);
            } else if (cleanDocPhone.length === 11 && cleanDocPhone.startsWith('0')) {
              cleanDocPhone = cleanDocPhone.substring(1);
            }
            if (cleanDocPhone && cleanDocPhone !== cleanPhone) {
              throw new Error("This email is already associated with another mobile number.");
            }
          }
        }

        const userRef = doc(db, "users", activeUid);
        const userSnap = await transaction.get(userRef);

        const updateData = {
          email: emailToUse,
          phoneNumber: cleanPhone,
          mobile: cleanPhone,
          address: address.trim(),
          updatedAt: Timestamp.now()
        };

        if (userSnap.exists()) {
          transaction.update(userRef, updateData);
        } else {
          transaction.set(userRef, {
            uid: activeUid,
            displayName: profile?.displayName || auth.currentUser?.displayName || "Customer",
            fullName: profile?.fullName || auth.currentUser?.displayName || "Customer",
            role: "customer",
            ...updateData,
            createdAt: Timestamp.now()
          }, { merge: true });
        }
      });
    } catch (transErr: any) {
      console.error("Firestore Transaction Validation Aborted:", transErr);
      setError(transErr.message || "Failed contact validation checks");
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    try {
      const scheduledAt = new Date(`${date}T${time}`);
      const fullAddress = [houseNumber.trim(), address.trim()].filter(Boolean).join(', ');
      const finalPrice = calculateFinalPrice();
      const serviceOtp = Math.floor(1000 + Math.random() * 9000).toString();

      // Partner Auto-Assignment
      let assignedPartnerId: string | null = null;
      try {
        const partnersSnap = await getDocs(collection(db, 'partners'));
        const partners = partnersSnap.docs.map(d => ({ id: d.id, ...d.data() } as PartnerProfile));
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const scheduledDayName = daysOfWeek[scheduledAt.getDay()];

        const eligiblePartners = partners.filter(p => {
          const isCoreEligible = p.isVerified && 
                                 p.status === 'active' && 
                                 p.availabilityStatus !== 'Offline' &&
                                 p.categories.includes(service.categoryId);
          if (!isCoreEligible) return false;

          if (p.workingHours && p.workingHours.length > 0) {
            const daySched = p.workingHours.find(wh => wh.day.toLowerCase() === scheduledDayName.toLowerCase());
            if (daySched && !daySched.enabled) return false;
            if (daySched && daySched.startTime && daySched.endTime && time) {
              const [sHour, sMin] = time.split(':').map(Number);
              const [startHour, startMin] = daySched.startTime.split(':').map(Number);
              const [endHour, endMin] = daySched.endTime.split(':').map(Number);
              const sMinutes = sHour * 60 + sMin;
              const startMinutes = startHour * 60 + startMin;
              const endMinutes = endHour * 60 + endMin;
              if (sMinutes < startMinutes || sMinutes > endMinutes) return false;
            }
          }
          return true;
        });

        if (eligiblePartners.length > 0) {
          const scoredPartners = eligiblePartners.map(p => {
            let score = 0;
            if (p.availabilityStatus === 'Available') score += 150;
            else if (p.availabilityStatus === 'Busy') score += 40;

            let distanceInKm = 9999;
            if (location && p.lat && p.lng) {
              distanceInKm = haversineDistance(location.lat, location.lng, p.lat, p.lng);
              if (distanceInKm <= 2) score += 200;
              else if (distanceInKm <= 5) score += 130;
              else if (distanceInKm <= 10) score += 80;
              else if (distanceInKm <= 20) score += 30;
            }

            const rating = p.rating || 0;
            if (rating >= 4.8) score += 60;
            else if (rating >= 4.5) score += 40;

            return { partner: p, score, distance: distanceInKm };
          });

          scoredPartners.sort((a, b) => b.score - a.score);
          assignedPartnerId = scoredPartners[0].partner.userId;
        }
      } catch (matchErr) {
        console.error("Partner matching failed:", matchErr);
      }

      if (!draftBookingIdRef.current) {
        draftBookingIdRef.current = doc(collection(db, 'bookings')).id;
      }
      const bookingId = draftBookingIdRef.current;
      const bookingRef = doc(db, 'bookings', bookingId);
      setLastBookingId(bookingId);

      const totalBill = finalPrice;
      const walletDeduction = useWalletBalance ? Math.min(profile?.walletBalance || 0, totalBill) : 0;
      const remainingDue = Math.max(0, totalBill - walletDeduction);

      // Strict Payment Status Guard
      const isOnlineConfirmed = Boolean(onlinePaymentData?.txnId && (onlinePaymentData?.amount ?? 0) > 0);
      const isFullyPaidByWallet = walletDeduction > 0 && walletDeduction >= totalBill;
      const isPaid = (useAmc === true || isFullyPaidByWallet || isOnlineConfirmed);
      const resolvedPaymentStatus: 'paid' | 'pay_after_service' = isPaid ? 'paid' : 'pay_after_service';

      let resolvedPaymentMethod: string = 'cash';
      if (useAmc) {
        resolvedPaymentMethod = 'wallet';
      } else if (isOnlineConfirmed) {
        resolvedPaymentMethod = walletDeduction > 0 ? 'wallet+online' : 'online';
      } else if (useWalletBalance) {
        resolvedPaymentMethod = remainingDue > 0 ? `wallet+cash` : 'wallet';
      }

      if (walletDeduction > 0 && profile?.uid) {
        try {
          const uRef = doc(db, 'users', profile.uid);
          await updateDoc(uRef, {
            walletBalance: Math.max(0, (profile.walletBalance || 0) - walletDeduction)
          });
        } catch (walletDeductErr) {
          console.error("Wallet balance deduction write failed:", walletDeductErr);
        }
      }

      let resolvedFullName = auth.currentUser.displayName || profile?.fullName || profile?.customerData?.fullName || profile?.displayName || "Customer";
      let resolvedMobile = cleanPhone || cleanPhoneTo10(profile?.mobile || profile?.phoneNumber || "");
      let resolvedEmail = emailToUse || auth.currentUser.email || profile?.email || "";

      const scheduledSlotStr = `${date} @ ${formatTime12Hour(time)}`;

      const bookingPayload = {
        id: bookingId,
        customerUid: activeUid,
        userId: activeUid,
        customerId: activeUid,
        serviceId: service.id,
        serviceName: service.name,
        serviceType: service.name,
        issueDetails: service.name,
        visitationFee: service.basePrice,
        partnerId: assignedPartnerId,
        status: assignedPartnerId ? "pending_acceptance" : "pending", 
        paymentStatus: resolvedPaymentStatus,
        scheduledAt: Timestamp.fromDate(scheduledAt),
        scheduledSlot: scheduledSlotStr,
        address: fullAddress,
        lat: (location?.lat !== undefined && location?.lat !== null && !isNaN(Number(location.lat))) ? Number(location.lat) : null,
        lng: (location?.lng !== undefined && location?.lng !== null && !isNaN(Number(location.lng))) ? Number(location.lng) : null,
        totalPrice: remainingDue,
        originalBillValue: totalBill,
        paidAmount: isOnlineConfirmed ? onlinePaymentData.amount : (useWalletBalance && remainingDue === 0 ? totalBill : 0),
        walletDeductAmount: walletDeduction,
        discountApplied: useAmc ? service.basePrice : (appliedPromo ? (service.basePrice - finalPrice) : (profile?.isPremium ? getPrimeDiscountAmount() : 0)),
        promoCode: appliedPromo?.code || null,
        paymentMethod: resolvedPaymentMethod,
        isAmcBooking: useAmc,
        amcId: useAmc ? activeAmc?.id : null,
        serviceOtp,
        otpVerified: false,
        customerBookedEmail: resolvedEmail,
        customerBookedPhone: resolvedMobile,
        customerBookedName: resolvedFullName,
        customerName: resolvedFullName,
        customerMobile: resolvedMobile,
        customerData: {
          fullName: resolvedFullName,
          mobile: resolvedMobile,
          email: resolvedEmail
        },
        transactionId: onlinePaymentData?.txnId || null,
        onlinePaymentProvider: onlinePaymentData?.provider || null,
        onlinePaymentMethod: onlinePaymentData?.method || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      try {
        await setDoc(bookingRef, bookingPayload, { merge: true });
      } catch (directWriteErr: any) {
        console.warn("Direct Firestore write notice:", directWriteErr.message);
      }

      // Parallel API trigger
      try {
        await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Customer-Uid': activeUid
          },
          body: JSON.stringify({
            ...bookingPayload,
            bookingId,
            scheduledAtIso: scheduledAt.toISOString()
          })
        });
      } catch (apiErr) {
        console.warn("API trigger note:", apiErr);
      }

      // Clean local storage cache
      try {
        localStorage.removeItem('zomindia_pending_booking');
        localStorage.removeItem('activeCoupon');
      } catch (e) {}

      setShowSuccessModal(true);
    } catch (err: any) {
      console.error("Booking submission error:", err);
      setError(err.message || "Failed to finalize booking. Please try again.");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  if (profile?.role === 'partner') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
        >
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Info size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Partner Account Mode</h3>
          <p className="text-slate-500 text-xs mb-6 leading-relaxed">
            As a registered <b>Service Partner</b>, you cannot book services for yourself. Switch to Customer Mode from your profile menu to book.
          </p>
          <button 
            onClick={handleModalClose}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-blue-700 transition-all cursor-pointer"
          >
            I Understand
          </button>
        </motion.div>
      </div>
    );
  }

  const totalBill = calculateFinalPrice();
  const walletDeduction = useWalletBalance ? Math.min(profile?.walletBalance || 0, totalBill) : 0;
  const finalPayable = Math.max(0, totalBill - walletDeduction);
  const totalSavings = (service.basePrice > finalPayable) ? (service.basePrice - finalPayable) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Dark backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleModalClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm cursor-pointer" 
      />

      {/* Swiggy/Zomato-Style Checkout Sheet Container */}
      <motion.div 
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white w-full max-w-lg sm:max-w-xl rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] z-10"
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Global Error Banner */}
        {error && (
          <div className="bg-rose-600 text-white py-2.5 px-4 text-xs font-bold flex justify-between items-center z-50 shrink-0">
            <span className="flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-rose-700 rounded transition-colors cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0 border border-blue-100">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight leading-tight line-clamp-1">
                  {service.name}
                </h3>
                {service.priceListPDF && (
                  <a 
                    href={service.priceListPDF} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                    title="View Price List"
                  >
                    <FileText size={14} />
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-slate-400"><Clock size={11} /> {service.duration}</span>
                <span>•</span>
                <span className="font-bold text-slate-900">₹{service.basePrice} base</span>
              </p>
            </div>
          </div>
          
          <button 
            onClick={handleModalClose} 
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Close Checkout"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-5 no-scrollbar">
          
          {/* 1. Address Section: Clean Compact Chip with 'Change' toggle */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <div className="p-2 bg-blue-100/80 text-blue-700 rounded-xl mt-0.5 shrink-0">
                  <MapPin size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Service Address
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                      Primary
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 mt-0.5 line-clamp-2 leading-relaxed">
                    {[houseNumber.trim(), address.trim()].filter(Boolean).join(', ') || "No address selected yet. Tap change to set location."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsChangingAddress(!isChangingAddress)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-600 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm shrink-0 cursor-pointer flex items-center gap-1"
              >
                {isChangingAddress ? "Close" : "Change"}
              </button>
            </div>

            {/* Expandable Address Selector / Map Drawer */}
            <AnimatePresence>
              {isChangingAddress && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3.5 pt-3.5 border-t border-slate-200 space-y-3"
                >
                  {/* Dedicated Flat / House No. / Landmark Input */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Flat / House No. / Landmark <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={houseNumber}
                      onChange={(e) => setHouseNumber(e.target.value)}
                      placeholder="e.g. Flat 302, Silver Heights, Near Apollo Hospital"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                    />
                  </div>

                  {/* Area / Locality Search with Autocomplete */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Colony / Area in Indore
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAddress(val);
                          setSelectedFromDropdown(false);
                          setShowSearchSuggestions(val.trim().length >= 2);
                        }}
                        placeholder="Search colony, street, or area in Indore..."
                        className="w-full bg-white border border-slate-300 rounded-xl pl-3.5 pr-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                      />

                      {showSearchSuggestions && !selectedFromDropdown && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 no-scrollbar">
                          {isSearchingLive ? (
                            <div className="p-3 flex items-center gap-2">
                              <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                              <p className="text-xs text-slate-500 font-medium">Searching Indore areas...</p>
                            </div>
                          ) : liveSuggestions.length > 0 ? (
                            liveSuggestions.map((loc, idx) => (
                              <button
                                type="button"
                                key={idx}
                                onClick={() => handleSelectSuggestion(loc)}
                                className="w-full py-2 px-3 text-left hover:bg-slate-50 flex items-center gap-2.5 focus:outline-none cursor-pointer"
                              >
                                <MapPin size={13} className="text-blue-600 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-900 truncate">{loc.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{loc.area}</p>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-xs text-slate-400 italic">Type to search locality...</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GPS Location Button */}
                  <button
                    type="button"
                    disabled={isFetchingGps}
                    onClick={() => {
                      setIsFetchingGps(true);
                      setError(null);
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          async (pos) => {
                            const lat = Number(pos.coords.latitude);
                            const lng = Number(pos.coords.longitude);
                            setLocation({ lat, lng });
                            setMapCenter({ lat, lng });
                            await reverseGeocodeLocation(lat, lng);
                            setIsFetchingGps(false);
                          },
                          () => {
                            setError("Unable to acquire high accuracy GPS. Please search area above.");
                            setIsFetchingGps(false);
                          },
                          { enableHighAccuracy: true, timeout: 8000 }
                        );
                      } else {
                        setIsFetchingGps(false);
                      }
                    }}
                    className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-blue-200 transition-colors cursor-pointer"
                  >
                    <Navigation size={13} className={isFetchingGps ? "animate-spin" : ""} />
                    {isFetchingGps ? "Acquiring GPS location..." : "Use Current GPS Location"}
                  </button>

                  {/* Interactive Map */}
                  <div className="w-full h-36 rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100 shadow-inner">
                    <Map
                      defaultCenter={mapCenter || { lat: 22.7196, lng: 75.8577 }}
                      center={mapCenter || undefined}
                      zoom={mapZoom}
                      onCameraChanged={(e) => {
                        setMapCenter(e.detail.center);
                        setMapZoom(e.detail.zoom);
                      }}
                      defaultZoom={15}
                      mapId={GOOGLE_MAPS_MAP_ID}
                      gestureHandling="greedy"
                      disableDefaultUI={false}
                      zoomControl={true}
                      streetViewControl={false}
                      mapTypeControl={false}
                      className="w-full h-full"
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      onClick={(e) => {
                        if (e.detail?.latLng) {
                          const coords = { lat: Number(e.detail.latLng.lat), lng: Number(e.detail.latLng.lng) };
                          setLocation(coords);
                          setMapCenter(coords);
                          reverseGeocodeLocation(coords.lat, coords.lng);
                        }
                      }}
                    >
                      {location && (
                        <AdvancedMarker 
                          position={location}
                          draggable={true}
                          onDragEnd={(e) => {
                            if (e.latLng) {
                              const coords = { lat: Number(e.latLng.lat()), lng: Number(e.latLng.lng()) };
                              setLocation(coords);
                              setMapCenter(coords);
                              reverseGeocodeLocation(coords.lat, coords.lng);
                            }
                          }}
                        >
                          <Pin background="#2563eb" glyphColor="#fff" borderColor="#1e40af" />
                        </AdvancedMarker>
                      )}
                    </Map>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>💡 Tap map or drag pin to pinpoint doorstep</span>
                    {isGeocoding && <span className="text-blue-600 font-semibold animate-pulse">Resolving location...</span>}
                  </div>

                  {/* Confirm Button */}
                  <button
                    type="button"
                    onClick={() => setIsChangingAddress(false)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    Confirm & Use This Address
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2. Date & Slot Horizontal Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon size={14} className="text-blue-600" />
                Select Date & Time Slot
              </label>
              <span className="text-[10px] text-slate-400 font-medium">9 AM - 7 PM Daily</span>
            </div>

            {/* Horizontal Date Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
              {availableDates.map((d) => {
                const isSelected = date === d.dateValue;
                return (
                  <button
                    key={d.dateValue}
                    type="button"
                    onClick={() => {
                      setDate(d.dateValue);
                      setError(null);
                    }}
                    className={`flex-none py-2 px-3.5 rounded-2xl text-center transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-[#2563EB] border-[#2563EB] text-white shadow-md shadow-blue-500/25 scale-[1.02]"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    <p className={`text-[10px] uppercase font-black tracking-wider leading-tight ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                      {d.label}
                    </p>
                    <p className={`text-xs font-black tracking-tight mt-0.5 ${isSelected ? "text-white" : "text-slate-900"}`}>
                      {d.subLabel}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* 2-Column Clean Time Slots Grid */}
            {date && !isCurrentDateFullyBooked && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {timeSlots.map((slot) => {
                  const status = getSlotStatus(slot.value);
                  const isSelected = time === slot.value;
                  const isExpired = status === 'expired';

                  return (
                    <button
                      key={slot.value}
                      type="button"
                      disabled={isExpired}
                      onClick={() => {
                        if (!isExpired) {
                          setTime(slot.value);
                          setError(null);
                        }
                      }}
                      className={`relative py-2.5 px-3 rounded-xl text-left transition-all border flex items-center justify-between cursor-pointer ${
                        isExpired
                          ? "bg-slate-50 border-slate-100 text-slate-300 opacity-60 cursor-not-allowed"
                          : isSelected
                          ? "bg-blue-50/60 border-2 border-blue-600 text-blue-900 font-bold shadow-sm"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className={isSelected ? "text-blue-600" : isExpired ? "text-slate-300" : "text-slate-400"} />
                        <span className="text-xs font-bold tracking-tight">{slot.label}</span>
                      </div>
                      
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0">
                          ✓
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                          Full
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {date && isCurrentDateFullyBooked && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-800 font-medium">
                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                <span>All slots for this date are booked. Please pick the next date above.</span>
              </div>
            )}
          </div>

          {/* 3. Modern Payment Option Selector (Card Containers) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={14} className="text-blue-600" />
                Payment Method
              </label>
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <ShieldCheck size={12} /> Safe & Verified
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Option 1 (Recommended): Pay After Service */}
              <div
                onClick={() => {
                  setPaymentOption('cash');
                  setUseAmc(false);
                  setError(null);
                }}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  paymentOption === 'cash' && !useAmc
                    ? "border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-500/20"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    paymentOption === 'cash' && !useAmc ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    <Banknote size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Pay After Service</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                        POPULAR
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      Pay via Cash or Pro's QR scanner upon job completion
                    </p>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  paymentOption === 'cash' && !useAmc ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
                }`}>
                  {paymentOption === 'cash' && !useAmc && <Check size={12} />}
                </div>
              </div>

              {/* Option 2: Instant UPI / Cards */}
              <div
                onClick={() => {
                  setPaymentOption('online');
                  setUseAmc(false);
                  setError(null);
                }}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  paymentOption === 'online' && !useAmc
                    ? "border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-500/20"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    paymentOption === 'online' && !useAmc ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    <Zap size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Instant UPI / Cards</span>
                      <span className="bg-blue-100 text-blue-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                        FAST & SECURE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      PhonePe, GPay, Paytm, Cards & NetBanking
                    </p>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  paymentOption === 'online' && !useAmc ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
                }`}>
                  {paymentOption === 'online' && !useAmc && <Check size={12} />}
                </div>
              </div>

              {/* Option 3 (Conditional): Active AMC Pass */}
              {activeAmc && (
                <div
                  onClick={() => {
                    setUseAmc(!useAmc);
                    if (!useAmc) setPaymentOption('amc');
                    else setPaymentOption('cash');
                    setError(null);
                  }}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    useAmc
                      ? "border-emerald-600 bg-emerald-50/60 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      useAmc ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-600"
                    }`}>
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">AMC Maintenance Pass</span>
                        <span className="bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                          FREE COVERAGE
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                        {activeAmc.planName} • {activeAmc.frequency - activeAmc.serviceBookingIds.length} of {activeAmc.frequency} services remaining
                      </p>
                    </div>
                  </div>

                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    useAmc ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"
                  }`}>
                    {useAmc && <Check size={12} />}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Coupons & Promo Codes Section */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tag size={13} className="text-blue-600" />
                <span className="text-xs font-bold text-slate-900">Apply Coupon</span>
              </div>
              {appliedPromo && (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoInput('');
                  }}
                  className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>

            {!appliedPromo ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Enter code (e.g. SAVE20)"
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold uppercase placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                <button
                  type="button"
                  disabled={!promoInput.trim() || isVerifyingPromo}
                  onClick={handleApplyPromo}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isVerifyingPromo ? "..." : "Apply"}
                </button>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold font-mono text-emerald-950 uppercase">{appliedPromo.code} Applied</span>
                    <p className="text-[10px] text-emerald-700 font-semibold">You save ₹{getPromoDiscountAmount()} on this order!</p>
                  </div>
                </div>
              </div>
            )}

            {promoError && (
              <p className="text-[10px] text-rose-600 font-medium">⚠️ {promoError}</p>
            )}

            {/* Available Coupon Chips */}
            {availablePromos.length > 0 && !appliedPromo && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5 no-scrollbar">
                {availablePromos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setAppliedPromo(p);
                      setPromoError('');
                    }}
                    className="flex-none bg-white border border-slate-200 hover:border-blue-400 p-2 rounded-xl text-left cursor-pointer transition-colors"
                  >
                    <span className="bg-blue-50 text-blue-700 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                      {p.code}
                    </span>
                    <p className="text-[10px] font-bold text-slate-800 mt-1">{p.name || `Save ₹${p.discountValue}`}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 5. Itemized Bill Breakdown & Wallet Toggle */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Bill Summary</h4>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-600">Visitation & Inspection Fee</span>
                <span className="font-bold text-slate-900">₹{service.basePrice}</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-600">Convenience & Safety Fee</span>
                <span className="font-bold text-emerald-600 uppercase text-[10px] bg-emerald-50 px-2 py-0.5 rounded">FREE</span>
              </div>

              {isSurgePricingActive() && (
                <div className="flex justify-between items-center pt-2 text-rose-600">
                  <span className="flex items-center gap-1 font-semibold">
                    <Zap size={11} /> Evening Rush Surge (20%)
                  </span>
                  <span className="font-bold">+₹{getSurgeAmount()}</span>
                </div>
              )}

              {profile?.isPremium && (
                <div className="flex justify-between items-center pt-2 text-indigo-600">
                  <span className="font-semibold">Prime Club Discount (15%)</span>
                  <span className="font-bold">-₹{getPrimeDiscountAmount()}</span>
                </div>
              )}

              {appliedPromo && (
                <div className="flex justify-between items-center pt-2 text-emerald-600">
                  <span className="font-semibold">Promo ({appliedPromo.code})</span>
                  <span className="font-bold">-₹{getPromoDiscountAmount()}</span>
                </div>
              )}

              {/* Wallet Balance Toggle */}
              {profile?.walletBalance !== undefined && profile.walletBalance > 0 && !useAmc && (
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Wallet size={14} className="text-blue-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Use Wallet Balance</p>
                      <p className="text-[10px] text-slate-400">₹{profile.walletBalance} available</p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setUseWalletBalance(!useWalletBalance)}
                    className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                      useWalletBalance ? "bg-blue-600" : "bg-slate-200"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      useWalletBalance ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              )}

              {useWalletBalance && walletDeduction > 0 && (
                <div className="flex justify-between items-center pt-2 text-emerald-700">
                  <span className="font-semibold">Wallet Deduction</span>
                  <span className="font-bold">-₹{walletDeduction}</span>
                </div>
              )}
            </div>

            {/* Total Payable Line */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  {useWalletBalance && finalPayable === 0 ? "Paid from Wallet" : "Total Payable"}
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-black text-slate-900 tracking-tight">₹{finalPayable}</span>
                  {service.basePrice > finalPayable && (
                    <span className="text-xs text-slate-400 line-through font-semibold">₹{service.basePrice}</span>
                  )}
                </div>
              </div>

              {totalSavings > 0 && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider">
                  You Save ₹{totalSavings}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 6. Sticky Bottom Confirmation Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white/95 backdrop-blur-md shrink-0 space-y-2.5">
          {/* Trust Chip */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-500">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>100% Satisfaction Guaranteed • Certified Verified Technicians</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="shrink-0 text-left">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Payable</span>
              <span className="text-xl font-black text-slate-900 tracking-tight">₹{finalPayable}</span>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              onClick={handlePrimaryCheckoutClick}
              className="flex-1 py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm tracking-wide uppercase transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:brightness-105 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : useAmc ? (
                <>Confirm Booking • ₹0 →</>
              ) : finalPayable === 0 && useWalletBalance ? (
                <>Pay via Wallet • ₹0 →</>
              ) : paymentOption === 'online' ? (
                <>Proceed to Pay • ₹{finalPayable} 🔒</>
              ) : (
                <>Book Service • Pay After Service →</>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Centralized Online Payment Gateway Checkout Modal */}
      <OnlinePaymentGatewayModal
        isOpen={showOnlineGateway}
        amount={onlineBookingAmount || finalPayable}
        serviceName={service.name}
        customerName={profile?.fullName || 'Customer'}
        customerPhone={contactPhone || profile?.phoneNumber || profile?.mobile || ''}
        customerEmail={contactEmail || profile?.email || ''}
        bookingDetails={{
          date,
          time,
          address
        }}
        onClose={() => {
          setShowOnlineGateway(false);
          setError("Online payment cancelled.");
        }}
        onPaymentCancel={() => {
          setShowOnlineGateway(false);
          setError("Online payment cancelled.");
        }}
        onPaymentSuccess={async (paymentData) => {
          setShowOnlineGateway(false);
          await handleBooking(contactEmail, contactPhone, paymentData);
        }}
      />

      {/* Contact verification popup if mobile is missing */}
      <AnimatePresence>
        {showContactPopup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowContactPopup(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl z-10 text-center"
            >
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Confirm Mobile Number</h3>
              <p className="text-xs text-slate-500 mb-5">Your technician will call you on this number upon arrival.</p>

              {popupError && (
                <div className="mb-4 p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold text-left">
                  {popupError}
                </div>
              )}

              <div className="space-y-3 text-left">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">10-Digit Mobile *</label>
                  <input
                    type="tel"
                    value={popupPhone}
                    onChange={(e) => {
                      setPopupPhone(cleanPhoneTo10(e.target.value));
                      setPopupError(null);
                    }}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={popupEmail}
                    onChange={(e) => setPopupEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowContactPopup(false)}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    const phone = cleanPhoneTo10(popupPhone);
                    if (phone.length !== 10) {
                      setPopupError("Please provide a valid 10-digit mobile number.");
                      return;
                    }
                    setContactPhone(phone);
                    setContactEmail(popupEmail.trim());
                    setShowContactPopup(false);
                    if (paymentOption === 'online' && finalPayable > 0 && !useAmc) {
                      setOnlineBookingAmount(finalPayable);
                      setShowOnlineGateway(true);
                    } else {
                      handleBooking(popupEmail.trim(), phone);
                    }
                  }}
                  className="py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl uppercase tracking-wide transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:brightness-105 active:scale-[0.98] cursor-pointer"
                >
                  {loading ? "..." : "Verify & Book"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal Trigger */}
      {showLocalLogin && (
        <AuthModal
          isOpen={showLocalLogin}
          onClose={() => setShowLocalLogin(false)}
          onSuccess={() => {
            setShowLocalLogin(false);
            handlePrimaryCheckoutClick();
          }}
        />
      )}

      {/* Booking Success Confirmation Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowSuccessModal(false);
                onSuccess();
                handleModalClose();
              }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center z-10 flex flex-col items-center border border-slate-100"
            >
              <button 
                onClick={() => {
                  setShowSuccessModal(false);
                  onSuccess();
                  handleModalClose();
                }}
                className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3 border border-emerald-100 shadow-inner">
                <CheckCircle2 size={32} />
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full mb-2">
                Booking Confirmed
              </span>

              <h3 className="text-xl font-bold text-slate-900 mb-1 tracking-tight">
                You're all set!
              </h3>

              <p className="text-xs text-slate-500 mb-4 leading-relaxed px-2">
                Your service for <strong className="text-slate-800 font-bold">{service.name}</strong> is confirmed. A verified expert will arrive at your doorstep.
              </p>

              <div className="w-full bg-slate-50 rounded-2xl p-3.5 border border-slate-100 text-left space-y-2 mb-4 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Slot</span>
                  <span className="font-bold text-slate-900">{date} @ {formatTime12Hour(time)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Address</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[170px]" title={address}>{address}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Payable</span>
                  <span className="font-bold text-blue-600">₹{finalPayable}</span>
                </div>
              </div>

              <div className="w-full space-y-2">
                {(() => {
                  const startD = new Date(`${date}T${time}`);
                  const endD = new Date(startD.getTime() + 60 * 60 * 1000);
                  const calUrl = generateGoogleCalendarUrl({
                    title: `ZomIndia: ${service.name}`,
                    startDate: isNaN(startD.getTime()) ? new Date() : startD,
                    endDate: isNaN(endD.getTime()) ? new Date(Date.now() + 3600000) : endD,
                    description: `ZomIndia Service Booking for ${service.name}`,
                    location: address
                  });
                  const waUrl = getWhatsAppBookingLink(lastBookingId || 'ZOMINDIA', service.name, date, time);

                  return (
                    <>
                      <a 
                        href={calUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-slate-200"
                      >
                        <CalendarIcon size={14} /> Add to Google Calendar
                      </a>

                      {waUrl && (
                        <a 
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <MessageCircle size={14} /> Share on WhatsApp
                        </a>
                      )}
                    </>
                  );
                })()}

                <button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    onSuccess();
                    handleModalClose();
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-wide transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:brightness-105 active:scale-[0.98] mt-1 cursor-pointer"
                >
                  Done & View Dashboard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
