import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Calendar, 
  User as UserIcon, 
  LogOut, 
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
import { UserProfile, PartnerProfile, Booking } from '../types';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import PartnerHome from './partner/PartnerHome';
import PartnerJobs from './partner/PartnerJobs';
import PartnerWallet from './partner/PartnerWallet';
import PartnerSettings from './partner/PartnerSettings';
import PartnerNotifications from './partner/PartnerNotifications';
import OffersView from './OffersView';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc, Timestamp, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface Props {
  profile: UserProfile;
  initialTab?: 'home' | 'jobs' | 'wallet' | 'settings' | 'notifications';
  targetBookingId?: string | null;
}

export default function PartnerApp({ profile, initialTab = 'home', targetBookingId }: Props) {
  const [activeScreen, setActiveScreen] = useState<'home' | 'jobs' | 'wallet' | 'settings' | 'notifications' | 'offers'>(initialTab);
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStatusModal, setShowStatusModal] = useState(false);

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

        const unsubMy = onSnapshot(qMy, (snap) => {
          myBookings = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
          // Filter poolBookings to make sure no overlaps if status changes
          setBookings([...myBookings, ...poolBookings.filter(p => !myBookings.find(m => m.id === p.id))]);
        });

        const unsubPool = onSnapshot(qPool, (snap) => {
          poolBookings = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)).filter(b => !b.partnerId);
          setBookings([...myBookings, ...poolBookings.filter(p => !myBookings.find(m => m.id === p.id))]);
        });

        return () => {
          unsubMy();
          unsubPool();
        };
    };

    const unsubPartner = fetchPartner();
    const unsubBookings = fetchBookings();
    
    return () => {
      unsubPartner();
      unsubBookings();
    };
  }, [profile.uid]);

  const updateStatus = async (status: 'Available' | 'Busy' | 'Offline') => {
    if (!partner) return;
    try {
      await updateDoc(doc(db, 'partners', partner.id), {
        availabilityStatus: status,
        updatedAt: Timestamp.now()
      });
      setShowStatusModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'partners');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full"
        />
      </div>
    );
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'home':
        return <PartnerHome partner={partner} bookings={bookings} onNavigate={setActiveScreen} profile={profile} />;
      case 'jobs':
        return <PartnerJobs partner={partner} bookings={bookings} initialExpandedBookingId={targetBookingId} />;
      case 'wallet':
        return <PartnerWallet partner={partner} />;
      case 'settings':
        return <PartnerSettings partner={partner} profile={profile} />;
      case 'notifications':
        return <PartnerNotifications profile={profile} onNavigate={setActiveScreen} />;
      case 'offers':
        return <OffersView profile={profile} onAuthRequired={() => {}} setActiveTab={(tab) => setActiveScreen(tab)} />;
      default:
        return <PartnerHome partner={partner} bookings={bookings} onNavigate={setActiveScreen} profile={profile} />;
    }
  };

  const navItems = [
    { id: 'home', icon: BarChart3, label: 'Stats' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs' },
    { id: 'wallet', icon: Wallet, label: 'Wallet' },
    { id: 'offers', icon: TicketPercent, label: 'Offers' },
    { id: 'settings', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-32 flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden border-x border-slate-200">
      {/* App Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-700 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <span className="font-black italic">Z</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none mb-1">zomindia</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Partner App</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setActiveScreen('notifications')}
             className="relative p-2 text-slate-400 hover:text-blue-700 transition-colors"
           >
             <Bell size={20} />
             <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
           </button>
           <button 
             onClick={() => setShowStatusModal(true)}
             className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border transition-all ${
               partner?.availabilityStatus === 'Available' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
               partner?.availabilityStatus === 'Busy' ? 'bg-amber-50 text-amber-600 border-amber-100' :
               'bg-slate-50 text-slate-400 border-slate-200'
             }`}
           >
             <div className={`w-1.5 h-1.5 rounded-full ${
               partner?.availabilityStatus === 'Available' ? 'bg-emerald-500 animate-pulse' :
               partner?.availabilityStatus === 'Busy' ? 'bg-amber-500' : 'bg-slate-400'
             }`} />
             {partner?.availabilityStatus || 'Offline'}
           </button>
        </div>
      </header>

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
      <div className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-8 pointer-events-none max-w-md mx-auto safe-area-bottom">
        <div className="bg-white/95 backdrop-blur-3xl border border-slate-200/60 rounded-[32px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.2)] flex items-center justify-around p-2 pointer-events-auto">
          {navItems.map((tab) => {
            const isActive = activeScreen === tab.id;
            const Icon = tab.icon;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveScreen(tab.id as any)}
                className="relative flex flex-col items-center justify-center pt-2 pb-1.5 px-1 transition-all flex-1"
              >
                <div className={`relative p-2 rounded-2xl transition-all duration-500 mb-1 ${isActive ? 'bg-blue-700 text-white shadow-xl shadow-blue-700/30 scale-110' : 'text-slate-400 active:scale-90 hover:text-slate-600'}`}>
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

      {/* Status Picker Modal */}
      <AnimatePresence>
        {showStatusModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-blue-700/60 backdrop-blur-sm">
             <motion.div 
               initial={{ y: '100%' }}
               animate={{ y: 0 }}
               exit={{ y: '100%' }}
               className="bg-white rounded-[32px] w-full max-w-md p-8 pb-12 shadow-2xl relative"
             >
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-bold italic">Update Availability</h3>
                   <button onClick={() => setShowStatusModal(false)} className="p-2 text-slate-400"><X size={20} /></button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                   {[
                     { id: 'Available', color: 'emerald', label: 'Ready for Work', desc: 'Auto-accept job invitations' },
                     { id: 'Busy', color: 'amber', label: 'On a Break', desc: 'Pausing new requests temporarily' },
                     { id: 'Offline', color: 'stone', label: 'Go Offline', desc: 'Finish current work and disconnect' },
                   ].map(st => (
                     <button
                       key={st.id}
                       onClick={() => updateStatus(st.id as any)}
                       className={`flex items-center gap-4 p-5 rounded-2xl border text-left transition-all ${
                         partner?.availabilityStatus === st.id 
                           ? `bg-blue-700 border-blue-700 text-white shadow-xl` 
                           : `bg-white border-slate-100 hover:border-slate-200`
                       }`}
                     >
                       <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                         partner?.availabilityStatus === st.id ? 'bg-white/10' : `bg-slate-50 text-slate-400`
                       }`}>
                         <Zap size={20} className={partner?.availabilityStatus === st.id ? 'text-white' : ''} />
                       </div>
                       <div className="flex-1">
                          <p className="font-bold">{st.label}</p>
                          <p className={`text-[10px] font-medium ${partner?.availabilityStatus === st.id ? 'text-white/50' : 'text-slate-400'}`}>{st.desc}</p>
                       </div>
                       {partner?.availabilityStatus === st.id && <CheckCircle2 size={20} className="text-emerald-400" />}
                     </button>
                   ))}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
