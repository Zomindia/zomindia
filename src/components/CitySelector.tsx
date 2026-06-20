import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, MapPin, AlertCircle, Check, ArrowRight } from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import axios from 'axios';

// States and cities definitions
export const STATE_CITIES: Record<string, { stateName: string; cities: string[] }> = {
  MP: { stateName: 'Madhya Pradesh', cities: ['Indore', 'Bhopal', 'Gwalior', 'Jabalpur', 'Ujjain'] },
  MH: { stateName: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane'] },
  KA: { stateName: 'Karnataka', cities: ['Bengaluru', 'Mysuru', 'Hubli', 'Mangaluru'] },
  TN: { stateName: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Trichy'] },
  AP: { stateName: 'Andhra Pradesh', cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore'] },
  RJ: { stateName: 'Rajasthan', cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'] },
  UP: { stateName: 'Uttar Pradesh', cities: ['Lucknow', 'Kanpur', 'Noida', 'Ghaziabad', 'Varanasi', 'Agra'] },
  HR: { stateName: 'Haryana', cities: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala'] },
  GJ: { stateName: 'Gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'] }
};

// Flatten cities for search box focus
const ALL_CITIES = [
  { name: 'Indore', stateCode: 'MP', stateName: 'Madhya Pradesh' },
  { name: 'Bhopal', stateCode: 'MP', stateName: 'Madhya Pradesh' },
  { name: 'Gwalior', stateCode: 'MP', stateName: 'Madhya Pradesh' },
  { name: 'Jabalpur', stateCode: 'MP', stateName: 'Madhya Pradesh' },
  { name: 'Ujjain', stateCode: 'MP', stateName: 'Madhya Pradesh' },
  { name: 'Mumbai', stateCode: 'MH', stateName: 'Maharashtra' },
  { name: 'Pune', stateCode: 'MH', stateName: 'Maharashtra' },
  { name: 'Nagpur', stateCode: 'MH', stateName: 'Maharashtra' },
  { name: 'Nashik', stateCode: 'MH', stateName: 'Maharashtra' },
  { name: 'Thane', stateCode: 'MH', stateName: 'Maharashtra' },
  { name: 'Bengaluru', stateCode: 'KA', stateName: 'Karnataka' },
  { name: 'Mysuru', stateCode: 'KA', stateName: 'Karnataka' },
  { name: 'Hubli', stateCode: 'KA', stateName: 'Karnataka' },
  { name: 'Mangaluru', stateCode: 'KA', stateName: 'Karnataka' },
  { name: 'Chennai', stateCode: 'TN', stateName: 'Tamil Nadu' },
  { name: 'Coimbatore', stateCode: 'TN', stateName: 'Tamil Nadu' },
  { name: 'Madurai', stateCode: 'TN', stateName: 'Tamil Nadu' },
  { name: 'Trichy', stateCode: 'TN', stateName: 'Tamil Nadu' },
  { name: 'Visakhapatnam', stateCode: 'AP', stateName: 'Andhra Pradesh' },
  { name: 'Vijayawada', stateCode: 'AP', stateName: 'Andhra Pradesh' },
  { name: 'Guntur', stateCode: 'AP', stateName: 'Andhra Pradesh' },
  { name: 'Nellore', stateCode: 'AP', stateName: 'Andhra Pradesh' },
  { name: 'Jaipur', stateCode: 'RJ', stateName: 'Rajasthan' },
  { name: 'Jodhpur', stateCode: 'RJ', stateName: 'Rajasthan' },
  { name: 'Udaipur', stateCode: 'RJ', stateName: 'Rajasthan' },
  { name: 'Kota', stateCode: 'RJ', stateName: 'Rajasthan' },
  { name: 'Ajmer', stateCode: 'RJ', stateName: 'Rajasthan' },
  { name: 'Lucknow', stateCode: 'UP', stateName: 'Uttar Pradesh' },
  { name: 'Kanpur', stateCode: 'UP', stateName: 'Uttar Pradesh' },
  { name: 'Noida', stateCode: 'UP', stateName: 'Uttar Pradesh' },
  { name: 'Ghaziabad', stateCode: 'UP', stateName: 'Uttar Pradesh' },
  { name: 'Varanasi', stateCode: 'UP', stateName: 'Uttar Pradesh' },
  { name: 'Agra', stateCode: 'UP', stateName: 'Uttar Pradesh' },
  { name: 'Gurugram', stateCode: 'HR', stateName: 'Haryana' },
  { name: 'Faridabad', stateCode: 'HR', stateName: 'Haryana' },
  { name: 'Panipat', stateCode: 'HR', stateName: 'Haryana' },
  { name: 'Ambala', stateCode: 'HR', stateName: 'Haryana' },
  { name: 'Ahmedabad', stateCode: 'GJ', stateName: 'Gujarat' },
  { name: 'Surat', stateCode: 'GJ', stateName: 'Gujarat' },
  { name: 'Vadodara', stateCode: 'GJ', stateName: 'Gujarat' },
  { name: 'Rajkot', stateCode: 'GJ', stateName: 'Gujarat' },
  { name: 'Gandhinagar', stateCode: 'GJ', stateName: 'Gujarat' }
];

interface CitySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onSelectCity: (city: string) => void;
}

export function CitySelector({ isOpen, onClose, currentUser, onSelectCity }: CitySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmittingDemand, setIsSubmittingDemand] = useState(false);
  const [comingSoonCity, setComingSoonCity] = useState<{ name: string; state: string } | null>(null);
  
  // Early access subscription states
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Filtered search results
  const filteredCities = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return ALL_CITIES;
    return ALL_CITIES.filter(item => 
      item.name.toLowerCase().includes(query) || 
      item.stateName.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleCityClick = async (cityName: string, stateCode: string) => {
    const stateName = STATE_CITIES[stateCode]?.stateName || stateCode;
    
    if (cityName === 'Indore') {
      onSelectCity('Indore');
      onClose();
      return;
    }

    // Capture City Demand Analytics Event
    setIsSubmittingDemand(true);
    const userId = currentUser?.uid || 'anonymous';
    const currentName = currentUser?.displayName || currentUser?.name || 'Guest';

    const payload = {
      user_id: userId,
      current_logged_in_name: currentName,
      target_city: cityName,
      target_state: stateName,
      clicked_timestamp: new Date().toISOString()
    };

    try {
      // 1. Post to Express Backend Controller api endpoint
      await axios.post('/api/analytics/city-demand', payload);

      // 2. Direct Firestore save for redundant, secure, offline-ready sync
      try {
        await addDoc(collection(db, 'cityDemandAnalytics'), {
          user_id: payload.user_id,
          current_logged_in_name: payload.current_logged_in_name,
          target_city: payload.target_city,
          target_state: payload.target_state,
          clicked_timestamp: Timestamp.now()
        });
      } catch (directWriteErr) {
        console.warn("[City Demand Direct Write Warning]: Local client sync fallback skipped:", directWriteErr);
      }
    } catch (err) {
      console.error("[City Demand Capture Error]:", err);
    } finally {
      setIsSubmittingDemand(false);
    }

    // Set the state to show the simplified "Coming Soon" prompt
    setComingSoonCity({ name: cityName, state: stateName });
  };

  const handleSubscribeEarlyAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone.trim()) return;

    try {
      await addDoc(collection(db, 'notifications'), {
        userId: currentUser?.uid || 'anonymous',
        title: `Launch alert registered! 🚀`,
        message: `Registered interest for launch in ${comingSoonCity?.name}, ${comingSoonCity?.state}. Contact No: ${emailOrPhone}`,
        type: 'launch_subscription',
        read: false,
        createdAt: Timestamp.now()
      });
      setIsSubscribed(true);
      setEmailOrPhone('');
    } catch (err) {
      console.error("[Subscribe Launch Alert Error]:", err);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && !comingSoonCity && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm"
              id="city-selector-backdrop"
            />

            {/* Compact Bottom Sheet / Centered Modal */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full sm:max-w-lg bg-white rounded-t-[32px] sm:rounded-[24px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh] z-10 border border-slate-50"
              id="city-selector-container"
            >
              {/* Header */}
              <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <MapPin className="text-emerald-500" size={18} />
                    Select Service City
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">Find your city for direct service check</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Justdial style compact search bar focus */}
              <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search city (e.g. Pune, Noida, Mumbai...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-slate-800"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Clean flat city names list / grid */}
              <div className="flex-1 overflow-y-auto p-6 max-h-[50vh]">
                {filteredCities.length > 0 ? (
                  <div className="space-y-4">
                    <h4 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      {searchQuery ? 'Search Results' : 'Available Cities'}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" id="city-results-grid">
                      {filteredCities.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => handleCityClick(item.name, item.stateCode)}
                          className={`flex items-center gap-2 p-3 bg-white hover:bg-slate-50 border border-slate-200/60 rounded-xl transition-all text-left group cursor-pointer ${
                            item.name === 'Indore' ? 'ring-1 ring-emerald-500/20 bg-emerald-50/5' : ''
                          }`}
                        >
                          <MapPin size={13} className={`shrink-0 ${item.name === 'Indore' ? 'text-emerald-500' : 'text-slate-400'}`} />
                          <span className="text-sm font-semibold text-slate-700 truncate">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="mx-auto text-slate-300 mb-3" size={32} />
                    <p className="text-slate-500 text-sm font-bold">No cities found matching "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Simplified "Coming Soon" Modal */}
      <AnimatePresence>
        {comingSoonCity && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => { setComingSoonCity(null); setIsSubscribed(false); }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              id="coming-soon-backdrop"
            />

            {/* Card view */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-white text-slate-850 rounded-[28px] overflow-hidden p-8 border border-white/10 shadow-2xl flex flex-col items-center z-10 text-center"
              id="coming-soon-panel"
            >
              {/* Close Button */}
              <button
                onClick={() => { setComingSoonCity(null); setIsSubscribed(false); }}
                className="absolute right-5 top-5 p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all cursor-pointer"
              >
                <X size={14} />
              </button>

              <div className="relative mb-5 bg-emerald-50 w-12 h-12 rounded-full flex items-center justify-center text-emerald-500">
                <MapPin size={22} />
              </div>

              {/* Title exactly as requested */}
              <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-2">
                We will coming soon.
              </h2>
              <p className="text-slate-500 text-xs font-medium leading-relaxed mb-6">
                Please enter your contact information to reserve priority booking list access.
              </p>

              {/* Action Area */}
              <div className="w-full">
                {isSubscribed ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-1.5">
                      <Check size={16} />
                    </div>
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Registered!</span>
                    <span className="text-[10px] text-slate-500 mt-1">We will notify you immediately.</span>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubscribeEarlyAccess} className="space-y-4">
                    <div className="text-left">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5 pl-1">
                        Your Contact No.
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="Your Contact No."
                        value={emailOrPhone}
                        onChange={(e) => setEmailOrPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!emailOrPhone.trim()}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <span>Join Priority List</span>
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
