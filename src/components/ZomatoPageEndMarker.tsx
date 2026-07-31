import React from 'react';

interface ZomatoPageEndMarkerProps {
  pageName: string;
  isDark?: boolean;
}

export function getPageDisplayName(activeTab: string): string {
  switch (activeTab) {
    case 'home':
      return 'Zomindia Home';
    case 'profile':
      return 'Profile & Settings';
    case 'bookings':
      return 'My Bookings';
    case 'offers':
      return 'Exclusive Offers';
    case 'amcs':
      return 'Annual Service Contracts';
    case 'wallet':
      return 'My Wallet';
    case 'notifications':
      return 'Notifications';
    case 'tickets':
      return 'Support Tickets';
    case 'referrals':
      return 'Refer & Earn';
    case 'service-details':
      return 'Service Details';
    case 'partner-signup':
      return 'Elite Partner Application';
    case 'terms':
      return 'Terms of Service';
    case 'privacy':
      return 'Privacy Policy';
    case 'refund':
      return 'Cancellation & Refund';
    case 'partner':
      return 'Partner Dashboard';
    case 'admin':
      return 'Admin Panel';
    default:
      return 'Page';
  }
}

export default function ZomatoPageEndMarker({ pageName, isDark = true }: ZomatoPageEndMarkerProps) {
  return (
    <div className="w-full py-10 px-4 flex flex-col items-center justify-center gap-2.5 select-none mt-auto">
      <div className="flex items-center gap-3 w-full max-w-xs opacity-35">
        <div className={`h-px flex-1 ${isDark ? 'bg-gradient-to-r from-transparent via-slate-500 to-slate-400' : 'bg-gradient-to-r from-transparent via-slate-300 to-slate-400'}`} />
        <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-600'}`} />
        <div className={`h-px flex-1 ${isDark ? 'bg-gradient-to-l from-transparent via-slate-500 to-slate-400' : 'bg-gradient-to-l from-transparent via-slate-300 to-slate-400'}`} />
      </div>

      <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold tracking-wide shadow-lg border transition-all ${
        isDark
          ? 'bg-slate-900/90 text-slate-200 border-slate-800/80 shadow-black/40'
          : 'bg-white text-slate-700 border-slate-200/80 shadow-slate-200/60'
      }`}>
        <span className="text-emerald-400 font-black animate-pulse">✨</span>
        <span>You've reached the end of <strong className={isDark ? 'text-white font-black' : 'text-slate-900 font-black'}>{pageName}</strong></span>
      </div>

      <div className="text-[10px] uppercase font-black tracking-widest text-slate-500 opacity-60">
        ZOMINDIA HOME SERVICES • INDORE
      </div>
    </div>
  );
}
