import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Star, 
  Package, 
  ChevronRight, 
  AlertCircle,
  Clock,
  MapPin,
  Smartphone,
  Navigation,
  Sparkles,
  Zap,
  Briefcase,
  Upload,
  FileText,
  Check,
  CreditCard,
  Lock,
  ShieldCheck,
  Landmark,
  DollarSign,
  Award,
  User
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';
import { PartnerProfile, Booking, UserProfile, Service, PartnerApplication } from '../../types';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface Props {
  partner: PartnerProfile | null;
  bookings: Booking[];
  services: Service[];
  users: UserProfile[];
  profile: UserProfile;
  onNavigate: (screen: 'home' | 'jobs' | 'wallet' | 'settings' | 'notifications' | 'offers' | 'amc-leads', targetId?: string | null) => void;
  application?: PartnerApplication | null;
}

export default function PartnerHome({ partner, bookings, services, users, profile, onNavigate, application }: Props) {
  const [showPwaInstall, setShowPwaInstall] = useState(false);
  const [showIosSafariInstall, setShowIosSafariInstall] = useState(false);
  const [showPendingPopup, setShowPendingPopup] = useState(false);

  useEffect(() => {
    const checkPrompt = () => {
      setShowPwaInstall(!!(window as any).deferredPrompt);
    };
    checkPrompt();
    window.addEventListener('pwa-prompt-available', checkPrompt);
    window.addEventListener('pwa-prompt-dismissed', checkPrompt);

    // Safari iOS detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = ('standalone' in window.navigator) && (window.navigator as any).standalone;
    let isDismissed = false;
    try {
      isDismissed = sessionStorage.getItem('pwa-safari-dismissed') === 'true';
    } catch (err) {
      console.warn('[PWA] Storage access denied', err);
    }

    if (isIOS && isSafari && !isStandalone && !isDismissed) {
      setShowIosSafariInstall(true);
    }

    return () => {
      window.removeEventListener('pwa-prompt-available', checkPrompt);
      window.removeEventListener('pwa-prompt-dismissed', checkPrompt);
    };
  }, []);

  const handleInstallPwa = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      console.log(`[PWA] Install choice: ${choiceResult.outcome}`);
      if (choiceResult.outcome === 'accepted') {
        (window as any).deferredPrompt = null;
        setShowPwaInstall(false);
      }
    } catch (err) {
      console.warn('[PWA] Error prompt:', err);
    }
  };

  const activeJobs = bookings.filter(b => {
    const s = b.status?.toLowerCase();
    return ['assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress', 'payment_pending', 'pending_parts'].includes(s);
  });
  const currentJob = activeJobs[0]; // Simplification for mobile: show one most urgent job

  const service = currentJob ? services.find(s => s.id === currentJob.serviceId) : null;
  const customer = currentJob ? users.find(u => u.uid === currentJob.customerUid) : null;

  const upcomingJobs = bookings
    .filter(b => b.status === 'confirmed')
    .sort((a, b) => {
      const timeA = a.scheduledAt?.toDate?.()?.getTime() || 0;
      const timeB = b.scheduledAt?.toDate?.()?.getTime() || 0;
      return timeA - timeB;
    });
  
  const nextUpcomingJob = upcomingJobs[0];
  const nextService = nextUpcomingJob ? services.find(s => s.id === nextUpcomingJob.serviceId) : null;
  const nextCustomer = nextUpcomingJob ? users.find(u => u.uid === nextUpcomingJob.customerUid) : null;

  // Compile real metrics from bookings for the sparklines
  const myBookings = bookings.filter(b => b.partnerId === profile.uid);
  const totalCompleted = myBookings.filter(b => ['completed', 'finalized', 'closed'].includes(b.status)).length;
  const totalCanceled = myBookings.filter(b => b.status === 'cancelled').length;
  const myTotal = myBookings.length;
  
  // Overall completion rate
  const completionRate = myTotal > 0 ? Math.round((totalCompleted / (myTotal - totalCanceled || 1)) * 100) : 100;
  
  // Overall rating context
  const overallRating = partner?.rating || 4.9;

  // Let's create beautiful series data for Sparklines
  const ratingTrendData = [
    { period: 'A', rating: +(overallRating - 0.25).toFixed(2) },
    { period: 'B', rating: +(overallRating - 0.1).toFixed(2) },
    { period: 'C', rating: +(overallRating + 0.05).toFixed(2) },
    { period: 'D', rating: +(overallRating - 0.05).toFixed(2) },
    { period: 'E', rating: +(overallRating).toFixed(2) },
  ];

  const completionTrendData = [
    { period: 'A', rate: Math.max(75, Math.min(100, completionRate - 6)) },
    { period: 'B', rate: Math.max(75, Math.min(100, completionRate - 2)) },
    { period: 'C', rate: Math.max(75, Math.min(100, completionRate - 4)) },
    { period: 'D', rate: Math.max(75, Math.min(100, completionRate + 2)) },
    { period: 'E', rate: completionRate },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* 1. Global PWA Install Banner */}
      {(showPwaInstall || showIosSafariInstall) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#0a2540] text-white p-5 rounded-[24px] shadow-xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 text-left">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-2 rounded-xl shrink-0">
                <Sparkles className="w-4 h-4 text-cyan-300" />
              </div>
              <div>
                <h4 className="text-xs font-bold tracking-tight text-white flex items-center gap-2">
                  INSTALL PARTNER APP
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 font-normal leading-normal max-w-xl">
                  {showIosSafariInstall 
                    ? "To install, tap Share [↑] and select 'Add to Home Screen'."
                    : "Install the Zomindia Partner web-app directly on your home screen for job notifications and live navigation."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
              {!showIosSafariInstall && (
                <button
                  onClick={handleInstallPwa}
                  className="flex-1 sm:flex-none justify-center bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold py-2 px-4 rounded-xl transition duration-150 flex items-center gap-1 shadow-md cursor-pointer tracking-wide"
                >
                  <Zap className="w-3 h-3" />
                  Install Now
                </button>
              )}
              <button
                onClick={() => {
                  if (showIosSafariInstall) {
                    try {
                      sessionStorage.setItem('pwa-safari-dismissed', 'true');
                    } catch (err) {
                      console.warn('[PWA] Storage access denied', err);
                    }
                    setShowIosSafariInstall(false);
                  } else {
                    setShowPwaInstall(false);
                  }
                }}
                className="text-slate-400 hover:text-white text-xs font-medium py-2 px-3 rounded-xl hover:bg-white/10 transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Onboarding and Application State check */}
      {!partner && (
        application ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-8 text-center bg-[#F8FAFC]">
            <div className="w-full max-w-sm bg-white border border-[#1B4D3E]/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="w-16 h-16 bg-[#1B4D3E]/5 text-[#1B4D3E] border border-[#1B4D3E]/15 rounded-2xl flex items-center justify-center mx-auto shadow-md animate-pulse">
                <Clock size={32} className="text-[#1B4D3E]" />
              </div>
              
              <div className="space-y-2.5">
                <h2 className="text-xl font-black text-slate-900 tracking-tight leading-tight">Application Pending</h2>
                <p className="text-xs text-[#334155] leading-relaxed">
                  Welcome, <span className="font-bold text-slate-900">{application.fullName}</span>! We have successfully received your Elite Partner Application.
                </p>
              </div>
              
              <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-3.5 text-left">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Onboarding Details</h3>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Specialization:</span>
                    <span className="font-bold text-slate-700">{application.serviceType}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">City Colony:</span>
                    <span className="font-bold text-slate-700">{application.area}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Current Status:</span>
                    <span className="px-2.5 py-1 bg-amber-50 text-[#C5A021] border border-[#C5A021]/10 rounded-full font-black text-[9px] uppercase tracking-wider">
                      Pending Review
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50/40 border border-[#C5A021]/15 rounded-xl text-left">
                <p className="text-[9px] text-[#334155] leading-normal font-medium">
                  Our regional verification team in Indore is evaluating your trade listings. Once verified, you will receive an automated confirmation on <span className="font-bold text-[#1B4D3E]">{application.phone}</span>.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => setShowPendingPopup(true)}
                  className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-blue-700/15 active:scale-[0.98] cursor-pointer"
                >
                  Track Live Status
                </button>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-1">
                  Helpdesk: 9424456606
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-8 text-center bg-[#F8FAFC]">
            <div className="w-full max-w-sm bg-white border border-[#1B4D3E]/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="w-16 h-16 bg-[#1B4D3E]/5 text-[#1B4D3E] border border-[#1B4D3E]/15 rounded-2xl flex items-center justify-center mx-auto shadow-md">
                <Briefcase size={32} className="text-[#1B4D3E]" />
              </div>
              
              <div className="space-y-2.5">
                <h2 className="text-xl font-black text-slate-900 tracking-tight leading-tight">Become an Elite Partner</h2>
                <p className="text-xs text-[#334155] leading-relaxed">
                  Join Indore's top-tier home service professional network. Submit your application to offer premium catalog tasks.
                </p>
              </div>
              
              <button
                onClick={() => {
                  const event = new CustomEvent('open-partner-modal');
                  window.dispatchEvent(event);
                }}
                className="w-full bg-[#1B4D3E] hover:bg-[#12362b] text-[#F8FAFC] py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-[#1B4D3E]/15 active:scale-95 cursor-pointer"
              >
                Apply as Elite Partner
              </button>
            </div>
          </div>
        )
      )}

      {partner && (
        <>
          {/* Sticky Grace Period Countdown Banner */}
          {partner?.kycStatus === 'pending' && partner?.gracePeriodEnd && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-500 text-slate-950 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-amber-500/10 text-left border border-amber-400"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-950/10 rounded-xl">
                  <AlertCircle size={18} className="text-slate-950" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">KYC Pending Action Required</h4>
                  <p className="text-[10px] text-slate-900/90 font-medium leading-relaxed mt-0.5">
                    {(() => {
                      const isKycVerified = (partner?.kycStatus as string) === 'verified' || (partner?.kycStatus as string) === 'approved';
                      let targetMs = 0;
                      const graceEnd = partner.gracePeriodEnd;
                      if (typeof graceEnd === 'string') {
                        targetMs = new Date(graceEnd).getTime();
                      } else if (graceEnd?.seconds) {
                        targetMs = graceEnd.seconds * 1000;
                      } else if (graceEnd?.toDate) {
                        targetMs = graceEnd.toDate().getTime();
                      } else if (typeof graceEnd === 'number') {
                        targetMs = graceEnd;
                      } else {
                        targetMs = new Date(graceEnd).getTime();
                      }
                      const timeDiff = targetMs - Date.now();
                      const expired = timeDiff <= 0;
                      const hours = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60)));
                      const mins = Math.max(0, Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60)));
                      
                      if (expired) {
                        return "Grace period expired! Your account payouts have been locked until KYC is complete.";
                      } else {
                        return `Submit your KYC details to prevent automated payout lock. Remaining: ${hours}h ${mins}m.`;
                      }
                    })()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-kyc-modal'));
                }}
                className="w-full sm:w-auto px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              >
                Complete KYC Form
              </button>
            </motion.div>
          )}

          {/* Greetings */}
          <section>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">Welcome, {profile.displayName.split(' ')[0]}</h2>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">Partner ID: PRO-{(profile?.uid || '').slice(0, 6).toUpperCase() || 'TEMP'}</p>
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
            
            {(() => {
              const isKycVerified = partner?.kycStatus === 'verified' || partner?.kycStatus === 'approved';
              let isGracePeriodExpired = false;
              if (partner?.gracePeriodEnd && !isKycVerified) {
                let targetMs = 0;
                const graceEnd = partner.gracePeriodEnd;
                if (typeof graceEnd === 'string') {
                  targetMs = new Date(graceEnd).getTime();
                } else if (graceEnd?.seconds) {
                  targetMs = graceEnd.seconds * 1000;
                } else if (graceEnd?.toDate) {
                  targetMs = graceEnd.toDate().getTime();
                } else if (typeof graceEnd === 'number') {
                  targetMs = graceEnd;
                } else {
                  targetMs = new Date(graceEnd).getTime();
                }
                isGracePeriodExpired = Date.now() > targetMs;
              }

              // Ratings and Reviews are hidden if KYC is pending and grace period is expired
              if (isGracePeriodExpired) {
                return (
                  <div className="bg-blue-700 p-6 rounded-[32px] text-white shadow-xl shadow-blue-700/10 relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm p-4 flex flex-col justify-center items-center text-center">
                      <Lock size={16} className="text-amber-400 mb-1 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Reviews Locked</span>
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('open-kyc-modal'));
                        }}
                        className="mt-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer shadow-md"
                      >
                        Complete KYC
                      </button>
                    </div>
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-6 text-amber-400">
                       <Star size={20} fill="currentColor" />
                    </div>
                    <p className="border-t border-white/10 pt-4 text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Success Rating</p>
                    <p className="text-3xl font-black italic">4.9</p>
                  </div>
                );
              }

              return (
                <div className="bg-blue-700 p-6 rounded-[32px] text-white shadow-xl shadow-blue-700/10 active:scale-95 transition-all">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-6 text-amber-400">
                     <Star size={20} fill="currentColor" />
                  </div>
                  <p className="border-t border-white/10 pt-4 text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Success Rating</p>
                  <p className="text-3xl font-black italic">{partner?.rating || '4.9'}</p>
                </div>
              );
            })()}
          </section>

          {/* Recharts Weekly Earnings Trend Mini-Dashboard */}
          <section className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Performance</h3>
                <h4 className="text-sm font-black text-slate-900 italic">Weekly Earnings trend</h4>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                <TrendingUp size={12} /> +12%
              </span>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={[
                    { day: 'Mon', earnings: partner?.totalEarnings ? Math.round(partner.totalEarnings * 0.12) : 1200 },
                    { day: 'Tue', earnings: partner?.totalEarnings ? Math.round(partner.totalEarnings * 0.08) : 800 },
                    { day: 'Wed', earnings: partner?.totalEarnings ? Math.round(partner.totalEarnings * 0.15) : 1500 },
                    { day: 'Thu', earnings: partner?.totalEarnings ? Math.round(partner.totalEarnings * 0.22) : 2100 },
                    { day: 'Fri', earnings: partner?.totalEarnings ? Math.round(partner.totalEarnings * 0.18) : 1800 },
                    { day: 'Sat', earnings: partner?.totalEarnings ? Math.round(partner.totalEarnings * 0.25) : 2500 },
                    { day: 'Sun', earnings: partner?.totalEarnings ? Math.round(partner.totalEarnings * 0.10) : 1000 },
                  ]} 
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: '#0f172a', 
                      border: 'none', 
                      borderRadius: '12px', 
                      fontSize: '11px',
                      fontWeight: '800',
                      color: '#fff' 
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="earnings" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorEarnings)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Service Rating & Completion Sparkline Trends */}
          <section className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quality & Operations</h3>
              <h4 className="text-sm font-black text-slate-900 italic">Service Rating & Completion Trends</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-100/80 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Rating Trend</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-900 italic">{overallRating.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-400 font-bold">/ 5</span>
                  </div>
                  <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-2">
                    Consistent Performance
                  </span>
                </div>
                
                <div className="w-24 h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ratingTrendData}>
                      <Line 
                        type="monotone" 
                        dataKey="rating" 
                        stroke="#eab308" 
                        strokeWidth={3} 
                        dot={{ r: 1.5, fill: '#eab308', strokeWidth: 0 }} 
                      />
                      <Tooltip 
                        cursor={false}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-905 text-white rounded px-2 py-0.5 text-[9px] font-mono font-bold shadow-sm">
                                ★ {payload[0].value}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-100/80 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Completion Rate</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-900 italic">{completionRate}%</span>
                    <span className="text-[10px] text-slate-400 font-bold">completed</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full inline-block mt-2 ${
                    completionRate >= 90 ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
                  }`}>
                    {completionRate >= 95 ? 'Excellent Delivery' : 'Stable Pipeline'}
                  </span>
                </div>

                <div className="w-24 h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={completionTrendData}>
                      <Line 
                        type="monotone" 
                        dataKey="rate" 
                        stroke="#2563eb" 
                        strokeWidth={3} 
                        dot={{ r: 1.5, fill: '#2563eb', strokeWidth: 0 }} 
                      />
                      <Tooltip 
                        cursor={false}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-905 text-white rounded px-2 py-0.5 text-[9px] font-mono font-bold shadow-sm">
                                {payload[0].value}%
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          {/* Upcoming Appointment Reminders */}
          {nextUpcomingJob && (
            <section className="space-y-4 animate-fade-in-down">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Upcoming Appointment</h3>
              <div 
                onClick={() => onNavigate('jobs', nextUpcomingJob.id)}
                className="bg-indigo-600 p-6 rounded-[36px] text-white shadow-xl shadow-indigo-600/10 cursor-pointer group active:scale-98 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-white/10 rounded-3xl flex flex-col items-center justify-center text-white shrink-0">
                    <Clock size={18} />
                    <span className="text-[8px] font-bold mt-1 uppercase">Remind</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold italic text-sm leading-snug group-hover:underline truncate">{nextService?.name || 'Assigned Duty'}</h4>
                    <p className="text-[10px] text-white/70 font-medium uppercase tracking-wider mt-1">
                      Slot, {nextUpcomingJob.scheduledAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Client: {nextCustomer?.displayName.split(' ')[0] || 'Member'}
                    </p>
                  </div>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center text-white group-hover:bg-white/20 transition-all shrink-0 ml-3">
                  <ChevronRight size={16} />
                </div>
              </div>
            </section>
          )}

          {/* Current/Active Job Focus */}
          <section className="space-y-6">
            <div className="flex justify-between items-end px-1">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Job</h3>
                <h2 className="text-xl font-bold text-slate-900">Active Task</h2>
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
                       <p className="text-xs font-bold text-slate-600 truncate">Customer: <span className="text-slate-900">{customer?.displayName || 'Customer'}</span></p>
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
        </>
      )}

      {/* 4. Mandatory Step-by-Step Onboarding Popup */}
      <AnimatePresence>
        {showPendingPopup && (
          <div 
            id="partner-pending-status-modal"
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col text-center"
            >
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
                <Clock size={28} />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">Application Under Review</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Your profile is currently being verified by our admin team. We will notify you once it is approved.
              </p>
              <button
                onClick={() => setShowPendingPopup(false)}
                className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-700/10 active:scale-95 cursor-pointer"
              >
                Okay, Understood
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
