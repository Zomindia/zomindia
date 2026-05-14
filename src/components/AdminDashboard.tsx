import { useState, useEffect } from 'react';
import axios from 'axios';
import { collection, query, getDocs, onSnapshot, orderBy, doc, updateDoc, deleteDoc, addDoc, where, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, UserProfile, Category, Service, PartnerProfile, Promotion, FAQ, SupportTicket } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { notifyBookingUpdate } from '../lib/notifications';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  BarChart3, 
  Settings, 
  FileText,
  DollarSign,
  Briefcase,
  ChevronRight,
  TrendingUp,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  UserPlus,
  MapPin,
  Tag,
  LayoutDashboard,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Calendar,
  Smartphone,
  Phone,
  Menu,
  MessageSquare,
  Image as ImageIcon,
  Star,
  X,
  Mail,
  History
} from 'lucide-react';

type AdminTab = 'overview' | 'bookings' | 'categories' | 'services' | 'partners' | 'users' | 'promotions' | 'help-center' | 'tickets';

export default function AdminDashboard({ profile }: { profile: UserProfile }) {
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [partners, setPartners] = useState<(PartnerProfile & { displayName?: string })[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Listen to all core data
    const unsubBookings = onSnapshot(query(collection(db, 'bookings'), orderBy('createdAt', 'desc')), (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bookings'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const userList = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setUsers(userList);
      
      // Also update partners with display names if users are loaded
      setPartners(prev => prev.map(p => {
        const u = userList.find(user => user.uid === p.userId);
        return { ...p, displayName: u?.displayName || p.displayName };
      }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));

    const unsubServices = onSnapshot(collection(db, 'services'), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'services'));

    const unsubPartners = onSnapshot(collection(db, 'partners'), (snap) => {
      const pList = snap.docs.map(d => {
        const data = d.data() as PartnerProfile;
        // In the current local state 'users', we might have the displayName
        // We'll augment it here as well for safety
        return { id: d.id, ...data };
      });
      
      setPartners(pList.map(p => {
        const u = users.find(user => user.uid === p.userId);
        return { ...p, displayName: u?.displayName || (p as any).displayName };
      }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'partners'));

    const unsubPromos = onSnapshot(query(collection(db, 'promotions'), orderBy('createdAt', 'desc')), (snap) => {
      setPromotions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'promotions'));

    const unsubFaqs = onSnapshot(query(collection(db, 'faqs'), orderBy('order', 'asc')), (snap) => {
      setFaqs(snap.docs.map(d => ({ id: d.id, ...d.data() } as FAQ)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'faqs'));

    const unsubTickets = onSnapshot(query(collection(db, 'tickets'), orderBy('createdAt', 'desc')), (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tickets'));

    setLoading(false);

    return () => {
      unsubBookings();
      unsubUsers();
      unsubCategories();
      unsubServices();
      unsubPartners();
      unsubPromos();
      unsubTickets();
    };
  }, []);

  const totalRevenue = bookings.reduce((acc, b) => (b.status === 'completed' || b.status === 'finalized') ? acc + b.totalPrice : acc, 0);
  const platformFee = totalRevenue * 0.15;

  const sidebarItems: { id: AdminTab; icon: any; label: string }[] = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'bookings', icon: FileText, label: 'Bookings' },
    { id: 'categories', icon: Tag, label: 'Categories' },
    { id: 'services', icon: Briefcase, label: 'Services' },
    { id: 'partners', icon: ShieldCheck, label: 'Partners' },
    { id: 'users', icon: Users, label: 'Customers' },
    { id: 'promotions', icon: Tag, label: 'Promotions' },
    { id: 'help-center', icon: FileText, label: 'Help' },
    { id: 'tickets', icon: MessageSquare, label: 'Tickets' },
  ];

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (loading) return <div className="p-12 text-center text-stone-400 font-bold uppercase tracking-widest animate-pulse">Initializing Terminal...</div>;

  return (
    <div className="min-h-screen bg-stone-50 flex relative overflow-x-hidden">
      {/* Sidebar Overlay - Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Admin Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isCollapsed ? 100 : 288 }}
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-stone-100 flex flex-col transition-transform duration-300 transform lg:sticky top-0 h-screen ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-8 border-b border-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
             <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center text-white shadow-xl shadow-stone-900/10 shrink-0">
                <Settings size={20} />
             </div>
             {!isCollapsed && (
               <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-bold text-lg tracking-tight italic whitespace-nowrap"
               >
                 zomindia PRO
               </motion.span>
             )}
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-stone-400 hover:text-stone-900 transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveAdminTab(item.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group overflow-hidden ${
                activeAdminTab === item.id 
                  ? 'bg-stone-900 text-white shadow-xl shadow-stone-900/10' 
                  : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              <item.icon size={18} className={`shrink-0 ${activeAdminTab === item.id ? 'text-white' : 'text-stone-300 group-hover:text-stone-900'}`} />
              {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-stone-50">
           <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex w-full items-center justify-center p-3 hover:bg-stone-50 rounded-xl text-stone-400 hover:text-stone-900 transition-all mb-4"
           >
             <div className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}>
               <ChevronRight size={18} />
             </div>
           </button>
           <div className={`bg-stone-50 p-4 rounded-2xl transition-all ${isCollapsed ? 'opacity-0 h-0 p-0 overflow-hidden' : ''}`}>
              <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest mb-2">Cloud Status</p>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[10px] text-stone-900 font-bold tracking-wider uppercase whitespace-nowrap">Systems Active</span>
              </div>
           </div>
        </div>
      </motion.aside>

      {/* Admin Body */}
      <main className="flex-1 min-h-screen flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-stone-200/50 h-20 px-6 sm:px-12 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2.5 bg-stone-50 text-stone-900 rounded-xl hover:bg-stone-100 transition-colors"
                id="admin-menu-toggle"
              >
                <Menu size={22} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-stone-900 tracking-tight capitalize">{activeAdminTab.replace('-', ' ')}</h1>
              </div>
           </div>
           
           <div className="flex items-center gap-4 sm:gap-6">
              <div className="hidden sm:block relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                 <input 
                   type="text" 
                   placeholder="Global Search..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-48 lg:w-64 bg-stone-50 border-none rounded-2xl px-12 py-2.5 text-sm font-medium focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all shadow-inner"
                 />
              </div>
              <div className="flex items-center gap-3">
                 <div className="hidden md:block text-right">
                    <p className="text-[11px] font-bold text-stone-900 leading-none mb-1">Administrator</p>
                    <p className="text-[9px] text-stone-400 uppercase font-black tracking-widest leading-none">Root Access</p>
                 </div>
                 <div className="w-10 h-10 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-center text-stone-900">
                   <ShieldCheck size={20} />
                 </div>
              </div>
           </div>
        </header>

        <div className="p-6 md:p-8 lg:p-12 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeAdminTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeAdminTab === 'overview' && (
                <div className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    <StatCard title="Total Volume" value={`₹${totalRevenue.toLocaleString()}`} icon={DollarSign} color="bg-emerald-500" />
                    <StatCard title="Total Customers" value={users.length.toString()} icon={Users} color="bg-stone-900" />
                    <StatCard title="Earnings (15%)" value={`₹${platformFee.toLocaleString()}`} icon={TrendingUp} color="bg-indigo-600" />
                    <StatCard title="Pending Requests" value={bookings.filter(b => b.status === 'pending').length.toString()} icon={Clock} color="bg-amber-500" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white rounded-[32px] border border-stone-100 p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-8">
                         <h3 className="font-bold text-xl text-stone-900">Recent Stream</h3>
                         <button onClick={() => setActiveAdminTab('bookings')} className="text-[10px] font-black text-stone-400 hover:text-stone-900 uppercase tracking-widest transition-colors">See All Bookings</button>
                      </div>
                      <div className="space-y-3">
                         {bookings.slice(0, 6).map(b => (
                           <div key={b.id} className="flex items-center justify-between p-4 bg-stone-50/50 rounded-2xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-stone-100 group">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-stone-900 shadow-sm group-hover:bg-stone-900 group-hover:text-white transition-all shrink-0">
                                    <FileText size={16} />
                                 </div>
                                 <div className="min-w-0">
                                    <p className="text-sm font-bold text-stone-900 truncate">Booking #{b.id.slice(0, 8).toUpperCase()}</p>
                                    <p className="text-[10px] text-stone-400 font-medium italic truncate">{b.address}</p>
                                 </div>
                              </div>
                              <div className="text-right shrink-0">
                                 <p className="text-sm font-bold text-stone-900">₹{b.totalPrice}</p>
                                 <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                   b.status === 'finalized' || b.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 
                                   'bg-stone-900 text-white'
                                 }`}>
                                   {b.status.replace('_', ' ')}
                                 </span>
                              </div>
                           </div>
                         ))}
                      </div>
                    </div>

                    <div className="bg-stone-900 rounded-[32px] p-8 text-white relative overflow-hidden flex flex-col justify-between">
                       <div>
                         <h3 className="font-bold text-xl mb-2">Platform Velocity</h3>
                         <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-12">Performance Metrics</p>
                       </div>
                       
                       <div className="space-y-6 relative z-10">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] uppercase font-black tracking-widest text-white/50">Service Satisfaction</span>
                              <span className="text-sm font-bold uppercase tracking-widest text-white">94%</span>
                            </div>
                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className="w-[94%] h-full bg-emerald-400" />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] uppercase font-black tracking-widest text-white/50">Partner Utilization</span>
                              <span className="text-sm font-bold uppercase tracking-widest text-white">78%</span>
                            </div>
                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className="w-[78%] h-full bg-indigo-400" />
                            </div>
                          </div>
                       </div>
                       
                       <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {activeAdminTab === 'bookings' && <BookingManager bookings={bookings} users={users} partners={partners} services={services} profile={profile} />}
              {activeAdminTab === 'categories' && <CategoryManager categories={categories} />}
              {activeAdminTab === 'services' && <ServiceManager categories={categories} services={services} />}
              {activeAdminTab === 'partners' && <PartnerManager partners={partners} users={users} />}
              {activeAdminTab === 'users' && <UserManager users={users} bookings={bookings} />}
              {activeAdminTab === 'promotions' && <PromoManager promotions={promotions} categories={categories} services={services} />}
              {activeAdminTab === 'help-center' && <HelpCenterManager faqs={faqs} />}
              {activeAdminTab === 'tickets' && <TicketManager tickets={tickets} users={users} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-10 border border-stone-50 rounded-[48px] shadow-sm relative overflow-hidden group hover:border-stone-900 transition-all duration-500">
      <div className="relative z-10">
        <div className={`w-14 h-14 ${color} text-white rounded-[24px] flex items-center justify-center mb-8 shadow-xl shadow-stone-900/5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
          <Icon size={28} />
        </div>
        <p className="text-stone-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{title}</p>
        <p className="text-4xl font-display font-bold text-stone-900 tracking-tighter">{value}</p>
      </div>
      <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-stone-50 rounded-full z-0 group-hover:bg-stone-100 transition-all duration-500" />
    </div>
  );
}

// --- MODULES ---

function BookingManager({ bookings, users, partners, services, profile }: { bookings: Booking[], users: UserProfile[], partners: (PartnerProfile & { displayName?: string })[], services: Service[], profile: UserProfile }) {
  const [sendingBillId, setSendingBillId] = useState<string | null>(null);
  const [managingStatusBookingId, setManagingStatusBookingId] = useState<string | null>(null);
  const [statusForm, setStatusForm] = useState({
    status: '' as Booking['status'] | 'reject',
    pendingReason: '',
    pendingDate: '',
    pendingDuration: '',
    assignedPartnerId: '',
    extraAmount: '',
    extraReason: ''
  });
  const [loading, setLoading] = useState(false);

  const [bookingOtps, setBookingOtps] = useState<Record<string, string>>({});

  useEffect(() => {
    const relevantBookings = bookings.filter(b => ['confirmed', 'assigned', 'on_the_way', 'arrived'].includes(b.status));
    if (relevantBookings.length === 0) return;

    const unsubscribes = relevantBookings.map(booking => {
      return onSnapshot(doc(db, `bookings/${booking.id}/secrets`, 'otp'), (snap) => {
        if (snap.exists()) {
          setBookingOtps(prev => ({ ...prev, [booking.id]: snap.data().code }));
        }
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [bookings]);

  const handleAdminStatusUpdate = async () => {
    if (!managingStatusBookingId || !statusForm.status) return;
    setLoading(true);
    try {
      const booking = bookings.find(b => b.id === managingStatusBookingId);
      if (!booking) return;

      const updateData: any = {
        updatedAt: Timestamp.now()
      };

      if (statusForm.status === 'reject') {
        // Unassign and Return to Pool
        updateData.status = 'pending';
        updateData.partnerId = null;
        updateData.previousStatus = booking.status;
      } else {
        updateData.status = statusForm.status;
        updateData.previousStatus = booking.status;
        
        if (statusForm.assignedPartnerId) {
          updateData.partnerId = statusForm.assignedPartnerId;
          // If we assign a partner, we usually want it to be confirmed and generate OTP
          if (updateData.status === 'pending' && !statusForm.pendingReason) {
            updateData.status = 'confirmed';
          }
          if (updateData.status === 'confirmed' || updateData.status === 'assigned') {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            await setDoc(doc(db, `bookings/${managingStatusBookingId}/otps`, otp), { 
              createdAt: Timestamp.now(),
              createdBy: profile.uid
            });
            await setDoc(doc(db, `bookings/${managingStatusBookingId}/secrets`, 'otp'), { code: otp });
            // By NOT adding to updateData, we keep it out of the main booking document
          }
        }

        if (statusForm.status === 'pending') {
          updateData.pendingReason = statusForm.pendingReason;
          updateData.pendingResolveDate = statusForm.pendingDate ? Timestamp.fromDate(new Date(statusForm.pendingDate)) : null;
          updateData.pendingResolveDuration = statusForm.pendingDuration;
        } else {
          // Cleanup pending metadata if moving to active status
          updateData.pendingReason = null;
          updateData.pendingResolveDate = null;
          updateData.pendingResolveDuration = null;
        }

        // Handle Extra Charges
        if (statusForm.extraAmount && !isNaN(Number(statusForm.extraAmount))) {
          const newCharge = {
            amount: Number(statusForm.extraAmount),
            reason: statusForm.extraReason || 'Service Adjustment',
            createdAt: Timestamp.now()
          };
          updateData.additionalCharges = [...(booking.additionalCharges || []), newCharge];
          updateData.totalPrice = (booking.totalPrice || 0) + Number(statusForm.extraAmount);
        }
      }

      await updateDoc(doc(db, 'bookings', managingStatusBookingId), updateData);
      notifyBookingUpdate({ ...booking, ...updateData }, updateData.status, 'admin');
      
      setManagingStatusBookingId(null);
      setStatusForm({ status: '' as any, pendingReason: '', pendingDate: '', pendingDuration: '', assignedPartnerId: '', extraAmount: '', extraReason: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${managingStatusBookingId}`);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (id: string, status: Booking['status']) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { status, updatedAt: Timestamp.now() });
      const b = bookings.find(x => x.id === id);
      if (b) notifyBookingUpdate({ ...b, status }, status, 'admin');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${id}`);
    }
  };

  const assignPartner = async (bookingId: string, partnerId: string) => {
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await updateDoc(doc(db, 'bookings', bookingId), { 
        partnerId, 
        status: 'confirmed',
        updatedAt: Timestamp.now()
      });
      await setDoc(doc(db, `bookings/${bookingId}/otps`, otp), { 
        createdAt: Timestamp.now(),
        createdBy: profile.uid
      });
      await setDoc(doc(db, `bookings/${bookingId}/secrets`, 'otp'), { code: otp });

      const b = bookings.find(x => x.id === bookingId);
      if (b) notifyBookingUpdate({ ...b, partnerId, status: 'confirmed' }, 'confirmed', 'admin');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  // Sort partners to show 'Available' ones first
  const sortedPartners = [...partners].sort((a, b) => {
    if (a.availabilityStatus === 'Available' && b.availabilityStatus !== 'Available') return -1;
    if (a.availabilityStatus !== 'Available' && b.availabilityStatus === 'Available') return 1;
    return 0;
  });

  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history'>('pending');

  const pendingBookings = bookings.filter(b => b.status === 'pending' || b.status === 'pending_parts');
  const activeBookings = bookings.filter(b => ['confirmed', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'payment_pending'].includes(b.status));
  const historyBookings = bookings.filter(b => ['completed', 'finalized', 'closed', 'cancelled'].includes(b.status));

  const filteredBookings = activeTab === 'pending' ? pendingBookings : activeTab === 'active' ? activeBookings : historyBookings;

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex p-1.5 bg-stone-100 rounded-2xl w-full sm:w-auto">
          {(['pending', 'active', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? 'bg-white text-stone-900 shadow-xl shadow-stone-900/5' 
                  : 'text-stone-400 hover:text-stone-900'
              }`}
            >
              {tab} ({tab === 'pending' ? pendingBookings.length : tab === 'active' ? activeBookings.length : historyBookings.length})
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
           <div className="px-6 py-3 bg-white border border-stone-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-stone-400">
              Total Stream: {bookings.length}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredBookings.length === 0 ? (
          <div className="p-20 text-center bg-white rounded-[48px] border border-stone-50">
             <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6 text-stone-200">
                <FileText size={32} />
             </div>
             <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">No tasks in this segment</p>
          </div>
        ) : (
          filteredBookings.map(booking => (
            <BookingRow 
              key={booking.id} 
              booking={booking} 
              users={users} 
              partners={partners} 
              services={services} 
              otp={bookingOtps[booking.id]}
              onManage={() => setManagingStatusBookingId(booking.id)}
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {managingStatusBookingId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[48px] p-10 max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh] relative"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-stone-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                      <Settings size={24} />
                   </div>
                   <div>
                      <h3 className="text-2xl font-bold text-stone-900 italic">Lifecycle Override</h3>
                      <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Administrative Control Unit</p>
                   </div>
                </div>
                <button onClick={() => setManagingStatusBookingId(null)} className="p-3 bg-stone-50 hover:bg-stone-100 rounded-2xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-10">
                {/* Status Selection */}
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase mb-4 tracking-widest px-1">Phase Matrix</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'pending', label: 'Pending', color: 'bg-amber-400' },
                      { id: 'pending_parts', label: 'Pending Parts', color: 'bg-amber-500' },
                      { id: 'confirmed', label: 'Confirmed', color: 'bg-green-500' },
                      { id: 'assigned', label: 'Assigned', color: 'bg-emerald-500' },
                      { id: 'in_progress', label: 'Operational', color: 'bg-blue-500' },
                      { id: 'completed', label: 'Completed', color: 'bg-stone-500' },
                      { id: 'closed', label: 'Closed', color: 'bg-stone-400' },
                      { id: 'cancelled', label: 'Cancelled', color: 'bg-rose-500' },
                      { id: 'reject', label: 'Unassign / Return', color: 'bg-stone-900' }
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setStatusForm({ ...statusForm, status: st.id as any })}
                        className={`p-6 rounded-[24px] border-2 transition-all text-left flex flex-col gap-3 group ${
                          statusForm.status === st.id 
                            ? 'border-stone-900 bg-stone-50' 
                            : 'border-stone-50 bg-stone-50/30 hover:border-stone-200'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${st.color} shadow-sm group-hover:scale-110 transition-transform`} />
                        <span className="text-xs font-bold text-stone-900">{st.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Partner Assignment Override */}
                <div className="p-8 bg-stone-50 rounded-[32px] border border-stone-100/50">
                  <label className="block text-[10px] font-black text-stone-500 uppercase mb-4 tracking-widest flex items-center gap-2">
                    <UserPlus size={14} /> Agent Allocation
                  </label>
                  <select 
                    value={statusForm.assignedPartnerId}
                    onChange={(e) => setStatusForm({ ...statusForm, assignedPartnerId: e.target.value })}
                    className="w-full bg-white border-2 border-stone-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-stone-900/5 transition-all outline-none"
                  >
                    <option value="">No Agent Assigned</option>
                    {sortedPartners.map(p => (
                      <option key={p.id} value={p.userId}>
                        {p.displayName || p.id.slice(0, 8).toUpperCase()} ({p.availabilityStatus})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-stone-400 mt-3 italic font-medium">Overriding the agent will synchronously update the task's field-access rights.</p>
                </div>

                {/* Extra Charges Management */}
                <div className="p-8 bg-emerald-50/30 border border-emerald-100 rounded-[32px] space-y-6">
                  <label className="block text-[10px] font-black text-emerald-600 uppercase mb-4 tracking-widest flex items-center gap-2">
                    <DollarSign size={14} /> Revenue Enrichment (Extra Charges)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[8px] font-bold text-emerald-400 uppercase mb-1 ml-1">Charge Amount (₹)</label>
                      <input 
                        type="number"
                        placeholder="e.g. 500"
                        value={statusForm.extraAmount}
                        onChange={(e) => setStatusForm({ ...statusForm, extraAmount: e.target.value })}
                        className="w-full bg-white border border-emerald-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-emerald-400 uppercase mb-1 ml-1">Justification</label>
                      <input 
                        type="text"
                        placeholder="Optional reason..."
                        value={statusForm.extraReason}
                        onChange={(e) => setStatusForm({ ...statusForm, extraReason: e.target.value })}
                        className="w-full bg-white border border-emerald-100 rounded-2xl px-6 py-4 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </div>
                  </div>
                </div>

                {/* Pending Metadata */}
                {statusForm.status === 'pending' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-6 pt-2"
                  >
                    <div className="p-8 bg-amber-50/50 border border-amber-100 rounded-[32px] space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-amber-600 uppercase mb-3 tracking-widest ml-1">Stall Vector (Reason)</label>
                        <input 
                          type="text"
                          placeholder="e.g. Parts scarcity / Logistics failure"
                          value={statusForm.pendingReason}
                          onChange={(e) => setStatusForm({ ...statusForm, pendingReason: e.target.value })}
                          className="w-full bg-white border border-amber-100 rounded-2xl px-6 py-4 text-sm outline-none focus:ring-4 focus:ring-amber-500/10 placeholder:text-amber-200"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-amber-600 uppercase mb-3 tracking-widest ml-1">Resolution ETA</label>
                          <input 
                            type="datetime-local"
                            value={statusForm.pendingDate}
                            onChange={(e) => setStatusForm({ ...statusForm, pendingDate: e.target.value })}
                            className="w-full bg-white border border-amber-100 rounded-2xl px-6 py-4 text-xs font-bold text-stone-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-amber-600 uppercase mb-3 tracking-widest ml-1">SLA Buffer</label>
                          <input 
                            type="text"
                            placeholder="e.g. T + 48h"
                            value={statusForm.pendingDuration}
                            onChange={(e) => setStatusForm({ ...statusForm, pendingDuration: e.target.value })}
                            className="w-full bg-white border border-amber-100 rounded-2xl px-6 py-4 text-xs font-bold text-stone-900 placeholder:text-amber-200"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-4 pt-6">
                  <button 
                    onClick={() => setManagingStatusBookingId(null)}
                    className="flex-1 py-5 text-stone-400 font-bold hover:bg-stone-50 rounded-3xl transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Discard Changes
                  </button>
                  <button 
                    disabled={loading || !statusForm.status}
                    onClick={handleAdminStatusUpdate}
                    className="flex-[2] bg-stone-900 text-white py-5 rounded-3xl font-bold hover:bg-black transition-all shadow-2xl shadow-stone-900/20 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                    <span className="uppercase tracking-widest text-[11px] font-black">Commit Full Override</span>
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

function BookingRow({ booking, users, partners, services, otp, onManage }: { booking: Booking, users: UserProfile[], partners: any[], services: Service[], otp?: string, onManage: () => void }) {
  const user = users.find(u => u.uid === (booking as any).customerId || u.uid === booking.userId);
  const partner = partners.find(p => p.userId === booking.partnerId);
  const service = services.find(s => s.id === booking.serviceId);

  return (
    <div className="bg-white rounded-[32px] p-6 lg:p-8 border border-stone-100 hover:border-stone-900 transition-all duration-300 group shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="flex items-start gap-6 lg:w-1/3">
          <div className="w-16 h-16 bg-stone-50 rounded-[20px] flex items-center justify-center text-stone-900 shadow-sm relative group-hover:bg-stone-900 group-hover:text-white transition-all shrink-0">
            <FileText size={24} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
               <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Order ID</span>
               <span className="text-[11px] font-bold text-stone-900 px-2 py-0.5 bg-stone-50 rounded-full">{booking.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <h4 className="text-lg font-bold text-stone-900 tracking-tight truncate mb-1">
              {service?.name || 'Loading Service...'}
            </h4>
            <div className="flex items-center gap-2 text-stone-400">
               <Calendar size={12} />
               <span className="text-[10px] font-bold uppercase tracking-wider">{booking.date} • {booking.time}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 flex-1">
           <div>
              <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-3">Customer Entity</p>
              <p className="text-sm font-bold text-stone-900 mb-1">{user?.displayName || 'Anonymous User'}</p>
              <p className="text-[10px] text-stone-400 font-medium truncate">{user?.phoneNumber}</p>
           </div>
           <div>
              <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-3">Assigned Agent</p>
              {partner ? (
                <div>
                   <p className="text-sm font-bold text-stone-900 mb-1">{partner.displayName || 'Unnamed Partner'}</p>
                   <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest leading-none">Active Link</p>
                </div>
              ) : (
                <p className="text-xs font-bold text-stone-400 italic">No Agent Assigned</p>
              )}
           </div>
           <div className="hidden md:block">
              <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-3">Financial State</p>
              <p className="text-lg font-bold text-stone-900">₹{booking.totalPrice}</p>
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{booking.paymentMethod}</span>
           </div>
        </div>

        <div className="flex flex-col lg:items-end gap-4 shrink-0">
           <div className="flex items-center gap-3">
              {otp && (
                <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                   <p className="text-[8px] font-black text-indigo-400 uppercase tracking-black mb-1">Security Token</p>
                   <p className="text-sm font-bold text-indigo-600 tracking-widest leading-none">{otp}</p>
                </div>
              )}
              <div className={`px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-[0.2em] ${
                booking.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                booking.status === 'confirmed' || booking.status === 'assigned' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                booking.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                'bg-stone-50 text-stone-400 border-stone-100'
              }`}>
                {booking.status.replace('_', ' ')}
              </div>
           </div>
           <button 
             onClick={onManage}
             className="w-full lg:w-auto px-10 py-3 bg-stone-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-lg shadow-stone-900/10 transition-all active:scale-95"
           >
             Manage Lifecycle
           </button>
        </div>
      </div>
      
      <div className="mt-8 pt-6 border-t border-stone-50 flex items-center gap-8 justify-between">
         <div className="flex items-center gap-8 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
            <div className="flex items-center gap-2">
               <MapPin size={12} className="text-stone-300" />
               <span className="truncate max-w-[200px]">{booking.address}</span>
            </div>
            {(booking as any).promoCode && (
               <div className="flex items-center gap-2 text-indigo-500">
                  <Tag size={12} />
                  <span>Promo: {(booking as any).promoCode}</span>
               </div>
            )}
         </div>
         {booking.pendingReason && (
            <div className="bg-rose-50 px-4 py-2 rounded-xl flex items-center gap-3">
               <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest italic leading-none">Blocker: {booking.pendingReason}</span>
            </div>
         )}
      </div>
    </div>
  );
}

function CategoryManager({ categories }: { categories: Category[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', icon: 'Sparkles', description: '', imageURL: '' });

  const handleAddCategory = async () => {
    if (!newCategory.name) return;
    try {
      await addDoc(collection(db, 'categories'), newCategory);
      setIsAdding(false);
      setNewCategory({ name: '', icon: 'Sparkles', description: '', imageURL: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'categories');
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    try {
      const { id, ...data } = editingCategory;
      await updateDoc(doc(db, 'categories', id), {
        ...data,
      });
      setEditingCategory(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `categories/${editingCategory.id}`);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Deleting a category will NOT delete its services, but they may become orphaned. Continue?')) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center mb-8">
         <h3 className="text-xl font-bold">Category Hierarchy</h3>
         <button 
           onClick={() => setIsAdding(!isAdding)}
           className="bg-stone-900 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-black shadow-lg shadow-stone-200"
         >
           {isAdding ? <XCircle size={18} /> : <Plus size={18} />}
           {isAdding ? 'Cancel' : 'Create Category'}
         </button>
      </div>

      <AnimatePresence>
        {(isAdding || editingCategory) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-8 rounded-[32px] border border-stone-900/10 shadow-xl mb-12"
          >
             <h4 className="font-bold mb-6">{editingCategory ? 'Edit Category' : 'Create New Category'}</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                   <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Category Name</label>
                   <input 
                     type="text" 
                     placeholder="e.g. Cleaning"
                     value={editingCategory ? editingCategory.name : newCategory.name}
                     onChange={(e) => editingCategory 
                       ? setEditingCategory({ ...editingCategory, name: e.target.value })
                       : setNewCategory({ ...newCategory, name: e.target.value })
                     }
                     className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Icon ID (Lucide)</label>
                   <select 
                     value={editingCategory ? editingCategory.icon : newCategory.icon}
                     onChange={(e) => editingCategory
                       ? setEditingCategory({ ...editingCategory, icon: e.target.value })
                       : setNewCategory({ ...newCategory, icon: e.target.value })
                     }
                     className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900"
                   >
                     <option value="Sparkles">Sparkles</option>
                     <option value="Wrench">Wrench</option>
                     <option value="Smartphone">Smartphone</option>
                     <option value="PaintBucket">PaintBucket</option>
                     <option value="Plug">Plug</option>
                     <option value="Wind">Wind</option>
                   </select>
                </div>
             </div>
             <div className="mb-6">
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Short Description</label>
                <textarea 
                  value={editingCategory ? editingCategory.description : newCategory.description}
                  onChange={(e) => editingCategory
                    ? setEditingCategory({ ...editingCategory, description: e.target.value })
                    : setNewCategory({ ...newCategory, description: e.target.value })
                  }
                  className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900 h-20"
                  placeholder="What is this category about?"
                />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                   <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Category Image URL</label>
                   <input 
                     type="text" 
                     value={editingCategory ? editingCategory.imageURL : newCategory.imageURL}
                     onChange={(e) => editingCategory
                       ? setEditingCategory({ ...editingCategory, imageURL: e.target.value })
                       : setNewCategory({ ...newCategory, imageURL: e.target.value })
                     }
                     className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900"
                     placeholder="https://example.com/category-image.jpg"
                   />
                </div>
                {(editingCategory?.imageURL || newCategory.imageURL) && (
                  <div className="flex items-center gap-4 bg-stone-50 p-3 rounded-2xl border border-stone-100">
                    <img 
                      src={editingCategory?.imageURL || newCategory.imageURL} 
                      alt="Preview" 
                      className="w-16 h-16 rounded-xl object-cover border border-white shadow-sm"
                    />
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Image Preview</p>
                  </div>
                )}
             </div>
             <div className="flex gap-4">
               <button 
                 onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                 className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-black transition-colors shadow-lg"
               >
                 {editingCategory ? 'Update Category' : 'Add Category'}
               </button>
               {editingCategory && (
                 <button 
                  onClick={() => setEditingCategory(null)}
                  className="bg-stone-100 text-stone-600 px-8 py-3 rounded-xl font-bold text-sm hover:bg-stone-200 transition-colors"
                 >
                   Cancel
                 </button>
               )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map(c => (
          <div key={c.id} className="bg-white p-6 border border-stone-200 rounded-3xl hover:border-stone-900 transition-all flex justify-between items-center group">
             <div className="flex items-center gap-4">
                {c.imageURL && (
                  <img src={c.imageURL} alt="" className="w-10 h-10 rounded-lg object-cover" />
                )}
                <div>
                   <h4 className="font-bold text-stone-900">{c.name}</h4>
                   <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{c.id.slice(0, 8).toUpperCase()}</p>
                </div>
             </div>
             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                 onClick={() => {
                   setEditingCategory(c);
                   setIsAdding(false);
                   window.scrollTo({ top: 0, behavior: 'smooth' });
                 }}
                 className="p-2 text-stone-300 hover:text-stone-900 transition-colors"
               >
                  <Settings size={16} />
               </button>
               <button onClick={() => deleteCategory(c.id)} className="p-2 text-stone-300 hover:text-rose-600 transition-colors">
                  <XCircle size={18} />
               </button>
             </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="col-span-full py-12 text-center text-stone-400 font-medium italic bg-stone-100/50 rounded-[32px] border-2 border-dashed border-stone-200">
            No categories defined. Please add one to begin building your catalog.
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceManager({ categories, services }: { categories: Category[], services: Service[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [updatingImageId, setUpdatingImageId] = useState<string | null>(null);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [newService, setNewService] = useState({ 
    categoryId: '', 
    name: '', 
    basePrice: 0, 
    description: '', 
    duration: '2 Hours',
    imageURL: '',
    priceListPDF: '',
    rating: 4.8,
    reviewCount: 0
  });

  const handleAddService = async () => {
    try {
      if (!newService.categoryId || !newService.name) {
        alert('Please fill in required fields');
        return;
      }
      await addDoc(collection(db, 'services'), newService);
      setIsAdding(false);
      setNewService({ 
        categoryId: '', 
        name: '', 
        basePrice: 0, 
        description: '', 
        duration: '2 Hours',
        imageURL: '',
        priceListPDF: '',
        rating: 4.8,
        reviewCount: 0
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'services');
    }
  };

  const handleUpdateService = async () => {
    if (!editingService) return;
    try {
      const { id, ...data } = editingService;
      await updateDoc(doc(db, 'services', id), {
        ...data,
        updatedAt: Timestamp.now()
      });
      setEditingService(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `services/${editingService.id}`);
    }
  };

  const handleQuickImageUpdate = async () => {
    if (!updatingImageId) return;
    try {
      await updateDoc(doc(db, 'services', updatingImageId), {
        imageURL: tempImageUrl,
        updatedAt: Timestamp.now()
      });
      setUpdatingImageId(null);
      setTempImageUrl('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `services/${updatingImageId}`);
    }
  };

  const deleteService = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      await deleteDoc(doc(db, 'services', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `services/${id}`);
    }
  };

  const [viewingReviewsId, setViewingReviewsId] = useState<string | null>(null);
  const [sSearch, setSSearch] = useState('');

  const filteredServices = services.filter(s => {
    const query = sSearch.toLowerCase();
    const category = categories.find(c => c.id === s.categoryId);
    return (
      s.name.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      category?.name.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
         <div>
            <h3 className="text-xl font-bold">Catalog Management</h3>
            <p className="text-sm text-stone-400">View and manage all service offerings across categories.</p>
         </div>
         <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
               <input 
                 type="text"
                 placeholder="Search services..."
                 value={sSearch}
                 onChange={(e) => setSSearch(e.target.value)}
                 className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-stone-900 outline-none"
               />
            </div>
            <button 
              onClick={() => { setIsAdding(!isAdding); setEditingService(null); setViewingReviewsId(null); }}
              className="bg-stone-900 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-black shadow-lg shadow-stone-200 shrink-0"
            >
              {isAdding ? <XCircle size={18} /> : <Plus size={18} />}
              {isAdding ? 'Cancel' : 'Add New Service'}
            </button>
         </div>
      </div>

      <AnimatePresence>
        {updatingImageId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
          >
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="bg-white p-8 rounded-[40px] max-w-md w-full shadow-2xl"
             >
                <div className="flex justify-between items-center mb-8">
                   <h4 className="text-xl font-bold italic">Update Service Image</h4>
                   <button onClick={() => setUpdatingImageId(null)} className="p-2 hover:bg-stone-50 rounded-xl">
                      <X size={20} />
                   </button>
                </div>
                <div className="space-y-6">
                   <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 px-1">Resource URL</label>
                      <input 
                        type="text" 
                        value={tempImageUrl}
                        onChange={(e) => setTempImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full bg-stone-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-stone-900 outline-none"
                      />
                   </div>
                   {tempImageUrl && (
                     <div className="bg-stone-50 p-4 rounded-3xl border border-stone-100 flex flex-col items-center gap-3">
                        <img src={tempImageUrl} alt="Preview" className="w-full h-32 object-cover rounded-2xl shadow-md border-4 border-white" />
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Live Preview</p>
                     </div>
                   )}
                   <div className="flex gap-4 pt-2">
                      <button 
                        onClick={() => setUpdatingImageId(null)}
                        className="flex-1 py-4 text-stone-400 font-bold hover:bg-stone-50 rounded-2xl transition-all uppercase tracking-widest text-[10px]"
                      >
                        Discard
                      </button>
                      <button 
                        onClick={handleQuickImageUpdate}
                        disabled={!tempImageUrl}
                        className="flex-2 bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-stone-900/10 uppercase tracking-widest text-[10px] disabled:opacity-50"
                      >
                        Commit Update
                      </button>
                   </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingReviewsId && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
          >
             <div className="bg-stone-50 w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col">
                <div className="p-8 border-b border-stone-200 flex justify-between items-center bg-white">
                   <div>
                      <h4 className="text-xl font-bold text-stone-900">
                         {services.find(s => s.id === viewingReviewsId)?.name} Reviews
                      </h4>
                      <p className="text-sm text-stone-400 font-medium">Manage and moderate customer feedback for this service.</p>
                   </div>
                   <button 
                     onClick={() => setViewingReviewsId(null)}
                     className="p-3 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-2xl transition-all"
                   >
                     <X size={20} />
                   </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                   <ReviewManager serviceId={viewingReviewsId} />
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isAdding || editingService) && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white p-8 rounded-[32px] border border-stone-900/10 shadow-xl mb-12"
          >
              <h4 className="font-bold mb-6">{editingService ? 'Edit Service Offering' : 'Create New Service Offering'}</h4>
              {categories.length === 0 ? (
                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 text-amber-800 text-sm flex gap-4 items-center">
                  <AlertCircle size={24} className="shrink-0" />
                  <p className="font-medium">You need to create at least one category before adding services. Go to the <strong>Categories</strong> tab.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Category</label>
                      <select 
                        value={editingService ? editingService.categoryId : newService.categoryId}
                        onChange={(e) => editingService 
                          ? setEditingService({ ...editingService, categoryId: e.target.value })
                          : setNewService({ ...newService, categoryId: e.target.value })
                        }
                        className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900"
                      >
                        <option value="">Select Category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Service Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Deep Home Cleaning"
                        value={editingService ? editingService.name : newService.name}
                        onChange={(e) => editingService
                          ? setEditingService({ ...editingService, name: e.target.value })
                          : setNewService({ ...newService, name: e.target.value })
                        }
                        className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Base Price (₹)</label>
                      <input 
                        type="number" 
                        placeholder="999"
                        value={editingService ? editingService.basePrice : newService.basePrice}
                        onChange={(e) => editingService
                          ? setEditingService({ ...editingService, basePrice: Number(e.target.value) })
                          : setNewService({ ...newService, basePrice: Number(e.target.value) })
                        }
                        className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Duration</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 2 Hours"
                        value={editingService ? editingService.duration : newService.duration}
                        onChange={(e) => editingService
                          ? setEditingService({ ...editingService, duration: e.target.value })
                          : setNewService({ ...newService, duration: e.target.value })
                        }
                        className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900"
                      />
                    </div>
                  </div>
                  <div className="mb-6">
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Description</label>
                    <textarea 
                      value={editingService ? editingService.description : newService.description}
                      onChange={(e) => editingService
                        ? setEditingService({ ...editingService, description: e.target.value })
                        : setNewService({ ...newService, description: e.target.value })
                      }
                      className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900 h-24"
                      placeholder="Describe the service inclusions..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Service Image URL</label>
                      <input 
                        type="text" 
                        value={editingService ? editingService.imageURL : newService.imageURL}
                        onChange={(e) => editingService
                          ? setEditingService({ ...editingService, imageURL: e.target.value })
                          : setNewService({ ...newService, imageURL: e.target.value })
                        }
                        className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900"
                        placeholder="https://example.com/service-image.jpg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Price List PDF URL</label>
                      <input 
                        type="text" 
                        value={editingService ? editingService.priceListPDF : newService.priceListPDF}
                        onChange={(e) => editingService
                          ? setEditingService({ ...editingService, priceListPDF: e.target.value })
                          : setNewService({ ...newService, priceListPDF: e.target.value })
                        }
                        className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900"
                        placeholder="https://example.com/price-list.pdf"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Global Rating (0-5)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max="5"
                        value={editingService ? editingService.rating : newService.rating}
                        onChange={(e) => editingService
                          ? setEditingService({ ...editingService, rating: Number(e.target.value) })
                          : setNewService({ ...newService, rating: Number(e.target.value) })
                        }
                        className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900"
                        placeholder="4.8"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Virtual Review Count</label>
                      <input 
                        type="number" 
                        value={editingService ? editingService.reviewCount : newService.reviewCount}
                        onChange={(e) => editingService
                          ? setEditingService({ ...editingService, reviewCount: Number(e.target.value) })
                          : setNewService({ ...newService, reviewCount: Number(e.target.value) })
                        }
                        className="w-full bg-stone-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900"
                        placeholder="120"
                      />
                    </div>
                  </div>
                  
                  {(editingService?.imageURL || newService.imageURL) && (
                    <div className="mb-6 bg-stone-50 p-6 rounded-[28px] border border-stone-100 flex items-center gap-6">
                       <img 
                         src={editingService?.imageURL || newService.imageURL} 
                         alt="Service Preview" 
                         className="w-32 h-20 rounded-2xl object-cover border-4 border-white shadow-lg"
                       />
                       <div>
                          <p className="text-xs font-bold text-stone-900 uppercase tracking-tight">Service Image Live Preview</p>
                          <p className="text-[10px] text-stone-400 font-medium">Verify that the image loads correctly above.</p>
                       </div>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button 
                      onClick={editingService ? handleUpdateService : handleAddService}
                      className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-black transition-colors shadow-lg shadow-stone-200"
                    >
                      {editingService ? 'Update Service' : 'Publish Service'}
                    </button>
                    {editingService && (
                      <button 
                        onClick={() => setEditingService(null)}
                        className="bg-stone-100 text-stone-600 px-8 py-3 rounded-xl font-bold text-sm hover:bg-stone-200 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map(s => (
          <div key={s.id} className="bg-white p-6 border border-stone-200 rounded-[32px] group hover:border-stone-900 transition-all">
             <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-stone-900 group-hover:text-white transition-all">
                    <Briefcase size={20} />
                  </div>
                  <button 
                    onClick={() => {
                      setUpdatingImageId(s.id);
                      setTempImageUrl(s.imageURL || '');
                    }}
                    className="p-3 bg-stone-50 rounded-xl text-stone-400 hover:bg-stone-900 hover:text-white transition-all"
                    title="Update Image"
                  >
                    <ImageIcon size={20} />
                  </button>
                </div>
                <div className="text-right">
                   <p className="text-xl font-bold text-stone-900">₹{s.basePrice}</p>
                   <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{s.duration}</p>
                </div>
             </div>
             {s.imageURL ? (
               <div 
                 className="w-full h-32 rounded-2xl overflow-hidden mb-4 bg-stone-100 relative group/img cursor-pointer"
                 onClick={() => {
                   setUpdatingImageId(s.id);
                   setTempImageUrl(s.imageURL || '');
                 }}
               >
                  <img src={s.imageURL} alt={s.name} className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest bg-stone-900/80 px-4 py-2 rounded-full">Update Image</span>
                  </div>
               </div>
             ) : (
                <button 
                  onClick={() => {
                    setUpdatingImageId(s.id);
                    setTempImageUrl('');
                  }}
                  className="w-full h-32 rounded-2xl mb-4 bg-stone-100 border-2 border-dashed border-stone-200 flex flex-col items-center justify-center gap-2 hover:border-stone-900 hover:bg-white transition-all group/empty"
                >
                   <ImageIcon size={24} className="text-stone-300 group-hover/empty:text-stone-900 transition-colors" />
                   <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Attach Asset</span>
                </button>
             )}
             <h4 className="font-bold text-lg mb-2">{s.name}</h4>
             <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center text-amber-400">
                  <Star size={12} fill="currentColor" />
                  <span className="text-[11px] font-bold text-stone-900 ml-1">{s.rating || 0}</span>
                </div>
                <span className="text-[10px] text-stone-400 font-medium">({s.reviewCount || 0} reviews)</span>
             </div>
             <p className="text-sm text-stone-500 mb-6 line-clamp-2">{s.description}</p>
             <div className="flex justify-between items-center pt-6 border-t border-stone-50">
                <button 
                  onClick={() => {
                    setEditingService(s);
                    setIsAdding(false);
                    setViewingReviewsId(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors"
                >
                  Edit Details
                </button>
                <button 
                  onClick={() => setViewingReviewsId(s.id)}
                  className="text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors border-x border-stone-100 px-4"
                >
                  Reviews
                </button>
                <button onClick={() => deleteService(s.id)} className="text-xs font-bold text-rose-400 hover:text-rose-600 transition-colors text-right">Delete</button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PartnerManager({ partners, users }: { partners: PartnerProfile[], users: UserProfile[] }) {
  const [selectedRewardPartner, setSelectedRewardPartner] = useState<PartnerProfile | null>(null);
  const [selectedProfilePartner, setSelectedProfilePartner] = useState<(PartnerProfile & { user?: UserProfile }) | null>(null);
  const [manualKYCPartner, setManualKYCPartner] = useState<PartnerProfile | null>(null);
  const [rejectingKYCPartner, setRejectingKYCPartner] = useState<PartnerProfile | null>(null);
  const [rejectReason, setRejectReason] = useState('Documents are unclear or invalid.');
  const [manualDocs, setManualDocs] = useState<{type: string, url: string}[]>([
    { type: 'Manual Submission (ID)', url: 'https://ais-static.com/manual-check.pdf' },
    { type: 'Manual Submission (Address)', url: 'https://ais-static.com/manual-check.pdf' }
  ]);
  const [rewardAmount, setRewardAmount] = useState('10');
  const [rewardReason, setRewardReason] = useState('Service Excellence Reward');
  const [partnersSort, setPartnersSort] = useState<'earnings' | 'rating' | 'credits'>('earnings');
  const [pSearch, setPSearch] = useState('');

  const verifyPartner = async (partnerId: string, verified: boolean) => {
    try {
      const p = partners.find(x => x.id === partnerId);
      await updateDoc(doc(db, 'partners', partnerId), { 
        isVerified: verified,
        kycStatus: verified ? 'verified' : 'rejected',
        kycRejectReason: null,
        kycDocuments: p?.kycDocuments?.map(d => ({ ...d, status: verified ? 'verified' : 'rejected' })) || [],
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `partners/${partnerId}`);
    }
  };

  const rejectPartner = async () => {
    if (!rejectingKYCPartner || !rejectReason) return;
    try {
      await updateDoc(doc(db, 'partners', rejectingKYCPartner.id), { 
        isVerified: false,
        kycStatus: 'rejected',
        kycRejectReason: rejectReason,
        kycDocuments: rejectingKYCPartner.kycDocuments?.map(d => ({ ...d, status: 'rejected' })) || [],
        updatedAt: Timestamp.now()
      });
      setRejectingKYCPartner(null);
      setRejectReason('Documents are unclear or invalid.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `partners/${rejectingKYCPartner.id}`);
    }
  };

  const approveAllKYC = async () => {
    const pendingPartners = partners.filter(p => p.kycStatus === 'pending');
    if (pendingPartners.length === 0) return;
    if (!confirm(`Approve KYC for ${pendingPartners.length} partners?`)) return;
    
    try {
      await Promise.all(pendingPartners.map(p => 
        updateDoc(doc(db, 'partners', p.id), { 
          isVerified: true,
          kycStatus: 'verified',
          kycDocuments: p.kycDocuments?.map(d => ({ ...d, status: 'verified' })) || [],
          updatedAt: Timestamp.now()
        })
      ));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'bulk-kyc');
    }
  };

  const handleApplyReward = async () => {
    if (!selectedRewardPartner) return;
    try {
      const amount = parseInt(rewardAmount);
      await updateDoc(doc(db, 'partners', selectedRewardPartner.id), {
        rewardCredits: (selectedRewardPartner.rewardCredits || 0) + amount,
        lastRewardReason: rewardReason,
        updatedAt: Timestamp.now()
      });

      // Add to earnings history
      await addDoc(collection(db, 'partners', selectedRewardPartner.id, 'earningsHistory'), {
        type: 'reward_credit',
        amount: 0,
        credits: amount,
        reason: rewardReason,
        createdAt: Timestamp.now()
      });

      setSelectedRewardPartner(null);
      setRewardAmount('100');
      setRewardReason('Service Excellence Reward');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `partners/${selectedRewardPartner.id}`);
    }
  };

  const handleManualKYC = async () => {
    if (!manualKYCPartner) return;
    try {
      await updateDoc(doc(db, 'partners', manualKYCPartner.id), {
        kycStatus: 'verified',
        isVerified: true,
        kycDocuments: manualDocs.map(d => ({ ...d, status: 'verified' })),
        updatedAt: Timestamp.now()
      });
      setManualKYCPartner(null);
      alert("Manual KYC completed and partner verified.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'manual-kyc');
    }
  };

  const sortedPartners = [...partners]
    .filter(p => {
      const u = users.find(user => user.uid === p.userId);
      const nameMatch = u?.displayName?.toLowerCase().includes(pSearch.toLowerCase());
      const emailMatch = u?.email?.toLowerCase().includes(pSearch.toLowerCase());
      return nameMatch || emailMatch;
    })
    .sort((a, b) => {
    if (partnersSort === 'earnings') return (b.totalEarnings || 0) - (a.totalEarnings || 0);
    if (partnersSort === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (partnersSort === 'credits') return (b.rewardCredits || 0) - (a.rewardCredits || 0);
    return 0;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
        <div>
           <h3 className="text-xl font-bold">Partner Fleet</h3>
           <p className="text-stone-400 text-sm">Manage professionals and rewards</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
           <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={14} />
              <input 
                type="text"
                placeholder="Search by name or email..."
                value={pSearch}
                onChange={(e) => setPSearch(e.target.value)}
                className="w-full bg-stone-100 border-none rounded-xl pl-10 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-stone-900 outline-none"
              />
           </div>
           <div className="flex bg-stone-100 p-1 rounded-xl shrink-0">
             {(['earnings', 'rating', 'credits'] as const).map(s => (
               <button 
                key={s}
                onClick={() => setPartnersSort(s)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  partnersSort === s ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'
                }`}
               >
                 {s}
               </button>
             ))}
           </div>
           <button 
            onClick={approveAllKYC}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
           >
             <ShieldCheck size={16} />
             Bulk KYC Approve
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {sortedPartners.map(p => {
          const user = users.find(u => u.uid === p.userId);
          return (
            <div key={p.id} className="bg-white p-8 border border-stone-200 rounded-[40px] shadow-sm relative overflow-hidden group hover:border-stone-900 transition-all">
               <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="relative mb-6">
                     <img 
                        src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName}`} 
                        className="w-24 h-24 rounded-[32px] object-cover bg-stone-50"
                        alt={user?.displayName}
                     />
                     {p.isVerified ? (
                       <div className="absolute -bottom-2 -right-2 p-1.5 bg-white rounded-full shadow-sm text-emerald-500 border border-stone-100">
                          <CheckCircle2 size={16} fill="currentColor" className="text-white fill-emerald-500" />
                       </div>
                     ) : (
                       <div className="absolute -bottom-2 -right-2 p-1.5 bg-white rounded-full shadow-sm text-rose-500 border border-stone-100">
                          <ShieldAlert size={16} />
                       </div>
                     )}
                  </div>
                  <div className="mb-4">
                     <span className={`text-[8px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                       p.isVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                     }`}>
                        {p.isVerified ? 'KYC Verified' : 'KYC Not Verified'}
                     </span>
                  </div>
                  <h4 className="font-bold text-xl mb-1">{user?.displayName || 'Unknown Pro'}</h4>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${
                      p.availabilityStatus === 'Available' ? 'bg-emerald-400' :
                      p.availabilityStatus === 'Busy' ? 'bg-amber-400' : 'bg-stone-500'
                    }`} />
                    <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest leading-none">{p.availabilityStatus || 'Offline'}</span>
                  </div>
                  {p.statusReason && (
                    <div className="mb-4 px-3 py-2 bg-stone-50/50 rounded-lg inline-block border border-stone-100">
                      <p className="text-[9px] text-stone-400 italic font-medium">"{p.statusReason}"</p>
                    </div>
                  )}
                  <p className="text-xs text-stone-400 font-bold mb-6 uppercase tracking-[0.25em]">{user?.email}</p>
                  
                  <div className="flex gap-4 w-full mb-8 py-4 border-y border-stone-50">
                     <div className="flex-1">
                        <p className="text-sm font-bold text-stone-900">₹{p.totalEarnings?.toLocaleString() || 0}</p>
                        <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Earnings</p>
                     </div>
                     <div className="flex-1 border-x border-stone-50">
                        <p className="text-sm font-bold text-stone-900">{p.rewardCredits || 0}</p>
                        <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Credits</p>
                     </div>
                     <div className="flex-1">
                        <p className="text-sm font-bold text-stone-900">{p.rating}</p>
                        <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Rating</p>
                     </div>
                  </div>

                  {p.kycStatus === 'pending' && (
                    <div className="w-full mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left">
                       <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">Verification Details</p>
                       <div className="space-y-4">
                          <div className="p-3 bg-white rounded-xl border border-amber-100">
                             <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Target Categories</p>
                             <div className="flex flex-wrap gap-1">
                                {p.categories?.map(c => (
                                   <span key={c} className="text-[9px] font-bold bg-stone-900 text-white px-2 py-0.5 rounded-full">{c}</span>
                                ))}
                             </div>
                          </div>
                          {p.bio && (
                             <div className="p-3 bg-white rounded-xl border border-amber-100">
                                <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Pro Bio</p>
                                <p className="text-[10px] text-stone-600 italic line-clamp-3">{p.bio}</p>
                             </div>
                          )}
                          <div className="space-y-2">
                             <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest">KYC Documents</p>
                             {p.kycDocuments?.map((doc, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-amber-100">
                                   <span className="text-[10px] font-bold text-stone-900">{doc.type}</span>
                                   <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-stone-400 hover:text-stone-900 uppercase bg-stone-50 px-2 py-1 rounded">View</a>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  )}

                  {user?.phoneNumber && (
                    <div className="mb-6 w-full py-3 bg-stone-50 rounded-2xl flex items-center justify-between px-6 border border-stone-100">
                      <div className="flex items-center gap-2">
                        <Smartphone size={14} className="text-stone-400" />
                        <span className="text-sm font-bold text-stone-900">{user.phoneNumber.replace('+91', '')}</span>
                      </div>
                      <a 
                        href={`tel:${user.phoneNumber}`}
                        className="bg-stone-900 px-4 py-2 text-white rounded-xl hover:bg-black transition-all shadow-md flex items-center gap-2 shrink-0 group"
                        title={`Call ${user.displayName}`}
                      >
                         <Phone size={12} className="group-hover:animate-bounce" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Call Now</span>
                      </a>
                    </div>
                  )}

                  <div className="w-full mb-6 text-left space-y-3">
                     <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Availability</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                           <div className={`w-2 h-2 rounded-full ${
                              p.availabilityStatus === 'Available' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                              p.availabilityStatus === 'Busy' ? 'bg-amber-500' : 'bg-stone-300'
                           }`} />
                           <span className={
                              p.availabilityStatus === 'Available' ? 'text-emerald-600' :
                              p.availabilityStatus === 'Busy' ? 'text-amber-600' : 'text-stone-400'
                           }>{p.availabilityStatus || 'Offline'}</span>
                        </div>
                     </div>
                     {p.statusReason && (
                        <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                           <p className="text-[10px] text-stone-500 leading-relaxed italic">"{p.statusReason}"</p>
                        </div>
                     )}
                  </div>

                   <div className="flex w-full gap-3">
                     <button 
                       onClick={() => setSelectedProfilePartner({ ...p, user })}
                       className="flex-1 bg-stone-50 text-stone-900 border border-stone-200 rounded-xl py-3 text-xs font-bold hover:bg-stone-100 transition-all"
                     >
                       Full Profile
                     </button>
                    {!p.isVerified ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <button 
                          onClick={() => verifyPartner(p.id, true)}
                          className="w-full bg-emerald-600 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                        >
                          Approve KYC
                        </button>
                        <button 
                          onClick={() => setManualKYCPartner(p)}
                          className="w-full bg-stone-100 text-stone-600 rounded-xl py-2 text-[8px] font-black uppercase tracking-widest hover:bg-stone-200 transition-all"
                        >
                          Manual KYC Entry
                        </button>
                        <button 
                          onClick={() => setRejectingKYCPartner(p)}
                          className="w-full bg-rose-50 text-rose-600 rounded-xl py-2 text-[8px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
                        >
                          Reject KYC
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => updateStatus(p.id, p.status === 'active' ? 'inactive' : 'active')}
                        className={`flex-1 rounded-xl py-3 text-xs font-bold transition-all active:scale-95 ${
                          p.status === 'active' ? 'bg-stone-900 text-white hover:bg-stone-800' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                      >
                        {p.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </button>
                    )}
                     <button 
                      onClick={() => setSelectedRewardPartner(p)}
                      className="bg-amber-50 text-amber-600 p-3 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                      title="Credit/Manage Rewards"
                     >
                        <Star size={18} />
                     </button>
                  </div>
               </div>
               <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-stone-50 rounded-full z-0 group-hover:scale-110 transition-transform" />
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedRewardPartner && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-2">Manage Rewards</h3>
              <p className="text-stone-500 text-sm mb-8">Adjust reward points for partner.</p>
              
              <div className="space-y-6">
                 <div>
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">Add Points</label>
                   <input 
                    type="number"
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 text-2xl font-bold text-stone-900 focus:ring-2 focus:ring-stone-900 outline-none"
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">Reason for Credit</label>
                   <textarea 
                    value={rewardReason}
                    onChange={(e) => setRewardReason(e.target.value)}
                    placeholder="e.g. Completed 10 bookings this week"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-stone-900 outline-none h-24"
                   />
                 </div>

                 <div className="flex gap-4">
                    <button onClick={() => setSelectedRewardPartner(null)} className="flex-1 py-4 text-stone-500 font-bold hover:bg-stone-50 rounded-2xl transition-colors">Cancel</button>
                    <button onClick={handleApplyReward} className="flex-[2] bg-stone-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-xl shadow-stone-200">
                      Apply Points
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}

        {manualKYCPartner && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-2 italic">Manual Verification</h3>
              <p className="text-stone-500 text-sm mb-8 font-medium">Override system and mark KYC as verified manually.</p>
              
              <div className="space-y-6">
                 <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100 flex items-center gap-4">
                    <ShieldCheck size={32} className="text-emerald-600" />
                    <div>
                       <p className="text-xs font-bold text-stone-900">Force Verification</p>
                       <p className="text-[10px] text-stone-400 leading-relaxed font-medium">This will bypass the standard document upload flow and instantly verify the pro badge.</p>
                    </div>
                 </div>
                 
                 <div className="flex gap-4">
                    <button onClick={() => setManualKYCPartner(null)} className="flex-1 py-4 text-stone-400 font-bold hover:bg-stone-50 rounded-2xl transition-colors uppercase tracking-widest text-[10px]">Cancel</button>
                    <button onClick={handleManualKYC} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-900/20 uppercase tracking-widest text-[10px]">Verify Now</button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}

        {rejectingKYCPartner && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-2 italic">Reject KYC</h3>
              <p className="text-stone-500 text-sm mb-8 font-medium">Provide a reason for rejecting the partner's documents.</p>
              
              <div className="space-y-6">
                 <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 ml-1">Rejection Reason</label>
                    <textarea 
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-100 rounded-3xl p-6 text-sm font-medium focus:ring-4 focus:ring-stone-900/5 transition-all outline-none h-32 resize-none"
                    />
                 </div>
                 
                 <div className="flex gap-4">
                    <button onClick={() => setRejectingKYCPartner(null)} className="flex-1 py-4 text-stone-400 font-bold hover:bg-stone-50 rounded-2xl transition-colors uppercase tracking-widest text-[10px]">Cancel</button>
                    <button onClick={rejectPartner} className="flex-1 bg-rose-600 text-white py-4 rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-xl shadow-rose-900/10 uppercase tracking-widest text-[10px]">Confirm Rejection</button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProfilePartner && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
               <div className="sticky top-0 bg-white/80 backdrop-blur-md px-10 py-6 border-b border-stone-50 flex justify-between items-center z-10">
                  <h3 className="text-xl font-bold">Partner Dossier</h3>
                  <button onClick={() => setSelectedProfilePartner(null)} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                     <X size={20} />
                  </button>
               </div>
               
               <div className="p-10 space-y-10">
                  <div className="flex items-center gap-8">
                     <img 
                        src={selectedProfilePartner.user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedProfilePartner.user?.displayName}`} 
                        className="w-32 h-32 rounded-[40px] object-cover bg-stone-50 border-4 border-stone-50 shadow-xl"
                        alt={selectedProfilePartner.user?.displayName}
                     />
                     <div>
                        <div className="flex items-center gap-3 mb-2">
                           <h4 className="text-3xl font-bold text-stone-900 tracking-tight">{selectedProfilePartner.user?.displayName}</h4>
                           <span className={`text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-widest ${
                             selectedProfilePartner.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                           }`}>
                             {selectedProfilePartner.status}
                           </span>
                        </div>
                        <p className="text-stone-400 font-medium">{selectedProfilePartner.user?.email}</p>
                        <div className="flex items-center gap-4 mt-2">
                           <p className="text-stone-600 font-bold font-mono">{selectedProfilePartner.user?.phoneNumber || 'No Phone Number'}</p>
                           {selectedProfilePartner.user?.phoneNumber && (
                             <a 
                               href={`tel:${selectedProfilePartner.user.phoneNumber}`}
                               className="bg-stone-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-stone-200"
                             >
                                <Phone size={12} /> Call Agent
                             </a>
                           )}
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                     <div className="bg-stone-50 p-6 rounded-[32px] text-center border border-stone-100">
                        <p className="text-2xl font-bold text-stone-900">₹{selectedProfilePartner.totalEarnings?.toLocaleString() || 0}</p>
                        <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest mt-1">Total Scale</p>
                     </div>
                     <div className="bg-stone-50 p-6 rounded-[32px] text-center border border-stone-100">
                        <p className="text-2xl font-bold text-stone-900">{selectedProfilePartner.rewardCredits || 0}</p>
                        <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest mt-1">Loyalty Points</p>
                     </div>
                     <div className="bg-stone-50 p-6 rounded-[32px] text-center border border-stone-100">
                        <p className="text-2xl font-bold text-stone-900">{selectedProfilePartner.rating}</p>
                        <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest mt-1">Satisfaction</p>
                     </div>
                  </div>

                  <div className="space-y-8 bg-stone-50/50 p-8 rounded-[40px] border border-stone-100">
                     <div>
                        <h5 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4">Availability Status</h5>
                        <div className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-stone-100">
                           <div className={`w-3 h-3 rounded-full ${
                              selectedProfilePartner.availabilityStatus === 'Available' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse' :
                              selectedProfilePartner.availabilityStatus === 'Busy' ? 'bg-amber-500' : 'bg-stone-300'
                           }`} />
                           <div>
                              <p className={`font-bold text-sm ${
                                 selectedProfilePartner.availabilityStatus === 'Available' ? 'text-emerald-600' :
                                 selectedProfilePartner.availabilityStatus === 'Busy' ? 'text-amber-600' : 'text-stone-400'
                              }`}>{selectedProfilePartner.availabilityStatus || 'Offline'}</p>
                              {selectedProfilePartner.statusReason && (
                                 <p className="text-xs text-stone-400 mt-1 italic leading-relaxed">"{selectedProfilePartner.statusReason}"</p>
                               )}
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <div>
                        <h5 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4">Professional Bio</h5>
                        <p className="text-sm text-stone-600 leading-relaxed bg-stone-50/50 p-6 rounded-[32px] border border-stone-50 italic">
                           {selectedProfilePartner.bio || "No professional overview provided by this partner yet."}
                        </p>
                     </div>

                     <div>
                        <h5 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4">Competencies</h5>
                        <div className="flex flex-wrap gap-2">
                           {selectedProfilePartner.categories?.map(catId => (
                             <span key={catId} className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold">
                               {catId.toUpperCase()}
                             </span>
                           ))}
                           {(!selectedProfilePartner.categories || selectedProfilePartner.categories.length === 0) && (
                             <span className="text-xs text-stone-400 italic">No categories assigned.</span>
                           )}
                        </div>
                     </div>

                     <div className="pt-6 border-t border-stone-100">
                        <h5 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4">Validation Status</h5>
                        <div className="flex items-center gap-6">
                           <div className={`p-4 rounded-2xl flex items-center gap-3 ${selectedProfilePartner.isVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              <ShieldCheck size={20} />
                              <span className="text-xs font-bold">{selectedProfilePartner.isVerified ? 'Partner Verified' : 'Awaiting Authentication'}</span>
                           </div>
                           <p className="text-[10px] text-stone-400 font-bold">JOINED: {selectedProfilePartner.createdAt?.toDate?.() ? selectedProfilePartner.createdAt.toDate().toLocaleDateString() : 'Historical Node'}</p>
                        </div>
                     </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                     <button 
                        onClick={() => { setSelectedRewardPartner(selectedProfilePartner); setSelectedProfilePartner(null); }}
                        className="flex-1 bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2"
                     >
                        <Star size={18} />
                        Incentive Points
                     </button>
                     <button 
                        onClick={() => setSelectedProfilePartner(null)}
                        className="px-10 py-4 text-stone-400 font-bold hover:bg-stone-50 rounded-2xl transition-colors border border-stone-100"
                     >
                        Dismiss
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

function UserManager({ users, bookings }: { users: UserProfile[], bookings: Booking[] }) {
  return (
    <div className="bg-white rounded-[40px] border border-stone-200 overflow-hidden shadow-sm">
       <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead className="bg-stone-50/50">
                <tr className="text-[10px] font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100 italic">
                   <th className="px-8 py-5">User Profile</th>
                   <th className="px-8 py-5">Mobile</th>
                   <th className="px-8 py-5">Role</th>
                   <th className="px-8 py-5">History</th>
                   <th className="px-8 py-5 text-right">Acquisition</th>
                </tr>
             </thead>
             <tbody>
                {users.map((u, i) => {
                  const userBookings = bookings.filter(b => b.customerId === u.uid);
                  return (
                    <tr key={i} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
                       <td className="px-8 py-6">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-stone-100 rounded-2xl flex items-center justify-center font-bold text-stone-400 text-xs">
                               {u.displayName?.[0] || 'U'}
                            </div>
                            <div>
                               <p className="text-sm font-bold text-stone-900">{u.displayName}</p>
                               <p className="text-xs text-stone-400">{u.email}</p>
                            </div>
                         </div>
                       </td>
                       <td className="px-8 py-6">
                         <p className="text-sm font-bold text-stone-900">
                           {(!u.phoneNumber || import.meta.env.DEV) ? '--' : u.phoneNumber.replace('+91', '')}
                         </p>
                       </td>
                       <td className="px-8 py-6">
                          <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-widest ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            u.role === 'partner' ? 'bg-stone-900 text-white' :
                            'bg-stone-100 text-stone-500'
                          }`}>
                             {u.role}
                          </span>
                       </td>
                       <td className="px-8 py-6">
                          <p className="text-sm font-bold text-stone-900">{userBookings.length} Bookings</p>
                          <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">₹{userBookings.reduce((a, b) => a + b.totalPrice, 0)} LTV</p>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <p className="text-xs text-stone-500">{u.createdAt?.toDate?.() ? u.createdAt.toDate().toLocaleDateString() : new Date(u.createdAt).toLocaleDateString()}</p>
                       </td>
                    </tr>
                  );
                })}
             </tbody>
          </table>
       </div>
    </div>
  );
}

function PromoManager({ promotions, categories, services }: { promotions: Promotion[], categories: Category[], services: Service[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newPromo, setNewPromo] = useState<Partial<Promotion>>({
    name: '',
    code: '',
    discountType: 'percent',
    discountValue: 0,
    description: '',
    active: true,
    expiryDate: '',
    applicableCategories: [],
    applicableServices: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreatePromo = async () => {
    if (!newPromo.name || !newPromo.code) return;
    setIsSubmitting(true);
    try {
      const promoData = {
        ...newPromo,
        usageCount: 0,
        expiryDate: newPromo.expiryDate || null,
        createdAt: Timestamp.now()
      };
      
      await addDoc(collection(db, 'promotions'), promoData);
      setNewPromo({
        name: '',
        code: '',
        discountType: 'percent',
        discountValue: 0,
        description: '',
        active: true,
        expiryDate: '',
        applicableCategories: [],
        applicableServices: []
      });
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'promotions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePromo = async (promo: Promotion) => {
    try {
      await updateDoc(doc(db, 'promotions', promo.id), {
        active: !promo.active
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `promotions/${promo.id}`);
    }
  };

  const deletePromo = async (id: string) => {
    if (!confirm('Delete this promotion?')) return;
    try {
      await deleteDoc(doc(db, 'promotions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `promotions/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
         <h3 className="text-xl font-bold">Campaign Center</h3>
         <button 
           onClick={() => setIsAdding(!isAdding)}
           className="bg-stone-900 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold text-xs"
         >
           {isAdding ? <X size={16} /> : <Plus size={16} />}
           {isAdding ? 'Cancel' : 'New Promo Code'}
         </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-8 border border-stone-200 rounded-[32px] shadow-sm max-w-2xl"
          >
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Code</label>
                   <input 
                    type="text"
                    value={newPromo.code}
                    onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                    placeholder="FEAST50"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-stone-900 outline-none"
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Campaign Name</label>
                   <input 
                    type="text"
                    value={newPromo.name}
                    onChange={(e) => setNewPromo({ ...newPromo, name: e.target.value })}
                    placeholder="Festive Season Offer"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900 outline-none"
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Discount Type</label>
                   <select 
                    value={newPromo.discountType}
                    onChange={(e) => setNewPromo({ ...newPromo, discountType: e.target.value as 'percent' | 'flat' })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900 outline-none"
                   >
                     <option value="percent">Percentage (%)</option>
                     <option value="flat">Flat Amount (₹)</option>
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Value</label>
                   <input 
                    type="number"
                    value={newPromo.discountValue}
                    onChange={(e) => setNewPromo({ ...newPromo, discountValue: parseInt(e.target.value) || 0 })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-stone-900 outline-none"
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Expiry Date</label>
                   <input 
                    type="date"
                    value={newPromo.expiryDate}
                    onChange={(e) => setNewPromo({ ...newPromo, expiryDate: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900 outline-none"
                   />
                </div>
                <div className="md:col-span-2">
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Target Categories (Select Multiple)</label>
                   <div className="flex flex-wrap gap-2 mb-3">
                     {categories.map(cat => {
                       const isSelected = newPromo.applicableCategories?.includes(cat.id);
                       return (
                         <button
                           key={cat.id}
                           onClick={() => {
                             const current = newPromo.applicableCategories || [];
                             if (isSelected) {
                               setNewPromo({ ...newPromo, applicableCategories: current.filter(id => id !== cat.id) });
                             } else {
                               setNewPromo({ ...newPromo, applicableCategories: [...current, cat.id] });
                             }
                           }}
                           className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                             isSelected ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-400'
                           }`}
                         >
                           {cat.name}
                         </button>
                       );
                     })}
                   </div>
                   <p className="text-[9px] text-stone-400 italic">Leaves empty for all categories.</p>
                </div>
                <div className="md:col-span-2">
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Target Specific Services (Select Multiple)</label>
                   <div className="flex flex-wrap gap-2 mb-3 max-h-40 overflow-y-auto p-1">
                     {services
                       .filter(s => newPromo.applicableCategories?.length === 0 || newPromo.applicableCategories?.includes(s.categoryId))
                       .map(svc => {
                         const isSelected = newPromo.applicableServices?.includes(svc.id);
                         return (
                           <button
                             key={svc.id}
                             onClick={() => {
                               const current = newPromo.applicableServices || [];
                               if (isSelected) {
                                 setNewPromo({ ...newPromo, applicableServices: current.filter(id => id !== svc.id) });
                               } else {
                                 setNewPromo({ ...newPromo, applicableServices: [...current, svc.id] });
                               }
                             }}
                             className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                               isSelected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-400'
                             }`}
                           >
                             {svc.name}
                           </button>
                         );
                       })}
                   </div>
                   <p className="text-[9px] text-stone-400 italic">If services are selected, the promo will only work for those specific services. If empty, it applies to all services in selected categories.</p>
                </div>
                <div className="md:col-span-2">
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Description</label>
                   <input 
                    type="text"
                    value={newPromo.description}
                    onChange={(e) => setNewPromo({ ...newPromo, description: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900 outline-none"
                   />
                </div>
             </div>
             <button 
              onClick={handleCreatePromo}
              disabled={isSubmitting || !newPromo.code || !newPromo.name}
              className="mt-8 w-full bg-stone-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all disabled:opacity-50"
             >
               Launch Campaign
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {promotions.map(promo => (
          <div key={promo.id} className="bg-white p-6 border border-stone-200 rounded-[32px] hover:border-stone-900 transition-all group relative overflow-hidden">
             <div className="flex justify-between items-start mb-4">
                <div className="bg-stone-50 px-3 py-1 rounded-lg text-stone-900 font-black text-[10px] tracking-widest">{promo.code}</div>
                <div className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${promo.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {promo.active ? 'Active' : 'Paused'}
                </div>
             </div>
             <h4 className="font-bold text-stone-900 mb-1">{promo.name}</h4>
             <p className="text-xs text-stone-400 line-clamp-2 mb-2">{promo.description}</p>
             
             {((promo.applicableCategories && promo.applicableCategories.length > 0) || (promo.applicableServices && promo.applicableServices.length > 0)) && (
               <div className="flex flex-wrap gap-2 mb-4">
                  {promo.applicableCategories?.map(catId => (
                    <span key={catId} className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      Cat: {categories.find(c => c.id === catId)?.name || 'Unknown'}
                    </span>
                  ))}
                  {promo.applicableServices?.map(svcId => (
                    <span key={svcId} className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      Svc: {services.find(s => s.id === svcId)?.name || 'Unknown'}
                    </span>
                  ))}
               </div>
             )}
             
             <div className="flex justify-between items-center mb-6 py-4 border-y border-stone-50">
                <div>
                  <p className="text-xl font-black text-stone-900">{promo.discountType === 'percent' ? `${promo.discountValue}%` : `₹${promo.discountValue}`}</p>
                  <p className="text-[8px] text-stone-400 font-bold uppercase tracking-widest">Off</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-stone-900">{promo.usageCount || 0}</p>
                  <p className="text-[8px] text-stone-400 font-bold uppercase tracking-widest">Redeemed</p>
                </div>
             </div>

             <div className="flex justify-between items-center">
                <p className="text-[9px] text-stone-400 font-bold flex items-center gap-1.5 uppercase tracking-widest">
                  <Clock size={12} /> {promo.expiryDate ? new Date(promo.expiryDate).toLocaleDateString() : 'No Limit'}
                </p>
                <div className="flex gap-2">
                   <button onClick={() => togglePromo(promo)} className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
                     {promo.active ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                   </button>
                   <button onClick={() => deletePromo(promo.id)} className="p-2 text-stone-400 hover:text-red-600 transition-colors">
                     <XCircle size={16} />
                   </button>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HelpCenterManager({ faqs }: { faqs: FAQ[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [newFaq, setNewFaq] = useState<Partial<FAQ>>({
    question: '',
    answer: '',
    category: 'General',
    isPublished: true,
    order: (faqs.length + 1)
  });

  const handleCreateFaq = async () => {
    if (!newFaq.question || !newFaq.answer) return;
    try {
      await addDoc(collection(db, 'faqs'), {
        ...newFaq,
        createdAt: Timestamp.now()
      });
      setNewFaq({ question: '', answer: '', category: 'General', isPublished: true, order: faqs.length + 2 });
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'faqs');
    }
  };

  const handleUpdateFaq = async () => {
    if (!editingFaq || !editingFaq.question || !editingFaq.answer) return;
    try {
      const { id, ...data } = editingFaq;
      await updateDoc(doc(db, 'faqs', id), {
        ...data,
        updatedAt: Timestamp.now()
      });
      setEditingFaq(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `faqs/${editingFaq.id}`);
    }
  };

  const deleteFaq = async (id: string) => {
    if (!confirm('Remove this FAQ?')) return;
    try {
      await deleteDoc(doc(db, 'faqs', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `faqs/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
         <h3 className="text-xl font-bold">FAQ & Knowledge Base</h3>
         <button 
           onClick={() => { setIsAdding(!isAdding); setEditingFaq(null); }}
           className="bg-stone-900 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold text-xs"
         >
           {isAdding ? <X size={16} /> : <Plus size={16} />}
           {isAdding ? 'Cancel' : 'New Article'}
         </button>
      </div>

      <AnimatePresence>
        {(isAdding || editingFaq) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-8 border border-stone-200 rounded-[32px] shadow-sm max-w-2xl"
          >
             <h4 className="text-lg font-bold mb-6">{editingFaq ? 'Edit FAQ Article' : 'Create New Knowledge Base Article'}</h4>
             <div className="space-y-6">
                <div>
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Question</label>
                   <input 
                    type="text"
                    value={editingFaq ? editingFaq.question : newFaq.question}
                    onChange={(e) => editingFaq ? setEditingFaq({ ...editingFaq, question: e.target.value }) : setNewFaq({ ...newFaq, question: e.target.value })}
                    placeholder="How do I book a service?"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-stone-900 outline-none"
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Category</label>
                   <select 
                    value={editingFaq ? editingFaq.category : newFaq.category}
                    onChange={(e) => editingFaq ? setEditingFaq({ ...editingFaq, category: e.target.value }) : setNewFaq({ ...newFaq, category: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-stone-900 outline-none"
                   >
                     <option value="General">General</option>
                     <option value="Payments">Payments</option>
                     <option value="Bookings">Bookings</option>
                     <option value="Partners">Partners</option>
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Answer</label>
                   <textarea 
                    value={editingFaq ? editingFaq.answer : newFaq.answer}
                    onChange={(e) => editingFaq ? setEditingFaq({ ...editingFaq, answer: e.target.value }) : setNewFaq({ ...newFaq, answer: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-stone-900 outline-none h-40"
                   />
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={editingFaq ? handleUpdateFaq : handleCreateFaq}
                    className="flex-1 bg-stone-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all shadow-lg shadow-stone-200"
                  >
                    {editingFaq ? 'Save Changes' : 'Publish Article'}
                  </button>
                  {editingFaq && (
                    <button 
                      onClick={() => setEditingFaq(null)}
                      className="px-8 py-4 text-stone-400 font-bold hover:bg-stone-50 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[40px] border border-stone-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50">
            <tr className="text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100">
               <th className="px-8 py-5">Article</th>
               <th className="px-8 py-5">Category</th>
               <th className="px-8 py-5">Status</th>
               <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {faqs.map(faq => (
              <tr key={faq.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
                <td className="px-8 py-6">
                   <p className="text-sm font-bold text-stone-900">{faq.question}</p>
                   <p className="text-[10px] text-stone-400 truncate max-w-md">{faq.answer}</p>
                </td>
                <td className="px-8 py-6">
                   <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-full uppercase tracking-tighter">{faq.category}</span>
                </td>
                <td className="px-8 py-6">
                   <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${faq.isPublished ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-900">{faq.isPublished ? 'Published' : 'Draft'}</span>
                   </div>
                </td>
                <td className="px-8 py-6 text-right">
                   <div className="flex justify-end gap-2">
                     <button onClick={() => { setEditingFaq(faq); setIsAdding(false); }} className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
                        <Settings size={18} />
                     </button>
                     <button onClick={() => deleteFaq(faq.id)} className="p-2 text-stone-300 hover:text-red-600 transition-colors">
                        <XCircle size={18} />
                     </button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TicketManager({ tickets, users }: { tickets: SupportTicket[], users: UserProfile[] }) {
  const [statusFilter, setStatusFilter] = useState<SupportTicket['status'] | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<SupportTicket['priority'] | 'all'>('all');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState('');

  const updateTicketStatus = async (id: string, status: SupportTicket['status']) => {
    try {
      await updateDoc(doc(db, 'tickets', id), { 
        status, 
        updatedAt: Timestamp.now() 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${id}`);
    }
  };

  const handleRespond = async (id: string) => {
    if (!responseTime) return;
    try {
      await updateDoc(doc(db, 'tickets', id), { 
        adminResponse: responseTime,
        status: 'in_progress',
        updatedAt: Timestamp.now() 
      });
      setRespondingTo(null);
      setResponseTime('');
      alert('Response recorded successfully.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${id}`);
    }
  };

  const deleteTicket = async (id: string) => {
    if (!confirm('Remove this ticket?')) return;
    try {
      await deleteDoc(doc(db, 'tickets', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tickets/${id}`);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const sMatch = statusFilter === 'all' || t.status === statusFilter;
    const pMatch = priorityFilter === 'all' || t.priority === priorityFilter;
    return sMatch && pMatch;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
         <div>
            <h3 className="text-xl font-bold">Support Queue</h3>
            <p className="text-sm text-stone-400">Manage user issues and inquiries</p>
         </div>
         <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-stone-200">
               <Filter size={14} className="text-stone-400" />
               <select 
                 value={statusFilter}
                 onChange={(e) => setStatusFilter(e.target.value as any)}
                 className="text-xs font-bold bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
               >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
               </select>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-stone-200">
               <AlertCircle size={14} className="text-stone-400" />
               <select 
                 value={priorityFilter}
                 onChange={(e) => setPriorityFilter(e.target.value as any)}
                 className="text-xs font-bold bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
               >
                  <option value="all">All Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
               </select>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredTickets.map(ticket => {
          const user = users.find(u => u.uid === ticket.userId);
          return (
            <div key={ticket.id} className="bg-white border border-stone-200 rounded-[32px] hover:border-stone-900 transition-all group overflow-hidden shadow-sm hover:shadow-md">
               <div className="p-8">
                <div className="flex flex-col lg:flex-row justify-between gap-8">
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center gap-3">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                            ticket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                            ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {ticket.status}
                          </span>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                            ticket.priority === 'high' ? 'bg-red-100 text-red-700' :
                            ticket.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
                            'bg-stone-100 text-stone-500'
                          }`}>
                            {ticket.priority} Priority
                          </span>
                          <span className="text-[10px] text-stone-300 font-medium font-mono">
                            #ID-{ticket.id.slice(0, 8).toUpperCase()}
                          </span>
                      </div>
                      <h4 className="text-xl font-bold text-stone-900">{ticket.subject}</h4>
                      <p className="text-sm text-stone-500 leading-relaxed font-medium">{ticket.message}</p>
                      
                      {ticket.adminResponse && (
                        <div className="mt-4 p-5 bg-stone-900 text-white rounded-2xl relative">
                           <div className="absolute -top-2 left-6 px-3 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full">Official Response</div>
                           <p className="text-xs italic text-stone-300">"{ticket.adminResponse}"</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-4">
                          <div className="w-10 h-10 bg-stone-100 rounded-2xl flex items-center justify-center text-sm font-bold text-stone-900 border border-stone-200">
                            {user?.displayName?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-stone-900">{user?.displayName || 'Unknown User'}</p>
                            <p className="text-[10px] text-stone-400 font-medium">{user?.email}</p>
                          </div>
                          <span className="ml-auto text-[10px] text-stone-300 font-bold uppercase tracking-widest">
                            {ticket.createdAt?.toDate?.() ? ticket.createdAt.toDate().toLocaleDateString() : new Date(ticket.createdAt).toLocaleDateString()}
                          </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row lg:flex-col gap-3 justify-end min-w-[200px]">
                      <select 
                        value={ticket.status}
                        onChange={(e) => updateTicketStatus(ticket.id, e.target.value as any)}
                        className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-stone-900 outline-none cursor-pointer"
                      >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                      </select>
                      <button 
                        onClick={() => respondingTo === ticket.id ? setRespondingTo(null) : setRespondingTo(ticket.id)}
                        className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          respondingTo === ticket.id ? 'bg-stone-100 text-stone-500' : 'bg-stone-900 text-white hover:bg-black'
                        }`}
                      >
                        <MessageSquare size={14} /> {respondingTo === ticket.id ? 'Cancel' : 'Respond'}
                      </button>
                      <button 
                        onClick={() => deleteTicket(ticket.id)}
                        className="p-3 text-stone-300 hover:text-red-600 transition-colors bg-stone-50 rounded-xl hover:bg-stone-100 flex items-center justify-center"
                      >
                        <X size={20} />
                      </button>
                    </div>
                </div>

                <AnimatePresence>
                  {respondingTo === ticket.id && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-8 pt-8 border-t border-stone-100"
                    >
                       <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">Admin Response Message</label>
                       <textarea 
                        value={responseTime}
                        onChange={(e) => setResponseTime(e.target.value)}
                        placeholder="Type your response here. This will be visible to the user..."
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-stone-900 outline-none h-32 mb-4"
                       />
                       <button 
                        onClick={() => handleRespond(ticket.id)}
                        disabled={!responseTime}
                        className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold text-xs hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2 ml-auto"
                       >
                         Send Response <ChevronRight size={14} />
                       </button>
                    </motion.div>
                  )}
                </AnimatePresence>
               </div>
            </div>
          );
        })}
        {filteredTickets.length === 0 && (
          <div className="py-24 text-center bg-white border border-dashed border-stone-200 rounded-[40px]">
             <MessageSquare size={48} className="mx-auto text-stone-200 mb-4" />
             <p className="text-stone-400 font-medium italic">No tickets match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewManager({ serviceId }: { serviceId: string }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'reviews'), 
      where('serviceId', '==', serviceId), 
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `reviews?serviceId=${serviceId}`);
    });
    return unsubscribe;
  }, [serviceId]);

  const deleteReview = async (id: string) => {
    if (!confirm('Permanently delete this customer review? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'reviews', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reviews/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-stone-300">
          <div className="w-12 h-12 border-4 border-stone-100 border-t-stone-900 rounded-full animate-spin mb-6" />
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Fetching Database Feedback...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-24 bg-white border-2 border-dashed border-stone-100 rounded-[48px] flex flex-col items-center">
          <div className="w-20 h-20 bg-stone-50 rounded-[32px] flex items-center justify-center mb-6">
            <MessageSquare size={32} className="text-stone-200" />
          </div>
          <h5 className="text-lg font-bold text-stone-900 mb-2 italic">Clean Slate</h5>
          <p className="text-stone-400 text-sm max-w-xs mx-auto italic">No customer reviews have been logged for this particular service node yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm relative group hover:shadow-xl hover:shadow-stone-200/50 transition-all duration-500 hover:-translate-y-1">
               <button 
                onClick={() => deleteReview(r.id)}
                className="absolute top-6 right-6 p-2 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                title="Moderate/Delete Review"
               >
                 <X size={18} />
               </button>
               <div className="flex items-center gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-100'} />
                  ))}
                  <span className="ml-2 text-[10px] font-black text-stone-900 uppercase tracking-widest">{r.rating}.0</span>
               </div>
               <div className="p-6 bg-stone-50 rounded-[28px] border border-stone-50 mb-6">
                  <p className="text-sm text-stone-600 italic leading-relaxed">"{r.comment}"</p>
               </div>
               <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center text-[10px] font-black text-white italic">
                      U
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-stone-900 uppercase tracking-widest mb-0.5">Verified Customer</p>
                      <p className="text-[9px] text-stone-400 font-bold">
                        {r.createdAt?.toDate?.() ? r.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Jan 2026'}
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-[0.2em] rounded-full border border-emerald-100">Authenticated</div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
