import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Gift, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Plus, 
  Search, 
  Filter, 
  Sparkles, 
  TrendingUp, 
  UserPlus, 
  Settings, 
  Trash2, 
  AlertCircle, 
  Trophy, 
  ArrowRightLeft,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Undo,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  writeBatch, 
  Timestamp, 
  getDoc,
  setDoc,
  deleteField,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Booking } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface ReferralLifecycleManagerProps {
  users: UserProfile[];
  bookings: Booking[];
  currentUserProfile: UserProfile;
}

export default function ReferralLifecycleManager({ users, bookings, currentUserProfile }: ReferralLifecycleManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'connections' | 'ledger' | 'campaign-rules'>('connections');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_booking' | 'pending_validation' | 'rewarded'>('all');
  
  // Transactions list specifically for referral payouts
  const [referralTransactions, setReferralTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  // Campaign Settings
  const [referrerReward, setReferrerReward] = useState<number>(100);
  const [refereeReward, setRefereeReward] = useState<number>(100);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Modals / Flow States
  const [isManualReferralModalOpen, setIsManualReferralModalOpen] = useState(false);
  const [manualReferrerId, setManualReferrerId] = useState('');
  const [manualRefereeId, setManualRefereeId] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Referral Transactions and Settings
  useEffect(() => {
    setLoadingTransactions(true);
    // Listen for wallet transactions that correspond to referrals
    const unsubTx = onSnapshot(
      query(collection(db, 'walletTransactions'), orderBy('createdAt', 'desc')), 
      (snap) => {
        const txList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Filter transactions for referrals on client side
        const referralTxs = txList.filter((tx: any) => 
          tx.reason?.toLowerCase().includes('referral') || 
          tx.reason?.toLowerCase().includes('welcome bonus') ||
          tx.reason?.toLowerCase().includes('referred')
        );
        setReferralTransactions(referralTxs);
        setLoadingTransactions(false);
      },
      (err) => {
        console.error("Error loading referral transactions", err);
        setLoadingTransactions(false);
      }
    );

    // Fetch config values if stored in settings/referral_config
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'settings', 'referral_config'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          if (data.referrerReward) setReferrerReward(data.referrerReward);
          if (data.refereeReward) setRefereeReward(data.refereeReward);
        }
      } catch (e) {
        console.warn("Could not load referral config document, falling back to defaults.", e);
      }
    };
    fetchConfig();

    return () => unsubTx();
  }, []);

  // Save Campaign Rules to Settings collection
  const handleSaveCampaignRules = async () => {
    setSavingSettings(true);
    setSettingsSuccess(false);
    try {
      await setDoc(doc(db, 'settings', 'referral_config'), {
        referrerReward,
        refereeReward,
        updatedAt: Timestamp.now(),
        updatedBy: currentUserProfile.email
      });
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) {
      console.error("Failed to save campaign settings", err);
      alert("Error saving settings: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Compile full Referral Relationship list dynamically from the User lists
  const referralConnections = useMemo(() => {
    return users
      .filter(u => u.referredBy)
      .map(referee => {
        const referrer = users.find(u => u.uid === referee.referredBy);
        
        // Check local booking state for referee's first completed job
        const refereeBookings = bookings.filter(b => b.customerUid === referee.uid);
        const hasCompletedBooking = refereeBookings.some(b => ['completed', 'finalized'].includes(b.status));
        
        // Find if they have any bookings details to show (count, dates)
        const bookingsCount = refereeBookings.length;
        const lastBookingDate = refereeBookings[0]?.createdAt?.toDate?.() || null;

        // Status resolution:
        // 1. If referralCreditPending is false => Completely rewarded
        // 2. If referralCreditPending is true AND has completed booking => Completed but pending validation / processing
        // 3. Otherwise => Pending first booking
        let status: 'rewarded' | 'pending_validation' | 'pending_booking' = 'pending_booking';
        if (referee.referralCreditPending === false) {
          status = 'rewarded';
        } else if (hasCompletedBooking) {
          status = 'pending_validation';
        }

        return {
          id: referee.uid, // Connection identifier unique to referee
          referee,
          referrer,
          hasCompletedBooking,
          bookingsCount,
          lastBookingDate,
          status,
          appliedAt: referee.createdAt?.toDate?.() || null
        };
      });
  }, [users, bookings]);

  // Filter connections: search referrer/referee by display name or email, or status
  const filteredConnections = useMemo(() => {
    return referralConnections.filter(conn => {
      const rName = conn.referrer?.displayName || 'Unknown Referrer';
      const rEmail = conn.referrer?.email || '';
      const fName = conn.referee?.displayName || '';
      const fEmail = conn.referee?.email || '';
      
      const matchesSearch = 
        rName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (conn.referrer?.referralCode || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = 
        statusFilter === 'all' || 
        conn.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [referralConnections, searchTerm, statusFilter]);

  // Statistical Summaries
  const stats = useMemo(() => {
    const totalLinked = referralConnections.length;
    const rewarded = referralConnections.filter(c => c.status === 'rewarded').length;
    const pendingValidation = referralConnections.filter(c => c.status === 'pending_validation').length;
    const pendingBooking = referralConnections.filter(c => c.status === 'pending_booking').length;
    const totalPayouts = referralTransactions.reduce((acc, tx) => acc + (tx.amount || 0), 0);

    return {
      totalLinked,
      rewarded,
      pendingValidation,
      pendingBooking,
      totalPayouts
    };
  }, [referralConnections, referralTransactions]);

  // Real-time automatic trigger: Sends an immediate push notification to the referrer 
  // immediately when their referred friend completes their first service booking
  useEffect(() => {
    referralConnections.forEach(async (conn) => {
      // If status is 'pending_validation', it means they completed their first booking but reward is pending approval
      if (conn.status === 'pending_validation' && conn.referrer?.uid) {
        const notificationKey = `notified_first_booking_${conn.referee.uid}`;
        const hasNotified = localStorage.getItem(notificationKey);
        
        if (!hasNotified) {
          // Instantly lock in local storage to prevent double-firing race conditions
          localStorage.setItem(notificationKey, 'true');
          
          console.log(`[Referral Lifecycle Trigger] Dispatching immediate push notification to referrer: ${conn.referrer.displayName} as friend ${conn.referee.displayName} completed first booking.`);
          
          try {
            await fetch('/api/send-push-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: conn.referrer.uid,
                title: "🎉 Friend's First Service Completed!",
                message: `Amazing! Your invited friend ${conn.referee.displayName || 'friend'} has completed their first service booking! Your ₹${referrerReward} referral reward is now pending validation and will be disbursed shortly.`
              })
            });
          } catch (error) {
            console.error("[Referral Lifecycle Trigger] Failed to send push notification to referrer:", error);
          }
        }
      }
    });
  }, [referralConnections, referrerReward]);

  // Create Manual Referral
  const handleCreateManualReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    setManualSuccess(null);

    if (!manualReferrerId || !manualRefereeId) {
      setManualError("Please select both a referrer and a referee user.");
      return;
    }

    if (manualReferrerId === manualRefereeId) {
      setManualError("Referrer and Referee cannot be the same user profile.");
      return;
    }

    try {
      const refereeUser = users.find(u => u.uid === manualRefereeId);
      if (refereeUser?.referredBy) {
        setManualError("Selected referee is already linked to another referrer.");
        return;
      }

      const batch = writeBatch(db);
      
      // Update referee user profile
      const refereeRef = doc(db, 'users', manualRefereeId);
      batch.update(refereeRef, {
        referredBy: manualReferrerId,
        referralCreditPending: true,
        // Optional welcome reward instantly given
        walletBalance: (refereeUser?.walletBalance || 0) + refereeReward,
        updatedAt: Timestamp.now()
      });

      // Add Welcome profit transaction for referee
      const txRef = doc(collection(db, 'walletTransactions'));
      batch.set(txRef, {
        userId: manualRefereeId,
        amount: refereeReward,
        type: 'credit',
        reason: `Welcome Bonus (Manually Referred by Admin override)`,
        status: 'completed',
        createdAt: Timestamp.now()
      });

      await batch.commit();

      setManualSuccess("Successfully created referral link and credited referee welcome bonus!");
      setManualReferrerId('');
      setManualRefereeId('');
      setTimeout(() => {
        setIsManualReferralModalOpen(false);
        setManualSuccess(null);
      }, 2500);

    } catch (err: any) {
      console.error("Manual referral insertion crashed:", err);
      setManualError(err.message || "Failed to finalize the manual referral creation.");
    }
  };

  // FORCE DISBURSE REFERRAL PAYOUT (Completing the lifecycle manually)
  const handleForceDisburseReward = async (conn: any) => {
    const confirmDisburse = window.confirm(
      `Disburse Referral Reward?\nThis will bypass booking checks, instantly credit ₹${referrerReward} to referrer's wallet (${conn.referrer?.displayName}), and seal this referral as completed.`
    );
    if (!confirmDisburse) return;

    setProcessingActionId(conn.id);
    setActionError(null);

    try {
      const batch = writeBatch(db);

      // 1. Update Referee: Mark as not pending anymore (Successfully Resolved)
      const refereeRef = doc(db, 'users', conn.referee.uid);
      batch.update(refereeRef, {
        referralCreditPending: false,
        updatedAt: Timestamp.now()
      });

      // 2. Update Referrer: Add Reward amount to wallet Balance
      const referrerRef = doc(db, 'users', conn.referrer.uid);
      batch.update(referrerRef, {
        walletBalance: (conn.referrer.walletBalance || 0) + referrerReward,
        updatedAt: Timestamp.now()
      });

      // 3. Set a Wallet Payout transaction entry
      const txRef = doc(collection(db, 'walletTransactions'));
      batch.set(txRef, {
        userId: conn.referrer.uid,
        amount: referrerReward,
        type: 'credit',
        reason: `Referral Bonus (Friend ${conn.referee.displayName} joined)`,
        status: 'completed',
        createdAt: Timestamp.now()
      });

      await batch.commit();
      
      // Dispatch server trigger notification for security
      try {
        await fetch('/api/send-push-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: conn.referrer.uid,
            title: "💰 Referral Bonus Loaded!",
            message: `Congratulations! Your invite for ${conn.referee.displayName} is approved. ₹${referrerReward} credited to your wallet.`
          })
        });
      } catch (e) {
        console.warn("FCM notify side-event failed:", e);
      }

    } catch (err: any) {
      console.error("Disburse error", err);
      setActionError(err?.message || "Failed to perform automated credit disburse.");
    } finally {
      setProcessingActionId(null);
    }
  };

  // VOID OR CANCEL REFERRAL RELATIONSHIP
  const handleVoidReferralLink = async (conn: any) => {
    const confirmCancel = window.confirm(
      `Warning: Void Referral Connection?\nThis will disconnect ${conn.referee.displayName} from ${conn.referrer?.displayName || 'their referrer'} forever. Note: Wallet balances already paid will NOT be auto-deducted unless specified. Proceed with unlinking?`
    );
    if (!confirmCancel) return;

    setProcessingActionId(conn.id);
    setActionError(null);

    try {
      const refereeRef = doc(db, 'users', conn.referee.uid);
      
      // Remove referral links completely
      await updateDoc(refereeRef, {
        referredBy: deleteField(),
        referralCreditPending: deleteField(),
        updatedAt: Timestamp.now()
      });

    } catch (err: any) {
      console.error("Voiding relation error", err);
      setActionError(err?.message || "Failed to disconnect referral nodes.");
    } finally {
      setProcessingActionId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowRightLeft size={16} />
            </div>
            <h2 className="text-xl font-bold font-sans text-slate-900 tracking-tight">Referral Lifecycle Workspace</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">Create, audit, manually disburse, and manage user referral connections and rewards.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setIsManualReferralModalOpen(true)}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs uppercase tracking-widest px-5 py-3 rounded-2xl transition-all shadow-md cursor-pointer"
          >
            <UserPlus size={14} />
            Add Manual Referral
          </button>
        </div>
      </div>

      {/* Numerical Analysis Dashboard Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Connections</p>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-2xl font-black text-slate-950">{stats.totalLinked}</span>
            <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">Links</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pending Bookings</p>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-2xl font-black text-amber-600">{stats.pendingBooking}</span>
            <span className="text-[8px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md uppercase tracking-wider">ACTIVE</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between animate-pulse">
          <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Pending Reward</p>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-2xl font-black text-emerald-600">{stats.pendingValidation}</span>
            <span className="text-[8px] font-black text-white bg-emerald-600 px-1.5 py-0.5 rounded-md uppercase tracking-wider">ACTION</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Fully Settled</p>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-2xl font-black text-blue-700">{stats.rewarded}</span>
            <span className="text-[8px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md uppercase tracking-wider font-mono">DONE</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Referral Payouts</p>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-2xl font-black text-slate-900">₹{stats.totalPayouts}</span>
            <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-lg">RUPEES</span>
          </div>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div className="flex bg-white rounded-2xl p-1 shadow-xs border border-slate-100 max-w-lg">
        <button
          onClick={() => setActiveSubTab('connections')}
          className={`flex-1 py-3 text-center rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
            activeSubTab === 'connections' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-900'
          }`}
        >
          Connections Directory
        </button>
        <button
          onClick={() => setActiveSubTab('ledger')}
          className={`flex-1 py-3 text-center rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
            activeSubTab === 'ledger' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-900'
          }`}
        >
          Referral Ledger ({referralTransactions.length})
        </button>
        <button
          onClick={() => setActiveSubTab('campaign-rules')}
          className={`flex-1 py-3 text-center rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
            activeSubTab === 'campaign-rules' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-900'
          }`}
        >
          Campaign Rules Config
        </button>
      </div>

      {/* Main Tab Area */}
      <div className="space-y-4">
        {activeSubTab === 'connections' && (
          <div className="space-y-4">
            {/* Search and Filters toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <div className="relative flex-1 max-w-sm" onTouchStartCapture={(e) => e.stopPropagation()} onMouseDownCapture={(e) => e.stopPropagation()}>
                <Search size={14} className="absolute left-4 top-3.5 text-slate-400" />
                <input 
                  type="text" 
                  inputMode="text"
                  enterKeyHint="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Referrer, Referee or Code..."
                  className="w-full bg-slate-50 pl-11 pr-4 py-3 text-xs rounded-xl border border-slate-100 focus:outline-none focus:border-blue-400 font-medium"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                <Filter size={12} className="text-slate-400 shrink-0" />
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    statusFilter === 'all' 
                      ? 'bg-slate-900 text-white border-slate-905' 
                      : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                  }`}
                >
                  All ({referralConnections.length})
                </button>
                <button
                  onClick={() => setStatusFilter('pending_validation')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    statusFilter === 'pending_validation' 
                      ? 'bg-emerald-600 text-white border-emerald-600'      
                      : 'bg-white text-emerald-600 border-emerald-100 hover:border-emerald-300'
                  }`}
                >
                  Pending Action ({stats.pendingValidation})
                </button>
                <button
                  onClick={() => setStatusFilter('pending_booking')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    statusFilter === 'pending_booking' 
                      ? 'bg-amber-600 text-white border-amber-600' 
                      : 'bg-white text-amber-600 border-amber-100 hover:border-amber-300'
                  }`}
                >
                  Awaiting Booking ({stats.pendingBooking})
                </button>
                <button
                  onClick={() => setStatusFilter('rewarded')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    statusFilter === 'rewarded' 
                      ? 'bg-blue-700 text-white border-blue-700' 
                      : 'bg-white text-blue-700 border-blue-100 hover:border-blue-300'
                  }`}
                >
                  Fully Reward Paid ({stats.rewarded})
                </button>
              </div>
            </div>

            {/* Error alerts */}
            {actionError && (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-3 text-rose-800 text-xs font-semibold">
                <AlertCircle size={16} className="text-rose-600" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Connections Grid */}
            {filteredConnections.length === 0 ? (
              <div className="bg-white text-center py-16 rounded-[32px] border border-slate-100 shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto">
                  <GitBranchMock size={24} />
                </div>
                <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">No Connection Links Found</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">None of your user registrations matched the selected filter query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredConnections.map((conn) => (
                  <div 
                    key={conn.id} 
                    className={`bg-white rounded-[32px] p-6 border ${
                      conn.status === 'pending_validation' 
                        ? 'border-emerald-200 ring-2 ring-emerald-500/20' 
                        : 'border-slate-100'
                    } shadow-sm space-y-4 relative overflow-hidden`}
                  >
                    {/* Status Ribbon/Badge Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black text-slate-400 font-mono uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">
                        Invited: {conn.appliedAt ? conn.appliedAt.toLocaleDateString() : 'Unknown'}
                      </span>
                      
                      {conn.status === 'rewarded' ? (
                        <span className="bg-blue-50 text-blue-700 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg flex items-center gap-1">
                          <CheckCircle2 size={10} /> Paid Full ₹{referrerReward}
                        </span>
                      ) : conn.status === 'pending_validation' ? (
                        <span className="bg-emerald-50 text-emerald-800 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg flex items-center gap-1 animate-pulse border border-emerald-100">
                          <Sparkles size={10} /> Payout Pending
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-800 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg flex items-center gap-1">
                          <Clock size={10} /> Active Tracker
                        </span>
                      )}
                    </div>

                    {/* Nodes flow: Referrer -> Referee */}
                    <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between relative">
                      {/* Left: Inviter (Referrer) */}
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Referrer (Inviter)</p>
                        <div className="flex items-center gap-2">
                          <img 
                            src={conn.referrer?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conn.referrer?.displayName || 'referrer'}`} 
                            className="w-8 h-8 rounded-full border border-slate-200"
                            alt=""
                          />
                          <div className="min-w-0">
                            <h5 className="text-[11px] font-extrabold text-slate-900 truncate">{conn.referrer?.displayName || 'Anonymous'}</h5>
                            <p className="text-[9px] font-bold text-blue-700 font-mono truncate">{conn.referrer?.referralCode || 'NO CODE'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Direction Center block */}
                      <div className="shrink-0 text-slate-300 absolute left-1/2 -ml-2.5 bg-white p-1 rounded-full border border-slate-100">
                        <ChevronRight size={14} />
                      </div>

                      {/* Right: Invitee (Referee / Friend) */}
                      <div className="flex-1 min-w-0 pl-4 text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Friend Invite (Referee)</p>
                        <div className="flex items-center gap-2 justify-end">
                          <div className="min-w-0">
                            <h5 className="text-[11px] font-extrabold text-slate-900 truncate">{conn.referee.displayName || 'Friend User'}</h5>
                            <p className="text-[9px] text-slate-500 font-medium truncate">{conn.referee.email}</p>
                          </div>
                          <img 
                            src={conn.referee.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conn.referee.displayName || 'referee'}`} 
                            className="w-8 h-8 rounded-full border border-slate-200"
                            alt=""
                          />
                        </div>
                      </div>
                    </div>

                    {/* Booking Stats / Status Tracker of the connection */}
                    <div className="space-y-2.5 pt-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-bold">First booking completed:</span>
                        {conn.hasCompletedBooking ? (
                          <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 size={12} /> Yes ({conn.bookingsCount} Total)
                          </span>
                        ) : (
                          <span className="font-extrabold text-slate-500 flex items-center gap-1">
                            <Clock size={12} /> Pending First Booking
                          </span>
                        )}
                      </div>

                      {conn.hasCompletedBooking && (
                        <div className="bg-emerald-50/20 border border-emerald-100/50 rounded-xl p-2.5 text-[9px] flex justify-between items-center text-slate-600">
                          <span className="font-bold flex items-center gap-1"><Trophy size={10} className="text-emerald-500" /> Milestone Cleared</span>
                          <span>Reward Status: {conn.status === 'rewarded' ? 'Released' : 'Locked on Ledger'}</span>
                        </div>
                      )}
                    </div>

                    {/* Active Administrator Commands (Completes the Lifecycle) */}
                    <div className="flex gap-2 pt-2 border-t border-slate-50">
                      {/* 1. Standard action for validation */}
                      {conn.status !== 'rewarded' && (
                        <button
                          onClick={() => handleForceDisburseReward(conn)}
                          disabled={processingActionId === conn.id}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          {processingActionId === conn.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 size={12} />
                              Disburse ₹{referrerReward}
                            </>
                          )}
                        </button>
                      )}

                      {/* 2. Void / Undo referral */}
                      <button
                        onClick={() => handleVoidReferralLink(conn)}
                        disabled={processingActionId === conn.id}
                        className="flex-1 border border-slate-200 hover:border-rose-200 text-slate-400 hover:text-rose-600 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-white"
                        title="Disconnect this referral tree completely"
                      >
                        <Undo size={12} />
                        Disconnect Link
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Ledger Transactions Auditing tab */}
        {activeSubTab === 'ledger' && (
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Referral Profit Ledger</h4>
                <p className="text-xs text-slate-400 font-medium">Verified historical log of payments credited dynamically via Refer and Earn campaign.</p>
              </div>
              <span className="text-[10px] bg-slate-100 font-black text-slate-600 px-3 py-1.5 rounded-xl uppercase tracking-widest font-mono">
                {referralTransactions.length} AUDIT RECEIPTS
              </span>
            </div>

            {loadingTransactions ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-slate-400">Loading ledger logs...</span>
              </div>
            ) : referralTransactions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold">
                No verified referral transactions found in the centralized database yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-4">Stakeholder Profile</th>
                      <th className="py-4">Referral Reward Type</th>
                      <th className="py-4 font-mono">Receipt Reference ID</th>
                      <th className="py-4">Credited At</th>
                      <th className="py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {referralTransactions.map((tx) => {
                      const user = users.find(u => u.uid === tx.userId);
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <img 
                                src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || 'user'}`} 
                                className="w-7 h-7 rounded-full border border-slate-200"
                                alt=""
                              />
                              <div>
                                <span className="font-extrabold text-slate-900 block">{user?.displayName || 'Unknown Stakeholder'}</span>
                                <span className="text-[10px] font-medium text-slate-400">{user?.email || 'N/A'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 font-semibold text-slate-700">
                             <div className="flex items-center gap-1.5 text-blue-700">
                               <Sparkles size={12} className="shrink-0" />
                               <span className="text-slate-900 font-bold">{tx.reason || 'Referral Bonus Reward'}</span>
                             </div>
                          </td>
                          <td className="py-4 font-mono text-[10px] text-slate-400">{tx.id}</td>
                          <td className="py-4 text-slate-500 font-medium">{tx.createdAt?.toDate?.() ? tx.createdAt.toDate().toLocaleString() : 'N/A'}</td>
                          <td className="py-4 text-right">
                             <span className="text-emerald-600 font-black text-sm bg-emerald-50 px-2.5 py-1 rounded-xl">
                               +₹{tx.amount || 100}
                             </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Campaign Rules Config Configuration tab */}
        {activeSubTab === 'campaign-rules' && (
          <div className="max-w-2xl bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Settings size={18} className="text-slate-900" />
                <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">Active Campaign Constants</h4>
              </div>
              <p className="text-xs text-slate-500 font-semibold">Modify payout constants of the Refer and Earn system. Updating forces state syncing across all active user views.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Referrer Reward (Indian Rupees)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-sm font-black text-slate-400">₹</span>
                  <input 
                    type="number"
                    value={referrerReward}
                    onChange={(e) => setReferrerReward(Number(e.target.value))}
                    className="w-full bg-slate-50/50 border border-slate-100 pl-8 pr-4 py-3.5 text-sm rounded-2xl font-black focus:outline-none focus:border-blue-400"
                  />
                </div>
                <p className="text-[9px] text-slate-400 font-medium">Bounty payout loaded instantly to inviter's wallet balance upon referee's 1st job clearance.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Referred Friend Reward (Rupees)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-sm font-black text-slate-400">₹</span>
                  <input 
                    type="number"
                    value={refereeReward}
                    onChange={(e) => setRefereeReward(Number(e.target.value))}
                    className="w-full bg-slate-50/50 border border-slate-100 pl-8 pr-4 py-3.5 text-sm rounded-2xl font-black focus:outline-none focus:border-blue-400"
                  />
                </div>
                <p className="text-[9px] text-slate-400 font-medium">Instant welcome cashback bonus credited to newly referred friend's ledger profile upon linking code.</p>
              </div>
            </div>

            {settingsSuccess && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold rounded-2xl p-4 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Campaign Constant Rules stored securely on the Firestore Server!</span>
              </div>
            )}

            <button
              onClick={handleSaveCampaignRules}
              disabled={savingSettings}
              className="w-full sm:w-auto bg-slate-900 border border-slate-900 hover:bg-slate-850 text-white font-extrabold uppercase tracking-widest text-[10px] px-8 py-4 rounded-2xl shadow-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {savingSettings ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating Database...
                </>
              ) : (
                'Save Payout constants'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Manual Referral Application Overlap Modal */}
      <AnimatePresence>
        {isManualReferralModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-lg shadow-2xl relative my-auto select-none"
            >
              {/* Cover header */}
              <button 
                onClick={() => setIsManualReferralModalOpen(false)}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-black italic text-slate-900 leading-none mb-1">Link Referral Manual Entry</h3>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider font-mono">Bypasses registration flow to build referral trees manually.</p>
              </div>

              {manualError && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-rose-800 text-xs font-semibold mb-4 flex items-center gap-2">
                   <AlertCircle size={14} className="text-rose-600" />
                   <span>{manualError}</span>
                </div>
              )}

              {manualSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-emerald-800 text-xs font-bold mb-4 flex items-center gap-2">
                   <CheckCircle2 size={14} className="text-emerald-600" />
                   <span>{manualSuccess}</span>
                </div>
              )}

              <form onSubmit={handleCreateManualReferral} className="space-y-6">
                {/* Referrer Dropdown selection with search */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">1. Select Referrer (Host)</label>
                  <select 
                    value={manualReferrerId}
                    onChange={(e) => setManualReferrerId(e.target.value)}
                    className="w-full bg-slate-50 text-slate-600 border border-slate-100 px-4 py-3.5 text-xs rounded-2xl font-black focus:outline-none"
                  >
                    <option value="">-- Click to choose inviter --</option>
                    {users.map(u => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName || 'Unknown Name'} ({u.email}) - Code: {u.referralCode || 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Referee Dropdown selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">2. Select Referee (New Invited Friend)</label>
                  <select 
                    value={manualRefereeId}
                    onChange={(e) => setManualRefereeId(e.target.value)}
                    className="w-full bg-slate-50 text-slate-600 border border-slate-100 px-4 py-3.5 text-xs rounded-2xl font-black focus:outline-none"
                  >
                    <option value="">-- Choose unreferred friend profile --</option>
                    {users
                      .filter(u => !u.referredBy)
                      .map(u => (
                        <option key={u.uid} value={u.uid}>
                          {u.displayName || 'Unnamed User'} ({u.email}) - Wallet: ₹{u.walletBalance || 0}
                        </option>
                      ))}
                  </select>
                  <p className="text-[9px] text-slate-400 font-semibold pl-1">Shows only users without existing referredBy records.</p>
                </div>

                {/* Cost Rules warning box */}
                <div className="bg-blue-50/50 p-4 rounded-3xl border border-blue-100/50 flex gap-3 text-blue-900 text-xs font-semibold leading-relaxed">
                  <Info size={18} className="text-blue-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                     <p>This action will finalize instantly:</p>
                     <ul className="list-disc pl-4 space-y-1 font-medium">
                       <li>Ties referee to referrer.</li>
                       <li>Credits ₹{refereeReward} welcome bonus immediately to the new friend.</li>
                       <li>Referrer's standard payout of ₹{referrerReward} will trigger automatically when this friend completes their first service booking! Or you can trigger it immediately on the board.</li>
                     </ul>
                  </div>
                </div>

                {/* Trigger Buttons */}
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsManualReferralModalOpen(false)}
                    className="flex-1 border border-slate-200 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all text-center cursor-pointer"
                  >
                    Hold off
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-xl hover:shadow-blue-700/25 active:scale-95 transition-all text-center cursor-pointer"
                  >
                    Seal Connection
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Minimal placeholder custom mock node visual icon to bypass dependency issues
function GitBranchMock(props: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={props.className} 
      width={props.size} 
      height={props.size}
    >
      <line x1="6" y1="3" x2="6" y2="15"></line>
      <circle cx="18" cy="6" r="3"></circle>
      <circle cx="6" cy="18" r="3"></circle>
      <path d="M18 9a9 9 0 0 1-9 9"></path>
    </svg>
  );
}
