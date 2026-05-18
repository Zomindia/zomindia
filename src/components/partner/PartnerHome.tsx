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
import { PartnerProfile, Booking, UserProfile, Service } from '../../types';

interface Props {
  partner: PartnerProfile | null;
  bookings: Booking[];
  services: Service[];
  users: UserProfile[];
  profile: UserProfile;
  onNavigate: (screen: 'home' | 'jobs' | 'wallet' | 'settings' | 'notifications' | 'offers' | 'amc-leads', targetId?: string | null) => void;
}

export default function PartnerHome({ partner, bookings, services, users, profile, onNavigate }: Props) {
  const activeJobs = bookings.filter(b => ['confirmed', 'on_the_way', 'arrived', 'in_progress'].includes(b.status));
  const currentJob = activeJobs[0]; // Simplification for mobile: show one most urgent job

  const service = currentJob ? services.find(s => s.id === currentJob.serviceId) : null;
  const customer = currentJob ? users.find(u => u.uid === currentJob.customerId) : null;

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
        
        <div className="bg-blue-700 p-6 rounded-[32px] text-white shadow-xl shadow-blue-700/10 active:scale-95 transition-all">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-6 text-amber-400">
             <Star size={20} fill="currentColor" />
          </div>
          <p className="border-t border-white/10 pt-4 text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Success Rating</p>
          <p className="text-3xl font-black italic">{partner?.rating || '4.9'}</p>
        </div>
      </section>      {/* Current/Active Job Focus */}
      <section className="space-y-6">
        <div className="flex justify-between items-end px-1">
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mission Control</h3>
            <h2 className="text-xl font-black text-slate-900 italic">Priority Task</h2>
          </div>
          <button 
            onClick={() => onNavigate('jobs')}
            className="bg-slate-100 text-[10px] font-black text-slate-900 px-4 py-2 rounded-xl uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all active:scale-95"
          >
            All Work <ChevronRight size={14} />
          </button>
        </div>

        {currentJob ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border-2 border-blue-700/10 rounded-[48px] p-8 shadow-[0_32px_64px_-12px_rgba(30,58,138,0.1)] relative overflow-hidden group"
          >
             {/* Status Badge - Floating */}
             <div className="absolute top-6 right-6 z-20">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest ${
                  currentJob.status === 'in_progress' ? 'bg-blue-700 text-white animate-pulse' :
                  currentJob.status === 'on_the_way' ? 'bg-indigo-600 text-white' :
                  currentJob.status === 'arrived' ? 'bg-amber-500 text-white' :
                  'bg-emerald-500 text-white'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full bg-white ${currentJob.status === 'in_progress' ? 'animate-ping' : ''}`} />
                  {currentJob.status.replace('_', ' ')}
                </div>
             </div>

             {/* Job Header */}
             <div className="flex gap-6 mb-10 relative z-10">
                <div className="w-20 h-20 bg-slate-50 rounded-[32px] overflow-hidden border border-slate-100 p-1 shrink-0 shadow-inner group-hover:rotate-3 transition-transform duration-500">
                   {service?.imageURL ? (
                     <img src={service.imageURL} alt="" className="w-full h-full object-cover rounded-[24px]" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={32} /></div>
                   )}
                </div>
                <div className="flex-1 min-w-0 pt-2">
                   <p className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em] mb-1.5">Action Required</p>
                   <h4 className="text-2xl font-black text-slate-900 italic leading-tight group-hover:text-blue-700 transition-colors">{service?.name || 'Pro Service'}</h4>
                   <p className="text-[10px] font-bold text-slate-400 mt-1">ID: #{currentJob.id.slice(0, 8).toUpperCase()}</p>
                </div>
             </div>

             {/* Dynamic Context Card */}
             <div className="bg-slate-50 rounded-[32px] p-6 mb-8 border border-slate-100 group-hover:bg-slate-100/50 transition-colors">
                <div className="grid grid-cols-2 gap-4">
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                        <Clock size={12} strokeWidth={2.5} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Time Slot</span>
                      </div>
                      <p className="text-sm font-black text-slate-900">{currentJob.scheduledAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                   </div>
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                        <MapPin size={12} strokeWidth={2.5} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Client Location</span>
                      </div>
                      <p className="text-sm font-black text-slate-900 truncate italic">{currentJob.address.split(',')[0]}</p>
                   </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200/50 flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center border border-slate-100 shrink-0">
                      <Smartphone size={14} className="text-blue-700" />
                   </div>
                   <p className="text-xs font-bold text-slate-600 truncate">Client: <span className="text-slate-900">{customer?.displayName || 'Elite Client'}</span></p>
                </div>
             </div>

             <button 
               onClick={() => onNavigate('jobs', currentJob.id)}
               className="w-full bg-blue-700 text-white py-6 rounded-[32px] font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-800 transition-all shadow-2xl shadow-blue-700/20 flex items-center justify-center gap-4 active:scale-95 group/btn"
             >
                {currentJob.status === 'arrived' ? 'Verify OTP & Start' : 
                 currentJob.status === 'in_progress' ? 'Manage Active Work' :
                 currentJob.status === 'on_the_way' ? 'Update Arrival' : 'Continue Journey'} 
                <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center group-hover/btn:bg-white/20 transition-all">
                  <ChevronRight size={18} />
                </div>
             </button>
          </motion.div>
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
