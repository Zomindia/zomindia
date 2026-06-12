import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Briefcase, 
  Wallet, 
  MapPin, 
  ShieldCheck, 
  TrendingUp, 
  ArrowRight, 
  KeyRound, 
  CheckCircle2, 
  MessageSquare, 
  Award,
  Zap,
  Check,
  ChevronDown
} from 'lucide-react';

interface Props {
  onLogin: () => void;
  onExploreServices: () => void;
}

export default function PartnerPortalLanding({ onLogin, onExploreServices }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<'appliance' | 'electrician' | 'cleaning' | 'plumbing' | 'amc'>('appliance');
  const [estimatedDailyJobs, setEstimatedDailyJobs] = useState<number>(3);

  const earningsConfig = {
    appliance: { label: 'Appliance Repair', baseRate: 450, color: 'text-blue-500 bg-blue-50' },
    electrician: { label: 'Electrician Services', baseRate: 350, color: 'text-amber-500 bg-amber-50' },
    cleaning: { label: 'Full Home Cleaning', baseRate: 1200, color: 'text-emerald-500 bg-emerald-50' },
    plumbing: { label: 'Professional Plumbing', baseRate: 400, color: 'text-indigo-500 bg-indigo-50' },
    amc: { label: 'AMC Maintenance Contract', baseRate: 1500, color: 'text-purple-500 bg-purple-50' },
  };

  const calculateMonthlyEarnings = () => {
    const rate = earningsConfig[selectedCategory].baseRate;
    // Assuming 26 working days in a month
    return rate * estimatedDailyJobs * 26;
  };

  const onboardingSteps = [
    {
      num: '01',
      title: 'Aesthetic Quick Auth',
      desc: 'Verify your phone via a secure OTP request sent directly to your mobile device.',
    },
    {
      num: '02',
      title: 'Profile Onboarding',
      desc: 'Set up your bio, specialization category, and standard working hours.',
    },
    {
      num: '03',
      title: 'Secure KYC Submission',
      desc: 'Upload dummy document links (Identity/Address Proof) for admin approval.',
    },
    {
      num: '04',
      title: 'Receive Service Bookings',
      desc: 'Toggle online status on your map-linked hub, receive bookings, and claim payouts.',
    }
  ];

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* Premium Hero Section */}
      <section className="relative overflow-hidden bg-slate-900 pt-32 pb-24 md:pt-40 md:pb-32 px-6">
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
        
        {/* Abstract lights */}
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-6xl mx-auto relative text-center">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 tracking-wider uppercase mb-6"
          >
            <Zap className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
            ZomIndia Service Partner Program
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none max-w-4xl mx-auto"
          >
            Ecosystem for Top Service Professionals
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-400 mt-6 text-base md:text-lg max-w-2xl mx-auto font-medium leading-relaxed"
          >
            Join zomindia to double your daily bookings, unlock recurring premium AMC maintenance agreements, and manage your payouts with high-fidelity live map navigation.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <button 
              id="partner-landing-login-btn"
              onClick={onLogin}
              className="px-8 py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-2 group cursor-pointer"
            >
              Sign In to Partner App
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              id="partner-landing-explore-btn"
              onClick={onExploreServices}
              className="px-8 py-4 rounded-2xl bg-slate-800 text-slate-200 border border-slate-700 font-bold hover:bg-slate-700 transition-all cursor-pointer"
            >
              Back to Services
            </button>
          </motion.div>
        </div>
      </section>

      {/* Trust & Stats Section */}
      <section className="max-w-6xl mx-auto px-6 -mt-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-8 rounded-[32px] shadow-xl border border-slate-100">
          <div className="flex items-center gap-5 p-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">₹45k+</p>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-black mt-0.5">Avg Monthly Income</p>
            </div>
          </div>
          <div className="flex items-center gap-5 p-4 border-t md:border-t-0 md:border-l border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">Instant</p>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-black mt-0.5">KYC Verified Badges</p>
            </div>
          </div>
          <div className="flex items-center gap-5 p-4 border-t md:border-t-0 md:border-l border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">1.8x</p>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-black mt-0.5">Recurring AMC Earnings</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Income Calculator */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-none">
            Calculate Your Unlimited Potential
          </h2>
          <p className="text-slate-500 mt-4 text-base max-w-xl mx-auto font-medium">
            Select your category of work and average daily bookings estimates to see your monthly revenue breakdown based on real local data!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Selectors card */}
          <div className="lg:col-span-7 bg-white p-8 rounded-3xl border border-slate-200/60 shadow-sm space-y-8 flex flex-col justify-between">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-[0.2em] font-black block mb-4">
                1. Choose Specialization Route
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(earningsConfig).map(([key, item]) => {
                  const isSel = selectedCategory === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(key as any)}
                      className={`p-4 rounded-2xl text-left border text-sm transition-all focus:outline-none cursor-pointer flex flex-col justify-between h-24 ${isSel ? 'border-blue-600 bg-blue-50/20 shadow-md ring-2 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${item.color}`}>
                        {key.substring(0, 2).toUpperCase()}
                      </span>
                      <span className="font-extrabold text-slate-800 line-clamp-1 leading-snug mt-2 block">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-4">
                <label className="text-xs text-slate-400 uppercase tracking-[0.2em] font-black">
                  2. Estimate Daily Completed Jobs
                </label>
                <span className="text-sm font-extrabold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                  {estimatedDailyJobs} {estimatedDailyJobs === 1 ? 'Job' : 'Jobs'} / day
                </span>
              </div>
              <input
                id="jobs-calculator-slider"
                type="range"
                min="1"
                max="8"
                value={estimatedDailyJobs}
                onChange={(e) => setEstimatedDailyJobs(parseInt(e.target.value))}
                className="w-full accent-blue-600 h-2 bg-slate-100 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-extrabold mt-2.5">
                <span>1 JOB BRIEF</span>
                <span>4 JOBS STANDARD</span>
                <span>8 JOBS ADVANCED</span>
              </div>
            </div>
          </div>

          {/* Earnings calculator output card */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-3xl text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div>
              <div className="flex items-center gap-2 text-blue-400 text-xs uppercase tracking-widest font-black">
                <Award className="w-4 h-4 text-blue-400" />
                Estimated Revenue Outflow
              </div>
              
              <div className="mt-8 border-b border-white/10 pb-6">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-tight block">Monthly Payout Pool</span>
                <span className="text-4xl sm:text-5xl font-black text-white mt-1.5 block tracking-tight">
                  ₹{calculateMonthlyEarnings().toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 mt-2.5 block font-semibold leading-relaxed">
                  Based on ₹{earningsConfig[selectedCategory].baseRate} avg base payout rate across 26 working calendar days.
                </span>
              </div>

              <div className="mt-6 space-y-3.5">
                <div className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Platform Commission limit capped at 12%</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Extra incentive rewards for full Customer Ratings</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Priority access to corporate AMC allocations</span>
                </div>
              </div>
            </div>

            <button
              id="calculator-register-now-btn"
              onClick={onLogin}
              className="w-full py-4 mt-8 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 active:scale-98 transition-all cursor-pointer text-center text-sm"
            >
              Start Earning Now
            </button>
          </div>
        </div>
      </section>

      {/* Seamless Step-By-Step Guide */}
      <section className="bg-white border-y border-slate-100 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              Simple 4-Step Partner Activation
            </h2>
            <p className="text-slate-500 mt-4 text-base max-w-xl mx-auto font-medium">
              We have built an offline-first and secure verification pipeline to let you get onboarded and ready for bookings quickly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {onboardingSteps.map((step, idx) => (
              <div key={idx} className="relative group p-6 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                <div className="text-6xl font-black text-slate-100 group-hover:text-blue-100 transition-colors tracking-tight select-none">
                  {step.num}
                </div>
                <h4 className="text-base font-extrabold text-slate-800 mt-4">
                  {step.title}
                </h4>
                <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <button
              id="step-register-bottom-btn"
              onClick={onLogin}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all shadow-lg cursor-pointer"
            >
              Register & Begin Onboarding Process
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Highlight Partner Ecosystem Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs text-slate-400 font-extrabold tracking-[0.25em] uppercase block">
              Professional Workspaces
            </span>
            <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-snug mt-3">
              Built to Empower Service Experts
            </h3>
            <p className="text-slate-500 font-medium text-base leading-relaxed mt-4">
              ZomIndia doesn't just pass leads to you – we provide a fully automated, dedicated partner toolkit that mimics a standalone application environment.
            </p>

            <div className="mt-8 space-y-6">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mt-1 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-800 text-sm">Automated Route Navigation</h5>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed font-semibold">
                    Get precise step-by-step customer routes synced across live firebase geo-buffers, bypassing manually sent text messages.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mt-1 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-800 text-sm">Protected OTP Secure Starts</h5>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed font-semibold">
                    Ensure client validation directly in-app. Bookings only begin when the user provides the secure OTP dispatch.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mt-1 shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-800 text-sm">Real-time Material Disputes & Support</h5>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed font-semibold">
                    Need parts or extra accessories? Use the instant active chat window to report custom site issues directly to our system operators.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            {/* Visual app card preview mockup */}
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-[40px] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
              {/* Decorative glows */}
              <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-white/10 rounded-full blur-2xl" />
              
              <div className="flex justify-between items-start mb-10">
                <div>
                  <span className="text-[10px] text-blue-200/80 font-extrabold uppercase tracking-widest block">Dashboard Preview</span>
                  <h4 className="text-2xl font-black text-white mt-1">ZomIndia PRO</h4>
                </div>
                <span className="px-3 py-1 bg-white/15 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live On Air
                </span>
              </div>

              <div className="space-y-4">
                {/* Simulated stats bar */}
                <div className="grid grid-cols-2 gap-4 border-b border-white/10 pb-6 mb-6">
                  <div>
                    <span className="text-blue-200/60 text-[10px] uppercase font-bold tracking-wider">Today's Earnings</span>
                    <span className="text-3xl font-black text-white block mt-1">₹1,950</span>
                  </div>
                  <div>
                    <span className="text-blue-200/60 text-[10px] uppercase font-bold tracking-wider">Completed Jobs</span>
                    <span className="text-3xl font-black text-white block mt-1">3 / 4</span>
                  </div>
                </div>

                {/* Simulated bookings slider */}
                <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-white uppercase tracking-tight text-xs">
                    JB
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-sm truncate">Job #B8593 - AC Gas Charging</p>
                    <p className="text-[10px] text-blue-200/80 truncate">Location near Vijay Nagar, Indore</p>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-500 rounded-lg text-[10px] font-black uppercase tracking-wide">
                    Claimed
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Micro-footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-12 px-6 text-center text-xs text-slate-500 font-medium">
         <p>© 2026 ZomIndia Ecosystem. Secured by robust Firestore validation & Firebase Authentication.</p>
      </footer>
    </div>
  );
}
