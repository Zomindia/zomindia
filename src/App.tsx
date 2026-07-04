/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, getDocs, setDoc, updateDoc, Timestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile, UserRole, Booking, Service, Category, COMPANY_NAME, PartnerApplication } from './types';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { seedDatabase } from './lib/seed';
import { buildDualPersonaUserDoc } from './lib/user-schema';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  Building2,
  Search,
  Calendar,
  User as UserIcon,
  ShieldCheck,
  Menu,
  X,
  LayoutDashboard,
  ChevronRight,
  Bell,
  History,
  TicketPercent,
  Settings,
  Zap,
  MessageSquare,
  Mail,
  RefreshCw,
  Download,
  Cpu,
  Sparkles,
  AlertTriangle,
  Copy,
  Check,
  Pencil
} from 'lucide-react';

// Modules
import CustomerHome from './components/CustomerHome';
import Avatar from './components/Avatar';
import { LoadingScreen } from './components/LoadingIndicator';
import NotificationSystem from './components/NotificationSystem';
import AuthModal from './components/AuthModal';
import BottomNav from './components/BottomNav';
import OfflineSyncIndicator from './components/OfflineSyncIndicator';
import { CitySelector } from './components/CitySelector';

// Lazy loaded sub-views for ultra-fast loading speed (under 1 second)
const CustomerDashboard = lazy(() => import('./components/CustomerDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const SignUpAsPartner = lazy(() => import('./components/SignUpAsPartner'));
const StaticPage = lazy(() => import('./components/StaticPage'));
const ProfileSettings = lazy(() => import('./components/ProfileSettings'));
const ServiceDetails = lazy(() => import('./components/ServiceDetails'));
const NotificationsView = lazy(() => import('./components/NotificationsView'));
const OffersView = lazy(() => import('./components/OffersView'));
const PartnerApp = lazy(() => import('./components/PartnerApp'));
const PartnerPortalLanding = lazy(() => import('./components/partner/PartnerPortalLanding'));
const CustomerAmcView = lazy(() => import('./components/CustomerAmcView'));
const SupportTicketsView = lazy(() => import('./components/SupportTicketsView'));
const AiSupportChat = lazy(() => import('./components/AiSupportChat'));
const WalletView = lazy(() => import('./components/WalletView'));
const ReferralsView = lazy(() => import('./components/ReferralsView'));

import ElitePartnerModal from './components/ElitePartnerModal';

import { useTranslation } from './lib/i18n';
import { useKeyboardFriendlyInputs } from './hooks/useKeyboardFriendlyInputs';

import LogoHorizontal from './assets/logo-horizontal.png';
import LogoIcon from './assets/logo-icon.png';

const teamMember1Img = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400";
const teamMember2Img = "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400";

const Logo = ({ size = 20, className = "" }: { size?: number, light?: boolean, className?: string, src?: string }) => {
  const heightStyle = size && !className ? { height: size * 1.6 } : undefined;

  return (
    <div
      className={`relative flex items-center justify-start select-none ${className}`}
      style={heightStyle}
    >
      <img
        src={LogoHorizontal}
        alt="ZOMINDIA LOGO"
        className="h-full w-auto max-w-full object-contain transition-all duration-300"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

const MobileNavItem = ({ onClick, label, isActive, index }: { onClick: () => void, label: string, isActive: boolean, index: number, key?: any }) => (
  <motion.button
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    whileHover={{ scale: 1.02, x: 5 }}
    whileTap={{ scale: 0.98 }}
    transition={{ 
      delay: index * 0.05, 
      type: "spring", 
      stiffness: 300, 
      damping: 20 
    }}
    onClick={onClick}
    className={`w-full text-left py-4 px-6 rounded-2xl font-bold flex items-center justify-between group transition-all cursor-pointer ${isActive ? 'bg-blue-700 text-white shadow-xl shadow-blue-700/10' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-700'}`}
  >
    <span className="tracking-tight">{label}</span>
    <ChevronRight size={16} className={`transition-transform ${isActive ? 'translate-x-0' : '-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'}`} />
  </motion.button>
);

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

function isVersionHigher(newVer: string, oldVer: string): boolean {
  const parts1 = newVer.split('.').map(num => parseInt(num, 10) || 0);
  const parts2 = oldVer.split('.').map(num => parseInt(num, 10) || 0);
  
  const maxLength = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLength; i++) {
    const val1 = parts1[i] || 0;
    const val2 = parts2[i] || 0;
    if (val1 > val2) return true;
    if (val1 < val2) return false;
  }
  return false;
}

export type ActiveTabType = 'home' | 'bookings' | 'profile' | 'admin' | 'partner' | 'partner-signup' | 'about' | 'contact' | 'help' | 'terms' | 'privacy' | 'refund' | 'service-details' | 'notifications' | 'offers' | 'tickets' | 'wallet' | 'amcs' | 'referrals';

export const getTabFromUrl = (): ActiveTabType => {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname;
  if (path === '/about-us') return 'about';
  if (path === '/contact-us') return 'contact';
  if (path === '/privacy-policy') return 'privacy';
  if (path === '/terms-and-conditions' || path === '/terms-of-service') return 'terms';
  if (path === '/refund-policy' || path === '/cancellation-and-refund') return 'refund';
  if (path === '/help-center' || path === '/help') return 'help';

  const hash = window.location.hash.replace('#', '');
  if (hash === 'about-us' || hash === 'about') return 'about';
  if (hash === 'contact-us' || hash === 'contact') return 'contact';
  if (hash === 'privacy-policy' || hash === 'privacy') return 'privacy';
  if (hash === 'terms-and-conditions' || hash === 'terms-of-service' || hash === 'terms') return 'terms';
  if (hash === 'refund-policy' || hash === 'cancellation-and-refund' || hash === 'refund') return 'refund';
  if (hash === 'help-center' || hash === 'help') return 'help';
  return (hash as ActiveTabType) || 'home';
};

export default function App() {
  useKeyboardFriendlyInputs();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [partnerApplication, setPartnerApplication] = useState<PartnerApplication | null>(null);
  const [showPartnerStatusPopup, setShowPartnerStatusPopup] = useState(true);
  const [isCitySelectorOpen, setIsCitySelectorOpen] = useState(false);
  const [selectedCity, setSelectedCityState] = useState<string>(() => {
    return localStorage.getItem('selectedCity') || 'Indore';
  });

  const handleSelectCity = async (city: string) => {
    setSelectedCityState(city);
    localStorage.setItem('selectedCity', city);
    if (profile && profile.uid) {
      try {
        await updateDoc(doc(db, "users", profile.uid), { city });
        setProfile({ ...profile, city });
      } catch (err) {
        console.error("[Profile City Update Error]:", err);
      }
    }
  };

  useEffect(() => {
    if (profile?.city) {
      setSelectedCityState(profile.city);
      localStorage.setItem('selectedCity', profile.city);
    }
  }, [profile?.city]);

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<ActiveTabType>(() => getTabFromUrl());
  const [targetBookingId, setTargetBookingId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [systemUpdate, setSystemUpdate] = useState<{ reason: string } | null>(null);
  const [pendingVersion, setPendingVersion] = useState<string | null>(null);
  const [skippedUpdate, setSkippedUpdate] = useState<{ reason: string, version?: string | null } | null>(null);
  const update90SecTimer = useRef<any>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [updateStep, setUpdateStep] = useState<string>('');
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const [currentMode, setCurrentModeState] = useState<'customer' | 'partner'>(
    () => (localStorage.getItem('zomindia_current_mode') as 'customer' | 'partner') || 'customer'
  );

  useEffect(() => {
    if (profile) {
      const mode = profile.currentMode || (profile.role === 'partner' ? 'partner' : 'customer');
      setCurrentModeState(mode);
    } else {
      setCurrentModeState('customer');
    }
  }, [profile?.uid, profile?.currentMode, profile?.role]);

  const handleSwitchMode = async (newMode: 'customer' | 'partner') => {
    if (!profile) return;
    
    // Switch requires a partner role, admin role, or valid partnerId
    if (newMode === 'partner' && profile.role !== 'partner' && profile.role !== 'admin' && !profile.partnerId) {
      alert("Only registered partners can switch to Partner Mode.");
      return;
    }
    
    setCurrentModeState(newMode);
    localStorage.setItem('zomindia_current_mode', newMode);
    
    try {
      await updateDoc(doc(db, "users", profile.uid), {
        currentMode: newMode,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      console.error("Error switching mode in Firestore:", err);
    }
  };

  // Initialize app version cache on start
  useEffect(() => {
    if (!localStorage.getItem('app_version')) {
      localStorage.setItem('app_version', '1.0.0');
    }
  }, []);

  // Elite Partner Modal Custom Event Listener
  useEffect(() => {
    const handleOpenPartnerModal = () => setIsPartnerModalOpen(true);
    window.addEventListener('open-partner-modal', handleOpenPartnerModal);
    return () => window.removeEventListener('open-partner-modal', handleOpenPartnerModal);
  }, []);

  // Dropdown reference and outside click handler
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Selection copying states
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    // Expose a global copy toast helper for other components to trigger
    (window as any).__showCopyToast = (text: string) => {
      setToastMessage(`Copied: "${text.length > 30 ? text.slice(0, 30) + '...' : text}"`);
    };
    (window as any).__showToast = (msg: string) => {
      setToastMessage(msg);
    };
    
    return () => {
      delete (window as any).__showCopyToast;
      delete (window as any).__showToast;
    };
  }, []);

  const triggerSystemUpdate = (reason: string, version?: string | null) => {
    setSystemUpdate({ reason });
    if (version) {
      setPendingVersion(version);
    } else {
      setPendingVersion(null);
    }
    setSkippedUpdate(null);
  };

  useEffect(() => {
    let isInitialServices = true;
    const unsubServices = onSnapshot(collection(db, 'services'), (snap) => {
      setAllServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
      if (isInitialServices) {
        isInitialServices = false;
      } else {
        const changes = snap.docChanges();
        if (changes.some(c => c.type === 'modified' || c.type === 'added' || c.type === 'removed')) {
          triggerSystemUpdate("System content update: Advanced service pricing or description modifications were made live.");
        }
      }
    }, (err) => console.error("Error subscribing to services in App.tsx:", err));

    let isInitialCategories = true;
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snap) => {
      setAllCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
      if (isInitialCategories) {
        isInitialCategories = false;
      } else {
        const changes = snap.docChanges();
        if (changes.some(c => c.type === 'modified' || c.type === 'added' || c.type === 'removed')) {
          triggerSystemUpdate("Ecosystem Category update: Category settings or catalog modifications made live.");
        }
      }
    }, (err) => console.error("Error subscribing to categories in App.tsx:", err));

    return () => {
      unsubServices();
      unsubCategories();
    };
  }, []);

  const mostRecentAppService = (() => {
    if (!allServices || allServices.length === 0) return null;
    return [...allServices].sort((a, b) => {
      const timeA = a.createdAt?.seconds || a.createdAt?._seconds || 0;
      const timeB = b.createdAt?.seconds || b.createdAt?._seconds || 0;
      return timeB - timeA;
    })[0];
  })();

  const recentAppCategory = mostRecentAppService && allCategories.length > 0
    ? allCategories.find(c => c.id === mostRecentAppService.categoryId)
    : null;

  // Sync state with hash and handle popstate for browser back button
  const setActiveTab = (tab: typeof activeTab, bIdOrCategoryId: string | null = null) => {
    setActiveTabState(tab);
    if (tab === 'home') {
      setSelectedCategoryId(bIdOrCategoryId);
    } else {
      setTargetBookingId(bIdOrCategoryId);
    }
  };

  useEffect(() => {
    if (activeTab) {
      const path = window.location.pathname;
      const hash = window.location.hash.replace('#', '');

      const publicPaths: Record<string, string> = {
        'about': '/about-us',
        'contact': '/contact-us',
        'privacy': '/privacy-policy',
        'terms': '/terms-and-conditions',
        'refund': '/refund-policy',
        'help': '/help-center'
      };

      const targetPath = publicPaths[activeTab];
      if (targetPath) {
        if (path !== targetPath) {
          window.history.pushState(null, '', targetPath);
        }
      } else {
        const isPublicPath = Object.values(publicPaths).includes(path);
        const resolvedPath = isPublicPath ? '/' : path;
        
        if (activeTab === 'home' && isPublicPath) {
          window.history.pushState(null, '', '/#home');
        } else if (hash !== activeTab) {
          window.history.pushState(null, '', `${resolvedPath === '/' ? '' : resolvedPath}#${activeTab}`);
        }
      }
      localStorage.setItem('zomindia_last_active_tab', activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedCategoryId) {
      localStorage.setItem('zomindia_last_selected_category_id', selectedCategoryId);
    } else {
      localStorage.removeItem('zomindia_last_selected_category_id');
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    if (targetBookingId) {
      localStorage.setItem('zomindia_last_target_booking_id', targetBookingId);
    } else {
      localStorage.removeItem('zomindia_last_target_booking_id');
    }
  }, [targetBookingId]);

  useEffect(() => {
    if (selectedServiceId) {
      localStorage.setItem('zomindia_last_selected_service_id', selectedServiceId);
    } else {
      localStorage.removeItem('zomindia_last_selected_service_id');
    }
  }, [selectedServiceId]);

  useEffect(() => {
    const handleUrlChange = () => {
      const tab = getTabFromUrl();
      setActiveTabState(tab);
    };

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    const hasSpecificRoute = window.location.pathname !== '/' || !!window.location.hash;
    if (!hasSpecificRoute && isStandalone) {
      const savedTab = localStorage.getItem('zomindia_last_active_tab') as typeof activeTab | null;
      const savedCatId = localStorage.getItem('zomindia_last_selected_category_id');
      const savedBookingId = localStorage.getItem('zomindia_last_target_booking_id');
      const savedServiceId = localStorage.getItem('zomindia_last_selected_service_id');

      if (savedTab) {
        setActiveTabState(savedTab);
        if (savedCatId) setSelectedCategoryId(savedCatId);
        if (savedBookingId) setTargetBookingId(savedBookingId);
        if (savedServiceId) setSelectedServiceId(savedServiceId);
      }
    }

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);



  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, behavior: 'instant' });

    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.documentElement.scrollTo({ top: 0, behavior: 'instant' });
      document.body.scrollTo({ top: 0, behavior: 'instant' });

      const scrollContainers = document.querySelectorAll('.overflow-y-auto');
      scrollContainers.forEach(container => {
        container.scrollTo({ top: 0, behavior: 'instant' });
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [activeTab, selectedServiceId]);

  useEffect(() => {
    let isDown = false;
    let startX: number;
    let scrollLeft: number;
    let activeContainer: HTMLElement | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.no-scrollbar') as HTMLElement;
      if (!target) return;

      const targetTag = (e.target as HTMLElement).tagName;
      if (targetTag === 'BUTTON' || targetTag === 'INPUT' || targetTag === 'A' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') return;
      if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;

      isDown = true;
      activeContainer = target;
      activeContainer.style.cursor = 'grabbing';
      activeContainer.style.userSelect = 'none';
      startX = e.pageX - activeContainer.offsetLeft;
      scrollLeft = activeContainer.scrollLeft;
    };

    const handleMouseLeaveAndUp = () => {
      if (!isDown || !activeContainer) return;
      isDown = false;
      activeContainer.style.cursor = '';
      activeContainer.style.removeProperty('user-select');
      activeContainer = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown || !activeContainer) return;
      e.preventDefault();
      const x = e.pageX - activeContainer.offsetLeft;
      const walk = (x - startX) * 1.5;
      activeContainer.scrollLeft = scrollLeft - walk;
    };

    const handleWheel = (e: WheelEvent) => {
      const target = (e.target as HTMLElement).closest('.no-scrollbar') as HTMLElement;
      if (!target) return;

      if (target.scrollWidth > target.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        target.scrollBy({ left: e.deltaY * 0.8, behavior: 'auto' });
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseleave', handleMouseLeaveAndUp);
    window.addEventListener('mouseup', handleMouseLeaveAndUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseleave', handleMouseLeaveAndUp);
      window.removeEventListener('mouseup', handleMouseLeaveAndUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasActiveArrival, setHasActiveArrival] = useState(false);

  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [verificationFeedbackError, setVerificationFeedbackError] = useState<string | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // 60-Second Cooldown Timer effect for spam prevention
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Real-time Background Polling to auto-detect verified links without requiring a refresh
  useEffect(() => {
    if (!user || user.emailVerified) return;

    const intervalId = setInterval(async () => {
      try {
        await user.reload();
        const updatedUser = auth.currentUser;
        if (updatedUser && updatedUser.emailVerified) {
          setUser({ ...updatedUser } as any);
          setVerificationFeedback("Email verified successfully! Opening your dashboard...");
          setTimeout(() => setVerificationFeedback(null), 6000);
        }
      } catch (err) {
        console.debug("Silent user status verification reload:", err);
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [user?.uid, user?.emailVerified]);

  useEffect(() => {
    seedDatabase();
    let unsubscribeBookings = () => {};
    let unsubscribeProfile = () => {};
    let unsubscribePartnerApp = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      unsubscribeProfile();
      unsubscribeBookings();
      unsubscribePartnerApp();

      if (u) {
        // Real-time listener for partner applications
        unsubscribePartnerApp = onSnapshot(doc(db, 'partner_applications', u.uid), (snapApp) => {
          if (snapApp.exists()) {
            setPartnerApplication({ id: snapApp.id, ...snapApp.data() } as PartnerApplication);
          } else {
            setPartnerApplication(null);
          }
        }, (err) => {
          console.error("Error subscribing to partner application:", err);
        });

        // Native Push Registration trigger
        try {
          const { registerPushNotifications } = await import('./lib/push-notifications');
          registerPushNotifications(u.uid);
        } catch (e) {
          console.error("Push registration trigger failed:", e);
        }

        // Dynamic Mobile-Number Based Profile Resolution & Merge
        const resolveAndSubscribeProfile = async () => {
          let resolvedUid = u.uid;
          let targetPhone = u.phoneNumber || '';
          
          // Helper to find document by phone number
          const findProfileByPhone = async (phone: string) => {
            if (!phone) return null;
            const clean = phone.replace(/\D/g, '');
            const last10 = clean.slice(-10);
            if (last10.length !== 10) return null;
            const formats = [`+91${last10}`, last10];
            for (const fmt of formats) {
              const q1 = query(collection(db, 'users'), where('phoneNumber', '==', fmt));
              const q2 = query(collection(db, 'users'), where('mobile', '==', fmt));
              const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
              if (!snap1.empty) return snap1.docs[0];
              if (!snap2.empty) return snap2.docs[0];
            }
            return null;
          };

          // 1. Check if there's an existing document by phone number
          let existingDoc = await findProfileByPhone(targetPhone);
          
          // 2. If not found by phone, but email exists, search by email
          if (!existingDoc && u.email) {
            const q3 = query(collection(db, 'users'), where('email', '==', u.email.toLowerCase().trim()));
            const snap3 = await getDocs(q3);
            if (!snap3.empty) {
              existingDoc = snap3.docs[0];
            }
          }

          if (existingDoc) {
            resolvedUid = existingDoc.id;
            console.log(`[Auth Resolution] Resolved authenticated user ${u.uid} to existing document ${resolvedUid}`);
            
            // Merge Google / new Auth info directly into existing master document
            const existingData = existingDoc.data();
            const mergedPayload: any = buildDualPersonaUserDoc({
              ...existingData,
              uid: resolvedUid,
              email: u.email || existingData.email || '',
              phoneNumber: u.phoneNumber || existingData.phoneNumber || existingData.mobile || '',
              mobile: u.phoneNumber || existingData.mobile || existingData.phoneNumber || '',
              displayName: u.displayName && u.displayName !== 'User' ? u.displayName : (existingData.displayName || 'User'),
              fullName: u.displayName && u.displayName !== 'User' ? u.displayName : (existingData.fullName || 'User'),
              onboardingComplete: true,
              updatedAt: Timestamp.now()
            });

            await setDoc(doc(db, 'users', resolvedUid), mergedPayload, { merge: true });

            // If the active auth UID is different from resolvedUid, write a link pointer under u.uid to avoid duplicates
            if (u.uid !== resolvedUid) {
              await setDoc(doc(db, 'users', u.uid), {
                uid: u.uid,
                mergedInto: resolvedUid,
                onboardingComplete: false,
                updatedAt: Timestamp.now()
              }, { merge: true });
            }
          } else {
            // New user, create the document under u.uid
            const userDocRef = doc(db, 'users', u.uid);
            const userSnap = await getDoc(userDocRef);
            if (!userSnap.exists()) {
              const isAdminUser = u.email?.toLowerCase().trim() === 'sarthakwebtech@gmail.com';
              const newProfile: any = buildDualPersonaUserDoc({
                uid: u.uid,
                displayName: u.displayName || 'User',
                fullName: u.displayName || 'User',
                email: u.email || '',
                phoneNumber: u.phoneNumber || '',
                mobile: u.phoneNumber || '',
                role: isAdminUser ? 'admin' : 'customer',
                photoURL: u.photoURL || '',
                referralCode: `ZOM${u.uid.slice(0, 6).toUpperCase()}`,
                walletBalance: 100, // ₹100 Welcome Bonus on registration!
                notificationPreferences: {
                  bookingUpdates: true,
                  promotionalMessages: true
                },
                createdAt: Timestamp.now() as any,
              });
              if (isAdminUser) {
                newProfile.adminSubRole = 'head';
              }
              await setDoc(userDocRef, newProfile);
            }
          }

          // Subscribe to the resolved master UID!
          const masterDocRef = doc(db, 'users', resolvedUid);
          unsubscribeProfile = onSnapshot(masterDocRef, async (snap) => {
            if (!snap.exists()) return;
            let currentProfile = snap.data() as UserProfile;

            // Follow mergedInto pointer if any
            if (currentProfile.mergedInto && currentProfile.mergedInto !== resolvedUid) {
              console.log(`[Auth Resolution Snapshot] Redirecting to merged master: ${currentProfile.mergedInto}`);
              unsubscribeProfile();
              // Re-subscribe to merged master
              const mergedDocRef = doc(db, 'users', currentProfile.mergedInto);
              unsubscribeProfile = onSnapshot(mergedDocRef, (mergedSnap) => {
                if (mergedSnap.exists()) {
                  const p = mergedSnap.data() as UserProfile;
                  setProfile({ ...p, uid: currentProfile.mergedInto } as UserProfile);
                }
              });
              return;
            }

            // Normalise the profile to contain customerData and (if partner) partnerData
            const needsNormalization = 
              !currentProfile.customerData || 
              !currentProfile.currentMode ||
              (currentProfile.isPartner === true && !currentProfile.partnerData);

            if (needsNormalization) {
              const normalized = buildDualPersonaUserDoc(currentProfile);
              updateDoc(masterDocRef, normalized).catch(e => console.error("Error normalizing user profile:", e));
              currentProfile = normalized as UserProfile;
            }

            const isAdminUser = u.email?.toLowerCase().trim() === 'sarthakwebtech@gmail.com' ||
                                currentProfile?.email?.toLowerCase().trim() === 'sarthakwebtech@gmail.com';

            let userRole: UserRole = currentProfile?.role || 'customer';

            if (isAdminUser && (userRole !== 'admin' || currentProfile?.adminSubRole !== 'head')) {
              userRole = 'admin';
              updateDoc(masterDocRef, { role: 'admin', adminSubRole: 'head' }).catch(e => console.error("Admin sync failed", e));
            }

            const profileUpdate: any = {
              ...currentProfile,
              uid: resolvedUid,
              role: userRole
            };
            if (isAdminUser || currentProfile?.adminSubRole) {
              profileUpdate.adminSubRole = isAdminUser ? 'head' : currentProfile.adminSubRole;
            }
            setProfile(profileUpdate as UserProfile);

            // Forced redirection for admin / partner
            const currentHash = window.location.hash.replace('#', '');
            if (userRole === 'admin' && (currentHash === 'home' || !currentHash || currentHash === 'partner-signup')) {
              setActiveTab('admin');
            } else if (userRole === 'partner' && (currentHash === 'home' || !currentHash)) {
              setActiveTab('partner');
            }

            // Global Active Booking Listener
            unsubscribeBookings();
            const q = query(
              collection(db, 'bookings'),
              where(userRole === 'partner' ? 'partnerId' : 'customerId', '==', resolvedUid),
              where('status', 'in', ['confirmed', 'assigned', 'ASSIGNED', 'on_the_way', 'arrived', 'in_progress', 'payment_pending', 'pending_parts'])
            );
            unsubscribeBookings = onSnapshot(q, (snapB) => {
              setHasActiveArrival(!snapB.empty);
            }, (err) => {
              console.error("Error subscribing to active bookings:", err);
            });
          });
        };

        resolveAndSubscribeProfile().catch(e => console.error("Error in resolveAndSubscribeProfile:", e));

      } else {
        setProfile(null);
        setHasActiveArrival(false);
        setPartnerApplication(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeBookings();
      unsubscribeProfile();
      unsubscribePartnerApp();
    };
  }, []);

  // Generic live pipeline listener for system-critical backend force-reloads (Permanently Deprecated)
  useEffect(() => {
    const updatesColRef = collection(db, 'system_updates');

    const unsubscribeSystemUpdates = onSnapshot(updatesColRef, (snapshot) => {
      // Logic bypassed to permanently prevent blocking promotional update alerts
      console.log("Ecosystem update system check bypassed.");
    }, (error) => {
      console.warn("Firestore 'system_updates' subscription bypassed:", error);
    });

    return () => unsubscribeSystemUpdates();
  }, [skippedUpdate]);

  // 90 second interval re-prompt if update dismissed but not yet updated (Permanently Deprecated)
  useEffect(() => {
    // Reprompt logic bypassed to permanently prevent blocking promotional update alerts
  }, [skippedUpdate]);

  const handleSkipUpdate = () => {
    if (systemUpdate) {
      setSkippedUpdate({ ...systemUpdate, version: pendingVersion });
    }
    setSystemUpdate(null);
  };

  const handleStartUpdateProgress = () => {
    setSkippedUpdate(null);
    setUpdateProgress(0);
    setUpdateStep('Loading new updates...');

    let current = 0;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 15) + 5;
      if (current >= 100) {
        current = 100;
        setUpdateProgress(100);
        setUpdateStep('Completing update...');
        clearInterval(interval);
        setTimeout(() => {
          if (pendingVersion) {
            localStorage.setItem('app_version', pendingVersion);
          } else {
            localStorage.setItem('app_version', `1.0.${Math.floor(Date.now() / 1000)}`);
          }
          window.location.reload();
        }, 600);
      } else {
        setUpdateProgress(current);
        if (current < 25) {
          setUpdateStep('Downloading updates...');
        } else if (current < 55) {
          setUpdateStep('Checking connection...');
        } else if (current < 85) {
          setUpdateStep('Updating service list...');
        } else {
          setUpdateStep('Almost done...');
        }
      }
    }, 200);
  };

  if (!hasValidKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-slate-200 border border-slate-100">
          <Logo size={32} />
          <h2 className="text-2xl font-black text-slate-900 mt-8 mb-4 tracking-tighter italic">API Key Required</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            To enable location services and visual address selection, please add your Google Maps API key.
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <p className="text-xs text-slate-600">Get an API key from the <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noopener" className="text-slate-900 font-bold underline">Google Cloud Console</a></p>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <p className="text-xs text-slate-600">Open <strong>Settings</strong> (⚙️ icon) → <strong>Secrets</strong></p>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <p className="text-xs text-slate-600">Add <code>GOOGLE_MAPS_PLATFORM_KEY</code> and paste your key</p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 mt-1" />
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest leading-normal">
              The app will rebuild automatically once the key is added.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen message="Connecting to secure zomindia console..." />;
  }

  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-rose-50 text-rose-600 p-8 rounded-[32px] max-w-sm border border-rose-100 shadow-xl">
          <Logo size={24} />
          <h2 className="text-xl font-bold mt-6 mb-2">Auth Sync Error</h2>
          <p className="text-xs opacity-70 mb-8 leading-relaxed italic">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-blue-700 text-white rounded-2xl font-bold hover:bg-blue-800 transition-all"
          >
            Retry Login
          </button>
        </div>
      </div>
    );
  }

  const getNavLinks = () => [
    { id: 'home', label: 'Home', roles: ['customer', 'partner', 'admin'] as UserRole[] },
    { id: 'offers', label: 'Offers', roles: ['customer', 'partner', 'admin', 'anon'] as UserRole[] },
    { id: 'referrals', label: 'Refer & Earn', roles: ['customer', 'anon', 'admin'] as UserRole[] },
    { id: 'bookings', label: 'Bookings', roles: ['customer', 'partner', 'admin'] as UserRole[] },
    { id: 'amcs', label: 'AMC', roles: ['customer', 'admin'] as UserRole[] },
    { id: 'notifications', label: 'Notifications', roles: ['customer', 'partner', 'admin'] as UserRole[] },
    { id: 'profile', label: 'Settings', roles: ['customer', 'partner', 'admin'] as UserRole[] },
    { id: 'partner', label: 'Partner Dashboard', roles: ['partner', 'admin'] as UserRole[] },
    { id: 'admin', label: 'Admin Panel', roles: ['admin'] as UserRole[] },

  ];

  const renderNavigation = () => {
    return (
      <div className="hidden md:flex items-center gap-8 justify-center flex-1">
        {['home', 'offers', 'bookings'].map(id => {
          const link = getNavLinks().find(l => l.id === id);
          if (!link) return null;
          return (
            <motion.button
              key={link.id}
              onClick={() => setActiveTab(link.id as any)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={`text-sm font-semibold transition-all relative py-1 focus:outline-none cursor-pointer ${activeTab === link.id ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-blue-700'}`}
            >
              {link.label}
              {activeTab === link.id && (
                <motion.div 
                  layoutId="nav-underline" 
                  className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-blue-700"
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    );
  };

  const renderPartnerNotificationBanner = () => {
    if (!profile || currentMode !== 'customer') return null;

    // 1. Pending Banner
    if (partnerApplication && partnerApplication.status === 'pending') {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#F8FAFC] border-l-4 border-[#C5A021] rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-[#C5A021]/20 flex items-center justify-center shrink-0 text-[#C5A021] mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Elite Partner Application</h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 text-[#C5A021] border border-[#C5A021]/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C5A021] animate-pulse" />
                    Pending Review
                  </span>
                </div>
                <p className="text-xs text-[#334155] mt-1">
                  Hi {partnerApplication.fullName || 'there'}, your onboarding profile for {partnerApplication.serviceType} is being verified by our Indore admin panel.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowPartnerStatusPopup(true)}
                className="px-4 py-2 bg-[#1B4D3E]/10 hover:bg-[#1B4D3E]/20 text-[#1B4D3E] text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
              >
                Track Live Status
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    // 2. Approved Banner
    if (profile.partnerApplicationStatus === 'approved') {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#F8FAFC] border-l-4 border-emerald-500 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-600 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Elite Partner Approved</h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200">
                    Approved
                  </span>
                </div>
                <p className="text-xs text-[#334155] mt-1">
                  Congratulations! Your application has been approved. Switch to Partner Mode to view your jobs and settings.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, "users", profile.uid), {
                      partnerApplicationStatus: 'acknowledged_approved'
                    });
                  } catch (e) {
                    console.error("Error acknowledging approval:", e);
                  }
                  handleSwitchMode('partner');
                }}
                className="px-4 py-2 bg-[#1B4D3E] hover:bg-[#12362b] text-[#F8FAFC] text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#1B4D3E]/15"
              >
                Switch to Partner Mode
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    // 3. Rejected Banner
    if (profile.partnerApplicationStatus === 'rejected') {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#F8FAFC] border-l-4 border-rose-500 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Elite Partner Onboarding</h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-200">
                    Not Approved
                  </span>
                </div>
                <p className="text-xs text-[#334155] mt-1">
                  Your Elite Partner application was not approved. For appeal requests, please call 9424456606.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, "users", profile.uid), {
                      partnerApplicationStatus: 'acknowledged_rejected'
                    });
                  } catch (e) {
                    console.error("Error acknowledging rejection:", e);
                  }
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return null;
  };

  const renderContent = () => {
    if (profile && currentMode === 'partner' && (profile.role === 'partner' || profile.role === 'admin' || profile.partnerId)) {
      return <PartnerApp profile={profile} onNavigate={(tab) => setActiveTab(tab as any)} />;
    }

    const handleServiceSelect = (id: string) => {
      setSelectedServiceId(id);
      setActiveTab('service-details');
    };

    // Public SEO/Footer Pages accessible without authentication
    if (['about', 'contact', 'help', 'terms', 'privacy', 'refund'].includes(activeTab)) {
      if (activeTab === 'about') {
        return (
          <StaticPage
            title="About us"
            content={`Welcome to Zomindia! We are Indore's most loved app for on-demand home services and laundry. Officially registered as ${COMPANY_NAME}, we are based right here in Indore, MP, INDIA. Our goal is simple: to make your life easy. Whether you need deep home cleaning, laundry and dry cleaning, plumbing, repairs, or appliance maintenance, we bring skilled, verified professionals straight to your doorstep.

Our brand, Zomindia, is built upon a simple promise: providing absolute trust, high-quality work, and complete safety with instant, secure OTP-based logins. We recognize that your home or business is sacred, which is why we meticulously train, verify, and monitor every service partner. No compromises, no hidden charges, and absolute on-time execution every single day.

Our Mission
At ${COMPANY_NAME}, our mission is to make home services simple and reliable. By supporting local service providers with technology, safety guidelines, and professional training, we help them earn better while giving you an unmatched, hassle-free booking experience. We strive to make laundry, cleaning, painting, and repairs as simple as turning on a faucet.

Why Choose Us?
• 100% Safe & Trusted: Every helper is background-checked and professionally trained. All logins and bookings are secured with instant mobile OTPs.
• Gold Standard Quality: We use safe, eco-friendly cleaning detergents and professional equipment to make sure you get premium results for your laundry, cleaning, and repairs.
• Always On Time: We respect your time. If our professional partner gets delayed, we'll track them live and make it up to you.
• Proudly Indore-First: Being based in Indore, MP, INDIA, we understand Indori homes, garments care, and local needs perfectly!`}
            onBack={() => setActiveTab('home')}
          >
            {/* Team Leadership Section */}
            <div className="mt-16 border-t border-slate-100 pt-16">
              <h2 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">Meet Our Leadership</h2>
              <p className="text-slate-500 mb-10 text-base max-w-xl">
                Our core team in Indore drives operational excellence, tech coordination, and robust partner management to deliver flawless home services daily.
              </p>

              <div className="grid grid-cols-1 gap-8 md:gap-10">
                {/* Member 1: Ranu */}
                <div className="bg-slate-50/60 rounded-3xl border border-slate-100/85 p-6 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-start hover:border-blue-100 hover:shadow-lg hover:shadow-slate-100/50 transition-all duration-300">
                  {/* Image Column */}
                  <div className="w-full md:w-44 h-56 sm:h-64 md:h-44 shrink-0 rounded-2xl overflow-hidden bg-slate-200 relative group shadow-sm">
                    <img
                      src={teamMember1Img}
                      alt="Ranu - Head in charge management"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-60 md:hidden" />
                  </div>

                  {/* Details Column */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="text-2xl font-bold text-slate-900">Ranu</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200/80 text-slate-700">Age: 27</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">Indore</span>
                      </div>
                      <p className="text-blue-700 font-bold uppercase tracking-wider text-xs">Head in charge management</p>
                    </div>

                    <p className="text-slate-600 text-base leading-relaxed">
                      A dynamic leader with a strong track record in operations, Ranu oversees our service quality assurance, scheduling integrity, and partner coordination programs, ensuring seamless service delivery across Central India.
                    </p>

                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                      <span>Department: Operations &amp; Management</span>
                      <span>•</span>
                      <span>Indore HQ</span>
                    </div>
                  </div>
                </div>

                {/* Member 2: Vikass Chopra */}
                <div className="bg-slate-50/60 rounded-3xl border border-slate-100/85 p-6 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-start hover:border-blue-100 hover:shadow-lg hover:shadow-slate-100/50 transition-all duration-300">
                  {/* Image Column */}
                  <div className="w-full md:w-44 h-56 sm:h-64 md:h-44 shrink-0 rounded-2xl overflow-hidden bg-slate-200 relative group shadow-sm">
                    <img
                      src={teamMember2Img}
                      alt="Vikass Chopra - Chief Incharge"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-60 md:hidden" />
                  </div>

                  {/* Details Column */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="text-2xl font-bold text-slate-900">Vikass Chopra</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200/80 text-slate-700">Age: 35</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">Indore</span>
                      </div>
                      <p className="text-blue-700 font-bold uppercase tracking-wider text-xs">Chief Incharge</p>
                    </div>

                    <p className="text-slate-600 text-base leading-relaxed">
                      With over a decade of hands-on expertise in field services and customer experience management, Vikass orchestrates our prime support lines, technical dispatch protocols, and system reliability, driving our team focus toward gold standards.
                    </p>

                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                      <span>Department: Executive Direction</span>
                      <span>•</span>
                      <span>Indore HQ</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </StaticPage>
        );
      }

      if (activeTab === 'contact') {
        return (
          <StaticPage
            title="Contact Us"
            content={`Have questions, feedback, or need help with a booking? Zomindia is here for you! Whether you are a customer checking your booking status, or a local service provider wanting to join our team, we are happy to help anytime.`}
            onBack={() => setActiveTab('home')}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 mb-16">
              {/* Customer Support Card */}
              <div className="bg-slate-50/60 rounded-[32px] border border-slate-100 p-8 flex flex-col items-start hover:border-blue-100 hover:shadow-xl hover:shadow-slate-100/40 transition-all duration-300">
                <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Customer Support</h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">Assistance for active bookings, schedule adjustments, laundry counts, and general customer feedback of home services.</p>
                
                <div className="space-y-5 w-full mt-auto">
                  <div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Customer Care No</span>
                    <a href="tel:+919424456606" className="text-slate-900 text-lg font-extrabold hover:text-blue-700 transition-colors">+91 9424456606</a>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Support Email</span>
                    <a href="mailto:support@zomindia.com" className="text-slate-900 text-base font-extrabold hover:text-blue-700 transition-colors">support@zomindia.com</a>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Official WhatsApp</span>
                    <a href="https://wa.me/919424456606" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-full text-sm font-bold transition-all duration-200 mt-1">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.022-.014-.507-.25-1.011-.5-.505-.25-.769-.373-.979-.373-.208 0-.323.014-.554.25-.23.238-.883.882-1.083 1.056-.195.176-.411.205-.71.07-.3-.13-1.264-.47-2.405-1.466-.883-.756-1.488-1.74-1.66-2.01-.19-.29-.02-.45.1-.56.1-.1.2-.23.3-.35.1-.09.136-.2.2-.3.06-.1.03-.207-.01-.3-.04-.09-.373-.89-.512-1.22-.136-.319-.277-.27-.373-.27-.08-.004-.2-.004-.32-.004-.12 0-.319.043-.487.217-.168.174-.658.643-.658 1.57s.676 1.83.77 1.96c.094.12 1.35 2.056 3.27 2.88.459.195.82.312 1.096.398.461.147.88.127 1.21.078.36-.054 1.107-.453 1.263-.89.156-.434.156-.807.11-1.056-.046-.248-.19-.372-.36-.453zm-5.452 7.618H12c-2.14 0-4.22-.57-6.04-1.66L1 22l1.69-4.94A11.93 11.93 0 0 1 1.05 12C1.05 5.4 6.4 0 13 0s11.95 5.4 11.95 12c0 6.6-5.4 12-11.93 12z"/>
                      </svg>
                      +91 9424456606
                    </a>
                  </div>
                </div>
              </div>

              {/* Partner Relations Card */}
              <div className="bg-slate-50/60 rounded-[32px] border border-slate-100 p-8 flex flex-col items-start hover:border-blue-100 hover:shadow-xl hover:shadow-slate-100/40 transition-all duration-300">
                <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Partner Support</h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">Accelerate your services startup. Grow your earning channels, verify profiles, and manage corporate vendor operations with us.</p>
                
                <div className="space-y-5 w-full mt-auto">
                  <div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Partner Helpline</span>
                    <a href="tel:+919993655574" className="text-slate-900 text-lg font-extrabold hover:text-blue-700 transition-colors">+91 9993655574</a>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">General Inquiries Email</span>
                    <a href="mailto:info@zomindia.com" className="text-slate-900 text-base font-extrabold hover:text-blue-700 transition-colors">info@zomindia.com</a>
                  </div>
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase block">Partner Desk: 9 AM - 7 PM</span>
                  </div>
                </div>
              </div>

              {/* Corporate Location Card */}
              <div className="bg-slate-50/60 rounded-[32px] border border-slate-100 p-8 flex flex-col items-start hover:border-blue-100 hover:shadow-xl hover:shadow-slate-100/40 transition-all duration-300">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Registered Address</h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">Official physical and legal headquarters. Drop by for business-level negotiations or authorized paperwork.</p>
                
                <div className="space-y-5 w-full mt-auto">
                  <div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Parent Entity</span>
                    <span className="text-slate-900 text-base font-black">{COMPANY_NAME}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">HQ Location</span>
                    <p className="text-slate-900 text-base font-extrabold leading-normal">Indore, MP, INDIA</p>
                  </div>
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider inline-block">Registered HQ</span>
                  </div>
                </div>
              </div>
            </div>
          </StaticPage>
        );
      }

      if (activeTab === 'help') {
        return (
          <StaticPage
            title="Help Center"
            content={`Welcome to Zomindia Help! We have made this simple guide to answer all your questions about bookings, pricing, laundry, and our quality guarantee.

How do I book a service?
Just pick a service on our home page, select what you need, verify your phone number with a quick OTP, and choose a time. We'll match you with a certified nearby expert right away!

How do you make sure the partner is safe to enter my home?
Your safety is our top priority. Every single service partner on ${COMPANY_NAME} goes through a professional background verification, identity check, and intensive customer care training before they can take any orders.

What if I am not happy with the service?
We offer a 100% Satisfaction Guarantee! If the work isn't done correctly, let us know via the "My Support Tickets" chat or call +91 9424456606 within 24 hours. We will investigate and send a professional to redo the job completely free of charge.

Can I cancel or change my booking?
Yes, absolutely! You can cancel or reschedule any booking up to 4 hours before the service time for free. We will issue a full refund with no questions asked.`}
            onBack={() => setActiveTab('home')}
          />
        );
      }

      if (activeTab === 'terms') {
        return (
          <StaticPage
            title="Terms & Conditions"
            content={`Welcome to ${COMPANY_NAME}! By using our website or app, you agree to these simple and transparent rules. Please read them below—it takes less than 2 minutes!

1. Your Account & OTP Security
We keep your login simple and secure using a quick mobile OTP. You are responsible for any bookings made using your phone number, so please keep your phone secure and active.

2. Accurate Booking Info
Please provide the correct home address and phone number when booking. If the address is wrong or we are given incorrect details, we might have to cancel your booking so our partners don't lose time traveling.

3. Helping Our Partners Help You
Please give our service partner a safe, respectful space, and clear access to water and electricity to complete the job. Also, please keep your money and valuables in a safe place before our cleaning experts start. If a partner is threatened or harassed, the booking will be stopped immediately with no refund.

4. Simple & Fair Payments
You agree to pay the prices shown on your booking screen, which include basic local taxes. You can pay securely online (UPI, Debit/Credit Card) or select Cash on Delivery (COD). If there are outstanding dues or payment issues, we may have to pause your account access.`}
            onBack={() => setActiveTab('home')}
          />
        );
      }

      if (activeTab === 'privacy') {
        return (
          <StaticPage
            title="Privacy Policy"
            content={`At ${COMPANY_NAME} (registered in Indore, MP, INDIA), we care deeply about your privacy. Here is a super simple guide to how we handle your personal details:

1. What Info We Collect & Why
• Name, Email, and Phone: We use your phone number to log you in securely with a quick OTP. Your email is used for sending plain invoices and receipts.
• Your Address: We collect your address to dispatch our service professionals straight to your doorstep.
• Your Location: With your permission, we use your location to show available local services near you and help service partners find your home easily.

2. No Selling of Data
We will NEVER sell, rent, or trade your personal details to any outside marketing companies. Your data is only shared with the specific verified service provider assigned to complete your home booking.

3. Safe & Secure Database
All your data is stored in secure, top-tier cloud databases (Firestore) with strict locks. Only authorized people can see it.

4. Your Data, Your Control
You have full control over your details. You can view, update, or ask us to delete your account anytime by emailing us at support@zomindia.com.`}
            onBack={() => setActiveTab('home')}
          />
        );
      }

      if (activeTab === 'refund') {
        return (
          <StaticPage
            title="Cancellation & Refund"
            content={`At ${COMPANY_NAME}, we believe in a simple and fair approach to booking changes. This policy explains our easy cancellation and refund rules in simple terms:

1. Free Cancellations & Scheduling
• Before 4 Hours: You can change or cancel any booking for free up to 4 hours before your scheduled time. No fees, no questions asked!
• Within 4 Hours: If you cancel with less than 4 hours left, we charge a small cancellation fee of ₹99. This amount goes directly to the service partner to cover their travel expenses and time.
• Laundry Pickups: You can change laundry timings for free as long as our delivery rider hasn't already reached your home.

2. Super Simple Refunds
• Online Payments: If you paid online via UPI, Card, or Netbanking, the money is sent back to your original payment account. We don't pay cash refunds for digital bookings to keep your transactions secure.
• Refund Timing: We process refunds instantly. Your bank might take 3 to 5 business days to clear the amount and show it in your account.
• Cash on Delivery (COD): If we owe you a refund for a COD order (for example, if you had fewer laundry clothes than expected), the difference is added instantly to your Zomindia wallet for your future bookings.

3. Need Help?
If you have any billing questions, or if your refund is delayed, please email us at support@zomindia.com or call Customer Care at +91 9424456606. We are always happy to help!`}
            onBack={() => setActiveTab('home')}
          />
        );
      }
    }

    if (!profile) {
       if (activeTab === 'offers') {
          return <OffersView profile={null} onAuthRequired={() => setIsAuthModalOpen(true)} setActiveTab={setActiveTab} />;
       }
       if (activeTab === 'service-details' && selectedServiceId) {
         return (
           <ServiceDetails
             serviceId={selectedServiceId}
              profile={null}
              onBack={() => setActiveTab('home')}
              onAuthRequired={() => setIsAuthModalOpen(true)}
              onSuccess={() => setActiveTab('home')}
              onServiceSelect={handleServiceSelect}
           />
         );
       }
       return (
         <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           transition={{ duration: 0.2, ease: "easeInOut" }}
           className="w-full"
         >
           <CustomerHome setActiveTab={setActiveTab} profile={null} onAuthRequired={() => setIsAuthModalOpen(true)} onServiceSelect={handleServiceSelect} initialCategoryId={selectedCategoryId} />
         </motion.div>
       );
    }

    if (activeTab === 'partner') {
      if (!profile) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="w-full"
          >
            <Suspense fallback={<LoadingScreen />}>
              <PartnerPortalLanding onLogin={() => setIsAuthModalOpen(true)} onExploreServices={() => setActiveTab('home')} />
            </Suspense>
          </motion.div>
        );
      }
      return <PartnerApp profile={profile} onNavigate={(tab) => setActiveTab(tab as any)} />;
    }

    if (activeTab === 'admin') {
      if (!profile || profile.role !== 'admin') {
         setActiveTab('home');
         return (
           <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             transition={{ duration: 0.2, ease: "easeInOut" }}
             className="w-full"
           >
             <CustomerHome setActiveTab={setActiveTab} profile={profile} onAuthRequired={() => setIsAuthModalOpen(true)} onServiceSelect={handleServiceSelect} initialCategoryId={selectedCategoryId} />
           </motion.div>
         );
      }
      return <AdminDashboard profile={profile} setActiveTab={setActiveTab} />;
    }

    if (activeTab === 'service-details' && selectedServiceId) {
      return (
        <ServiceDetails
          serviceId={selectedServiceId}
          profile={profile}
          onBack={() => setActiveTab('home')}
          onAuthRequired={() => setIsAuthModalOpen(true)}
          onSuccess={() => setActiveTab('home')}
          onServiceSelect={handleServiceSelect}
        />
      );
    }

    if (activeTab === 'bookings' && profile) {
      if (profile.role === 'admin') {
        return <AdminDashboard profile={profile} setActiveTab={setActiveTab} initialAdminTab="bookings" />;
      }
      if (profile.role === 'partner') {
        return <PartnerApp profile={profile} onNavigate={(tab) => setActiveTab(tab as any)} initialTab="jobs" />;
      }
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="w-full"
        >
          <CustomerDashboard profile={profile} onServiceSelect={handleServiceSelect} initialExpandedBookingId={targetBookingId} setActiveTab={setActiveTab} />
        </motion.div>
      );
    }

    if (activeTab === 'amcs' && profile.role === 'customer') {
      return <CustomerAmcView profile={profile} onBack={() => setActiveTab('home')} />;
    }

    if ((profile?.role === 'customer' || profile?.role === 'admin') && activeTab === 'partner-signup') {
      return <SignUpAsPartner profile={profile} onSuccess={() => { setActiveTab('partner'); }} />;
    }

    if (activeTab === 'profile') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="w-full"
        >
          <ProfileSettings
            profile={profile}
            onUpdate={(updated) => setProfile(updated)}
            setActiveTab={setActiveTab}
            setIsPartnerModalOpen={setIsPartnerModalOpen}
          />
        </motion.div>
      );
    }



    if (activeTab === 'notifications' && profile) {
      return <NotificationsView profile={profile} onNavigate={(tab, bId) => {
        if (tab === 'bookings') {
          setActiveTab('bookings', bId || null);
        } else if (tab === 'offers' || tab === 'wallet') {
          setActiveTab(tab);
        }
      }} />;
    }

    if (activeTab === 'offers' && profile) {
      return <OffersView profile={profile} onAuthRequired={() => setIsAuthModalOpen(true)} setActiveTab={setActiveTab} />;
    }

    if (activeTab === 'tickets' && profile) {
      return <SupportTicketsView profile={profile} />;
    }

    if (activeTab === 'wallet' && profile) {
      return <WalletView profile={profile} setActiveTab={setActiveTab} />;
    }

    if (activeTab === 'referrals') {
      if (!profile) {
        return (
          <div className="max-w-2xl mx-auto px-4 py-20 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Claim Your ₹100 Welcome Bonus</h2>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8">Please register or log in to view your unique referral code, track your referral earnings, or apply an invitation code.</p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg transition-all"
            >
              Sign In / Sign Up
            </button>
          </div>
        );
      }
      return <ReferralsView profile={profile} onBack={() => setActiveTab('profile')} />;
    }

    // Default to Customer View
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="w-full"
      >
        <CustomerHome setActiveTab={setActiveTab} profile={profile} onAuthRequired={() => setIsAuthModalOpen(true)} onServiceSelect={handleServiceSelect} initialCategoryId={selectedCategoryId} />
      </motion.div>
    );
  };

  const isFullScreenView = activeTab === 'admin' || activeTab === 'partner';

  if (isFullScreenView) {
    return (
      <APIProvider apiKey={API_KEY} version="weekly">
        <div className="min-h-screen">
          <NotificationSystem onNavigate={setActiveTab} />
          <Suspense fallback={<LoadingScreen message="Loading dashboard..." />}>
            {renderContent()}
          </Suspense>
          <OfflineSyncIndicator />
        </div>
      </APIProvider>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="min-h-screen bg-white text-slate-900 font-sans">
      <NotificationSystem onNavigate={setActiveTab} />
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-200/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-2">
              <motion.div
                className="flex items-center cursor-pointer group relative px-2.5 py-1.5 rounded-2xl transition-all duration-300"
                onClick={() => setActiveTab('home')}
                id="nav-logo"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {/* Premium backlighting ambient blur glow */}
                <div className="absolute inset-0 bg-blue-600/[0.04] rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <Logo 
                  size={undefined} 
                  className="h-9 sm:h-9 md:h-10 transition-all duration-300 group-hover:drop-shadow-[0_0_10px_rgba(5,12,166,0.3)]" 
                />
              </motion.div>
            </div>

            {renderNavigation()}

            <div className="flex items-center gap-2 sm:gap-4">
              {profile ? (
                <>
                  {/* Desktop Only: Standalone Bell Icon */}
                  <motion.button
                    onClick={() => setActiveTab('notifications')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="hidden md:flex relative p-2 text-slate-500 hover:text-blue-700 hover:bg-slate-50 rounded-full transition-all cursor-pointer"
                    id="desktop-notifications-bell"
                  >
                    <Bell size={22} className="stroke-[2]" />
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
                  </motion.button>

                  {/* Desktop Only Trigger & Dropdown Menu */}
                  <div 
                    ref={dropdownRef}
                    className="hidden md:flex items-center gap-3 relative"
                    onMouseEnter={() => setIsUserMenuOpen(true)}
                    onMouseLeave={() => setIsUserMenuOpen(false)}
                  >
                    <button
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="flex items-center gap-2.5 select-none py-1.5 px-2.5 hover:bg-slate-50/80 rounded-2xl transition-all cursor-pointer"
                      id="nav-green-greeting"
                    >
                      <div className="flex flex-col text-right items-end">
                        {/* IMMUTABLE GREETER BLOCK START - DO NOT MODIFY OR REFACTOR */}
                        <span className="text-xs font-black leading-tight flex items-center gap-1 justify-end text-[#22c55e]" id="portal-header-greeter">
                          <span>{profile?.displayName || profile?.fullName || user?.displayName ? `नमस्ते, ${profile?.displayName || profile?.fullName || user?.displayName}` : "नमस्ते"}</span>
                        </span>
                        {/* IMMUTABLE GREETER BLOCK END */}
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsCitySelectorOpen(true);
                          }}
                          className="text-slate-400 hover:text-emerald-600 active:scale-95 text-[10px] font-black tracking-widest leading-none mt-1.5 uppercase pr-1 flex items-center gap-0.5 justify-end cursor-pointer transition-all duration-200"
                          title="Click to change city"
                        >
                          📍 INDORE
                        </span>
                      </div>

                      <Avatar
                        photoURL={profile.photoURL}
                        displayName={profile.displayName || profile.fullName}
                        email={profile.email}
                        isPremium={profile.isPremium}
                        sizeClass="w-10 h-10 hover:scale-105 active:scale-95 transition-all"
                      />
                    </button>

                    <AnimatePresence>
                      {isUserMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute top-full right-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60]"
                        >
                          <div className="px-3 py-2 border-b border-slate-50 mb-1.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Signed in as</p>
                            <p className="text-xs font-black text-slate-800 truncate">{(profile.displayName || profile.email || 'User').toUpperCase()}</p>
                          </div>

                          <button
                            onClick={() => { setActiveTab('profile'); setIsUserMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all"
                            id="dropdown-profile-button"
                          >
                            <UserIcon size={14} />
                            Profile Settings
                          </button>

                          {/* Urban Company-Style Dual Persona Switcher */}
                          {(profile.role === 'partner' || profile.role === 'admin' || profile.partnerId) && (
                            <button
                              onClick={() => {
                                handleSwitchMode(currentMode === 'customer' ? 'partner' : 'customer');
                                setIsUserMenuOpen(false);
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-black text-slate-700 bg-slate-50 hover:bg-slate-100/80 hover:text-indigo-700 rounded-xl transition-all border border-dashed border-slate-200/80 hover:border-indigo-300/80 mt-1 mb-1"
                              id="dropdown-mode-switcher"
                            >
                              <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 animate-pulse"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>
                                <span>{currentMode === 'customer' ? 'Switch to Partner' : 'Switch to Customer'}</span>
                              </div>
                              <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider scale-90">LIVE</span>
                            </button>
                          )}

                          {/* Desktop Hook: Partner Dashboard for Partner & Admin roles */}
                          {(profile.role === 'partner' || profile.role === 'admin') && (
                            <button
                              onClick={() => { setActiveTab('partner'); setIsUserMenuOpen(false); }}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-bold rounded-xl transition-all ${(activeTab as string) === 'partner' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-700'}`}
                              id="dropdown-partner-button"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                              Partner Dashboard
                            </button>
                          )}

                          {/* Desktop Hook: Admin Panel for Admin role only */}
                          {profile.role === 'admin' && (
                            <button
                              onClick={() => { setActiveTab('admin'); setIsUserMenuOpen(false); }}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-bold rounded-xl transition-all ${(activeTab as string) === 'admin' ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-50 hover:text-red-700'}`}
                              id="dropdown-admin-button"
                            >
                              <ShieldCheck size={14} className="text-red-600" />
                              Admin Panel
                            </button>
                          )}

                          <button
                            onClick={() => { setActiveTab('amcs'); setIsUserMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all"
                          >
                            <Calendar size={14} />
                            Annual Contracts
                          </button>
                          
                          <button
                            onClick={() => { setActiveTab('wallet'); setIsUserMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                            Wallet (₹{profile.walletBalance || 0})
                          </button>

                          <button
                            onClick={() => { setActiveTab('tickets'); setIsUserMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all"
                          >
                            <MessageSquare size={14} />
                            Support Tickets
                          </button>

                          <button
                            onClick={() => { setActiveTab('referrals'); setIsUserMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                            Refer & Earn
                          </button>

                          {false && profile.role !== 'partner' && (
                            <button
                              onClick={() => { setActiveTab('partner-signup'); setIsUserMenuOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-700 rounded-xl transition-all"
                            >
                              <svg xmlns="http://www.w3.org/2005/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
                              {/* Deleted Become Partner */}
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              window.dispatchEvent(new CustomEvent('toggle-ai-chat', { detail: { open: true } }));
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all border-t border-slate-50 mt-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                            AI Support Chat
                          </button>

                          <button
                            onClick={async () => {
                              setIsUserMenuOpen(false);
                              await auth.signOut();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all border-t border-slate-55 mt-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            Log Out
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Mobile Only: Top Row far-right compact greetings, Indore city pill, and Avatar toggle trigger */}
                  <div className="flex md:hidden items-center gap-2 select-none">
                    {/* IMMUTABLE GREETER BLOCK START - DO NOT MODIFY OR REFACTOR */}
                    <span className="text-[10px] font-black text-[#22c55e] bg-slate-50 px-2 py-1 rounded-xl flex items-center gap-1">
                      <span>{profile?.displayName || profile?.fullName || user?.displayName ? `नमस्ते, ${profile?.displayName || profile?.fullName || user?.displayName}` : "नमस्ते"}</span>
                    </span>
                    {/* IMMUTABLE GREETER BLOCK END */}
                    <button
                      onClick={() => setIsCitySelectorOpen(true)}
                      className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[9px] px-2 py-1 rounded-xl cursor-pointer hover:bg-slate-200 active:scale-95 transition-all"
                    >
                      📍 INDORE
                    </button>
                    <button 
                      onClick={() => setIsMenuOpen(true)}
                      className="shrink-0 active:scale-90 transition-all cursor-pointer"
                      id="mobile-avatar-drawer-trigger"
                    >
                      <Avatar
                        photoURL={profile.photoURL}
                        displayName={profile.displayName || profile.fullName}
                        email={profile.email}
                        isPremium={profile.isPremium}
                        sizeClass="w-10 h-10"
                      />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="bg-blue-700 text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/10 active:scale-95"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {user && !user.emailVerified && user.email && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3 sm:py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-bold shadow-sm transition-all">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 animate-pulse shrink-0 mt-0.5 sm:mt-0">
              <Mail size={16} />
            </div>
            <div className="flex flex-col gap-1 min-w-0 text-left">
              <span className="leading-relaxed">Please verify your email address. We've sent a verification link to <span className="underline text-amber-950 font-black break-all">{user.email}</span>.</span>
              {(verificationFeedback || verificationFeedbackError) && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[10.5px]">
                  {verificationFeedback && <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50">✓ {verificationFeedback}</span>}
                  {verificationFeedbackError && <span className="text-rose-600 font-extrabold bg-rose-50 px-2 py-0.5 rounded border border-rose-100/50">✗ {verificationFeedbackError}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto pl-8 sm:pl-0">
            <button
              disabled={verificationLoading || cooldownSeconds > 0}
              onClick={async () => {
                if (cooldownSeconds > 0) return;
                setVerificationLoading(true);
                setVerificationFeedback(null);
                setVerificationFeedbackError(null);
                try {
                  const redirectUrl = `${window.location.origin}/#settings`;
                  const actionCodeSettings = {
                    url: redirectUrl,
                    handleCodeInApp: true,
                  };
                  await sendEmailVerification(user, actionCodeSettings);
                  setVerificationFeedback(`Verification email sent to ${user.email}! Please check your inbox.`);
                  setCooldownSeconds(60); // 60 seconds spam prevention cooldown
                  setTimeout(() => setVerificationFeedback(null), 8000);
                } catch (err: any) {
                  let userFriendlyMsg = "Failed to resend verification link.";
                  if (err.code === 'auth/too-many-requests') {
                    userFriendlyMsg = "Please wait a few minutes before resending.";
                  } else if (err.code === 'auth/invalid-email') {
                    userFriendlyMsg = "The email address has an invalid format.";
                  } else if (err.code === 'auth/user-not-found') {
                    userFriendlyMsg = "No user found associated with current credentials.";
                  } else {
                    userFriendlyMsg = `${err.message || err}`;
                  }
                  
                  setVerificationFeedbackError(userFriendlyMsg);
                  setTimeout(() => setVerificationFeedbackError(null), 8000);
                } finally {
                  setVerificationLoading(false);
                }
              }}
              className="px-3 py-1.5 bg-white border border-amber-200 hover:bg-amber-100/50 rounded-xl transition-all uppercase tracking-wider text-[9px] font-black disabled:opacity-50"
            >
              {cooldownSeconds > 0 ? `Resend (${cooldownSeconds}s)` : "Resend Link"}
            </button>
            <button
              disabled={verificationLoading}
              onClick={async () => {
                setVerificationLoading(true);
                setVerificationFeedback(null);
                setVerificationFeedbackError(null);
                try {
                  await user.reload();
                  const refreshed = auth.currentUser;
                  setUser(refreshed ? { ...refreshed } as any : null);
                  if (refreshed?.emailVerified) {
                    setVerificationFeedback("Success! Your email address is verified.");
                    setTimeout(() => setVerificationFeedback(null), 5000);
                  } else {
                    setVerificationFeedbackError("We couldn't verify your email yet. Please check your inbox or try resending the link.");
                    setTimeout(() => setVerificationFeedbackError(null), 5000);
                  }
                } catch (err: any) {
                  setVerificationFeedbackError(err.message || "Failed to check status.");
                  setTimeout(() => setVerificationFeedbackError(null), 5000);
                } finally {
                  setVerificationLoading(false);
                }
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all uppercase tracking-wider text-[9px] font-black shadow-md shadow-amber-500/20"
            >
              Check Again
            </button>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-200 overflow-hidden"
          >
            <div className="px-4 py-8 flex flex-col gap-2">
              {profile && (
                <div className="mb-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3 px-2">
                    <Avatar
                      photoURL={profile.photoURL}
                      displayName={profile.displayName || profile.fullName}
                      email={profile.email}
                      isPremium={profile.isPremium}
                      sizeClass="w-10 h-10"
                    />
                    <div>
                      {/* IMMUTABLE GREETER BLOCK START - DO NOT MODIFY OR REFACTOR */}
                      <p className="text-sm font-black text-[#22c55e] font-display uppercase leading-tight flex items-center gap-1">
                        <span>{profile?.displayName || profile?.fullName || user?.displayName ? `नमस्ते, ${profile?.displayName || profile?.fullName || user?.displayName}` : "नमस्ते"}</span>
                      </p>
                      {/* IMMUTABLE GREETER BLOCK END */}
                      <p 
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsCitySelectorOpen(true);
                        }}
                        className="text-[10px] text-slate-400 hover:text-emerald-600 active:scale-95 font-black tracking-widest uppercase mt-0.5 pl-2.5 cursor-pointer transition-all duration-200 inline-block"
                        title="Click to change city"
                      >
                        📍 INDORE
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {getNavLinks()
                .filter(link => {
                  const excludedIds = ['referrals', 'amcs', 'profile', 'partner-signup'];
                  if (excludedIds.includes(link.id)) return false;
                  return link.roles.includes(profile?.role || 'anon');
                })
                .map((link, i) => (
                  <MobileNavItem
                    key={link.id}
                    onClick={() => { setActiveTab(link.id as any); setIsMenuOpen(false); }}
                    label={link.label}
                    isActive={activeTab === link.id}
                    index={i}
                  />
                ))
              }

              {/* Native Sub-Options & Notifications Drawer Trigger for Profile on Mobile */}
              {profile && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1.5 text-left">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 py-1">Profile & Adjustments</span>
                  
                  {/* Urban Company-Style Dual Persona Switcher for Mobile */}
                  {(profile.role === 'partner' || profile.role === 'admin' || profile.partnerId) && (
                    <button
                      onClick={() => {
                        handleSwitchMode(currentMode === 'customer' ? 'partner' : 'customer');
                        setIsMenuOpen(false);
                      }}
                      className="mx-3 my-1 px-4 py-3 bg-indigo-50 hover:bg-indigo-100/80 rounded-2xl border border-indigo-100 text-left flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-2.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 animate-pulse"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>
                        <span className="text-xs font-black text-slate-800">{currentMode === 'customer' ? 'Switch to Partner Mode' : 'Switch to Customer Mode'}</span>
                      </span>
                      <span className="text-[8px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black tracking-widest">TAP</span>
                    </button>
                  )}
                  
                  {/* Notifications with Unread Badge */}
                  <button
                    onClick={() => { setActiveTab('notifications'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'notifications' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Bell size={16} className="text-blue-700" />
                      <span>Notifications</span>
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white shadow-sm animate-pulse" />
                  </button>

                  {/* Mobile Hook: Partner Dashboard for Partner & Admin roles */}
                  {(profile.role === 'partner' || profile.role === 'admin') && (
                    <button
                      onClick={() => { setActiveTab('partner'); setIsMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all ${(activeTab as string) === 'partner' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span>Partner Dashboard</span>
                    </button>
                  )}

                  {/* Mobile Hook: Admin Panel for Admin role only */}
                  {profile.role === 'admin' && (
                    <button
                      onClick={() => { setActiveTab('admin'); setIsMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all ${(activeTab as string) === 'admin' ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <ShieldCheck size={16} className="text-red-600" />
                      <span>Admin Panel</span>
                    </button>
                  )}

                  <button
                    onClick={() => { setActiveTab('profile'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <UserIcon size={16} className="text-slate-500" />
                    <span>My Profile & Settings</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('amcs'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'amcs' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Calendar size={16} className="text-slate-500" />
                    <span>Annual Services (AMCs)</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('wallet'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'wallet' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                    <span>My Wallet (Bal: ₹{profile.walletBalance || 0})</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('tickets'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'tickets' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <MessageSquare size={16} className="text-slate-500" />
                    <span>Service Tickets</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('referrals'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'referrals' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                    <span>Referrals & Rewards</span>
                  </button>

                  {false && profile.role !== 'partner' && (
                    <button
                      onClick={() => { setActiveTab('partner-signup'); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2005/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
                      <span>Become Elite Partner</span>
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      setIsMenuOpen(false);
                      await auth.signOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 mt-2 rounded-xl text-xs font-black text-rose-600 hover:bg-rose-50 transition-all border border-rose-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    <span>LOG OUT</span>
                  </button>
                </div>
              )}
              {!profile && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => { setIsAuthModalOpen(true); setIsMenuOpen(false); }}
                    className="w-full py-4 px-6 bg-blue-700 text-white rounded-2xl font-bold text-center shadow-xl shadow-blue-700/20"
                  >
                    Login to Explore
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          if (auth.currentUser) {
            setUser({ ...auth.currentUser } as any);
          }
          setIsAuthModalOpen(false);
        }}
      />

      <CitySelector
        isOpen={isCitySelectorOpen}
        onClose={() => setIsCitySelectorOpen(false)}
        currentUser={profile}
        onSelectCity={handleSelectCity}
      />

      {/* Real-time Partner Application Status Alert Popup */}
      <AnimatePresence>
        {profile && currentMode === 'customer' && partnerApplication && partnerApplication.status === 'pending' && showPartnerStatusPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-[#F8FAFC] border-2 border-[#1B4D3E]/20 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              {/* Premium Gold & Forest Green Header Decor */}
              <div className="bg-[#1B4D3E] p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A021]/10 rounded-full blur-2xl transform translate-x-12 -translate-y-12" />
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#C5A021]/15 border border-[#C5A021]/30 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#C5A021]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-black tracking-tight text-[#F8FAFC]">Zomindia Elite Partner</h3>
                    <p className="text-[10px] text-white/70 uppercase tracking-widest font-semibold mt-0.5">Real-time status monitor</p>
                  </div>
                </div>
              </div>

              {/* Popup Content */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between bg-white border border-[#1B4D3E]/10 p-4 rounded-2xl">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Onboarding Status</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-[#C5A021] border border-[#C5A021]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C5A021] animate-pulse" />
                    Pending Review
                  </span>
                </div>

                <div className="space-y-3 text-left">
                  <h4 className="text-sm font-bold text-slate-800">Your application is undergoing verification</h4>
                  <p className="text-xs text-[#334155] leading-relaxed">
                    Welcome, <span className="font-semibold text-slate-900">{partnerApplication.fullName}</span>! We have successfully received your request to join Zomindia as an Elite Service Partner for <span className="font-semibold text-[#1B4D3E]">{partnerApplication.serviceType}</span>. Our local Indore support team is currently verifying your coordinates and service listings.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Indore Verification Helpdesk</p>
                  <p className="text-xs font-bold text-slate-700">Phone: <span className="text-[#1B4D3E]">+91 9424456606</span></p>
                  <p className="text-[10px] text-slate-500 font-medium">Email: support@zomindia.com</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    onClick={() => setShowPartnerStatusPopup(false)}
                    className="w-full py-3 px-6 bg-[#1B4D3E] hover:bg-[#12362b] active:scale-[0.98] text-[#F8FAFC] rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-[#1B4D3E]/20"
                  >
                    Skip & Continue to Hub
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      {renderPartnerNotificationBanner()}
      <main className="pb-24 md:pb-0 relative min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <Suspense fallback={<LoadingScreen message="Loading page content..." />}>
              {renderContent()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasNotifications={true}
        isAuthenticated={!!profile}
        hasActiveArrival={hasActiveArrival}
      />

      <AiSupportChat userProfile={profile || undefined} isPartner={profile?.role === 'partner'} />

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="bg-white border-t border-slate-200/60 pt-20 pb-12 mt-28 relative z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16 mb-16 items-start">
            <div className="col-span-1 md:col-span-2 space-y-6">
              <motion.div
                whileHover={{ scale: 1.03 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="mb-6 inline-block cursor-pointer"
                onClick={() => setActiveTab('home')}
                id="footer-logo-container"
              >
                <Logo size={25} />
              </motion.div>
              <p className="text-slate-500 text-sm max-w-sm leading-relaxed font-medium">
                India's highly trusted home services ecosystem. We seamlessly connect verified, elite service professionals with households for a superior, convenient lifestyle experience.
              </p>

              {/* Real-time Administrative Showcase: Most Recently Added Service */}
              {mostRecentAppService && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={() => {
                    setSelectedServiceId(mostRecentAppService.id);
                    setActiveTab('service-details');
                  }}
                  className="p-5 rounded-[24px] bg-gradient-to-br from-indigo-50/50 via-slate-50 to-slate-50 border border-slate-100 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-100 hover:border-indigo-100 hover:shadow-md transition-all group max-w-sm mt-8 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />

                  <div className="flex items-center gap-3.5 relative z-10">
                    {mostRecentAppService.imageURL ? (
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-200 border border-slate-150 shrink-0">
                        <img
                          src={mostRecentAppService.imageURL}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-indigo-600 font-black text-white flex items-center justify-center text-sm shrink-0">
                        {mostRecentAppService.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 mr-1" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500 font-mono">Recent Launch</span>
                      </div>
                      <h5 className="text-xs font-black text-slate-900 group-hover:text-blue-700 transition-colors truncate max-w-[180px]">{mostRecentAppService.name}</h5>
                    </div>
                  </div>
                  <div className="text-right shrink-0 relative z-10">
                    <span className="text-xs font-black text-slate-900 block">₹{mostRecentAppService.basePrice}</span>
                    <span className="text-[8px] font-black uppercase text-blue-700 tracking-wider">Book ⚡</span>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-widest font-mono">Quick Links</h4>
              <ul className="space-y-2.5 text-sm font-semibold text-slate-500">
                {['about', 'contact', 'offers'].map((tabKey) => (
                  <li key={tabKey}>
                    <button
                      onClick={() => setActiveTab(tabKey as any)}
                      className="hover:text-blue-700 hover:translate-x-1 hover:underline transition-all duration-200 flex items-center font-bold cursor-pointer"
                    >
                      {tabKey === 'about' ? 'About Us' : tabKey === 'contact' ? 'Contact Support' : 'Exclusive Offers'}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    onClick={() => setIsPartnerModalOpen(true)}
                    className="text-emerald-600 hover:text-emerald-700 hover:translate-x-1 hover:underline transition-all duration-200 flex items-center font-extrabold cursor-pointer"
                    id="footer-join-partner-link"
                  >
                    Join as Elite Partner
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-widest font-mono">Support</h4>
              <ul className="space-y-2.5 text-sm font-semibold text-slate-500">
                {['help', 'terms', 'privacy', 'refund'].map((tabKey) => (
                  <li key={tabKey}>
                    <button
                      onClick={() => setActiveTab(tabKey as any)}
                      className="hover:text-blue-700 hover:translate-x-1 hover:underline transition-all duration-200 flex items-center font-bold"
                    >
                      {tabKey === 'help' ? 'Help Center' : tabKey === 'terms' ? 'Terms & Conditions' : tabKey === 'privacy' ? 'Privacy Policy' : 'Cancellation & Refund'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs font-bold text-slate-400">© 2026 {COMPANY_NAME}. All rights reserved.</p>
            <div className="flex gap-6">
              {/* Optional footer social link decoration */}
            </div>
          </div>
        </div>
      </motion.footer>
      <OfflineSyncIndicator />





      {/* Dynamic Ecosystem Hot-Update Premium Modal Overlay across Platforms */}
      <AnimatePresence>
        {systemUpdate && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800/80 rounded-[32px] p-6 sm:p-8 text-center shadow-[0_0_50px_rgba(30,50,150,0.25)] text-white overflow-hidden"
            >
              {/* Skip button on top right */}
              {updateProgress === null && (
                <button
                  onClick={handleSkipUpdate}
                  className="absolute top-5 right-5 p-2 bg-slate-800/50 hover:bg-slate-750 text-slate-300 hover:text-white rounded-full transition-all border-0 cursor-pointer"
                  title="Skip update"
                >
                  <X size={16} />
                </button>
              )}

              {/* Decorative background grid and glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-700/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative space-y-6">
                {/* Visual Icon Refresh */}
                <div className="relative w-16 h-16 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/10">
                  <RefreshCw size={28} className="animate-spin text-blue-400" style={{ animationDuration: '4s' }} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="bg-blue-500/10 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full border border-blue-500/20 flex items-center gap-1.5 leading-none">
                      <Sparkles size={12} className="animate-pulse" />
                      New Update
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                    Update Available
                  </h3>
                  <div className="bg-slate-950/30 border border-slate-800/60 rounded-2xl p-4 mt-3 max-w-sm mx-auto text-center">
                    <p className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider block font-sans">
                      What's New
                    </p>
                    <p className="text-sm text-slate-200 font-medium leading-relaxed font-sans">
                      {systemUpdate.reason ? systemUpdate.reason.replace("Ecosystem Hard-Sync: ", "") : "We've made some improvements to give you a better service experience."}
                    </p>
                  </div>
                </div>

                {updateProgress !== null ? (
                  /* Loading Patch Execution bar */
                  <div className="space-y-4 max-w-sm mx-auto">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-400 font-sans">
                      <span className="flex items-center gap-1.5 animate-pulse">
                        <Download size={12} className="text-blue-400 font-bold" />
                        {updateStep}
                      </span>
                      <span className="text-blue-400 font-bold">{updateProgress}%</span>
                    </div>

                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-600 via-blue-700 to-emerald-400 rounded-full"
                        style={{ width: `${updateProgress}%` }}
                        transition={{ ease: "easeInOut" }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 font-medium animate-pulse font-sans">
                      Applying changes, please wait...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto pt-2">
                    <button
                      onClick={handleStartUpdateProgress}
                      className="flex-1 bg-blue-600 text-white hover:bg-blue-700 font-semibold py-3.5 px-6 rounded-2xl text-xs active:scale-98 transition-all hover:scale-102 flex items-center justify-center gap-2 cursor-pointer border-0 shadow-lg shadow-blue-600/10"
                    >
                      <RefreshCw size={13} className="animate-spin" style={{ animationDuration: '4s' }} />
                      Update Now
                    </button>

                    <button
                      onClick={handleSkipUpdate}
                      className="px-5 py-3.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold rounded-2xl text-xs border border-slate-700/50 transition-all cursor-pointer"
                    >
                      Skip For Now
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Universal Feedback Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100000] pointer-events-none px-4 w-full max-w-md"
          >
            <div className="bg-slate-950/95 backdrop-blur-md border border-slate-800 text-white px-5 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-3.5 select-text pointer-events-auto hover:bg-black/95 transition-all">
              <div className="w-6 h-6 bg-emerald-500/15 rounded-full flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Check size={13} className="text-emerald-400 stroke-[3]" />
              </div>
              <span className="text-[12px] font-semibold font-sans tracking-wide leading-relaxed text-slate-100 break-words flex-1">
                {toastMessage}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ElitePartnerModal
        isOpen={isPartnerModalOpen}
        onClose={() => setIsPartnerModalOpen(false)}
        initialFullName={profile?.fullName || profile?.displayName || ''}
        initialPhone={profile?.phoneNumber || ''}
      />
    </div>
    </APIProvider>
  );
}

/**
 * Helper to securely inject the authenticated UID as the 'customerId' into a booking data payload before saving.
 */
export function injectCustomerId(payload: any, authenticatedUid?: string | null): any {
  // If the payload already has a populated or valid customerId, let's keep it, but fall back to the authenticatedUid
  const uid = authenticatedUid || payload.customerId || auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Authentication required: customerId is missing or inconsistent.");
  }
  return {
    ...payload,
    customerId: uid
  };
}
