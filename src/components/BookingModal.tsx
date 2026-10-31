import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  collection, 
  Timestamp, 
  query, 
  where, 
  getDocs, 
  limit, 
  doc, 
  setDoc, 
  addDoc,
  updateDoc,
  arrayUnion,
  onSnapshot, 
  runTransaction 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Service, UserProfile, Promotion, PartnerProfile, AMC, SavedAddress } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { formatTime12Hour } from '../utils/formatTime';
import AuthModal from './AuthModal';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Clock, 
  MapPin, 
  CreditCard,
  Calendar as CalendarIcon,
  CheckCircle2,
  Navigation,
  FileText,
  AlertCircle,
  Tag,
  ShieldCheck,
  Check,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { reverseGeocode, isBroadIndoreName } from '../utils/reverseGeocode';
import DoorstepPinPickerModal from './DoorstepPinPickerModal';
import { playOrderSuccessSound, playNotificationPop } from '../services/soundService';
import BookingSuccessAnimation from './animations/BookingSuccessAnimation';

export interface PaymentSuccessData {
  txnId: string;
  method: 'upi' | 'card' | 'netbanking' | 'wallet' | 'online' | 'razorpay';
  provider: string;
  amount: number;
  paidAt: string;
}

const API_ORIGIN =
  typeof window !== 'undefined' &&
  window.location.origin.startsWith('http') &&
  !window.location.origin.includes('localhost')
    ? ''
    : 'https://zomindia.com';

const FALLBACK_KEY = 'rzp_test_TtEKda956Cny9Q';

export const loadRazorpaySDK = (): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined') return resolve(false);
      if (typeof (window as any).Razorpay === 'function') return resolve(true);
      const existingScript = document.querySelector(
        'script[src*="checkout.razorpay.com/v1/checkout.js"]'
      ) as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => resolve(false));
        setTimeout(() => resolve(typeof (window as any).Razorpay === 'function'), 4000);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      (document.body || document.head || document.documentElement).appendChild(script);
    } catch {
      resolve(false);
    }
  });
};

interface Props {
  service: Service;
  profile: UserProfile | null;
  onClose: () => void;
  onSuccess: (bookingId?: string) => void;
}

const INDORE_QUICK_LOCALITIES = [
  'Vijay Nagar',
  'Palasia',
  'Scheme 54',
  'Bhanwarkua',
  'Mahalaxmi Nagar',
  'Saket',
  'Annapurna'
] as const;

export const DEFAULT_INDORE_CENTER = { lat: 22.7196, lng: 75.8577 };

export const LOCALITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Vijay Nagar': { lat: 22.7533, lng: 75.8937 },
  'Palasia': { lat: 22.7244, lng: 75.8839 },
  'Scheme 54': { lat: 22.7540, lng: 75.8950 },
  'Bhanwarkua': { lat: 22.6926, lng: 75.8676 },
  'Mahalaxmi Nagar': { lat: 22.7627, lng: 75.9038 },
  'Saket': { lat: 22.7215, lng: 75.8988 },
  'Annapurna': { lat: 22.6983, lng: 75.8398 }
};

const TIME_SLOTS = [
  { label: '09:00 AM', value: '09:00' },
  { label: '11:00 AM', value: '11:00' },
  { label: '01:00 PM', value: '13:00' },
  { label: '03:00 PM', value: '15:00' },
  { label: '05:00 PM', value: '17:00' },
  { label: '07:00 PM', value: '19:00' },
];

export default function BookingModal({ service, profile, onClose, onSuccess }: Props) {
  // Load saved progress if it exists and matches the current service
  const savedState = useMemo(() => {
    try {
      const raw = localStorage.getItem('zomindia_pending_booking');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.address?.toLowerCase().includes('lasuriamori') || saved?.address?.toLowerCase().includes('singapore')) {
          localStorage.removeItem('zomindia_pending_booking');
          return null;
        }
        if (saved && saved.serviceId === service.id) {
          return saved;
        }
      }
    } catch (e) {
      console.warn("Failed to retrieve pending booking progress:", e);
    }
    return null;
  }, [service.id]);

  // Clean date computation: Today, Tomorrow, Custom
  const now = useMemo(() => new Date(), []);
  
  const todayDateObj = useMemo(() => {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, [now]);

  const tomorrowDateObj = useMemo(() => {
    const d = new Date(todayDateObj);
    d.setDate(todayDateObj.getDate() + 1);
    return d;
  }, [todayDateObj]);

  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatShortDisplay = (d: Date) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const todayKey = useMemo(() => formatDateKey(todayDateObj), [todayDateObj]);
  const tomorrowKey = useMemo(() => formatDateKey(tomorrowDateObj), [tomorrowDateObj]);
  const todayDisplay = useMemo(() => formatShortDisplay(todayDateObj), [todayDateObj]);
  const tomorrowDisplay = useMemo(() => formatShortDisplay(tomorrowDateObj), [tomorrowDateObj]);

  // Saved user addresses from profile (filtering out any stale Lasuriamori cache)
  const userSavedAddresses = useMemo<SavedAddress[]>(() => {
    const list: SavedAddress[] = [];
    if (Array.isArray(profile?.savedAddresses) && profile.savedAddresses.length > 0) {
      const cleanSaved = profile.savedAddresses.filter(
        (a) => a?.address && !a.address.toLowerCase().includes('lasuriamori')
      );
      if (cleanSaved.length > 0) {
        return cleanSaved;
      }
    }
    const profileAddr = profile?.address || profile?.customerData?.address;
    if (profileAddr && !isBroadIndoreName(profileAddr) && !profileAddr.toLowerCase().includes('lasuriamori')) {
      list.push({
        id: 'profile_home_default',
        tag: 'Home',
        houseNumber: (profile as any)?.houseNumber || '',
        address: profileAddr,
        city: 'Indore',
        fullAddress: [(profile as any)?.houseNumber, profileAddr].filter(Boolean).join(', '),
        lat: profile?.customerLocation?.lat,
        lng: profile?.customerLocation?.lng,
        isDefault: true
      });
    }
    return list;
  }, [profile]);

  const latestUserSavedAddress = userSavedAddresses.length > 0
    ? userSavedAddresses[userSavedAddresses.length - 1]
    : null;

  // Address states
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(() => {
    return latestUserSavedAddress?.id || null;
  });
  const [addressTag, setAddressTag] = useState<'Home' | 'Work' | 'Other'>(() => {
    return latestUserSavedAddress?.tag || 'Home';
  });

  const cachedSelectedLocation = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const loc = localStorage.getItem('zomindia_selected_location') || '';
    if (loc.toLowerCase().includes('lasuriamori') || loc.toLowerCase().includes('singapore')) {
      localStorage.removeItem('zomindia_selected_location');
      return '';
    }
    return loc;
  }, []);

  const cachedHouseNo = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('zomindia_selected_houseno') || '';
  }, []);

  const cachedCoords = useMemo<{ lat: number; lng: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('zomindia_selected_coords');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
          return { lat: Number(parsed.lat), lng: Number(parsed.lng) };
        }
      }
    } catch {}
    return null;
  }, []);

  const rawCandidateAddress =
    savedState?.address ||
    (profile?.address && !profile.address.toLowerCase().includes('lasuriamori') ? profile.address : '') ||
    latestUserSavedAddress?.address ||
    (profile?.customerData?.address && !profile.customerData.address.toLowerCase().includes('lasuriamori') ? profile.customerData.address : '') ||
    cachedSelectedLocation ||
    'Palasia / City Center, Indore';

  const initialAddress = (!rawCandidateAddress || isBroadIndoreName(rawCandidateAddress) || rawCandidateAddress.toLowerCase().includes('lasuriamori'))
    ? 'Palasia / City Center, Indore'
    : rawCandidateAddress;

  const [address, setAddress] = useState<string>(initialAddress);
  const [houseNumber, setHouseNumber] = useState<string>(
    savedState?.houseNumber ||
    (profile as any)?.houseNumber ||
    latestUserSavedAddress?.houseNumber ||
    cachedHouseNo ||
    ''
  );

  // Exact Customer GPS Coordinates State
  const initialCustomerCoords = useMemo<{ lat: number; lng: number } | null>(() => {
    if (savedState?.customerLocation?.lat && savedState?.customerLocation?.lng) {
      return { lat: Number(savedState.customerLocation.lat), lng: Number(savedState.customerLocation.lng) };
    }
    if (savedState?.lat && savedState?.lng) {
      return { lat: Number(savedState.lat), lng: Number(savedState.lng) };
    }
    if (profile?.customerLocation?.lat && profile?.customerLocation?.lng) {
      return { lat: Number(profile.customerLocation.lat), lng: Number(profile.customerLocation.lng) };
    }
    if (latestUserSavedAddress?.lat && latestUserSavedAddress?.lng) {
      return { lat: Number(latestUserSavedAddress.lat), lng: Number(latestUserSavedAddress.lng) };
    }
    if (cachedCoords?.lat && cachedCoords?.lng) {
      return cachedCoords;
    }
    for (const [key, coords] of Object.entries(LOCALITY_COORDS)) {
      if (initialAddress.toLowerCase().includes(key.toLowerCase())) {
        return coords;
      }
    }
    return DEFAULT_INDORE_CENTER;
  }, [savedState, profile, latestUserSavedAddress, cachedCoords, initialAddress]);

  const hasVerifiedSavedCoords = Boolean(
    (profile?.customerLocation?.lat && profile?.customerLocation?.lng) ||
    (latestUserSavedAddress?.lat && latestUserSavedAddress?.lng) ||
    (cachedCoords?.lat && cachedCoords?.lng && cachedSelectedLocation)
  );

  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(initialCustomerCoords);
  const [showAddressPicker, setShowAddressPicker] = useState<boolean>(false);
  const [showMapPickerModal, setShowMapPickerModal] = useState<boolean>(false);
  const [isDoorstepLocked, setIsDoorstepLocked] = useState<boolean>(hasVerifiedSavedCoords);
  const [isFetchingGps, setIsFetchingGps] = useState(false);

  // Reactive Profile Address Sync when Firestore profile resolves
  useEffect(() => {
    // If user already pinned a doorstep in this active modal session, do not overwrite
    if (isDoorstepLocked) return;

    const validSaved = Array.isArray(profile?.savedAddresses)
      ? profile.savedAddresses.filter(a => a?.address && !a.address.toLowerCase().includes('lasuriamori'))
      : [];
    const latestFromList = validSaved.length > 0 ? validSaved[validSaved.length - 1] : null;

    const savedProfileAddr = (profile?.address && !profile.address.toLowerCase().includes('lasuriamori') ? {
      address: profile.address,
      houseNumber: (profile as any)?.houseNumber || latestFromList?.houseNumber || '',
      lat: profile?.customerLocation?.lat ?? latestFromList?.lat,
      lng: profile?.customerLocation?.lng ?? latestFromList?.lng
    } : null) || latestFromList || profile?.savedAddresses?.[0];

    if (savedProfileAddr && savedProfileAddr.address && !savedProfileAddr.address.toLowerCase().includes('lasuriamori')) {
      setAddress(savedProfileAddr.address);
      if (savedProfileAddr.houseNumber) setHouseNumber(savedProfileAddr.houseNumber);
      if (savedProfileAddr.lat && savedProfileAddr.lng) {
        setCustomerCoords({ lat: Number(savedProfileAddr.lat), lng: Number(savedProfileAddr.lng) });
        setIsDoorstepLocked(true);
      }
    }
  }, [profile]);

  // Slot picker state: default date is todayKey
  const [date, setDate] = useState<string>(savedState?.date || todayKey);
  const [time, setTime] = useState<string>(savedState?.time || '');
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Payment Option: Default is 'cash' ("Pay After Service")
  const [paymentOption, setPaymentOption] = useState<'cash' | 'online'>(
    savedState?.paymentMethod === 'online' ? 'online' : 'cash'
  );

  // Promo state: single sleek collapsible row
  const [showCouponInput, setShowCouponInput] = useState<boolean>(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoError, setPromoError] = useState('');
  const [isVerifyingPromo, setIsVerifyingPromo] = useState(false);
  const [availablePromos, setAvailablePromos] = useState<Promotion[]>([]);

  // AMC state
  const [activeAmc, setActiveAmc] = useState<AMC | null>(savedState?.activeAmc || null);
  const [useAmc, setUseAmc] = useState<boolean>(savedState?.useAmc ?? false);

  // Local auth modal state
  const [showLocalLogin, setShowLocalLogin] = useState<boolean>(false);

  // Loading & error
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);

  // Submissions & Idempotency Refs
  const isSubmittingRef = useRef<boolean>(false);
  const draftBookingIdRef = useRef<string>('');

  const cleanPhoneTo10 = (ph: string) => {
    let cleaned = (ph || '').replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.substring(2);
    if (cleaned.length === 11 && cleaned.startsWith('0')) return cleaned.substring(1);
    return cleaned.slice(0, 10);
  };

  const contactEmail = profile?.email || auth.currentUser?.email || '';
  const contactPhone = cleanPhoneTo10(profile?.phoneNumber || profile?.mobile || '');

  useEffect(() => {
    if (!draftBookingIdRef.current) {
      draftBookingIdRef.current = doc(collection(db, 'bookings')).id;
    }
    return () => {
      draftBookingIdRef.current = '';
      isSubmittingRef.current = false;
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'unset';
      }
    };
  }, [service?.id]);

  // Ensure body scroll is always restored on unmount
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'unset';
      }
    };
  }, []);

  const handleModalClose = () => {
    draftBookingIdRef.current = '';
    isSubmittingRef.current = false;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'unset';
    }
    onClose();
  };


  // Fetch available promos & AMC plans
  useEffect(() => {
    const fetchData = async () => {
      try {
        const qPromos = query(collection(db, 'promotions'), where('active', '==', true), limit(4));
        const promoSnap = await getDocs(qPromos);
        const fetchedPromos = promoSnap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion));
        setAvailablePromos(fetchedPromos);

        if (profile?.uid) {
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
            }
          }
        }
      } catch (err) {
        console.warn("Booking aux data fetch notice:", err);
      }
    };
    fetchData();
  }, [profile, service.id]);

  // Synchronize active coupon from offers view if stored in localStorage
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
        console.warn("Active coupon read notice:", err);
      }
    }
  }, [service, appliedPromo]);

  // Slot status helper: purely time-based 2-hour advance buffer
  const getSlotStatus = (slotValue: string, testDate?: string): 'available' | 'expired' => {
    const d = testDate || date;
    if (!d) return 'available';

    const now = new Date();
    const todayStr = formatDateKey(now);

    // Any future date (Tomorrow or beyond): 100% of slots are available
    if (d > todayStr) return 'available';
    // Past dates: expired
    if (d < todayStr) return 'expired';

    // For "Today": Enforce strict 2-hour advance buffer for technician prep & travel
    const [hours, minutes] = slotValue.split(':').map(Number);
    const slotDateObj = new Date(now);
    slotDateObj.setHours(hours, minutes, 0, 0);

    const diffInHours = (slotDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Slot must be at least 2.0 hours ahead of the current minute
    return diffInHours >= 2.0 ? 'available' : 'expired';
  };

  // SMART DEFAULT: Auto-select earliest available slot when date changes
  useEffect(() => {
    if (!time || getSlotStatus(time, date) === 'expired') {
      const firstAvailable = TIME_SLOTS.find(slot => getSlotStatus(slot.value, date) === 'available');
      if (firstAvailable) {
        setTime(firstAvailable.value);
      } else {
        // If today has no remaining slots, automatically jump to tomorrow
        if (date === todayKey) {
          setDate(tomorrowKey);
        } else {
          setTime('');
        }
      }
    }
  }, [date, todayKey, tomorrowKey]);

  // Base pricing is 100% transparent and flat. NO hidden surges!
  const getPrimeDiscountAmount = () => {
    return profile?.isPremium ? Math.round(service.basePrice * 0.15) : 0;
  };

  const getPromoDiscountAmount = () => {
    if (!appliedPromo) return 0;
    const base = service.basePrice - getPrimeDiscountAmount();
    if (appliedPromo.discountType === 'percent') {
      return Math.round((base * appliedPromo.discountValue) / 100);
    }
    return Math.min(base, appliedPromo.discountValue);
  };

  const calculateFinalPrice = () => {
    if (useAmc && activeAmc) return 0;
    const price = service.basePrice - getPrimeDiscountAmount() - getPromoDiscountAmount();
    return Math.max(0, Math.round(price));
  };

  const finalPayable = calculateFinalPrice();
  const totalDiscount = (service.basePrice > finalPayable) ? (service.basePrice - finalPayable) : 0;

  // Promo code apply handler
  const handleApplyPromo = async (codeToTry?: string) => {
    const code = (codeToTry || promoInput).trim().toUpperCase();
    if (!code) return;
    setIsVerifyingPromo(true);
    setPromoError('');
    try {
      const q = query(
        collection(db, 'promotions'), 
        where('code', '==', code),
        where('active', '==', true),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        // Fallback for demo coupons like ZOMFIRST15, CLEAN15, FIXIT250
        if (code === 'ZOMFIRST15') {
          setAppliedPromo({
            id: 'promo_zomfirst15',
            code: 'ZOMFIRST15',
            name: '15% First Order Special',
            discountType: 'percent',
            discountValue: 15,
            active: true
          } as Promotion);
          setPromoInput('');
          setShowCouponInput(false);
          setIsVerifyingPromo(false);
          return;
        }
        setPromoError('Invalid or expired promo code.');
      } else {
        const promoData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Promotion;
        setAppliedPromo(promoData);
        setPromoInput('');
        setShowCouponInput(false);
      }
    } catch (err) {
      console.warn("Promo verification notice:", err);
      setPromoError('Failed to verify code.');
    } finally {
      setIsVerifyingPromo(false);
    }
  };

  // GPS Interactive Doorstep Pin Picker Trigger
  const handleUseGps = () => {
    setShowAddressPicker(false);
    setShowMapPickerModal(true);
  };

  const handleConfirmDoorstep = (confirmed: {
    coords: { lat: number; lng: number };
    address: string;
    houseNumber: string;
    tag: 'Home' | 'Work' | 'Other';
    fullAddress: string;
  }) => {
    setCustomerCoords(confirmed.coords);
    setAddress(confirmed.address);
    setHouseNumber(confirmed.houseNumber);
    setAddressTag(confirmed.tag);
    setIsDoorstepLocked(true);
    setShowAddressPicker(false);

    if (auth.currentUser?.uid) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const homeAddressObj = {
          id: `addr_${Date.now()}`,
          tag: confirmed.tag || 'Home',
          houseNumber: confirmed.houseNumber || '',
          address: confirmed.address,
          city: 'Indore',
          fullAddress: [confirmed.houseNumber, confirmed.address].filter(Boolean).join(', '),
          lat: confirmed.coords.lat,
          lng: confirmed.coords.lng,
          isDefault: true,
          updatedAt: new Date().toISOString()
        };

        updateDoc(userRef, {
          address: confirmed.address,
          houseNumber: confirmed.houseNumber,
          customerLocation: confirmed.coords,
          'customerData.address': confirmed.address,
          'customerData.houseNumber': confirmed.houseNumber,
          'customerData.customerLocation': confirmed.coords,
          savedAddresses: arrayUnion(homeAddressObj)
        }).catch((err) => console.warn("Background address profile update failed:", err));
      } catch (err) {
        console.warn("Firestore updateDoc error:", err);
      }
    }

    // Also persist to localStorage for instant local retrieval
    try {
      if (typeof window !== 'undefined' && confirmed.address) {
        localStorage.setItem('zomindia_selected_location', confirmed.address);
        localStorage.setItem('zomindia_selected_houseno', confirmed.houseNumber || '');
        localStorage.setItem('zomindia_selected_coords', JSON.stringify(confirmed.coords));
      }
    } catch {}
  };

  // Direct 1-Tap Official Razorpay Standard Checkout Trigger
  const initiateDirectRazorpayCheckout = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const sdkLoaded = await loadRazorpaySDK();
      if (!sdkLoaded || typeof (window as any).Razorpay !== 'function') {
        const msg = 'Unable to load Razorpay payment gateway. Please check your connection or choose Pay After Service.';
        setError(msg);
        if (typeof (window as any).__showToast === 'function') {
          (window as any).__showToast(msg);
        }
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      const bookingId = draftBookingIdRef.current || doc(collection(db, 'bookings')).id;
      draftBookingIdRef.current = bookingId;

      const resolvedFullName = profile?.fullName || profile?.displayName || auth.currentUser?.displayName || 'Customer';
      const resolvedPhone = contactPhone || profile?.phoneNumber || profile?.mobile || '9876543210';
      const resolvedEmail = (contactEmail && !contactEmail.includes('customer@zomindia.com'))
        ? contactEmail
        : `${resolvedPhone.replace(/\D/g, '') || 'customer'}@phone.zomindia.com`;

      let orderData: any = null;
      try {
        const orderRes = await fetch(`${API_ORIGIN}/api/razorpay/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: finalPayable,
            currency: 'INR',
            bookingId,
            customerName: resolvedFullName,
            customerPhone: resolvedPhone,
            customerEmail: resolvedEmail,
            serviceName: service.name
          })
        });
        const rawOrderText = await orderRes.text();
        orderData = rawOrderText ? JSON.parse(rawOrderText) : null;
      } catch {
        orderData = null;
      }

      const clientKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;
      const effectiveKey =
        orderData?.keyId && !String(orderData.keyId).includes('placeholder')
          ? orderData.keyId
          : clientKey && !String(clientKey).includes('placeholder')
          ? clientKey
          : FALLBACK_KEY;

      const options: Record<string, any> = {
        key: effectiveKey,
        amount: orderData?.amount || Math.round(finalPayable * 100),
        currency: orderData?.currency || 'INR',
        name: 'Zomindia Services',
        description: `${service.name} • #${bookingId.slice(-6).toUpperCase()}`,
        ...(orderData?.orderId ? { order_id: orderData.orderId } : {}),
        prefill: {
          name: resolvedFullName,
          contact: resolvedPhone,
          email: resolvedEmail
        },
        theme: {
          color: '#2563eb'
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            isSubmittingRef.current = false;
          }
        },
        handler: async (response: any) => {
          try {
            if (!response?.razorpay_payment_id) {
              throw new Error('Incomplete payment response from Razorpay.');
            }

            if (response.razorpay_order_id && response.razorpay_signature) {
              const verifyRes = await fetch(`${API_ORIGIN}/api/razorpay/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  bookingId,
                  customerUid: auth.currentUser?.uid || profile?.uid || 'customer',
                  amount: finalPayable,
                  isMock: false,
                  status: 'confirmed'
                })
              });

              const rawVerifyText = await verifyRes.text();
              let verifyData: any = null;
              try {
                verifyData = rawVerifyText ? JSON.parse(rawVerifyText) : null;
              } catch {
                verifyData = null;
              }

              if (!verifyRes.ok || !verifyData?.success) {
                throw new Error(verifyData?.error || 'Payment signature verification failed.');
              }
            }

            isSubmittingRef.current = false;
            await handleBooking({
              txnId: response.razorpay_payment_id,
              method: 'razorpay',
              provider: 'Razorpay',
              amount: finalPayable,
              paidAt: new Date().toISOString()
            });
          } catch (verifyErr: any) {
            const verifyMsg = verifyErr?.message || 'Payment verification failed. Please contact support if amount was debited.';
            setError(verifyMsg);
            if (typeof (window as any).__showToast === 'function') {
              (window as any).__showToast(verifyMsg);
            }
            setLoading(false);
            isSubmittingRef.current = false;
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        const failMsg = response?.error?.description || 'Payment was declined or cancelled. You can retry or select Pay After Service.';
        setError(failMsg);
        setLoading(false);
        isSubmittingRef.current = false;
      });
      rzp.open();
    } catch (err: any) {
      const errMsg = err?.message || 'Unable to initiate online payment. Please retry or select Pay After Service.';
      setError(errMsg);
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Primary Checkout Trigger
  const handlePrimaryCheckoutClick = () => {
    setError(null);

    if (!time) {
      setError("Please select a time slot for your service.");
      return;
    }

    if (!address.trim()) {
      setShowAddressPicker(true);
      setError("Please select or enter your service delivery address.");
      return;
    }

    if (paymentOption === 'online' && finalPayable > 0 && !useAmc) {
      if (!auth.currentUser) {
        setShowLocalLogin(true);
        setError("Please sign in to proceed with online payment.");
        return;
      }
      initiateDirectRazorpayCheckout();
      return;
    }

    // Default 1-Tap checkout: Pay After Service
    handleBooking();
  };

  // Core Booking Execution & Firestore State Machine
  const handleBooking = async (onlinePaymentData?: PaymentSuccessData) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setLoading(true);
    setError(null);

    // Authentication Guard
    if (!auth.currentUser) {
      setShowLocalLogin(true);
      setError("Please sign in with your customer account to confirm your booking.");
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    const activeUid = auth.currentUser.uid;
    const fullAddress = [houseNumber.trim(), address.trim()].filter(Boolean).join(', ') || 'Palasia / City Center, Indore';

    // Partner auto-assignment
    let assignedPartnerId: string | null = null;
    try {
      const partnersSnap = await getDocs(collection(db, 'partners'));
      const partners = partnersSnap.docs.map(d => ({ id: d.id, ...d.data() } as PartnerProfile));
      const eligible = partners.filter(p => p.isVerified && p.status === 'active' && p.categories.includes(service.categoryId));
      if (eligible.length > 0) {
        assignedPartnerId = eligible[0].id;
      }
    } catch (partnerErr) {
      console.warn("Partner assignment non-blocking note:", partnerErr);
    }

    try {
      const bookingId = draftBookingIdRef.current || doc(collection(db, 'bookings')).id;
      draftBookingIdRef.current = bookingId;
      const bookingRef = doc(db, 'bookings', bookingId);

      const scheduledSlotStr = `${date} @ ${formatTime12Hour(time)}`;
      const scheduledAtDate = new Date(`${date}T${time}`);
      const serviceOtp = Math.floor(1000 + Math.random() * 9000).toString();

      const isOnlineConfirmed = Boolean(onlinePaymentData?.txnId);
      const resolvedPaymentMethod = isOnlineConfirmed ? 'online' : (useAmc ? 'wallet' : 'cash_after_service');
      const resolvedPaymentStatus = isOnlineConfirmed || useAmc ? 'paid' : 'pay_after_service';

      const resolvedFullName = profile?.fullName || profile?.displayName || auth.currentUser.displayName || "Customer";
      const resolvedPhone = contactPhone || profile?.phoneNumber || profile?.mobile || "9876543210";
      const resolvedEmail = contactEmail || auth.currentUser.email || `${resolvedPhone}@phone.zomindia.com`;

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
        status: isOnlineConfirmed ? "confirmed" : (assignedPartnerId ? "pending_acceptance" : "pending"), 
        paymentStatus: resolvedPaymentStatus,
        scheduledAt: Timestamp.fromDate(isNaN(scheduledAtDate.getTime()) ? new Date() : scheduledAtDate),
        scheduledSlot: scheduledSlotStr,
        address: fullAddress,
        houseNumber: houseNumber.trim(),
        lat: customerCoords?.lat ?? DEFAULT_INDORE_CENTER.lat,
        lng: customerCoords?.lng ?? DEFAULT_INDORE_CENTER.lng,
        customerLocation: {
          lat: customerCoords?.lat ?? DEFAULT_INDORE_CENTER.lat,
          lng: customerCoords?.lng ?? DEFAULT_INDORE_CENTER.lng
        },
        isDoorstepLocked: Boolean(isDoorstepLocked),
        totalPrice: finalPayable,
        originalBillValue: service.basePrice,
        paidAmount: isOnlineConfirmed ? (onlinePaymentData?.amount || finalPayable) : 0,
        walletDeductAmount: 0,
        discountApplied: totalDiscount,
        promoCode: appliedPromo?.code || null,
        paymentMethod: resolvedPaymentMethod,
        isAmcBooking: useAmc,
        amcId: useAmc ? activeAmc?.id : null,
        serviceOtp,
        otpVerified: false,
        customerBookedEmail: resolvedEmail,
        customerBookedPhone: resolvedPhone,
        customerBookedName: resolvedFullName,
        customerName: resolvedFullName,
        customerMobile: resolvedPhone,
        customerData: {
          fullName: resolvedFullName,
          mobile: resolvedPhone,
          email: resolvedEmail
        },
        transactionId: onlinePaymentData?.txnId || null,
        onlinePaymentProvider: isOnlineConfirmed ? (onlinePaymentData?.provider || 'Razorpay') : null,
        onlinePaymentMethod: onlinePaymentData?.method || null,
        razorpayPaymentId: isOnlineConfirmed ? (onlinePaymentData?.txnId || null) : null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // Direct write to Firestore
      await setDoc(bookingRef, bookingPayload, { merge: true });

      // Parallel API trigger (non-blocking)
      try {
        fetch(`${API_ORIGIN}/api/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Customer-Uid': activeUid
          },
          body: JSON.stringify({
            ...bookingPayload,
            bookingId,
            scheduledAtIso: scheduledAtDate.toISOString()
          })
        }).catch(() => {});
      } catch (apiErr) {
        console.warn("Parallel API notify notice:", apiErr);
      }

      // Clean local storage cache
      try {
        localStorage.removeItem('zomindia_pending_booking');
        localStorage.removeItem('activeCoupon');
      } catch (e) {}

      // Trigger harmonious dual-tone celebration chime
      playOrderSuccessSound();

      // Show celebration checkmark + confetti animation briefly before transitioning to tracker
      setConfirmedBookingId(bookingId);
      setTimeout(() => {
        // Show user-friendly toast if available
        if (typeof (window as any).__showToast === 'function') {
          (window as any).__showToast(`Booking confirmed for ${service.name}! Tracking service pro in real-time.`);
        }
        handleModalClose();
        onSuccess(bookingId);
      }, 1500);

    } catch (err: any) {
      console.error("Booking submission error:", err);
      setError(err.message || "Failed to finalize booking. Please try again.");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Formatted display string for address pill
  const displayAddressString = useMemo(() => {
    const parts = [houseNumber.trim(), address.trim()].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(', ');
    }
    return 'Palasia / City Center, Indore';
  }, [houseNumber, address]);

  const isCustomDate = date !== todayKey && date !== tomorrowKey;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleModalClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
    >
      {/* COMPACT 3-STEP CHECKOUT SHEET */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {confirmedBookingId ? (
          <BookingSuccessAnimation
            title="Booking Confirmed!"
            subtitle="We have locked your slot and are assigning a verified Indore professional."
            serviceName={service.name}
            bookingId={confirmedBookingId}
            onComplete={() => {
              const id = confirmedBookingId;
              handleModalClose();
              onSuccess(id);
            }}
          />
        ) : (
          <>
        {/* A. STICKY HEADER & ITEM PREVIEW */}
        <div className="sticky top-0 bg-white z-10 border-b border-slate-100 shrink-0">
          {/* Mobile Drag Indicator */}
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2 sm:hidden" />

          {/* Global Error Banner */}
          {error && (
            <div className="bg-rose-50 border-b border-rose-200 text-rose-800 py-2 px-4 text-xs font-medium flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <AlertCircle size={14} className="text-rose-600 shrink-0" />
                <span>{error}</span>
              </span>
              <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded text-rose-700 cursor-pointer">
                <X size={13} />
              </button>
            </div>
          )}

          <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100">
                ⚡
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 tracking-tight truncate">
                    {service.name || 'Split AC Service'}
                  </h3>
                  {service.priceListPDF && (
                    <a 
                      href={service.priceListPDF} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                      title="View Price List"
                    >
                      <FileText size={13} />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                  <span className="font-bold text-slate-900 font-mono">₹{service.basePrice}</span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <Clock size={11} className="text-slate-400" />
                    <span>{service.duration || '2 Hours'}</span>
                  </span>
                </div>
              </div>
            </div>
            
            <button 
              type="button"
              onClick={handleModalClose} 
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
              title="Close Checkout"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* MAIN BODY: SCROLLABLE BOOKING STEPS CONTENT */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        >

          {/* B. SPACIOUS & PROFESSIONAL DOORSTEP ADDRESS CARD */}
          <div className="space-y-1.5">
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 transition-all">
              {/* Top Row: Service Tag, Pin Badge & Action Button */}
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">
                    {addressTag === 'Work' ? '🏢' : addressTag === 'Other' ? '📍' : '🏠'}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 truncate">
                    Service at: {addressTag || 'Home'}
                  </span>
                  {isDoorstepLocked && (
                    <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md shrink-0">
                      ✓ Pinned
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowMapPickerModal(true)}
                  className="text-[11px] font-bold text-[#050CA6] hover:text-[#040980] bg-[#050CA6]/5 hover:bg-[#050CA6]/10 px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer"
                >
                  {isDoorstepLocked ? 'Adjust Pin' : 'Pin on Map'}
                </button>
              </div>

              {/* Bottom Row: Full-Width Simple Address (Spans edge-to-edge) */}
              <div className="pt-1.5">
                <p className="text-xs font-normal text-slate-700 leading-relaxed break-words">
                  {houseNumber ? <span className="font-medium text-slate-900">{houseNumber}, </span> : null}
                  {address || "Indore, Madhya Pradesh"}
                </p>
              </div>
            </div>

            {/* Collapsible Clean 1-Click Location Picker */}
            <AnimatePresence>
              {showAddressPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5 shadow-sm text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                      Select Indore Location
                    </span>
                    <button
                      type="button"
                      onClick={handleUseGps}
                      className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5 text-[11px] cursor-pointer bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      <Navigation size={12} />
                      <span>Use GPS (Pin on Map)</span>
                    </button>
                  </div>

                  {/* Quick Locality Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {INDORE_QUICK_LOCALITIES.map((loc) => {
                      const isSelected = address.toLowerCase().includes(loc.toLowerCase());
                      return (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => {
                            playNotificationPop();
                            setAddress(loc);
                            setIsDoorstepLocked(false);
                            if (LOCALITY_COORDS[loc]) {
                              setCustomerCoords(LOCALITY_COORDS[loc]);
                            }
                            setShowAddressPicker(false);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {loc}
                        </button>
                      );
                    })}
                  </div>

                  {/* House / Flat Input */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={houseNumber}
                      onChange={(e) => setHouseNumber(e.target.value)}
                      placeholder="Flat / House No. / Landmark"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddressPicker(false)}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* C. STREAMLINED SLOT PICKER (3 TABS + AUTO-SELECTED EARLIEST SLOT) */}
          <div className="space-y-2">
            {/* 3 Compact Tabs */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  playNotificationPop();
                  setDate(todayKey);
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                  date === todayKey
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                Today ({todayDisplay})
              </button>

              <button
                type="button"
                onClick={() => {
                  playNotificationPop();
                  setDate(tomorrowKey);
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                  date === tomorrowKey
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                Tomorrow ({tomorrowDisplay})
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (dateInputRef.current) {
                      try {
                        dateInputRef.current.showPicker();
                      } catch {
                        dateInputRef.current.focus();
                      }
                    }
                  }}
                  className={`w-full py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer truncate ${
                    isCustomDate
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  {isCustomDate 
                    ? `📅 ${new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` 
                    : 'Pick Date 📅'
                  }
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  min={todayKey}
                  value={date}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                  className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                />
              </div>
            </div>

            {/* Time Slots Grid (Subtle gray-out for unavailable slots, no harsh red tags) */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {TIME_SLOTS.map((slot) => {
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
                        playNotificationPop();
                        setTime(slot.value);
                        setError(null);
                      }
                    }}
                    className={`py-2 px-1 text-center rounded-xl text-xs transition-all border cursor-pointer ${
                      isExpired
                        ? 'opacity-35 cursor-not-allowed bg-slate-50/60 border-slate-100 text-slate-400 line-through'
                        : isSelected
                        ? 'bg-blue-50 border-2 border-blue-600 text-blue-900 font-bold shadow-2xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="font-medium tracking-tight">{slot.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* D. 1-LINE COLLAPSIBLE COUPON STRIP */}
          <div className="space-y-1.5">
            {!appliedPromo ? (
              <div className="flex items-center justify-between py-2 px-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-xl text-xs transition-colors">
                <div className="flex items-center gap-2">
                  <Tag size={13} className="text-blue-600" />
                  <span className="text-slate-700 font-medium">Have a promo code?</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCouponInput(!showCouponInput)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1"
                >
                  Apply Coupon <ChevronRight size={13} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between py-2 px-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">🎉</span>
                  <span className="font-bold font-mono tracking-tight text-emerald-950 truncate">
                    {appliedPromo.code} Applied (-₹{getPromoDiscountAmount()})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoInput('');
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer shrink-0 ml-2"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Expandable 1-Line Input */}
            <AnimatePresence>
              {showCouponInput && !appliedPromo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="e.g. ZOMFIRST15"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold uppercase placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      disabled={!promoInput.trim() || isVerifyingPromo}
                      onClick={() => handleApplyPromo()}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isVerifyingPromo ? "..." : "Apply"}
                    </button>
                  </div>

                  {/* Fast 1-Tap Coupon Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                    {['ZOMFIRST15', 'CLEAN15', 'FIXIT250'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleApplyPromo(chip)}
                        className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-mono text-[10px] font-bold border border-blue-200 shrink-0 cursor-pointer transition-colors"
                      >
                        +{chip}
                      </button>
                    ))}
                  </div>

                  {promoError && (
                    <p className="text-[10px] text-rose-600 font-medium">⚠️ {promoError}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* E. PAYMENT MODE (PRE-SELECTED PAY AFTER SERVICE) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setPaymentOption('cash');
                setUseAmc(false);
              }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                paymentOption === 'cash' && !useAmc
                  ? 'border-emerald-600 bg-emerald-50/70 shadow-2xs ring-1 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`p-1.5 rounded-lg shrink-0 ${paymentOption === 'cash' && !useAmc ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <ShieldCheck size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">Pay After Service</p>
                  <p className="text-[10px] text-emerald-700 font-medium truncate">Cash / UPI to Pro</p>
                </div>
              </div>
              {paymentOption === 'cash' && !useAmc && (
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0 font-bold">
                  ✓
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentOption('online');
                setUseAmc(false);
              }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                paymentOption === 'online' && !useAmc
                  ? 'border-blue-600 bg-blue-50/70 shadow-2xs ring-1 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`p-1.5 rounded-lg shrink-0 ${paymentOption === 'online' && !useAmc ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <CreditCard size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">Pay Online</p>
                  <p className="text-[10px] text-slate-500 truncate">UPI / Card</p>
                </div>
              </div>
              {paymentOption === 'online' && !useAmc && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 font-bold">
                  ✓
                </span>
              )}
            </button>
          </div>

          {/* Active AMC Coverage Badge if user holds active pass */}
          {activeAmc && (
            <div 
              onClick={() => setUseAmc(!useAmc)}
              className={`py-1.5 px-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                useAmc ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span className="font-semibold flex items-center gap-1.5">
                <Sparkles size={12} className="text-emerald-600" />
                <span>AMC Pass: Free Service ({activeAmc.frequency - activeAmc.serviceBookingIds.length} left)</span>
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${useAmc ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {useAmc ? 'Applied' : 'Use Pass'}
              </span>
            </div>
          )}

          {/* F. FLAT BILL SUMMARY: 100% TRANSPARENT PRICING */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <span>Item Total: <strong className="text-slate-900 font-bold">₹{service.basePrice}</strong></span>
            <span className="text-slate-300">•</span>
            <span>Safety & Inspection: <strong className="text-emerald-600 font-bold uppercase text-[10px]">FREE</strong></span>
            <span className="text-slate-300">•</span>
            <span>Surge: <strong className="text-slate-700 font-bold">None</strong></span>
          </div>

          {totalDiscount > 0 && (
            <div className="flex items-center justify-between text-xs text-emerald-700 font-bold px-1">
              <span>Savings Applied:</span>
              <span>-₹{totalDiscount}</span>
            </div>
          )}

        </div>

        {/* F. STICKY BOTTOM CTA BAR */}
        <div className="sticky bottom-0 bg-white z-10 border-t border-slate-200 p-4 shrink-0 flex items-center gap-3">
          <div className="shrink-0 text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Total Payable</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">₹{finalPayable}</span>
              {totalDiscount > 0 && (
                <span className="text-xs text-slate-400 line-through">₹{service.basePrice}</span>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handlePrimaryCheckoutClick}
            className="flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm tracking-wide transition-all duration-150 shadow-md hover:brightness-105 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Booking...
              </span>
            ) : useAmc ? (
              <>Confirm Booking • ₹0 →</>
            ) : paymentOption === 'online' ? (
              <>Proceed to Pay • ₹{finalPayable} 🔒</>
            ) : (
              <>Book Service • Pay After Service →</>
            )}
          </button>
        </div>
          </>
        )}
      </div>

      {/* Auth Modal if user needs to sign in */}
      <AuthModal
        isOpen={showLocalLogin}
        onClose={() => setShowLocalLogin(false)}
        onSuccess={() => {
          setShowLocalLogin(false);
          if (paymentOption === 'online' && finalPayable > 0 && !useAmc) {
            initiateDirectRazorpayCheckout();
          } else {
            handleBooking();
          }
        }}
      />

      {/* Interactive Doorstep GPS Pin-Picker Map Modal (Zomato / Blinkit style) */}
      <DoorstepPinPickerModal
        isOpen={showMapPickerModal}
        onClose={() => setShowMapPickerModal(false)}
        initialCoords={isDoorstepLocked && customerCoords ? customerCoords : null}
        initialAddress={isDoorstepLocked ? address : ''}
        initialHouseNumber={houseNumber}
        initialTag={addressTag}
        onConfirm={handleConfirmDoorstep}
      />
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
