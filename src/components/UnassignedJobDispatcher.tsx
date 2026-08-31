import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  doc, 
  updateDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { 
  Navigation, 
  UserCheck, 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Send, 
  Search, 
  Filter, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles, 
  RotateCw, 
  User, 
  Star, 
  Tag, 
  Briefcase, 
  DollarSign, 
  Check, 
  Lock, 
  Bell,
  ChevronRight,
  ArrowRight,
  Zap,
  CheckCircle,
  X
} from 'lucide-react';
import { notifyBookingUpdate } from '../lib/notifications';
import { Booking, PartnerProfile, UserProfile, Service, Category } from '../types';

export interface UnassignedJobDispatcherProps {
  bookings: Booking[];
  partners: (PartnerProfile & { displayName?: string })[];
  users: UserProfile[];
  services: Service[];
  categories: Category[];
}

/** Helper to format dynamic time elapsed */
function formatTimeAgo(timestamp: any): string {
  if (!timestamp) return "Just now";
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return "Recently";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Just now";
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `Booked ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Booked ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Booked ${diffDays}d ago`;
}

/** Helper to extract clean locality chip from address */
function extractLocality(address?: string): string {
  if (!address) return "Indore Central";
  const knownLocalities = [
    "Vijay Nagar", "Palasia", "Old Palasia", "New Palasia", "Bhawarkua",
    "MR-9", "MR-10", "Rajwada", "Sudama Nagar", "Annapurna", "Geeta Bhawan",
    "Chhavani", "Rau", "LIG Colony", "Bengali Square", "Bypass", "Mahalaxmi Nagar",
    "Khajrana", "Tilak Nagar", "Manoramaganj", "Sapna Sangeeta", "Silicon City",
    "Nipania", "Kanadia", "Bicholi Mardana", "Pardesipura", "Sukhlia", "Sarafa"
  ];
  const upperAddr = address.toUpperCase();
  for (const loc of knownLocalities) {
    if (upperAddr.includes(loc.toUpperCase())) {
      return loc;
    }
  }
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length > 0) {
    if (parts.length > 1 && /^[0-9#]/.test(parts[0])) {
      return parts[1];
    }
    return parts[0].slice(0, 22);
  }
  return "Indore";
}

export default function UnassignedJobDispatcher({
  bookings,
  partners,
  users,
  services,
  categories,
}: UnassignedJobDispatcherProps) {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [bookingFilter, setBookingFilter] = useState<'unassigned' | 'active' | 'all'>('unassigned');
  const [partnerStatusFilter, setPartnerStatusFilter] = useState<'all' | 'available' | 'indore'>('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [assigningPartnerId, setAssigningPartnerId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Auto-dismiss toast feedback after 5 seconds
  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  // Compute unassigned & active counts for live stats bar
  const unassignedCount = useMemo(() => {
    return bookings.filter(b => 
      !b.partnerId || 
      b.status === 'pending' || 
      b.status === 'pending_checkout' || 
      b.status === 'confirmed_pay_after_service' || 
      b.status === 'pending_acceptance' ||
      (b as any).status === 'broadcast'
    ).length;
  }, [bookings]);

  const onlinePartnersCount = useMemo(() => {
    return partners.filter(p => p.availabilityStatus === 'Available' || p.status === 'active').length;
  }, [partners]);

  // Filter bookings based on selected status & search query
  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const isUnassigned = 
        !booking.partnerId || 
        booking.status === 'pending' || 
        booking.status === 'pending_checkout' || 
        booking.status === 'confirmed_pay_after_service' || 
        booking.status === 'pending_acceptance' ||
        (booking as any).status === 'broadcast';

      const isActive = ['confirmed', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'payment_pending'].includes(booking.status);

      if (bookingFilter === 'unassigned' && !isUnassigned) return false;
      if (bookingFilter === 'active' && !isActive) return false;

      if (bookingSearch.trim()) {
        const query = bookingSearch.toLowerCase();
        const bId = (booking.id || '').toLowerCase();
        const custName = ((booking as any).customerName || (booking as any).customerData?.fullName || '').toLowerCase();
        const custPhone = ((booking as any).customerPhone || (booking as any).customerData?.mobile || (booking as any).customerData?.phoneNumber || '').toLowerCase();
        const address = (booking.address || '').toLowerCase();
        const service = services.find(s => s.id === booking.serviceId);
        const serviceName = (service?.name || '').toLowerCase();

        return (
          bId.includes(query) ||
          custName.includes(query) ||
          custPhone.includes(query) ||
          address.includes(query) ||
          serviceName.includes(query)
        );
      }

      return true;
    }).sort((a, b) => {
      const aUnassigned = (!a.partnerId || a.status === 'pending') ? 1 : 0;
      const bUnassigned = (!b.partnerId || b.status === 'pending') ? 1 : 0;
      if (aUnassigned !== bUnassigned) return bUnassigned - aUnassigned;
      
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bTime - aTime;
    });
  }, [bookings, bookingFilter, bookingSearch, services]);

  // Selected booking resolution
  const selectedBooking = useMemo(() => {
    if (selectedBookingId) {
      const found = bookings.find(b => b.id === selectedBookingId);
      if (found) return found;
    }
    return filteredBookings.length > 0 ? filteredBookings[0] : null;
  }, [selectedBookingId, bookings, filteredBookings]);

  // Auto sync selectedBookingId if first loads
  useEffect(() => {
    if (!selectedBookingId && filteredBookings.length > 0) {
      setSelectedBookingId(filteredBookings[0].id);
    }
  }, [filteredBookings, selectedBookingId]);

  // Filter and sort nearby/available Indore Partners
  const filteredPartners = useMemo(() => {
    const currentService = selectedBooking ? services.find(s => s.id === selectedBooking.serviceId) : null;
    const targetCatId = currentService?.categoryId;

    return partners.filter((p) => {
      const userDoc = users.find(u => u.uid === p.userId || u.uid === p.id) as any;
      
      const isApprovedPartner = 
        p.isVerified === true || 
        p.status === 'active' || 
        p.approvalStatus === 'approved' || 
        p.kycStatus === 'verified' || 
        p.kycStatus === 'approved' ||
        userDoc?.role === 'partner' ||
        userDoc?.isPartner === true;

      if (!isApprovedPartner) return false;

      if (partnerStatusFilter === 'available' && p.availabilityStatus !== 'Available') return false;
      if (partnerStatusFilter === 'indore') {
        const cityStr = String(p.city || userDoc?.city || '').toLowerCase();
        if (!cityStr.includes('indore') && cityStr !== '') return false;
      }

      if (partnerSearch.trim()) {
        const query = partnerSearch.toLowerCase();
        const name = String(p.fullName || p.displayName || userDoc?.displayName || '').toLowerCase();
        const phone = String(p.phone || userDoc?.phoneNumber || userDoc?.mobile || '').toLowerCase();
        const city = String(p.city || userDoc?.city || '').toLowerCase();

        return name.includes(query) || phone.includes(query) || city.includes(query);
      }

      return true;
    }).sort((a, b) => {
      // 1. Skill/Category match
      const aMatch = targetCatId && a.categories?.includes(targetCatId) ? 1 : 0;
      const bMatch = targetCatId && b.categories?.includes(targetCatId) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;

      // 2. Available status match
      const aAvail = a.availabilityStatus === 'Available' ? 1 : 0;
      const bAvail = b.availabilityStatus === 'Available' ? 1 : 0;
      if (aAvail !== bAvail) return bAvail - aAvail;

      // 3. Higher rating
      return (b.rating || 4.9) - (a.rating || 4.9);
    });
  }, [partners, users, selectedBooking, services, partnerStatusFilter, partnerSearch]);

  // Handle 1-Click Instant Partner Assignment
  const handleAssignPartner = async (partner: PartnerProfile & { displayName?: string }) => {
    if (!selectedBooking) {
      alert("Please select a pending job from the queue first.");
      return;
    }

    const bId = selectedBooking.id;
    const partnerUserId = partner.userId || partner.id;
    const partnerName = partner.fullName || partner.displayName || "Indore Service Partner";
    const partnerPhone = partner.phone || (partner as any).mobile || (partner as any).phoneNumber || "";

    setAssigningPartnerId(partnerUserId);
    setActionSuccess(null);

    try {
      // Generate OTP if not present
      const serviceOtp = selectedBooking.serviceOtp || Math.floor(1000 + Math.random() * 9000).toString();
      const serviceObj = services.find(s => s.id === selectedBooking.serviceId);
      const serviceName = serviceObj?.name || "Home Service";

      // 1. Firestore Atomic Update preserving all properties
      const updateData: any = {
        partnerId: partnerUserId,
        status: 'assigned',
        assignedAt: serverTimestamp(),
        serviceOtp,
        otpVerified: false,
        partnerData: {
          partnerId: partnerUserId,
          fullName: partnerName,
          phone: partnerPhone,
          rating: partner.rating || 4.9,
          reviewCount: partner.reviewCount || 12,
          isVerified: true,
          status: 'assigned'
        }
      };

      const bookingDocRef = doc(db, "bookings", bId);
      await updateDoc(bookingDocRef, updateData);

      // Store secret OTP record
      try {
        await setDoc(doc(db, `bookings/${bId}/secrets`, "otp"), { code: serviceOtp });
      } catch (e) {
        console.warn("Secret OTP write note:", e);
      }

      // 2. Dispatch Meta Cloud / Gupshup WhatsApp Business API Notifications
      const customerPhone = (selectedBooking as any).customerPhone || (selectedBooking as any).customerData?.mobile || (selectedBooking as any).customerData?.phoneNumber;
      const customerName = (selectedBooking as any).customerName || (selectedBooking as any).customerData?.fullName || "Valued Customer";

      if (partnerPhone) {
        fetch('/api/send-whatsapp-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: partnerPhone,
            name: partnerName,
            type: "EXPERT_ASSIGNED",
            params: {
              partnerName,
              partnerPhone,
              otp: serviceOtp,
              serviceName,
              bookingId: bId,
              address: selectedBooking.address || "Indore",
              trackingUrl: `https://zomindia.com/track/${bId}`
            }
          })
        }).catch(err => console.warn("[WhatsApp Dispatch Warning - Partner]:", err));
      }

      if (customerPhone) {
        fetch('/api/send-whatsapp-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: customerPhone,
            name: customerName,
            type: "EXPERT_ASSIGNED",
            params: {
              partnerName,
              partnerPhone,
              otp: serviceOtp,
              serviceName,
              bookingId: bId,
              address: selectedBooking.address || "Indore",
              trackingUrl: `https://zomindia.com/track/${bId}`
            }
          })
        }).catch(err => console.warn("[WhatsApp Dispatch Warning - Customer]:", err));
      }

      // 3. Dispatch Web Push & Notifications via Single Unified Pipeline
      notifyBookingUpdate({ ...selectedBooking, partnerId: partnerUserId, status: "assigned" }, "assigned", "admin");

      // Success Feedback Toast
      setActionSuccess(`Job #${bId.slice(-6).toUpperCase()} assigned to ${partnerName}`);

      // Auto-advance to the next unassigned booking in the queue
      const nextPending = filteredBookings.find(b => b.id !== bId && (!b.partnerId || b.status === 'pending'));
      if (nextPending) {
        setSelectedBookingId(nextPending.id);
      }

    } catch (err: any) {
      console.error("[Job Allocation Error]:", err);
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${bId}`);
    } finally {
      setAssigningPartnerId(null);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      
      {/* 1. Sleek Compact White Summary Header Bar (Uber/Zomato Fleet Dispatch Style) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
            <Zap size={20} className="fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                ⚡ Live Dispatch Hub
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Grid
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Indore real-time fleet allocation • 1-click professional assignment
            </p>
          </div>
        </div>

        {/* 3 Compact Badge Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/90 text-amber-900 text-xs font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{unassignedCount} Unassigned Jobs</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/90 text-emerald-900 text-xs font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{onlinePartnersCount} Online Partners</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/90 text-blue-900 text-xs font-bold shadow-2xs">
            <Sparkles size={13} className="text-blue-600" />
            <span>Auto-Match Available</span>
          </div>
        </div>
      </div>

      {/* Immediate Toast Notification Feedback */}
      <AnimatePresence>
        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="p-3.5 bg-emerald-600 text-white rounded-xl shadow-lg flex items-center justify-between gap-3 font-semibold text-xs"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-100" />
              <span>✅ {actionSuccess}</span>
            </div>
            <button 
              onClick={() => setActionSuccess(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Clear 2-Column Split Dispatch Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4.5 items-start">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: Pending Customer Queue (5 Cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col h-[calc(100vh-210px)] min-h-[580px]">
          
          {/* Header & Filter Controls */}
          <div className="space-y-3 pb-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-600" />
                Customer Queue ({filteredBookings.length})
              </h3>

              {/* Status Tabs */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  onClick={() => setBookingFilter('unassigned')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    bookingFilter === 'unassigned' 
                      ? 'bg-white text-blue-700 shadow-2xs font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Unassigned
                </button>
                <button
                  onClick={() => setBookingFilter('active')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    bookingFilter === 'active' 
                      ? 'bg-white text-blue-700 shadow-2xs font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Assigned
                </button>
                <button
                  onClick={() => setBookingFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    bookingFilter === 'all' 
                      ? 'bg-white text-blue-700 shadow-2xs font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {/* Quick Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search by customer, service, locality..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/90 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:bg-white focus:border-blue-600 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Scrollable Job Cards List */}
          <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1">
            {filteredBookings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <AlertCircle size={32} className="text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No jobs in this queue</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Try selecting a different filter or search term.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredBookings.map((booking) => {
                  const isSelected = selectedBooking?.id === booking.id;
                  const isUnassigned = !booking.partnerId || booking.status === 'pending';
                  const service = services.find(s => s.id === booking.serviceId);
                  const custName = (booking as any).customerName || (booking as any).customerData?.fullName || "Valued Customer";
                  const custPhone = (booking as any).customerPhone || (booking as any).customerData?.mobile || (booking as any).customerData?.phoneNumber || "N/A";
                  const locality = extractLocality(booking.address);
                  const timeElapsed = formatTimeAgo(booking.createdAt || (booking as any).createdAtTimestamp);
                  const assignedPartner = partners.find(p => p.userId === booking.partnerId || p.id === booking.partnerId);

                  return (
                    <motion.div
                      layout
                      key={booking.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
                      onClick={() => setSelectedBookingId(booking.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer relative select-none ${
                        isSelected 
                          ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-600/20 shadow-sm' 
                          : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Top Row: Service Name + Price + Status */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
                              #{booking.id.slice(-6).toUpperCase()}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">• {timeElapsed}</span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 truncate">
                            {service?.name || "Home Service Request"}
                          </h4>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-slate-900 block">₹{booking.totalPrice}</span>
                          <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            isUnassigned ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isUnassigned ? '⚠️ Pending' : '✅ Assigned'}
                          </span>
                        </div>
                      </div>

                      {/* Customer Details & Locality Chip */}
                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800 flex items-center gap-1 truncate">
                            <User size={12} className="text-slate-400 shrink-0" />
                            {custName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            📞 {custPhone}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                            <MapPin size={10} className="text-slate-400 shrink-0" />
                            {locality}
                          </span>

                          {assignedPartner ? (
                            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 truncate max-w-[130px]">
                              <ShieldCheck size={11} className="shrink-0" />
                              {assignedPartner.fullName || assignedPartner.displayName}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5">
                              Allocate <ChevronRight size={12} />
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Instant Partner Allocation Box (7 Cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 flex flex-col gap-4 h-[calc(100vh-210px)] min-h-[580px]">
          
          {/* Top Section: Selected Job Full Details Card */}
          {selectedBooking ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs shrink-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                      Focused Job #{selectedBooking.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {formatTimeAgo(selectedBooking.createdAt || (selectedBooking as any).createdAtTimestamp)}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    {services.find(s => s.id === selectedBooking.serviceId)?.name || "Home Service Request"}
                  </h3>
                </div>

                <div className="text-right bg-slate-50 border border-slate-200/90 p-2.5 rounded-xl shrink-0">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total Value</p>
                  <p className="text-base font-black text-emerald-600">₹{selectedBooking.totalPrice}</p>
                </div>
              </div>

              {/* 3-Pill Quick Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Customer</p>
                  <p className="font-bold text-slate-900 truncate mt-0.5">
                    {(selectedBooking as any).customerName || (selectedBooking as any).customerData?.fullName || "Customer"}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 truncate">
                    📞 {(selectedBooking as any).customerPhone || (selectedBooking as any).customerData?.mobile || (selectedBooking as any).customerData?.phoneNumber || "N/A"}
                  </p>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 sm:col-span-2">
                  <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Address & Location</p>
                  <p className="font-medium text-slate-800 text-[11px] line-clamp-2 mt-0.5">
                    📍 {selectedBooking.address || "Indore Municipal Area"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-200 p-5 rounded-2xl text-center text-xs text-slate-500 font-semibold shrink-0">
              Select a job from the left queue to view full service details and allocate partners.
            </div>
          )}

          {/* Bottom Section: Nearby / Available Indore Partners List */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex-1 flex flex-col overflow-hidden">
            
            {/* Header & Status Filter Controls */}
            <div className="space-y-3 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-emerald-600" />
                  Available Indore Fleet ({filteredPartners.length})
                </h3>

                {/* Partner Filters */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    onClick={() => setPartnerStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      partnerStatusFilter === 'all' 
                        ? 'bg-white text-slate-900 shadow-2xs font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All Fleet
                  </button>
                  <button
                    onClick={() => setPartnerStatusFilter('available')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      partnerStatusFilter === 'available' 
                        ? 'bg-emerald-600 text-white shadow-2xs font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Online Only
                  </button>
                  <button
                    onClick={() => setPartnerStatusFilter('indore')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      partnerStatusFilter === 'indore' 
                        ? 'bg-blue-600 text-white shadow-2xs font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Indore Local
                  </button>
                </div>
              </div>

              {/* Partner Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search partner name, mobile, skills, area..."
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-500 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Scrollable Partners Cards */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1">
              {filteredPartners.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <AlertCircle size={32} className="text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No matching partners found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Try toggling filters or checking partner onboarding status.</p>
                </div>
              ) : (
                filteredPartners.map((partner) => {
                  const userDoc = users.find(u => u.uid === partner.userId || u.uid === partner.id) as any;
                  const partnerName = partner.fullName || partner.displayName || userDoc?.displayName || "Indore Partner";
                  const partnerPhone = partner.phone || userDoc?.phoneNumber || userDoc?.mobile || "N/A";
                  const partnerId = partner.userId || partner.id;
                  const isAlreadyAssigned = selectedBooking?.partnerId === partnerId;
                  const isAssigningThis = assigningPartnerId === partnerId;
                  
                  // Skill check
                  const currentService = selectedBooking ? services.find(s => s.id === selectedBooking.serviceId) : null;
                  const isSkillMatch = Boolean(currentService?.categoryId && partner.categories?.includes(currentService.categoryId));

                  return (
                    <div
                      key={partnerId}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isAlreadyAssigned 
                          ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20' 
                          : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                      }`}
                    >
                      {/* Left: Avatar & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs flex items-center justify-center shadow-xs">
                            {partnerName.slice(0, 2).toUpperCase()}
                          </div>
                          <span 
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                              partner.availabilityStatus === 'Available' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`} 
                          />
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-black text-xs text-slate-900 truncate">{partnerName}</h4>
                            {isSkillMatch && (
                              <span className="bg-blue-100 text-blue-800 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                                Skill Match
                              </span>
                            )}
                            <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                              Verified
                            </span>
                          </div>

                          <p className="text-[10px] font-mono text-slate-600 font-semibold">
                            📞 {partnerPhone}
                          </p>

                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                            <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                              <Star size={10} className="fill-amber-400 text-amber-500" />
                              {partner.rating || 4.9}★
                            </span>
                            <span>•</span>
                            <span>{partner.city || "Indore"}</span>
                            <span>•</span>
                            <span>{partner.reviewCount || 15} jobs</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Direct 1-Click Action Button */}
                      <div className="shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <button
                          disabled={!selectedBooking || isAssigningThis || isAlreadyAssigned}
                          onClick={() => handleAssignPartner(partner)}
                          className={`w-full sm:w-auto px-4 py-2 rounded-xl font-black uppercase tracking-wider text-[11px] shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                            isAlreadyAssigned
                              ? 'bg-emerald-600 text-white cursor-default'
                              : isAssigningThis
                              ? 'bg-blue-400 text-white cursor-wait'
                              : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 shadow-blue-600/20'
                          } disabled:opacity-50 disabled:pointer-events-none`}
                        >
                          {isAssigningThis ? (
                            <>
                              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Assigning...
                            </>
                          ) : isAlreadyAssigned ? (
                            <>
                              <CheckCircle2 size={13} />
                              Assigned
                            </>
                          ) : (
                            <>
                              <span>Assign Now</span>
                              <ArrowRight size={13} />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
