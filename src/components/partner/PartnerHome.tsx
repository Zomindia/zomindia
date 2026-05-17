import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Star, 
  Package, 
  ChevronRight, 
  AlertCircle,
  Clock,
  MapPin,
  Smartphone,
  Navigation
} from 'lucide-react';
import { PartnerProfile, Booking, UserProfile } from '../../types';

interface Props {
  partner: PartnerProfile | null;
  bookings: Booking[];
  profile: UserProfile;
  onNavigate: (screen: 'home' | 'jobs' | 'wallet' | 'settings' | 'notifications') => void;
}

export default function PartnerHome({ partner, bookings, profile, onNavigate }: Props) {
  const activeJobs = bookings.filter(b => ['confirmed', 'on_the_way', 'arrived', 'in_progress'].includes(b.status));
  const currentJob = activeJobs[0]; // Simplification for mobile: show one most urgent job

  return (
    <div className="p-6 space-y-8">
      {/* Greetings */}
      <section>
        <h2 className="text-2xl font-black text-slate-900 italic leading-tight">Master {profile.displayName.split(' ')[0]}</h2>
        <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1">Global ID: PRO-{(profile?.uid || '').slice(0, 6).toUpperCase() || 'TEMP'}</p>
      </section>

      {/* Quick Stats Grid */}
      <section className="grid grid-cols-2 gap-4">
        <div 
          onClick={() => onNavigate('wallet')}
          className="bg-emerald-500 p-6 rounded-[32px] text-white shadow-xl shadow-emerald-500/10 cursor-pointer group active:scale-95 transition-all"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-6">
            <TrendingUp size={20} />
          </div>
          <p className="border-t border-white/20 pt-4 text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Today's Payout</p>
          <p className="text-3xl font-black italic">₹{partner?.totalEarnings?.toLocaleString() || '0'}</p>
        </div>
        
        <div className="bg-blue-700 p-6 rounded-[32px] text-white shadow-xl shadow-blue-700/20/10 active:scale-95 transition-all">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-6 text-amber-400">
             <Star size={20} fill="currentColor" />
          </div>
          <p className="border-t border-white/10 pt-4 text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Success Rating</p>
          <p className="text-3xl font-black italic">{partner?.rating || '4.9'}</p>
        </div>
      </section>

      {/* Current/Active Job Focus */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Priority Task</h3>
          <button 
            onClick={() => onNavigate('jobs')}
            className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1"
          >
            All Work <ChevronRight size={12} />
          </button>
        </div>

        {currentJob ? (
          <div className="bg-white border border-slate-100 rounded-[40px] p-8 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-2 bg-blue-700 rounded-bl-[40px]" />
             
             <div className="flex items-center gap-3 mb-6">
                <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full ${
                  currentJob.status === 'in_progress' ? 'bg-blue-600 text-white animate-pulse' :
                  currentJob.status === 'on_the_way' ? 'bg-indigo-600 text-white' :
                  currentJob.status === 'arrived' ? 'bg-amber-500 text-white' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {currentJob.status.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-slate-300 font-mono">#{currentJob.id.slice(0, 8).toUpperCase()}</span>
             </div>

             <h4 className="text-2xl font-black text-slate-900 italic mb-4 leading-tight">Service at {currentJob.address.split(',')[0]}</h4>
             
             <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                    <Clock size={16} />
                  </div>
                  <span className="text-xs font-bold">{currentJob.scheduledAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Today</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                    <MapPin size={16} />
                  </div>
                  <span className="text-xs font-medium truncate">{currentJob.address}</span>
                </div>
             </div>

             <button 
               onClick={() => onNavigate('jobs')}
               className="w-full bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/20/20 flex items-center justify-center gap-2 group"
             >
               Go to Job <Navigation size={12} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
             </button>
          </div>
        ) : (
          <div className="bg-slate-100 border border-slate-200 border-dashed rounded-[40px] p-10 text-center">
             <div className="w-16 h-16 bg-slate-200 rounded-3xl flex items-center justify-center text-slate-400 mx-auto mb-6">
                <Package size={32} />
             </div>
             <p className="text-lg font-black text-slate-400 italic">No Active Tasks</p>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 px-6">Available jobs will appear in your Work tab.</p>
          </div>
        )}
      </section>

      {/* Account Health */}
      {!partner?.isVerified && (
        <section className="bg-rose-50 border border-rose-100 p-8 rounded-[40px] flex gap-6">
          <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-200">
             <AlertCircle size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">KYC Not Verified</h4>
            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Verify your identity to unlock instant payouts and professional badges.</p>
            <button 
              onClick={() => onNavigate('settings')}
              className="mt-4 text-[10px] font-black text-rose-600 uppercase tracking-widest underline underline-offset-4"
            >
              Verify Now
            </button>
          </div>
        </section>
      )}

      {/* Rewards Segment */}
      <section className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm flex justify-between items-center overflow-hidden relative">
         <div className="relative z-10">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Elite Balance</p>
            <p className="text-2xl font-black text-slate-900 italic">{partner?.rewardCredits || '0'} Points</p>
         </div>
         <div className="relative z-10 w-12 h-12 bg-blue-700 text-amber-400 rounded-full flex items-center justify-center shadow-lg">
            <Star size={24} fill="currentColor" />
         </div>
         <div className="absolute -right-8 -top-8 w-24 h-24 bg-slate-50 rounded-full z-0" />
      </section>
    </div>
  );
}
