/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile, UserRole, Booking, Service, Category } from './types';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { seedDatabase } from './lib/seed';
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
import { LoadingScreen } from './components/LoadingIndicator';
import NotificationSystem from './components/NotificationSystem';
import AuthModal from './components/AuthModal';
import BottomNav from './components/BottomNav';
import OfflineSyncIndicator from './components/OfflineSyncIndicator';
import AppInstallPopup from './components/AppInstallPopup';

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
const CustomerAmcView = lazy(() => import('./components/CustomerAmcView'));
const SupportTicketsView = lazy(() => import('./components/SupportTicketsView'));
const AiSupportChat = lazy(() => import('./components/AiSupportChat'));
const WalletView = lazy(() => import('./components/WalletView'));
const ReferralsView = lazy(() => import('./components/ReferralsView'));

import { useTranslation } from './lib/i18n';
import { useKeyboardFriendlyInputs } from './hooks/useKeyboardFriendlyInputs';

const headerLogoImg = 'https://ik.imagekit.io/zomindia/zomindia%20logo%20H.png?updatedAt=1781064945841';
const footerLogoImg = 'https://ik.imagekit.io/zomindia/zomindia%20logo%20H.png?updatedAt=1781064945841';
import teamMember1Img from './assets/images/regenerated_image_1780775603903.webp';
import teamMember2Img from './assets/images/regenerated_image_1780775605334.webp';

const Logo = ({ size = 20, light = false, className = "", src }: { size?: number, light?: boolean, className?: string, src?: string }) => {
  const heightStyle = size && !className ? { height: size * 1.6 } : undefined;
  
  // High-fidelity preparation logic for custom brand logo uploads.
  // This allows the app to dynamically White-Label/re-brand when administrators apply a custom logo.
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('custom_zomindia_brand_logo');
    } catch {
      return null;
    }
  });

  // Keep state reactive if the logo gets configured or reset live
  useEffect(() => {
    const checkBrandLogo = () => {
      try {
        const stored = localStorage.getItem('custom_zomindia_brand_logo');
        if (stored !== customLogoUrl) {
          setCustomLogoUrl(stored);
        }
      } catch (e) {
        // Safe context rescue
      }
    };
    window.addEventListener('storage', checkBrandLogo);
    const interval = setInterval(checkBrandLogo, 1000);
    return () => {
      window.removeEventListener('storage', checkBrandLogo);
      clearInterval(interval);
    };
  }, [customLogoUrl]);

  const resolvedSrc = customLogoUrl || src || "https://ik.imagekit.io/zomindia/zomindia%20logo%20H.png?updatedAt=1781064945841";

  return (
    <div
      className={`relative flex items-center justify-start select-none ${className}`}
      style={heightStyle}
    >
      <img
        src={resolvedSrc}
        alt="ZOMINDIA LOGO"
        className="h-full w-auto max-w-full object-contain transition-all duration-300"
        referrerPolicy="no-referrer"
        onError={() => {
          // Fallback rescue if custom brand asset fails or is removed
          if (customLogoUrl) {
            setCustomLogoUrl(null);
            try {
              localStorage.removeItem('custom_zomindia_brand_logo');
            } catch {}
          }
        }}
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

export default function App() {
  useKeyboardFriendlyInputs();
  const [user, setUser] = useState<User | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        try {
          localStorage.setItem('custom_zomindia_brand_logo', reader.result);
          window.dispatchEvent(new Event('storage'));
          setToastMessage("Custom branding logo updated successfully! 🎨");
        } catch (err) {
          console.error("Local storage quota limit or failed write:", err);
          setToastMessage("Image is too large. Please select a smaller standard image under 1MB.");
        }
      }
    };
    reader.readAsDataURL(file);
  };
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<'home' | 'bookings' | 'profile' | 'admin' | 'partner' | 'partner-signup' | 'about' | 'contact' | 'help' | 'terms' | 'privacy' | 'service-details' | 'notifications' | 'offers' | 'tickets' | 'wallet' | 'amcs' | 'referrals'>('home');
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

  // Initialize app version cache on start
  useEffect(() => {
    if (!localStorage.getItem('app_version')) {
      localStorage.setItem('app_version', '1.0.0');
    }
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
      const currentHash = window.location.hash.replace('#', '');
      if (currentHash !== activeTab) {
        window.history.pushState(null, '', `#${activeTab}`);
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
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as typeof activeTab;
      if (hash) {
        setActiveTabState(hash);
      } else {
        // Fallback to home when back button leads to root URL without hash
        setActiveTabState('home');
      }
    };

    // Set initial tab from hash if present, or fallback to standalone stored flow
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    const initialHash = window.location.hash.replace('#', '') as typeof activeTab;
    if (initialHash) {
      setActiveTabState(initialHash);
    } else if (isStandalone) {
      const savedTab = localStorage.getItem('zomindia_last_active_tab') as typeof activeTab | null;
      const savedCatId = localStorage.getItem('zomindia_last_selected_category_id');
      const savedBookingId = localStorage.getItem('zomindia_last_target_booking_id');
      const savedServiceId = localStorage.getItem('zomindia_last_selected_service_id');

      if (savedTab) {
        setActiveTabState(savedTab);
        if (savedCatId) setSelectedCategoryId(savedCatId);
        if (savedBookingId) setTargetBookingId(savedBookingId);
        if (savedServiceId) setSelectedServiceId(savedServiceId);
        window.history.replaceState(null, '', `#${savedTab}`);
      } else {
        window.history.replaceState(null, '', '#home');
      }
    } else {
      window.history.replaceState(null, '', '#home');
    }

    window.addEventListener('popstate', handleHashChange);
    return () => window.removeEventListener('popstate', handleHashChange);
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
          setVerificationFeedback("Email successfully verified! Unlocking application dashboard...");
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

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // ... previous profile logic
        const profileDoc = await getDoc(doc(db, 'users', u.uid));

        let profileEmail = '';
        if (profileDoc.exists()) {
          profileEmail = (profileDoc.data() as UserProfile).email || '';
        }

        const isAdminUser = u.email?.toLowerCase().trim() === 'sarthakwebtech@gmail.com' ||
                            profileEmail.toLowerCase().trim() === 'sarthakwebtech@gmail.com';

        let userRole: UserRole = 'customer';

        if (profileDoc.exists()) {
          const currentProfile = profileDoc.data() as UserProfile;
          userRole = currentProfile.role;

          if (isAdminUser) {
            userRole = 'admin';
            if (currentProfile.role !== 'admin' || currentProfile.adminSubRole !== 'head') {
              updateDoc(doc(db, 'users', u.uid), { role: 'admin', adminSubRole: 'head' }).catch(e => console.error("Admin sync failed", e));
            }
          }

          const profileUpdate: any = {
            ...currentProfile,
            role: userRole
          };
          if (isAdminUser || currentProfile.adminSubRole) {
            profileUpdate.adminSubRole = isAdminUser ? 'head' : currentProfile.adminSubRole;
          }
          setProfile(profileUpdate as UserProfile);
        } else {
          const newProfile: any = {
            uid: u.uid,
            displayName: u.displayName || 'User',
            email: u.email || '',
            phoneNumber: u.phoneNumber || '',
            role: isAdminUser ? 'admin' : 'customer',
            photoURL: u.photoURL || '',
            referralCode: `ZOM${u.uid.slice(0, 6).toUpperCase()}`,
            walletBalance: 100, // ₹100 Welcome Bonus on registration!
            notificationPreferences: {
              bookingUpdates: true,
              promotionalMessages: true
            },
            createdAt: Timestamp.now() as any,
          };
          if (isAdminUser) {
            newProfile.adminSubRole = 'head';
          }
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile as UserProfile);
          userRole = newProfile.role;
        }

        // Native Push Registration trigger
        try {
          const { registerPushNotifications } = await import('./lib/push-notifications');
          registerPushNotifications(u.uid);
        } catch (e) {
          console.error("Push registration trigger failed:", e);
        }

        // Forced redirection for admin
        const currentHash = window.location.hash.replace('#', '');
        if (userRole === 'admin' && (currentHash === 'home' || !currentHash || currentHash === 'partner-signup')) {
          setActiveTab('admin');
        } else if (userRole === 'partner' && (currentHash === 'home' || !currentHash)) {
          setActiveTab('partner');
        }

        // Global Active Booking Listener
        const q = query(
          collection(db, 'bookings'),
          where(userRole === 'partner' ? 'partnerId' : 'customerId', '==', u.uid),
          where('status', 'in', ['confirmed', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'payment_pending', 'pending_parts'])
        );
        unsubscribeBookings = onSnapshot(q, (snap) => {
          setHasActiveArrival(!snap.empty);
        });

      } else {
        setProfile(null);
        setHasActiveArrival(false);
        unsubscribeBookings();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeBookings();
    };
  }, []);

  // Generic live pipeline listener for system-critical backend force-reloads
  useEffect(() => {
    const updatesColRef = collection(db, 'system_updates');

    const unsubscribeSystemUpdates = onSnapshot(updatesColRef, (snapshot) => {
      if (snapshot.empty) return;

      let highestDoc: any = null;
      let highestVer = '1.0.0';

      snapshot.docs.forEach((d) => {
        const docData = d.data();
        let docVersion = docData.version || docData.app_version;
        if (!docVersion) {
          const ts = docData.createdAt 
            ? (docData.createdAt.seconds || Math.floor(Date.now() / 1000)) 
            : Math.floor(Date.now() / 1000);
          docVersion = `1.0.${ts}`;
        }

        if (isVersionHigher(docVersion, highestVer)) {
          highestDoc = docData;
          highestVer = docVersion;
        }
      });

      if (highestDoc) {
        const cachedVersion = localStorage.getItem('app_version') || '1.0.0';
        if (isVersionHigher(highestVer, cachedVersion)) {
          // If we have already skipped this precise version in this session, skip triggering again
          if (skippedUpdate && skippedUpdate.version === highestVer) {
            console.log(`[VersionCheck] User already skipped this version: ${highestVer}`);
            return;
          }

          const updateReasonText = highestDoc.reason || highestDoc.description || 'System administrator has initialized a critical synchronized ecosystem update.';
          const cleanReason = `Ecosystem Hard-Sync: ${updateReasonText}`;
          
          setPendingVersion(highestVer);
          setSystemUpdate({ reason: cleanReason });
        } else {
          console.log(`[VersionCheck] Bypassed update. Remote highest: ${highestVer}, Cached current: ${cachedVersion}`);
        }
      }
    }, (error) => {
      console.warn("Firestore 'system_updates' subscription bypassed:", error);
    });

    return () => unsubscribeSystemUpdates();
  }, [skippedUpdate]);

  // 90 second interval re-prompt if update dismissed but not yet updated
  useEffect(() => {
    if (skippedUpdate) {
      if (update90SecTimer.current) {
        clearInterval(update90SecTimer.current);
      }
      update90SecTimer.current = setInterval(() => {
        setSystemUpdate(prev => {
          if (!prev) {
            return skippedUpdate;
          }
          return prev;
        });
      }, 90000); // 90 seconds
    } else {
      if (update90SecTimer.current) {
        clearInterval(update90SecTimer.current);
        update90SecTimer.current = null;
      }
    }

    return () => {
      if (update90SecTimer.current) {
        clearInterval(update90SecTimer.current);
      }
    };
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
          setUpdateStep('Loading new updates...');
        } else if (current < 55) {
          setUpdateStep('Checking connection...');
        } else if (current < 85) {
          setUpdateStep('Syncing catalog info...');
        } else {
          setUpdateStep('Completing update...');
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
    { id: 'partner-signup', label: 'Become Partner', roles: ['customer', 'admin'] as UserRole[] },
  ];

  const renderNavigation = () => {
    return (
      <div className="hidden md:flex items-center gap-8">
        {getNavLinks()
          .filter(link => {
            // Remove tabs relocated to the Profile settings area
            const excludedIds = ['referrals', 'amcs', 'profile', 'partner-signup'];
            if (excludedIds.includes(link.id)) return false;

            // Only show logic:
            // 1. Link role matches user role
            return link.roles.includes((profile?.role as any) || 'anon');
          })
          .map(link => (
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
          ))}
      </div>
    );
  };

  const renderContent = () => {
    const handleServiceSelect = (id: string) => {
      setSelectedServiceId(id);
      setActiveTab('service-details');
    };

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
            <CustomerHome setActiveTab={setActiveTab} profile={null} onAuthRequired={() => setIsAuthModalOpen(true)} onServiceSelect={handleServiceSelect} initialCategoryId={selectedCategoryId} />
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
          <ProfileSettings profile={profile} onUpdate={(updated) => setProfile(updated)} setActiveTab={setActiveTab} />
        </motion.div>
      );
    }

    if (activeTab === 'about') {
      return (
        <StaticPage
          title="About zomindia"
          content="zomindia is India's leading on-demand service marketplace, dedicated to bringing quality and reliability to every home. We connect skilled service professionals with individuals looking for expert help in cleaning, maintenance, repairs, and beauty services.

Founded with the vision of formalizing the fragmented home services industry in India, zomindia ensures that every partner on our platform undergoes a rigorous background verification process and training to deliver exceptional service standards.

Whether you're looking for a deep home cleaning, an expert electrician, or a relaxing salon experience at home, zomindia is your one-stop solution for a better living experience."
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
                    A dynamic leader with a strong track record in operational efficiency, Ranu oversees our service quality assurance, scheduling integrity, and partner coordination programs, ensuring seamless service delivery across Central India.
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
          content="Have questions or need assistance with a booking? Our dedicated support team is here to help you 24/7.

Email: support@zomindia.com
Phone: +91 1800-ZOM-INDIA
HQ Address: 4th Floor, Tech Hub, Gurgaon, Haryana, India.

For business inquiries or corporate partnerships, please reach out to business@zomindia.com."
          onBack={() => setActiveTab('home')}
        />
      );
    }

    if (activeTab === 'help') {
      return (
        <StaticPage
          title="Help Center"
          content="Welcome to the zomindia Help Center. Find answers to common questions about bookings, payments, and our service quality guarantee.

How do I book a service?
Simply browse our categories, select a service, and choose a time slot that works for you. You can pay securely through the platform after the service is completed.

What is the Quality Guarantee?
If you're not satisfied with a service, please let us know within 24 hours. We will investigate and, if necessary, arrange for a re-service at no additional cost.

What if my service partner is late?
Our partners strive for punctuality. If a delay occurs, you will be notified and can contact support. We offer compensation for significant delays.

Can I cancel my booking?
Yes, you can cancel your booking through the 'My Bookings' tab up to 4 hours before the scheduled time for a full refund."
          onBack={() => setActiveTab('home')}
        />
      );
    }

    if (activeTab === 'terms') {
      return (
        <StaticPage
          title="Terms of Service"
          content="By using the zomindia platform, you agree to the following terms and conditions:

1. User Accounts: You are responsible for maintaining the confidentiality of your account and password.
2. Booking & Payments: Payments for services must be made through our authorized payment gateways or as cash on delivery if specified.
3. Cancellations: Certain cancellation fees may apply if bookings are cancelled within a short window of the scheduled time.
4. Partner Conduct: While we verify our partners, zomindia acts as a marketplace and users should exercise normal precautions.
5. Limitation of Liability: zomindia is not liable for indirect or consequential damages arising from the use of the platform."
          onBack={() => setActiveTab('home')}
        />
      );
    }

    if (activeTab === 'privacy') {
      return (
        <StaticPage
          title="Privacy Policy"
          content="Your privacy is of paramount importance to zomindia. This policy outlines how we collect, use, and protect your personal information.

Data Collection: We collect your name, contact details, and address to facilitate service delivery.
Data Usage: Your information is shared with assigned service partners only for the purpose of completing your booking.
Data Security: We implement industry-standard encryption and security protocols to safeguard your personal data.
Marketing: We may send you promotional offers if you have opted in to receive them. You can opt-out at any time."
          onBack={() => setActiveTab('home')}
        />
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
       <AppInstallPopup />
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
                className="h-7 sm:h-9 md:h-10 transition-all duration-300 group-hover:drop-shadow-[0_0_10px_rgba(5,12,166,0.3)]" 
                src={headerLogoImg} 
              />

              {/* Head Admin Upload Input & Edit Controls */}
              {user?.email === 'sarthakwebtech@gmail.com' && (
                <>
                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={handleLogoUpload}
                    className="hidden"
                    accept="image/*"
                  />
                  <div className="absolute -top-1.5 -right-1.5 flex gap-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        logoInputRef.current?.click();
                      }}
                      className="p-1 bg-blue-600 text-white rounded-full hover:bg-blue-700 hover:scale-110 active:scale-95 shadow-md transition-all duration-200 cursor-pointer"
                      title="Upload Custom Brand Logo"
                    >
                      <Pencil size={11} />
                    </button>
                    {localStorage.getItem('custom_zomindia_brand_logo') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Reset logo back to default branding?")) {
                            localStorage.removeItem('custom_zomindia_brand_logo');
                            window.dispatchEvent(new Event('storage'));
                            setToastMessage("Logo reset to default successfully! ✨");
                          }
                        }}
                        className="p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700 hover:scale-110 active:scale-95 shadow-md transition-all duration-200 cursor-pointer"
                        title="Reset Logo to Default"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>

            {renderNavigation()}

             <div className="flex items-center gap-2 sm:gap-4">
              {profile && (
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`relative p-2.5 rounded-xl transition-all ${activeTab === 'notifications' ? 'bg-blue-700 text-white shadow-xl shadow-blue-700/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  <Bell size={20} />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
                </button>
              )}
              {profile ? (
                <div className="flex items-center gap-3 sm:gap-6 relative">
                  <div className="text-right hidden sm:block">
                    <p className="text-[11px] font-bold text-slate-900 leading-none mb-1">{profile.displayName}</p>
                    <span className={`text-[9px] font-black uppercase tracking-[0.1em] leading-none px-2 py-0.5 rounded-md ${
                      profile.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      profile.role === 'partner' ? 'bg-blue-700 text-white' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {profile.role}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-blue-700 hover:text-white transition-all shadow-sm overflow-hidden"
                  >
                    {profile.photoURL ? (
                       <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                       <UserIcon size={18} />
                    )}
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full right-0 mt-4 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60]"
                      >
                        <button
                          onClick={() => { setActiveTab('profile'); setIsUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all"
                        >
                          <UserIcon size={16} />
                          Profile
                        </button>
                        <button
                          onClick={() => { setActiveTab('amcs'); setIsUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all"
                        >
                          <Calendar size={16} />
                          Annual Contracts (AMC)
                        </button>
                        <button
                          onClick={() => { setActiveTab('wallet'); setIsUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                          Wallet
                        </button>
                        <button
                          onClick={() => { setActiveTab('tickets'); setIsUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all"
                        >
                          <MessageSquare size={16} />
                          Support Tickets
                        </button>
                        <button
                          onClick={() => { setActiveTab('referrals'); setIsUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                          Refer & Earn
                        </button>
                        {profile.role !== 'partner' && (
                          <button
                            onClick={() => { setActiveTab('partner-signup'); setIsUserMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2005/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
                            Become Partner
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            window.dispatchEvent(new CustomEvent('toggle-ai-chat', { detail: { open: true } }));
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700 rounded-xl transition-all border-t border-slate-100"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 animate-pulse"><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                          <span className="font-semibold text-slate-800">🤖 AI Support Chat</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="bg-blue-700 text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/10 active:scale-95"
                >
                  Login
                </button>
              )}
              <button
                className="md:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                id="mobile-menu-toggle"
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Email Verification Required Banner */}
      {user && !user.emailVerified && user.email && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3 sm:py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-bold shadow-sm transition-all">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 animate-pulse shrink-0 mt-0.5 sm:mt-0">
              <Mail size={16} />
            </div>
            <div className="flex flex-col gap-1 min-w-0 text-left">
              <span className="leading-relaxed">Verify your email to secure your account. Verification link sent to <span className="underline text-amber-950 font-black break-all">{user.email}</span>.</span>
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
                    userFriendlyMsg = "Spam protection: Too many requests. Please wait a few minutes before resending.";
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
                    setVerificationFeedbackError("Email still not verified. Click the link we sent, or click resend.");
                    setTimeout(() => setVerificationFeedbackError(null), 5000);
                  }
                } catch (err: any) {
                  setVerificationFeedbackError(err.message || "Failed to sync status.");
                  setTimeout(() => setVerificationFeedbackError(null), 5000);
                } finally {
                  setVerificationLoading(false);
                }
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all uppercase tracking-wider text-[9px] font-black shadow-md shadow-amber-500/20"
            >
              Verify Status
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
            <div className="px-4 py-8 flex flex-col gap-1">
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

      {/* Main Content */}
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
                <Logo size={25} src={footerLogoImg} />
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
                      className="hover:text-blue-700 hover:translate-x-1 hover:underline transition-all duration-200 flex items-center font-bold"
                    >
                      {tabKey === 'about' ? 'About Us' : tabKey === 'contact' ? 'Contact Support' : 'Exclusive Offers'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-widest font-mono">Support</h4>
              <ul className="space-y-2.5 text-sm font-semibold text-slate-500">
                {['help', 'terms', 'privacy'].map((tabKey) => (
                  <li key={tabKey}>
                    <button
                      onClick={() => setActiveTab(tabKey as any)}
                      className="hover:text-blue-700 hover:translate-x-1 hover:underline transition-all duration-200 flex items-center font-bold"
                    >
                      {tabKey === 'help' ? 'Help Center' : tabKey === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs font-bold text-slate-400">© 2026 zomindia. All rights reserved.</p>
            <div className="flex gap-6">
              {/* Optional footer social link decoration */}
            </div>
          </div>
        </div>
      </motion.footer>
      <OfflineSyncIndicator />
      <AppInstallPopup />

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
