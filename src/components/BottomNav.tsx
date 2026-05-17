import React from 'react';
import { Home, ClipboardList, TicketPercent, User, Bell } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  hasNotifications?: boolean;
  isAuthenticated: boolean;
  hasActiveArrival?: boolean;
}

export default function BottomNav({ activeTab, setActiveTab, hasNotifications, isAuthenticated, hasActiveArrival }: BottomNavProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'bookings', label: 'Bookings', icon: ClipboardList, badge: hasActiveArrival },
    { id: 'offers', label: 'Offers', icon: TicketPercent },
    ...(isAuthenticated ? [
      { id: 'profile', label: 'Profile', icon: User },
    ] : []),
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pointer-events-none safe-area-bottom">
      <div className="bg-white/90 backdrop-blur-2xl border border-white/20 rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] flex items-center justify-between p-1.5 pointer-events-auto max-w-sm mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="relative flex flex-col items-center justify-center py-2 transition-all flex-1"
            >
              <div className={`relative px-5 py-2.5 rounded-2xl transition-all duration-500 flex flex-col items-center gap-1 ${isActive ? 'text-blue-700' : 'text-slate-400 active:scale-90'}`}>
                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute inset-0 bg-blue-50 rounded-2xl -z-10"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} className="transition-transform duration-300" />
                <span className={`text-[9px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                  {item.label}
                </span>
                {item.badge && (
                  <span className="absolute top-2 right-4 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white shadow-sm animate-pulse" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
