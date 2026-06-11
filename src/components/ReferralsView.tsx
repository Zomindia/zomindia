import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { collection, query, where, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, FAQ as FAQType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid
} from 'recharts';
import { 
  Gift, 
  Copy, 
  Check, 
  Share2, 
  Users, 
  HelpCircle, 
  QrCode, 
  Sparkles, 
  Coins, 
  UserCheck, 
  CheckCircle,
  Clock,
  ArrowRight,
  Download,
  BarChart2,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Mail,
  Trophy,
  ChevronRight
} from 'lucide-react';

export default function ReferralsView({ profile, onBack }: { profile: UserProfile; onBack?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  
  // Real-time referred friends tracker
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  // FAQ state
  const [dbFaqs, setDbFaqs] = useState<FAQType[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  
  // Local feedback tracking
  const [faqFeedback, setFaqFeedback] = useState<Record<string, 'helpful' | 'not_helpful'>>({});
  const [showFaqNotesForm, setShowFaqNotesForm] = useState<Record<string, boolean>>({});
  const [faqNotesTexts, setFaqNotesTexts] = useState<Record<string, string>>({});

  const displayMessage = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setSuccessMessage(null);
    } else {
      setSuccessMessage(msg);
      setErrorMessage(null);
    }
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 4000);
  };

  const myReferralCode = profile.referralCode || `ZOM${profile.uid.slice(0, 6).toUpperCase()}`;
  // Deep-link for friends signup
  const signupReferUrl = `${window.location.origin}/#partner-signup?ref=${myReferralCode}`;

  useEffect(() => {
    // Listen to users collection where referredBy is the current user's uid
    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
      setReferredUsers(list);
      setLoadingFriends(false);
    }, (err) => {
      console.warn("Could not query referred friends directly in FireStore:", err);
      setLoadingFriends(false);
    });

    return () => unsubscribe();
  }, [profile.uid]);

  // Dynamic Firestore load to get existing general FAQs and match categories
  useEffect(() => {
    const q = query(collection(db, 'faqs'), where('isPublished', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as FAQType));
      setDbFaqs(list);
      setLoadingFaqs(false);
    }, (err) => {
      console.warn("Could not query general FAQs directly", err);
      setLoadingFaqs(false);
    });

    return () => unsubscribe();
  }, []);

  const copyReferralCode = () => {
    navigator.clipboard.writeText(myReferralCode);
    setCopied(true);
    (window as any).__showCopyToast?.(myReferralCode);
    displayMessage("Referral code copied successfully!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferral = async () => {
    const textStr = `Hey! Join zomindia - the best home service platform. Use my referral code "${myReferralCode}" during registration or in the app wallet to get an instant ₹100 Welcome Bonus!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'zomindia Referral Code',
          text: textStr,
          url: window.location.origin
        });
      } catch (err) {
        copyReferralCode();
      }
    } else {
      copyReferralCode();
    }
  };

  const applyReferral = async () => {
    if (!inputCode.trim()) return;
    setApplyingCode(true);
    try {
      const res = await fetch('/api/apply-referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.uid, referralCode: inputCode.trim().toUpperCase() })
      });
      const data = await res.json();
      if (data.success) {
        displayMessage(data.message);
        setInputCode('');
      } else {
        displayMessage(data.error || "Failed to apply code", true);
      }
    } catch (err) {
      displayMessage("Connection failed. Try again.", true);
    } finally {
      setApplyingCode(false);
    }
  };

  // Canvas PNG downloader helper for user's unique sharing code inside QR
  const downloadQRCode = () => {
    const canvas = document.getElementById('referral-qr-canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `zomindia-referral-qr-${myReferralCode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      displayMessage("Referral QR Code PNG downloaded!");
    } else {
      displayMessage("Failed to download QR code. Try again.", true);
    }
  };

  // Helpful handlers for vote feedbacks
  const handleFaqFeedback = async (faqId: string, type: 'helpful' | 'not_helpful', detailText?: string) => {
    setFaqFeedback(prev => ({ ...prev, [faqId]: type }));
    try {
      const docRef = doc(db, 'faqs', faqId);
      const updates: Record<string, any> = {
        [type === 'helpful' ? 'helpfulCount' : 'notHelpfulCount']: increment(1)
      };
      if (detailText && detailText.trim()) {
        updates.lastFeedbackNotes = detailText.trim();
      }
      await updateDoc(docRef, updates);
      displayMessage("Thank you for your feedback!");
    } catch (err) {
      console.warn("Could not save vote feedback to database:", err);
      displayMessage("Feedback recorded locally!");
    }
  };

  // Referral KPIs statistics
  const completedCount = referredUsers.filter(friend => friend.referralCreditPending === false).length;
  const pendingCount = referredUsers.length - completedCount;
  const totalEarnedRewards = completedCount * 100;
  const pendingPotentialRewards = pendingCount * 100;

  // Tier reward calculations
  const tiers = [
    { name: 'Bronze Standard', target: 0, rewardText: 'Base ₹100 match per friend' },
    { name: 'Silver Elite', target: 3, rewardText: '₹150 Flat Bonus upon achievement' },
    { name: 'Gold Champion', target: 6, rewardText: '₹350 Flat Bonus upon achievement' },
    { name: 'Platinum Superstar', target: 10, rewardText: '₹800 Flat Bonus on achievement' }
  ];

  // Find current tier & next tier
  const currentTierIndex = tiers.reduce((acc, tier, idx) => {
    if (completedCount >= tier.target) return idx;
    return acc;
  }, 0);
  
  const currentTier = tiers[currentTierIndex];
  const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;
  
  // Calculate progress percent to next tier
  let progressToNextTier = 100;
  let remainingForNextTier = 0;
  if (nextTier) {
    const tierRange = nextTier.target - currentTier.target;
    const currentTierProgress = completedCount - currentTier.target;
    progressToNextTier = Math.min(100, Math.max(0, (currentTierProgress / tierRange) * 100));
    remainingForNextTier = nextTier.target - completedCount;
  }

  // Premium, layered multi-cannon confetti burst for grand celebration
  const triggerFullConfetti = () => {
    try {
      // 1. Center burst
      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#3b82f6', '#2563eb', '#1d4ed8', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
      });

      // 2. Left dynamic cannon
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 60,
          origin: { x: 0, y: 0.75 },
          colors: ['#3b82f6', '#2563eb', '#10b981', '#fbbf24']
        });
      }, 200);

      // 3. Right dynamic cannon
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 60,
          origin: { x: 1, y: 0.75 },
          colors: ['#3b82f6', '#2563eb', '#10b981', '#fbbf24']
        });
      }, 350);

      // 4. Immersive shower
      setTimeout(() => {
        confetti({
          particleCount: 40,
          spread: 120,
          origin: { y: 0.3 }
        });
      }, 550);
    } catch (e) {
      console.warn("Confetti animation failed", e);
    }
  };

  // Real-time listener to check if user has climbed a new milestone tier
  const lastCompletedCount = useRef<number | null>(null);

  useEffect(() => {
    // Skip if friends list is still initially loading
    if (loadingFriends) return;

    if (lastCompletedCount.current !== null) {
      const prev = lastCompletedCount.current;
      
      // Tier milestones targets are: [3, 6, 10]
      const didCrossNewTier = [3, 6, 10].some(target => prev < target && completedCount >= target);

      if (didCrossNewTier) {
        triggerFullConfetti();
        displayMessage(`🎉 Hurrah! You've unlocked a new Milestone Tier: ${currentTier.name}! 🏆`);
      }
    }
    
    // Always sync the ref with current count
    lastCompletedCount.current = completedCount;
  }, [completedCount, loadingFriends, currentTier.name]);

  // Leaderboard of Community Top Referrers sorted descending
  const defaultLeaderboardUsers = [
    { name: 'Sohan Lal (Superstar)', count: 24, badge: '🏆 Platinum Superstar', active: false },
    { name: 'Anjali Sharma', count: 18, badge: '🏆 Platinum Superstar', active: false },
    { name: 'Vikram Grover', count: 12, badge: '🏆 Platinum Superstar', active: false },
    { name: 'Rahul Deshmukh', count: 9, badge: '⭐ Gold Champion', active: false },
    { name: 'Priya Narang', count: 7, badge: '⭐ Gold Champion', active: false },
    { name: 'Sunita Krishnan', count: 5, badge: 'Silver Elite', active: false },
    { name: 'Karthik Rao', count: 4, badge: 'Silver Elite', active: false },
    { name: 'Sneha Patil', count: 2, badge: 'Bronze Standard', active: false },
    { name: 'Rohan Mehra', count: 1, badge: 'Bronze Standard', active: false },
  ];

  const currentUserEntry = {
    name: profile.displayName || profile.email.split('@')[0] + ' (You)',
    count: completedCount,
    badge: `🎖️ ${currentTier.name}`,
    active: true
  };

  const topTenReferrers = [...defaultLeaderboardUsers, currentUserEntry]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Email Campaign Configs
  const emailSubject = "₹100 Free Wallet Credit for safe Home Services - Join zomindia!";
  const emailBody = `Hey,

I've been using zomindia to book high-quality, professional door-to-door home services (like deep cleaning, plumbing, AC maintenance, and beauty care) and wanted to share my exclusive invite with you!

When you register using my referral code, you'll instantly get ₹100 Welcome Bonus credited directly to your wallet for your first booking:

My Referral Code: ${myReferralCode}

Simply use the sign up link below, or apply the code on your wallet screen:
${signupReferUrl}

Enjoy top-tier professional service at home!
Best regards,
${profile.displayName || 'Your Friend'}`;

  const copyEmailTemplate = () => {
    const preformattedText = `Subject: ${emailSubject}\n\n${emailBody}`;
    navigator.clipboard.writeText(preformattedText);
    (window as any).__showCopyToast?.("Email Template text");
    displayMessage("Email template copied! Paste in your inbox.");
  };

  // Chart data preparing visual analytics
  const analyticsData = [
    {
      name: 'All Invites',
      'Friends Signed Up': referredUsers.length,
      'Rewards Credited (₹)': totalEarnedRewards,
      'Pending Potential (₹)': pendingPotentialRewards,
    },
    {
      name: 'Successful',
      'Friends Signed Up': completedCount,
      'Rewards Credited (₹)': totalEarnedRewards,
      'Pending Potential (₹)': 0,
    },
    {
      name: 'In Progress',
      'Friends Signed Up': pendingCount,
      'Rewards Credited (₹)': 0,
      'Pending Potential (₹)': pendingPotentialRewards,
    }
  ];

  // Dedicated mock referral FAQ data merged with DB relevant FAQs
  const defaultReferralFaqs: FAQType[] = [
    {
      id: 'referral-faq-1',
      question: 'How exactly does the ₹100 Refer & Earn credit program work?',
      answer: 'When you share your unique invitation code (ZOM...), your friend gets an instant ₹100 Welcome bonus applied into their wallet balance upon signing up. Once they complete their very first premium home service booking, a ₹100 cash reward is immediately credited into your wallet as well!',
      category: 'Referrals',
      isPublished: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'referral-faq-2',
      question: 'Is there a limit to how many friends I can refer?',
      answer: 'Absolutely not! You can invite as many friends, neighbors, or relatives as you want. There are no caps or restrictions on the referral rewards you can accumulate in your wallet. Book all your expert maintenance for free!',
      category: 'Referrals',
      isPublished: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'referral-faq-3',
      question: 'Where can my friend apply my referral code?',
      answer: 'Your friend can enter your unique ZOM... code during account registration/sign-up, or inside their Wallet page by inserting the code in the "Have a Referral Code?" input field under the Refer & Earn panel.',
      category: 'Referrals',
      isPublished: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'referral-faq-4',
      question: 'How do I spend my earned referral credits?',
      answer: 'Earned referral credits are loaded directly into your zomindia Wallet balance. During checkout for any maintenance, cleaning, or repair services, simply choose "Wallet payment" to redeem physical rupee-value points automatically.',
      category: 'Referrals',
      isPublished: true,
      createdAt: new Date().toISOString()
    }
  ];

  // Filtering DB faqs relevant to referrals or merging
  const dbReferralFaqs = dbFaqs.filter(faq => {
    const cat = (faq.category || '').toLowerCase();
    const qText = (faq.question || '').toLowerCase();
    const aText = (faq.answer || '').toLowerCase();
    return cat === 'referrals' || cat === 'referral' || qText.includes('referral') || aText.includes('referral') || qText.includes('friend');
  });

  const referralFaqs = dbReferralFaqs.length > 0 
    ? [...dbReferralFaqs, ...defaultReferralFaqs.filter(df => !dbReferralFaqs.some(dbf => dbf.question.toLowerCase() === df.question.toLowerCase()))] 
    : defaultReferralFaqs;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-16 relative">
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 -translate-x-1/2 bg-blue-700 text-white px-6 py-3.5 rounded-full text-xs font-black uppercase tracking-widest z-50 shadow-xl border border-blue-600/30 flex items-center gap-2"
          >
            <Sparkles size={14} className="text-amber-300 animate-spin" />
            {successMessage}
          </motion.div>
        )}
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 -translate-x-1/2 bg-rose-500 text-white px-6 py-3.5 rounded-full text-xs font-black uppercase tracking-widest z-50 shadow-xl"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-12">
        {onBack && (
          <button 
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#050CA6] hover:text-[#040980] bg-[#050CA6]/5 hover:bg-[#050CA6]/10 px-4 py-2 rounded-xl transition-all mb-5 cursor-pointer max-w-xs focus:outline-hidden"
          >
            &larr; Back to Profile Settings
          </button>
        )}
        <span className="px-3.5 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black tracking-widest uppercase rounded-full border border-blue-100 mb-3 inline-block">
          💝 Gift a Friend, Reward Yourself
        </span>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Refer & Earn Program</h1>
        <p className="text-slate-500 text-sm max-w-xl">Invite your inner circle to experience professional door-to-door maintenance. Both get premium cash rewards credited directly in your wallets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: main code and sharing cards */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Main program rules explaining rule: ₹100 cash reward credit per referral on 1st service completed */}
          <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-indigo-950 text-white p-8 md:p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />
            
            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/10 rounded-3xl flex items-center justify-center text-amber-300 shadow-inner">
                  <Gift size={28} className="animate-bounce" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                    Earn <span className="text-amber-300">₹100 Cash Reward</span>
                  </h2>
                  <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mt-1">Per Referral • credited inside your wallet</p>
                </div>
              </div>

              {/* Explicit user details detail note */}
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-sm font-medium leading-relaxed max-w-2xl text-slate-100">
                <span className="text-amber-300 font-extrabold block mb-1 text-xs uppercase tracking-wider">🌟 Referral Terms Highlight:</span>
                Get <strong className="text-white text-base">₹100/- cash reward credit</strong> into your wallet balance for every friend who signs up using your invitation code and <strong className="underline decoration-amber-400 text-white font-black">completes their very first service/booking</strong> with our experts! No limits or caps.
              </div>

              {/* Visual custom step line */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/10">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 text-xs font-black flex items-center justify-center">1</span>
                    <h4 className="font-bold text-sm text-white">Share Invitation code</h4>
                  </div>
                  <p className="text-xs text-blue-200 pl-9">Provide your friend with your special referral code.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 text-xs font-black flex items-center justify-center">2</span>
                    <h4 className="font-bold text-sm text-white">Friend Registers & Signs up</h4>
                  </div>
                  <p className="text-xs text-blue-200 pl-9">They get ₹100 discount bonus applied to their account.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 text-xs font-black flex items-center justify-center">3</span>
                    <h4 className="font-bold text-sm text-white">1st Service Completed</h4>
                  </div>
                  <p className="text-xs text-blue-200 pl-9">Once their service completes, your wallet instantly receives ₹100/-.</p>
                </div>
              </div>
            </div>
          </div>

          {/* CODE & QR CODE REPRESENTATION GENERATION SECTION */}
          <div className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-sm grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Left Col: Code & Copy-Sharing */}
            <div className="md:col-span-7 space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">Your unique referral code</h4>
                <div className="text-3xl font-black text-slate-900 tracking-wider font-mono select-all bg-slate-50 border border-slate-100/80 px-4 py-2 rounded-2xl inline-block">
                  {myReferralCode}
                </div>
              </div>

              <p className="text-xs font-medium text-slate-400 leading-relaxed">
                Invite friends via your personal signup link. The code is embedded in this link and ready for auto-fill registration bonus.
              </p>

              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={copyReferralCode}
                  className="flex-1 min-w-[130px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold px-4 py-3.5 rounded-2xl font-sans text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy Code'}
                </button>
                <button 
                  onClick={shareReferral}
                  className="flex-1 min-w-[130px] bg-blue-700 hover:bg-blue-800 text-white font-bold px-4 py-3.5 rounded-2xl font-sans text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-700/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 size={14} />
                  Share Link
                </button>
              </div>
            </div>

            {/* Right Col: Interactive Scanning QR code Representation */}
            <div className="md:col-span-5 bg-slate-50 border border-slate-100 p-6 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-3 bg-white rounded-2xl border border-slate-200/50 shadow-inner inline-block relative group">
                {/* QR Code Canvas for programmatic image download */}
                <QRCodeCanvas
                  id="referral-qr-canvas"
                  value={signupReferUrl}
                  size={120}
                  level="H"
                  bgColor="#ffffff"
                  fgColor="#1e293b"
                  includeMargin={true}
                />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-center gap-1.5 mb-1">
                  <QrCode size={12} className="text-blue-700" /> Dynamic Code representation
                </span>
                <p className="text-[11px] text-slate-500 font-medium">Scan code on mobile to register with ₹100/- bonus loaded!</p>
              </div>

              <button
                onClick={downloadQRCode}
                className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-wider py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 w-full font-mono cursor-pointer"
              >
                <Download size={13} /> Download QR PNG
              </button>
            </div>

          </div>

          {/* VISUAL TIER REWARD PROGRESS BAR */}
          <div className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 text-[10px] font-black tracking-widest uppercase rounded-full border border-amber-100/50 inline-block mb-1.5">
                  🏆 Gamified Milestones & Tiers
                </span>
                <h3 className="text-xl font-bold text-slate-900">Your Reward Milestone Tier</h3>
                <p className="text-xs text-slate-500 mt-0.5">Complete referrals to unlock higher milestone bonuses inside your wallet.</p>
              </div>

              <button
                onClick={triggerFullConfetti}
                title="Click to celebrate your current milestone!"
                className="bg-amber-50 border border-amber-100 px-4 py-2 rounded-2xl shrink-0 font-bold text-xs text-amber-800 flex items-center gap-2 cursor-pointer hover:bg-amber-100 active:scale-95 transition-all shadow-xs"
              >
                <Trophy size={14} className="text-amber-500 animate-bounce" />
                <span>Current: {currentTier.name}</span>
                <Sparkles size={12} className="text-amber-500" />
              </button>
            </div>

            {/* Progress Bar Container */}
            <div className="space-y-4">
              <div className="flex justify-between items-end text-xs font-bold text-slate-700">
                <span className="text-slate-400 uppercase tracking-wider text-[10px]">Tiers Roadmap Progress</span>
                {nextTier ? (
                  <span>
                    {completedCount} / {nextTier.target} Referrals
                  </span>
                ) : (
                  <span className="text-emerald-600 uppercase tracking-widest">🎉 MAX TIER ACHIEVED!</span>
                )}
              </div>

              {/* Progress track */}
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-sm"
                  style={{ width: `${progressToNextTier}%` }}
                />
              </div>

              {/* Next tier incentive info */}
              {nextTier ? (
                <div className="flex justify-between items-center text-xs text-slate-500 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex gap-2 items-center">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                    <span>
                      Need <strong className="text-slate-800">{remainingForNextTier} more</strong> referral{remainingForNextTier > 1 ? 's' : ''} to unlock <strong className="text-indigo-700">{nextTier.name}</strong>
                    </span>
                  </div>
                  <span className="text-xs font-black text-emerald-600 font-mono">+{nextTier.rewardText}</span>
                </div>
              ) : (
                <div className="text-center text-xs text-emerald-700 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 font-bold">
                  🌟 Amazing! You are a Platinum Superstar! You have reached our peak reward program level.
                </div>
              )}
            </div>

            {/* Dynamic Step-by-Step Tiers Map */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
              {tiers.map((tier, idx) => {
                const isCompleted = completedCount >= tier.target;
                const isCurrent = currentTierIndex === idx;

                return (
                  <div 
                    key={tier.name} 
                    onClick={isCompleted ? triggerFullConfetti : undefined}
                    title={isCompleted ? "Click to celebrate this milestone!" : `Unlock with ${tier.target} referrals`}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      isCompleted ? 'cursor-pointer hover:scale-105 active:scale-95 duration-150' : 'select-none'
                    } ${
                      isCurrent 
                        ? 'bg-blue-50/50 border-blue-400/50 shadow-xs ring-2 ring-blue-400/20' 
                        : isCompleted 
                        ? 'bg-slate-100/80 border-slate-200/60 opacity-90' 
                        : 'bg-white border-slate-100 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-center mb-1">
                      {isCompleted ? (
                        <CheckCircle size={14} className="text-emerald-600" />
                      ) : (
                        <span className="text-[10px] w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-slate-400 font-mono">
                          {tier.target}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-[11px] text-slate-800 truncate">{tier.name.split(' ')[0]}</p>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">{tier.target} invite{tier.target === 1 ? '' : 's'}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VISUAL PERFORMANCE ANALYTICS SUMMARY (RECHARTS BAR CHART) */}
          <div className="bg-white border border-slate-200 rounded-[40px] p-8 md:p-10 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black tracking-widest uppercase rounded-full border border-indigo-100/50 inline-block mb-1.5">
                  📈 Referral Performance Analytics
                </span>
                <h3 className="text-xl font-bold text-slate-950">Visual Summary Status</h3>
                <p className="text-xs text-slate-400 mt-0.5">Track your real-time invites made vs actual cash rewards points credited.</p>
              </div>

              <div className="flex items-center gap-6 bg-slate-50/80 border border-slate-100 px-5 py-3 rounded-2xl font-mono shrink-0">
                <div className="text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Invited</span>
                  <span className="text-xl font-black text-blue-700">{referredUsers.length}</span>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Earnings Wallet</span>
                  <span className="text-xl font-black text-emerald-600">₹{totalEarnedRewards}</span>
                </div>
              </div>
            </div>

            {/* Recharts Bar Chart Container */}
            <div className="w-full h-[260px] bg-slate-50/50 border border-slate-100 rounded-3xl p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analyticsData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    fontFamily="monospace"
                    tickLine={false} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    fontFamily="monospace"
                    tickLine={false}
                    axisLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      borderRadius: '16px', 
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                    cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', fontFamily: 'monospace' }} 
                  />
                  <Bar dataKey="Friends Signed Up" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="Rewards Credited (₹)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="Pending Potential (₹)" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex gap-4 items-center bg-blue-50/30 border border-blue-100/50 rounded-2xl p-4 text-xs font-semibold leading-relaxed text-indigo-950">
              <TrendingUp className="text-indigo-600 shrink-0" size={18} />
              <span>
                <strong>Next Milestone Goal:</strong> Invite more friends! Currently, you have <strong className="text-blue-700 font-bold">{pendingCount}</strong> pending referee bookings, representing up to <strong className="text-amber-600 font-bold">₹{pendingPotentialRewards}</strong> in potential wallet credits waiting to unlock.
              </span>
            </div>
          </div>

          {/* Referral timeline & list on friends referrers */}
          <div className="bg-white border border-slate-200 rounded-[40px] p-8 md:p-10 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Friends invited ({referredUsers.length})</h3>
                <p className="text-xs text-slate-400 mt-1">Check sign up status and booking updates.</p>
              </div>
              <Users className="text-slate-300" size={24} />
            </div>

            {loadingFriends ? (
              <div className="py-12 flex justify-center items-center">
                <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-blue-700 animate-spin" />
              </div>
            ) : referredUsers.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-[32px] p-8">
                <span className="text-4xl block mb-4">👋</span>
                <p className="text-sm text-slate-400 font-medium">No friends joined yet.</p>
                <p className="text-xs text-slate-400 mt-1">Invite friends to checkout zomindia services, we will track them here!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {referredUsers.map((friend) => {
                  const isCompleted = friend.referralCreditPending === false;
                  return (
                    <div 
                      key={friend.uid} 
                      className="flex items-center justify-between p-4 bg-slate-50/75 border border-slate-100 rounded-2xl hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-700 text-sm">
                          {friend.displayName ? friend.displayName.slice(0, 1).toUpperCase() : friend.email.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-800">{friend.displayName || 'zomindia User'}</p>
                          <p className="text-[10px] text-slate-400 font-mono italic">
                            Joined {friend.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 text-[10px] font-bold uppercase tracking-tight text-emerald-700 rounded-full inline-flex items-center gap-1">
                            <CheckCircle size={10} />
                            Completed • ₹100 Credited
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-50/80 border border-amber-100 text-[10px] font-bold uppercase tracking-tight text-amber-700 rounded-full inline-flex items-center gap-1.5">
                            <Clock size={10} className="animate-spin text-amber-500" />
                            Joined • Booking Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COMMUNITY TOP-10 REFERRALS LEADERBOARD */}
          <div className="bg-white border border-slate-200 rounded-[40px] p-8 md:p-10 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 text-[10px] font-black tracking-widest uppercase rounded-full border border-amber-100/50 inline-block mb-1.5">
                  🔥 Active Champions Arena
                </span>
                <h3 className="text-xl font-bold text-slate-900">National Top-10 Leaderboard</h3>
                <p className="text-xs text-slate-500 mt-0.5">Top-performing referrers based on total successfully completed bookings.</p>
              </div>
              <Trophy className="text-amber-500 animate-pulse shrink-0" size={24} />
            </div>

            {/* Custom Responsive Leaderboard Table */}
            <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-slate-50/50">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-5 text-center font-mono w-16">Rank</th>
                    <th className="py-3 px-4">User Pro</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Tier Designation</th>
                    <th className="py-3 px-5 text-right font-mono w-24">Referrals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                  {topTenReferrers.map((refUser, idx) => {
                    const rank = idx + 1;
                    const isTopThree = rank <= 3;
                    const isCurrentUser = refUser.active;

                    const medalEmoticons = ['🥇', '🥈', '🥉'];
                    const rankBadge = isTopThree ? medalEmoticons[idx] : `#${rank}`;

                    return (
                      <tr 
                        key={refUser.name + idx} 
                        className={`transition-all duration-150 ${
                          isCurrentUser 
                            ? 'bg-blue-50/90 hover:bg-blue-100/80 text-blue-900 border-l-4 border-l-blue-700' 
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {/* Rank indicator */}
                        <td className="py-4 px-5 text-center font-mono font-bold text-slate-500">
                          <span className={`inline-flex items-center justify-center rounded-full ${
                            isTopThree ? 'text-lg' : 'text-[11px] font-mono'
                          }`}>
                            {rankBadge}
                          </span>
                        </td>

                        {/* User identity & badge label */}
                        <td className="py-4 px-4 font-bold">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[160px]">{refUser.name}</span>
                            {isCurrentUser && (
                              <span className="bg-blue-700 text-white text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md scale-90">
                                YOU
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Tier classification designation */}
                        <td className="py-4 px-4 hidden sm:table-cell">
                          <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                            isCurrentUser 
                              ? 'bg-blue-100 text-blue-700' 
                              : idx === 0 
                              ? 'bg-pink-50 text-pink-700 border border-pink-150' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {refUser.badge}
                          </span>
                        </td>

                        {/* Referrals Count numeric data column */}
                        <td className="py-4 px-5 text-right font-mono font-extrabold text-sm text-slate-900">
                          {refUser.count}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="text-[11px] text-slate-400 text-center font-medium italic mt-2">
              🏆 Leaderboard refreshes in real-time. Invite friends to boost your total verified bookings count!
            </div>
          </div>

        </div>

        {/* Right column: Applying someone else's code card, statistics */}
        <div className="space-y-8">
          
          {/* Apply Partner Referral Input Code Section */}
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-[40px] p-8 shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
              <Coins size={22} />
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-1">Enter Invitation Code</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Referred by someone else? Apply their invitation code to immediately claim your <strong className="font-black text-emerald-800">₹100 discount bonus</strong> instantly added to your wallet!
            </p>

            {profile.referredBy ? (
              <div className="p-4 bg-white border border-emerald-100/50 text-center rounded-2xl">
                <span className="text-[10px] uppercase font-black tracking-widest block text-slate-400">Your Referrer status</span>
                <span className="text-xs font-bold text-emerald-700 mt-1 block flex items-center justify-center gap-1.5 uppercase tracking-wide">
                  <UserCheck size={14} /> Applied successfully
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="ZOM..."
                  disabled={applyingCode}
                  className="w-full bg-white border border-emerald-200 text-slate-800 px-4 py-3.5 rounded-2xl text-center font-black tracking-widest uppercase focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-600/50 outline-none text-base placeholder:text-slate-300 font-mono"
                />
                <button
                  type="button"
                  onClick={applyReferral}
                  disabled={!inputCode || applyingCode}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm shadow-emerald-700/10"
                >
                  {applyingCode ? 'Verifying...' : 'Claim Welcome Bonus'}
                </button>
              </div>
            )}
          </div>

          {/* Quick Stats Summary */}
          <div className="bg-slate-50 border border-slate-200/50 rounded-[40px] p-8 space-y-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">Program Rules Info</h3>
            
            <div className="space-y-4 text-xs font-semibold text-slate-600 leading-relaxed">
              <div className="flex gap-2.5 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-700 mt-1 shrink-0" />
                <span>The friend must register a new account on zomindia and must use your exact referral code on sign up or in the invite field.</span>
              </div>
              <div className="flex gap-2.5 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-700 mt-1 shrink-0" />
                <span>Only one welcoming code can be applied per user profile.</span>
              </div>
              <div className="flex gap-2.5 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-700 mt-1 shrink-0" />
                <span>The first service of the friend must have status marked as <strong className="text-slate-800">completed</strong> or <strong className="text-slate-800">finalized</strong>.</span>
              </div>
              <div className="flex gap-2.5 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-700 mt-1 shrink-0" />
                <span>Rewards have unlimited validity and can be spent on any future home service booking without surge limitations!</span>
              </div>
            </div>
          </div>

          {/* EMAIL REFERRAL PRE-FILLED OUTREACH TEMPLATE */}
          <div className="bg-white border border-rose-100 rounded-[40px] p-8 shadow-sm space-y-6">
            <div className="flex gap-3.5 items-center">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center border border-rose-100/50">
                <Mail size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Email Invitation Campaign</h3>
                <p className="text-xs text-slate-500">Perfect pre-filled email to invite your friends and family.</p>
              </div>
            </div>

            {/* Simulated Email Client Container */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white text-xs text-slate-700">
              {/* Email Headers Header */}
              <div className="bg-slate-50 p-3.5 border-b border-slate-200 space-y-2 font-sans font-medium text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="w-12 text-slate-400 font-bold uppercase tracking-wider text-[10px]">Subject:</span>
                  <span className="text-slate-800 font-bold">{emailSubject}</span>
                </div>
              </div>

              {/* Email Body Preview container */}
              <div className="p-4 bg-slate-50/20 max-h-[180px] overflow-y-auto font-mono text-[10.5px] leading-relaxed text-slate-600 whitespace-pre-wrap select-all">
                {emailBody}
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={copyEmailTemplate}
                className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Copy size={14} />
                Copy Pre-filled Email Text
              </button>

              <a
                href={`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-100/60 text-rose-700 font-bold py-3.5 px-4 rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Mail size={14} />
                Open Default Mail App
              </a>
            </div>

            <p className="text-[10px] text-slate-400 text-center font-medium leading-normal">
              Clicking copies both Subject & Body of the letter to clipboard so you can easily send emails via Outlook, Gmail or Yahoo.
            </p>
          </div>

        </div>
      </div>

      {/* DEDICATED REFERRAL QUERY SPECIFIC FAQ SECTION AT BOTTOM */}
      <div className="mt-16 border-t border-slate-150 pt-16">
        <div className="mb-10 text-center md:text-left">
          <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mb-4 mx-auto md:mx-0 shadow-sm border border-blue-100">
            <HelpCircle size={22} />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">Referral Program Help Center</h2>
          <p className="text-xs text-slate-500 mt-1">Frequently asked questions specifically regarding your Referrals, points, rewards and terms.</p>
        </div>

        {loadingFaqs ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-blue-700 animate-spin" />
          </div>
        ) : (
          <div className="faq-list-container grid grid-cols-1 md:grid-cols-2 gap-6">
            {referralFaqs.map((faq) => {
              const isFaqExpanded = expandedFaqId === faq.id;
              const hasGivenVote = faqFeedback[faq.id];
              const isNotesFormOpen = showFaqNotesForm[faq.id];

              return (
                <div 
                  key={faq.id} 
                  className="bg-white border border-slate-200/80 rounded-[28px] overflow-hidden hover:border-slate-350 hover:shadow-sm transition-all duration-300 flex flex-col"
                >
                  {/* Accordion trigger header */}
                  <button
                    type="button"
                    onClick={() => setExpandedFaqId(prev => prev === faq.id ? null : faq.id)}
                    className="w-full text-left p-6 flex justify-between items-start gap-4 outline-none select-none cursor-pointer hover:bg-slate-50/20 transition-all duration-200"
                  >
                    <div className="flex gap-3">
                      <div className="mt-1 text-blue-700 shrink-0">
                        <HelpCircle size={18} />
                      </div>
                      <span className="font-bold text-slate-900 text-sm tracking-tight leading-snug">
                        {faq.question}
                      </span>
                    </div>
                    <div className={`text-slate-400 shrink-0 mt-1 transition-transform duration-250 ${isFaqExpanded ? 'rotate-180' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isFaqExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-0 border-t border-slate-50/80 text-xs font-semibold leading-relaxed text-slate-600 flex flex-col gap-5">
                          <p className="pt-4 text-slate-500 font-medium font-sans text-[13px] leading-relaxed">
                            {faq.answer}
                          </p>

                          {/* Specific FAQ helpfulness feedback matching selector .faq-article-feedback */}
                          <div className="faq-article-feedback border-t border-slate-100 pt-4 mt-2 text-[11px] flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-bold">Was this referral answer helpful?</span>
                              <div className="flex items-center gap-2">
                                {hasGivenVote ? (
                                  <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50 animate-in zoom-in-95">
                                    <CheckCircle size={12} />
                                    {hasGivenVote === 'helpful' ? 'Thank you!' : 'Thanks for details!'}
                                  </span>
                                ) : isNotesFormOpen ? (
                                  <span className="text-slate-400 italic font-mono">Writing notes...</span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleFaqFeedback(faq.id, 'helpful')}
                                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-xl cursor-pointer font-bold transition-all text-[10px]"
                                    >
                                      <ThumbsUp size={11} /> Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowFaqNotesForm(prev => ({ ...prev, [faq.id]: true }))}
                                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50 rounded-xl cursor-pointer font-bold transition-all text-[10px]"
                                    >
                                      <ThumbsDown size={11} /> No
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Insufficient notes/No clicked text feedback matching previous turn criteria */}
                            {isNotesFormOpen && !hasGivenVote && (
                              <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2"
                              >
                                <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">
                                  How can we make this answer clearer?
                                </label>
                                <textarea
                                  value={faqNotesTexts[faq.id] || ''}
                                  onChange={(e) => setFaqNotesTexts(prev => ({ ...prev, [faq.id]: e.target.value }))}
                                  placeholder="Provide suggestions on what was missing from compiling terms..."
                                  rows={2}
                                  className="w-full bg-white border border-slate-250 p-2 text-[11px] font-semibold text-slate-700 outline-none rounded-lg focus:ring-4 focus:ring-rose-250/10 focus:border-rose-500 resize-none font-sans"
                                />
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowFaqNotesForm(prev => ({ ...prev, [faq.id]: false }));
                                      setFaqNotesTexts(prev => ({ ...prev, [faq.id]: '' }));
                                    }}
                                    className="px-2 font-black text-slate-400 hover:text-slate-600 uppercase text-[9px] tracking-wider cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const notesText = faqNotesTexts[faq.id] || '';
                                      handleFaqFeedback(faq.id, 'not_helpful', notesText);
                                      setShowFaqNotesForm(prev => ({ ...prev, [faq.id]: false }));
                                    }}
                                    className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer font-mono"
                                  >
                                    Send Feedback
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
