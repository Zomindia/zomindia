import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  TrendingUp, 
  ArrowDownLeft, 
  Star, 
  X,
  AlertTriangle,
  Clock,
  CreditCard,
  CheckCircle2,
  Calendar,
  Lock,
  ShieldCheck,
  Receipt,
  Building2
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

  // Derive transparent itemized ledger transactions with 20% Platform Fee + 18% GST on Fee
  const displayTransactions = useMemo(() => {
    const completedList = bookings.filter(b => b.status === 'completed' || b.status === 'finalized');
    if (completedList.length > 0) {
      return completedList.map(b => {
        const gross = Number(b.totalPrice ?? (b as any).finalPrice ?? (b as any).basePrice ?? 770);
        const platformFee = Math.round(gross * 0.20); // 20% Platform Fee (e.g. ₹154)
        const gstOnFee = Math.round(platformFee * 0.18); // 18% GST on Fee (e.g. ₹28)
        const totalDeduction = platformFee + gstOnFee; // Total Deduction (e.g. ₹182)
        const netPayout = gross - totalDeduction; // Net Partner Share (e.g. ₹588)
        const dateStr =
          b.completedAt?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) ||
          b.updatedAt?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) ||
          'Today';

        return {
          id: b.id,
          title: b.serviceName || 'Home Service',
          bookingId: b.id.slice(-6).toUpperCase(),
          grossAmount: gross,
          platformFee,
          gstOnFee,
          totalDeduction,
          netAmount: netPayout,
          type: 'credit' as const,
          date: dateStr,
          paymentMode: (b as any).paymentMode || (b.paymentMethod === 'cash' ? 'Cash' : 'Online')
        };
      });
    }

    if (history && history.length > 0) {
      return history.map(item => {
        const rawAmt = Number(item.amount || (item as any).grossAmount || 770);
        const gross = (item as any).grossAmount
          ? Number((item as any).grossAmount)
          : (rawAmt > 0 ? Math.round(rawAmt / 0.80) : 770);
        const platformFee = Math.round(gross * 0.20);
        const gstOnFee = Math.round(platformFee * 0.18);
        const totalDeduction = platformFee + gstOnFee;
        const netPayout = gross - totalDeduction;
        const dateStr =
          item.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) ||
          'Today';

        return {
          id: item.id,
          title: item.reason || item.description || 'Home Service',
          bookingId: ((item as any).bookingId || item.id).slice(-6).toUpperCase(),
          grossAmount: gross,
          platformFee,
          gstOnFee,
          totalDeduction,
          netAmount: netPayout,
          type: 'credit' as const,
          date: dateStr,
          paymentMode: (item as any).paymentMode || 'Online'
        };
      });
    }

    return [];
  }, [history, bookings]);

  // Completed bookings net partner share after 20% Platform Fee + 18% GST on Fee
  const completedNetEarnings = useMemo(() => {
    return bookings
      .filter(b => b.status === 'completed' || b.status === 'finalized')
      .reduce((sum, b) => {
        const gross = Number(b.totalPrice ?? (b as any).finalPrice ?? (b as any).basePrice ?? 0);
        if (isNaN(gross) || gross <= 0) return sum;
        const platformFee = Math.round(gross * 0.20);
        const gstOnFee = Math.round(platformFee * 0.18);
        const netShare = gross - (platformFee + gstOnFee);
        return sum + Math.max(0, netShare);
      }, 0);
  }, [bookings]);

  const ledgerNetSum = useMemo(() => {
    return displayTransactions.reduce((sum, tx) => sum + Math.max(0, Number(tx.netAmount || 0)), 0);
  }, [displayTransactions]);

  // Net withdrawable earnings strictly calculated after platform fee and GST deductions
  const rawEarnings = useMemo(() => {
    if (completedNetEarnings > 0) return completedNetEarnings;
    if (ledgerNetSum > 0) return ledgerNetSum;
    if (typeof partner?.walletBalance === 'number' && partner.walletBalance > 0) return partner.walletBalance;
    if (partner?.totalEarnings && partner.totalEarnings > 0) {
      const gross = Math.round(partner.totalEarnings / 0.80);
      const fee = Math.round(gross * 0.20);
      const gst = Math.round(fee * 0.18);
      return Math.max(0, gross - (fee + gst));
    }
    return 0;
  }, [completedNetEarnings, ledgerNetSum, partner?.walletBalance, partner?.totalEarnings]);

  const totalGrossVolume = useMemo(() => {
    return displayTransactions.reduce((sum, tx) => sum + Number(tx.grossAmount || 0), 0);
  }, [displayTransactions]);

  const totalPlatformCutSum = useMemo(() => {
    return displayTransactions.reduce((sum, tx) => sum + Number(tx.totalDeduction || 0), 0);
  }, [displayTransactions]);

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
      notify('Withdrawal request submitted! Admin will process your bank payout shortly.', 'success');
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
            notify(`Success! ₹${amt} deposited. Net share (₹${resJson.creditedEarnings}) added to your withdrawable earnings!`, 'success');
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
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto pb-28">
      {bannerMessage && (
        <div
          className={`px-4 py-3 rounded-2xl text-xs font-bold shadow-md ${
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
        <section className="bg-rose-50 border border-rose-200 rounded-3xl p-5 text-slate-900 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-600 text-white rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-rose-700">COD Cash Remittance Alert</p>
                <h4 className="text-base sm:text-lg font-black text-slate-900">Cash Owed to Office: ₹{unsettledCash.toLocaleString('en-IN')}</h4>
              </div>
            </div>
            <span className="text-[10px] font-bold text-rose-700 flex items-center gap-1 shrink-0">
              <Clock size={12} /> Urgent Clearance
            </span>
          </div>

          <div className="bg-white border border-rose-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900">Deadline: Today evening or tomorrow by 11:00 AM</p>
              <p className="text-[11px] text-slate-600">Deposit physical cash at the Zomindia office or clear digitally via UPI/Razorpay.</p>
            </div>

            <button 
              onClick={() => {
                setDigitalClearAmount(String(unsettledCash));
                setShowDigitalClearModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <CreditCard size={14} />
              <span>Deposit Cash Digitally</span>
            </button>
          </div>
        </section>
      )}

      {/* 2. OVERDUE BLOCKING WARNING BANNER */}
      {isOverdueBlocked && (
        <section className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-center gap-3.5 text-amber-950 shadow-2xs">
          <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0">
            <Lock size={18} />
          </div>
          <div>
            <h5 className="text-xs font-black uppercase tracking-wider text-amber-800">Account Action Restricted</h5>
            <p className="text-xs font-semibold text-amber-900 mt-0.5">
              Job assignments paused. Please settle collected cash to resume receiving bookings.
            </p>
          </div>
        </section>
      )}

      {/* 3. CLEAN LIGHT-THEMED URBAN COMPANY / ZOMATO PARTNER PASSBOOK HERO */}
      <section className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Wallet size={15} className="text-emerald-600" />
              <span>Partner Payout Passbook</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700">Live Ledger</span>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              ₹{rawEarnings.toLocaleString('en-IN')}
            </p>
            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <TrendingUp size={13} className="text-emerald-600" />
              <span>Net withdrawable balance after 20% platform fee & 18% GST on fee</span>
            </p>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-[11px] font-bold text-slate-400 block">Loyalty Credits</span>
            <span className="text-sm font-black text-amber-600 flex items-center justify-end gap-1 mt-0.5">
              <Star size={13} className="fill-amber-500 text-amber-500" />
              {partner?.rewardCredits || 0} Pts
            </span>
          </div>
        </div>

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-slate-500 block">Gross Value</span>
            <span className="text-sm sm:text-base font-black text-slate-900 mt-0.5 block">
              ₹{totalGrossVolume.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-slate-500 block">Fee + GST Cut</span>
            <span className="text-sm sm:text-base font-black text-rose-600 mt-0.5 block">
              -₹{totalPlatformCutSum.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-emerald-800 block">Net Credited</span>
            <span className="text-sm sm:text-base font-black text-emerald-700 mt-0.5 block">
              +₹{rawEarnings.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          {isGracePeriodExpired || isOverdueBlocked ? (
            <button 
              disabled
              className="flex-1 bg-slate-100 text-slate-400 border border-slate-200 py-3 px-4 rounded-2xl text-xs font-bold uppercase tracking-wider cursor-not-allowed"
              title={isOverdueBlocked ? "Clear overdue cash liability first" : "KYC submission required"}
            >
              Withdraw {isOverdueBlocked ? '(Cash Overdue)' : '(KYC Required)'}
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
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3.5 px-5 rounded-2xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <Building2 size={15} />
              <span>Request Bank Payout</span>
            </button>
          )}

          {unsettledCash > 0 && (
            <button 
              onClick={() => {
                setDigitalClearAmount(String(unsettledCash));
                setShowDigitalClearModal(true);
              }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 px-5 rounded-2xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
            >
              Clear Cash (₹{unsettledCash.toLocaleString('en-IN')})
            </button>
          )}
        </div>

        {isGracePeriodExpired && (
          <p className="text-[11px] text-amber-700 font-bold text-center">
            KYC verification is required to unlock bank payouts.
          </p>
        )}
      </section>

      {/* 4. TRANSPARENT PAYOUT POLICY NOTE */}
      <section className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 flex items-start gap-2.5 text-slate-600">
        <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-xs font-medium leading-relaxed">
          <span className="font-bold text-slate-900">Transparent Payout Math:</span> 20% Platform Fee + 18% Govt GST on Platform Fee. Direct bank settlements are processed Monday to Friday.
        </p>
      </section>

      {/* 5. ITEMIZED PASSBOOK LEDGER TRANSACTIONS */}
      <section className="space-y-3.5">
        <div className="flex justify-between items-center px-1">
          <div>
            <h3 className="text-sm font-black text-slate-900">Itemized Passbook Ledger</h3>
            <p className="text-[11px] text-slate-500">Complete job-by-job payout & GST breakdown</p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {displayTransactions.length} {displayTransactions.length === 1 ? 'Entry' : 'Entries'}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center bg-white border border-slate-200/80 rounded-3xl">
            <p className="text-xs font-bold text-slate-400">Loading passbook ledger...</p>
          </div>
        ) : displayTransactions.length === 0 ? (
          <div className="p-10 text-center bg-white border border-slate-200/80 rounded-3xl space-y-2">
            <Receipt size={24} className="text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No completed job payouts yet</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Once you complete doorstep service bookings, your itemized gross, platform fee, GST, and net payout breakdown will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayTransactions.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3.5"
              >
                {/* Card Top Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <ArrowDownLeft size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 truncate">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mt-0.5">
                        <span>Order #{item.bookingId}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.date}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.paymentMode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-emerald-700 block">
                      +₹{item.netAmount.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      Net Credited
                    </span>
                  </div>
                </div>

                {/* Itemized Breakdown Box */}
                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-slate-700 font-semibold">
                    <span>Customer Paid (Gross)</span>
                    <span className="font-bold text-slate-900">₹{item.grossAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Platform Fee (20%)</span>
                    <span className="font-semibold text-rose-600">-₹{item.platformFee.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Govt GST on Fee (18%)</span>
                    <span className="font-semibold text-rose-600">-₹{item.gstOnFee.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 font-semibold pt-1 border-t border-slate-200/70">
                    <span>Total Platform Cut</span>
                    <span className="font-bold text-rose-600">-₹{item.totalDeduction.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-800 font-black pt-1.5 border-t border-slate-200">
                    <span>Net Credited to Wallet</span>
                    <span className="text-sm text-emerald-700">+₹{item.netAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Emergency Digital Clearance Modal */}
      <AnimatePresence>
        {showDigitalClearModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 z-50 flex flex-col items-center justify-end sm:justify-center backdrop-blur-xs p-4"
          >
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="bg-white w-full sm:w-[460px] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative border border-slate-100"
            >
              <button 
                onClick={() => setShowDigitalClearModal(false)}
                className="absolute top-5 right-5 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} className="text-slate-600" />
              </button>
              
              <div className="flex items-center gap-2.5 mb-1.5">
                <CreditCard className="text-blue-600" size={20} />
                <h3 className="text-lg font-black text-slate-900">Remote Cash Clearance</h3>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                Settle your collected customer cash instantly via UPI, Cards, or NetBanking.
              </p>
              
              <div className="space-y-4">
                {(() => {
                  const grossAmt = Number(digitalClearAmount || unsettledCash || 0);
                  const feeAmt = Math.round(grossAmt * 0.20);
                  const gstAmt = Math.round(feeAmt * 0.18);
                  const cutAmt = feeAmt + gstAmt;
                  const netAmt = Math.max(0, grossAmt - cutAmt);
                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                      <div className="flex justify-between font-semibold text-slate-700">
                        <span>Customer Paid (Gross Cash):</span>
                        <span className="text-slate-900 font-bold">₹{grossAmt.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Platform Fee (20%):</span>
                        <span className="text-rose-600 font-semibold">-₹{feeAmt.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Govt GST on Fee (18%):</span>
                        <span className="text-rose-600 font-semibold">-₹{gstAmt.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-800 pt-2 border-t border-slate-200">
                        <span>Net Credited to Wallet:</span>
                        <span className="text-emerald-700">+₹{netAmt.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Deposit Amount (₹)
                  </label>
                  <input 
                    type="number"
                    max={unsettledCash}
                    min={1}
                    value={digitalClearAmount}
                    onChange={e => setDigitalClearAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-lg font-black text-slate-900 focus:border-blue-600 outline-none transition-all"
                    placeholder="Enter deposit amount"
                  />
                </div>
                
                <button 
                  onClick={handleDigitalCashClearance}
                  disabled={clearingDigital || !digitalClearAmount || Number(digitalClearAmount) <= 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {clearingDigital ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
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
            className="fixed inset-0 bg-slate-900/50 z-50 flex flex-col items-center justify-end sm:justify-center backdrop-blur-xs p-4"
          >
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="bg-white w-full sm:w-[440px] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative border border-slate-100"
            >
              <button 
                onClick={() => setShowWithdraw(false)}
                className="absolute top-5 right-5 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} className="text-slate-600" />
              </button>
              
              <h3 className="text-lg font-black text-slate-900 mb-1">Request Bank Payout</h3>
              <p className="text-xs text-slate-500 mb-5">
                Withdrawals are transferred directly to your verified bank / UPI account.
              </p>
              
              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Amount to withdraw (₹)
                  </label>
                  <input 
                    type="number"
                    max={rawEarnings}
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-lg font-black text-slate-900 focus:border-slate-900 outline-none transition-all placeholder:text-slate-300"
                    placeholder="0"
                    required
                  />
                  <p className="text-xs font-semibold text-slate-500 mt-1.5">
                    Net Withdrawable Limit: <span className="font-bold text-slate-900">₹{rawEarnings.toLocaleString('en-IN')}</span>
                  </p>
                </div>
                
                <button 
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                >
                  Confirm Payout Request
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
