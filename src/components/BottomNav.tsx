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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pointer-events-none">
      <div className="bg-white/90 backdrop-blur-2xl border border-stone-200/50 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center justify-around p-2 pointer-events-auto max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="relative flex flex-col items-center justify-center py-2 px-1 transition-all flex-1"
            >
              <div className={`relative p-2.5 rounded-2xl transition-all duration-500 mb-1 ${isActive ? 'bg-stone-900 text-white shadow-xl shadow-stone-900/30 scale-110' : 'text-stone-400 hover:text-stone-600'}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {item.badge && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white shadow-sm" />
                )}
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? 'text-stone-900 opacity-100 transform translate-y-0' : 'text-stone-400 opacity-60 translate-y-1'}`}>
                {item.label}
              </span>
              {isActive && (
                <motion.span 
                  layoutId="bottom-nav-indicator"
                  className="absolute -bottom-1 w-8 h-1 bg-stone-900 rounded-full" 
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
