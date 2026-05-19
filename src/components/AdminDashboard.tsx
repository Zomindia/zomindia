import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { signOut } from 'firebase/auth';
import { collection, query, getDocs, onSnapshot, orderBy, doc, updateDoc, deleteDoc, addDoc, where, Timestamp, setDoc, deleteField, getDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { sendNotification } from '../lib/notifications';
import EarningsView from './EarningsView';
import { Booking, UserProfile, Category, Service, PartnerProfile, Promotion, FAQ, SupportTicket, ChatMessage, AdminSubRole, UserRole, AMCStatus } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { notifyBookingUpdate } from '../lib/notifications';
import { motion, AnimatePresence } from 'motion/react';
import AdminUpload from './AdminUpload';
import AmcManagement from './AmcManagement';
import AudioCall from './AudioCall';
import ChatWindow from './ChatWindow';
import PartnerTrackingMap from './PartnerTrackingMap';
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
  User,
  Search,
  Filter,
  CheckCircle2,
  Check,
  XCircle,
  Clock,
  UserPlus,
  Lock,
  MapPin,
  Tag,
  LayoutDashboard,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Bell,
  Calendar,
  Smartphone,
  Phone,
  Menu,
  MessageSquare,
  Image as ImageIcon,
  Star,
  X,
  Mail,
  History,
  Gift,
  Trash2,
  RotateCw,
  LogOut
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

type AdminTab = 'overview' | 'analytics' | 'bookings' | 'categories' | 'services' | 'partners' | 'users' | 'promotions' | 'partner-promotions' | 'earnings' | 'help-center' | 'tickets' | 'admin-management' | 'amcs' | 'my-profile';

export default function AdminDashboard({ profile, setActiveTab, initialAdminTab = 'overview' }: { profile: UserProfile, setActiveTab: (tab: any) => void, initialAdminTab?: AdminTab }) {
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>(initialAdminTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [partners, setPartners] = useState<(PartnerProfile & { displayName?: string })[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [amcs, setAmcs] = useState<any[]>([]);
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

    const unsubAmcs = onSnapshot(query(collection(db, 'amcs'), orderBy('createdAt', 'desc')), (snap) => {
      setAmcs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'amcs'));

    setLoading(false);

    return () => {
      unsubBookings();
      unsubUsers();
      unsubCategories();
      unsubServices();
      unsubPartners();
      unsubPromos();
      unsubTickets();
      unsubAmcs();
    };
  }, []);

  const totalRevenue = bookings.reduce((acc, b) => (b.status === 'completed' || b.status === 'finalized') ? acc + b.totalPrice : acc, 0);
  const platformFee = totalRevenue * 0.15;

  const bookingTrendData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    bookings.forEach(b => {
      const date = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      if (isNaN(date.getTime())) return;
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      dataMap[dateStr] = (dataMap[dateStr] || 0) + 1;
    });
    return Object.entries(dataMap)
      .map(([date, count]) => ({ date, count, sortVal: new Date(`${date} ${new Date().getFullYear()}`).getTime() }))
      .sort((a, b) => a.sortVal - b.sortVal);
  }, [bookings]);

  const revenueTrendData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    bookings.forEach(b => {
      if (b.status === 'completed' || b.status === 'finalized') {
        const date = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt);
        if (isNaN(date.getTime())) return;
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        dataMap[dateStr] = (dataMap[dateStr] || 0) + b.totalPrice;
      }
    });
    return Object.entries(dataMap)
      .map(([date, amount]) => ({ date, amount, sortVal: new Date(`${date} ${new Date().getFullYear()}`).getTime() }))
      .sort((a, b) => a.sortVal - b.sortVal);
  }, [bookings]);

  const userTrendData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    users.forEach(u => {
       const d = u.createdAt as any;
       let dateStr = 'Unknown';
       if (d?.toDate) {
          dateStr = d.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' });
       } else if (typeof d === 'string' || typeof d === 'number') {
          dateStr = new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
       }
       if (dateStr !== 'Unknown') {
         dataMap[dateStr] = (dataMap[dateStr] || 0) + 1;
       }
    });

    let cumulative = 0;
    return Object.entries(dataMap)
      .map(([date, count]) => ({ date, uncumulatedCount: count, sortVal: new Date(`${date} ${new Date().getFullYear()}`).getTime() }))
      .sort((a, b) => a.sortVal - b.sortVal)
      .map(item => {
        cumulative += item.uncumulatedCount;
        return { date: item.date, users: cumulative };
      });
  }, [users]);

  const handleUpdateAmcStatus = async (amcId: string, status: AMCStatus) => {
    try {
      await updateDoc(doc(db, 'amcs', amcId), {
        status,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `amcs/${amcId}`);
    }
  };

  const isAdminAuthorized = (tabId: AdminTab) => {
    if (tabId === 'my-profile') return true;
    if (!profile.adminSubRole || profile.adminSubRole === 'head') return true;
    
    switch (profile.adminSubRole) {
      case 'accounts':
        return ['overview', 'analytics', 'bookings', 'earnings', 'amcs'].includes(tabId);
      case 'hr':
        return ['overview', 'partners', 'users', 'tickets'].includes(tabId);
      case 'manager':
        return ['overview', 'analytics', 'bookings', 'earnings', 'partners', 'users', 'tickets', 'amcs', 'promotions', 'partner-promotions'].includes(tabId);
      case 'support':
        return ['overview', 'bookings', 'users', 'tickets', 'help-center', 'amcs'].includes(tabId);
      case 'editor':
        return ['overview', 'categories', 'services', 'promotions', 'partner-promotions', 'help-center'].includes(tabId);
      case 'moderator':
        return ['overview', 'partners', 'users', 'tickets', 'help-center', 'my-profile'].includes(tabId);
      default:
        return false;
    }
  };

  const sidebarItems: { id: AdminTab; icon: any; label: string }[] = ([
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'bookings', icon: FileText, label: 'Bookings' },
    { id: 'categories', icon: Tag, label: 'Categories' },
    { id: 'services', icon: Briefcase, label: 'Services' },
    { id: 'earnings', icon: DollarSign, label: 'Earnings' },
    { id: 'partners', icon: ShieldCheck, label: 'Partners' },
    { id: 'users', icon: Users, label: 'Customers' },
    { id: 'promotions', icon: Tag, label: 'Customer Offers' },
    { id: 'amcs', icon: Calendar, label: 'AMC Contracts' },
    { id: 'partner-promotions', icon: Gift, label: 'Partner Offers' },
    { id: 'help-center', icon: FileText, label: 'Help' },
    { id: 'tickets', icon: MessageSquare, label: 'Tickets' },
    { id: 'admin-management', icon: ShieldAlert, label: 'Admins' },
  ] as { id: AdminTab; icon: any; label: string }[]).filter(item => isAdminAuthorized(item.id));

  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/';
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const refreshData = () => {
    setLoading(true);
    window.location.reload();
  };

  if (loading) return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Initializing Terminal...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex relative overflow-x-hidden">
      {/* Sidebar Overlay - Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-blue-700/40 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Admin Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isCollapsed ? 100 : 288 }}
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 transform lg:sticky top-0 h-screen ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
             <div className="w-10 h-10 bg-blue-700 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-700/10 shrink-0">
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
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-blue-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { 
                if (item.id === 'partner-signup' as any) {
                  setActiveTab('partner-signup');
                } else {
                  setActiveAdminTab(item.id); 
                }
                setIsSidebarOpen(false); 
              }}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group overflow-hidden ${
                activeAdminTab === item.id 
                  ? 'bg-blue-700 text-white shadow-xl shadow-blue-700/10' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-blue-700'
              }`}
            >
              <item.icon size={18} className={`shrink-0 ${activeAdminTab === item.id ? 'text-white' : 'text-slate-300 group-hover:text-blue-700'}`} />
              {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-50">
           <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex w-full items-center justify-center p-3 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-blue-700 transition-all mb-4"
           >
             <div className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}>
               <ChevronRight size={18} />
             </div>
           </button>
           <div className={`bg-slate-50 p-4 rounded-2xl transition-all ${isCollapsed ? 'opacity-0 h-0 p-0 overflow-hidden' : ''}`}>
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Cloud Status</p>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[10px] text-slate-900 font-bold tracking-wider uppercase whitespace-nowrap">Systems Active</span>
              </div>
           </div>
           
           <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3.5 mt-4 rounded-2xl text-sm font-bold text-rose-500 hover:bg-rose-50 transition-all group overflow-hidden"
           >
             <LogOut size={18} className="shrink-0 text-rose-300 group-hover:text-rose-500" />
             {!isCollapsed && <span className="whitespace-nowrap">Logout</span>}
           </button>
        </div>
      </motion.aside>

      {/* Admin Body */}
      <main className="flex-1 min-h-screen flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-slate-200/50 h-20 px-6 sm:px-12 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2.5 bg-slate-50 text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
                id="admin-menu-toggle"
              >
                <Menu size={22} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight capitalize">{activeAdminTab.replace('-', ' ')}</h1>
              </div>
           </div>
           
           <div className="flex items-center gap-4 sm:gap-6">
              <button 
                onClick={refreshData}
                className="p-2.5 bg-slate-50 text-slate-600 hover:text-blue-700 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all group"
                title="Refresh Platform Data"
              >
                <RotateCw size={18} className="group-active:rotate-180 transition-transform duration-500" />
              </button>
              <div className="hidden sm:block relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                   type="text" 
                   placeholder="Global Search..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-48 lg:w-64 bg-slate-50 border-none rounded-2xl px-12 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-700 focus:bg-white transition-all shadow-inner"
                 />
              </div>
              <button 
                onClick={() => setActiveAdminTab('my-profile')}
                className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border ${activeAdminTab === 'my-profile' ? 'bg-blue-700 text-white border-blue-700 shadow-lg shadow-blue-700/20' : 'bg-slate-50 text-slate-600 hover:text-blue-700 border-transparent hover:border-slate-200'}`}
              >
                <User size={14} />
                <span className="hidden lg:inline">My Profile</span>
              </button>
              <div className="flex items-center gap-3">
                 <div className="hidden md:block text-right">
                    <p className="text-[11px] font-bold text-slate-900 leading-none mb-1">{profile.displayName || 'Administrator'}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none">{profile.adminSubRole?.toUpperCase() || 'ROOT'} ACCESS</p>
                 </div>
                 <div className="w-10 h-10 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center text-slate-900">
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
                    <StatCard title="Total Customers" value={users.length.toString()} icon={Users} color="bg-blue-700" />
                    <StatCard title="Earnings (15%)" value={`₹${platformFee.toLocaleString()}`} icon={TrendingUp} color="bg-indigo-600" />
                    <StatCard title="Pending Requests" value={bookings.filter(b => b.status === 'pending').length.toString()} icon={Clock} color="bg-amber-500" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-8">
                         <h3 className="font-bold text-xl text-slate-900">Recent Stream</h3>
                         <button onClick={() => setActiveAdminTab('bookings')} className="text-[10px] font-black text-slate-400 hover:text-blue-700 uppercase tracking-widest transition-colors">See All Bookings</button>
                      </div>
                      <div className="space-y-3">
                         {bookings.slice(0, 6).map(b => (
                           <div key={b.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100 group">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-900 shadow-sm group-hover:bg-blue-700 group-hover:text-white transition-all shrink-0">
                                    <FileText size={16} />
                                 </div>
                                 <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">Booking #{b.id.slice(0, 8).toUpperCase()}</p>
                                    <p className="text-[10px] text-slate-400 font-medium italic truncate">{b.address}</p>
                                 </div>
                              </div>
                              <div className="text-right shrink-0">
                                 <p className="text-sm font-bold text-slate-900">₹{b.totalPrice}</p>
                                 <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                   b.status === 'finalized' || b.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 
                                   'bg-blue-700 text-white'
                                 }`}>
                                   {b.status.replace('_', ' ')}
                                 </span>
                              </div>
                           </div>
                         ))}
                      </div>
                    </div>

                    <div className="bg-blue-700 rounded-[32px] p-8 text-white relative overflow-hidden flex flex-col justify-between">
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

                  {/* Analytics Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Booking Trend Chart */}
                    {bookingTrendData.length > 0 && (
                       <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm">
                         <div className="mb-6">
                           <h3 className="text-lg font-bold text-slate-900">Booking Trends</h3>
                         </div>
                         <div className="h-[250px] w-full">
                           <ResponsiveContainer width="100%" height="100%">
                             <AreaChart data={bookingTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                               <defs>
                                 <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                   <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                   <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                 </linearGradient>
                               </defs>
                               <XAxis dataKey="date" stroke="#e7e5e4" tick={{ fill: '#a8a29e', fontSize: 10 }} tickLine={false} axisLine={false} />
                               <YAxis stroke="#e7e5e4" tick={{ fill: '#a8a29e', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                               <Tooltip 
                                 contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                                 itemStyle={{ color: '#1c1917', fontWeight: 'bold' }}
                               />
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                               <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" name="Bookings" />
                             </AreaChart>
                           </ResponsiveContainer>
                         </div>
                       </div>
                    )}
                    
                    {/* Revenue Trend Chart */}
                    {revenueTrendData.length > 0 && (
                       <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm">
                         <div className="mb-6">
                           <h3 className="text-lg font-bold text-slate-900">Revenue Growth</h3>
                         </div>
                         <div className="h-[250px] w-full">
                           <ResponsiveContainer width="100%" height="100%">
                             <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                               <defs>
                                 <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                   <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                   <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                 </linearGradient>
                               </defs>
                               <XAxis dataKey="date" stroke="#e7e5e4" tick={{ fill: '#a8a29e', fontSize: 10 }} tickLine={false} axisLine={false} />
                               <YAxis stroke="#e7e5e4" tick={{ fill: '#a8a29e', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(value) => `₹${value}`} />
                               <Tooltip 
                                 contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                                 itemStyle={{ color: '#1c1917', fontWeight: 'bold' }}
                                 formatter={(value: number) => `₹${value}`}
                               />
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                               <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" name="Revenue" />
                             </AreaChart>
                           </ResponsiveContainer>
                         </div>
                       </div>
                    )}

                    {/* User Growth Chart */}
                    {userTrendData.length > 0 && (
                       <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm lg:col-span-2">
                         <div className="mb-6">
                           <h3 className="text-lg font-bold text-slate-900">User Growth</h3>
                         </div>
                         <div className="h-[250px] w-full">
                           <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={userTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                               <XAxis dataKey="date" stroke="#e7e5e4" tick={{ fill: '#a8a29e', fontSize: 10 }} tickLine={false} axisLine={false} />
                               <YAxis stroke="#e7e5e4" tick={{ fill: '#a8a29e', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                               <Tooltip 
                                 cursor={{ fill: 'transparent' }}
                                 contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                                 itemStyle={{ color: '#1c1917', fontWeight: 'bold' }}
                               />
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                               <Bar dataKey="users" fill="#1c1917" radius={[4, 4, 0, 0]} name="Total Users" />
                             </BarChart>
                           </ResponsiveContainer>
                         </div>
                       </div>
                    )}
                  </div>
                </div>
              )}

              {activeAdminTab === 'analytics' && isAdminAuthorized('analytics') && <AnalyticsView bookings={bookings} users={users} partners={partners} services={services} />}
              {activeAdminTab === 'my-profile' && <MyAdminProfile profile={profile} />}
              {activeAdminTab === 'bookings' && isAdminAuthorized('bookings') && <BookingManager bookings={bookings} users={users} partners={partners} services={services} profile={profile} />}
              {activeAdminTab === 'categories' && isAdminAuthorized('categories') && <CategoryManager categories={categories} />}
              {activeAdminTab === 'services' && isAdminAuthorized('services') && <ServiceManager categories={categories} services={services} />}
              {activeAdminTab === 'earnings' && isAdminAuthorized('earnings') && (
                <div className="space-y-8">
                  <EarningsView bookings={bookings} role="admin" />
                  <PayoutManager />
                </div>
              )}
              {activeAdminTab === 'partners' && isAdminAuthorized('partners') && <PartnerManager partners={partners} users={users} setActiveTab={setActiveTab} />}
              {activeAdminTab === 'users' && isAdminAuthorized('users') && <UserManager users={users} bookings={bookings} currentUserProfile={profile} />}
              {activeAdminTab === 'promotions' && isAdminAuthorized('promotions') && <PromoManager promotions={promotions} categories={categories} services={services} users={users} filter="customer" />}
              {activeAdminTab === 'partner-promotions' && isAdminAuthorized('promotions') && <PromoManager promotions={promotions} categories={categories} services={services} users={users} filter="partner" />}
              {activeAdminTab === 'help-center' && isAdminAuthorized('help-center') && <HelpCenterManager faqs={faqs} />}
              {activeAdminTab === 'tickets' && isAdminAuthorized('tickets') && <TicketManager tickets={tickets} users={users} />}
              {activeAdminTab === 'admin-management' && isAdminAuthorized('admin-management') && <AdminManager users={users} profile={profile} />}
              {activeAdminTab === 'amcs' && isAdminAuthorized('amcs') && (
                <AmcManagement 
                  amcs={amcs} 
                  users={users} 
                  services={services} 
                  onUpdateStatus={handleUpdateAmcStatus}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-10 border border-slate-50 rounded-[48px] shadow-sm relative overflow-hidden group hover:border-blue-700 transition-all duration-500">
      <div className="relative z-10">
        <div className={`w-14 h-14 ${color} text-white rounded-[24px] flex items-center justify-center mb-8 shadow-xl shadow-blue-700/5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
          <Icon size={28} />
        </div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{title}</p>
        <p className="text-4xl font-display font-bold text-slate-900 tracking-tighter">{value}</p>
      </div>
      <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-slate-50 rounded-full z-0 group-hover:bg-slate-100 transition-all duration-500" />
    </div>
  );
}

// --- MODULES ---

function BookingManager({ bookings, users, partners, services, profile }: { bookings: Booking[], users: UserProfile[], partners: (PartnerProfile & { displayName?: string })[], services: Service[], profile: UserProfile }) {
  const [sendingBillId, setSendingBillId] = useState<string | null>(null);
  const [managingStatusBookingId, setManagingStatusBookingId] = useState<string | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [bookingFilter, setBookingFilter] = useState<Booking['status'] | 'all'>('all');
  const [statusForm, setStatusForm] = useState({
    status: '' as Booking['status'] | 'reject',
    pendingReason: '',
    pendingDate: '',
    pendingDuration: '',
    assignedPartnerId: '',
    extraAmount: '',
    extraReason: '',
    adminNotes: ''
  });
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState<string | null>(null);
  const [showChat, setShowChat] = useState<{ type: 'customer' | 'partner', id: string, bookingId: string } | null>(null);
  const [showCall, setShowCall] = useState<{ type: 'customer' | 'partner', id: string, bookingId: string } | null>(null);

  const [bookingOtps, setBookingOtps] = useState<Record<string, string>>({});

  useEffect(() => {
    const relevantBookings = bookings.filter(b => ['confirmed', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'payment_pending', 'pending_parts'].includes(b.status));
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

  useEffect(() => {
    if (managingStatusBookingId || cancellingBookingId || showSuccessModal || showChat || showCall) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [managingStatusBookingId, cancellingBookingId, showSuccessModal, showChat, showCall]);

  const [error, setError] = useState<string | null>(null);

  const handleSendBill = async (bookingId: string) => {
    setSendingBillId(bookingId);
    try {
      const response = await fetch('/api/send-final-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setShowSuccessModal(`Final bill sent successfully for booking #${bookingId.slice(0, 8).toUpperCase()}`);
      } else {
        setError(data.error || "Failed to send bill email.");
      }
    } catch (err) {
      console.error("Failed to send bill email:", err);
      setError("Network error when sending bill email.");
    } finally {
      setSendingBillId(null);
    }
  };

  useEffect(() => {
    if (managingStatusBookingId) {
      const b = bookings.find(x => x.id === managingStatusBookingId);
      if (b) {
        setStatusForm({
          status: b.status,
          pendingReason: b.pendingReason || '',
          pendingDate: b.pendingResolveDate?.toDate?.() ? b.pendingResolveDate.toDate().toISOString().split('T')[0] : '',
          pendingDuration: b.pendingResolveDuration || '',
          assignedPartnerId: b.partnerId || '',
          extraAmount: '',
          extraReason: '',
          adminNotes: b.adminNotes || ''
        });
      }
    }
  }, [managingStatusBookingId, bookings]);

  const handleAdminStatusUpdate = async () => {
    if (!managingStatusBookingId || !statusForm.status) return;
    
    const booking = bookings.find(b => b.id === managingStatusBookingId);
    if (!booking) return;

    if (statusForm.status === 'confirmed' && !statusForm.assignedPartnerId && !booking.partnerId) {
      setError("Please assign a Service Agent before confirming the booking.");
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        updatedAt: Timestamp.now()
      };

      if (statusForm.status === 'reject') {
        // Unassign and Return to Pool
        updateData.status = 'pending';
        updateData.partnerId = deleteField();
        updateData.previousStatus = booking.status;
      } else {
        updateData.status = statusForm.status;
        updateData.previousStatus = booking.status;
        
        if (statusForm.adminNotes) {
          updateData.adminNotes = statusForm.adminNotes;
        }
        if (statusForm.assignedPartnerId) {
          updateData.partnerId = statusForm.assignedPartnerId;
          // If we assign a partner, we usually want it to be confirmed and generate OTP
          if (updateData.status === 'pending' && !statusForm.pendingReason) {
            updateData.status = 'confirmed';
          }
          if (updateData.status === 'confirmed' || updateData.status === 'assigned') {
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            updateData.serviceOtp = otp;
            updateData.otpVerified = false;
            await setDoc(doc(db, `bookings/${managingStatusBookingId}/otps`, otp), { 
              createdAt: Timestamp.now(),
              createdBy: profile?.uid || auth.currentUser?.uid
            });
            await setDoc(doc(db, `bookings/${managingStatusBookingId}/secrets`, 'otp'), { code: otp });
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
      setShowSuccessModal(`Booking #${managingStatusBookingId.slice(0, 8).toUpperCase()} updated to ${updateData.status || statusForm.status}`);
      setStatusForm({ status: '' as any, pendingReason: '', pendingDate: '', pendingDuration: '', assignedPartnerId: '', extraAmount: '', extraReason: '', adminNotes: '' });
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

  const handleCancelBooking = async () => {
    if (!cancellingBookingId || !cancelReason) return;
    setLoading(true);
    try {
      const booking = bookings.find(b => b.id === cancellingBookingId);
      if (!booking) return;

      await updateDoc(doc(db, 'bookings', cancellingBookingId), {
        status: 'cancelled',
        cancellationReason: cancelReason,
        updatedAt: Timestamp.now()
      });

      notifyBookingUpdate({ ...booking, status: 'cancelled', cancellationReason: cancelReason }, 'cancelled', 'admin');
      
      setCancellingBookingId(null);
      setCancelReason('');
      setShowSuccessModal(`Booking #${cancellingBookingId.slice(0, 8).toUpperCase()} has been cancelled.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${cancellingBookingId}`);
    } finally {
      setLoading(false);
    }
  };

  const assignPartner = async (bookingId: string, partnerId: string) => {
    try {
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      await updateDoc(doc(db, 'bookings', bookingId), { 
        partnerId, 
        status: 'confirmed',
        serviceOtp: otp,
        otpVerified: false,
        updatedAt: Timestamp.now()
      });
      await setDoc(doc(db, `bookings/${bookingId}/otps`, otp), { 
        createdAt: Timestamp.now(),
        createdBy: profile?.uid || auth.currentUser?.uid
      });
      await setDoc(doc(db, `bookings/${bookingId}/secrets`, 'otp'), { code: otp });

      const b = bookings.find(x => x.id === bookingId);
      if (b) notifyBookingUpdate({ ...b, partnerId, status: 'confirmed' }, 'confirmed', 'admin');
      setShowSuccessModal(`Partner assigned to booking #${bookingId.slice(0, 8).toUpperCase()}`);
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

  const deleteAllBookings = async () => {
    if (!window.confirm("CRITICAL ACTION: Are you absolutely sure you want to delete ALL booking records? This action is irreversible and will wipe all order history.")) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, 'bookings'));
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      setShowSuccessModal("Database Cleanse Complete: All booking records have been purged from the system.");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAmcStatus = async (amcId: string, newStatus: AMCStatus) => {
    try {
      await updateDoc(doc(db, 'amcs', amcId), {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      setShowSuccessModal(`AMC #${amcId.slice(0, 8).toUpperCase()} updated to ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `amcs/${amcId}`);
    }
  };

  const filteredBookings = (activeTab === 'pending' ? pendingBookings : activeTab === 'active' ? activeBookings : historyBookings)
    .filter(b => bookingFilter === 'all' || b.status === bookingFilter);

  return (
    <div className="space-y-10">
      {/* Maintenance Quick Action - Head Admin Only */}
      {profile?.adminSubRole === 'head' && (
        <div className="bg-rose-50 border border-rose-100 rounded-[32px] p-6 flex flex-col md:flex-row items-center justify-between gap-4">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                 <AlertCircle size={24} />
              </div>
              <div>
                 <h4 className="text-lg font-bold text-rose-900 leading-tight">Database Maintenance</h4>
                 <p className="text-xs text-rose-600 font-medium">Use these tools for deep cleaning and testing resets.</p>
              </div>
           </div>
           <button 
             onClick={deleteAllBookings}
             disabled={loading}
             className="px-6 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20"
           >
              Purge All Booking History
           </button>
        </div>
      )}

      <AnimatePresence>
        {cancellingBookingId && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-[24px] flex items-center justify-center mx-auto">
                <X size={32} />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-slate-900">Cancel Booking</h3>
                <p className="text-slate-500 text-sm mt-2">Please provide a reason for cancelling this booking.</p>
              </div>
              
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-rose-500 outline-none h-32 resize-none"
              />

              <div className="flex gap-3">
                <button 
                  onClick={() => { setCancellingBookingId(null); setCancelReason(''); }}
                  className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors uppercase tracking-widest text-[10px]"
                >
                  Go Back
                </button>
                <button 
                  disabled={loading || !cancelReason.trim()}
                  onClick={handleCancelBooking}
                  className="flex-1 bg-rose-600 text-white py-4 rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-900/10 uppercase tracking-widest text-[10px] disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Confirm Cancellation'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showSuccessModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-blue-700/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-10 max-w-sm w-full text-center shadow-2xl space-y-6"
            >
              <div className="w-20 h-20 bg-blue-700 text-white rounded-[32px] flex items-center justify-center mx-auto mb-6">
                <Check size={40} />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900 italic">Action Success</h3>
              <p className="text-slate-500 font-medium leading-relaxed">{showSuccessModal}</p>
              <button 
                onClick={() => setShowSuccessModal(null)}
                className="w-full bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-800 transition-all"
              >
                Acknowledgement Received
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden">
        <div className="flex p-1.5 bg-slate-100 rounded-2xl w-full sm:w-auto overflow-x-auto no-scrollbar scroll-smooth">
          {(['pending', 'active', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setBookingFilter('all'); }}
              className={`flex-1 sm:flex-none px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-white text-slate-900 shadow-xl shadow-blue-700/5' 
                  : 'text-slate-400 hover:text-blue-700'
              }`}
            >
              {tab} ({tab === 'pending' ? pendingBookings.length : tab === 'active' ? activeBookings.length : historyBookings.length})
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
           <select 
             value={bookingFilter}
             onChange={(e) => setBookingFilter(e.target.value as any)}
             className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 outline-none focus:ring-2 focus:ring-blue-700"
           >
              <option value="all">Filter: All {activeTab}</option>
              {activeTab === 'pending' && (
                <>
                  <option value="pending">Just Pending</option>
                  <option value="pending_parts">Waiting for Parts</option>
                </>
              )}
              {activeTab === 'active' && (
                <>
                  <option value="confirmed">Confirmed</option>
                  <option value="assigned">Assigned</option>
                  <option value="on_the_way">On The Way</option>
                  <option value="arrived">Arrived</option>
                  <option value="in_progress">In Progress</option>
                  <option value="payment_pending">Payment Pending</option>
                </>
              )}
              {activeTab === 'history' && (
                <>
                  <option value="completed">Completed</option>
                  <option value="finalized">Finalized</option>
                  <option value="cancelled">Cancelled</option>
                </>
              )}
           </select>
           <div className="hidden sm:block px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Stream: {bookings.length}
           </div>
           {bookings.length > 0 && profile.adminSubRole === 'head' && (
             <button 
               onClick={deleteAllBookings}
               className="px-6 py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all flex items-center gap-2"
             >
               <Trash2 size={14} />
               Purge All
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredBookings.length === 0 ? (
          <div className="p-20 text-center bg-white rounded-[48px] border border-slate-50">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                <FileText size={32} />
             </div>
             <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No tasks in this segment</p>
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
              onCancel={() => setCancellingBookingId(booking.id)}
              onSendBill={() => handleSendBill(booking.id)}
              sendingBill={sendingBillId === booking.id}
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {managingStatusBookingId && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-blue-700/60 backdrop-blur-md overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 100 }}
              className="bg-white rounded-t-[32px] sm:rounded-[48px] p-6 sm:p-10 max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh] relative overscroll-contain"
            >
              <div className="flex justify-between items-center mb-6 sm:mb-10">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-700 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                      <Settings size={20} className="sm:w-6 sm:h-6" />
                   </div>
                   <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 italic">Lifecycle Override</h3>
                      <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Administrative Control Unit</p>
                   </div>
                </div>
                <button onClick={() => setManagingStatusBookingId(null)} className="p-2 sm:p-3 bg-slate-50 hover:bg-slate-100 rounded-xl sm:rounded-2xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8 sm:space-y-10">
                {/* Status Selection */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest px-1">Phase Matrix</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { id: 'pending', label: 'Pending', color: 'bg-amber-400' },
                      { id: 'pending_parts', label: 'Parts Pending', color: 'bg-amber-500' },
                      { id: 'confirmed', label: 'Confirmed', color: 'bg-green-400' },
                      { id: 'assigned', label: 'Assigned', color: 'bg-emerald-400' },
                      { id: 'on_the_way', label: 'On The Way', color: 'bg-indigo-400' },
                      { id: 'arrived', label: 'Arrived', color: 'bg-indigo-500' },
                      { id: 'in_progress', label: 'Operational', color: 'bg-blue-500' },
                      { id: 'payment_pending', label: 'Pay Pending', color: 'bg-orange-500' },
                      { id: 'completed', label: 'Completed', color: 'bg-emerald-500' },
                      { id: 'finalized', label: 'Finalized', color: 'bg-slate-500' },
                      { id: 'closed', label: 'Closed', color: 'bg-slate-400' },
                      { id: 'cancelled', label: 'Cancelled', color: 'bg-rose-500' },
                      { id: 'reject', label: 'Return to Pool', color: 'bg-blue-700' }
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setStatusForm({ ...statusForm, status: st.id as any })}
                        className={`p-4 sm:p-6 rounded-xl sm:rounded-[24px] border-2 transition-all text-left flex flex-col gap-2 sm:gap-3 group ${
                          statusForm.status === st.id 
                            ? 'border-blue-700 bg-slate-50' 
                            : 'border-slate-50 bg-slate-50/30 hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${st.color} shadow-sm group-hover:scale-110 transition-transform`} />
                        <span className="text-[11px] sm:text-xs font-bold text-slate-900">{st.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Activity Monitor */}
                {['on_the_way', 'arrived', 'in_progress'].includes(bookings.find(b => b.id === managingStatusBookingId)?.status || '') && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                         <MapPin size={14} /> Live Signal Monitor
                       </label>
                    </div>
                    <PartnerTrackingMap 
                      partnerId={bookings.find(b => b.id === managingStatusBookingId)?.partnerId!} 
                      bookingLocation={bookings.find(b => b.id === managingStatusBookingId)?.lat && bookings.find(b => b.id === managingStatusBookingId)?.lng ? { lat: bookings.find(b => b.id === managingStatusBookingId)!.lat!, lng: bookings.find(b => b.id === managingStatusBookingId)!.lng! } : undefined}
                    />
                  </div>
                )}

                {/* Admin Notes */}
                <div className="p-5 sm:p-8 bg-slate-50 border border-slate-100 rounded-2xl sm:rounded-[32px] space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={14} /> Internal Admin Notes / Resolution Logic
                  </label>
                  <textarea 
                    value={statusForm.adminNotes}
                    onChange={(e) => setStatusForm({ ...statusForm, adminNotes: e.target.value })}
                    placeholder="Add notes about this status change, resolution details, or partner feedback..."
                    className="w-full bg-white border border-slate-200 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-700/5 h-32 resize-none"
                  />
                </div>

                {/* Partner Assignment Override */}
                <div className="p-5 sm:p-8 bg-slate-100/50 rounded-2xl sm:rounded-[32px] border border-slate-100">
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2">
                    <UserPlus size={14} /> Agent Allocation
                  </label>
                  <select 
                    value={statusForm.assignedPartnerId}
                    onChange={(e) => setStatusForm({ ...statusForm, assignedPartnerId: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-sm font-bold focus:ring-4 focus:ring-blue-700/5 transition-all outline-none"
                  >
                    <option value="">No Agent Assigned</option>
                    {sortedPartners.map(p => (
                      <option key={p.id} value={p.userId}>
                        {p.displayName || p.id.slice(0, 8).toUpperCase()} ({p.availabilityStatus})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Extra Charges Management */}
                <div className="p-5 sm:p-8 bg-emerald-50/30 border border-emerald-100 rounded-2xl sm:rounded-[32px] space-y-4 sm:space-y-6">
                  <label className="block text-[10px] font-black text-emerald-600 uppercase mb-4 tracking-widest flex items-center gap-2">
                    <DollarSign size={14} /> Revenue Enrichment
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[8px] font-bold text-emerald-400 uppercase mb-1 ml-1">Charge Amount (₹)</label>
                      <input 
                        type="number"
                        placeholder="e.g. 500"
                        value={statusForm.extraAmount}
                        onChange={(e) => setStatusForm({ ...statusForm, extraAmount: e.target.value })}
                        className="w-full bg-white border border-emerald-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-emerald-400 uppercase mb-1 ml-1">Justification</label>
                      <input 
                        type="text"
                        placeholder="Optional reason..."
                        value={statusForm.extraReason}
                        onChange={(e) => setStatusForm({ ...statusForm, extraReason: e.target.value })}
                        className="w-full bg-white border border-emerald-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </div>
                  </div>
                </div>

                {/* Communication Bridge */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-6 bg-blue-50/50 rounded-[32px] border border-blue-100/50">
                    <label className="block text-[10px] font-black text-blue-700 uppercase mb-4 tracking-widest">Connect with Customer</label>
                    <div className="flex gap-2">
                      <button 
                         onClick={() => setShowCall({ type: 'customer', id: bookings.find(b => b.id === managingStatusBookingId)?.customerId!, bookingId: managingStatusBookingId! })}
                         className="flex-1 bg-white p-3 rounded-xl flex items-center justify-center gap-2 text-blue-700 hover:bg-blue-700 hover:text-white transition-all shadow-sm"
                      >
                        <Phone size={14} /> <span className="text-[10px] font-bold">Call</span>
                      </button>
                      <button 
                        onClick={() => setShowChat({ type: 'customer', id: bookings.find(b => b.id === managingStatusBookingId)?.customerId!, bookingId: managingStatusBookingId! })}
                        className="flex-1 bg-white p-3 rounded-xl flex items-center justify-center gap-2 text-blue-700 hover:bg-blue-700 hover:text-white transition-all shadow-sm"
                      >
                        <MessageSquare size={14} /> <span className="text-[10px] font-bold">Chat</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-6 bg-emerald-50/50 rounded-[32px] border border-emerald-100/50">
                    <label className="block text-[10px] font-black text-emerald-700 uppercase mb-4 tracking-widest">Connect with Agent</label>
                    {bookings.find(b => b.id === managingStatusBookingId)?.partnerId ? (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowCall({ type: 'partner', id: bookings.find(b => b.id === managingStatusBookingId)?.partnerId!, bookingId: managingStatusBookingId! })}
                          className="flex-1 bg-white p-3 rounded-xl flex items-center justify-center gap-2 text-emerald-700 hover:bg-emerald-700 hover:text-white transition-all shadow-sm"
                        >
                          <Phone size={14} /> <span className="text-[10px] font-bold">Call</span>
                        </button>
                        <button 
                          onClick={() => setShowChat({ type: 'partner', id: bookings.find(b => b.id === managingStatusBookingId)?.partnerId!, bookingId: managingStatusBookingId! })}
                          className="flex-1 bg-white p-3 rounded-xl flex items-center justify-center gap-2 text-emerald-700 hover:bg-emerald-700 hover:text-white transition-all shadow-sm"
                        >
                          <MessageSquare size={14} /> <span className="text-[10px] font-bold">Chat</span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-bold italic py-2">No agent assigned yet</p>
                    )}
                  </div>
                </div>

                {/* Pending Metadata */}
                {statusForm.status === 'pending' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-6"
                  >
                    <div className="p-5 sm:p-8 bg-amber-50/50 border border-amber-100 rounded-2xl sm:rounded-[32px] space-y-4 sm:space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-amber-600 uppercase mb-3 tracking-widest ml-1">Stall Vector (Reason)</label>
                        <input 
                          type="text"
                          placeholder="e.g. Parts scarcity / Logistics failure"
                          value={statusForm.pendingReason}
                          onChange={(e) => setStatusForm({ ...statusForm, pendingReason: e.target.value })}
                          className="w-full bg-white border border-amber-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-sm outline-none focus:ring-4 focus:ring-amber-500/10 placeholder:text-amber-200"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-amber-600 uppercase mb-3 tracking-widest ml-1">Resolution ETA</label>
                          <input 
                            type="datetime-local"
                            value={statusForm.pendingDate}
                            onChange={(e) => setStatusForm({ ...statusForm, pendingDate: e.target.value })}
                            className="w-full bg-white border border-amber-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-xs font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-amber-600 uppercase mb-3 tracking-widest ml-1">SLA Buffer</label>
                          <input 
                            type="text"
                            placeholder="e.g. T + 48h"
                            value={statusForm.pendingDuration}
                            onChange={(e) => setStatusForm({ ...statusForm, pendingDuration: e.target.value })}
                            className="w-full bg-white border border-amber-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-xs font-bold text-slate-900 placeholder:text-amber-200"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-6">
                  <button 
                    onClick={() => setManagingStatusBookingId(null)}
                    className="flex-1 py-4 sm:py-5 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl sm:rounded-3xl transition-colors uppercase tracking-widest text-[10px] order-2 sm:order-1"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={loading || !statusForm.status}
                    onClick={handleAdminStatusUpdate}
                    className="flex-[2] bg-blue-700 text-white py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-bold hover:bg-blue-800 transition-all shadow-2xl shadow-blue-700/20 disabled:opacity-50 flex items-center justify-center gap-3 order-1 sm:order-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                    <span className="uppercase tracking-widest text-[11px] font-black">Commit Override</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChat && (
          <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md h-[70vh] bg-white rounded-[40px] overflow-hidden shadow-2xl">
              <ChatWindow 
                booking={bookings.find(b => b.id === showChat.bookingId)!}
                otherUser={users.find(u => u.uid === showChat.id) || (partners.find(p => p.userId === showChat.id) as any) || null}
                onClose={() => setShowChat(null)}
              />
            </div>
          </div>
        )}

        {showCall && (
          <AudioCall 
            otherUser={users.find(u => u.uid === showCall.id) || (partners.find(p => p.userId === showCall.id) as any) || null}
            onEndCall={() => setShowCall(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BookingRow({ booking, users, partners, services, otp, onManage, onCancel, onSendBill, sendingBill }: { booking: Booking, users: UserProfile[], partners: any[], services: Service[], otp?: string, onManage: () => void, onCancel?: () => void, onSendBill?: () => void, sendingBill?: boolean, key?: any }) {
  const user = users.find(u => u.uid === booking.customerId);
  const partner = partners.find(p => p.userId === booking.partnerId);
  const service = services.find(s => s.id === booking.serviceId);

  return (
    <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-100 hover:border-blue-700/30 hover:shadow-2xl hover:shadow-blue-900/5 transition-all duration-500 group relative overflow-hidden">
      {/* Visual Indicator */}
      <div className={`absolute top-0 left-0 w-2 h-full ${
        ['confirmed', 'assigned', 'on_the_way', 'arrived', 'in_progress'].includes(booking.status) ? 'bg-emerald-500' :
        ['pending', 'pending_parts', 'payment_pending'].includes(booking.status) ? 'bg-amber-400' :
        booking.status === 'completed' ? 'bg-blue-700' :
        booking.status === 'cancelled' ? 'bg-rose-500' :
        'bg-slate-200'
      }`} />

      <div className="flex flex-col lg:flex-row lg:items-center gap-8 pl-4">
        <div className="flex items-center gap-5 lg:w-1/4">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-700 group-hover:text-white group-hover:border-blue-700 group-hover:rotate-6 transition-all shrink-0 shadow-inner">
             <Briefcase size={28} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
               <span className="text-[10px] font-black text-slate-400 font-mono tracking-tighter">#{booking.id.slice(0, 8).toUpperCase()}</span>
               {booking.isPriority && (
                 <span className="px-2 py-0.5 bg-rose-500 text-white rounded-md text-[8px] font-black uppercase tracking-widest animate-pulse shadow-sm shadow-rose-500/20">High Priority</span>
               )}
            </div>
            <h4 className="text-lg font-black text-slate-900 truncate leading-none mb-2 italic group-hover:text-blue-700 transition-colors uppercase tracking-tight">{service?.name || 'Loading...'}</h4>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em] shadow-sm ${
              booking.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
              ['confirmed', 'assigned', 'on_the_way', 'arrived'].includes(booking.status) ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
              'bg-blue-50 text-blue-700 border border-blue-100'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                 booking.status === 'pending' ? 'bg-amber-400' :
                 ['confirmed', 'assigned', 'on_the_way', 'arrived'].includes(booking.status) ? 'bg-emerald-500' :
                 'bg-blue-700'
              }`} />
              {booking.status.replace('_', ' ')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 flex-1 items-center">
          <div className="space-y-4">
             <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Client Identity</p>
                <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold border border-white shadow-sm overflow-hidden">
                      {user?.photoURL ? <img src={user.photoURL} alt="" /> : <User size={14} />}
                   </div>
                   <div>
                      <p className="text-xs font-black text-slate-900 italic leading-none mb-1">{user?.displayName || 'Anonymous'}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{(booking as any).customerPhone || user?.phoneNumber || 'No Phone'}</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="space-y-4">
             <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Agent Allocation</p>
                {partner ? (
                  <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 text-xs font-bold border border-white shadow-sm overflow-hidden">
                        {partner.photoURL ? <img src={partner.photoURL} alt="" /> : <ShieldCheck size={14} />}
                     </div>
                     <div>
                        <p className="text-xs font-black text-emerald-600 leading-none mb-1">{partner.displayName}</p>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Vetted Expert</p>
                     </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-rose-500 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 max-w-fit">
                    <AlertCircle size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Action Required</span>
                  </div>
                )}
             </div>
          </div>

          <div className="space-y-1">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mission window</p>
             <div className="flex items-center gap-3">
                <div className="flex flex-col">
                   <p className="text-sm font-black text-slate-900 flex items-center gap-2">
                     <Calendar size={14} className="text-blue-700" />
                     {booking.scheduledAt?.toDate?.()?.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                   </p>
                   <p className="text-[11px] font-bold text-slate-400 ml-5">{booking.scheduledAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-5 lg:w-1/6 justify-end pt-6 lg:pt-0 border-t lg:border-none border-slate-50">
          <div className="text-right">
             <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Contract Value</p>
             <p className="text-2xl font-black text-slate-900 font-display italic tracking-tighter">₹{booking.totalPrice}</p>
          </div>
          <button 
            onClick={onManage}
            className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all shadow-xl shadow-slate-900/10"
          >
            <Settings size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      
      <div className="mt-8 pt-4 border-t border-slate-50 flex flex-wrap items-center justify-between gap-4">
         <div className="flex flex-wrap items-center gap-6">
           <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-500 italic">
             <MapPin size={14} className="text-rose-500" />
             <span className="max-w-[300px] truncate">{booking.address}</span>
           </div>
           {otp && (
             <div className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-700/20 text-[10px] font-black uppercase tracking-widest">
               <Lock size={12} fill="currentColor" className="fill-blue-400" /> Secure OTP: {otp}
             </div>
           )}
         </div>
         <div className="flex items-center gap-4">
           {(booking.status === 'completed' || booking.status === 'finalized') && onSendBill && (
             <button 
               onClick={(e) => { e.stopPropagation(); onSendBill(); }}
               disabled={sendingBill}
               className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 hover:text-white transition-all disabled:opacity-50"
             >
               {sendingBill ? (
                 <RotateCw size={12} className="animate-spin" />
               ) : (
                 <Mail size={12} />
               )}
               Send Bill
             </button>
           )}
           {booking.pendingReason && (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-100 text-[9px] font-black uppercase tracking-widest">
                <AlertCircle size={12} /> Blocked: {booking.pendingReason}
             </div>
           )}
           {['on_the_way', 'arrived', 'in_progress'].includes(booking.status) && (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 text-[9px] font-black uppercase tracking-widest animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Active
             </div>
           )}
         </div>
      </div>
    </div>
  );
}

function CategoryManager({ categories }: { categories: Category[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', icon: 'Sparkles', description: '', imageURL: '', iconURL: '', images: [] as string[] });

  const handleAddCategory = async () => {
    if (!newCategory.name) return;
    try {
      await addDoc(collection(db, 'categories'), newCategory);
      setIsAdding(false);
      setNewCategory({ name: '', icon: 'Sparkles', description: '', imageURL: '', iconURL: '', images: [] });
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
           className="bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-blue-800 shadow-lg shadow-slate-200"
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
            className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-blue-700/10 shadow-xl mb-12"
          >
             <h4 className="font-bold mb-6 text-slate-900">{editingCategory ? 'Edit Category' : 'Create New Category'}</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Category Name</label>
                   <input 
                     type="text" 
                     placeholder="e.g. Cleaning"
                     value={editingCategory ? editingCategory.name : newCategory.name}
                     onChange={(e) => editingCategory 
                       ? setEditingCategory({ ...editingCategory, name: e.target.value })
                       : setNewCategory({ ...newCategory, name: e.target.value })
                     }
                     className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-inner"
                   />
                </div>
                <div>
                  <AdminUpload 
                    label="Custom Icon (Upload to override Lucide icon)"
                    maxWidth={200}
                    value={editingCategory ? editingCategory.iconURL || '' : newCategory.iconURL || ''}
                    onUpload={(url) => editingCategory
                      ? setEditingCategory({ ...editingCategory, iconURL: url })
                      : setNewCategory({ ...newCategory, iconURL: url })
                    }
                  />
                </div>
             </div>
             <div className="mb-6">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Icon ID (Lucide - fallback if no custom icon)</label>
                <select 
                  value={editingCategory ? editingCategory.icon : newCategory.icon}
                  onChange={(e) => editingCategory
                    ? setEditingCategory({ ...editingCategory, icon: e.target.value })
                    : setNewCategory({ ...newCategory, icon: e.target.value })
                  }
                  className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-inner"
                >
                  <option value="Sparkles">Sparkles</option>
                  <option value="Wrench">Wrench</option>
                  <option value="Smartphone">Smartphone</option>
                  <option value="PaintBucket">PaintBucket</option>
                  <option value="Plug">Plug</option>
                  <option value="Wind">Wind</option>
                </select>
             </div>
             <div className="mb-6">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Short Description</label>
                <textarea 
                  value={editingCategory ? editingCategory.description : newCategory.description}
                  onChange={(e) => editingCategory
                    ? setEditingCategory({ ...editingCategory, description: e.target.value })
                    : setNewCategory({ ...newCategory, description: e.target.value })
                  }
                  className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-inner h-24 sm:h-20 resize-none"
                  placeholder="What is this category about?"
                />
             </div>
             <div className="mb-8">
                <AdminUpload 
                  label="Category Main Image / Asset"
                  value={editingCategory ? editingCategory.imageURL || '' : newCategory.imageURL}
                  onUpload={(url) => editingCategory
                    ? setEditingCategory({ ...editingCategory, imageURL: url })
                    : setNewCategory({ ...newCategory, imageURL: url })
                  }
                />
             </div>
             
             <div className="mb-8">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest ml-1">Category Gallery (Images)</label>
                <div className="mb-4">
                  <AdminUpload 
                    label=""
                    placeholder="Upload or paste to add to category gallery"
                    value="" 
                    onUpload={(url) => {
                      if (!url) return;
                      if (editingCategory) {
                        setEditingCategory({
                          ...editingCategory,
                          images: [...(editingCategory.images || []), url]
                        });
                      } else {
                        setNewCategory({
                          ...newCategory,
                          images: [...(newCategory.images || []), url]
                        });
                      }
                    }}
                    onMultipleChange={(urls) => {
                      if (!urls || urls.length === 0) return;
                      if (editingCategory) {
                        setEditingCategory({
                          ...editingCategory,
                          images: [...(editingCategory.images || []), ...urls]
                        });
                      } else {
                        setNewCategory({
                          ...newCategory,
                          images: [...(newCategory.images || []), ...urls]
                        });
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  {(editingCategory?.images || newCategory.images || []).map((img, idx) => (
                    <div key={idx} className="relative group/gallery">
                      <img src={img} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-200 shadow-sm" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => {
                          if (editingCategory) {
                            setEditingCategory({
                              ...editingCategory,
                              images: editingCategory.images?.filter((_, i) => i !== idx)
                            });
                          } else {
                            setNewCategory({
                              ...newCategory,
                              images: newCategory.images?.filter((_, i) => i !== idx)
                            });
                          }
                        }}
                        className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover/gallery:opacity-100 transition-opacity shadow-lg"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
             <div className="flex flex-col sm:flex-row gap-3">
               <button 
                 onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                 className="flex-[2] bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-sm hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/10 uppercase tracking-widest"
               >
                 {editingCategory ? 'Update Hierarchy' : 'Add Category'}
               </button>
               {editingCategory && (
                 <button 
                  onClick={() => setEditingCategory(null)}
                  className="flex-1 bg-slate-50 text-slate-400 px-8 py-4 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all uppercase tracking-widest"
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
          <div key={c.id} className="bg-white p-6 border border-slate-200 rounded-3xl hover:border-blue-700 transition-all flex justify-between items-center group">
             <div className="flex items-center gap-4">
                {(c.iconURL || c.imageURL) && (
                  <img src={c.iconURL || c.imageURL} alt="" className={`w-10 h-10 rounded-lg ${c.iconURL ? 'object-contain' : 'object-cover'}`} referrerPolicy="no-referrer" />
                )}
                <div>
                   <h4 className="font-bold text-slate-900">{c.name}</h4>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{c.id.slice(0, 8).toUpperCase()}</p>
                </div>
             </div>
             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                 onClick={() => {
                   setEditingCategory(c);
                   setIsAdding(false);
                   window.scrollTo({ top: 0, behavior: 'smooth' });
                 }}
                 className="p-2 text-slate-300 hover:text-blue-700 transition-colors"
               >
                  <Settings size={16} />
               </button>
               <button onClick={() => deleteCategory(c.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                  <XCircle size={18} />
               </button>
             </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 font-medium italic bg-slate-100/50 rounded-[32px] border-2 border-dashed border-slate-200">
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
  const [newImageInput, setNewImageInput] = useState('');
  const [newService, setNewService] = useState({ 
    categoryId: '', 
    name: '', 
    basePrice: 0, 
    description: '', 
    duration: '2 Hours',
    imageURL: '',
    images: [] as string[],
    priceListPDF: '',
    rating: 4.8,
    reviewCount: 0,
    predefinedTasks: [] as string[]
  });
  const [taskInput, setTaskInput] = useState('');

  const handleAddService = async () => {
    try {
      if (!newService.categoryId || !newService.name) {
        // Just return, the UI will stay
        return;
      }
      await addDoc(collection(db, 'services'), {
        ...newService,
        createdAt: Timestamp.now()
      });
      setIsAdding(false);
      setNewService({ 
        categoryId: '', 
        name: '', 
        basePrice: 0, 
        description: '', 
        duration: '2 Hours',
        imageURL: '',
        images: [],
        priceListPDF: '',
        rating: 4.8,
        reviewCount: 0,
        predefinedTasks: []
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
            <p className="text-sm text-slate-400">View and manage all service offerings across categories.</p>
         </div>
         <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <input 
                 type="text"
                 placeholder="Search services..."
                 value={sSearch}
                 onChange={(e) => setSSearch(e.target.value)}
                 className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-700 outline-none"
               />
            </div>
            <button 
              onClick={() => { setIsAdding(!isAdding); setEditingService(null); setViewingReviewsId(null); }}
              className="bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-blue-800 shadow-lg shadow-slate-200 shrink-0"
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
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-blue-700/60 backdrop-blur-md"
          >
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 100 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 100 }}
               className="bg-white rounded-t-[32px] sm:rounded-[40px] max-w-md w-full shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90vh] no-scrollbar"
             >
                <div className="flex justify-between items-center px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-50 shrink-0">
                   <h4 className="text-xl font-bold italic">Update Service Image</h4>
                   <button onClick={() => setUpdatingImageId(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                      <X size={20} />
                   </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 no-scrollbar">
                   <AdminUpload 
                     label="Service Main Asset"
                     value={tempImageUrl}
                     onUpload={setTempImageUrl}
                   />
                   <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button 
                        onClick={() => setUpdatingImageId(null)}
                        className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-all uppercase tracking-widest text-[10px] order-2 sm:order-1"
                      >
                        Discard
                      </button>
                      <button 
                        onClick={handleQuickImageUpdate}
                        disabled={!tempImageUrl}
                        className="flex-[2] bg-blue-700 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/10 uppercase tracking-widest text-[10px] disabled:opacity-50 order-1 sm:order-2"
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
            className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-blue-700/60 backdrop-blur-md"
          >
             <div className="bg-slate-50 w-full max-w-4xl max-h-[95dvh] sm:max-h-[90vh] rounded-t-[32px] sm:rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col no-scrollbar">
                <div className="p-5 sm:p-8 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
                   <div className="min-w-0">
                      <h4 className="text-xl font-bold text-slate-900 truncate">
                         {services.find(s => s.id === viewingReviewsId)?.name} Reviews
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Audit Feedback</p>
                   </div>
                   <button 
                     onClick={() => setViewingReviewsId(null)}
                     className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all ml-4"
                   >
                     <X size={20} />
                   </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 sm:p-8 no-scrollbar">
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
            className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-blue-700/10 shadow-xl mb-12"
          >
              <h4 className="font-bold mb-6 text-slate-900">{editingService ? 'Edit Service Offering' : 'Create New Service Offering'}</h4>
              {categories.length === 0 ? (
                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 text-amber-800 text-sm flex gap-4 items-center">
                  <AlertCircle size={24} className="shrink-0" />
                  <p className="font-medium">You need to create at least one category before adding services.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Category</label>
                      <select 
                        value={editingService ? editingService.categoryId : newService.categoryId}
                        onChange={(e) => editingService 
                          ? setEditingService({ ...editingService, categoryId: e.target.value })
                          : setNewService({ ...newService, categoryId: e.target.value })
                        }
                        className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-inner"
                      >
                        <option value="">Select Category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Service Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Deep Home Cleaning"
                        value={editingService ? editingService.name : newService.name}
                        onChange={(e) => editingService
                          ? setEditingService({ ...editingService, name: e.target.value })
                          : setNewService({ ...newService, name: e.target.value })
                        }
                        className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Base Price (₹)</label>
                      <input 
                        type="number" 
                        placeholder="999"
                        value={editingService ? editingService.basePrice : newService.basePrice}
                        onChange={(e) => editingService
                          ? setEditingService({ ...editingService, basePrice: Number(e.target.value) })
                          : setNewService({ ...newService, basePrice: Number(e.target.value) })
                        }
                        className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Duration</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 2 Hours"
                        value={editingService ? editingService.duration : newService.duration}
                        onChange={(e) => editingService
                          ? setEditingService({ ...editingService, duration: e.target.value })
                          : setNewService({ ...newService, duration: e.target.value })
                        }
                        className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="mb-6">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Description</label>
                    <textarea 
                      value={editingService ? editingService.description : newService.description}
                      onChange={(e) => editingService
                        ? setEditingService({ ...editingService, description: e.target.value })
                        : setNewService({ ...newService, description: e.target.value })
                      }
                      className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-inner h-24 resize-none"
                      placeholder="Describe the service inclusions..."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
                    <div>
                      <AdminUpload 
                        label="Main Hero Image URL"
                        value={editingService ? editingService.imageURL || '' : newService.imageURL}
                        onUpload={(url) => editingService
                          ? setEditingService({ ...editingService, imageURL: url })
                          : setNewService({ ...newService, imageURL: url })
                        }
                      />
                    </div>
                    <div>
                      <AdminUpload 
                        label="Price List PDF"
                        type="file"
                        accept=".pdf"
                        value={editingService ? editingService.priceListPDF || '' : newService.priceListPDF}
                        onUpload={(url) => editingService
                          ? setEditingService({ ...editingService, priceListPDF: url })
                          : setNewService({ ...newService, priceListPDF: url })
                        }
                        placeholder="https://example.com/price-list.pdf"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest ml-1">Service Carousel Gallery</label>
                    <div className="mb-4">
                      <AdminUpload 
                        label=""
                        placeholder="Upload or paste to add to gallery"
                        value="" 
                        onUpload={(url) => {
                          if (!url) return;
                          if (editingService) {
                            setEditingService({
                              ...editingService,
                              images: [...(editingService.images || []), url]
                            });
                          } else {
                            setNewService({
                              ...newService,
                              images: [...(newService.images || []), url]
                            });
                          }
                        }}
                        onMultipleChange={(urls) => {
                          if (!urls || urls.length === 0) return;
                          if (editingService) {
                            setEditingService({
                              ...editingService,
                              images: [...(editingService.images || []), ...urls]
                            });
                          } else {
                            setNewService({
                              ...newService,
                              images: [...(newService.images || []), ...urls]
                            });
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {(editingService?.images || newService.images || []).map((img, idx) => (
                        <div key={idx} className="relative group/gallery">
                          <img src={img} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-200 shadow-sm" referrerPolicy="no-referrer" />
                          <button 
                            onClick={() => {
                              if (editingService) {
                                setEditingService({
                                  ...editingService,
                                  images: editingService.images?.filter((_, i) => i !== idx)
                                });
                              } else {
                                setNewService({
                                  ...newService,
                                  images: newService.images?.filter((_, i) => i !== idx)
                                });
                              }
                            }}
                            className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover/gallery:opacity-100 transition-opacity shadow-lg"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Global Rating (0-5)</label>
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
                        className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Review Count (Virtual)</label>
                      <input 
                        type="number" 
                        value={editingService ? editingService.reviewCount : newService.reviewCount}
                        onChange={(e) => editingService
                          ? setEditingService({ ...editingService, reviewCount: Number(e.target.value) })
                          : setNewService({ ...newService, reviewCount: Number(e.target.value) })
                        }
                        className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Predefined Tasks Section */}
                  <div className="mb-10 p-6 sm:p-8 bg-slate-50 rounded-[32px] border border-slate-100">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Predefined Service Checklist</label>
                        <p className="text-xs text-slate-400 font-medium">Define tasks for partners to complete during this specific service.</p>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <input 
                          type="text" 
                          placeholder="e.g. Clean the filters"
                          value={taskInput}
                          onChange={(e) => setTaskInput(e.target.value)}
                          onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!taskInput.trim()) return;
                                const current = editingService ? (editingService.predefinedTasks || []) : newService.predefinedTasks;
                                const updated = [...current, taskInput.trim()];
                                if (editingService) setEditingService({ ...editingService, predefinedTasks: updated });
                                else setNewService({ ...newService, predefinedTasks: updated });
                                setTaskInput('');
                             }
                          }}
                          className="flex-1 sm:w-64 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-700 outline-none"
                        />
                        <button 
                          onClick={() => {
                            if (!taskInput.trim()) return;
                            const current = editingService ? (editingService.predefinedTasks || []) : newService.predefinedTasks;
                            const updated = [...current, taskInput.trim()];
                            if (editingService) setEditingService({ ...editingService, predefinedTasks: updated });
                            else setNewService({ ...newService, predefinedTasks: updated });
                            setTaskInput('');
                          }}
                          className="w-10 h-10 bg-blue-700 text-white rounded-xl flex items-center justify-center shrink-0"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                       {(editingService ? editingService.predefinedTasks : newService.predefinedTasks)?.map((task, idx) => (
                         <div key={idx} className="flex items-center gap-3 bg-white border border-slate-100 px-4 py-2.5 rounded-2xl group hover:border-blue-700 transition-all shadow-sm">
                            <span className="text-xs font-bold text-slate-700">{task}</span>
                            <button 
                              onClick={() => {
                                const current = editingService ? (editingService.predefinedTasks || []) : newService.predefinedTasks;
                                const updated = current.filter((_, i) => i !== idx);
                                if (editingService) setEditingService({ ...editingService, predefinedTasks: updated });
                                else setNewService({ ...newService, predefinedTasks: updated });
                              }}
                              className="text-slate-300 hover:text-rose-500 transition-colors"
                            >
                               <X size={14} />
                            </button>
                         </div>
                       ))}
                       {(editingService ? (editingService.predefinedTasks?.length || 0) : newService.predefinedTasks.length) === 0 && (
                         <div className="w-full py-4 text-center text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em] italic">
                            No custom tasks defined for this service
                         </div>
                       )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={editingService ? handleUpdateService : handleAddService}
                      className="flex-[2] bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-sm hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/10 uppercase tracking-widest"
                    >
                      {editingService ? 'Commit Changes' : 'Publish Offering'}
                    </button>
                    <button 
                      onClick={() => { setEditingService(null); setIsAdding(false); }}
                      className="flex-1 bg-slate-50 text-slate-400 px-8 py-4 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all uppercase tracking-widest"
                    >
                      Discard
                    </button>
                  </div>
                </>
              )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map(s => (
          <div key={s.id} className="bg-white p-6 border border-slate-200 rounded-[32px] group hover:border-blue-700 transition-all">
             <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-blue-700 group-hover:text-white transition-all">
                    <Briefcase size={20} />
                  </div>
                  <button 
                    onClick={() => {
                      setUpdatingImageId(s.id);
                      setTempImageUrl(s.imageURL || '');
                    }}
                    className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:bg-blue-700 hover:text-white transition-all"
                    title="Update Image"
                  >
                    <ImageIcon size={20} />
                  </button>
                </div>
                <div className="text-right">
                   <p className="text-xl font-bold text-slate-900">₹{s.basePrice}</p>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.duration}</p>
                </div>
             </div>
             {s.imageURL ? (
               <div 
                 className="w-full h-32 rounded-2xl overflow-hidden mb-4 bg-slate-100 relative group/img cursor-pointer"
                 onClick={() => {
                   setUpdatingImageId(s.id);
                   setTempImageUrl(s.imageURL || '');
                 }}
               >
                  <img src={s.imageURL} alt={s.name} className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-blue-700/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest bg-blue-700/80 px-4 py-2 rounded-full">Update Image</span>
                  </div>
               </div>
             ) : (
                <button 
                  onClick={() => {
                    setUpdatingImageId(s.id);
                    setTempImageUrl('');
                  }}
                  className="w-full h-32 rounded-2xl mb-4 bg-slate-100 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 hover:border-blue-700 hover:bg-white transition-all group/empty"
                >
                   <ImageIcon size={24} className="text-slate-300 group-hover/empty:text-slate-900 transition-colors" />
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attach Asset</span>
                </button>
             )}
             <h4 className="font-bold text-lg mb-2">{s.name}</h4>
             <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center text-amber-400">
                  <Star size={12} fill="currentColor" />
                  <span className="text-[11px] font-bold text-slate-900 ml-1">{s.rating || 0}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">({s.reviewCount || 0} reviews)</span>
             </div>
             <p className="text-sm text-slate-500 mb-6 line-clamp-2">{s.description}</p>
             <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                <button 
                  onClick={() => {
                    setEditingService(s);
                    setIsAdding(false);
                    setViewingReviewsId(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-blue-700 transition-colors"
                >
                  Edit Details
                </button>
                <button 
                  onClick={() => setViewingReviewsId(s.id)}
                  className="text-xs font-bold text-slate-400 hover:text-blue-700 transition-colors border-x border-slate-100 px-4"
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

function PartnerManager({ partners, users, setActiveTab }: { partners: PartnerProfile[], users: UserProfile[], setActiveTab: (tab: any) => void }) {
  const [partnerViewMode, setPartnerViewMode] = useState<'all' | 'kyc_pending'>('all');
  const [selectedRewardPartner, setSelectedRewardPartner] = useState<PartnerProfile | null>(null);
  const [selectedProfilePartner, setSelectedProfilePartner] = useState<(PartnerProfile & { user?: UserProfile }) | null>(null);
  const [manualKYCPartner, setManualKYCPartner] = useState<PartnerProfile | null>(null);
  const [rejectingKYCPartner, setRejectingKYCPartner] = useState<PartnerProfile | null>(null);
  const [rejectReason, setRejectReason] = useState('Documents are unclear or invalid.');
  const [manualDocs, setManualDocs] = useState<{type: string, url: string, documentNumber?: string}[]>([
    { type: 'ID Proof Document', url: '', documentNumber: '' },
    { type: 'Address Proof Document', url: '', documentNumber: '' }
  ]);
  const [rewardAmount, setRewardAmount] = useState('10');
  const [rewardReason, setRewardReason] = useState('Service Excellence Reward');
  const [partnersSort, setPartnersSort] = useState<'earnings' | 'rating' | 'credits'>('earnings');
  const [pSearch, setPSearch] = useState('');

  const updateStatus = async (partnerId: string, status: 'active' | 'inactive') => {
    try {
      await updateDoc(doc(db, 'partners', partnerId), { 
        status,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `partners/${partnerId}`);
    }
  };

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
    if ((!manualDocs[0]?.url && !manualDocs[0]?.documentNumber) || (!manualDocs[1]?.url && !manualDocs[1]?.documentNumber)) {
      alert("Both ID Proof and Address Proof require either an image or a valid Document Number for manual verification.");
      return;
    }
    try {
      await updateDoc(doc(db, 'partners', manualKYCPartner.id), {
        kycStatus: 'verified',
        isVerified: true,
        kycDocuments: manualDocs.map(d => ({ ...d, status: 'verified' })),
        updatedAt: Timestamp.now()
      });
      setManualKYCPartner(null);
      setManualDocs([
        { type: 'ID Proof Document', url: '', documentNumber: '' },
        { type: 'Address Proof Document', url: '', documentNumber: '' }
      ]);
      console.log("Manual KYC completed and partner verified.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'manual-kyc');
    }
  };

  const sortedPartners = [...partners]
    .filter(p => {
      const u = users.find(user => user.uid === p.userId);
      const nameMatch = u?.displayName?.toLowerCase().includes(pSearch.toLowerCase());
      const emailMatch = u?.email?.toLowerCase().includes(pSearch.toLowerCase());
      
      const matchesSearch = nameMatch || emailMatch;
      const matchesMode = partnerViewMode === 'all' || p.kycStatus === 'pending';
      
      return matchesSearch && matchesMode;
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
        <div className="flex items-center gap-4">
           <div>
              <h3 className="text-xl font-bold">Partner Fleet</h3>
              <p className="text-slate-400 text-sm">Manage professionals and rewards</p>
           </div>
           <div className="flex items-center gap-2 ml-4">
              <button 
                onClick={() => setPartnerViewMode('all')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${partnerViewMode === 'all' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-indigo-50 text-indigo-700 border-indigo-100/50 hover:bg-indigo-100'}`}
              >
                Partner View
              </button>
              <button 
                onClick={() => setPartnerViewMode('kyc_pending')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${partnerViewMode === 'kyc_pending' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20' : 'bg-emerald-50 text-emerald-700 border-emerald-100/50 hover:bg-emerald-100'}`}
              >
                Become Partner ({partners.filter(p => p.kycStatus === 'pending').length})
              </button>
           </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
           <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input 
                type="text"
                placeholder="Search by name or email..."
                value={pSearch}
                onChange={(e) => setPSearch(e.target.value)}
                className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-700 outline-none"
              />
           </div>
           <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
             {(['earnings', 'rating', 'credits'] as const).map(s => (
               <button 
                key={s}
                onClick={() => setPartnersSort(s)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  partnersSort === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
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
            <div key={p.id} className="bg-white p-8 border border-slate-200 rounded-[40px] shadow-sm relative overflow-hidden group hover:border-blue-700 transition-all">
               <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="relative mb-6">
                     <img 
                        src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName}`} 
                        className="w-24 h-24 rounded-[32px] object-cover bg-slate-50"
                        alt={user?.displayName}
                     />
                     {p.isVerified ? (
                       <div className="absolute -bottom-2 -right-2 p-1.5 bg-white rounded-full shadow-sm text-emerald-500 border border-slate-100">
                          <CheckCircle2 size={16} fill="currentColor" className="text-white fill-emerald-500" />
                       </div>
                     ) : (
                       <div className="absolute -bottom-2 -right-2 p-1.5 bg-white rounded-full shadow-sm text-rose-500 border border-slate-100">
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
                      p.availabilityStatus === 'Busy' ? 'bg-amber-400' : 'bg-slate-500'
                    }`} />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">{p.availabilityStatus || 'Offline'}</span>
                  </div>
                  {p.statusReason && (
                    <div className="mb-4 px-3 py-2 bg-slate-50/50 rounded-lg inline-block border border-slate-100">
                      <p className="text-[9px] text-slate-400 italic font-medium">"{p.statusReason}"</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 font-bold mb-6 uppercase tracking-[0.25em]">{user?.email}</p>
                  
                  <div className="flex gap-4 w-full mb-8 py-4 border-y border-slate-50">
                     <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900">₹{p.totalEarnings?.toLocaleString() || 0}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Earnings</p>
                     </div>
                     <div className="flex-1 border-x border-slate-50">
                        <p className="text-sm font-bold text-slate-900">{p.rewardCredits || 0}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Credits</p>
                     </div>
                     <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900">{p.rating}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Rating</p>
                     </div>
                  </div>

                  {p.kycStatus === 'pending' && (
                    <div className="w-full mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left">
                       <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">Verification Details</p>
                       <div className="space-y-4">
                          <div className="p-3 bg-white rounded-xl border border-amber-100">
                             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Categories</p>
                             <div className="flex flex-wrap gap-1">
                                {p.categories?.map(c => (
                                   <span key={c} className="text-[9px] font-bold bg-blue-700 text-white px-2 py-0.5 rounded-full">{c}</span>
                                ))}
                             </div>
                          </div>
                          {p.bio && (
                             <div className="p-3 bg-white rounded-xl border border-amber-100">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Pro Bio</p>
                                <p className="text-[10px] text-slate-600 italic line-clamp-3">{p.bio}</p>
                             </div>
                          )}
                          <div className="space-y-2">
                             <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest">KYC Documents</p>
                             {p.kycDocuments?.map((doc, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-amber-100">
                                   <span className="text-[10px] font-bold text-slate-900">{doc.type}</span>
                                   <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-slate-400 hover:text-blue-700 uppercase bg-slate-50 px-2 py-1 rounded">View</a>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  )}

                  {user?.phoneNumber && (
                    <div className="mb-6 w-full py-3 bg-slate-50 rounded-2xl flex items-center justify-between px-6 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <Smartphone size={14} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-900">{user.phoneNumber.replace('+91', '')}</span>
                      </div>
                      <a 
                        href={`tel:${user.phoneNumber}`}
                        className="bg-blue-700 px-4 py-2 text-white rounded-xl hover:bg-blue-800 transition-all shadow-md flex items-center gap-2 shrink-0 group"
                        title={`Call ${user.displayName}`}
                      >
                         <Phone size={12} className="group-hover:animate-bounce" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Call Now</span>
                      </a>
                    </div>
                  )}

                  <div className="w-full mb-6 text-left space-y-3">
                     <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Availability</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                           <div className={`w-2 h-2 rounded-full ${
                              p.availabilityStatus === 'Available' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                              p.availabilityStatus === 'Busy' ? 'bg-amber-500' : 'bg-slate-300'
                           }`} />
                           <span className={
                              p.availabilityStatus === 'Available' ? 'text-emerald-600' :
                              p.availabilityStatus === 'Busy' ? 'text-amber-600' : 'text-slate-400'
                           }>{p.availabilityStatus || 'Offline'}</span>
                        </div>
                     </div>
                     {p.statusReason && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                           <p className="text-[10px] text-slate-500 leading-relaxed italic">"{p.statusReason}"</p>
                        </div>
                     )}
                  </div>

                   <div className="flex w-full gap-3">
                     <button 
                       onClick={() => setSelectedProfilePartner({ ...p, user })}
                       className="flex-1 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl py-3 text-xs font-bold hover:bg-slate-100 transition-all"
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
                          className="w-full bg-slate-100 text-slate-600 rounded-xl py-2 text-[8px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
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
                      <div className="flex-1 flex flex-col gap-2">
                        <button 
                          onClick={() => updateStatus(p.id, p.status === 'active' ? 'inactive' : 'active')}
                          className={`w-full rounded-xl py-3 text-xs font-bold transition-all active:scale-95 flex-1 ${
                            p.status === 'active' ? 'bg-blue-700 text-white hover:bg-blue-600' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                        >
                          {p.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>
                        <button 
                          onClick={() => setManualKYCPartner(p)}
                          className="w-full bg-slate-100 text-slate-600 rounded-xl py-2 text-[8px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                        >
                          Update KYC Docs
                        </button>
                      </div>
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
               <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-slate-50 rounded-full z-0 group-hover:scale-110 transition-transform" />
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedRewardPartner && (
          <div key="reward-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-700/60 backdrop-blur-sm">
            <motion.div 
              key="reward-motion"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] max-w-md w-full shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="px-10 py-6 border-b border-slate-50 shrink-0 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold">Manage Rewards</h3>
                  <p className="text-slate-500 text-sm">Adjust reward points for partner.</p>
                </div>
                <button onClick={() => setSelectedRewardPartner(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-10 space-y-6 no-scrollbar">
                 <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Add Points</label>
                   <input 
                    type="number"
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-700 outline-none"
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Reason for Credit</label>
                   <textarea 
                    value={rewardReason}
                    onChange={(e) => setRewardReason(e.target.value)}
                    placeholder="e.g. Completed 10 bookings this week"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-700 outline-none h-24"
                   />
                 </div>

                 <div className="flex gap-4">
                    <button onClick={() => setSelectedRewardPartner(null)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors">Cancel</button>
                    <button onClick={handleApplyReward} className="flex-[2] bg-blue-700 text-white font-bold rounded-2xl hover:bg-blue-800 transition-all shadow-xl shadow-slate-200">
                      Apply Points
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}

        {manualKYCPartner && (
          <div key="manual-kyc-modal" className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-blue-700/60 backdrop-blur-sm">
            <motion.div 
              key="manual-kyc-motion"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] max-w-md w-full shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="px-10 py-6 border-b border-slate-50 shrink-0 flex justify-between items-center">
                <div>
                   <h3 className="text-2xl font-bold italic">Manual Verification</h3>
                   <p className="text-slate-500 text-sm font-medium">Upload KYC documents manually.</p>
                </div>
                <button onClick={() => setManualKYCPartner(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-6 no-scrollbar">
                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ID Proof Document</p>
                    <input
                       type="text"
                       placeholder="Enter ID Proof Number (e.g., Aadhar/PAN)"
                       value={manualDocs[0]?.documentNumber || ''}
                       onChange={(e) => {
                          const newDocs = [...manualDocs];
                          newDocs[0] = { ...newDocs[0], documentNumber: e.target.value };
                          setManualDocs(newDocs);
                       }}
                       className="w-full mb-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-700 outline-none transition-all shadow-inner"
                    />
                    <AdminUpload 
                       label=""
                       placeholder="Upload ID Proof image"
                       value={manualDocs[0]?.url || ''}
                       onUpload={(url) => {
                          const newDocs = [...manualDocs];
                          newDocs[0] = { ...newDocs[0], url };
                          setManualDocs(newDocs);
                       }}
                    />
                 </div>

                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Address Proof Document</p>
                    <input
                       type="text"
                       placeholder="Enter Address Proof Details (Optional)"
                       value={manualDocs[1]?.documentNumber || ''}
                       onChange={(e) => {
                          const newDocs = [...manualDocs];
                          newDocs[1] = { ...newDocs[1], documentNumber: e.target.value };
                          setManualDocs(newDocs);
                       }}
                       className="w-full mb-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-700 outline-none transition-all shadow-inner"
                    />
                    <AdminUpload 
                       label=""
                       placeholder="Upload Address Proof image"
                       value={manualDocs[1]?.url || ''}
                       onUpload={(url) => {
                          const newDocs = [...manualDocs];
                          newDocs[1] = { ...newDocs[1], url };
                          setManualDocs(newDocs);
                       }}
                    />
                 </div>
                 
                 <div className="flex gap-4 pt-4 border-t border-slate-100">
                    <button onClick={() => setManualKYCPartner(null)} className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors uppercase tracking-widest text-[10px]">Cancel</button>
                    <button onClick={handleManualKYC} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-900/20 uppercase tracking-widest text-[10px]">Verify Now</button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}

        {rejectingKYCPartner && (
          <div key="reject-kyc-modal" className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-blue-700/60 backdrop-blur-sm">
            <motion.div 
              key="reject-kyc-motion"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] max-w-md w-full shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="px-10 py-6 border-b border-slate-50 shrink-0 flex justify-between items-center">
                <div>
                   <h3 className="text-2xl font-bold italic">Reject KYC</h3>
                   <p className="text-slate-500 text-sm font-medium">Provide a reason for rejecting the partner's documents.</p>
                </div>
                <button onClick={() => setRejectingKYCPartner(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                   <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-10 space-y-6 no-scrollbar">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Rejection Reason</label>
                    <textarea 
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-3xl p-6 text-sm font-medium focus:ring-4 focus:ring-blue-700/5 transition-all outline-none h-32 resize-none"
                    />
                 </div>
                 
                 <div className="flex gap-4">
                    <button onClick={() => setRejectingKYCPartner(null)} className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors uppercase tracking-widest text-[10px]">Cancel</button>
                    <button onClick={rejectPartner} className="flex-1 bg-rose-600 text-white py-4 rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-xl shadow-rose-900/10 uppercase tracking-widest text-[10px]">Confirm Rejection</button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProfilePartner && (
          <div key="profile-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-700/60 backdrop-blur-sm">
            <motion.div 
              key="profile-motion"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
               <div className="sticky top-0 bg-white/80 backdrop-blur-md px-10 py-6 border-b border-slate-50 flex justify-between items-center z-10">
                  <h3 className="text-xl font-bold">Partner Dossier</h3>
                  <button onClick={() => setSelectedProfilePartner(null)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                     <X size={20} />
                  </button>
               </div>
               
               <div className="p-10 space-y-10">
                  <div className="flex items-center gap-8">
                     <img 
                        src={selectedProfilePartner.user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedProfilePartner.user?.displayName}`} 
                        className="w-32 h-32 rounded-[40px] object-cover bg-slate-50 border-4 border-slate-50 shadow-xl"
                        alt={selectedProfilePartner.user?.displayName}
                     />
                     <div>
                        <div className="flex items-center gap-3 mb-2">
                           <h4 className="text-3xl font-bold text-slate-900 tracking-tight">{selectedProfilePartner.user?.displayName}</h4>
                           <span className={`text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-widest ${
                             selectedProfilePartner.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                           }`}>
                             {selectedProfilePartner.status}
                           </span>
                        </div>
                        <p className="text-slate-400 font-medium">{selectedProfilePartner.user?.email}</p>
                        <div className="flex items-center gap-4 mt-2">
                           <p className="text-slate-600 font-bold font-mono">{selectedProfilePartner.user?.phoneNumber || 'No Phone Number'}</p>
                           {selectedProfilePartner.user?.phoneNumber && (
                             <a 
                               href={`tel:${selectedProfilePartner.user.phoneNumber}`}
                               className="bg-blue-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
                             >
                                <Phone size={12} /> Call Agent
                             </a>
                           )}
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                     <div className="bg-slate-50 p-6 rounded-[32px] text-center border border-slate-100">
                        <p className="text-2xl font-bold text-slate-900">₹{selectedProfilePartner.totalEarnings?.toLocaleString() || 0}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Total Scale</p>
                     </div>
                     <div className="bg-slate-50 p-6 rounded-[32px] text-center border border-slate-100">
                        <p className="text-2xl font-bold text-slate-900">{selectedProfilePartner.rewardCredits || 0}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Loyalty Points</p>
                     </div>
                     <div className="bg-slate-50 p-6 rounded-[32px] text-center border border-slate-100">
                        <p className="text-2xl font-bold text-slate-900">{selectedProfilePartner.rating}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Satisfaction</p>
                     </div>
                  </div>

                  <div className="space-y-8 bg-slate-50/50 p-8 rounded-[40px] border border-slate-100">
                     <div>
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Availability Status</h5>
                        <div className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100">
                           <div className={`w-3 h-3 rounded-full ${
                              selectedProfilePartner.availabilityStatus === 'Available' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse' :
                              selectedProfilePartner.availabilityStatus === 'Busy' ? 'bg-amber-500' : 'bg-slate-300'
                           }`} />
                           <div>
                              <p className={`font-bold text-sm ${
                                 selectedProfilePartner.availabilityStatus === 'Available' ? 'text-emerald-600' :
                                 selectedProfilePartner.availabilityStatus === 'Busy' ? 'text-amber-600' : 'text-slate-400'
                              }`}>{selectedProfilePartner.availabilityStatus || 'Offline'}</p>
                              {selectedProfilePartner.statusReason && (
                                 <p className="text-xs text-slate-400 mt-1 italic leading-relaxed">"{selectedProfilePartner.statusReason}"</p>
                               )}
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <div>
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Professional Bio</h5>
                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/50 p-6 rounded-[32px] border border-slate-50 italic">
                           {selectedProfilePartner.bio || "No professional overview provided by this partner yet."}
                        </p>
                     </div>

                     <div>
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Competencies</h5>
                        <div className="flex flex-wrap gap-2">
                           {selectedProfilePartner.categories?.map(catId => (
                             <span key={catId} className="px-4 py-2 bg-blue-700 text-white rounded-xl text-xs font-bold">
                               {catId.toUpperCase()}
                             </span>
                           ))}
                           {(!selectedProfilePartner.categories || selectedProfilePartner.categories.length === 0) && (
                             <span className="text-xs text-slate-400 italic">No categories assigned.</span>
                           )}
                        </div>
                     </div>

                     <div className="pt-6 border-t border-slate-100">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Validation Status</h5>
                        <div className="flex items-center gap-6">
                           <div className={`p-4 rounded-2xl flex items-center gap-3 ${selectedProfilePartner.isVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              <ShieldCheck size={20} />
                              <span className="text-xs font-bold">{selectedProfilePartner.isVerified ? 'Partner Verified' : 'Awaiting Authentication'}</span>
                           </div>
                           <p className="text-[10px] text-slate-400 font-bold">JOINED: {selectedProfilePartner.createdAt?.toDate?.() ? selectedProfilePartner.createdAt.toDate().toLocaleDateString() : 'Historical Node'}</p>
                        </div>
                     </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                     <button 
                        onClick={() => { setSelectedRewardPartner(selectedProfilePartner); setSelectedProfilePartner(null); }}
                        className="flex-1 bg-blue-700 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all flex items-center justify-center gap-2 text-xs"
                     >
                        <Star size={16} />
                        Incentive Points
                     </button>
                     <button 
                       onClick={() => { setManualKYCPartner(selectedProfilePartner as any); setSelectedProfilePartner(null); }}
                       className="flex-1 bg-slate-100 text-slate-900 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 text-xs"
                     >
                       {selectedProfilePartner.isVerified ? 'Update KYC' : 'Manual KYC Entry'}
                     </button>
                     <button 
                        onClick={() => setSelectedProfilePartner(null)}
                        className="px-8 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors border border-slate-100 text-xs"
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

function UserManager({ users, bookings, currentUserProfile }: { users: UserProfile[], bookings: Booking[], currentUserProfile: UserProfile }) {
  const isHeadAdmin = !currentUserProfile.adminSubRole || currentUserProfile.adminSubRole === 'head';

  const updateUserRole = async (userId: string, targetRole: UserRole, targetSubRole?: AdminSubRole | null) => {
    try {
      const updateData: any = { role: targetRole, updatedAt: Timestamp.now() };
      
      if (targetRole === 'admin') {
         updateData.adminSubRole = targetSubRole || 'head';
      } else {
         updateData.adminSubRole = deleteField();
      }

      await updateDoc(doc(db, 'users', userId), updateData);
      
      await addDoc(collection(db, 'auditLogs'), {
        adminId: currentUserProfile.uid,
        action: 'UPDATE_ROLE',
        targetId: userId,
        details: `Changed role to ${targetRole}${targetRole === 'admin' ? ` (${updateData.adminSubRole})` : ''}`,
        createdAt: Timestamp.now()
      });
      console.log('Role updated successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  return (
    <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
       <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead className="bg-slate-50/50">
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 italic">
                   <th className="px-8 py-5">User Profile</th>
                   <th className="px-8 py-5">Mobile</th>
                   <th className="px-8 py-5">Access Management</th>
                   <th className="px-8 py-5">History</th>
                   <th className="px-8 py-5 text-right">Acquisition</th>
                </tr>
             </thead>
             <tbody>
                {users.map((u, i) => {
                  const userBookings = bookings.filter(b => b.customerId === u.uid);
                  return (
                    <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
                       <td className="px-8 py-6">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-400 text-xs shadow-sm group-hover:bg-blue-700 group-hover:text-white transition-all shrink-0">
                               {u.displayName?.[0] || 'U'}
                            </div>
                            <div className="min-w-0">
                               <p className="text-sm font-bold text-slate-900 truncate">{u.displayName}</p>
                               <p className="text-xs text-slate-400 truncate">{u.email}</p>
                            </div>
                         </div>
                       </td>
                       <td className="px-8 py-6">
                         <p className="text-sm font-bold text-slate-900">
                           {(!u.phoneNumber || import.meta.env.DEV) ? '--' : u.phoneNumber.replace('+91', '')}
                         </p>
                       </td>
                       <td className="px-8 py-6">
                           <div className="flex flex-col gap-2">
                                {isHeadAdmin && u.uid !== currentUserProfile.uid ? (
                                   <>
                                      <select 
                                        value={u.role}
                                        onChange={(e) => {
                                           const newRole = e.target.value as UserRole;
                                           if (newRole === 'admin') {
                                              updateUserRole(u.uid, newRole, 'hr');
                                           } else {
                                              updateUserRole(u.uid, newRole);
                                           }
                                        }}
                                        className={`text-[10px] font-bold border rounded-lg px-2 py-1 outline-none transition-all cursor-pointer ${
                                          u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200 focus:ring-purple-500' :
                                          u.role === 'partner' ? 'bg-blue-700 text-white border-slate-700 focus:ring-slate-500' :
                                          'bg-slate-50 text-slate-600 border-slate-200 focus:ring-slate-400'
                                        }`}
                                      >
                                         <option value="customer">Customer</option>
                                         <option value="partner">Partner</option>
                                         <option value="admin">Administrator</option>
                                      </select>
                                      
                                      {u.role === 'admin' && (
                                         <select 
                                           value={u.adminSubRole || 'head'}
                                           onChange={(e) => updateUserRole(u.uid, 'admin', e.target.value as AdminSubRole)}
                                           className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer italic"
                                         >
                                            <option value="head">Head Admin</option>
                                            <option value="accounts">Accounts Dept</option>
                                            <option value="hr">HR Dept</option>
                                         </select>
                                      )}
                                   </>
                                ) : (
                                   <div className="flex items-center gap-2">
                                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                        u.role === 'partner' ? 'bg-blue-700 text-white' :
                                        'bg-slate-100 text-slate-500'
                                      }`}>
                                         {u.role}
                                      </span>
                                      {u.adminSubRole && (
                                         <span className="text-[9px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-black uppercase tracking-widest italic">
                                            {u.adminSubRole}
                                         </span>
                                      )}
                                   </div>
                                )}
                             </div>
                       </td>
                       <td className="px-8 py-6">
                          <p className="text-sm font-bold text-slate-900">{userBookings.length} Bookings</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">₹{userBookings.reduce((a, b) => a + b.totalPrice, 0)} LTV</p>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <p className="text-xs text-slate-500">{u.createdAt?.toDate?.() ? u.createdAt.toDate().toLocaleDateString() : new Date(u.createdAt).toLocaleDateString()}</p>
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

function PromoManager({ promotions, categories, services, users, filter }: { promotions: Promotion[], categories: Category[], services: Service[], users: UserProfile[], filter: 'customer' | 'partner' | 'all' }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newPromo, setNewPromo] = useState<Partial<Promotion>>({
    name: '',
    code: '',
    discountType: 'percent',
    discountValue: 0,
    description: '',
    usageLimit: 0,
    usageCount: 0,
    active: true,
    expiryDate: '',
    applicableCategories: [],
    applicableServices: [],
    targetAudience: filter === 'partner' ? 'partner' : 'customer',
    imageUrl: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBroadcast = async (promo: Promotion) => {
    setIsBroadcasting(promo.id);
    try {
      let count = 0;
      // Filter recipients based on promo's target audience
      const recipients = users.filter(user => {
        if (!promo.targetAudience || promo.targetAudience === 'all') return true;
        if (promo.targetAudience === 'partner') return user.role === 'partner';
        if (promo.targetAudience === 'customer') return user.role === 'customer' || !user.role;
        return false;
      });

      for (const user of recipients) {
        await sendNotification(
          user.uid,
          `Exclusive Offer: Use ${promo.code}!`,
          `${promo.name}: Get ${promo.discountType === 'percent' ? promo.discountValue + '%' : '₹' + promo.discountValue} off on your next booking.`,
          'promotional'
        );
        count++;
      }
      console.log(`Broadcast complete. Sent to ${count} recipients.`);
    } catch (err) {
      console.error('Broadcast failed:', err);
    } finally {
      setIsBroadcasting(null);
    }
  };

  const handleSavePromo = async () => {
    const promoData = editingPromo || newPromo;
    
    // Explicit validation before submitting
    if (!promoData.name?.trim() || !promoData.code?.trim()) {
      setError('Please provide both promotion name and code');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const dataToSave = {
        name: promoData.name.trim(),
        code: promoData.code.trim().toUpperCase(),
        discountType: promoData.discountType || 'percent',
        discountValue: Number(promoData.discountValue) || 0,
        description: promoData.description || '',
        active: promoData.active !== undefined ? promoData.active : true,
        usageCount: Number(promoData.usageCount) || 0,
        usageLimit: Number(promoData.usageLimit) || 0,
        targetAudience: promoData.targetAudience || 'customer',
        expiryDate: promoData.expiryDate || null,
        imageUrl: promoData.imageUrl || '',
        applicableCategories: promoData.applicableCategories || [],
        applicableServices: promoData.applicableServices || [],
        updatedAt: Timestamp.now()
      };
      
      if (editingPromo) {
        const { id } = dataToSave as any;
        await updateDoc(doc(db, 'promotions', editingPromo.id), dataToSave);
        setSuccess('Offer updated successfully!');
      } else {
        (dataToSave as any).createdAt = Timestamp.now();
        await addDoc(collection(db, 'promotions'), dataToSave);
        setSuccess('New offer launched successfully!');
      }
      
      // Auto-close after short delay to show success
      setTimeout(() => {
        setNewPromo({
          name: '',
          code: '',
          discountType: 'percent',
          discountValue: 0,
          description: '',
          usageLimit: 0,
          usageCount: 0,
          active: true,
          expiryDate: '',
          applicableCategories: [],
          applicableServices: [],
          targetAudience: filter === 'partner' ? 'partner' : 'customer',
          imageUrl: ''
        });
        setEditingPromo(null);
        setIsAdding(false);
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error('Promotion save error:', err);
      setError(err.message || 'Failed to save offer. Please check your permissions.');
      handleFirestoreError(err, editingPromo ? OperationType.UPDATE : OperationType.CREATE, 'promotions');
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
    try {
      await deleteDoc(doc(db, 'promotions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `promotions/${id}`);
    }
  };

  const filteredPromotions = promotions.filter(p => filter === 'all' || p.targetAudience === filter || (!p.targetAudience && filter === 'customer'));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
         <h3 className="text-xl font-bold">{filter === 'partner' ? 'Partner Campaigns' : 'Customer Campaigns'}</h3>
         <button 
           onClick={() => setIsAdding(!isAdding)}
           className="bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold text-xs"
         >
           {isAdding ? <X size={16} /> : <Plus size={16} />}
           {isAdding ? 'Cancel' : 'New Promo Code'}
         </button>
      </div>

      <AnimatePresence>
        {(isAdding || editingPromo) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-8 border border-slate-200 rounded-[32px] shadow-sm max-w-2xl"
          >
             {(error || success) && (
                <div className={`mb-6 p-4 rounded-2xl text-center font-bold text-sm ${error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {error || success}
                </div>
              )}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Code</label>
                   <input 
                    type="text"
                    value={editingPromo ? editingPromo.code : newPromo.code}
                    onChange={(e) => editingPromo 
                      ? setEditingPromo({ ...editingPromo, code: e.target.value.toUpperCase() })
                      : setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })
                    }
                    placeholder="FEAST50"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-700 outline-none"
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Campaign Name</label>
                   <input 
                    type="text"
                    value={editingPromo ? editingPromo.name : newPromo.name}
                    onChange={(e) => editingPromo
                      ? setEditingPromo({ ...editingPromo, name: e.target.value })
                      : setNewPromo({ ...newPromo, name: e.target.value })
                    }
                    placeholder="Festive Season Offer"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-700 outline-none"
                   />
                </div>
                <div className="md:col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Promotion Banner Image</label>
                   <AdminUpload 
                     onUpload={(url) => editingPromo 
                       ? setEditingPromo({ ...editingPromo, imageUrl: url })
                       : setNewPromo({ ...newPromo, imageUrl: url })
                     }
                     value={editingPromo ? editingPromo.imageUrl : newPromo.imageUrl}
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Discount Type</label>
                   <select 
                    value={editingPromo ? editingPromo.discountType : newPromo.discountType}
                    onChange={(e) => {
                      const val = e.target.value as 'percent' | 'flat';
                      if (editingPromo) setEditingPromo({ ...editingPromo, discountType: val });
                      else setNewPromo({ ...newPromo, discountType: val });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-700 outline-none"
                   >
                     <option value="percent">Percentage (%)</option>
                     <option value="flat">Flat Amount (₹)</option>
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Value</label>
                   <input 
                    type="number"
                    value={editingPromo ? editingPromo.discountValue : newPromo.discountValue}
                    onChange={(e) => editingPromo
                      ? setEditingPromo({ ...editingPromo, discountValue: parseInt(e.target.value) || 0 })
                      : setNewPromo({ ...newPromo, discountValue: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-700 outline-none"
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Expiry Date</label>
                   <input 
                    type="date"
                    value={editingPromo ? editingPromo.expiryDate : newPromo.expiryDate}
                    onChange={(e) => editingPromo
                      ? setEditingPromo({ ...editingPromo, expiryDate: e.target.value })
                      : setNewPromo({ ...newPromo, expiryDate: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-700 outline-none"
                   />
                </div>
                 <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Usage Limit (0 for Unlimited)</label>
                   <input 
                    type="number"
                    value={editingPromo ? editingPromo.usageLimit : newPromo.usageLimit}
                    onChange={(e) => editingPromo
                      ? setEditingPromo({ ...editingPromo, usageLimit: parseInt(e.target.value) || 0 })
                      : setNewPromo({ ...newPromo, usageLimit: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-700 outline-none"
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Audience</label>
                   <select 
                    value={editingPromo ? (editingPromo.targetAudience || 'all') : (newPromo.targetAudience || 'all')}
                    onChange={(e) => {
                      const val = e.target.value as 'all' | 'customer' | 'partner';
                      if (editingPromo) setEditingPromo({ ...editingPromo, targetAudience: val });
                      else setNewPromo({ ...newPromo, targetAudience: val });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-700 outline-none"
                   >
                     <option value="all">All Users</option>
                     <option value="customer">Customers Only</option>
                     <option value="partner">Partners Only</option>
                   </select>
                </div>
                <div className="md:col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Categories (Select Multiple)</label>
                   <div className="flex flex-wrap gap-2 mb-3">
                     {categories.map(cat => {
                        const current = editingPromo ? editingPromo.applicableCategories : newPromo.applicableCategories;
                        const isSelected = current?.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            onClick={() => {
                              const list = current || [];
                              const updated = isSelected ? list.filter(id => id !== cat.id) : [...list, cat.id];
                              if (editingPromo) setEditingPromo({ ...editingPromo, applicableCategories: updated });
                              else setNewPromo({ ...newPromo, applicableCategories: updated });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                              isSelected ? 'bg-blue-700 text-white border-blue-700' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400'
                            }`}
                          >
                            {cat.name}
                          </button>
                        );
                     })}
                   </div>
                </div>
                <div className="md:col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Specific Services (Select Multiple)</label>
                   <div className="flex flex-wrap gap-2 mb-3 max-h-40 overflow-y-auto p-1">
                     {services
                       .filter(s => {
                         const currentCats = editingPromo ? editingPromo.applicableCategories : newPromo.applicableCategories;
                         return !currentCats || currentCats.length === 0 || currentCats.includes(s.categoryId);
                       })
                       .map(svc => {
                          const currentSvcs = editingPromo ? editingPromo.applicableServices : newPromo.applicableServices;
                          const isSelected = currentSvcs?.includes(svc.id);
                          return (
                            <button
                              key={svc.id}
                              onClick={() => {
                                const list = currentSvcs || [];
                                const updated = isSelected ? list.filter(id => id !== svc.id) : [...list, svc.id];
                                if (editingPromo) setEditingPromo({ ...editingPromo, applicableServices: updated });
                                else setNewPromo({ ...newPromo, applicableServices: updated });
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                isSelected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400'
                              }`}
                            >
                              {svc.name}
                            </button>
                          );
                       })}
                   </div>
                </div>
                <div className="md:col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                   <input 
                    type="text"
                    value={editingPromo ? editingPromo.description : newPromo.description}
                    onChange={(e) => editingPromo
                      ? setEditingPromo({ ...editingPromo, description: e.target.value })
                      : setNewPromo({ ...newPromo, description: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-700 outline-none"
                   />
                </div>
             </div>
             <div className="flex gap-4 mt-8">
               <button 
                onClick={handleSavePromo}
                disabled={isSubmitting || (editingPromo ? !editingPromo.code || !editingPromo.name : !newPromo.code || !newPromo.name)}
                className="flex-[2] bg-blue-700 text-white py-4 rounded-xl font-bold hover:bg-blue-800 transition-all disabled:opacity-50"
               >
                 {editingPromo ? 'Update Campaign' : 'Launch Campaign'}
               </button>
               {editingPromo && (
                  <button 
                    onClick={() => setEditingPromo(null)}
                    className="flex-1 bg-slate-50 text-slate-400 py-4 rounded-xl font-bold hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
               )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPromotions.map(promo => (
          <div key={promo.id} className="bg-white p-6 border border-slate-200 rounded-[32px] hover:border-blue-700 transition-all group relative overflow-hidden">
             <div className="flex justify-between items-start mb-4">
                <div className="bg-slate-50 px-3 py-1 rounded-lg text-slate-900 font-black text-[10px] tracking-widest">{promo.code}</div>
                <div className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${promo.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {promo.active ? 'Active' : 'Paused'}
                </div>
             </div>
             <h4 className="font-bold text-slate-900 mb-1">{promo.name}</h4>
             <p className="text-xs text-slate-400 line-clamp-2 mb-2">{promo.description}</p>
             
             {((promo.applicableCategories && promo.applicableCategories.length > 0) || (promo.applicableServices && promo.applicableServices.length > 0) || promo.targetAudience) && (
               <div className="flex flex-wrap gap-2 mb-4">
                  {promo.targetAudience && promo.targetAudience !== 'all' && (
                    <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase">
                      For: {promo.targetAudience}
                    </span>
                  )}
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
             
             <div className="flex justify-between items-center mb-6 py-4 border-y border-slate-50">
                <div>
                  <p className="text-xl font-black text-slate-900">{promo.discountType === 'percent' ? `${promo.discountValue}%` : `₹${promo.discountValue}`}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Off</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {promo.usageCount || 0}
                    {promo.usageLimit && promo.usageLimit > 0 ? ` / ${promo.usageLimit}` : ''}
                  </p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Redeemed</p>
                </div>
             </div>

             <div className="flex justify-between items-center">
                <p className="text-[9px] text-slate-400 font-bold flex items-center gap-1.5 uppercase tracking-widest">
                  <Clock size={12} /> {promo.expiryDate ? new Date(promo.expiryDate).toLocaleDateString() : 'No Limit'}
                </p>
                <div className="flex gap-2">
                   <button 
                     onClick={() => handleBroadcast(promo)} 
                     disabled={isBroadcasting === promo.id}
                     className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                     title="Broadcast to users"
                   >
                     <Bell size={16} className={isBroadcasting === promo.id ? 'animate-bounce' : ''} />
                   </button>
                   <button 
                     onClick={() => { setEditingPromo(promo); setIsAdding(false); }} 
                     className="p-2 text-slate-400 hover:text-blue-700 transition-colors"
                     title="Edit Campaign"
                   >
                     <Settings size={16} />
                   </button>
                   <button onClick={() => togglePromo(promo)} className="p-2 text-slate-400 hover:text-blue-700 transition-colors">
                      {promo.active ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                   </button>
                   <button onClick={() => deletePromo(promo.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Delete Campaign">
                      <Trash2 size={16} />
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
           className="bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold text-xs"
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
            className="bg-white p-8 border border-slate-200 rounded-[32px] shadow-sm max-w-2xl"
          >
             <h4 className="text-lg font-bold mb-6">{editingFaq ? 'Edit FAQ Article' : 'Create New Knowledge Base Article'}</h4>
             <div className="space-y-6">
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Question</label>
                   <input 
                    type="text"
                    value={editingFaq ? editingFaq.question : newFaq.question}
                    onChange={(e) => editingFaq ? setEditingFaq({ ...editingFaq, question: e.target.value }) : setNewFaq({ ...newFaq, question: e.target.value })}
                    placeholder="How do I book a service?"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-700 outline-none"
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                   <select 
                    value={editingFaq ? editingFaq.category : newFaq.category}
                    onChange={(e) => editingFaq ? setEditingFaq({ ...editingFaq, category: e.target.value }) : setNewFaq({ ...newFaq, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-700 outline-none"
                   >
                     <option value="General">General</option>
                     <option value="Payments">Payments</option>
                     <option value="Bookings">Bookings</option>
                     <option value="Partners">Partners</option>
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Answer</label>
                   <textarea 
                    value={editingFaq ? editingFaq.answer : newFaq.answer}
                    onChange={(e) => editingFaq ? setEditingFaq({ ...editingFaq, answer: e.target.value }) : setNewFaq({ ...newFaq, answer: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-700 outline-none h-40"
                   />
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={editingFaq ? handleUpdateFaq : handleCreateFaq}
                    className="flex-1 bg-blue-700 text-white py-4 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-slate-200"
                  >
                    {editingFaq ? 'Save Changes' : 'Publish Article'}
                  </button>
                  {editingFaq && (
                    <button 
                      onClick={() => setEditingFaq(null)}
                      className="px-8 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
               <th className="px-8 py-5">Article</th>
               <th className="px-8 py-5">Category</th>
               <th className="px-8 py-5">Status</th>
               <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {faqs.map(faq => (
              <tr key={faq.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="px-8 py-6">
                   <p className="text-sm font-bold text-slate-900">{faq.question}</p>
                   <p className="text-[10px] text-slate-400 truncate max-w-md">{faq.answer}</p>
                </td>
                <td className="px-8 py-6">
                   <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-tighter">{faq.category}</span>
                </td>
                <td className="px-8 py-6">
                   <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${faq.isPublished ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{faq.isPublished ? 'Published' : 'Draft'}</span>
                   </div>
                </td>
                <td className="px-8 py-6 text-right">
                   <div className="flex justify-end gap-2">
                     <button onClick={() => { setEditingFaq(faq); setIsAdding(false); }} className="p-2 text-slate-400 hover:text-blue-700 transition-colors">
                        <Settings size={18} />
                     </button>
                     <button onClick={() => deleteFaq(faq.id)} className="p-2 text-slate-300 hover:text-red-600 transition-colors">
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
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

  const updateTicketCategory = async (id: string, category: string) => {
    try {
      await updateDoc(doc(db, 'tickets', id), { 
        category, 
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
      console.log('Response recorded successfully.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${id}`);
    }
  };

  const deleteTicket = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tickets', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tickets/${id}`);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const sMatch = statusFilter === 'all' || t.status === statusFilter;
    const pMatch = priorityFilter === 'all' || t.priority === priorityFilter;
    const cMatch = categoryFilter === 'all' || t.category === categoryFilter;
    return sMatch && pMatch && cMatch;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
         <div>
            <h3 className="text-xl font-bold">Support Queue</h3>
            <p className="text-sm text-slate-400">Manage user issues and inquiries</p>
         </div>
         <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200">
               <Filter size={14} className="text-slate-400" />
               <select 
                 value={categoryFilter}
                 onChange={(e) => setCategoryFilter(e.target.value)}
                 className="text-xs font-bold bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
               >
                  <option value="all">All Categories</option>
                  <option value="Booking Issue">Booking Issue</option>
                  <option value="Payment Problem">Payment Problem</option>
                  <option value="Account Inquiry">Account Inquiry</option>
                  <option value="Feedback">Feedback</option>
                  <option value="Other">Other</option>
               </select>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200">
               <Filter size={14} className="text-slate-400" />
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
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200">
               <AlertCircle size={14} className="text-slate-400" />
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
            <div key={ticket.id} className="bg-white border border-slate-200 rounded-[32px] hover:border-blue-700 transition-all group overflow-hidden shadow-sm hover:shadow-md">
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
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {ticket.priority} Priority
                          </span>
                          {ticket.category && (
                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                              {ticket.category}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-300 font-medium font-mono">
                            #ID-{ticket.id.slice(0, 8).toUpperCase()}
                          </span>
                      </div>
                      <h4 className="text-xl font-bold text-slate-900">{ticket.subject}</h4>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium">{ticket.message}</p>
                      
                      {ticket.adminResponse && (
                        <div className="mt-4 p-5 bg-blue-700 text-white rounded-2xl relative">
                           <div className="absolute -top-2 left-6 px-3 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full">Official Response</div>
                           <p className="text-xs italic text-slate-300">"{ticket.adminResponse}"</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-sm font-bold text-slate-900 border border-slate-200">
                            {user?.displayName?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{user?.displayName || 'Unknown User'}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{user?.email}</p>
                          </div>
                          <span className="ml-auto text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                            {ticket.createdAt?.toDate?.() ? ticket.createdAt.toDate().toLocaleDateString() : new Date(ticket.createdAt).toLocaleDateString()}
                          </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row lg:flex-col gap-3 justify-end min-w-[200px]">
                      <select
                        value={ticket.category || ''}
                        onChange={(e) => updateTicketCategory(ticket.id, e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-blue-700 outline-none cursor-pointer"
                      >
                         <option value="" disabled>Assign Category</option>
                         <option value="Booking Issue">Booking Issue</option>
                         <option value="Payment Problem">Payment Problem</option>
                         <option value="Account Inquiry">Account Inquiry</option>
                         <option value="Feedback">Feedback</option>
                         <option value="Other">Other</option>
                      </select>
                      <select 
                        value={ticket.status}
                        onChange={(e) => updateTicketStatus(ticket.id, e.target.value as any)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-blue-700 outline-none cursor-pointer"
                      >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                      </select>
                      <button 
                        onClick={() => respondingTo === ticket.id ? setRespondingTo(null) : setRespondingTo(ticket.id)}
                        className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          respondingTo === ticket.id ? 'bg-slate-100 text-slate-500' : 'bg-blue-700 text-white hover:bg-blue-800'
                        }`}
                      >
                        <MessageSquare size={14} /> {respondingTo === ticket.id ? 'Cancel' : 'Respond'}
                      </button>
                      <button 
                        onClick={() => deleteTicket(ticket.id)}
                        className="p-3 text-slate-300 hover:text-red-600 transition-colors bg-slate-50 rounded-xl hover:bg-slate-100 flex items-center justify-center"
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
                      className="mt-8 pt-8 border-t border-slate-100"
                    >
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Admin Response Message</label>
                       <textarea 
                        value={responseTime}
                        onChange={(e) => setResponseTime(e.target.value)}
                        placeholder="Type your response here. This will be visible to the user..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-700 outline-none h-32 mb-4"
                       />
                       <button 
                        onClick={() => handleRespond(ticket.id)}
                        disabled={!responseTime}
                        className="bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-xs hover:bg-blue-800 transition-all disabled:opacity-50 flex items-center gap-2 ml-auto"
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
          <div className="py-24 text-center bg-white border border-dashed border-slate-200 rounded-[40px]">
             <MessageSquare size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-medium italic">No tickets match your filters.</p>
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
    try {
      await deleteDoc(doc(db, 'reviews', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reviews/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-300">
          <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin mb-6" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fetching Database Feedback...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-24 bg-white border-2 border-dashed border-slate-100 rounded-[48px] flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mb-6">
            <MessageSquare size={32} className="text-slate-200" />
          </div>
          <h5 className="text-lg font-bold text-slate-900 mb-2 italic">Clean Slate</h5>
          <p className="text-slate-400 text-sm max-w-xs mx-auto italic">No customer reviews have been logged for this particular service node yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 hover:-translate-y-1">
               <button 
                onClick={() => deleteReview(r.id)}
                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                title="Moderate/Delete Review"
               >
                 <X size={18} />
               </button>
               <div className="flex items-center gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-100'} />
                  ))}
                  <span className="ml-2 text-[10px] font-black text-slate-900 uppercase tracking-widest">{r.rating}.0</span>
               </div>
               <div className="p-6 bg-slate-50 rounded-[28px] border border-slate-50 mb-6">
                  <p className="text-sm text-slate-600 italic leading-relaxed">"{r.comment}"</p>
               </div>
               <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-700 flex items-center justify-center text-[10px] font-black text-white italic">
                      U
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-0.5">Verified Customer</p>
                      <p className="text-[9px] text-slate-400 font-bold">
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

function PayoutManager() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'payoutRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleProcess = async (reqId: string, partnerId: string, amount: number) => {
    try {
      // Create a transaction/withdrawal record in partner's history
      await addDoc(collection(db, 'partners', partnerId, 'earningsHistory'), {
        amount: -amount,
        type: 'adjustment',
        description: 'Withdrawal to Bank Account (Processed)',
        createdAt: Timestamp.now()
      });

      // Update partner total balance
      const partnerRef = doc(db, 'partners', partnerId);
      const partnerDoc = await getDoc(partnerRef);
      if (partnerDoc.exists()) {
        const currentBalance = partnerDoc.data().totalEarnings || 0;
        await updateDoc(partnerRef, {
          totalEarnings: Math.max(0, currentBalance - amount)
        });
      }

      await updateDoc(doc(db, 'payoutRequests', reqId), {
        status: 'processed',
        processedAt: Timestamp.now()
      });
      alert('Payout processed successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to process payout.');
    }
  };

  return (
    <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm mt-8">
       <h3 className="text-xl font-bold font-display italic mb-6">Payout Requests</h3>
       {loading ? (
         <p className="text-slate-400">Loading payout requests...</p>
       ) : requests.length === 0 ? (
         <p className="text-slate-400 bg-slate-50 p-6 rounded-2xl italic border border-slate-100">No payout requests pending.</p>
       ) : (
         <div className="space-y-4">
           {requests.map(req => (
             <div key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-3xl gap-4">
                <div>
                   <p className="text-slate-900 font-bold mb-1">₹{req.amount}</p>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                     Partner: {req.partnerId} &bull; {req.createdAt?.toDate?.()?.toLocaleString()}
                   </p>
                </div>
                <div>
                  {req.status === 'pending' ? (
                     <button
                       onClick={() => handleProcess(req.id, req.partnerId, req.amount)}
                       className="bg-blue-700 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-colors"
                     >
                       Approve & Process
                     </button>
                  ) : (
                     <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                       Processed
                     </span>
                  )}
                </div>
             </div>
           ))}
         </div>
       )}
    </div>
  );
}

function AdminManager({ users, profile }: { users: UserProfile[], profile: UserProfile }) {
  const [isAdminCreating, setIsAdminCreating] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    email: '',
    password: '',
    displayName: '',
    adminSubRole: 'accounts' as AdminSubRole
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const admins = users.filter(u => u.role === 'admin');

  const isHead = profile.adminSubRole === 'head' || !profile.adminSubRole;

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await axios.post('/api/create-sub-admin', {
        requesterUid: profile.uid,
        ...newAdmin
      });
      if (response.data.success) {
        setSuccess(`Admin ${newAdmin.displayName} created successfully!`);
        setNewAdmin({ email: '', password: '', displayName: '', adminSubRole: 'accounts' });
        setTimeout(() => {
          setIsAdminCreating(false);
          setSuccess(null);
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const updateData: any = {
        displayName: editingAdmin.displayName,
        updatedAt: Timestamp.now()
      };
      
      if (editingAdmin.adminSubRole) {
        updateData.adminSubRole = editingAdmin.adminSubRole;
      }
      
      await updateDoc(doc(db, 'users', editingAdmin.uid), updateData);
      setSuccess("Admin updated successfully.");
      setTimeout(() => {
        setEditingAdmin(null);
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to update admin");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = async (uid: string) => {
    if (uid === profile.uid) {
      alert("You cannot delete yourself.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this admin? This will only remove their profile record from Firestore. To fully disable access, deactivate them in Firebase Auth console.")) return;
    
    try {
      await deleteDoc(doc(db, 'users', uid));
      alert("Admin profile removed successfully.");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
        <div>
          <h3 className="text-2xl font-bold italic font-display">Governance Unit</h3>
          <p className="text-sm text-slate-400">Manage administrative roles and access levels.</p>
        </div>
        {isHead && (
          <button 
            onClick={() => { setIsAdminCreating(!isAdminCreating); setEditingAdmin(null); }}
            className="bg-blue-700 text-white px-8 py-4 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-blue-800 shadow-xl shadow-blue-700/20"
          >
            {isAdminCreating ? <X size={18} /> : <UserPlus size={18} />}
            {isAdminCreating ? 'Abort Operation' : 'Initialize New Admin'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {(isAdminCreating || editingAdmin) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-10 rounded-[48px] border border-blue-700/20 shadow-2xl relative overflow-hidden"
          >
            <div className="relative z-10">
              <h4 className="text-xl font-bold mb-8 text-slate-900 flex items-center gap-3">
                <ShieldAlert className="text-blue-700" /> 
                {editingAdmin ? 'Update Authorization' : 'Administrative Credentialing'}
              </h4>
              
              <form onSubmit={editingAdmin ? handleUpdateAdmin : handleCreateAdmin} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest ml-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={editingAdmin ? editingAdmin.displayName : newAdmin.displayName}
                      onChange={(e) => editingAdmin 
                        ? setEditingAdmin({ ...editingAdmin, displayName: e.target.value })
                        : setNewAdmin({ ...newAdmin, displayName: e.target.value })
                      }
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-blue-700/5 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest ml-1">Assigned Role</label>
                    <select 
                      value={editingAdmin ? editingAdmin.adminSubRole : newAdmin.adminSubRole}
                      onChange={(e) => editingAdmin
                        ? setEditingAdmin({ ...editingAdmin, adminSubRole: e.target.value as AdminSubRole })
                        : setNewAdmin({ ...newAdmin, adminSubRole: e.target.value as AdminSubRole })
                      }
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-blue-700/5 transition-all outline-none"
                    >
                      <option value="accounts">Accounts Operator</option>
                      <option value="hr">Resource Manager (HR)</option>
                      <option value="manager">Operations Manager</option>
                      <option value="support">Support Executive</option>
                      <option value="editor">Content Editor</option>
                      <option value="moderator">Quality Moderator</option>
                      <option value="marketing">Marketing Specialist</option>
                      <option value="sales">Sales Executive</option>
                      <option value="logistics">Logistics Coordinator</option>
                      <option value="developer">Platform Developer</option>
                      <option value="field_manager">Field Operations Manager</option>
                      <option value="owner">Project Owner</option>
                      <option value="head">Security Chief (Head)</option>
                    </select>
                  </div>
                  {!editingAdmin && (
                    <>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest ml-1">Secure Email</label>
                        <input 
                          type="email" 
                          required
                          value={newAdmin.email}
                          onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                          placeholder="admin@zomindia.com"
                          className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-blue-700/5 transition-all outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest ml-1">Access Token (Password)</label>
                        <input 
                          type="password" 
                          required
                          value={newAdmin.password}
                          onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-blue-700/5 transition-all outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold border border-rose-100 flex items-center gap-3">
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-xs font-bold border border-emerald-100 flex items-center gap-3">
                    <CheckCircle2 size={16} /> {success}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/20 flex items-center justify-center gap-3"
                  >
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ShieldCheck size={18} />}
                    {editingAdmin ? 'Update Credentials' : 'Execute Inbound Protocol'}
                  </button>
                  {editingAdmin && (
                    <button 
                      type="button"
                      onClick={() => setEditingAdmin(null)}
                      className="flex-1 bg-slate-50 text-slate-400 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-700/5 rounded-full -mr-20 -mt-20 blur-3xl" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {admins.map(admin => (
          <div key={admin.uid} className="bg-white p-8 rounded-[40px] border border-slate-100 hover:border-blue-700 transition-all group shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between mb-8 relative z-10">
              <div className="w-14 h-14 bg-slate-50 rounded-[24px] flex items-center justify-center text-slate-900 group-hover:bg-blue-700 group-hover:text-white transition-all shadow-inner">
                <Settings size={28} />
              </div>
              <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                admin.adminSubRole === 'head' ? 'bg-indigo-50 text-indigo-600' :
                admin.adminSubRole === 'manager' ? 'bg-blue-50 text-blue-600' :
                admin.adminSubRole === 'accounts' ? 'bg-amber-50 text-amber-600' :
                admin.adminSubRole === 'editor' ? 'bg-purple-50 text-purple-600' :
                admin.adminSubRole === 'support' ? 'bg-emerald-50 text-emerald-600' :
                'bg-slate-50 text-slate-600'
              }`}>
                {admin.adminSubRole || 'Admin'} Access
              </div>
            </div>
            
            <div className="relative z-10">
               <h4 className="text-xl font-bold text-slate-900 mb-1">{admin.displayName || 'Unnamed Admin'}</h4>
               <p className="text-sm text-slate-400 mb-6">{admin.email}</p>
               
               <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                     <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Active Status</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isHead && (
                      <button 
                        onClick={() => { setEditingAdmin(admin); setIsAdminCreating(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="p-2 text-slate-300 hover:text-blue-700 transition-colors"
                      >
                        <FileText size={20} />
                      </button>
                    )}
                    {admin.uid !== profile.uid && isHead && (
                      <button 
                        onClick={() => handleDeleteAdmin(admin.uid)}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <XCircle size={20} />
                      </button>
                    )}
                  </div>
               </div>
            </div>
            
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-slate-50 rounded-full opacity-50 group-hover:bg-blue-50 transition-all" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MyAdminProfile({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet' | 'settings'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, 'users', profile.uid), { displayName });
      setIsEditing(false);
      window.location.reload();
    } catch (error) {
      console.error("Profile update failed", error);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm mb-12">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 rounded-[24px] overflow-hidden border-2 border-indigo-100 shadow-xl shadow-indigo-100 ring-1 ring-slate-100">
             <img 
               src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.displayName}`} 
               alt={profile.displayName} 
               className="w-full h-full object-cover"
             />
           </div>
           <div>
             <h3 className="text-2xl font-bold font-display italic text-slate-900">{profile.displayName}</h3>
             <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{profile.adminSubRole || 'Admin'} Terminal</p>
           </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
           {(['profile', 'wallet', 'settings'] as const).map(tab => (
             <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20' : 'text-slate-400 hover:text-blue-700'}`}
             >
               {tab}
             </button>
           ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, scale: 0.98 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.98 }}
           transition={{ duration: 0.2 }}
        >
          {activeTab === 'profile' && (
            <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm space-y-10">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-bold text-xl italic uppercase tracking-wider">Administrative Identity</h4>
                <button 
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  className="px-6 py-2.5 bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/10"
                >
                  {isEditing ? 'Save Identity' : 'Modify Credentials'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-700/5 transition-all"
                    />
                  ) : (
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                       <p className="font-bold text-lg text-slate-700">{profile.displayName}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Email</label>
                   <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 opacity-60">
                      <p className="font-bold text-lg text-slate-700">{profile.email}</p>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Tier</label>
                   <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 flex items-center gap-3 text-indigo-600">
                      <ShieldCheck size={20} />
                      <p className="font-bold text-lg capitalize">{profile.role} ({profile.adminSubRole})</p>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deployment Date</label>
                   <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                      <p className="font-bold text-lg text-slate-700">
                        {profile.createdAt && (profile.createdAt as any).toDate ? (profile.createdAt as any).toDate().toLocaleDateString() : 
                         profile.createdAt instanceof Date ? profile.createdAt.toLocaleDateString() : 'Historical'}
                      </p>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-indigo-600 rounded-[48px] p-12 text-white space-y-6 relative overflow-hidden group">
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mb-8">
                      <DollarSign size={32} />
                    </div>
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Admin Credit Balance</p>
                    <h4 className="text-6xl font-display font-bold italic">₹{profile.walletBalance || 0}</h4>
                    <p className="text-sm text-white/40 mt-8 max-w-xs leading-relaxed">This balance reflects your internal operational credits, bonuses, or reimbursements as an administrative member.</p>
                  </div>
                  <Smartphone className="absolute -right-12 -bottom-12 w-64 h-64 text-white/5 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
               </div>

               <div className="bg-white rounded-[48px] p-12 border border-slate-100 shadow-sm">
                  <h4 className="text-xl font-bold italic font-display mb-10">Ledger History</h4>
                  <div className="space-y-4">
                     <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                        <AlertCircle size={48} strokeWidth={1} className="mb-4 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No Recent Transactions</p>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm space-y-10 text-center py-32">
               <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-[40px] flex items-center justify-center mx-auto mb-8">
                  <Settings size={48} className="animate-spin-slow" />
               </div>
               <h4 className="text-2xl font-bold font-display italic text-slate-900">System Configuration</h4>
               <p className="text-slate-500 max-w-md mx-auto">Interface settings, terminal colors, and notification anchors are currently managed via the Global Security Chief.</p>
               <button 
                 onClick={() => signOut(auth)}
                 className="flex items-center gap-3 bg-rose-50 text-rose-600 px-10 py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] mx-auto hover:bg-rose-100 transition-all border border-rose-100/50"
               >
                 <LogOut size={16} />
                 Terminate Session
               </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function AnalyticsView({ bookings, users, partners, services }: { bookings: Booking[], users: UserProfile[], partners: any[], services: Service[] }) {
  const [trendRange, setTrendRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const totalRevenue = bookings.reduce((acc, b) => (b.status === 'completed' || b.status === 'finalized') ? acc + b.totalPrice : acc, 0);
  const totalBookings = bookings.length;
  const activePartnersCount = partners.filter(p => p.status === 'active').length;

  const processTrendData = (data: any[], dateKey: string, valueExtractor: (item: any) => number = () => 1) => {
    const dataMap: Record<string, number> = {};
    
    data.forEach(item => {
      const date = item[dateKey]?.toDate ? item[dateKey].toDate() : new Date(item[dateKey]);
      if (isNaN(date.getTime())) return;

      let key = '';
      if (trendRange === 'daily') {
        key = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else if (trendRange === 'weekly') {
        const d = new Date(date);
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
        key = `W${weekNo} ${d.getFullYear()}`;
      } else {
        key = date.toLocaleDateString([], { month: 'short', year: 'numeric' });
      }

      dataMap[key] = (dataMap[key] || 0) + valueExtractor(item);
    });

    return Object.entries(dataMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => {
         // Custom sort for trend labels
         return 0; // Simplified for now, map handles distribution
      });
  };

  const revenueTrendData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    bookings.forEach(b => {
      if (b.status === 'completed' || b.status === 'finalized') {
        const date = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt);
        if (isNaN(date.getTime())) return;
        
        let key = '';
        if (trendRange === 'daily') key = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        else if (trendRange === 'weekly') {
          const d = new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate() + 4 - (d.getDay() || 7));
          key = `W${Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)} ${d.getFullYear()}`;
        }
        else key = date.toLocaleDateString([], { month: 'short', year: 'numeric' });

        dataMap[key] = (dataMap[key] || 0) + b.totalPrice;
      }
    });
    return Object.entries(dataMap)
      .map(([label, amount]) => ({ label, amount }))
      .slice(-12); // Last 12 points
  }, [bookings, trendRange]);

  const bookingTrendData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    bookings.forEach(b => {
      const date = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      if (isNaN(date.getTime())) return;

      let key = '';
      if (trendRange === 'daily') key = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      else if (trendRange === 'weekly') {
        const d = new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        key = `W${Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)} ${d.getFullYear()}`;
      }
      else key = date.toLocaleDateString([], { month: 'short', year: 'numeric' });

      dataMap[key] = (dataMap[key] || 0) + 1;
    });
    return Object.entries(dataMap)
      .map(([label, count]) => ({ label, count }))
      .slice(-12);
  }, [bookings, trendRange]);

  const acquisitionTrendData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    users.forEach(u => {
      const date = (u.createdAt as any)?.toDate?.() || new Date(u.createdAt);
      if (isNaN(date.getTime())) return;

      let key = '';
      if (trendRange === 'daily') key = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      else if (trendRange === 'weekly') {
        const d = new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        key = `W${Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)} ${d.getFullYear()}`;
      }
      else key = date.toLocaleDateString([], { month: 'short', year: 'numeric' });

      dataMap[key] = (dataMap[key] || 0) + 1;
    });
    return Object.entries(dataMap)
      .map(([label, count]) => ({ label, count }))
      .slice(-12);
  }, [users, trendRange]);

  const partnerPerformance = useMemo(() => {
    const perfMap: Record<string, { name: string, revenue: number, assigned: number, completed: number, rating: number, responseTime: number }> = {};
    
    partners.forEach(p => {
      const user = users.find(u => u.uid === p.userId);
      perfMap[p.userId] = {
        name: user?.displayName || p.id.slice(0, 8),
        revenue: 0,
        assigned: 0,
        completed: 0,
        rating: p.rating || 0,
        responseTime: Math.floor(Math.random() * 30) + 5 // Mock for now
      };
    });

    bookings.forEach(b => {
      if (b.partnerId && perfMap[b.partnerId]) {
        perfMap[b.partnerId].assigned += 1;
        if (b.status === 'completed' || b.status === 'finalized') {
          perfMap[b.partnerId].completed += 1;
          perfMap[b.partnerId].revenue += b.totalPrice;
        }
      }
    });

    return Object.values(perfMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [bookings, partners, users]);

  const acquisitionMetrics = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const newUsersLast30 = users.filter(u => {
      const createdAt = (u.createdAt as any)?.toDate?.() || new Date(u.createdAt);
      return createdAt >= thirtyDaysAgo && createdAt <= now;
    }).length;

    const newUsersPrev30 = users.filter(u => {
      const createdAt = (u.createdAt as any)?.toDate?.() || new Date(u.createdAt);
      return createdAt >= sixtyDaysAgo && createdAt < thirtyDaysAgo;
    }).length;

    const rate = newUsersPrev30 === 0 ? (newUsersLast30 > 0 ? 100 : 0) : ((newUsersLast30 - newUsersPrev30) / newUsersPrev30) * 100;

    return {
      currentCount: newUsersLast30,
      previousCount: newUsersPrev30,
      growthRate: rate.toFixed(1)
    };
  }, [users]);

  const serviceDistribution = useMemo(() => {
    const distMap: Record<string, number> = {};
    bookings.forEach(b => {
      const service = services.find(s => s.id === b.serviceId);
      const name = service?.name || 'Unknown';
      distMap[name] = (distMap[name] || 0) + 1;
    });
    return Object.entries(distMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [bookings, services]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-display font-bold italic">Analytics Terminal</h2>
          <p className="text-slate-400 text-sm">Real-time performance intelligence</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {(['daily', 'weekly', 'monthly'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTrendRange(range)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${trendRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard title="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} icon={DollarSign} color="bg-emerald-500" />
        <StatCard title="Total Bookings" value={totalBookings.toString()} icon={FileText} color="bg-blue-700" />
        <StatCard title="Growth Rate" value={`${acquisitionMetrics.growthRate}%`} icon={TrendingUp} color="bg-indigo-600" />
        <StatCard title="Active Partners" value={activePartnersCount.toString()} icon={ShieldCheck} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold italic font-display">Revenue Growth</h3>
              <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                 <TrendingUp size={12} />
                 Adaptive
              </div>
           </div>
           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData}>
                  <defs>
                    <linearGradient id="analyticsRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                    formatter={(val) => [`₹${val}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#analyticsRev)" />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold italic font-display">Customer Acquisition</h3>
           </div>
           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={acquisitionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold italic font-display">Booking Trends</h3>
           </div>
           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bookingTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc', radius: 12 }}
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[12, 12, 0, 0]} name="Bookings" />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold italic font-display">Service Distribution</h3>
           </div>
           <div className="h-[350px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {serviceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '24px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-bold font-display italic">{totalBookings}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Total Ops</span>
              </div>
           </div>
        </div>

        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm lg:col-span-2">
           <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold italic font-display">Partner Efficiency Matrix</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Leaderboard</p>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 italic">
                       <th className="px-6 py-4">Professional</th>
                       <th className="px-6 py-4">Revenue Generated</th>
                       <th className="px-6 py-4">Success Rate</th>
                       <th className="px-6 py-4">Response Time</th>
                       <th className="px-6 py-4">Avg Rating</th>
                       <th className="px-6 py-4 text-right">Performance Index</th>
                    </tr>
                 </thead>
                 <tbody>
                    {partnerPerformance.map((p, i) => (
                      <tr key={i} className="group hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-[10px]">
                                  {p.name[0]}
                               </div>
                               <span className="text-sm font-bold text-slate-900">{p.name}</span>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <span className="text-sm font-bold text-slate-900">₹{p.revenue.toLocaleString()}</span>
                         </td>
                         <td className="px-6 py-5">
                            <div className="flex flex-col">
                               <span className="text-sm font-bold text-slate-600">{((p.completed / (p.assigned || 1)) * 100).toFixed(0)}%</span>
                               <span className="text-[9px] text-slate-400 font-medium">{p.completed}/{p.assigned} Jobs</span>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <span className="text-sm font-bold text-slate-600">{p.responseTime} min</span>
                         </td>
                         <td className="px-6 py-5">
                            <div className="flex items-center gap-1.5">
                               <Star size={12} className="text-amber-400 fill-amber-400" />
                               <span className="text-sm font-bold text-slate-900">{p.rating}</span>
                            </div>
                         </td>
                         <td className="px-6 py-5 text-right">
                            <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full">
                               <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Rank #{i+1}</span>
                            </div>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  );
}
