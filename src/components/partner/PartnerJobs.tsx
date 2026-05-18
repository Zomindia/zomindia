import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  History, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  X,
  User,
  ChevronRight,
  MessageSquare,
  DollarSign,
  Phone,
  Navigation,
  FileText,
  Smartphone,
  ShieldCheck,
  Zap,
  MoreVertical,
  Camera,
  Archive,
  Star,
  Calendar
} from 'lucide-react';
import { PartnerProfile, Booking, UserProfile, Service } from '../../types';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp, addDoc, onSnapshot, deleteField } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { notifyBookingUpdate } from '../../lib/notifications';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import ChatWindow from '../ChatWindow';
import AudioCall from '../AudioCall';
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { useLocationTracking } from '../../hooks/useLocationTracking';

interface Props {
  partner: PartnerProfile | null;
  bookings: Booking[];
  initialExpandedBookingId?: string | null;
}

function JobLocationMap({ bookingId, address, lat, lng }: { bookingId: string, address: string, lat?: number | null, lng?: number | null }) {
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(lat && lng ? { lat, lng } : null);
  const [localAddress, setLocalAddress] = useState(address);
  // Track if map is loaded and ready
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (typeof google === 'undefined') return;
    if (lat && lng) {
      setCoords({ lat, lng });
      // If address looks like coordinates, try to reverse geocode it to get a real address
      if (address.includes('Location detected') || address.includes('[') || (address.includes(',') && !isNaN(parseFloat(address.split(',')[0])))) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            setLocalAddress(results[0].formatted_address);
          } else {
            setLocalAddress(address);
          }
        });
      } else {
        setLocalAddress(address);
      }
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location;
        setCoords({ lat: loc.lat(), lng: loc.lng() });
        setLocalAddress(results[0].formatted_address);
      }
    });
  }, [address, lat, lng]);

  const handleMapClick = async (e: any) => {
    if (typeof google === 'undefined') return;
    let newCoords;
    if (e.latLng) {
      newCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    } else if (e.detail?.latLng) {
      newCoords = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };
    } else {
      return;
    }
    if (isUpdating) return;
    setIsUpdating(true);
    
    try {
      const geocoder = new google.maps.Geocoder();
      const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoder.geocode({ location: newCoords }, (res, status) => {
          if (status === 'OK' && res) resolve(res);
          else reject(status);
        });
      });
      
      const newAddress = results[0]?.formatted_address || 'Selected Location';
      setCoords(newCoords);
      setLocalAddress(newAddress);
      
      await updateDoc(doc(db, 'bookings', bookingId), {
        lat: newCoords.lat,
        lng: newCoords.lng,
        address: newAddress,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      console.error('Failed to update location', err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!coords) return (
    <div className="w-full h-32 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200">
      <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col gap-2 my-3">
      <div className="w-full h-32 rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative">
        {isUpdating && (
          <div className="absolute inset-0 z-10 bg-white/50 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div className="absolute z-10 top-2 left-2 right-2 bg-slate-900/80 backdrop-blur-sm text-white text-[9px] font-medium p-2 rounded-xl text-center pointer-events-none">
          Drag pin to adjust exact location
        </div>
        <Map
          defaultCenter={coords}
          center={coords}
          defaultZoom={15}
          mapId="PARTNER_APP_JOB_MAP"
          gestureHandling="auto"
          disableDefaultUI
          className="w-full h-full"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          <AdvancedMarker 
            position={coords} 
            draggable={true} 
            onDragEnd={handleMapClick}
          >
            <Pin background="#1c1917" glyphColor="#fff" borderColor="#000" />
          </AdvancedMarker>
        </Map>
      </div>
      <div className="text-[10px] text-slate-500 font-medium">
        <span className="font-bold text-slate-900">Address:</span> {localAddress}
      </div>
    </div>
  );
}

export default function PartnerJobs({ partner, bookings, initialExpandedBookingId }: Props) {
  const [tab, setTab] = useState<'pending' | 'ongoing' | 'history'>('ongoing');
  const [customers, setCustomers] = useState<Record<string, UserProfile>>({});
  const [services, setServices] = useState<Record<string, Service>>({});
  const [activeChat, setActiveChat] = useState<Booking | null>(null);
  const [activeCallBooking, setActiveCallBooking] = useState<Booking | null>(null);
  const [verifyingOTPId, setVerifyingOTPId] = useState<string | null>(null);
  const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);
  const [confirmFinishId, setConfirmFinishId] = useState<string | null>(null);
  const [chargeForm, setChargeForm] = useState({ amount: '', reason: '' });
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Implement real-time location tracking
  useLocationTracking(partner?.id, bookings, partner?.availabilityStatus);

  useEffect(() => {
    if (initialExpandedBookingId) {
      const b = bookings.find(x => x.id === initialExpandedBookingId);
      if (b) {
        if (['pending'].includes(b.status)) setTab('pending');
        else if (['completed', 'finalized', 'cancelled'].includes(b.status)) setTab('history');
        else setTab('ongoing');
        
        setSelectedBooking(b);
        if (b.status === 'arrived') {
          setVerifyingOTPId(b.id);
        }

        setTimeout(() => {
           const el = document.getElementById(`booking-${initialExpandedBookingId}`);
           if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
      }
    }
  }, [initialExpandedBookingId, bookings.length]);

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

      setChargeForm({ amount: '', reason: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishJob = async (booking: Booking) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'completed', 
        paymentStatus: booking.paymentMethod === 'cash' ? 'paid' : booking.paymentStatus,
        updatedAt: Timestamp.now()
      });

      // Update partner earnings
      if (partner) {
        const rewardPts = 10;
        await updateDoc(doc(db, 'partners', partner.id), {
          totalEarnings: (partner.totalEarnings || 0) + booking.totalPrice,
          rewardCredits: (partner.rewardCredits || 0) + rewardPts,
          updatedAt: Timestamp.now()
        });

        await addDoc(collection(db, 'partners', partner.id, 'earningsHistory'), {
          type: 'booking_earning',
          amount: booking.totalPrice,
          credits: rewardPts,
          bookingId: booking.id,
          reason: `Completed service: ${services[booking.serviceId]?.name || 'Job'}`,
          createdAt: Timestamp.now()
        });
      }

      // Check for user referral processing
      fetch('/api/process-referral-reward', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ customerId: booking.customerId })
      }).catch(err => console.error('Failed to trigger referral reward', err));

      // Trigger final bill email
      fetch('/api/send-final-bill', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ bookingId: booking.id })
      }).catch(err => console.error('Failed to trigger bill email', err));

      notifyBookingUpdate({ ...booking, status: 'completed' }, 'completed', partner?.userId || '');
      setCompletingBookingId(null);
      if (selectedBooking?.id === booking.id) {
        setSelectedBooking(prev => prev ? { ...prev, status: 'completed' } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter Bookings
  const PRIORITY_ORDER = { high: 3, medium: 2, low: 1, undefined: 0 };
  const getPriority = (b: Booking) => PRIORITY_ORDER[(b.partnerPriority || 'undefined') as keyof typeof PRIORITY_ORDER] || 0;

  const ongoingJobs = bookings
    .filter(b => ['confirmed', 'on_the_way', 'arrived', 'in_progress'].includes(b.status))
    .sort((a, b) => {
      const pDiff = getPriority(b) - getPriority(a);
      if (pDiff !== 0) return pDiff;
      // Secondary sort: newly scheduled first? Or status? 
      // simple secondary sort
      return (b.scheduledAt?.seconds || 0) - (a.scheduledAt?.seconds || 0);
    });
  const pendingInvitations = bookings.filter(b => b.status === 'assigned' || (b.status === 'pending' && !b.partnerId)); 
  const historyJobs = bookings.filter(b => ['completed', 'finalized', 'cancelled'].includes(b.status));

  // Sync Customers & Services (Optimization: could be handled in parent and passed down)
  useEffect(() => {
    const fetchMissingData = async () => {
      const customerIds = Array.from(new Set(bookings.map(b => b.customerId))).filter(id => !customers[id]);
      const serviceIds = Array.from(new Set(bookings.map(b => b.serviceId))).filter(id => !services[id]);

      if (customerIds.length > 0) {
        const uq = query(collection(db, 'users'), where('uid', 'in', customerIds.slice(0, 10)));
        const snap = await getDocs(uq);
        const fetched: Record<string, UserProfile> = {};
        snap.forEach(d => fetched[d.id] = d.data() as UserProfile);
        setCustomers(prev => ({ ...prev, ...fetched }));
      }

      if (serviceIds.length > 0) {
        const fetchedServices: Record<string, Service> = {};
        for(const id of serviceIds) {
          const sSnap = await getDoc(doc(db, 'services', id));
          if (sSnap.exists()) fetchedServices[id] = { id: sSnap.id, ...sSnap.data() } as Service;
        }
        setServices(prev => ({ ...prev, ...fetchedServices }));
      }
    };
    fetchMissingData();
  }, [bookings]);

  const handleBookingUpdate = async (id: string, update: Partial<Booking>) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'bookings', id), { ...update, updatedAt: Timestamp.now() });
      const b = bookings.find(x => x.id === id);
      if (b) {
         notifyBookingUpdate({ ...b, ...update }, update.status as any, partner?.userId || '');
         if (selectedBooking?.id === id) {
           setSelectedBooking(prev => prev ? { ...prev, ...update } : null);
         }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!verifyingOTPId || !otpInput || !partner) return;
    setLoading(true);
    setOtpError(false);
    try {
      const res = await fetch('/api/verify-job-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: verifyingOTPId,
          partnerId: partner.userId,
          otp: otpInput
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerifyingOTPId(null);
        setOtpInput('');
        if (selectedBooking?.id === verifyingOTPId) {
          setSelectedBooking(prev => prev ? { ...prev, status: 'in_progress', otpVerified: true } : null);
        }
      } else {
        setOtpError(true);
      }
    } catch (err) {
      setOtpError(true);
    } finally {
      setLoading(false);
    }
  };

  const renderJobCard = (booking: Booking, isHistory = false) => {
    const customer = customers[booking.customerId];
    const service = services[booking.serviceId];

    return (
      <motion.div 
        layout
        id={`booking-${booking.id}`}
        key={booking.id}
        onClick={() => setSelectedBooking(booking)}
        className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
      >
         {/* Visual Accent */}
         <div className={`absolute top-0 left-0 w-1.5 h-full transition-all group-hover:w-2 ${
            ['confirmed', 'assigned', 'in_progress', 'on_the_way', 'arrived'].includes(booking.status) ? 'bg-emerald-500' :
            ['pending', 'pending_parts', 'payment_pending'].includes(booking.status) ? 'bg-amber-400' :
            ['completed', 'finalized'].includes(booking.status) ? 'bg-blue-700' :
            booking.status === 'cancelled' ? 'bg-rose-500' :
            'bg-slate-200'
         }`} />

          <div className="flex items-center gap-4 pl-2">
            {/* Main Info */}
            <div className="flex-1 min-w-0">
               <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">ID: {booking.id.slice(0, 6).toUpperCase()}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm ${
                    booking.status === 'in_progress' ? 'bg-blue-600 text-white animate-pulse' :
                    ['on_the_way', 'arrived'].includes(booking.status) ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
                    booking.status === 'cancelled' ? 'bg-rose-500 text-white' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {booking.status.replace('_', ' ')}
                  </span>
               </div>
               <h4 className="text-base font-black text-slate-900 leading-none mb-2 italic group-hover:text-blue-700 transition-colors uppercase tracking-tight">{service?.name || 'Loading...'}</h4>
               <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                  <span className="flex items-center px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 whitespace-nowrap">{booking.scheduledAt?.toDate?.()?.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  <span className="flex items-center px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 whitespace-nowrap">{booking.scheduledAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="flex items-center px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 whitespace-nowrap">{customer?.displayName || 'Client'}</span>
               </div>
               <div className="flex items-center text-[9px] text-slate-500 font-medium italic">
                  <span className="truncate">{booking.address}</span>
               </div>
            </div>

            {/* Payout & More */}
            <div className="text-right flex flex-col items-end gap-2 pl-4">
               <div className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl shadow-lg shadow-emerald-500/20">
                 <p className="text-[8px] font-black uppercase tracking-widest mb-0.5 text-emerald-200 leading-none">Net Payout</p>
                 <p className="text-lg font-black font-display leading-none">₹{booking.totalPrice}</p>
               </div>
               <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-700 group-hover:text-white group-hover:border-blue-700 transition-all shadow-sm">
                  <ChevronRight size={18} />
               </div>
            </div>
         </div>
      </motion.div>
    );
  };

  const renderBookingDetailsModal = () => {
    if (!selectedBooking) return null;
    const booking = selectedBooking;
    const customer = customers[booking.customerId];
    const service = services[booking.serviceId];
    const isHistory = ['completed', 'finalized', 'cancelled'].includes(booking.status);

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col bg-white"
      >
        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedBooking(null)} className="p-2 -ml-2 text-slate-400">
              <X size={24} />
            </button>
            <div>
              <h3 className="text-lg font-black italic tracking-tighter">Job Details</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">Booking #{booking.id.toUpperCase()}</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
            booking.status === 'in_progress' ? 'bg-blue-600 text-white animate-pulse' :
            booking.status === 'completed' || booking.status === 'finalized' ? 'bg-emerald-50 text-emerald-600' :
            'bg-slate-50 text-slate-500'
          }`}>
            {booking.status.replace('_', ' ')}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
          {/* Quick Actions */}
          {!isHistory && (
            <div className="grid grid-cols-3 gap-4">
               <button 
                 onClick={() => setActiveCallBooking(booking)}
                 className="flex flex-col items-center gap-3 p-5 rounded-[32px] bg-emerald-50 text-emerald-600 border border-emerald-100 hover:scale-95 transition-all"
               >
                 <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                   <Phone size={24} fill="currentColor" className="fill-emerald-200/30" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">In-App Call</span>
               </button>
               <button 
                 onClick={() => setActiveChat(booking)}
                 className="flex flex-col items-center gap-3 p-5 rounded-[32px] bg-blue-50 text-blue-700 border border-blue-100 hover:scale-95 transition-all"
               >
                 <div className="w-12 h-12 bg-blue-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-700/20">
                   <MessageSquare size={24} fill="currentColor" className="fill-blue-200/30" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">Message</span>
               </button>
               <button 
                 onClick={() => {
                   const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.lat},${booking.lng}`;
                   window.open(url, '_blank');
                 }}
                 className="flex flex-col items-center gap-3 p-5 rounded-[32px] bg-indigo-50 text-indigo-700 border border-indigo-100 hover:scale-95 transition-all"
               >
                 <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                   <Navigation size={24} />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">Navigate</span>
               </button>
            </div>
          )}

          {/* Service Info */}
          <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
             <div className="flex gap-6 mb-8">
                <div className="w-20 h-20 rounded-3xl bg-white p-1 border border-slate-200 overflow-hidden shrink-0 shadow-sm">
                   {service?.imageURL ? (
                     <img src={service.imageURL} alt="" className="w-full h-full object-cover rounded-2xl" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-200"><Briefcase size={32} /></div>
                   )}
                </div>
                <div className="flex-1">
                   <h4 className="text-2xl font-black text-slate-900 leading-tight italic">{service?.name || 'Service Order'}</h4>
                   <div className="flex items-center gap-2 mt-2">
                      <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center shadow-sm">
                         <Smartphone size={14} className="text-blue-500" />
                      </div>
                      <p className="text-sm font-bold text-slate-600">{customer?.displayName || 'Client'}</p>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Service Fee</p>
                   <p className="text-2xl font-black text-emerald-600 italic">₹{booking.totalPrice}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment</p>
                   <p className="text-sm font-bold text-slate-900 uppercase tracking-tighter">{booking.paymentMethod || 'cash'}</p>
                </div>
             </div>
          </div>

          {/* Location & Map */}
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <MapPin size={18} className="text-rose-500" />
                   <h5 className="text-sm font-black uppercase tracking-widest text-slate-900">Service Address</h5>
                </div>
                <button 
                  onClick={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.lat},${booking.lng}`;
                    window.open(url, '_blank');
                  }}
                  className="text-[10px] font-black text-blue-700 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
                >
                  Get Route
                </button>
             </div>
             <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-3xl border border-slate-100">
               {booking.address}
             </p>
             <JobLocationMap bookingId={booking.id} address={booking.address} lat={booking.lat} lng={booking.lng} />
          </div>

          {/* Live Chat Section */}
          <div className="space-y-4">
             <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-500" />
                <h5 className="text-sm font-black uppercase tracking-widest text-slate-900">Direct Message Client</h5>
             </div>
             <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                <ChatWindow 
                  booking={booking}
                  otherUser={customer || null}
                  isEmbedded={true}
                />
             </div>
          </div>

          {/* Service Protocol */}
          {booking.status === 'in_progress' && (
             <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Service Protocol</p>
                   <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">Mandatory Checks</span>
                </div>
                <div className="space-y-4">
                   {(services[booking.serviceId]?.predefinedTasks?.length ? services[booking.serviceId].predefinedTasks : ['Inspect issue & prep tools', 'Perform requested service', 'Clean workspace', 'Final check with customer']).map((task, i) => {
                     const isCompleted = booking.completedTasks?.includes(task || '');
                     return (
                       <label key={i} className="flex items-center gap-4 cursor-pointer group select-none">
                         <div className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 ${isCompleted ? 'bg-blue-700 border-blue-700 shadow-lg shadow-blue-700/20' : 'border-slate-300 bg-white group-hover:border-blue-400'}`}>
                           {isCompleted && <CheckCircle2 size={18} className="text-white" />}
                         </div>
                         <span className={`text-base font-bold transition-all duration-300 ${isCompleted ? 'text-slate-400 line-through decoration-2' : 'text-slate-700'}`}>{task}</span>
                         <input 
                           type="checkbox" 
                           className="hidden" 
                           checked={isCompleted || false}
                           onChange={() => {
                             const currentTasks = booking.completedTasks || [];
                             const updatedTasks = isCompleted 
                               ? currentTasks.filter(t => t !== task)
                               : [...currentTasks, task];
                             handleBookingUpdate(booking.id, { completedTasks: updatedTasks });
                           }}
                         />
                       </label>
                     );
                   })}
                </div>
             </div>
          )}

          {/* Lifecycle Buttons */}
          {!isHistory && (
            <div className="bg-white p-6 border-t border-slate-100 fixed bottom-0 left-0 right-0 z-20">
              {booking.status === 'assigned' && (
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleBookingUpdate(booking.id, { status: 'confirmed', partnerId: partner?.userId })}
                    className="flex-[2] bg-emerald-500 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-[12px] shadow-xl shadow-emerald-500/20"
                  >
                    Accept Job
                  </button>
                  <button 
                    onClick={() => handleBookingUpdate(booking.id, { status: 'pending', partnerId: deleteField() as any })}
                    className="flex-1 bg-slate-100 text-slate-400 py-5 rounded-3xl font-black uppercase tracking-widest text-[12px]"
                  >
                    Reject
                  </button>
                </div>
              )}

              {booking.status === 'confirmed' && (
                <button 
                  onClick={() => handleBookingUpdate(booking.id, { status: 'on_the_way' })}
                  className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-[12px] shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3"
                >
                  <Navigation size={18} /> Start Journey
                </button>
              )}

              {booking.status === 'on_the_way' && (
                <button 
                  onClick={async () => {
                    await handleBookingUpdate(booking.id, { status: 'arrived' });
                    setVerifyingOTPId(booking.id);
                  }}
                  className="w-full bg-amber-500 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-[12px] shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3"
                >
                  <Navigation size={18} /> I Have Arrived
                </button>
              )}

              {booking.status === 'arrived' && (
                <button 
                  onClick={() => setVerifyingOTPId(booking.id)}
                  className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-[12px] shadow-xl shadow-emerald-600/20"
                >
                  Verify Service OTP
                </button>
              )}

              {booking.status === 'in_progress' && (
                <div className="space-y-4">
                  {completingBookingId === booking.id ? (
                    <div className="p-6 bg-blue-700 text-white rounded-[32px] space-y-4 shadow-2xl">
                       <h5 className="font-black italic text-sm">Add Extra Charges?</h5>
                       <div className="grid grid-cols-2 gap-3">
                          <input 
                            type="number" 
                            placeholder="Rs"
                            value={chargeForm.amount}
                            onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                            className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm font-black focus:bg-white focus:text-slate-900 outline-none"
                          />
                          <input 
                            type="text" 
                            placeholder="Reason"
                            value={chargeForm.reason}
                            onChange={(e) => setChargeForm({ ...chargeForm, reason: e.target.value })}
                            className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:text-slate-900 outline-none"
                          />
                       </div>
                       <div className="flex gap-3">
                         <button 
                           onClick={() => setCompletingBookingId(null)}
                           className="flex-1 py-4 text-white/50 text-[10px] font-black uppercase"
                         >
                           Back
                         </button>
                         <button 
                           onClick={() => setConfirmFinishId(booking.id)}
                           className="flex-[2] bg-emerald-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                         >
                           Complete Payout
                         </button>
                       </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setCompletingBookingId(booking.id)}
                      className="w-full bg-blue-700 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-[12px] shadow-xl shadow-blue-700/20 flex items-center justify-center gap-3"
                    >
                      <CheckCircle2 size={18} /> Finish Job
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Tab Switcher */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 sticky top-0 z-30 flex justify-center">
         <div className="bg-slate-100 p-1 rounded-2xl flex w-full">
            {[
              { id: 'ongoing', label: 'Work', count: ongoingJobs.length },
              { id: 'pending', label: 'New', count: pendingInvitations.length },
              { id: 'history', label: 'Past', count: historyJobs.length },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                  tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${tab === t.id ? 'bg-blue-700 text-white' : 'bg-slate-300 text-white'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
         </div>
      </div>

      <div className="p-6 space-y-6 pb-24">
        <AnimatePresence mode="wait">
          {tab === 'ongoing' && (
            <motion.div 
              key="ongoing"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
               {ongoingJobs.length === 0 ? (
                 <div className="p-12 text-center bg-white rounded-[40px] border border-slate-100 border-dashed">
                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mx-auto mb-6">
                       <Zap size={32} />
                    </div>
                    <p className="font-black italic text-slate-300">Working Silence</p>
                 </div>
               ) : (
                 ongoingJobs.map(j => renderJobCard(j))
               )}
            </motion.div>
          )}

          {tab === 'pending' && (
            <motion.div 
              key="pending"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
               {pendingInvitations.length === 0 ? (
                 <div className="p-12 text-center bg-white rounded-[40px] border border-slate-100 border-dashed">
                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mx-auto mb-6">
                       <Archive size={32} />
                    </div>
                    <p className="font-black italic text-slate-300">No New Requests</p>
                 </div>
               ) : (
                 pendingInvitations.map(j => renderJobCard(j))
               )}
            </motion.div>
          )}

          {tab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
               {historyJobs.map(j => renderJobCard(j, true))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {renderBookingDetailsModal()}
      </AnimatePresence>

      {/* OTP Verification Modal Overlay */}
      <AnimatePresence>
        {verifyingOTPId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-blue-700/60 backdrop-blur-md">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[40px] p-10 w-full max-w-sm text-center shadow-2xl"
             >
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner ring-4 ring-emerald-500/10">
                   <ShieldCheck size={32} />
                </div>
                <h3 className="text-2xl font-black italic mb-2">Service Lock</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10">Ask customer for the 4-digit OTP</p>
                
                <div className="space-y-6">
                   <input 
                     type="number" 
                     value={otpInput}
                     onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                     className={`w-full bg-slate-50 border py-6 rounded-2xl text-center text-4xl font-black tracking-[0.2em] outline-none transition-all appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${otpError ? 'border-rose-500 text-rose-500 shadow-rose-100 ring-4 ring-rose-500/10' : 'border-slate-100 focus:ring-4 focus:ring-blue-700/10'}`}
                   />
                   {otpError && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest animate-bounce">Invalid PIN. Try Again.</p>}
                   
                   <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => { setVerifyingOTPId(null); setOtpInput(''); }}
                        className="flex-1 py-5 text-slate-400 font-black uppercase tracking-widest text-[10px]"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleVerifyOTP}
                        disabled={loading || otpInput.length < 4}
                        className="flex-[2] bg-emerald-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                      >
                        {loading ? '...' : 'Verify & Start'}
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmFinishId && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[40px] p-10 w-full max-w-sm text-center shadow-2xl space-y-8"
             >
                <div className="w-16 h-16 bg-blue-50 text-blue-700 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                   <CheckCircle2 size={32} />
                </div>
                <div>
                   <h3 className="text-2xl font-black italic mb-2">Finalize Job?</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">This action will complete the payout and close the service order permanently.</p>
                </div>
                
                <div className="flex flex-col gap-3">
                   <button 
                     onClick={() => {
                        const booking = bookings.find(b => b.id === confirmFinishId);
                        if (booking) handleFinishJob(booking);
                        setConfirmFinishId(null);
                     }}
                     disabled={loading}
                     className="w-full bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-700/20 active:scale-95 transition-all"
                   >
                     {loading ? 'Processing...' : 'Yes, Complete Job'}
                   </button>
                   <button 
                     onClick={() => setConfirmFinishId(null)}
                     className="w-full py-4 text-slate-400 font-black uppercase tracking-widest text-[10px]"
                   >
                     No, Go Back
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeChat && (
          <div className="fixed inset-0 z-[120]">
            <ChatWindow 
               booking={activeChat} 
               otherUser={customers[activeChat.customerId]} 
               onClose={() => setActiveChat(null)} 
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeCallBooking && (
          <AudioCall 
            otherUser={customers[activeCallBooking.customerId] || null}
            onEndCall={() => setActiveCallBooking(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
