import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  TrendingUp, 
  ArrowDownLeft, 
  Zap, 
  Star, 
  X,
  AlertTriangle,
  Clock,
  CreditCard,
  Building,
  CheckCircle2,
  Calendar,
  Lock
} from 'lucide-react';
import { PartnerProfile, EarningsHistory, Booking, UserProfile } from '../../types';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

interface Props {
  partner: PartnerProfile | null;
  profile?: UserProfile | null;
  bookings?: Booking[];
}

const loadRazorpayScript = () => {
  return new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PartnerWallet({ partner, profile, bookings = [] }: Props) {
  const [history, setHistory] = useState<EarningsHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showDigitalClearModal, setShowDigitalClearModal] = useState(false);
  const [digitalClearAmount, setDigitalClearAmount] = useState<string>('');
  const [clearingDigital, setClearingDigital] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setBannerMessage({ text, type });
    setTimeout(() => setBannerMessage(null), 4500);
  };

  useEffect(() => {
    const partnerDocId = partner?.id || partner?.userId || profile?.uid;
    if (!partnerDocId) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    
    const q = query(
      collection(db, 'partners', partnerDocId, 'earningsHistory'), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (!isMounted) return;
        setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as EarningsHistory)));
        setLoading(false);
      },
      (err) => {
        if (!isMounted) return;
        console.warn("Earnings history snapshot error:", err);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [partner?.id, partner?.userId, profile?.uid]);

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

  // Completed bookings net 80% partner share
  const completedNetEarnings = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => {
      const amount = Number(b.totalPrice ?? (b as any).finalPrice ?? (b as any).basePrice ?? 0);
      return sum + (isNaN(amount) ? 0 : Math.round(amount * 0.80));
    }, 0);

  // Net withdrawable earnings strictly calculated from completed jobs (80% partner share) and verified partner totalEarnings
  const rawEarnings = Math.max(
    0,
    Number(
      (partner?.totalEarnings && partner.totalEarnings > 0 ? partner.totalEarnings : completedNetEarnings) ?? 0
    )
  );
  const unsettledCash = Math.max(0, Number(partner?.unsettledCashInHand || 0));

  // Time since last cash collection
  let isOlderThan24h = false;
  if (partner?.lastCashCollectedAt && unsettledCash > 0) {
    let collectedMs = 0;
    const lcc = partner.lastCashCollectedAt;
    if (typeof lcc === 'string') collectedMs = new Date(lcc).getTime();
    else if (lcc?.seconds) collectedMs = lcc.seconds * 1000;
    else if (lcc?.toDate) collectedMs = lcc.toDate().getTime();
    else if (typeof lcc === 'number') collectedMs = lcc;
    if (collectedMs > 0 && Date.now() - collectedMs > 24 * 60 * 60 * 1000) {
      isOlderThan24h = true;
    }
  }

  const isOverdueBlocked = Boolean(partner?.isCashBlocked || (unsettledCash > 2000) || (unsettledCash > 0 && isOlderThan24h));

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;
    if (isGracePeriodExpired) {
      notify("KYC submission required to unlock payouts.", 'error');
      return;
    }
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || amount > rawEarnings) {
      notify(`Invalid withdraw amount. Withdrawable limit is ₹${rawEarnings}`, 'error');
      return;
    }
    
    try {
      await addDoc(collection(db, 'payoutRequests'), {
        partnerId: partner.userId,
        amount,
        status: 'pending',
        createdAt: Timestamp.now()
      });
      notify('Withdrawal request submitted successfully! Admin will process this soon.', 'success');
      setShowWithdraw(false);
      setWithdrawAmount('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'payoutRequests');
    }
  };

  const handleDigitalCashClearance = async () => {
    const amt = parseFloat(digitalClearAmount || String(unsettledCash));
    if (!amt || amt <= 0 || amt > unsettledCash) {
      notify(`Please enter a valid amount up to ₹${unsettledCash}`, 'error');
      return;
    }

    setClearingDigital(true);
    try {
      const scriptOk = await loadRazorpayScript();
      if (!scriptOk || typeof (window as any).Razorpay !== 'function') {
        notify("Online payment gateway is not configured. Please contact support or settle cash with Admin.", 'error');
        setClearingDigital(false);
        return;
      }

      // 1. Create order
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          currency: 'INR',
          receipt: `cash_deposit_${partner?.userId || partner?.id}_${Date.now()}`
        })
      });

      const orderData = await orderRes.json().catch(() => ({}));
      const razorpayKey = orderData?.keyId || (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || '';
      const isRealKey = Boolean(
        razorpayKey &&
        !String(razorpayKey).includes('placeholder') &&
        String(razorpayKey).startsWith('rzp_') &&
        !orderData?.isMock &&
        orderData?.orderId &&
        !String(orderData.orderId).startsWith('order_mock_')
      );

      if (!orderRes.ok || !orderData?.success || !isRealKey) {
        notify(orderData?.error || "Online payment gateway is not configured. Please contact support or settle cash with Admin.", 'error');
        setClearingDigital(false);
        return;
      }

      const options = {
        key: razorpayKey,
        amount: Math.round(amt * 100),
        currency: 'INR',
        name: 'Zomindia Internet Technology',
        description: `COD Cash Clearance for Partner #${partner?.userId?.slice(0, 8)}`,
        order_id: orderData.orderId,
        prefill: {
          name: partner?.name || 'Partner',
          contact: partner?.phone || ''
        },
        theme: { color: '#002e6e' },
        modal: {
          ondismiss: () => {
            setClearingDigital(false);
          }
        },
        handler: async (response: any) => {
          try {
            if (!response?.razorpay_order_id || !response?.razorpay_payment_id || !response?.razorpay_signature) {
              throw new Error("Payment verification failed: Missing cryptographic signature from gateway.");
            }
            const clearRes = await fetch('/api/partner/clear-cash-online', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                partnerId: partner?.id || partner?.userId,
                amount: amt,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (!clearRes.ok) {
              const cErr = await clearRes.json().catch(() => ({}));
              throw new Error(cErr.error || "Failed to confirm digital clearance");
            }

            const resJson = await clearRes.json();
            notify(`Success! ₹${amt} deposited. 80% share (₹${resJson.creditedEarnings}) added to your withdrawable earnings!`, 'success');
            setShowDigitalClearModal(false);
            setDigitalClearAmount('');
          } catch (vErr: any) {
            console.error("Verification error:", vErr);
            notify("Digital clearance failed: " + (vErr.message || "Please contact support"), 'error');
          } finally {
            setClearingDigital(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        notify("Payment failed: " + (resp.error?.description || "Transaction cancelled"), 'error');
        setClearingDigital(false);
      });
      rzp.open();
    } catch (err: any) {
      console.error("Digital clearance initiation failed:", err);
      notify(err.message || "Could not start digital cash clearance", 'error');
      setClearingDigital(false);
    }
  };

  return (
    <div className="p-6 space-y-6 relative">
      {bannerMessage && (
        <div
          className={`px-4 py-3 rounded-2xl text-xs font-bold shadow-lg ${
            bannerMessage.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {bannerMessage.text}
        </div>
      )}
      {/* 1. PROMINENT RED ALERT CARD (When cash is owed) */}
      {unsettledCash > 0 && (
        <section className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 rounded-3xl p-6 text-white shadow-xl shadow-rose-600/20 relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
                  <AlertTriangle size={20} className="animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-100">COD Cash Remittance Alert</span>
                  <h4 className="text-xl font-black italic tracking-tight">Cash Owed to Office: ₹{unsettledCash.toLocaleString()}</h4>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-black/20 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm">
                <Clock size={12} />
                <span>Urgent Clearance</span>
              </div>
            </div>

            <div className="bg-black/20 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-sm">
              <div className="space-y-0.5">
                <p className="text-xs font-black uppercase tracking-wider text-rose-100">Mandatory Deadline:</p>
                <p className="text-sm font-black text-white">Today evening or tomorrow morning by 11:00 AM.</p>
                <p className="text-[11px] text-rose-100/90 font-medium">Deposit physical cash at Zomindia office counter to unlock your 80% share.</p>
              </div>

              {/* Emergency Digital Clearance Option */}
              <button 
                onClick={() => {
                  setDigitalClearAmount(String(unsettledCash));
                  setShowDigitalClearModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 bg-white text-rose-700 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-50 active:scale-95 transition-all shadow-lg shrink-0"
              >
                <CreditCard size={15} />
                Deposit Cash Digitally via UPI/Razorpay
              </button>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </section>
      )}

      {/* 2. OVERDUE BLOCKING WARNING BANNER */}
      {isOverdueBlocked && (
        <section className="bg-amber-500/10 border-2 border-amber-500/40 rounded-3xl p-5 flex items-center gap-4 text-amber-900 shadow-sm">
          <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0 shadow-md shadow-amber-500/30">
            <Lock size={20} />
          </div>
          <div className="space-y-0.5">
            <h5 className="text-xs font-black uppercase tracking-wider text-amber-700">Account Action Restricted</h5>
            <p className="text-sm font-bold text-amber-950">
              Job assignments paused. Please deposit collected cash at Zomindia office to resume receiving bookings.
            </p>
          </div>
        </section>
      )}

      {/* 3. PAYOUT POLICY BANNER */}
      <section className="bg-slate-50 border border-slate-200/80 rounded-2xl px-5 py-3.5 flex items-center gap-3 text-slate-700 shadow-sm">
        <Calendar size={18} className="text-blue-600 shrink-0" />
        <p className="text-xs font-bold leading-relaxed">
          <span className="font-black text-slate-900 uppercase tracking-wide mr-1.5">Payout Policy:</span>
          20% Platform Fee • 80% Direct Technician Payout. Withdrawals are processed Monday to Friday. Weekend requests are scheduled for Monday payout.
        </p>
      </section>

      {/* Main Wallet Card */}
      <section className="bg-blue-700 rounded-[40px] p-8 sm:p-10 text-white relative overflow-hidden shadow-2xl">
         <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-2 opacity-75">
                  <Wallet size={18} />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">Net Withdrawable Earnings</span>
               </div>
               <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full uppercase tracking-wider">
                 Live Ledger
               </span>
            </div>
            
            <p className="text-4xl sm:text-5xl font-black italic tracking-tighter mb-2">₹{rawEarnings.toLocaleString()}</p>
            <div className="flex items-center gap-2 text-emerald-300">
               <TrendingUp size={14} />
               <span className="text-[10px] font-black uppercase tracking-widest">Available for Bank Payout</span>
            </div>

            <div className="mt-8 flex flex-col gap-2">
               <div className="flex gap-4">
                  {isGracePeriodExpired || isOverdueBlocked ? (
                    <button 
                      disabled
                      className="flex-1 bg-slate-400 text-slate-100 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed opacity-70"
                      title={isOverdueBlocked ? "Clear overdue cash liability first" : "KYC submission required"}
                    >
                       Withdraw {isOverdueBlocked ? '(Blocked)' : '(Locked)'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        if (partner?.approvalStatus === 'pending') {
                          window.dispatchEvent(new CustomEvent('show-partner-toast', { 
                            detail: { message: 'Action locked. Waiting for Admin approval.' } 
                          }));
                          return;
                        }
                        setShowWithdraw(true);
                      }}
                      className="flex-1 bg-white text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-700/40 active:scale-95 transition-all"
                    >
                       Request Payout
                    </button>
                  )}
                  {unsettledCash > 0 && (
                    <button 
                      onClick={() => {
                        setDigitalClearAmount(String(unsettledCash));
                        setShowDigitalClearModal(true);
                      }}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                    >
                       Clear Cash (₹{unsettledCash})
                    </button>
                  )}
               </div>
               
               {isGracePeriodExpired && (
                 <p className="text-[9px] text-amber-300 font-extrabold mt-2 text-center uppercase tracking-wider">
                   KYC submission required to unlock payouts.
                 </p>
               )}
            </div>
         </div>
         <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Emergency Digital Clearance Modal */}
      <AnimatePresence>
        {showDigitalClearModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-end sm:justify-center backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="bg-white w-full sm:w-[480px] rounded-t-[36px] sm:rounded-[36px] p-7 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowDigitalClearModal(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
              
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="text-blue-600" size={24} />
                <h3 className="text-xl font-black text-slate-900 italic">Remote Cash Clearance</h3>
              </div>
              <p className="text-xs text-slate-500 mb-6 font-medium">
                Cannot visit the office today? Settle your collected customer cash instantly via UPI, Cards, or NetBanking.
              </p>
              
              <div className="space-y-5">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Total Cash Liability:</span>
                    <span className="text-rose-600 font-black">₹{unsettledCash.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Platform Commission (20%):</span>
                    <span className="text-slate-900 font-black">₹{Math.round(Number(digitalClearAmount || unsettledCash) * 0.20).toLocaleString()}</span>
                  </div>
                  <div className="h-[1px] bg-slate-200 my-1" />
                  <div className="flex justify-between text-xs font-bold text-emerald-700">
                    <span>Your Credited Share (80%):</span>
                    <span className="font-black text-sm">₹{Math.round(Number(digitalClearAmount || unsettledCash) * 0.80).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    Deposit Amount (₹)
                  </label>
                  <input 
                    type="number"
                    max={unsettledCash}
                    min={1}
                    value={digitalClearAmount}
                    onChange={e => setDigitalClearAmount(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-xl font-black text-slate-900 focus:border-blue-700 focus:ring-4 focus:ring-blue-700/5 outline-none transition-all"
                    placeholder="Enter deposit amount"
                  />
                  <div className="flex gap-2 mt-2">
                    <button 
                      type="button" 
                      onClick={() => setDigitalClearAmount(String(unsettledCash))}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-700"
                    >
                      Clear Full Amount (₹{unsettledCash})
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={handleDigitalCashClearance}
                  disabled={clearingDigital || !digitalClearAmount || Number(digitalClearAmount) <= 0}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-blue-700/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {clearingDigital ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Proceed to Pay via Razorpay</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdraw && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-end sm:justify-center backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="bg-white w-full sm:w-[480px] rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowWithdraw(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
              
              <h3 className="text-2xl font-black text-slate-900 mb-2 italic">Request Withdrawal</h3>
              <p className="text-xs text-slate-500 mb-6 font-medium">
                Withdrawals are transferred directly to your verified bank account.
              </p>
              
              <form onSubmit={handleWithdraw} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Amount to withdraw (₹)</label>
                  <input 
                    type="number"
                    max={rawEarnings}
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-xl font-bold focus:border-blue-700 focus:ring-4 focus:ring-blue-700/5 outline-none transition-all placeholder:text-slate-300"
                    placeholder="0.00"
                    required
                  />
                  <div className="mt-2 space-y-1 ml-1">
                    <p className="text-xs font-bold text-slate-600">Net Withdrawable Limit: ₹{rawEarnings.toLocaleString()}</p>
                  </div>
                </div>
                
                <button 
                  type="submit"
                  className="w-full bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-800 active:scale-95 transition-all shadow-xl shadow-blue-700/20"
                >
                  Confirm Payout Request
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rewards Overview */}
      <section className="bg-amber-500 rounded-[32px] p-7 text-white flex justify-between items-center shadow-xl shadow-amber-500/10 active:scale-98 transition-transform">
         <div>
            <p className="text-[9px] font-black uppercase tracking-widest opacity-75 mb-1">Loyalty Credits</p>
            <p className="text-2xl font-black italic">{partner?.rewardCredits || '0'} Points</p>
         </div>
         <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <Star fill="currentColor" size={24} />
         </div>
      </section>

      {/* Transaction History */}
      <section className="space-y-4">
         <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Financial Ledger History</h3>
         </div>

         <div className="space-y-3">
            {history.length === 0 ? (
               <div className="p-12 text-center bg-white border border-slate-100 rounded-[36px] border-dashed">
                  <p className="text-sm font-black italic text-slate-300">No transactions recorded yet.</p>
               </div>
            ) : (
               history.map((item) => (
                  <div key={item.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center group active:scale-98 transition-transform shadow-sm">
                     <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                          item.type === 'booking_earning_online' || item.type === 'booking_earning' ? 'bg-blue-700 text-white shadow-md' : 
                          item.type === 'office_cash_deposit' ? 'bg-emerald-600 text-white shadow-md' :
                          item.type === 'booking_earning_cash' ? 'bg-amber-100 text-amber-700' :
                          item.type === 'reward_credit' ? 'bg-amber-100 text-amber-600' : 
                          'bg-slate-100 text-slate-600'
                        }`}>
                           {item.type === 'office_cash_deposit' ? <Building size={18} /> :
                            item.type === 'reward_credit' ? <Star size={18} /> :
                            <ArrowDownLeft size={18} />}
                        </div>
                        <div className="min-w-0">
                           <div className="flex items-center gap-2">
                             <p className="text-sm font-black text-slate-900 leading-tight italic truncate">{item.reason || item.description || 'Transaction'}</p>
                           </div>
                           <div className="flex items-center gap-2 mt-1">
                             <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                               {item.createdAt?.toDate?.()?.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) || 'Recent'}
                             </span>
                             {item.status === 'pending_cash_clearance' && (
                               <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                 Pending Office Clearance
                                </span>
                             )}
                             {item.status === 'cleared' && (
                               <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                 Cleared
                                </span>
                             )}
                           </div>
                        </div>
                     </div>
                     <div className="text-right flex-shrink-0 ml-3">
                        {item.amount > 0 && (
                          <p className={`text-base font-black italic ${item.status === 'pending_cash_clearance' ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {item.status === 'pending_cash_clearance' ? `₹${item.amount}` : `+₹${item.amount}`}
                          </p>
                        )}
                        {item.credits && item.credits > 0 ? (
                          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">+{item.credits} Pts</p>
                        ) : null}
                     </div>
                  </div>
               ))
            )}
         </div>
      </section>
    </div>
  );
}
