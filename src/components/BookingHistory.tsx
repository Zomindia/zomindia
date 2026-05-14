import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDocs, documentId, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, UserProfile, Service, PartnerProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, MapPin, ChevronRight, Search, Filter, CheckCircle2, XCircle, AlertCircle, Briefcase, History, Lock } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function BookingHistory({ profile }: { profile: UserProfile }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [partners, setPartners] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingOtp, setBookingOtp] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBooking) {
      const fetchOtp = async () => {
        try {
          const otpDoc = await getDoc(doc(db, `bookings/${selectedBooking.id}/secrets/otp`));
          if (otpDoc.exists()) {
            setBookingOtp(otpDoc.data().code);
          } else {
            setBookingOtp(null);
          }
        } catch (error) {
          console.error("Error fetching OTP:", error);
          setBookingOtp(null);
        }
      };
      fetchOtp();
    }
  }, [selectedBooking]);

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

  const filteredBookings = bookings.filter(b => {
    const statusMatch = filterStatus === 'all' || 
      (filterStatus === 'active' && !['completed', 'cancelled', 'finalized', 'closed'].includes(b.status)) ||
      (filterStatus === 'past' && ['completed', 'cancelled', 'finalized', 'closed'].includes(b.status));
    
    const serviceName = services.find(s => s.id === b.serviceId)?.name.toLowerCase() || '';
    const searchMatch = search === '' || serviceName.includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase());
    
    return statusMatch && searchMatch;
  });

  if (loading) return <div className="p-12 text-center text-stone-400 italic">Retriving order history...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-16 relative">
      <div className="absolute top-0 left-0 w-80 h-80 bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10 mb-16 relative">
        <div>
          <h2 className="text-6xl font-display font-black text-stone-900 italic tracking-tighter leading-none">Order <br/>History</h2>
          <p className="text-stone-400 text-sm font-medium mt-4 italic">Total of {bookings.length} service requests synced</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
             <input 
               type="text" 
               placeholder="Search orders..."
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="w-full bg-white border border-stone-100 rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-stone-900 outline-none shadow-sm"
             />
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl border border-stone-50 shadow-sm">
             {['all', 'active', 'past'].map(st => (
               <button 
                 key={st}
                 onClick={() => setFilterStatus(st)}
                 className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === st ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400 hover:text-stone-600'}`}
               >
                 {st}
               </button>
             ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {filteredBookings.length === 0 ? (
          <div className="bg-white p-20 rounded-[48px] border border-stone-100 text-center">
             <History size={48} className="mx-auto text-stone-100 mb-6" />
             <p className="text-stone-400 font-medium italic">No orders found matching your criteria.</p>
          </div>
        ) : (
          filteredBookings.map((b) => {
            const service = services.find(s => s.id === b.serviceId);
            const otherParty = partners.find(u => u.uid === (profile.role === 'customer' ? b.partnerId : b.customerId));
            const isPast = ['completed', 'cancelled', 'finalized', 'closed'].includes(b.status);

            return (
              <motion.div 
                layout
                key={b.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedBooking(b)}
                tabIndex={0}
                className="bg-white rounded-[40px] p-8 border border-stone-50 shadow-sm hover:shadow-2xl hover:border-stone-900/10 transition-all group cursor-pointer"
              >
                <div className="flex flex-col lg:flex-row justify-between gap-8">
                  <div className="space-y-6 flex-1">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-[10px] px-3 py-1 bg-stone-50 rounded-full font-black uppercase tracking-widest text-stone-500">#{b.id.slice(0, 8).toUpperCase()}</span>
                      <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                        ['confirmed', 'assigned', 'in_progress', 'on_the_way'].includes(b.status) ? 'bg-emerald-500 text-white' :
                        ['pending', 'pending_parts'].includes(b.status) ? 'bg-amber-400 text-white' :
                        b.status === 'cancelled' ? 'bg-rose-500 text-white' :
                        'bg-stone-100 text-stone-400'
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
                      <h4 className="text-2xl font-display font-bold text-stone-900 group-hover:italic transition-all">{service?.name || 'Home Service'}</h4>
                      <p className="text-stone-400 text-sm font-medium">{profile.role === 'customer' ? 'Professional' : 'Customer'}: <span className="text-stone-600 underline underline-offset-4 decoration-stone-200">{otherParty?.displayName || 'Awaiting Assignment'}</span></p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-stone-500 font-medium">
                      <div className="flex items-center gap-2.5"><MapPin size={16} className="text-stone-400" /> {b.address}</div>
                      <div className="flex items-center gap-2.5"><Calendar size={16} className="text-stone-400" /> {b.scheduledAt?.toDate?.()?.toLocaleString() || 'Flexible Time'}</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch lg:items-end justify-between border-t lg:border-none pt-8 lg:pt-0 gap-6">
                    <div className="text-left lg:text-right">
                       <p className="text-3xl font-display font-bold text-stone-900">₹{b.totalPrice}</p>
                       <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest">Platform Invoice</p>
                    </div>
                    
                    <div className="flex gap-3">
                       <button className="flex-1 lg:flex-none bg-stone-900 text-white px-8 py-4 rounded-2xl font-bold text-xs hover:bg-black transition-all shadow-xl shadow-stone-900/10 flex items-center justify-center gap-2">
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

      <AnimatePresence>
        {selectedBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-[48px] overflow-hidden shadow-2xl relative"
            >
              <button 
                onClick={() => setSelectedBooking(null)}
                className="absolute top-8 right-8 p-3 bg-stone-50 hover:bg-stone-100 rounded-2xl text-stone-400 transition-colors z-10"
              >
                <XCircle size={24} />
              </button>

              <div className="p-12">
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-[10px] px-3 py-1 bg-stone-100 rounded-full font-black uppercase tracking-widest text-stone-500">Order #{selectedBooking.id.toUpperCase()}</span>
                  <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                    ['confirmed', 'assigned', 'in_progress', 'on_the_way'].includes(selectedBooking.status) ? 'bg-emerald-500 text-white' :
                    'bg-stone-100 text-stone-400'
                  }`}>
                    {selectedBooking.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="text-4xl font-display font-bold text-stone-900 italic mb-2">
                  {services.find(s => s.id === selectedBooking.serviceId)?.name || 'Service Details'}
                </h3>
                <p className="text-stone-400 font-medium mb-10">Booking confirmed on {selectedBooking.createdAt?.toDate?.()?.toLocaleDateString()}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                  <div className="space-y-6">
                    {selectedBooking.status === 'on_the_way' && bookingOtp && (
                      <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 mb-4">
                        <div className="flex items-center gap-3 text-amber-600 mb-3">
                          <Lock size={18} />
                          <span className="text-xs font-black uppercase tracking-widest">Security Pin Required</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex gap-2">
                            {bookingOtp.split('').map((char, i) => (
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
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-2">Service Address</label>
                      <p className="text-stone-900 font-medium flex items-start gap-2">
                        <MapPin size={18} className="text-stone-400 shrink-0 mt-0.5" />
                        {selectedBooking.address}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-2">Scheduled For</label>
                      <p className="text-stone-900 font-medium flex items-start gap-2">
                        <Calendar size={18} className="text-stone-400 shrink-0 mt-0.5" />
                        {selectedBooking.scheduledAt?.toDate?.()?.toLocaleString() || 'Flexible'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-stone-50 rounded-3xl p-8 space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-400 font-medium">Service Fee</span>
                      <span className="text-stone-900 font-bold">₹{selectedBooking.totalPrice}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-400 font-medium">Payment Method</span>
                      <span className="text-stone-900 font-bold uppercase tracking-wider">{selectedBooking.paymentMethod}</span>
                    </div>
                    <div className="pt-4 border-t border-stone-200 flex justify-between items-center">
                       <span className="text-stone-900 font-bold">Total Amount</span>
                       <span className="text-2xl font-display font-bold text-stone-900">₹{selectedBooking.totalPrice}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                   <button className="flex-1 bg-stone-900 text-white py-5 rounded-3xl font-bold hover:bg-black transition-all shadow-2xl shadow-stone-900/20 uppercase tracking-widest text-xs font-black">
                      Download Invoice
                   </button>
                   <button 
                     onClick={() => setSelectedBooking(null)}
                     className="flex-1 bg-stone-50 text-stone-900 py-5 rounded-3xl font-bold hover:bg-stone-100 transition-all uppercase tracking-widest text-xs font-black"
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
