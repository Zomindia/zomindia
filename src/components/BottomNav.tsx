import React from 'react';
import { Home, ClipboardList, TicketPercent, User } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  hasNotifications?: boolean;
  isAuthenticated?: boolean;
  hasActiveArrival?: boolean;
}

export default function BottomNav({
  activeTab,
  setActiveTab,
  hasNotifications,
  isAuthenticated,
  hasActiveArrival
}: BottomNavProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'bookings', label: 'Bookings', icon: ClipboardList, badge: hasActiveArrival },
    { id: 'offers', label: 'Offers', icon: TicketPercent },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="bg-white/95 backdrop-blur-lg border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] fixed bottom-0 left-0 right-0 z-50"
    >
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-around safe-area-bottom">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-all group cursor-pointer ${
                isActive ? 'text-blue-600 font-semibold' : 'text-gray-400 hover:text-gray-600 transition-colors'
              }`}
            >
              <div
                className={`relative flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50/80 text-blue-600 shadow-sm rounded-xl px-3 py-1'
                    : 'text-gray-400 hover:text-gray-600 transition-colors px-3 py-1'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active-glow"
                    className="absolute inset-0 bg-blue-50/80 shadow-sm rounded-xl -z-10"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className="transition-transform duration-200 group-active:scale-95"
                />
                {item.badge && (
                  <span className="absolute top-0.5 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white shadow-xs animate-pulse" />
                )}
              </div>
              <span
                className={`text-[10px] sm:text-xs font-medium mt-1 transition-colors ${
                  isActive
                    ? 'text-blue-600 font-semibold'
                    : 'text-gray-400 hover:text-gray-600 transition-colors'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
