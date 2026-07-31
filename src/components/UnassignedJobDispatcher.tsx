import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  doc, 
  updateDoc, 
  setDoc, 
  Timestamp, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  X
} from 'lucide-react';
import { notifyBookingUpdate, sendEcosystemNotification } from '../lib/notifications';
import { Booking, PartnerProfile, UserProfile, Service, Category } from '../types';

interface UnassignedJobDispatcherProps {
  bookings: Booking[];
  partners: (PartnerProfile & { displayName?: string })[];
  users: UserProfile[];
  services: Service[];
  categories: Category[];
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

  // Filter bookings based on selected status & search
  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      // Unassigned filter logic
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

      // Search matching
      if (bookingSearch.trim()) {
        const query = bookingSearch.toLowerCase();
        const bId = (booking.id || '').toLowerCase();
        const custName = ((booking as any).customerName || (booking as any).customerData?.fullName || '').toLowerCase();
        const custPhone = ((booking as any).customerPhone || (booking as any).customerData?.mobile || '').toLowerCase();
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
      // Sort unassigned/pending to top
      const aUnassigned = !a.partnerId ? 1 : 0;
      const bUnassigned = !b.partnerId ? 1 : 0;
      return bUnassigned - aUnassigned;
    });
  }, [bookings, bookingFilter, bookingSearch, services]);

  // Set default selected booking if none selected
  const selectedBooking = useMemo(() => {
    if (selectedBookingId) {
      return bookings.find(b => b.id === selectedBookingId) || null;
    }
    return filteredBookings.length > 0 ? filteredBookings[0] : null;
  }, [selectedBookingId, bookings, filteredBookings]);

  // Filter and sort active Indore Partners
  const filteredPartners = useMemo(() => {
    // Service category of currently selected booking for skill matching
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

  // Handle 1-Click Partner Assignment
  const handleAssignPartner = async (partner: PartnerProfile & { displayName?: string }) => {
    if (!selectedBooking) {
      alert("Please select a booking from the left list first!");
      return;
    }

    setAssigningPartnerId(partner.userId || partner.id);
    setActionSuccess(null);

    try {
      const bId = selectedBooking.id;
      const partnerUserId = partner.userId || partner.id;
      const partnerName = partner.fullName || partner.displayName || "Verified Indore Partner";
      const partnerPhone = partner.phone || (partner as any).mobile || "";

      // Service OTP code generation
      const serviceOtp = selectedBooking.serviceOtp || Math.floor(1000 + Math.random() * 9000).toString();
      const serviceObj = services.find(s => s.id === selectedBooking.serviceId);
      const serviceName = serviceObj?.name || "Home Service";

      // 1. Firestore Database Update
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

      await updateDoc(doc(db, "bookings", bId), updateData);

      // Store secret OTP record
      await setDoc(doc(db, `bookings/${bId}/secrets`, "otp"), { code: serviceOtp });

      // 2. Dispatch Instant WhatsApp Business API Notifications (Meta Cloud + Gupshup Engine)
      const customerPhone = (selectedBooking as any).customerPhone || (selectedBooking as any).customerData?.mobile || (selectedBooking as any).customerData?.phoneNumber;
      const customerName = (selectedBooking as any).customerName || (selectedBooking as any).customerData?.fullName || "Valued Customer";

      // Dispatch to Partner WhatsApp
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
              address: selectedBooking.address,
              trackingUrl: `https://zomindia.com/track/${bId}`
            }
          })
        }).catch(err => console.warn("[WhatsApp Dispatch Warning - Partner]:", err));
      }

      // Dispatch to Customer WhatsApp
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
              address: selectedBooking.address,
              trackingUrl: `https://zomindia.com/track/${bId}`
            }
          })
        }).catch(err => console.warn("[WhatsApp Dispatch Warning - Customer]:", err));
      }

      // 3. Dispatch Web Push & Ecosystem Notifications
      notifyBookingUpdate({ ...selectedBooking, partnerId: partnerUserId, status: "assigned" }, "assigned", "admin");
      sendEcosystemNotification(
        "all",
        "assigned",
        {
          bookingId: bId,
          customerId: selectedBooking.customerUid,
          partnerId: partnerUserId,
          customerName,
          partnerName,
          serviceName,
          dateTime: selectedBooking.scheduledAt?.toDate?.()?.toLocaleString() || "Today"
        }
      ).catch(e => console.error("Ecosystem notification failed:", e));

      // Success Feedback
      setActionSuccess(`🎉 Job #${bId.slice(-6)} allocated to ${partnerName}! Instant WhatsApp & Web Push alerts dispatched.`);

    } catch (err: any) {
      console.error("[Job Allocation Error]:", err);
      alert(`Failed to allocate job: ${err.message || 'Unknown error'}`);
    } finally {
      setAssigningPartnerId(null);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-br from-[#0a2540] via-[#050CA6] to-indigo-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_70%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-black uppercase tracking-widest text-emerald-300">
              <Sparkles size={14} /> Admin Dispatch Hub
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white italic">
              Unassigned Jobs & Indore Partner Dispatcher
            </h2>
            <p className="text-xs text-indigo-100/80 font-medium max-w-2xl leading-relaxed">
              Real-time job allocation center. Instantly assign pending customer requests to active Indore professionals. Self-rejection is locked for partners to maintain 100% service fulfillment.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 text-center">
              <span className="block text-2xl font-black text-amber-300">{bookings.filter(b => !b.partnerId || b.status === 'pending').length}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Unassigned</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 text-center">
              <span className="block text-2xl font-black text-emerald-400">{partners.filter(p => p.availabilityStatus === 'Available').length}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Active Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Toast Feedback */}
      <AnimatePresence>
        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            className="p-5 bg-emerald-500 text-white rounded-2xl shadow-xl flex items-center justify-between gap-4 font-bold text-xs"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button 
              onClick={() => setActionSuccess(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-all"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Split Dispatch Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Booking Selector & Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={16} className="text-[#050CA6]" />
                Customer Booking Queue ({filteredBookings.length})
              </h3>
              
              {/* Booking Status Filter Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
                <button
                  onClick={() => setBookingFilter('unassigned')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${bookingFilter === 'unassigned' ? 'bg-white text-[#050CA6] shadow-xs' : 'text-slate-500'}`}
                >
                  Unassigned
                </button>
                <button
                  onClick={() => setBookingFilter('active')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${bookingFilter === 'active' ? 'bg-white text-[#050CA6] shadow-xs' : 'text-slate-500'}`}
                >
                  Assigned
                </button>
                <button
                  onClick={() => setBookingFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${bookingFilter === 'all' ? 'bg-white text-[#050CA6] shadow-xs' : 'text-slate-500'}`}
                >
                  All
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search booking ID, customer, address..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#050CA6]/30 focus:bg-white transition-all"
              />
            </div>

            {/* Bookings Scroll List */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredBookings.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">No bookings match current filter.</p>
                </div>
              ) : (
                filteredBookings.map((b) => {
                  const isSelected = selectedBooking?.id === b.id;
                  const service = services.find(s => s.id === b.serviceId);
                  const custName = (b as any).customerName || (b as any).customerData?.fullName || "Customer";
                  const custPhone = (b as any).customerPhone || (b as any).customerData?.mobile || "N/A";
                  const assignedPartner = partners.find(p => p.userId === b.partnerId || p.id === b.partnerId);

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBookingId(b.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected 
                          ? 'bg-blue-50/60 border-[#050CA6] ring-2 ring-[#050CA6]/20 shadow-md' 
                          : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#050CA6] bg-blue-100/80 px-2 py-0.5 rounded-md">
                            #{b.id.slice(-6).toUpperCase()}
                          </span>
                          <h4 className="font-bold text-xs text-slate-900 mt-1">{service?.name || "Home Service"}</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-900">₹{b.totalPrice}</span>
                          <span className={`block text-[9px] font-black uppercase tracking-wider ${!b.partnerId ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {!b.partnerId ? '⚠️ Unassigned' : '✅ Assigned'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600 font-medium">
                        <p className="flex items-center gap-1.5 text-slate-800 font-semibold">
                          <User size={12} className="text-slate-400 shrink-0" />
                          <span>{custName} ({custPhone})</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-500 line-clamp-1">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span>{b.address || "Indore Location"}</span>
                        </p>
                        {assignedPartner && (
                          <p className="flex items-center gap-1.5 text-emerald-700 font-bold pt-1">
                            <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                            <span>Assigned: {assignedPartner.fullName || assignedPartner.displayName}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Indore Partner Directory & 1-Click Allocation (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Selected Booking Highlight Banner */}
          {selectedBooking ? (
            <div className="bg-slate-900 text-white p-6 rounded-[28px] shadow-xl space-y-4 border border-slate-800 relative overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2.5 py-1 rounded-full">
                    Target Booking for Dispatch
                  </span>
                  <h3 className="text-lg font-black text-white mt-2">
                    {services.find(s => s.id === selectedBooking.serviceId)?.name || "Home Service Request"}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium mt-1">
                    Booking ID: <span className="font-mono text-amber-300 font-bold">#{selectedBooking.id}</span>
                  </p>
                </div>
                <div className="text-right bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estimate</p>
                  <p className="text-xl font-black text-emerald-400">₹{selectedBooking.totalPrice}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Customer Details</p>
                  <p className="font-bold text-white mt-0.5">
                    {(selectedBooking as any).customerName || (selectedBooking as any).customerData?.fullName || "Customer"}
                  </p>
                  <p className="text-slate-300 font-mono text-[11px]">
                    📞 {(selectedBooking as any).customerPhone || (selectedBooking as any).customerData?.mobile || "N/A"}
                  </p>
                </div>

                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Location Address</p>
                  <p className="font-medium text-slate-200 mt-0.5 line-clamp-2">
                    📍 {selectedBooking.address || "Indore Location"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-[28px] text-amber-800 text-xs font-bold text-center">
              ⚠️ Please select a customer booking from the left queue to begin partner allocation.
            </div>
          )}

          {/* Indore Partners List */}
          <div className="bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <UserCheck size={16} className="text-emerald-600" />
                Active Indore Partners ({filteredPartners.length})
              </h3>

              {/* Partner Status Filter */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
                <button
                  onClick={() => setPartnerStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${partnerStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setPartnerStatusFilter('available')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${partnerStatusFilter === 'available' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'}`}
                >
                  Online Only
                </button>
                <button
                  onClick={() => setPartnerStatusFilter('indore')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${partnerStatusFilter === 'indore' ? 'bg-[#050CA6] text-white shadow-xs' : 'text-slate-500'}`}
                >
                  Indore
                </button>
              </div>
            </div>

            {/* Search Input for Partners */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search partner name, mobile, skills..."
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all"
              />
            </div>

            {/* Partner Cards List */}
            <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
              {filteredPartners.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">No active partners found matching criteria.</p>
                </div>
              ) : (
                filteredPartners.map((partner) => {
                  const userDoc = users.find(u => u.uid === partner.userId || u.uid === partner.id) as any;
                  const partnerName = partner.fullName || partner.displayName || userDoc?.displayName || "Indore Partner";
                  const partnerPhone = partner.phone || userDoc?.phoneNumber || userDoc?.mobile || "N/A";
                  const isAlreadyAssigned = selectedBooking?.partnerId === (partner.userId || partner.id);
                  const isAssigningThis = assigningPartnerId === (partner.userId || partner.id);

                  return (
                    <div
                      key={partner.id || partner.userId}
                      className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isAlreadyAssigned 
                          ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20' 
                          : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#050CA6] to-indigo-800 text-white font-black text-sm flex items-center justify-center shadow-md">
                            {partnerName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${partner.availabilityStatus === 'Available' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-xs text-slate-900">{partnerName}</h4>
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1">
                              <ShieldCheck size={10} /> Verified Indore
                            </span>
                            {partner.availabilityStatus === 'Available' && (
                              <span className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                                Online
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] font-mono text-slate-600 font-bold">
                            📞 {partnerPhone}
                          </p>

                          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-semibold pt-0.5">
                            <span className="flex items-center gap-1 text-amber-600 font-bold">
                              <Star size={11} className="fill-amber-400 text-amber-500" />
                              {partner.rating || 4.9}★
                            </span>
                            <span>•</span>
                            <span>{partner.city || "Indore"}</span>
                            <span>•</span>
                            <span>{partner.reviewCount || 15} jobs completed</span>
                          </div>
                        </div>
                      </div>

                      {/* 1-Click Allocation Action */}
                      <div className="shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <button
                          disabled={!selectedBooking || isAssigningThis || isAlreadyAssigned}
                          onClick={() => handleAssignPartner(partner)}
                          className={`w-full sm:w-auto px-5 py-3 rounded-2xl font-black uppercase tracking-wider text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                            isAlreadyAssigned
                              ? 'bg-emerald-600 text-white cursor-default'
                              : isAssigningThis
                              ? 'bg-indigo-400 text-white cursor-wait'
                              : 'bg-[#050CA6] text-white hover:bg-[#040980] active:scale-95 shadow-blue-700/20'
                          } disabled:opacity-50 disabled:pointer-events-none`}
                        >
                          {isAssigningThis ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Allocating...
                            </>
                          ) : isAlreadyAssigned ? (
                            <>
                              <CheckCircle2 size={15} />
                              Assigned
                            </>
                          ) : (
                            <>
                              <UserCheck size={15} />
                              Assign Partner
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
