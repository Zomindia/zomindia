import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, orderBy, Timestamp, getDoc, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, UserProfile, PartnerProfile, Category, Service, EarningsHistory, BookingStatus } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { notifyBookingUpdate } from '../lib/notifications';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { motion, AnimatePresence } from 'motion/react';
import ChatWindow from './ChatWindow';
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  Package,
  ChevronRight,
  AlertCircle,
  X,
  XCircle,
  User,
  Camera,
  Check,
  Navigation,
  MessageSquare,
  Star,
  ShieldCheck,
  Smartphone,
  FileText,
  Settings,
  History
} from 'lucide-react';

// Dashboard Component
interface Props {
  profile: UserProfile;
}

function JobLocationMap({ address, lat, lng }: { address: string, lat?: number | null, lng?: number | null }) {
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(lat && lng ? { lat, lng } : null);

  useEffect(() => {
    if (lat && lng) {
      setCoords({ lat, lng });
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location;
        setCoords({ lat: loc.lat(), lng: loc.lng() });
      }
    });
  }, [address]);

  if (!coords) return (
    <div className="w-full h-32 bg-stone-100 rounded-2xl flex items-center justify-center border border-stone-200">
      <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full h-32 rounded-2xl overflow-hidden border border-stone-200 shadow-inner mt-2">
      <Map
        defaultCenter={coords}
        defaultZoom={15}
        mapId="PARTNER_JOB_MAP"
        gestureHandling="none"
        disableDefaultUI
        className="w-full h-full"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      >
        <AdvancedMarker position={coords}>
          <Pin background="#1c1917" glyphColor="#fff" borderColor="#000" />
        </AdvancedMarker>
      </Map>
    </div>
  );
}

export default function PartnerDashboard({ profile }: Props) {
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [earningsHistory, setEarningsHistory] = useState<EarningsHistory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Record<string, UserProfile>>({});
  const [services, setServices] = useState<Record<string, Service>>({});
  const [catalogServices, setCatalogServices] = useState<Service[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [activePartnerTab, setActivePartnerTab] = useState<'overview' | 'bookings' | 'catalog' | 'promotions' | 'earnings'>('overview');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState<'Available' | 'Busy' | 'Offline' | null>(null);
  const [availabilityReason, setAvailabilityReason] = useState('');
  const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);
  const [activeBookingChat, setActiveBookingChat] = useState<Booking | null>(null);
  const [historySort, setHistorySort] = useState<'desc' | 'asc'>('desc');
  const [earningsSort, setEarningsSort] = useState<'desc' | 'asc'>('desc');
  const [earningsFilter, setEarningsFilter] = useState<'all' | 'booking_earning' | 'reward_credit' | 'adjustment'>('all');
  const [addingChargeId, setAddingChargeId] = useState<string | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [closingBookingId, setClosingBookingId] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [verifyingOTPId, setVerifyingOTPId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [verifyingLoading, setVerifyingLoading] = useState(false);

  const verifyServiceOTP = async () => {
    if (!verifyingOTPId || !otpInput) return;
    setVerifyingLoading(true);
    setOtpError(false);
    try {
      // Fetch the OTP from the secrets subcollection
      const otpDoc = await getDoc(doc(db, `bookings/${verifyingOTPId}/secrets/otp`));
      
      if (otpDoc.exists() && otpDoc.data()?.code === otpInput) {
        await updateDoc(doc(db, 'bookings', verifyingOTPId), {
          status: 'in_progress',
          otpVerified: true,
          arrivedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        const b = bookings.find(x => x.id === verifyingOTPId);
        if (b) notifyBookingUpdate({ ...b, status: 'in_progress', arrivedAt: Timestamp.now() }, 'in_progress', profile.uid);
        setVerifyingOTPId(null);
        setOtpInput('');
      } else {
        setOtpError(true);
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      // If it's a permission error, it usually means the OTP is wrong (or security rules are tight)
      setOtpError(true);
    } finally {
      setVerifyingLoading(false);
    }
  };
  const [chargeForm, setChargeForm] = useState({ amount: '', reason: '' });
  const [closingForm, setClosingForm] = useState({ paymentMethod: 'online' as 'online' | 'cash', extraAmount: '', extraReason: '' });
  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [kycDocs, setKycDocs] = useState<{type: string, url: string}[]>([
    { type: '', url: '' },
    { type: '', url: '' }
  ]);
  const [kycFiles, setKYCFiles] = useState<{ type: string, url: string }[]>([]);
  const [managingStatusBookingId, setManagingStatusBookingId] = useState<string | null>(null);
  const [statusForm, setStatusForm] = useState({
    status: '' as BookingStatus | 'reject',
    pendingReason: '',
    pendingDate: '',
    pendingDuration: ''
  });

  const handleManualStatusUpdate = async () => {
    if (!managingStatusBookingId || !statusForm.status) return;
    
    const booking = bookings.find(b => b.id === managingStatusBookingId);
    if (!booking) return;

    // Restriction: Cannot change status if already closed
    if (['completed', 'finalized', 'cancelled'].includes(booking.status)) {
      alert("This booking is closed. Status can only be changed by an Administrator.");
      setManagingStatusBookingId(null);
      return;
    }

    setLoading(true);
    try {

      const updateData: any = {
        updatedAt: Timestamp.now()
      };

      if (statusForm.status === 'reject') {
        // Assign again (Return to pool)
        updateData.status = 'pending';
        updateData.partnerId = null; // Important: use null or delete it? Firestore null is fine.
        updateData.previousStatus = booking.status;
      } else if (statusForm.status === 'pending') {
        updateData.status = 'pending';
        updateData.pendingReason = statusForm.pendingReason;
        updateData.pendingResolveDate = statusForm.pendingDate ? Timestamp.fromDate(new Date(statusForm.pendingDate)) : null;
        updateData.pendingResolveDuration = statusForm.pendingDuration;
        updateData.previousStatus = booking.status;
      } else if (statusForm.status === 'in_progress' || statusForm.status === 'confirmed') {
        // Reactivate
        updateData.status = statusForm.status;
        updateData.previousStatus = booking.status;
        // Clean up pending metadata if any
        updateData.pendingReason = null;
        updateData.pendingResolveDate = null;
        updateData.pendingResolveDuration = null;
      } else {
        updateData.status = statusForm.status;
        updateData.previousStatus = booking.status;
      }

      await updateDoc(doc(db, 'bookings', managingStatusBookingId), updateData);
      
      // Notify
      notifyBookingUpdate({ ...booking, ...updateData }, updateData.status, profile.uid);
      
      setManagingStatusBookingId(null);
      setStatusForm({ status: '' as any, pendingReason: '', pendingDate: '', pendingDuration: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${managingStatusBookingId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseBooking = async () => {
    if (!closingBookingId) return;
    setLoading(true);
    try {
      const extraAmount = parseFloat(closingForm.extraAmount || '0');
      const booking = bookings.find(b => b.id === closingBookingId);
      if (!booking) return;

      const newCharges = [...(booking.additionalCharges || [])];
      if (extraAmount > 0) {
        newCharges.push({
          amount: extraAmount,
          reason: closingForm.extraReason || 'Extra services',
          createdAt: Timestamp.now()
        });
      }

      const finalPrice = booking.totalPrice + extraAmount;

      await updateDoc(doc(db, 'bookings', closingBookingId), {
        status: 'completed',
        paymentMethod: closingForm.paymentMethod,
        additionalCharges: newCharges,
        totalPrice: finalPrice,
        paymentStatus: closingForm.paymentMethod === 'cash' ? 'paid' : booking.paymentStatus,
        updatedAt: Timestamp.now()
      });

      // Update partner earnings
      if (partner) {
        const rewardPts = 10;
        await updateDoc(doc(db, 'partners', partner.id), {
          totalEarnings: (partner.totalEarnings || 0) + finalPrice,
          rewardCredits: (partner.rewardCredits || 0) + rewardPts,
          updatedAt: Timestamp.now()
        });

        // Add to earnings history
        try {
          await addDoc(collection(db, 'partners', partner.id, 'earningsHistory'), {
            type: 'booking_earning',
            amount: finalPrice,
            credits: rewardPts,
            bookingId: closingBookingId,
            reason: `Completed booking for ${services[booking.serviceId]?.name || 'Service'}`,
            createdAt: Timestamp.now()
          });
        } catch (hErr) {
          console.error("Failed to record history:", hErr);
          // Don't fail the whole process if history record fails
        }
      }

      notifyBookingUpdate({ ...booking, status: 'completed' }, 'completed', profile.uid);
      setClosingBookingId(null);
      setClosingForm({ paymentMethod: 'online', extraAmount: '', extraReason: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${closingBookingId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadKYC = async () => {
    if (!partner) return;
    
    // Allow up to two documents, at least one required
    const validDocs = kycDocs.filter(d => d.url && d.type);
    if (validDocs.length === 0) {
      alert("Please upload at least one document and select its type.");
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'partners', partner.id), {
        kycStatus: 'pending',
        kycRejectReason: null,
        kycDocuments: validDocs.map(f => ({ 
          type: f.type, 
          url: f.url, 
          status: 'pending' 
        })),
        updatedAt: Timestamp.now()
      });
      setPartner({ ...partner, kycStatus: 'pending' });
      setIsKYCModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'kyc');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCharge = async (booking: Booking) => {
    if (!chargeForm.amount || !chargeForm.reason) return;
    setLoading(true);
    try {
      const amount = parseFloat(chargeForm.amount);
      const newCharge = {
        amount,
        reason: chargeForm.reason,
        createdAt: Timestamp.now()
      };
      
      const updatedCharges = [...(booking.additionalCharges || []), newCharge];
      const newTotal = booking.totalPrice + amount;

      await updateDoc(doc(db, 'bookings', booking.id), {
        additionalCharges: updatedCharges,
        totalPrice: newTotal,
        updatedAt: Timestamp.now()
      });

      setAddingChargeId(null);
      setChargeForm({ amount: '', reason: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
    } finally {
      setLoading(false);
    }
  };

  // Start tracking if there's an active job or partner is available
  useLocationTracking(partner?.id, bookings, partner?.availabilityStatus);
  
  // Fetch customer details when bookings change
  useEffect(() => {
    const fetchMissingCustomers = async () => {
      const customerIds = Array.from(new Set(bookings.map(b => b.customerId)));
      const missingIds = customerIds.filter(id => !customers[id]);
      
      if (missingIds.length === 0) return;

      try {
        const batchSize = 10;
        for (let i = 0; i < missingIds.length; i += batchSize) {
          const chunk = missingIds.slice(i, i + batchSize);
          const uq = query(collection(db, 'users'), where('uid', 'in', chunk));
          const uSnap = await getDocs(uq);
          const fetched: Record<string, UserProfile> = {};
          uSnap.forEach(doc => {
            const data = doc.data() as UserProfile;
            fetched[data.uid] = data;
          });
          setCustomers(prev => ({ ...prev, ...fetched }));
        }
      } catch (err) {
        console.error("Error fetching customers:", err);
      }
    };

    if (bookings.length > 0) {
      fetchMissingCustomers();
    }
  }, [bookings]); // Removed redundant customers dependency to avoid infinite loop

  // Fetch service details
  useEffect(() => {
    const fetchMissingServices = async () => {
      const serviceIds = bookings.map(b => b.serviceId);
      const uniqueMissingIds = Array.from(new Set(serviceIds)).filter(id => !services[id]) as string[];
      
      if (uniqueMissingIds.length === 0) return;

      try {
        // Fetch all missing services in parallel
        const fetchPromises = uniqueMissingIds.map(id => getDoc(doc(db, 'services', id)));
        const results = await Promise.all(fetchPromises);
        
        const fetched: Record<string, Service> = {};
        results.forEach((snap) => {
          if (snap.exists()) {
            fetched[snap.id] = { id: snap.id, ...snap.data() } as Service;
          }
        });
        
        if (Object.keys(fetched).length > 0) {
          setServices(prev => ({ ...prev, ...fetched }));
        }
      } catch (err) {
        console.error("Error fetching services:", err);
      }
    };

    if (bookings.length > 0) {
      fetchMissingServices();
    }
  }, [bookings]);

  // Fetch all services for catalog reference
  useEffect(() => {
    if (!partner?.categories || partner.categories.length === 0) return;

    const fetchCatalog = async () => {
      try {
        const q = query(collection(db, 'services'), where('categoryId', 'in', partner.categories));
        const snap = await getDocs(q);
        setCatalogServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
      } catch (err) {
        console.error("Error fetching catalog:", err);
      }
    };
    fetchCatalog();
  }, [partner?.categories]);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    displayName: profile.displayName,
    photoURL: profile.photoURL || '',
    bio: '',
    selectedCategories: [] as string[],
    workingHours: [] as WorkingHours[]
  });

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DEFAULT_HOURS = DAYS.map(day => ({ day, startTime: '09:00', endTime: '18:00', enabled: true }));

  useEffect(() => {
    // 1. Fetch partner profile
    const fetchPartner = async () => {
      try {
        const q = query(collection(db, 'partners'), where('userId', '==', profile.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const pData = { id: snap.docs[0].id, ...snap.docs[0].data() } as PartnerProfile;
          setPartner(pData);
          setEditForm(prev => ({
            ...prev,
            bio: pData.bio || '',
            selectedCategories: pData.categories,
            workingHours: pData.workingHours || DEFAULT_HOURS
          }));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'partners');
      }
    };
    fetchPartner();

    // 2. Listen to bookings
    const q = query(
      collection(db, 'bookings'), 
      where('partnerId', '==', profile.uid),
      orderBy('scheduledAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const boks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
      setBookings(boks);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bookings'));

    // 3. Fetch categories
    const fetchCategories = async () => {
      try {
        const snap = await getDocs(collection(db, 'categories'));
        setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'categories');
      }
    };
    fetchCategories();

    // 3.5 Fetch promotions
    const fetchPromos = async () => {
      try {
        const q = query(collection(db, 'promotions'), where('active', '==', true));
        const snap = await getDocs(q);
        setPromotions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion)));
      } catch (err) {
        console.error("Error fetching promos:", err);
      }
    };
    fetchPromos();

    // 4. Fetch earnings history
    let unsubscribeHistory = () => {};
    if (partner?.id) {
       const hq = query(
         collection(db, 'partners', partner.id, 'earningsHistory'),
         orderBy('createdAt', 'desc')
       );
       unsubscribeHistory = onSnapshot(hq, (snap) => {
         setEarningsHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as EarningsHistory)));
       }, (err) => console.error("History error:", err));
    }

    return () => {
      unsubscribe();
      unsubscribeHistory();
    };
  }, [profile.uid, partner?.id]);

  const handleSaveProfile = async () => {
    if (!partner) return;
    setLoading(true);
    try {
      // Update User collection
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: editForm.displayName || profile.displayName || 'User',
        photoURL: editForm.photoURL || '',
        bio: editForm.bio || ''
      });

      // Update Partner collection
      await updateDoc(doc(db, 'partners', partner.id), {
        categories: editForm.selectedCategories,
        bio: editForm.bio,
        workingHours: editForm.workingHours
      });

      // Refresh local state
      setPartner({ 
        ...partner, 
        bio: editForm.bio, 
        categories: editForm.selectedCategories,
        workingHours: editForm.workingHours 
      });
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'profile');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (catId: string) => {
    setEditForm(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(catId)
        ? prev.selectedCategories.filter(id => id !== catId)
        : [...prev.selectedCategories, catId]
    }));
  };

  const updateBookingStatus = async (bookingId: string, status: BookingStatus) => {
    setCompletingBookingId(bookingId);
    try {
      const updateData: any = {
        status,
        updatedAt: Timestamp.now()
      };

      await updateDoc(doc(db, 'bookings', bookingId), updateData);
      const b = bookings.find(x => x.id === bookingId);
      if (b) notifyBookingUpdate({ ...b, status }, status, profile.uid);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
    } finally {
      setCompletingBookingId(null);
    }
  };


  const handleCancelBooking = async () => {
    if (!cancellingBookingId || !cancelReason) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'bookings', cancellingBookingId), {
        status: 'cancelled',
        cancellationReason: cancelReason,
        updatedAt: Timestamp.now()
      });
      const b = bookings.find(x => x.id === cancellingBookingId);
      if (b) notifyBookingUpdate({ ...b, status: 'cancelled' }, 'cancelled', profile.uid);
      setCancellingBookingId(null);
      setCancelReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${cancellingBookingId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAvailability = async () => {
    if (!partner || !showAvailabilityModal) return;
    setUpdatingAvailability(true);
    try {
      await updateDoc(doc(db, 'partners', partner.id), {
        availabilityStatus: showAvailabilityModal,
        statusReason: availabilityReason,
        updatedAt: Timestamp.now()
      });
      setPartner(prev => prev ? { ...prev, availabilityStatus: showAvailabilityModal, statusReason: availabilityReason } : null);
      setShowAvailabilityModal(null);
      setAvailabilityReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'availability');
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
      case 'confirmed':
      case 'in_progress':
      case 'on_the_way':
        return 'bg-green-500 text-white shadow-lg shadow-green-100'; 
      case 'pending':
      case 'pending_parts':
        return 'bg-amber-400 text-white shadow-lg shadow-amber-100';
      case 'closed':
      case 'cancelled':
      case 'completed':
      case 'finalized':
        return 'bg-stone-100 text-stone-400';
      default:
        return 'bg-stone-50 text-stone-500';
    }
  };

  if (loading) return <div className="p-12 text-center text-stone-400">Loading dashboard...</div>;

  const activeBookings = bookings.filter(b => ['pending', 'confirmed', 'in_progress', 'on_the_way'].includes(b.status));
  const filteredEarnings = earningsHistory
    .filter(item => earningsFilter === 'all' || item.type === earningsFilter)
    .sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime() || 0;
      const dateB = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime() || 0;
      return earningsSort === 'desc' ? dateB - dateA : dateA - dateB;
    });
  const historicalBookings = bookings
    .filter(b => ['completed', 'finalized', 'cancelled'].includes(b.status))
    .sort((a, b) => {
      const dateA = a.scheduledAt?.toMillis() || 0;
      const dateB = b.scheduledAt?.toMillis() || 0;
      return historySort === 'desc' ? dateB - dateA : dateA - dateB;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Availability Change Modal */}
      <AnimatePresence>
        {showAvailabilityModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-stone-900 mb-2 italic">Status Update</h3>
              <p className="text-stone-400 text-sm mb-8 font-medium">Switching to <span className="text-stone-900 font-bold">{showAvailabilityModal}</span> mode.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase mb-3 tracking-widest ml-1">Reason for Status Change</label>
                  <textarea 
                    value={availabilityReason}
                    onChange={(e) => setAvailabilityReason(e.target.value)}
                    placeholder="e.g. Taking a lunch break / Heading to a job..."
                    className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-4 focus:ring-stone-900/5 transition-all outline-none h-32 resize-none"
                  />
                </div>
                
                <div className="flex gap-4">
                  <button 
                    onClick={() => { setShowAvailabilityModal(null); setAvailabilityReason(''); }}
                    className="flex-1 py-4 text-stone-400 font-bold hover:bg-stone-50 rounded-2xl transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleUpdateAvailability}
                    className="flex-2 bg-stone-900 text-white py-4 px-8 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-stone-900/20 uppercase tracking-widest text-[10px]"
                  >
                    Confirm Change
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-12">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-stone-900 mb-2 truncate">Hello, {profile.displayName}</h1>
          <p className="text-stone-500 text-sm">Manage your bookings and track your business performance.</p>
          {bookings.some(b => b.status === 'in_progress') && (
            <div className="flex items-center gap-2 px-3 py-1 bg-stone-900 text-white rounded-full text-[9px] font-black uppercase tracking-[0.2em] mt-4 inline-flex shadow-lg shadow-stone-900/10">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live Tracking Active
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="bg-stone-100 p-1 rounded-2xl flex w-full sm:w-auto">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'bookings', label: 'History' },
              { id: 'catalog', label: 'Services' },
              { id: 'promotions', label: 'Offers' },
              { id: 'earnings', label: 'Earnings' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActivePartnerTab(tab.id as any)}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activePartnerTab === tab.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-5 bg-white border border-stone-200/60 rounded-[28px] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest">Availability</p>
              <div className={`w-2 h-2 rounded-full ${
                partner?.availabilityStatus === 'Available' ? 'bg-emerald-500 animate-pulse' :
                partner?.availabilityStatus === 'Busy' ? 'bg-amber-500' : 'bg-stone-300'
              }`} />
            </div>
            <div className="flex gap-1.5">
              {(['Available', 'Busy', 'Offline'] as const).map((status) => (
                <button
                  key={status}
                  disabled={updatingAvailability}
                  onClick={() => setShowAvailabilityModal(status)}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-[10px] font-bold transition-all active:scale-95 ${
                    partner?.availabilityStatus === status
                      ? status === 'Available' ? 'bg-stone-900 text-white shadow-xl shadow-stone-900/10' :
                        status === 'Busy' ? 'bg-amber-100 text-amber-700' :
                        'bg-stone-100 text-stone-900'
                      : 'bg-stone-50 text-stone-400 hover:bg-stone-100'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1 p-5 bg-white border border-stone-100 rounded-[28px] shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest">Earnings</p>
                <p className="text-xl font-bold text-stone-900">₹{partner?.totalEarnings?.toLocaleString() || '0'}</p>
              </div>
            </div>
            <div className="flex-1 p-5 bg-white border border-stone-100 rounded-[28px] shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
                <Star size={20} />
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest">Rewards</p>
                <p className="text-xl font-bold text-stone-900">{partner?.rewardCredits || '0'} pts</p>
              </div>
            </div>
          </div>
          <div className="flex-1 p-5 bg-white border border-stone-100 rounded-[28px] shadow-sm flex items-center gap-4">
            <div className="p-2.5 bg-stone-900 text-white rounded-2xl">
              <Package size={20} />
            </div>
            <div>
              <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest">Active Jobs</p>
              <p className="text-xl font-bold text-stone-900">{bookings.filter(b => b.status === 'confirmed' || b.status === 'in_progress' || b.status === 'on_the_way').length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-12">
          {activePartnerTab === 'overview' && (
            <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-bold">Active Jobs</h2>
              <span className="bg-stone-100 text-stone-600 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">
                {activeBookings.length} Active
              </span>
            </div>

            {activeBookings.length === 0 ? (
              <div className="p-12 bg-white border border-stone-100 rounded-[32px] text-center">
                <div className="p-4 bg-stone-50 text-stone-300 rounded-full inline-flex mb-4">
                  <Package size={24} />
                </div>
                <h3 className="text-lg font-bold mb-1 font-display">No active jobs</h3>
                <p className="text-sm text-stone-500">New requests will appear here when customers book you.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {activeBookings.map((booking) => {
                  const customer = customers[booking.customerId];
                  return (
                    <motion.div 
                      layout
                      key={booking.id}
                      className={`p-6 border rounded-[32px] shadow-sm hover:shadow-md transition-all ${
                        booking.status === 'confirmed' ? 'bg-green-50/30 border-green-100' :
                        booking.status === 'pending' ? 'bg-orange-50/30 border-orange-100' :
                        'bg-white border-stone-200'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex gap-5">
                          <div className="flex flex-col items-center gap-2">
                             <div className="w-16 h-16 bg-stone-100 rounded-3xl flex items-center justify-center text-stone-900 overflow-hidden shrink-0 border-2 border-white shadow-sm">
                              {customer?.photoURL ? (
                                <img src={customer.photoURL} alt={customer.displayName} className="w-full h-full object-cover" />
                              ) : (
                                <User size={32} className="text-stone-200" />
                              )}
                            </div>
                            <span className="text-[9px] font-black uppercase text-stone-300 tracking-widest">Customer</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-[0.1em] ${getStatusColor(booking.status)} shadow-sm`}>
                                {booking.status.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-stone-300 font-mono">#{booking.id.slice(0, 8).toUpperCase()}</span>
                            </div>
                            <h4 className="font-display font-bold text-2xl mb-1 text-stone-900 truncate">
                              {customer?.displayName || 'Syncing Client...'}
                            </h4>
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-5 h-5 bg-stone-900 text-white rounded-lg flex items-center justify-center shrink-0">
                                <Package size={12} />
                              </div>
                              <p className="text-sm font-bold text-stone-900 truncate">
                                {services[booking.serviceId]?.name || 'Service Requested'}
                              </p>
                              {services[booking.serviceId]?.rating && (
                                <div className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg border border-amber-100 font-bold">
                                  <Star size={10} fill="currentColor" /> {services[booking.serviceId].rating}
                                </div>
                              )}
                              {services[booking.serviceId]?.priceListPDF && (
                                <a 
                                  href={services[booking.serviceId]?.priceListPDF} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="ml-auto flex items-center gap-1.5 text-[10px] bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-all font-black uppercase tracking-widest shadow-sm"
                                >
                                  <FileText size={10} /> Price List
                                </a>
                              )}
                            </div>
                            {services[booking.serviceId]?.imageURL && (
                              <div className="w-full h-24 rounded-2xl overflow-hidden mb-4 bg-stone-50 border border-stone-100">
                                <img src={services[booking.serviceId].imageURL} alt="" className="w-full h-full object-cover opacity-80" />
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-[11px] text-stone-400 font-bold uppercase tracking-tight">
                              <div className="flex items-center gap-2 bg-stone-50/50 p-2 rounded-xl border border-stone-100/50">
                                <Calendar size={14} className="text-stone-300" /> 
                                <span>{booking.scheduledAt?.toDate?.()?.toLocaleString() || 'Pending'}</span>
                              </div>
                              <div className="flex items-center gap-2 bg-stone-50/50 p-2 rounded-xl border border-stone-100/50">
                                <MapPin size={14} className="text-stone-300" /> 
                                <span className="truncate">{booking.address}</span>
                              </div>
                              <JobLocationMap address={booking.address} lat={booking.lat} lng={booking.lng} />
                              <button 
                                onClick={() => {
                                  const url = booking.lat && booking.lng 
                                    ? `https://www.google.com/maps/search/?api=1&query=${booking.lat},${booking.lng}`
                                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`;
                                  window.open(url, '_blank');
                                }}
                                className="w-full mt-2 py-2 bg-stone-100 text-stone-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
                              >
                                <Navigation size={12} /> Open in Navigation
                              </button>
                               {customer?.phoneNumber && (
                                <div className="sm:col-span-2 flex items-center gap-2 bg-stone-900 text-white p-2.5 px-4 rounded-xl shadow-lg shadow-stone-200/50 mt-2">
                                  <Smartphone size={14} className="text-stone-400" />
                                  <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Customer Phone:</span>
                                  <a href={`tel:${customer.phoneNumber}`} className="font-mono text-sm hover:text-emerald-400 transition-colors">{customer.phoneNumber}</a>
                                </div>
                              )}
                            </div>

                            {/* Additional Charges Section */}
                            {(booking.additionalCharges?.length || 0) > 0 && (
                              <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap gap-2">
                                {booking.additionalCharges?.map((charge, idx) => (
                                  <div key={idx} className="bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">+{charge.reason}:</span>
                                    <span className="text-xs font-black text-amber-700">₹{charge.amount}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {addingChargeId === booking.id ? (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-4 p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3"
                              >
                                <div className="grid grid-cols-2 gap-3">
                                  <input 
                                    type="number" 
                                    placeholder="Amount (₹)"
                                    value={chargeForm.amount}
                                    onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                                    className="bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-stone-900 focus:outline-none"
                                  />
                                  <input 
                                    type="text" 
                                    placeholder="Reason (e.g. Spare Parts)"
                                    value={chargeForm.reason}
                                    onChange={(e) => setChargeForm({ ...chargeForm, reason: e.target.value })}
                                    className="bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-stone-900 focus:outline-none"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => setAddingChargeId(null)}
                                    className="flex-1 py-2 text-xs font-bold text-stone-500 hover:bg-stone-200 rounded-lg transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={() => handleAddCharge(booking)}
                                    className="flex-1 py-2 text-xs font-bold bg-stone-900 text-white rounded-lg hover:bg-black transition-colors"
                                  >
                                    Add Charge
                                  </button>
                                </div>
                              </motion.div>
                            ) : (
                              (booking.status === 'in_progress' || booking.status === 'confirmed') && (
                                <button 
                                  onClick={() => setAddingChargeId(booking.id)}
                                  className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-widest hover:text-stone-900 transition-colors"
                                >
                                  <DollarSign size={12} /> Add Extra Charges (Parts/Accessories)
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col justify-between items-end gap-3 border-t md:border-t-0 pt-4 md:pt-0">
                          <div className="text-right">
                            <p className="text-2xl font-display font-bold text-stone-900">₹{booking.totalPrice}</p>
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Payout</p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setManagingStatusBookingId(booking.id);
                                setStatusForm({
                                  status: booking.status,
                                  pendingReason: booking.pendingReason || '',
                                  pendingDate: booking.pendingResolveDate?.toDate?.()?.toISOString().slice(0, 16) || '',
                                  pendingDuration: booking.pendingResolveDuration || ''
                                });
                              }}
                              className="p-3 bg-stone-50 text-stone-900 rounded-xl hover:bg-stone-100 transition-all border border-stone-100"
                              title="Manage Status"
                            >
                              <Settings size={18} className="text-stone-400" />
                            </button>
                            <button 
                              onClick={() => setActiveBookingChat(booking)}
                              className="p-3 bg-stone-50 text-stone-900 rounded-xl hover:bg-stone-100 transition-all border border-stone-100"
                              title="Chat with Customer"
                            >
                              <MessageSquare size={18} className="text-stone-400" />
                            </button>
                            {booking.status === 'confirmed' && (
                              <button 
                                disabled={completingBookingId === booking.id}
                                onClick={() => updateBookingStatus(booking.id, 'on_the_way')}
                                className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
                              >
                                {completingBookingId === booking.id ? '...' : 'On My Way'}
                              </button>
                            )}
                            {booking.status === 'on_the_way' && (
                              <button 
                                disabled={completingBookingId === booking.id}
                                onClick={() => updateBookingStatus(booking.id, 'arrived')}
                                className="bg-amber-500 text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-amber-600 shadow-lg shadow-amber-100 transition-all active:scale-95"
                              >
                                {completingBookingId === booking.id ? '...' : 'Mark Arrived'}
                               </button>
                             )}
                            {booking.status === 'arrived' && (
                               <button 
                                 onClick={() => {
                                   setVerifyingOTPId(booking.id);
                                   setOtpInput('');
                                   setOtpError(false);
                                 }}
                                 className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                               >
                                 Verify OTP to Start
                               </button>
                             )}
                            {booking.status === 'in_progress' && (
                              <button 
                                disabled={completingBookingId === booking.id}
                                onClick={() => setClosingBookingId(booking.id)}
                                className="bg-stone-900 text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-black shadow-lg shadow-stone-900/20 transition-all active:scale-95 disabled:opacity-50"
                              >
                                {completingBookingId === booking.id ? '...' : 'Finish Job'}
                              </button>
                            )}
                            <button 
                              onClick={() => setCancellingBookingId(booking.id)}
                              className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
                              title="Cancel Booking"
                            >
                              <XCircle size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activePartnerTab === 'bookings' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center px-2">
                <h2 className="text-xl font-bold">Historical Job Records</h2>
                <button 
                  onClick={() => setHistorySort(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900"
                >
                  Sort: {historySort === 'desc' ? 'Newest' : 'Oldest'}
                </button>
              </div>
              <div className="space-y-4">
                {historicalBookings.map(b => (
                  <div key={b.id} className="bg-white p-6 rounded-[32px] border border-stone-100 flex justify-between items-center group hover:border-stone-200 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${
                        b.status === 'cancelled' ? 'bg-rose-50 text-rose-600' : 'bg-stone-50 text-stone-900'
                      }`}>
                        <Calendar size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900">{customers[b.customerId]?.displayName || 'Customer'}</h4>
                        <p className="text-[10px] text-stone-400 font-medium">{b.scheduledAt?.toDate?.()?.toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                       <div>
                          <p className="text-xl font-bold text-stone-900">₹{b.totalPrice}</p>
                          <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${getStatusColor(b.status)}`}>{b.status}</span>
                       </div>
                       <button 
                         onClick={() => {
                           setManagingStatusBookingId(b.id);
                           setStatusForm({
                             status: b.status,
                             pendingReason: b.pendingReason || '',
                             pendingDate: b.pendingResolveDate?.toDate?.()?.toISOString().slice(0, 16) || '',
                             pendingDuration: b.pendingResolveDuration || ''
                           });
                         }}
                         className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 transition-colors"
                         title="Correct status / Reactivate"
                       >
                         <History size={16} />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePartnerTab === 'catalog' && (
            <div className="space-y-6 pt-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-2">
              <div>
                <h2 className="text-xl font-bold">Service Catalog Reference</h2>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Global standards for your categories</p>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input 
                  type="text"
                  placeholder="Search catalog..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-stone-900 outline-none"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {catalogServices
                .filter(s => {
                  const query = catalogSearch.toLowerCase();
                  const category = categories.find(c => c.id === s.categoryId);
                  return (
                    s.name.toLowerCase().includes(query) ||
                    s.description.toLowerCase().includes(query) ||
                    category?.name.toLowerCase().includes(query)
                  );
                })
                .map((s) => (
                <div key={s.id} className="bg-white p-5 border border-stone-100 rounded-[28px] hover:border-stone-900 transition-all group">
                   <div className="flex justify-between items-start mb-4">
                      {s.imageURL && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 grayscale group-hover:grayscale-0 transition-all">
                          <img src={s.imageURL} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="text-right">
                         <p className="text-lg font-bold text-stone-900">₹{s.basePrice}</p>
                         <p className="text-[9px] text-stone-400 font-bold tracking-widest uppercase">{s.duration}</p>
                      </div>
                   </div>
                   <h4 className="font-bold text-stone-900 mb-1">{s.name}</h4>
                   <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center text-amber-400">
                        <Star size={10} fill="currentColor" />
                        <span className="text-[10px] font-bold text-stone-900 ml-1">{s.rating || 4.8}</span>
                      </div>
                      <span className="text-[9px] text-stone-400 font-medium tracking-tight">({s.reviewCount || 0} reviews)</span>
                   </div>
                   <p className="text-[11px] text-stone-500 line-clamp-2 mb-4 leading-relaxed">{s.description}</p>
                   {s.priceListPDF && (
                     <a 
                       href={s.priceListPDF} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-all inline-flex"
                     >
                       <FileText size={12} /> Detailed Price List
                     </a>
                   )}
                </div>
              ))}
              {catalogServices.length === 0 && (
                <div className="col-span-full p-8 bg-stone-50 border border-dashed border-stone-200 rounded-[32px] text-center">
                   <p className="text-sm font-medium text-stone-400 italic">No reference services found for your categories.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activePartnerTab === 'promotions' && (
            <div className="space-y-6 pt-6">
               <div className="flex justify-between items-center px-2">
                  <h2 className="text-xl font-bold">Live Promotions</h2>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Active offers for customers</p>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {promotions.map(promo => (
                    <div key={promo.id} className="bg-stone-900 text-white p-8 rounded-[40px] relative overflow-hidden group min-h-[200px] flex flex-col justify-end">
                       <div className="relative z-10">
                          <div className="flex justify-between items-start mb-6">
                             <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest font-mono">
                                {promo.code}
                             </div>
                             <div className="text-3xl font-black text-white/90">
                                {promo.discountType === 'percent' ? `${promo.discountValue}%` : `₹${promo.discountValue}`}
                             </div>
                          </div>
                          <h4 className="text-xl font-bold mb-2">{promo.name}</h4>
                          <p className="text-white/50 text-xs mb-4 leading-relaxed line-clamp-2">{promo.description}</p>
                       </div>
                       <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-12 translate-x-12 opacity-50" />
                    </div>
                  ))}
                  {promotions.length === 0 && (
                    <div className="col-span-full py-12 text-center text-stone-400 italic bg-stone-50 rounded-[40px]">
                       No active promotions for partners to view right now.
                    </div>
                  )}
               </div>
            </div>
          )}

          {activePartnerTab === 'earnings' && (
            <div className="space-y-6 pt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
                <h2 className="text-xl font-bold">Payouts & Rewards History</h2>
              <div className="flex flex-wrap items-center gap-2">
                <select 
                  value={earningsFilter}
                  onChange={(e) => setEarningsFilter(e.target.value as any)}
                  className="text-[10px] font-bold uppercase tracking-widest bg-stone-50 border-none rounded-full px-3 py-1.5 focus:ring-0 cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="booking_earning">Earnings Only</option>
                  <option value="reward_credit">Rewards Only</option>
                  <option value="adjustment">Adjustments</option>
                </select>
                <button 
                  onClick={() => setEarningsSort(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:text-stone-900 bg-stone-50 px-3 py-1.5 rounded-full transition-colors"
                >
                  <Clock size={12} />
                  {earningsSort === 'desc' ? 'Newest' : 'Oldest'}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
               {filteredEarnings.length === 0 ? (
                 <div className="p-12 bg-white border border-dashed border-stone-200 rounded-[32px] text-center">
                    <p className="text-sm font-medium text-stone-400 italic">No records found matching your filters.</p>
                 </div>
               ) : (
                 filteredEarnings.map((item) => (
                   <div key={item.id} className="bg-white p-6 border border-stone-100 rounded-[28px] flex justify-between items-center group hover:border-stone-200 transition-all">
                      <div className="flex items-center gap-6">
                         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                           item.type === 'booking_earning' ? 'bg-emerald-50 text-emerald-600' :
                           item.type === 'reward_credit' ? 'bg-amber-50 text-amber-600' :
                           'bg-stone-50 text-stone-600'
                         }`}>
                           {item.type === 'booking_earning' ? <DollarSign size={20} /> : <Star size={20} />}
                         </div>
                         <div>
                            <p className="text-sm font-bold text-stone-900 mb-1">{item.reason}</p>
                            <div className="flex items-center gap-3">
                               <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                                  {item.createdAt?.toDate?.() ? item.createdAt.toDate().toLocaleString() : new Date(item.createdAt).toLocaleString()}
                               </p>
                               {item.bookingId && (
                                  <div className="flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded text-[9px] font-bold text-stone-500">
                                     <FileText size={10} /> ID: {item.bookingId.slice(-6)}
                                  </div>
                               )}
                            </div>
                         </div>
                      </div>
                      <div className="text-right">
                         {item.amount > 0 && <p className="text-lg font-bold text-emerald-600">+₹{item.amount}</p>}
                         {item.credits > 0 && <p className="text-sm font-bold text-amber-600">+{item.credits} pts</p>}
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        )}
      </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Profile Card */}
          <div className="bg-stone-900 p-10 rounded-[48px] text-white overflow-hidden relative shadow-2xl">
            <div className="relative z-10">
              <h3 className="text-2xl font-display font-bold mb-1 italic">Pro Profile</h3>
              <p className="text-white/40 text-sm mb-10 font-medium">Your public performance metrics</p>
              
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/50 font-semibold uppercase tracking-widest">Global Rating</span>
                  <div className="flex items-center gap-2 text-white font-bold text-lg">
                    <Star fill="currentColor" size={18} className="text-amber-400" /> 4.9 <span className="text-white/20 text-xs font-normal">(124 recs)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/50 font-semibold uppercase tracking-widest">Jobs Done</span>
                  <span className="text-2xl font-display font-bold">482</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/50 font-semibold uppercase tracking-widest">Live Status</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${
                      partner?.availabilityStatus === 'Available' ? 'bg-emerald-400' :
                      partner?.availabilityStatus === 'Busy' ? 'bg-amber-400' : 'bg-stone-500'
                    }`} />
                    <span className="font-bold">{partner?.availabilityStatus || 'Offline'}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/50 font-semibold uppercase tracking-widest">Account State</span>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg transition-all ${
                      partner?.isVerified 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${partner?.isVerified ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {partner?.isVerified ? 'KYC Verified' : 'KYC Not Verified'}
                      </span>
                    </div>
                    {partner?.kycStatus === 'pending' && (
                      <span className="text-[9px] text-amber-400 font-bold uppercase tracking-widest italic animate-pulse">Verification in Progress</span>
                    )}
                    {partner?.kycStatus === 'rejected' && (
                      <div className="mt-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-left">
                        <p className="text-[9px] text-rose-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                          <AlertCircle size={10} /> Rejection Reason
                        </p>
                        <p className="text-[10px] text-white/60 italic leading-snug">"{partner.kycRejectReason || 'Identification documents were unclear.'}"</p>
                        <p className="text-[8px] text-rose-300 mt-2 font-bold uppercase">Please re-submit documents</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 mt-8">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="w-full bg-white/5 border border-white/10 py-5 rounded-2xl text-sm font-bold hover:bg-white hover:text-stone-900 transition-all"
                  id="edit-profile-btn"
                >
                  Edit Professional Profile
                </button>
                {!partner?.isVerified && partner?.kycStatus !== 'pending' && (
                  <button 
                    onClick={() => {
                       setKycDocs([{ type: '', url: '' }, { type: '', url: '' }]);
                       setIsKYCModalOpen(true);
                    }}
                    className="w-full bg-amber-500/20 border border-amber-500/30 py-4 rounded-2xl text-sm font-bold text-amber-500 hover:bg-amber-500 hover:text-stone-900 transition-all"
                  >
                    {partner?.kycStatus === 'rejected' ? 'Re-submit KYC Documents' : 'Submit KYC Documents'}
                  </button>
                )}
              </div>
            </div>
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-[100px] z-0" />
          </div>

          <AnimatePresence>
            {isEditing && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                  id="edit-profile-modal"
                >
                  <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                      <h2 className="text-2xl font-bold text-stone-900">Edit Profile</h2>
                      <p className="text-stone-500 text-sm">Update your public presence and services</p>
                    </div>
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="p-8 overflow-y-auto flex-1 space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Basic Information</h3>
                      <div className="flex gap-6 items-center">
                        <div className="relative group italic">
                          <img 
                            src={editForm.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.displayName}`} 
                            alt="Profile" 
                            className="w-20 h-20 rounded-3xl object-cover bg-stone-100"
                          />
                          <div className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Camera size={20} className="text-white" />
                          </div>
                        </div>
                        <div className="flex-1 space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1 uppercase">Display Name</label>
                            <input 
                              type="text"
                              value={editForm.displayName}
                              onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                              className="w-full bg-stone-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-stone-900"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1 uppercase">Photo URL</label>
                            <input 
                              type="text"
                              placeholder="https://example.com/photo.jpg"
                              value={editForm.photoURL}
                              onChange={(e) => setEditForm({ ...editForm, photoURL: e.target.value })}
                              className="w-full bg-stone-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-stone-900"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">About You</h3>
                      <div>
                        <label className="block text-xs font-bold text-stone-500 mb-1 ml-1 uppercase">Bio / Description</label>
                        <textarea 
                          rows={4}
                          value={editForm.bio}
                          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                          placeholder="Tell customers about your experience and the quality of work you provide..."
                          className="w-full bg-stone-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-stone-900 resize-none"
                        />
                      </div>
                    </div>

                    {/* Categories */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest text-balance">Service Categories</h3>
                      <p className="text-sm text-stone-500 ml-1">Select the categories you specialize in</p>
                      <div className="grid grid-cols-2 gap-3">
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                              editForm.selectedCategories.includes(cat.id)
                                ? 'bg-stone-900 border-stone-900 text-white'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                            }`}
                          >
                            <span className="text-sm font-bold">{cat.name}</span>
                            {editForm.selectedCategories.includes(cat.id) && <Check size={16} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Working Hours */}
                    <div className="space-y-6">
                       <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Working Hours</h3>
                       <div className="space-y-3">
                          {editForm.workingHours.map((wh, idx) => (
                            <div key={wh.day} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-stone-50 rounded-2xl gap-4">
                               <div className="flex items-center gap-3">
                                  <input 
                                    type="checkbox"
                                    checked={wh.enabled}
                                    onChange={(e) => {
                                      const newHours = [...editForm.workingHours];
                                      newHours[idx].enabled = e.target.checked;
                                      setEditForm({ ...editForm, workingHours: newHours });
                                    }}
                                    className="w-5 h-5 rounded-lg text-stone-900 focus:ring-stone-900 border-stone-200"
                                  />
                                  <span className="text-sm font-bold w-20">{wh.day}</span>
                               </div>
                               <div className="flex items-center gap-2">
                                  <input 
                                    type="time"
                                    value={wh.startTime}
                                    onChange={(e) => {
                                      const newHours = [...editForm.workingHours];
                                      newHours[idx].startTime = e.target.value;
                                      setEditForm({ ...editForm, workingHours: newHours });
                                    }}
                                    className="bg-white border-none rounded-lg p-2 text-xs font-bold"
                                  />
                                  <span className="text-stone-300">to</span>
                                  <input 
                                    type="time"
                                    value={wh.endTime}
                                    onChange={(e) => {
                                      const newHours = [...editForm.workingHours];
                                      newHours[idx].endTime = e.target.value;
                                      setEditForm({ ...editForm, workingHours: newHours });
                                    }}
                                    className="bg-white border-none rounded-lg p-2 text-xs font-bold"
                                  />
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>

                  <div className="p-8 border-t border-stone-100 bg-stone-50/50 flex gap-4">
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-stone-500 hover:bg-stone-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveProfile}
                      disabled={loading || editForm.selectedCategories.length === 0}
                      className="flex-[2] bg-stone-900 text-white px-6 py-4 rounded-2xl text-sm font-bold hover:bg-black transition-colors disabled:opacity-50 shadow-lg shadow-stone-200"
                    >
                      {loading ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Active Conversations */}
          {bookings.some(b => b.status === 'confirmed' || b.status === 'in_progress') && (
            <div className="bg-white p-8 border border-stone-200 rounded-[40px]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg">Active Chats</h3>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Live</span>
              </div>
              <div className="space-y-3">
                {bookings
                  .filter(b => b.status === 'confirmed' || b.status === 'in_progress')
                  .slice(0, 3)
                  .map((booking) => {
                    const customer = customers[booking.customerId];
                    return (
                      <button 
                        key={booking.id}
                        onClick={() => setActiveBookingChat(booking)}
                        className="w-full flex items-center gap-3 p-3 bg-stone-50 rounded-2xl hover:bg-stone-100 transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-stone-100 shadow-sm flex-shrink-0">
                          {customer?.photoURL ? (
                            <img src={customer.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Clock size={16} className="text-stone-300" />
                          )}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-sm font-bold text-stone-900 truncate">{customer?.displayName || 'Loading...'}</p>
                          <p className="text-[10px] text-stone-400 font-medium uppercase tracking-tight truncate">
                            {services[booking.serviceId]?.name || 'Service Chat'}
                          </p>
                        </div>
                        <div className="p-2 bg-stone-900 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                          <MessageSquare size={14} />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white p-8 border border-stone-200 rounded-[40px]">
            <h3 className="font-bold text-lg mb-6">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-3">
              {[
                { title: 'Update Availability', icon: Calendar, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
                { title: 'Service Pricing', icon: DollarSign },
                { title: 'Help Center', icon: AlertCircle, onClick: () => {
                   const whatsappUrl = `https://wa.me/${import.meta.env.VITE_WHATSAPP_SUPPORT_NUMBER}?text=Hi, I am a partner and I need support. My User ID is ${profile.uid}`;
                   window.open(whatsappUrl, '_blank');
                }}
              ].map((item: any, i) => (
                <button 
                  key={i} 
                  onClick={item.onClick}
                  className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl group hover:bg-stone-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className="text-stone-400 group-hover:text-stone-900" />
                    <span className="text-sm font-semibold">{item.title}</span>
                  </div>
                  <ChevronRight size={16} className="text-stone-300 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {cancellingBookingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 text-rose-600 mb-6">
                <AlertCircle size={24} />
                <h3 className="text-xl font-bold">Cancel Booking</h3>
              </div>
              <p className="text-stone-500 text-sm mb-6">Please provide a reason for cancelling this booking. This will be visible to the customer.</p>
              <textarea 
                rows={4}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Health emergency, vehicle issues..."
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-stone-900 focus:outline-none mb-6 resize-none"
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setCancellingBookingId(null);
                    setCancelReason('');
                  }}
                  className="flex-1 py-3 text-stone-500 font-bold hover:bg-stone-50 rounded-xl transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={handleCancelBooking}
                  disabled={!cancelReason || loading}
                  className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Confirm Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {closingBookingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 text-stone-900 mb-6">
                <CheckCircle2 size={24} />
                <h3 className="text-xl font-bold">Complete Job</h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-3 tracking-widest">Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['online', 'cash'].map((method) => (
                      <button
                        key={method}
                        onClick={() => setClosingForm({ ...closingForm, paymentMethod: method as 'online' | 'cash' })}
                        className={`py-3 rounded-xl text-xs font-bold capitalize transition-all ${
                          closingForm.paymentMethod === method 
                            ? 'bg-stone-900 text-white shadow-lg' 
                            : 'bg-stone-50 text-stone-400 hover:bg-stone-100'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest">Extra Charges (Optional)</label>
                  <div className="grid grid-cols-1 gap-3">
                    <input 
                      type="number"
                      placeholder="Extra Amount (₹)"
                      value={closingForm.extraAmount}
                      onChange={(e) => setClosingForm({ ...closingForm, extraAmount: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-900 focus:outline-none"
                    />
                    <input 
                      type="text"
                      placeholder="Why extra charge? (e.g. Spare parts)"
                      value={closingForm.extraReason}
                      onChange={(e) => setClosingForm({ ...closingForm, extraReason: e.target.value })}
                      disabled={!closingForm.extraAmount}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-900 focus:outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setClosingBookingId(null)}
                    className="flex-1 py-3 text-stone-500 font-bold hover:bg-stone-50 rounded-xl transition-colors"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleCloseBooking}
                    disabled={loading || (!!closingForm.extraAmount && !closingForm.extraReason)}
                    className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Complete & Close'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isKYCModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] p-10 max-w-lg w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-stone-900 italic">KYC Verification</h3>
                  <p className="text-stone-500 text-sm">Upload 2 identity documents for verification</p>
                </div>
                <button onClick={() => setIsKYCModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  {kycDocs.map((doc, idx) => (
                    <div key={idx} className="p-6 bg-stone-50/50 border-2 border-dashed border-stone-200 rounded-[32px] group hover:border-stone-900 transition-all">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                             <div className={`p-2.5 rounded-xl ${doc.url ? 'bg-emerald-500 text-white' : 'bg-white text-stone-300'}`}>
                               <FileText size={18} />
                             </div>
                             <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Document Slot {idx + 1}</p>
                          </div>
                          {doc.url && (
                             <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[9px] uppercase tracking-widest">
                               <Check size={12} strokeWidth={3} /> Uploaded
                             </div>
                          )}
                        </div>

                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Type of ID</label>
                             <select 
                               value={doc.type}
                               onChange={(e) => {
                                 const n = [...kycDocs];
                                 n[idx].type = e.target.value;
                                 setKycDocs(n);
                               }}
                               className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-stone-900"
                             >
                                <option value="">Select ID Type</option>
                                <option value="Aadhar Card">Aadhar Card</option>
                                <option value="PAN Card">PAN Card</option>
                                <option value="Voter ID">Voter ID</option>
                                <option value="Driving License">Driving License</option>
                                <option value="Address Proof">Address Proof</option>
                             </select>
                           </div>
                           <div className="flex items-end">
                            {!doc.url ? (
                              <button 
                                onClick={() => {
                                  const newDocs = [...kycDocs];
                                  newDocs[idx].url = `https://mock-storage.com/${profile.uid}_${idx}_${Date.now()}.jpg`;
                                  setKycDocs(newDocs);
                                }}
                                className="w-full bg-stone-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-stone-200"
                              >
                                Select Image
                              </button>
                            ) : (
                              <button 
                                onClick={() => {
                                  const n = [...kycDocs];
                                  n[idx].url = '';
                                  setKycDocs(n);
                                }}
                                className="w-full bg-stone-100 text-stone-400 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-rose-500 transition-all"
                              >
                                Replace File
                              </button>
                            )}
                           </div>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl text-amber-900">
                  <div className="flex gap-3">
                    <ShieldCheck size={18} className="shrink-0 text-amber-500" />
                    <div className="text-[11px] space-y-2 leading-relaxed">
                      <p className="font-black uppercase tracking-widest mb-1">Verification Protocol</p>
                      <p>Verification usually takes <b>24-48 hours</b>. Once verified, you'll receive a <b>Pro Badge</b> and your listing will be prioritized for customer searches.</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleUploadKYC}
                  disabled={loading || kycDocs.every(d => !d.url) || kycDocs.some(d => d.url && !d.type)}
                  className="w-full bg-stone-900 text-white py-5 rounded-[24px] font-bold hover:bg-black transition-all disabled:opacity-50 shadow-2xl shadow-stone-900/20 uppercase tracking-widest text-xs"
                >
                  {loading ? 'Submitting...' : 'Complete KYC Submission'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {managingStatusBookingId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-stone-900">Manage Job Status</h3>
                  <p className="text-stone-500 text-sm">Update the current state of this job manually.</p>
                </div>
                <button onClick={() => setManagingStatusBookingId(null)} className="p-2 hover:bg-stone-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              {bookings.find(b => b.id === managingStatusBookingId)?.status === 'completed' || 
               bookings.find(b => b.id === managingStatusBookingId)?.status === 'finalized' ? (
                <div className="space-y-6">
                  <div className="p-6 bg-stone-50 rounded-3xl border border-stone-200 text-center">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} />
                    </div>
                    <h4 className="text-lg font-bold mb-2">Job is Closed</h4>
                    <p className="text-stone-500 text-sm leading-relaxed">
                      This job is marked as <b>{bookings.find(b => b.id === managingStatusBookingId)?.status}</b>. 
                      Only Admins can modify status once a job is closed to maintain financial auditing integrity.
                    </p>
                  </div>
                  <button 
                    onClick={() => setManagingStatusBookingId(null)}
                    className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-3 tracking-widest">Select New Status</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'confirmed', label: 'Assigned (Active)', color: 'bg-green-500' },
                        { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
                        { id: 'pending', label: 'Hold / Pending', color: 'bg-orange-500' },
                        { id: 'completed', label: 'Closed / Done', color: 'bg-emerald-500' },
                        { id: 'cancelled', label: 'Cancelled', color: 'bg-rose-500' },
                        { id: 'reject', label: 'Re-assign Job', color: 'bg-stone-500' }
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() => setStatusForm({ ...statusForm, status: st.id as any })}
                          className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 ${
                            statusForm.status === st.id 
                              ? 'border-stone-900 bg-stone-50' 
                              : 'border-transparent bg-stone-50/50 hover:bg-stone-50'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${st.color}`} />
                          <span className="text-xs font-bold text-stone-900">{st.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {statusForm.status === 'pending' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 p-6 bg-orange-50 border border-orange-100 rounded-3xl"
                    >
                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Pending Details</p>
                      <div className="space-y-3">
                        <input 
                          type="text"
                          placeholder="Reason for delay (e.g. Parts pending)"
                          value={statusForm.pendingReason}
                          onChange={(e) => setStatusForm({ ...statusForm, pendingReason: e.target.value })}
                          className="w-full bg-white border border-orange-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[8px] font-bold text-orange-400 uppercase mb-1 ml-1">Resolve Date</label>
                            <input 
                              type="datetime-local"
                              value={statusForm.pendingDate}
                              onChange={(e) => setStatusForm({ ...statusForm, pendingDate: e.target.value })}
                              className="w-full bg-white border border-orange-200 rounded-xl px-4 py-2 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-orange-400 uppercase mb-1 ml-1">Expected Duration</label>
                            <input 
                              type="text"
                              placeholder="e.g. 2 days"
                              value={statusForm.pendingDuration}
                              onChange={(e) => setStatusForm({ ...statusForm, pendingDuration: e.target.value })}
                              className="w-full bg-white border border-orange-200 rounded-xl px-4 py-2 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {statusForm.status === 'reject' && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                      <p className="text-xs text-rose-700 font-medium">
                        <strong>Note:</strong> Re-assigning will remove you from this job and return it to the available jobs pool.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setManagingStatusBookingId(null)}
                      className="flex-1 py-4 text-stone-500 font-bold hover:bg-stone-50 rounded-2xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      disabled={loading || !statusForm.status || (statusForm.status === 'pending' && !statusForm.pendingReason)}
                      onClick={handleManualStatusUpdate}
                      className="flex-[2] bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-stone-200 disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Apply Status Change'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {verifyingOTPId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[48px] p-10 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-8">
                <ShieldCheck size={40} />
              </div>
              <h2 className="text-3xl font-display font-bold text-stone-900 mb-2 italic">Verify Customer OTP</h2>
              <p className="text-stone-500 text-sm mb-8 leading-relaxed">
                Please enter the 6-digit code provided by the customer to verify your arrival and start the session.
              </p>

              <div className="space-y-6">
                <div>
                  <input 
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setOtpInput(val);
                      if (otpError) setOtpError(false);
                    }}
                    placeholder="0 0 0 0 0 0"
                    className={`w-full text-center text-4xl font-black tracking-[0.2em] py-6 bg-stone-50 rounded-3xl border-2 transition-all outline-none ${
                       otpError ? 'border-rose-200 text-rose-500 bg-rose-50' : 'border-stone-100 text-stone-900 focus:border-stone-900'
                    }`}
                  />
                  {otpError && (
                    <p className="text-rose-500 text-xs font-bold mt-3 uppercase tracking-widest flex items-center justify-center gap-1">
                      <AlertCircle size={12} /> Invalid OTP. Please try again.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={verifyServiceOTP}
                    disabled={otpInput.length < 6 || verifyingLoading}
                    className="w-full bg-stone-900 text-white py-5 rounded-3xl font-bold hover:bg-black transition-all shadow-xl shadow-stone-200 disabled:opacity-50 text-xs font-black uppercase tracking-widest"
                  >
                    {verifyingLoading ? 'Verifying...' : 'Verify & Start Job'}
                  </button>
                  <button 
                    onClick={() => {
                      setVerifyingOTPId(null);
                      setOtpError(false);
                    }}
                    className="w-full bg-stone-50 text-stone-500 py-4 rounded-3xl font-bold hover:bg-stone-100 transition-all text-xs font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeBookingChat && (
          <ChatWindow 
            booking={activeBookingChat}
            otherUser={customers[activeBookingChat.customerId] || null}
            onClose={() => setActiveBookingChat(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
