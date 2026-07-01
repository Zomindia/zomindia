import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Calendar, 
  User as UserIcon, 
  Briefcase,
  Wallet,
  Settings,
  Bell,
  CheckCircle2,
  X,
  Menu,
  ChevronRight,
  MapPin,
  Clock,
  Navigation,
  MessageSquare,
  Star,
  Zap,
  TicketPercent
} from 'lucide-react';
import { UserProfile, PartnerProfile, Booking, Service, PartnerApplication } from '../types';
import { auth, db } from '../lib/firebase';
import PartnerHome from './partner/PartnerHome';
import PartnerJobs from './partner/PartnerJobs';
import PartnerWallet from './partner/PartnerWallet';
import PartnerSettings from './partner/PartnerSettings';
import NotificationsView from './NotificationsView';
import PartnerAmcLeads from './partner/PartnerAmcLeads';
import OffersView from './OffersView';
import { LoadingScreen } from './LoadingIndicator';
import LogoHorizontal from '../assets/logo-horizontal.png';
import LogoIcon from '../assets/logo-icon.png';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc, Timestamp, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useLocationTracking } from '../hooks/useLocationTracking';

interface Props {
  profile: UserProfile;
  initialTab?: 'home' | 'jobs' | 'wallet' | 'settings' | 'notifications';
  targetBookingId?: string | null;
  onNavigate?: (tab: string) => void;
}

export default function PartnerApp({ profile, initialTab = 'home', targetBookingId: initialTargetId, onNavigate: onAppNavigate }: Props) {
  const [activeScreen, setActiveScreen] = useState<'home' | 'jobs' | 'wallet' | 'settings' | 'notifications' | 'offers' | 'amc-leads'>(initialTab as any);
  const [targetBookingId, setTargetBookingId] = useState<string | null>(initialTargetId || null);
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [application, setApplication] = useState<PartnerApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Active global background service that periodic/live updates coordinate markers in firebase
  const { lastSyncedAt, isTrackingActive } = useLocationTracking(partner?.id, bookings, partner?.availabilityStatus);

  useEffect(() => {
    if (initialTargetId) {
      setTargetBookingId(initialTargetId);
      setActiveScreen('jobs');
    }
  }, [initialTargetId]);

  const navigateWithTarget = (screen: any, targetId: string | null = null) => {
    // If screen is a top level app tab, use onAppNavigate
    if (onAppNavigate && (screen === 'admin' || screen === 'home')) {
       onAppNavigate(screen);
       return;
    }
    setTargetBookingId(targetId);
    setActiveScreen(screen);
  };

  useEffect(() => {
    // Fetch partner data
    const fetchPartner = () => {
      const q = query(collection(db, 'partners'), where('userId', '==', profile.uid));
      return onSnapshot(q, (snap) => {
        if (!snap.empty) {
          setPartner({ id: snap.docs[0].id, ...snap.docs[0].data() } as PartnerProfile);
        }
        setLoading(false);
      });
    };

    // Fetch bookings data
    const fetchBookings = () => {
        const qMy = query(
          collection(db, 'bookings'), 
          where('partnerId', '==', profile.uid),
          orderBy('scheduledAt', 'desc')
        );
        const qPool = query(
          collection(db, 'bookings'),
          where('status', '==', 'pending'),
          orderBy('scheduledAt', 'desc')
        );

        let myBookings: Booking[] = [];
        let poolBookings: Booking[] = [];

        const updateAllBookings = (my: Booking[], pool: Booking[]) => {
          const combined = [...my, ...pool.filter(p => !my.find(m => m.id === p.id))];
          setBookings(combined);
        };

        const unsubMy = onSnapshot(qMy, (snap) => {
          // Sync all assigned tasks with active or assigned status
          const activeOrAssignedStatuses = ['pending_acceptance', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'payment_pending', 'pending_parts'];
          myBookings = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Booking))
            .filter(b => activeOrAssignedStatuses.includes(b.status || ''));
          updateAllBookings(myBookings, poolBookings);
        });

        const unsubPool = onSnapshot(qPool, (snap) => {
          poolBookings = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)).filter(b => !b.partnerId);
          updateAllBookings(myBookings, poolBookings);
        });

        return () => {
          unsubMy();
          unsubPool();
        };
    };

    const fetchServices = () => {
      return onSnapshot(collection(db, 'services'), (snap) => {
        setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
      });
    };

    const fetchUsers = () => {
      return onSnapshot(collection(db, 'users'), (snap) => {
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      });
    };

    const fetchApplication = () => {
      return onSnapshot(collection(db, 'partner_applications'), (snap) => {
        const apps = snap.docs.map(d => ({ id: d.id, ...d.data() } as PartnerApplication));
        const myApp = apps.find(a => 
          a.phone === profile.phoneNumber || 
          a.phone === profile.mobile || 
          a.fullName?.toLowerCase() === profile.displayName?.toLowerCase() ||
          a.fullName?.toLowerCase() === profile.fullName?.toLowerCase()
        );
        setApplication(myApp || null);
      });
    };

    const unsubPartner = fetchPartner();
    const unsubBookings = fetchBookings();
    const unsubServices = fetchServices();
    const unsubUsers = fetchUsers();
    const unsubApplication = fetchApplication();
    
    return () => {
      unsubPartner();
      unsubBookings();
      unsubServices();
      unsubUsers();
      unsubApplication();
    };
  }, [profile.uid]);

  // Lock active screen to home if partner application is pending review
  useEffect(() => {
    if (!partner && application) {
      setActiveScreen('home');
    }
  }, [partner, application]);

  const updateStatus = async (status: 'Available' | 'Busy' | 'Offline') => {
    if (!partner) return;
    try {
      await updateDoc(doc(db, 'partners', partner.id), {
        availabilityStatus: status,
        updatedAt: Timestamp.now()
      });
      setToastMessage(`Status updated to "${status}" successfully.`);
      setShowToast(true);
      setShowStatusModal(false);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'partners');
    }
  };

  if (loading) {
    return <LoadingScreen message="Updating your jobs and clients..." />;
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'home':
        return <PartnerHome partner={partner} bookings={bookings} services={services} users={users} onNavigate={navigateWithTarget} profile={profile} application={application} />;
      case 'jobs':
        return (
          <PartnerJobs 
            partner={partner} 
            bookings={bookings} 
            initialExpandedBookingId={targetBookingId} 
            profile={profile} 
            lastSyncedAt={lastSyncedAt}
            isTrackingActive={isTrackingActive}
          />
        );
      case 'wallet':
        return <PartnerWallet partner={partner} />;
      case 'settings':
        return <PartnerSettings partner={partner} profile={profile} onNavigate={navigateWithTarget} bookings={bookings} services={services} users={users} />;
      case 'notifications':
        return <NotificationsView profile={profile} onNavigate={navigateWithTarget} />;
      case 'amc-leads':
        return <PartnerAmcLeads profile={profile} partner={partner} />;
      case 'offers':
        return <OffersView profile={profile} onAuthRequired={() => {}} setActiveTab={(tab) => navigateWithTarget(tab as any)} context="partner" />;
      default:
        return <PartnerHome partner={partner} bookings={bookings} services={services} users={users} onNavigate={navigateWithTarget} profile={profile} application={application} />;
    }
  };

  const hasUrgentPoolRequest = bookings.some(b => 
    b.status === 'pending' && 
    !b.partnerId && 
    (b.partnerPriority === 'high' || b.isPriority === true)
  );

  const navItems = (!partner && application) ? [] : [
    { id: 'home', icon: BarChart3, label: 'Stats' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs' },
    { id: 'amc-leads', icon: Zap, label: 'AMC Leads' },
    { id: 'offers', icon: TicketPercent, label: 'Offers' },
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-32 flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden border-x border-slate-200">
      {/* App Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center transition-all select-none">
        <div className="flex items-center gap-2 shrink-0 select-none">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 bg-[#0a2540]/5 p-1">
            <img src={LogoIcon} alt="Zomindia Icon" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <div className="flex flex-col max-w-[100px]">
            <img src={LogoHorizontal} alt="Zomindia brand" className="h-4.5 w-auto object-contain object-left" referrerPolicy="no-referrer" />
            <span className="text-[7.5px] text-[#0a2540] font-black uppercase tracking-widest leading-none mt-0.5">Partner App</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
           {profile.role === 'admin' && (
             <button 
               onClick={() => onAppNavigate?.('admin')}
               className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-purple-100 transition-all shrink-0"
             >
               Admin
             </button>
           )}
           {profile.walletBalance !== undefined && (
             <button 
               onClick={() => navigateWithTarget('wallet')}
               className={`flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl border transition-all active:scale-95 shrink-0 ${activeScreen === 'wallet' ? 'border-amber-500 bg-amber-50/20' : 'border-slate-100'}`}
             >
               <Wallet size={13} className="text-amber-500" />
               <span className="text-[11px] font-black text-slate-800 tracking-tight">₹{profile.walletBalance}</span>
             </button>
           )}
           <button 
             onClick={() => navigateWithTarget('notifications')}
             className="relative p-1.5 text-slate-400 hover:text-blue-700 transition-colors shrink-0"
           >
             <Bell size={18} />
             <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white" />
           </button>
           <button 
             onClick={() => navigateWithTarget('settings')}
             className={`w-8 h-8 rounded-full overflow-hidden bg-slate-100 border-2 transition-all shrink-0 ${activeScreen === 'settings' ? 'border-[#22c55e] ring-2 ring-[#22c55e]/10' : 'border-[#22c55e]'}`}
           >
              <img src={profile.photoURL || "http://googleusercontent.com/image_collection/image_retrieval/16433425957912595047"} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover rounded-full" />
           </button>
           <button 
             onClick={() => setShowStatusModal(true)}
             className={`px-2 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border transition-all shrink-0 ${
               partner?.availabilityStatus === 'Available' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
               partner?.availabilityStatus === 'Busy' ? 'bg-amber-50 text-amber-600 border-amber-100' :
               'bg-slate-100 text-slate-500 border-slate-200'
             }`}
           >
             <span className={`w-1.5 h-1.5 rounded-full ${
               partner?.availabilityStatus === 'Available' ? 'bg-emerald-500 animate-pulse' :
               partner?.availabilityStatus === 'Busy' ? 'bg-amber-500' : 'bg-slate-400'
             }`} />
             {partner?.availabilityStatus || 'Offline'}
           </button>
        </div>
      </header>

      {/* Global Background Dispatch Tracking Banner */}
      {partner && isTrackingActive && (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-white select-none shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-100 truncate">
              Continuous background dispatch active
            </span>
          </div>
          <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded shrink-0 select-none">
            {lastSyncedAt 
              ? `Locked • ${lastSyncedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` 
              : 'Acquiring lock...'}
          </span>
        </div>
      )}

      {/* Screen Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Tab Bar - Floating/Aligned across platform */}
      {!(!partner && application) && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-8 pointer-events-none max-w-md mx-auto safe-area-bottom">
          <div className="bg-white/95 backdrop-blur-3xl border border-slate-200/60 rounded-[32px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.2)] flex items-center justify-around p-2 pointer-events-auto">
            {navItems.map((tab) => {
              const isActive = activeScreen === tab.id;
              const Icon = tab.icon;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => navigateWithTarget(tab.id as any)}
                  className="relative flex flex-col items-center justify-center pt-2 pb-1.5 px-1 transition-all flex-1"
                >
                  <div className={`relative p-2 rounded-2xl transition-all duration-500 mb-1 ${isActive ? 'bg-blue-700 text-white shadow-xl shadow-blue-700/30 scale-110' : 'text-slate-400 active:scale-90 hover:text-slate-600'}`}>
                    {tab.id === 'jobs' && hasUrgentPoolRequest && !isActive && (
                      <>
                        <motion.span
                          className="absolute inset-0 rounded-2xl bg-amber-500/30 pointer-events-none"
                          animate={{
                            scale: [1, 2.4],
                            opacity: [0.7, 0],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 2,
                            ease: "easeOut",
                          }}
                        />
                        <motion.span
                          className="absolute inset-0 rounded-2xl bg-amber-500/20 pointer-events-none"
                          animate={{
                            scale: [1, 1.7],
                            opacity: [0.5, 0],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 2,
                            delay: 0.6,
                            ease: "easeOut",
                          }}
                        />
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white" />
                      </>
                    )}
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? 'text-slate-900 opacity-100 transform translate-y-0' : 'text-slate-400 opacity-60 translate-y-0.5'}`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.span 
                      layoutId="partner-nav-indicator"
                      className="absolute -bottom-1.5 w-6 h-1 bg-blue-700 rounded-full" 
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Picker Modal */}
      <AnimatePresence>
        {showStatusModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={() => setShowStatusModal(false)}
            className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
          >
             <motion.div 
               initial={{ y: '100%' }}
               animate={{ y: 0 }}
               exit={{ y: '100%' }}
               transition={{ type: "spring", damping: 26, stiffness: 240 }}
               onClick={(e) => e.stopPropagation()}
               className="bg-white rounded-t-[32px] rounded-b-[24px] sm:rounded-[32px] w-full max-w-md p-6 sm:p-8 pb-10 sm:pb-12 shadow-2xl relative"
             >
                {/* Visual Native Bottom-Sheet Notch Indicator */}
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
                </div>

                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold tracking-tight text-slate-900">Update Availability</h3>
                   <button 
                     onClick={() => setShowStatusModal(false)} 
                     className="p-2 hover:bg-slate-100 active:scale-95 text-slate-400 hover:text-slate-600 rounded-full transition-all"
                   >
                     <X size={20} />
                   </button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {[
                     { id: 'Available', color: 'emerald', label: 'Ready for Work', desc: 'Auto-accept job invitations' },
                     { id: 'Busy', color: 'amber', label: 'On a Break', desc: 'Pausing new requests temporarily' },
                     { id: 'Offline', color: 'stone', label: 'Go Offline', desc: 'Finish current work and disconnect' },
                   ].map(st => {
                     const isSelected = partner?.availabilityStatus === st.id;
                     const dotColorClass = 
                       st.id === 'Available' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                       st.id === 'Busy' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 
                       'bg-slate-400';

                     return (
                       <motion.button
                         key={st.id}
                         onClick={() => updateStatus(st.id as any)}
                         animate={isSelected ? {
                           scale: [1, 1.015, 1],
                           boxShadow: [
                             '0 10px 15px -3px rgba(29, 78, 216, 0.15), 0 4px 6px -4px rgba(29, 78, 216, 0.15)',
                             '0 15px 25px -3px rgba(29, 78, 216, 0.35), 0 10px 10px -5px rgba(29, 78, 216, 0.2)',
                             '0 10px 15px -3px rgba(29, 78, 216, 0.15), 0 4px 6px -4px rgba(29, 78, 216, 0.15)'
                           ]
                         } : {}}
                         transition={isSelected ? {
                           repeat: Infinity,
                           duration: 2.2,
                           ease: "easeInOut"
                         } : {}}
                         whileTap={{ scale: 0.98 }}
                         className={`flex items-center gap-4 p-5 rounded-2xl border text-left transition-all ${
                           isSelected 
                             ? `bg-blue-700 border-blue-700 text-white` 
                             : `bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50`
                         }`}
                       >
                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                           isSelected ? 'bg-white/10' : `bg-slate-50 text-slate-400`
                         }`}>
                           <Zap size={20} className={isSelected ? 'text-white' : ''} />
                         </div>
                         <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${dotColorClass} transition-all ${st.id === 'Available' ? 'animate-pulse' : ''}`} />
                              <p className="font-bold">{st.label}</p>
                            </div>
                            <p className={`text-[10px] font-medium ${isSelected ? 'text-white/50' : 'text-slate-400'}`}>{st.desc}</p>
                         </div>
                         {isSelected && <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />}
                       </motion.button>
                     );
                   })}
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%", scale: 0.95 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, y: -20, x: "-50%", scale: 0.95 }}
            className="fixed top-6 left-1/2 z-[110] flex items-center gap-2.5 bg-slate-900 border border-slate-850 text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold whitespace-nowrap"
          >
            <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
               <CheckCircle2 size={12} />
            </div>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
