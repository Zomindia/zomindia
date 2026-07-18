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
import UnifiedKYCForm from './partner/UnifiedKYCForm';
import { ShieldAlert, Lock } from 'lucide-react';
import { LoadingScreen } from './LoadingIndicator';
import { LogoHorizontal, LogoIcon } from './BrandLogo';
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
  const [activeTab, setActiveTab] = useState<'stats' | 'jobs' | 'wallet' | 'settings' | 'notifications' | 'offers' | 'amc-leads'>(initialTab === 'home' ? 'stats' : (initialTab as any));
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
  
  // Real-time kycStatus and onboarding modal states as instructed
  const [kycStatus, setKycStatus] = useState<string>(() => {
    const direct = (profile as any)?.kycStatus;
    const nested = (profile as any)?.partnerData?.kycStatus;
    return String(direct || nested || 'pending').toLowerCase().trim();
  });
  const [approvalStatus, setApprovalStatus] = useState<string>(() => {
    return (profile as any)?.approvalStatus || 'pending';
  });
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);
  const [showPendingAlert, setShowPendingAlert] = useState<boolean>(false);
  const [showKycForm, setShowKycForm] = useState<boolean>(false);
  const [countdownText, setCountdownText] = useState<string>("");

  // Active global background service that periodic/live updates coordinate markers in firebase
  const { lastSyncedAt, isTrackingActive } = useLocationTracking(partner?.id, bookings, partner?.availabilityStatus);

  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string>(() => {
    const local = localStorage.getItem(`partner_avatar_${profile.uid}`);
    return local || profile.photoURL || '';
  });

  useEffect(() => {
    const local = localStorage.getItem(`partner_avatar_${profile.uid}`);
    setCurrentPhotoUrl(local || profile.photoURL || '');
  }, [profile.photoURL, profile.uid]);

  useEffect(() => {
    const handleAvatarUpdated = (e: Event) => {
      const url = (e as CustomEvent)?.detail?.photoURL || '';
      if (url) {
        setCurrentPhotoUrl(url);
        profile.photoURL = url;
      }
    };
    window.addEventListener('partner-avatar-updated', handleAvatarUpdated);
    return () => window.removeEventListener('partner-avatar-updated', handleAvatarUpdated);
  }, [profile]);

  // Listen to open-kyc-modal event
  useEffect(() => {
    const handleOpenKyc = () => setShowKycForm(true);
    window.addEventListener('open-kyc-modal', handleOpenKyc);
    return () => window.removeEventListener('open-kyc-modal', handleOpenKyc);
  }, []);

  // Listen to show-partner-toast event
  useEffect(() => {
    const handleShowToast = (e: Event) => {
      const msg = (e as CustomEvent)?.detail?.message || '';
      if (msg) {
        setToastMessage(msg);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    };
    window.addEventListener('show-partner-toast', handleShowToast);
    return () => window.removeEventListener('show-partner-toast', handleShowToast);
  }, []);

  // Set up live countdown for grace period
  useEffect(() => {
    if (approvalStatus === 'approved' && partner?.gracePeriodEnd) {
      const updateTimer = () => {
        let targetMs = 0;
        const graceEnd = partner.gracePeriodEnd;
        if (typeof graceEnd === 'string') {
          targetMs = new Date(graceEnd).getTime();
        } else if (graceEnd?.seconds) {
          targetMs = graceEnd.seconds * 1000;
        } else if (graceEnd?.toDate) {
          targetMs = graceEnd.toDate().getTime();
        } else if (typeof graceEnd === 'number') {
          targetMs = graceEnd;
        } else {
          targetMs = new Date(graceEnd).getTime();
        }

        const diff = targetMs - Date.now();
        if (diff <= 0) {
          setCountdownText("KYC Overdue");
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setCountdownText(`${days}d ${hours}h ${mins}m`);
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 30000); // update every 30s
      return () => clearInterval(interval);
    }
  }, [approvalStatus, partner?.gracePeriodEnd]);

  // Set gracePeriodEnd if they are approved but don't have one
  useEffect(() => {
    if (approvalStatus === 'approved' && partner && !partner.gracePeriodEnd) {
      const gracePeriod = Timestamp.fromDate(new Date(Date.now() + 72 * 60 * 60 * 1000));
      const activeUid = profile.uid;
      updateDoc(doc(db, 'users', activeUid), {
        gracePeriodEnd: gracePeriod,
        "partnerData.gracePeriodEnd": gracePeriod
      }).catch(console.error);
      
      updateDoc(doc(db, 'partners', activeUid), {
        gracePeriodEnd: gracePeriod
      }).catch(console.error);
    }
  }, [approvalStatus, partner, profile.uid]);

  useEffect(() => {
    if (initialTargetId) {
      setTargetBookingId(initialTargetId);
      setActiveTab('jobs');
    }
  }, [initialTargetId]);

  // Sync to open congratulations onboarding modal and clear pending alerts on approved state change
  useEffect(() => {
    const statusLower = String(kycStatus || '').toLowerCase().trim();
    if (statusLower === 'approved' || statusLower === 'verified') {
      setShowPendingAlert(false); // instantly clear any pending alert popup
      const dismissed = sessionStorage.getItem('congrats_dismissed_' + profile.uid);
      if (!dismissed) {
        setShowOnboardingModal(true);
      }
    }
  }, [kycStatus, profile.uid]);

  const navigateWithTarget = (screen: any, targetId: string | null = null) => {
    // If screen is a top level app tab, use onAppNavigate
    if (onAppNavigate && (screen === 'admin' || screen === 'home')) {
       onAppNavigate(screen);
       return;
    }
    setTargetBookingId(targetId);
    setActiveTab(screen === 'home' ? 'stats' : screen);
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
      }, (err) => {
        setLoading(false);
      });
    };

    // Real-time Firestore listener tracking the logged-in partner's /users/{auth.currentUser.uid} document
    const fetchUserDocRealtime = () => {
      const activeUid = auth.currentUser?.uid || profile.uid;
      if (!activeUid) return () => {};

      return onSnapshot(doc(db, 'users', activeUid), (snap) => {
        if (snap.exists()) {
          const uData = snap.data();
          const pData = uData?.partnerData || {};
          const liveKyc = String(uData?.kycStatus || pData.kycStatus || 'pending').toLowerCase().trim();
          const liveApproval = uData?.approvalStatus || pData.approvalStatus || 'pending';
          const liveGracePeriodEnd = uData?.gracePeriodEnd || pData.gracePeriodEnd || null;
          
          setKycStatus(liveKyc);
          setApprovalStatus(liveApproval);

          if (liveKyc === "approved" || liveKyc === "verified") {
            console.log("[PartnerApp Realtime] KYC approval/verification detected live!");
            setPartner(prev => {
              const updated: PartnerProfile = {
                id: activeUid,
                userId: activeUid,
                isVerified: true,
                kycStatus: "approved",
                approvalStatus: liveApproval,
                gracePeriodEnd: liveGracePeriodEnd,
                status: (pData.status || "active") as any,
                availabilityStatus: pData.availabilityStatus || prev?.availabilityStatus || "Offline",
                bio: pData.bio || prev?.bio || "",
                categories: pData.categories || prev?.categories || [],
                skills: pData.skills || prev?.skills || [],
                city: pData.city || prev?.city || "Indore",
                phone: pData.phone || prev?.phone || "",
                email: pData.email || prev?.email || "",
                fullName: pData.fullName || prev?.fullName || "",
                rating: pData.rating !== undefined ? pData.rating : (prev?.rating || 4.9),
                reviewCount: pData.reviewCount !== undefined ? pData.reviewCount : (prev?.reviewCount || 0),
                onboardingCompleted: true,
                createdAt: pData.createdAt || prev?.createdAt,
                updatedAt: pData.updatedAt || prev?.updatedAt,
              };
              return updated;
            });
          } else {
            setPartner(prev => {
              if (!prev) {
                return {
                  id: activeUid,
                  userId: activeUid,
                  isVerified: false,
                  kycStatus: liveKyc as any,
                  approvalStatus: liveApproval,
                  gracePeriodEnd: liveGracePeriodEnd,
                  status: 'pending',
                  availabilityStatus: 'Offline',
                  bio: pData.bio || '',
                  categories: pData.categories || [],
                  skills: pData.skills || [],
                  city: pData.city || 'Indore',
                  phone: pData.phone || '',
                  email: pData.email || '',
                  fullName: pData.fullName || profile.displayName || '',
                  rating: 4.9,
                  reviewCount: 0,
                  createdAt: Timestamp.now(),
                  updatedAt: Timestamp.now()
                } as any;
              }
              return {
                ...prev,
                approvalStatus: liveApproval,
                gracePeriodEnd: liveGracePeriodEnd,
                ...pData
              };
            });
          }
        }
      }, (err) => {
        console.error("Error listening to user document in PartnerApp:", err);
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
    const unsubUserRealtime = fetchUserDocRealtime();
    const unsubBookings = fetchBookings();
    const unsubServices = fetchServices();
    const unsubUsers = fetchUsers();
    const unsubApplication = fetchApplication();
    
    return () => {
      unsubPartner();
      unsubUserRealtime();
      unsubBookings();
      unsubServices();
      unsubUsers();
      unsubApplication();
    };
  }, [profile.uid]);

  // Lock active screen to home if partner application is pending review
  useEffect(() => {
    if (!partner && application) {
      setActiveTab('stats');
    }
  }, [partner, application]);

  const updateStatus = async (status: 'Available' | 'Busy' | 'Offline') => {
    if (!partner) return;
    try {
      await updateDoc(doc(db, 'partners', partner.id), {
        availabilityStatus: status,
        isAvailable: status === 'Available',
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

  const renderScreen = () => {
    const homePartner = partner ? { ...partner, gracePeriodEnd: null } : null;
    switch (activeTab) {
      case 'stats':
        return <PartnerHome partner={homePartner as any} bookings={bookings} services={services} users={users} onNavigate={navigateWithTarget} profile={profile} application={application} />;
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
        return <PartnerHome partner={homePartner as any} bookings={bookings} services={services} users={users} onNavigate={navigateWithTarget} profile={profile} application={application} />;
    }
  };

  const hasUrgentPoolRequest = bookings.some(b => 
    b.status === 'pending' && 
    !b.partnerId && 
    (b.partnerPriority === 'high' || b.isPriority === true)
  );

  const navItems = (!partner && application) ? [] : [
    { id: 'stats', icon: BarChart3, label: 'Stats' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs' },
    { id: 'amc-leads', icon: Zap, label: 'AMC Leads' },
    { id: 'offers', icon: TicketPercent, label: 'Offers' },
  ];

  if (loading) {
    return <LoadingScreen message="Updating your jobs and clients..." />;
  }

  // 1. BLACKLISTED CHECK
  if (approvalStatus === 'blacklisted') {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex flex-col justify-between p-6 max-w-md mx-auto relative shadow-2xl overflow-hidden border-x border-slate-800 text-white">
        <header className="flex justify-between items-center py-4 select-none shrink-0">
          <div className="flex items-center gap-2 select-none">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-red-900 bg-red-950/20 p-1">
              <img src={LogoIcon} alt="Zomindia Icon" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col max-w-[100px]">
              <span className="text-xs font-black text-red-500 tracking-tight leading-none uppercase">ZOMINDIA</span>
              <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Security Block</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center text-center px-4 my-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-red-950/20 border border-red-900/30 rounded-3xl p-8 shadow-2xl space-y-6 flex flex-col items-center"
          >
            <div className="w-16 h-16 bg-red-900/20 text-red-500 border border-red-500/30 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
              <ShieldAlert size={36} />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-lg font-black text-red-400 tracking-tight leading-tight uppercase">ACCESS BLOCKED</h2>
              <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                This partner account has been blacklisted for quality or security violations in the Indore area.
              </p>
              <div className="p-4 bg-red-950/40 border border-red-900/40 rounded-2xl text-left mt-2">
                <p className="text-[11px] text-red-200 leading-relaxed font-black text-center uppercase tracking-wider">
                  Please contact your nearest branch - Zomindia Head Office, Indore at +91 8819991904.
                </p>
              </div>
            </div>
          </motion.div>
        </main>

        <footer className="py-4 text-center text-[9px] text-slate-600 font-bold uppercase tracking-wider select-none shrink-0">
          ZOMINDIA SECURE SYSTEM • INDORE
        </footer>
      </div>
    );
  }

  // 2. PENDING STATUS CHECK - Render actual dashboard instead of blocking screen (Read-Only Teaser Mode)
  // Replaced with conditional Welcome Training Video and action locks in sub-components

  // SCENARIO C (Approved)
  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden border-x border-slate-200 pb-20">
      <style>{`
        /* Hide the duplicate KYC banner card completely if rendered */
        .min-h-\\[100dvh\\] .bg-amber-500.text-slate-950.p-4.rounded-3xl {
          display: none !important;
        }

        /* Shrink PartnerHome general container padding and spacing */
        .min-h-\\[100dvh\\] .p-6.space-y-8 {
          padding: 1rem !important;
          gap: 1rem !important;
          display: flex !important;
          flex-direction: column !important;
        }
        
        /* Adjust spacing of space-y-8 children */
        .min-h-\\[100dvh\\] .p-6.space-y-8 > * {
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }

        /* Shrink Welcome header */
        .min-h-\\[100dvh\\] h2.text-2xl {
          font-size: 1.125rem !important; /* text-lg */
          line-height: 1.25rem !important;
        }
        
        .min-h-\\[100dvh\\] .text-\\[11px\\].text-slate-400 {
          font-size: 9px !important;
          margin-top: 2px !important;
        }

        /* Compact Stats cards: Side-by-side neat layout */
        .min-h-\\[100dvh\\] section.grid.grid-cols-2.gap-4 {
          gap: 0.5rem !important; /* gap-2 */
          display: grid !important;
          grid-template-cols: repeat(2, minmax(0, 1fr)) !important;
        }

        .min-h-\\[100dvh\\] section.grid.grid-cols-2.gap-4 > div {
          padding: 0.75rem !important; /* p-3 */
          border-radius: 1rem !important; /* rounded-2xl */
        }

        .min-h-\\[100dvh\\] section.grid.grid-cols-2.gap-4 .w-10.h-10 {
          width: 2rem !important;
          height: 2rem !important;
          margin-bottom: 0.5rem !important;
          border-radius: 0.5rem !important;
        }
        
        .min-h-\\[100dvh\\] section.grid.grid-cols-2.gap-4 .w-10.h-10 svg {
          width: 1rem !important;
          height: 1rem !important;
        }

        .min-h-\\[100dvh\\] section.grid.grid-cols-2.gap-4 .pt-4 {
          padding-top: 0.5rem !important;
          margin-top: 0.25rem !important;
        }

        .min-h-\\[100dvh\\] section.grid.grid-cols-2.gap-4 .text-3xl {
          font-size: 1.25rem !important; /* text-xl */
          line-height: 1.75rem !important;
        }
        
        .min-h-\\[100dvh\\] section.grid.grid-cols-2.gap-4 .text-\\[10px\\] {
          font-size: 8px !important;
        }
      `}</style>
      {/* Sticky Countdown Banner */}
      {kycStatus === 'pending' && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2.5 flex items-center justify-between text-left relative z-50 shadow-md">
          <div className="flex items-center gap-2">
            <Clock size={16} className="animate-pulse shrink-0 text-white" />
            <p className="text-[9px] leading-snug font-black tracking-wide uppercase">
              Partner, your KYC is pending. Please complete your verification within <span className="underline font-black text-yellow-100">{countdownText || "3 days"}</span> to keep your payouts active
            </p>
          </div>
          <button
            onClick={() => setShowKycForm(true)}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0 transition-all duration-150 active:scale-95 shadow-sm"
          >
            KYC NOW
          </button>
        </div>
      )}

      {/* Unified KYC Form Modal */}
      {showKycForm && (
        <UnifiedKYCForm 
          mode="online" 
          partnerId={partner?.id || profile?.partnerId || profile?.uid} 
          onClose={() => setShowKycForm(false)} 
          onSuccess={() => {
            setShowKycForm(false);
            setToastMessage("KYC Documents submitted for review successfully!");
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
          }} 
        />
      )}
      {/* App Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center transition-all select-none">
        <div className="flex flex-col shrink-0 select-none">
          <img src={LogoHorizontal} alt="Zomindia brand" className="h-4.5 w-auto object-contain object-left" referrerPolicy="no-referrer" />
          <span className="text-[7.5px] text-[#0a2540]/60 font-black uppercase tracking-widest leading-none mt-0.5">Partner App</span>
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
               className={`flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl border transition-all active:scale-95 shrink-0 ${activeTab === 'wallet' ? 'border-amber-500 bg-amber-50/20' : 'border-slate-100'}`}
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
             className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 border-2 transition-all shrink-0 ${activeTab === 'settings' ? 'border-[#22c55e] ring-2 ring-[#22c55e]/15' : 'border-slate-200'}`}
           >
              {currentPhotoUrl && (currentPhotoUrl.startsWith('http') || currentPhotoUrl.startsWith('data:image')) && !currentPhotoUrl.includes('googleusercontent.com/image_collection') ? (
                <img src={currentPhotoUrl} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                <UserIcon size={14} className="text-slate-500 mx-auto" />
              )}
           </button>
           <button 
             onClick={() => {
               if (approvalStatus === 'pending') {
                 window.dispatchEvent(new CustomEvent('show-partner-toast', { 
                   detail: { message: 'Action locked. Waiting for Admin approval.' } 
                 }));
                 return;
               }
               setShowStatusModal(true);
             }}
             className={`px-2 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border transition-all shrink-0 ${
               partner?.availabilityStatus === 'Available' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
               partner?.availabilityStatus === 'Busy' ? 'bg-amber-50 text-amber-600 border-amber-100' :
               'bg-slate-100 text-slate-500 border-slate-200'
             }`}
           >
             {partner?.availabilityStatus === 'Available' && isTrackingActive ? (
               <span className="relative flex h-1.5 w-1.5 shrink-0">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
               </span>
             ) : (
               <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                 partner?.availabilityStatus === 'Available' ? 'bg-emerald-500 animate-pulse' :
                 partner?.availabilityStatus === 'Busy' ? 'bg-amber-500' : 'bg-slate-400'
               }`} />
             )}
             {partner?.availabilityStatus || 'Offline'}
           </button>
        </div>
      </header>

      {/* Screen Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
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

      {/* Bottom Tab Bar - Solid and Aligned at the absolute bottom */}
      {!(!partner && application) && (
        <div className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto z-50 bg-white border-t border-slate-200/80 shadow-[0_-8px_24px_rgba(0,0,0,0.05)] pb-safe">
          <div className="flex items-center justify-around p-2">
            {navItems.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => navigateWithTarget(tab.id as any)}
                  className="relative flex flex-col items-center justify-center pt-1 pb-1 transition-all flex-1"
                >
                  <div className={`relative p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'text-blue-700 bg-blue-50/80 font-bold scale-105' : 'text-slate-400 active:scale-95 hover:text-slate-600'}`}>
                    {tab.id === 'jobs' && hasUrgentPoolRequest && !isActive && (
                      <>
                        <motion.span
                          className="absolute inset-0 rounded-xl bg-amber-500/30 pointer-events-none"
                          animate={{
                            scale: [1, 2],
                            opacity: [0.7, 0],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 2,
                            ease: "easeOut",
                          }}
                        />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full border-2 border-white animate-pulse" />
                      </>
                    )}
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? 'text-blue-700 opacity-100' : 'text-slate-400 opacity-60'}`}>
                    {tab.label}
                  </span>
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
               className="bg-white rounded-t-[32px] rounded-b-[24px] sm:rounded-[32px] w-full max-w-md p-6 sm:p-8 pb-10 sm:pb-12 shadow-2xl relative max-h-[85dvh] overflow-y-auto"
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

      {/* SCENARIO B (Approved + Onboarding Modal Active): overlay a beautiful Tailwind modal with a dark backdrop (bg-black/60) */}
      <AnimatePresence>
        {showOnboardingModal && (
          <div 
            id="partner-kyc-onboarding-modal"
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -15 }}
              className="w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100 flex flex-col text-center"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-sm text-2xl">
                🎉
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight mb-3">Congratulations! 🎉</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-8">
                Your profile is digitally approved. To fully activate your account and accept live bookings, please visit the Zomindia Indore branch to complete physical onboarding.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    sessionStorage.setItem('congrats_dismissed_' + profile.uid, 'true');
                    setShowOnboardingModal(false);
                  }}
                  className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-700/10 active:scale-95 cursor-pointer"
                >
                  I'll Visit Soon
                </button>
                <button
                  onClick={() => {
                    sessionStorage.setItem('congrats_dismissed_' + profile.uid, 'true');
                    setShowOnboardingModal(false);
                  }}
                  className="w-full py-2.5 text-slate-500 hover:text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all active:scale-95 cursor-pointer"
                >
                  Skip for Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
