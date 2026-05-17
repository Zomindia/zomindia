import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDocs, documentId, getDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, UserProfile, Service, PartnerProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, MapPin, ChevronRight, Search, Filter, CheckCircle2, XCircle, AlertCircle, Briefcase, History, Lock, Star } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function BookingHistory({ profile }: { profile: UserProfile }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [partners, setPartners] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingOtp, setBookingOtp] = useState<string | null>(null);

  // Review states
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  useEffect(() => {
    if (selectedBooking) {
      // Check if review exists
      if (selectedBooking.status === 'completed') {
        const checkReview = async () => {
          const q = query(collection(db, 'reviews'), where('bookingId', '==', selectedBooking.id));
          const snap = await getDocs(q);
          setHasReviewed(!snap.empty);
        };
        checkReview();
      }
    }
  }, [selectedBooking]);

  const submitReview = async () => {
    if (!selectedBooking || rating === 0) return;
    setIsSubmittingReview(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        bookingId: selectedBooking.id,
        customerId: profile.uid,
        partnerId: selectedBooking.partnerId,
        serviceId: selectedBooking.serviceId,
        rating,
        comment,
        createdAt: Timestamp.now()
      });
      setHasReviewed(true);
      console.log('Thank you for your review!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reviews');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'bookings'),
      where(profile.role === 'customer' ? 'customerId' : 'partnerId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubBookings = onSnapshot(q, async (snap) => {
      const bList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
      setBookings(bList);

      if (bList.length > 0) {
        // Fetch related services
        const sIds = Array.from(new Set(bList.map(b => b.serviceId)));
        if (sIds.length > 0) {
           const sSnap = await getDocs(query(collection(db, 'services'), where(documentId(), 'in', sIds.slice(0, 10))));
           setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
        }

        // Fetch related partners/customers (display names)
        const uIds = Array.from(new Set(bList.map(b => profile.role === 'customer' ? b.partnerId : b.customerId).filter(Boolean) as string[]));
        if (uIds.length > 0) {
           const uSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', uIds.slice(0, 10))));
           setPartners(uSnap.docs.map(d => d.data() as UserProfile));
        }
      }
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bookings history'));

    return () => unsubBookings();
  }, [profile]);

  const [filterStatus, setFilterStatus] = useState<string>('upcoming');

  const filteredBookings = bookings.filter(b => {
    const isPast = ['completed', 'cancelled', 'closed'].includes(b.status);
    return filterStatus === 'upcoming' ? !isPast : isPast;
  });

  if (loading) return <div className="p-12 text-center text-slate-400 italic">Retriving order history...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-16 relative">
      <div className="absolute top-0 left-0 w-80 h-80 bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10 mb-16 relative">
        <div>
          <h2 className="text-6xl font-display font-black text-slate-900 italic tracking-tighter leading-none">Order <br/>History</h2>
          <p className="text-slate-400 text-sm font-medium mt-4 italic">Total of {bookings.length} service requests synced</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
             <input 
               type="text" 
               placeholder="Search orders..."
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-700 outline-none shadow-sm"
             />
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-50 shadow-sm">
             {['upcoming', 'completed'].map(st => (
               <button 
                 key={st}
                 onClick={() => setFilterStatus(st)}
                 className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === st ? 'bg-blue-700 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {st}
               </button>
             ))}
          </div>
        </div>
      </div>

      <div className="space-y-6 mb-8">
        {filteredBookings.length === 0 ? (
          <div className="bg-white p-20 rounded-[48px] border border-slate-100 text-center">
             <History size={48} className="mx-auto text-slate-100 mb-6" />
             <p className="text-slate-400 font-medium italic">No orders found matching your criteria.</p>
          </div>
        ) : (
          filteredBookings.map((b) => {
            const service = services.find(s => s.id === b.serviceId);
            const otherParty = partners.find(u => u.uid === (profile.role === 'customer' ? b.partnerId : b.customerId));
            const isConfirmed = ['confirmed', 'assigned', 'in_progress', 'on_the_way'].includes(b.status);

            return (
              <motion.div 
                layout
                key={b.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedBooking(b)}
                tabIndex={0}
                className="bg-white rounded-[40px] p-8 border border-slate-50 shadow-sm hover:shadow-2xl hover:border-blue-700/10 transition-all group cursor-pointer"
              >
                <div className="flex flex-col lg:flex-row justify-between gap-8">
                  <div className="space-y-6 flex-1">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-[10px] px-3 py-1 bg-slate-50 rounded-full font-black uppercase tracking-widest text-slate-500">#{b.id.slice(0, 8).toUpperCase()}</span>
                      <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                        ['confirmed', 'assigned', 'in_progress', 'on_the_way', 'arrived'].includes(b.status) ? 'bg-emerald-500 text-white' :
                        ['pending', 'pending_parts', 'payment_pending'].includes(b.status) ? 'bg-amber-400 text-white' :
                        b.status === 'completed' ? 'bg-indigo-500 text-white' :
                        b.status === 'cancelled' ? 'bg-rose-500 text-white' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {b.status.replace('_', ' ')}
                      </span>
                      {b.paymentStatus === 'paid' ? (
                        <span className="text-[10px] px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full font-black uppercase tracking-widest border border-emerald-100">Paid</span>
                      ) : (
                        <span className="text-[10px] px-3 py-1 bg-amber-50 text-amber-600 rounded-full font-black uppercase tracking-widest border border-amber-100 italic">Bill Pending</span>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <h4 className="text-2xl font-display font-bold text-slate-900 group-hover:italic transition-all">{service?.name || 'Home Service'}</h4>
                      <p className="text-slate-400 text-sm font-medium">{profile.role === 'customer' ? 'Professional' : 'Customer'}: <span className="text-slate-600 underline underline-offset-4 decoration-slate-200">{otherParty?.displayName || 'Awaiting Assignment'}</span></p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-500 font-medium">
                      <div className="flex items-center gap-2.5"><MapPin size={16} className="text-slate-400" /> {b.address}</div>
                      <div className="flex items-center gap-2.5"><Calendar size={16} className="text-slate-400" /> {b.scheduledAt?.toDate?.()?.toLocaleString() || 'Flexible Time'}</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch lg:items-end justify-between border-t lg:border-none pt-8 lg:pt-0 gap-6">
                    <div className="text-left lg:text-right">
                       <p className="text-3xl font-display font-bold text-slate-900">₹{b.totalPrice}</p>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Platform Invoice</p>
                    </div>
                    
                    <div className="flex gap-3">
                       <button className="flex-1 lg:flex-none bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold text-xs hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/20/10 flex items-center justify-center gap-2">
                          View Details <ChevronRight size={14} />
                       </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Need Help CTA */}
      <div className="bg-[#0a2540] rounded-2xl p-6 text-white flex items-center justify-between shadow-lg">
        <div>
           <h4 className="font-bold mb-1 text-sm">Need Help?</h4>
           <p className="text-[11px] text-blue-100">Our support team is here for you</p>
        </div>
        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center blur-backdrop backdrop-blur-md">
           <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M19 14.5A4.5 4.5 0 0 0 14.5 10H14M4.5 10A4.5 4.5 0 0 0 9 14.5h.5V10Z"/><path d="M3 13.5v-2A9 9 0 0 1 21 11.5v2"/><path d="M22 17a2 2 0 0 1-2 2h-1.5a1.5 1.5 0 0 1-1.5-1.5V15a1.5 1.5 0 0 1 1.5-1.5H22"/></svg>
        </div>
      </div>

      <AnimatePresence>
        {selectedBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-700/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-[48px] overflow-hidden shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <button 
                onClick={() => setSelectedBooking(null)}
                className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors z-10"
              >
                <XCircle size={24} />
              </button>

              <div className="p-12">
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-[10px] px-3 py-1 bg-slate-100 rounded-full font-black uppercase tracking-widest text-slate-500">Order #{selectedBooking.id.toUpperCase()}</span>
                  <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                    ['confirmed', 'assigned', 'in_progress', 'on_the_way'].includes(selectedBooking.status) ? 'bg-emerald-500 text-white' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {selectedBooking.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="text-4xl font-display font-bold text-slate-900 italic mb-2">
                  {services.find(s => s.id === selectedBooking.serviceId)?.name || 'Service Details'}
                </h3>
                <p className="text-slate-400 font-medium mb-10">Booking confirmed on {selectedBooking.createdAt?.toDate?.()?.toLocaleDateString()}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                  <div className="space-y-6">
                    {['pending', 'confirmed', 'assigned', 'on_the_way', 'arrived'].includes(selectedBooking.status) && selectedBooking.serviceOtp && (
                      <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 mb-4">
                        <div className="flex items-center gap-3 text-amber-600 mb-3">
                          <Lock size={18} />
                          <span className="text-xs font-black uppercase tracking-widest">Security Pin Required</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex gap-2">
                            {selectedBooking.serviceOtp.split('').map((char, i) => (
                              <div key={i} className="w-10 h-12 bg-white rounded-xl border border-amber-200 flex items-center justify-center text-xl font-black text-amber-700 shadow-sm">
                                {char}
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-amber-500 font-bold max-w-[120px] leading-tight">
                            Share this OTP with the partner when they arrive to start the service.
                          </p>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Service Address</label>
                      <p className="text-slate-900 font-medium flex items-start gap-2">
                        <MapPin size={18} className="text-slate-400 shrink-0 mt-0.5" />
                        {selectedBooking.address}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Scheduled For</label>
                      <p className="text-slate-900 font-medium flex items-start gap-2">
                        <Calendar size={18} className="text-slate-400 shrink-0 mt-0.5" />
                        {selectedBooking.scheduledAt?.toDate?.()?.toLocaleString() || 'Flexible'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-8 space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 font-medium">Service Fee</span>
                      <span className="text-slate-900 font-bold">₹{selectedBooking.totalPrice}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 font-medium">Payment Method</span>
                      <span className="text-slate-900 font-bold uppercase tracking-wider">{selectedBooking.paymentMethod}</span>
                    </div>
                    <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                       <span className="text-slate-900 font-bold">Total Amount</span>
                       <span className="text-2xl font-display font-bold text-slate-900">₹{selectedBooking.totalPrice}</span>
                    </div>
                  </div>
                  
                  {selectedBooking.status === 'on_the_way' && profile.role === 'customer' && (
                    <div className="bg-blue-700 rounded-3xl p-8 space-y-4 relative overflow-hidden text-white shadow-xl">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                          <MapPin className="text-white animate-pulse" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg text-white">Live Tracking</h4>
                          <p className="text-xs text-slate-400">Your professional is on the way to your location.</p>
                        </div>
                      </div>
                      
                      <div className="w-full bg-blue-600 rounded-2xl h-32 mt-4 relative overflow-hidden border border-slate-700 flex items-center justify-center relative z-10">
                        <div className="absolute inset-0 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=India&zoom=10&size=400x150&maptype=roadmap')] bg-cover bg-center opacity-30 mix-blend-luminosity"></div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-700/80 backdrop-blur-md rounded-full border border-slate-700 relative z-20 shadow-xl">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Arriving in approx 15 mins</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedBooking.status === 'completed' && profile.role === 'customer' && !hasReviewed && (
                    <div className="bg-emerald-50/50 rounded-3xl p-8 space-y-4 border border-emerald-100">
                       <h4 className="font-bold text-emerald-900">Rate Professional</h4>
                       <p className="text-xs text-emerald-700">How was your service experience?</p>
                       <div className="flex gap-2 mb-4">
                         {[1, 2, 3, 4, 5].map((star) => (
                           <button 
                             key={star}
                             onClick={() => setRating(star)}
                             onMouseEnter={() => setHoverRating(star)}
                             onMouseLeave={() => setHoverRating(0)}
                             className="focus:outline-none transition-transform hover:scale-110"
                           >
                             <Star 
                               size={32} 
                               className={`${
                                 star <= (hoverRating || rating) 
                                   ? 'fill-amber-400 text-amber-400' 
                                   : 'text-slate-300'
                               } transition-colors`} 
                             />
                           </button>
                         ))}
                       </div>
                       <textarea
                         value={comment}
                         onChange={(e) => setComment(e.target.value)}
                         placeholder="Leave a comment (optional)..."
                         rows={3}
                         className="w-full bg-white border border-emerald-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                       />
                       <button
                         onClick={submitReview}
                         disabled={rating === 0 || isSubmittingReview}
                         className="w-full bg-emerald-600 text-white font-bold py-3 rounded-2xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                       >
                         {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                       </button>
                    </div>
                  )}

                  {selectedBooking.status === 'completed' && profile.role === 'customer' && hasReviewed && (
                    <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100 flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                         <CheckCircle2 size={24} />
                       </div>
                       <div>
                         <h4 className="font-bold text-emerald-900">Review Submitted</h4>
                         <p className="text-xs text-emerald-700">Thank you for your feedback!</p>
                       </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                   <button className="flex-1 bg-blue-700 text-white py-5 rounded-3xl font-bold hover:bg-blue-800 transition-all shadow-2xl shadow-blue-700/20/20 uppercase tracking-widest text-xs font-black">
                      Download Invoice
                   </button>
                   <button 
                     onClick={() => setSelectedBooking(null)}
                     className="flex-1 bg-slate-50 text-slate-900 py-5 rounded-3xl font-bold hover:bg-slate-100 transition-all uppercase tracking-widest text-xs font-black"
                   >
                     Close View
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
