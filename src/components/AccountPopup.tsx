import React, { useEffect } from 'react';
import { 
  X, 
  User, 
  Calendar, 
  Tag, 
  MapPin, 
  ShieldCheck, 
  MessageSquare, 
  LogOut, 
  ChevronRight, 
  Wallet 
} from 'lucide-react';
import { auth } from '../services/firebase';
import { UserProfile } from '../types';

export type AccountNavTab =
  | 'profile'
  | 'bookings'
  | 'amcs'
  | 'wallet'
  | 'admin'
  | 'partner'
  | 'offers'
  | 'help';

export interface AccountPopupProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  profile?: UserProfile | any | null;
  mode?: 'auto' | 'desktop' | 'mobile';
  currentMode?: 'customer' | 'partner';
  onSwitchMode?: (mode: 'customer' | 'partner') => void;
  onNavigate?: (tab: any, subTabOrArg?: string | null) => void;
  onOpenSupport?: () => void;
  onOpenAiSupport?: () => void;
  onOpenZomini?: () => void;
  onLogout?: () => Promise<void> | void;
  onOpenWallet?: () => void;
  onOpenProfileSettings?: () => void;
  onOpenBookings?: () => void;
  onOpenOffers?: () => void;
  onOpenAddresses?: () => void;
  onOpenAmc?: () => void;
}

export const AccountPopup: React.FC<AccountPopupProps> = ({
  isOpen,
  onClose,
  user,
  profile,
  mode = 'auto',
  currentMode,
  onSwitchMode,
  onNavigate = () => {},
  onOpenSupport,
  onOpenAiSupport,
  onOpenZomini,
  onLogout,
  onOpenWallet,
  onOpenProfileSettings,
  onOpenBookings,
  onOpenOffers,
  onOpenAddresses,
  onOpenAmc,
}) => {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentUser = user || profile || {};

  const displayName =
    currentUser.displayName && currentUser.displayName !== 'User'
      ? currentUser.displayName
      : currentUser.fullName || 'कस्टमर';

  const phoneOrEmail =
    currentUser.phoneNumber ||
    currentUser.mobile ||
    currentUser.email ||
    '+91 97521 70789';

  const walletBalanceDisplay =
    currentUser.walletBalance !== undefined && currentUser.walletBalance !== null
      ? `₹${Number(currentUser.walletBalance).toLocaleString('en-IN')}`
      : '₹0';

  const handleAction = (tab: string, subTab?: string | null) => {
    if (tab === 'wallet' && onOpenWallet) {
      onOpenWallet();
    } else if (tab === 'bookings' && onOpenBookings) {
      onOpenBookings();
    } else if (tab === 'offers' && onOpenOffers) {
      onOpenOffers();
    } else if (tab === 'amcs' && onOpenAmc) {
      onOpenAmc();
    } else if (tab === 'profile' && subTab === 'addresses' && onOpenAddresses) {
      onOpenAddresses();
    } else if (tab === 'profile' && onOpenProfileSettings) {
      onOpenProfileSettings();
    } else {
      onNavigate(tab, subTab);
    }

    try {
      if (tab === 'wallet') {
        window.dispatchEvent(new CustomEvent('open-wallet-modal', { detail: { open: true } }));
        window.dispatchEvent(new CustomEvent('open-wallet-view', { detail: { open: true } }));
      } else if (tab === 'bookings') {
        window.dispatchEvent(new CustomEvent('open-bookings-view', { detail: { open: true } }));
      } else if (tab === 'offers') {
        window.dispatchEvent(new CustomEvent('open-offers-view', { detail: { open: true } }));
      } else if (tab === 'amcs') {
        window.dispatchEvent(new CustomEvent('open-amc-view', { detail: { open: true } }));
      } else if (tab === 'profile') {
        window.dispatchEvent(new CustomEvent('open-profile-settings', { detail: { open: true } }));
        if (subTab === 'addresses') {
          window.dispatchEvent(new CustomEvent('open-profile-section', { detail: { section: 'addresses' } }));
          window.dispatchEvent(new CustomEvent('open-address-modal', { detail: { open: true } }));
        }
      }
    } catch {
      // safe fallback
    }

    onClose();
  };

  const handleLogout = async () => {
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await auth.signOut();
        localStorage.clear();
        sessionStorage.clear();
        onClose();
        window.location.reload();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const menuItems = [
    {
      id: 'wallet',
      label: 'My Wallet / वॉलेट',
      icon: Wallet,
      badge: `${walletBalanceDisplay} Balance`,
      action: () => handleAction('wallet')
    },
    {
      id: 'bookings',
      label: 'My Bookings / मेरी बुकिंग्स',
      icon: Calendar,
      action: () => handleAction('bookings')
    },
    {
      id: 'profile',
      label: 'Profile & Settings / प्रोफ़ाइल',
      icon: User,
      action: () => handleAction('profile')
    },
    {
      id: 'offers',
      label: 'Offers & Coupons / ऑफ़र्स',
      icon: Tag,
      action: () => handleAction('offers')
    },
    {
      id: 'addresses',
      label: 'Saved Addresses / पते',
      icon: MapPin,
      action: () => handleAction('profile', 'addresses')
    },
    {
      id: 'amcs',
      label: 'Annual Maintenance (AMC)',
      icon: ShieldCheck,
      action: () => handleAction('amcs')
    },
    {
      id: 'support',
      label: 'Help & Support (ZOMINI)',
      icon: MessageSquare,
      action: () => {
        if (onOpenZomini) onOpenZomini();
        else if (onOpenAiSupport) onOpenAiSupport();
        else if (onOpenSupport) onOpenSupport();
        else {
          window.dispatchEvent(new CustomEvent('toggle-ai-chat', { detail: { open: true } }));
          window.dispatchEvent(new CustomEvent('open-zomini', { detail: { open: true } }));
        }
        onClose();
      }
    }
  ];

  const responsiveClass =
    mode === 'desktop' ? 'hidden md:flex' :
    mode === 'mobile' ? 'flex md:hidden' :
    'flex';

  return (
    <div 
      className={`fixed inset-0 z-[100] justify-end bg-black/50 backdrop-blur-sm animate-fade-in ${responsiveClass}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-slide-left relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-amber-50">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-lg shadow shrink-0 overflow-hidden">
                {currentUser?.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={displayName} 
                    className="w-full h-full object-cover" 
                  />
                ) : displayName ? (
                  displayName.slice(0, 2).toUpperCase()
                ) : (
                  'HI'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-gray-800 text-base truncate">
                  {displayName}
                </h3>
                <p className="text-xs text-gray-500 truncate">
                  {phoneOrEmail}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    📍 Indore (MP)
                  </span>
                </div>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-amber-100 text-gray-600 transition cursor-pointer shrink-0"
              aria-label="Close Account Menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Action Navigation Items */}
          <div className="p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-amber-50/70 active:bg-amber-100/70 transition text-left group cursor-pointer border border-transparent hover:border-amber-200/50"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="p-2 rounded-lg bg-gray-50 group-hover:bg-amber-100 text-gray-600 group-hover:text-amber-700 transition shrink-0">
                      <Icon size={18} />
                    </div>
                    <span className="font-medium text-gray-700 group-hover:text-gray-900 text-sm truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 ml-2">
                    {item.badge && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold border border-amber-200">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}

            {/* Optional Partner Mode Switch button if onSwitchMode is supplied */}
            {onSwitchMode && (
              <div className="pt-2 mt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = currentMode === 'partner' ? 'customer' : 'partner';
                    onSwitchMode(nextMode);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition text-left cursor-pointer border border-slate-200/60"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-white text-slate-700 shadow-xs">
                      <ShieldCheck size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 text-sm block">
                        {currentMode === 'partner' ? 'Switch to Customer View' : 'Partner Portal / पार्टनर लॉगिन'}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {currentMode === 'partner' ? 'Return to Home Services' : 'Earn with ZOMINDIA • इंदौर'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/60 space-y-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 p-3 text-red-600 font-medium hover:bg-red-50 active:bg-red-100 rounded-xl transition cursor-pointer border border-red-200 bg-white shadow-xs"
          >
            <LogOut size={18} className="shrink-0" />
            <span className="text-sm font-semibold">लॉगआउट / Log Out</span>
          </button>
          
          <div className="text-center">
            <p className="text-[11px] font-medium text-gray-500">
              ZOMINDIA Home Services • Indore (MP)
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              100% Verified Experts & Standard Pricing
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPopup;
