/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile, UserRole, Booking } from './types';
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
  LogOut,
  LayoutDashboard,
  ChevronRight,
  Bell,
  History,
  TicketPercent,
  Settings,
  Zap,
  MessageSquare
} from 'lucide-react';

// Modules
import CustomerHome from './components/CustomerHome';
import CustomerDashboard from './components/CustomerDashboard';
import AdminDashboard from './components/AdminDashboard';
import SignUpAsPartner from './components/SignUpAsPartner';
import StaticPage from './components/StaticPage';
import NotificationSystem from './components/NotificationSystem';
import ProfileSettings from './components/ProfileSettings';
import AuthModal from './components/AuthModal';
import ServiceDetails from './components/ServiceDetails';
import NotificationsView from './components/NotificationsView';
import OffersView from './components/OffersView';
import BookingHistory from './components/BookingHistory';
import BottomNav from './components/BottomNav';
import PartnerApp from './components/PartnerApp';

import SupportTicketsView from './components/SupportTicketsView';
import AiSupportChat from './components/AiSupportChat';
import WalletView from './components/WalletView';

const Logo = ({ size = 20, light = false }: { size?: number, light?: boolean }) => (
  <div className="flex items-center gap-2 group">
    <div 
      className={`flex items-center justify-center ${light ? 'bg-white' : 'bg-[#050CA6]'}`}
      style={{ 
        width: size * 1.4, 
        height: size * 1.4, 
        borderRadius: '8px',
      }}
    >
      <span className={`font-black tracking-tighter ${light ? 'text-slate-900' : 'text-white'}`} style={{ fontSize: size * 0.8 }}>Z</span>
    </div>
    <div className="flex flex-col">
      <span className={`font-bold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: size }}>zomindia</span>
    </div>
  </div>
);

const MobileNavItem = ({ onClick, label, isActive, index }: { onClick: () => void, label: string, isActive: boolean, index: number, key?: any }) => (
  <motion.button 
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    onClick={onClick} 
    className={`w-full text-left py-4 px-6 rounded-2xl font-bold flex items-center justify-between group transition-all ${isActive ? 'bg-blue-700 text-white shadow-xl shadow-blue-700/20/10' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-700'}`}
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<'home' | 'bookings' | 'profile' | 'admin' | 'partner' | 'partner-signup' | 'about' | 'contact' | 'help' | 'terms' | 'privacy' | 'service-details' | 'notifications' | 'offers' | 'tickets' | 'wallet'>('home');
  const [targetBookingId, setTargetBookingId] = useState<string | null>(null);

  // Sync state with hash and handle popstate for browser back button
  const setActiveTab = (tab: typeof activeTab, bId: string | null = null) => {
    setActiveTabState(tab);
    setTargetBookingId(bId);
    window.history.pushState(null, '', `#${tab}`);
  };

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

    // Set initial tab from hash if present
    const initialHash = window.location.hash.replace('#', '') as typeof activeTab;
    if (initialHash) {
      setActiveTabState(initialHash);
    } else {
      window.history.replaceState(null, '', '#home');
    }
    
    window.addEventListener('popstate', handleHashChange);
    return () => window.removeEventListener('popstate', handleHashChange);
  }, []);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasActiveArrival, setHasActiveArrival] = useState(false);

  useEffect(() => {
    seedDatabase();
    let unsubscribeBookings = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // ... previous profile logic
        const profileDoc = await getDoc(doc(db, 'users', u.uid));
        const isAdminUser = u.email === 'sarthakwebtech@gmail.com';
        
        let userRole: UserRole = 'customer';

        if (profileDoc.exists()) {
          const currentProfile = profileDoc.data() as UserProfile;
          userRole = currentProfile.role;
          if (isAdminUser && currentProfile.role !== 'admin') {
            await updateDoc(doc(db, 'users', u.uid), { role: 'admin' });
            userRole = 'admin';
          }
          setProfile({ ...currentProfile, role: userRole });
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            displayName: u.displayName || 'User',
            email: u.email || '',
            phoneNumber: u.phoneNumber || '',
            role: isAdminUser ? 'admin' : 'customer',
            photoURL: u.photoURL || '', 
            referralCode: `ZOM${u.uid.slice(0, 6).toUpperCase()}`,
            walletBalance: 0,
            createdAt: Timestamp.now() as any, 
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
          userRole = newProfile.role;
        }

        setActiveTab(current => {
          if (userRole === 'partner' && (current === 'home' || current === 'profile')) return 'partner';
          if (userRole === 'admin' && (current === 'home' || current === 'profile')) return 'admin';
          return current;
        });

        // Global Active Booking Listener
        const q = query(
          collection(db, 'bookings'), 
          where(userRole === 'partner' ? 'partnerId' : 'customerId', '==', u.uid),
          where('status', 'in', ['on_the_way', 'arrived'])
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <Logo size={32} />
        </motion.div>
      </div>
    );
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
    { id: 'bookings', label: 'Bookings', roles: ['customer', 'partner', 'admin'] as UserRole[] },
    { id: 'notifications', label: 'Notifications', roles: ['customer', 'partner', 'admin'] as UserRole[] },
    { id: 'profile', label: 'Settings', roles: ['customer', 'partner', 'admin'] as UserRole[] },
    { id: 'partner', label: 'Partner Dashboard', roles: ['partner'] as UserRole[] },
    { id: 'admin', label: 'Admin Panel', roles: ['admin'] as UserRole[] },
  ];

  const renderNavigation = () => {
    return (
      <div className="hidden md:flex items-center gap-8">
        {getNavLinks()
          .filter(link => link.roles.includes(profile?.role || 'anon'))
          .map(link => (
            <button 
              key={link.id}
              onClick={() => setActiveTab(link.id as any)} 
              className={`text-sm font-semibold transition-all relative py-1 ${activeTab === link.id ? 'text-slate-900' : 'text-slate-500 hover:text-blue-700'}`}
            >
              {link.label}
              {activeTab === link.id && (
                <motion.div layoutId="nav-underline" className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-blue-700" />
              )}
            </button>
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
           />
         );
       }
       return <CustomerHome setActiveTab={setActiveTab} profile={null} onAuthRequired={() => setIsAuthModalOpen(true)} onServiceSelect={handleServiceSelect} />;
    }

    if (activeTab === 'service-details' && selectedServiceId) {
      return (
        <ServiceDetails 
          serviceId={selectedServiceId} 
          profile={profile} 
          onBack={() => setActiveTab('home')} 
          onAuthRequired={() => setIsAuthModalOpen(true)}
          onSuccess={() => setActiveTab('home')}
        />
      );
    }

    if (activeTab === 'bookings' && profile.role === 'customer') {
      return <CustomerDashboard profile={profile} onServiceSelect={handleServiceSelect} initialExpandedBookingId={targetBookingId} setActiveTab={setActiveTab} />;
    }

    if (profile?.role === 'customer' && activeTab === 'partner-signup') {
      return <SignUpAsPartner profile={profile} onSuccess={() => { setActiveTab('partner'); }} />;
    }

    if (activeTab === 'profile') {
      return <ProfileSettings profile={profile} onUpdate={(updated) => setProfile(updated)} />;
    }

    if (activeTab === 'about') {
      return (
        <StaticPage 
          title="About zomindia" 
          content="zomindia is India's leading on-demand service marketplace, dedicated to bringing quality and reliability to every home. We connect skilled service professionals with individuals looking for expert help in cleaning, maintenance, repairs, and beauty services.

Founded with the vision of formalizing the fragmented home services industry in India, zomindia ensures that every partner on our platform undergoes a rigorous background verification process and training to deliver exceptional service standards.

Whether you're looking for a deep home cleaning, an expert electrician, or a relaxing salon experience at home, zomindia is your one-stop solution for a better living experience." 
          onBack={() => setActiveTab('home')} 
        />
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
      return <WalletView profile={profile} />;
    }

    if (activeTab === 'bookings' && profile) {
      return <BookingHistory profile={profile} />;
    }

    if (profile?.role === 'admin' && (activeTab === 'admin' || activeTab === 'home')) {
      return <AdminDashboard profile={profile} />;
    }

    if (profile?.role === 'partner' && (activeTab === 'partner' || activeTab === 'bookings' || activeTab === 'home')) {
      return <PartnerApp profile={profile} initialTab={activeTab === 'bookings' ? 'jobs' : 'home'} targetBookingId={targetBookingId} />;
    }

    // Default to Customer View
    return <CustomerHome setActiveTab={setActiveTab} profile={profile} onAuthRequired={() => setIsAuthModalOpen(true)} onServiceSelect={handleServiceSelect} />;
  };

  if (profile?.role === 'partner') {
    return (
      <APIProvider apiKey={API_KEY} version="weekly">
        <div className="min-h-screen bg-slate-100 flex justify-center">
           <NotificationSystem />
           <PartnerApp profile={profile} />
        </div>
      </APIProvider>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <NotificationSystem />
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-200/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div 
              className="flex items-center cursor-pointer group" 
              onClick={() => setActiveTab('home')}
              id="nav-logo"
            >
              <Logo size={24} />
            </div>

            {renderNavigation()}

             <div className="flex items-center gap-2 sm:gap-4">
              {profile && (
                <button 
                  onClick={() => setActiveTab('notifications')}
                  className={`relative p-2.5 rounded-xl transition-all ${activeTab === 'notifications' ? 'bg-blue-700 text-white shadow-xl shadow-blue-700/20/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
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
                          onClick={() => { signOut(auth); setIsUserMenuOpen(false); setActiveTab('home'); }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className="bg-blue-700 text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/20/10 active:scale-95"
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
                .filter(link => link.roles.includes(profile?.role || 'anon'))
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
                    className="w-full py-4 px-6 bg-blue-700 text-white rounded-2xl font-bold text-center shadow-xl shadow-blue-700/20/20"
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
        onSuccess={() => setIsAuthModalOpen(false)}
      />

      {/* Main Content */}
      <main className="pb-24 md:pb-0 relative min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 pt-16 pb-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="mb-6">
                <Logo size={24} />
              </div>
              <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
                India's trusted home service ecosystem. Connecting homeowners with verified professional service partners for a better living. 
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><button onClick={() => setActiveTab('about')} className="hover:text-blue-700 transition-colors">About Us</button></li>
                <li><button onClick={() => setActiveTab('contact')} className="hover:text-blue-700 transition-colors">Contact</button></li>
                <li><button onClick={() => setActiveTab('offers')} className="hover:text-blue-700 transition-colors">Exclusive Offers</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><button onClick={() => setActiveTab('help')} className="hover:text-blue-700 transition-colors">Help Center</button></li>
                <li><button onClick={() => setActiveTab('terms')} className="hover:text-blue-700 transition-colors">Terms of Service</button></li>
                <li><button onClick={() => setActiveTab('privacy')} className="hover:text-blue-700 transition-colors">Privacy Policy</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-400">© 2026 zomindia. All rights reserved.</p>
            <div className="flex gap-6">
              {/* Social links could go here */}
            </div>
          </div>
        </div>
      </footer>
    </div>
    </APIProvider>
  );
}
