import React, { useState, useEffect, useRef } from 'react';
import { Booking, UserProfile } from '../types';
import { formatBookingTime } from '../utils/formatTime';
import { motion } from 'motion/react';
import {
  X,
  ShieldCheck,
  Wallet,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Lock,
  RefreshCw,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldAlert,
  Banknote,
  ExternalLink
} from 'lucide-react';
import { getCashfreeInstance, CashfreeMode } from '../utils/cashfreeClient';
import { playSuccessChime } from '../lib/audio';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import confetti from 'canvas-confetti';

interface PaymentModalProps {
  booking: Booking;
  profile: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ booking, profile, onClose, onSuccess }: PaymentModalProps) {
  const [useWalletPartial, setUseWalletPartial] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sdkBlocked, setSdkBlocked] = useState(false);
  const [isSimulation, setIsSimulation] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);
  const [cashfreeMode, setCashfreeMode] = useState<CashfreeMode>('production');
  const [hostedCheckoutUrl, setHostedCheckoutUrl] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [pollingCountdown, setPollingCountdown] = useState<number>(60);
  const [isPollingActive, setIsPollingActive] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const totalBill = booking.totalPrice || 0;
  const walletBalance = profile?.walletBalance || 0;
  const walletDeduction = useWalletPartial ? Math.min(walletBalance, totalBill) : 0;
  const finalPayable = Math.max(0, totalBill - walletDeduction);
  const canPayEntirelyWithWallet = walletBalance >= totalBill;

  // Stop polling helper
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setIsPollingActive(false);
  };

  // Safe mount tracker and back-navigation listener to prevent frozen UI on mobile/PWA
  useEffect(() => {
    isMountedRef.current = true;

    const handlePageShow = () => {
      if (isMountedRef.current && activeOrderId) {
        checkOrderStatusOnce(activeOrderId);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('popstate', handlePageShow);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('popstate', handlePageShow);
    };
  }, [activeOrderId]);

  // Initialize Cashfree session when payable amount > 0
  useEffect(() => {
    if (finalPayable > 0) {
      initiateCashfreePayment();
    } else {
      stopPolling();
      setPaymentSessionId(null);
      setIsSimulation(false);
    }
  }, [finalPayable]);

  // Single-attempt status check (used on pageshow / manual check)
  const checkOrderStatusOnce = async (orderId: string) => {
    try {
      const res = await fetch(`/api/cashfree/status/${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.order_status === 'PAID' || data.status === 'SUCCESS' || (data.success && data.status === 'PAID')) {
        handleFinalSuccess(orderId, 'Cashfree');
      }
    } catch (e) {
      console.warn('[Cashfree Status Check Notice]:', e);
    }
  };

  // Status poller (60s countdown)
  const startStatusPolling = (orderId: string) => {
    stopPolling();
    if (!isMountedRef.current) return;
    setIsPollingActive(true);
    setPollingCountdown(60);

    countdownTimerRef.current = setInterval(() => {
      if (!isMountedRef.current) {
        stopPolling();
        return;
      }
      setPollingCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    let attempts = 0;
    const maxAttempts = 24;

    pollingRef.current = setInterval(async () => {
      if (!isMountedRef.current) {
        stopPolling();
        return;
      }
      attempts += 1;
      if (attempts > maxAttempts) {
        stopPolling();
        return;
      }

      try {
        const res = await fetch(`/api/cashfree/status/${encodeURIComponent(orderId)}`);
        const data = await res.json();
        if (data.order_status === 'PAID' || data.status === 'SUCCESS' || (data.success && data.status === 'PAID')) {
          stopPolling();
          handleFinalSuccess(orderId, 'Cashfree');
        }
      } catch (err) {
        console.warn('[Cashfree Polling Notice]:', err);
      }
    }, 2500);
  };

  // Final Success Confirmation to Server
  const handleFinalSuccess = async (txnId: string, provider: string) => {
    stopPolling();
    if (!isMountedRef.current) return;

    playSuccessChime();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {}
    }

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    setIsProcessing(true);

    try {
      const targetStatus = booking.status === 'payment_pending'
        ? 'completed'
        : (booking.status === 'pending' ? 'confirmed' : booking.status);

      await fetch('/api/cashfree/verify-and-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          customerUid: profile.uid,
          orderId: txnId,
          merchantTransactionId: txnId,
          amount: totalBill,
          paymentMethod: walletDeduction > 0 ? 'wallet_online' : 'online',
          walletDeductAmount: walletDeduction > 0 ? walletDeduction : (booking.walletDeductAmount || 0),
          onlinePaymentProvider: provider,
          onlinePaymentMethod: isSimulation ? 'Cashfree Simulation' : 'Cashfree Checkout',
          status: targetStatus
        })
      });
    } catch (e) {
      console.warn('Server verify notice:', e);
    }

    setPaymentSuccess(true);
    setIsProcessing(false);

    setTimeout(() => {
      if (isMountedRef.current) {
        onSuccess();
        onClose();
      }
    }, 1200);
  };

  // Full Wallet Settlement
  const handleFullWalletPayment = async () => {
    if (walletBalance < totalBill) {
      setErrorMessage('Insufficient wallet balance.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/pay-via-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookingId: booking.id, 
          userId: profile.uid, 
          debitAmount: totalBill,
          isFullSettlement: true
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process wallet payment');
      }

      handleFinalSuccess(`WALLET_${Date.now()}`, 'Zomindia Wallet');
    } catch (err: any) {
      console.error('Wallet Payment Error:', err);
      setErrorMessage(err.message || 'Wallet payment failed');
      setIsProcessing(false);
    }
  };

  // Switch to COD / Pay After Service
  const handleSwitchToCOD = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const bRef = doc(db, 'bookings', booking.id);
      const isProgressedOrCompleted = ['completed', 'finalized', 'in_progress', 'assigned', 'on_the_way', 'arrived', 'cancelled'].includes(booking.status);
      const updatePayload: Record<string, any> = {
        paymentMethod: 'cash',
        paymentStatus: 'pay_after_service',
        updatedAt: Timestamp.now()
      };
      if (!isProgressedOrCompleted && booking.status !== 'payment_pending') {
        updatePayload.status = 'confirmed';
      }
      await updateDoc(bRef, updatePayload);
      handleFinalSuccess(`COD_${Date.now()}`, 'Pay After Service');
    } catch (err: any) {
      console.error('Error switching to Pay After Service:', err);
      setErrorMessage('Failed to update payment mode.');
      setIsProcessing(false);
    }
  };

  // Trigger Cashfree JS SDK's checkout method strictly upon receiving valid payment_session_id
  const triggerSdkCheckout = async (
    sessionId: string, 
    target: '_modal' | '_self' = '_modal',
    explicitMode?: CashfreeMode
  ) => {
    // Session Verification Before Checkout
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      setErrorMessage('Cashfree payment session is invalid or empty. Checkout cannot be launched.');
      return;
    }

    try {
      const modeToUse: CashfreeMode = explicitMode || cashfreeMode;
      const cashfree = await getCashfreeInstance(modeToUse);

      if (!cashfree) {
        setSdkBlocked(true);
        setErrorMessage('Cashfree Checkout SDK could not load. Please check browser extensions or launch hosted checkout.');
        return;
      }

      if (typeof cashfree.checkout === 'function') {
        cashfree.checkout({
          paymentSessionId: sessionId.trim(),
          redirectTarget: target
        });
      } else if (hostedCheckoutUrl) {
        window.location.href = hostedCheckoutUrl;
      }
    } catch (err: any) {
      console.warn('[Cashfree Trigger Checkout Warning]:', err);
      if (hostedCheckoutUrl) {
        window.location.href = hostedCheckoutUrl;
      }
    }
  };

  // Initialize Cashfree Order: Safe session retrieval
  const initiateCashfreePayment = async () => {
    if (finalPayable <= 0) return;

    setIsInitializing(true);
    setErrorMessage(null);
    setSdkBlocked(false);
    setIsSimulation(false);
    setPaymentSessionId(null);

    try {
      // 1. If partial wallet is chosen, process partial wallet debit first
      if (walletDeduction > 0) {
        const walletRes = await fetch('/api/pay-via-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            bookingId: booking.id, 
            userId: profile.uid, 
            debitAmount: walletDeduction,
            isFullSettlement: false
          }),
        });
        const walletData = await walletRes.json();
        if (!walletRes.ok || !walletData.success) {
          throw new Error(walletData.error || 'Failed to process partial wallet deduction');
        }
      }

      // 2. Fetch payment_session_id from /api/cashfree/create-order
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch('/api/cashfree/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalPayable,
          bookingId: booking.id,
          customerUid: profile.uid,
          customerPhone: profile.phoneNumber || profile.mobile || '9999999999',
          customerEmail: profile.email || 'customer@zomindia.com',
          customerName: profile.displayName || profile.fullName || 'Customer',
          serviceName: booking.serviceName || 'Home Service',
          redirectOrigin: origin
        })
      });

      const data = await res.json();

      // Guard: Session Verification Before Checkout
      const hasValidSession = 
        res.ok && 
        data && 
        data.success && 
        typeof data.payment_session_id === 'string' && 
        data.payment_session_id.trim().length > 10;

      if (!hasValidSession) {
        setIsInitializing(false);
        const errMsg = data?.error || 'Cashfree payment session could not be initialized. Please configure API keys or pay via Pay After Service.';
        setErrorMessage(errMsg);

        // Dev / Test simulation fallback
        if (data?.isSimulation || (!data?.payment_session_id && ((import.meta as any).env?.DEV || (import.meta as any).env?.MODE !== 'production'))) {
          setIsSimulation(true);
          setActiveOrderId(data?.order_id || `ORDER_SIM_${Date.now()}`);
        }
        return; // DO NOT call cashfree.checkout()
      }

      const sessionId = data.payment_session_id.trim();
      const serverMode: CashfreeMode = data.mode === 'sandbox' || data.environment === 'sandbox' ? 'sandbox' : 'production';
      setCashfreeMode(serverMode);

      const orderId = data.order_id || data.merchantTransactionId;
      setActiveOrderId(orderId);
      setPaymentSessionId(sessionId);
      if (data.checkoutUrl) {
        setHostedCheckoutUrl(data.checkoutUrl);
      }
      setIsSimulation(false);
      setIsInitializing(false);

      // Start status verification polling
      startStatusPolling(orderId);

      // Strictly invoke Cashfree JS SDK's checkout method with matched mode
      await triggerSdkCheckout(sessionId, '_modal', serverMode);
    } catch (err: any) {
      console.error('[Cashfree Init Error]:', err);
      setIsInitializing(false);
      setErrorMessage('Cashfree payment session could not be initialized. Please configure API keys or pay via Pay After Service.');
    }
  };

  // Launch Cashfree checkout on user action
  const handleLaunchCheckout = (target: '_modal' | '_self' = '_modal') => {
    if (isSimulation) {
      handleFinalSuccess(activeOrderId || `ORDER_SIM_${Date.now()}`, 'Cashfree Simulation');
      return;
    }

    if (!paymentSessionId || !paymentSessionId.trim()) {
      setErrorMessage('No active payment session found. Retrying initialization...');
      initiateCashfreePayment();
      return;
    }

    triggerSdkCheckout(paymentSessionId, target, cashfreeMode);
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end sm:items-center sm:justify-end overflow-hidden">
      {/* Backdrop */}
      <motion.div
        key="payment-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-up Bottom Sheet Panel */}
      <motion.div
        key="payment-modal-panel"
        initial={{ y: '100%', opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        className="relative z-10 w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans border-t border-slate-100"
      >
        {/* Grab Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mt-3 mb-1 shrink-0 cursor-grab" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-900 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
              CF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Cashfree Checkout
                </h3>
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck size={11} className="text-emerald-600" />
                  100% Secure
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Booking #{booking.id.slice(-6).toUpperCase()} • {formatBookingTime(booking.scheduledAt)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close payment modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Amount Pill */}
        <div className="px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-600">Total Amount to Pay</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-slate-900 tracking-tight">₹{finalPayable}</span>
            {walletDeduction > 0 && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                ₹{walletDeduction} from wallet
              </span>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
          {/* Ad-blocker Alert */}
          {sdkBlocked && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col gap-2.5 text-xs font-semibold text-amber-900 shadow-xs">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={18} className="shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-950">Payment Gateway Script Blocked</p>
                  <p className="text-[11px] text-amber-800 font-normal mt-0.5 leading-normal">
                    An ad-blocker or privacy shield is preventing Cashfree Checkout from opening.
                    Please disable shields or launch the hosted payment checkout.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleLaunchCheckout('_self')}
                  className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <ArrowRight size={12} />
                  Open Hosted Checkout
                </button>
                <button
                  type="button"
                  onClick={initiateCashfreePayment}
                  className="py-1.5 px-3 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Graceful Error Notification */}
          {errorMessage && !sdkBlocked && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col gap-3 text-xs text-rose-900 shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-950">Payment Session Notice</p>
                  <p className="text-rose-800 font-medium leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={initiateCashfreePayment}
                  className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold shrink-0 shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw size={11} />
                  Retry
                </button>
                {booking.paymentStatus !== 'paid' && booking.paymentMethod !== 'cash' && (
                  <button
                    type="button"
                    onClick={handleSwitchToCOD}
                    className="py-1.5 px-3 bg-white border border-rose-200 hover:bg-rose-100 text-rose-900 rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Banknote size={12} />
                    Pay After Service
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Dev / Test Fallback Simulation Option */}
          {isSimulation && !paymentSuccess && (
            <div className="p-5 bg-gradient-to-br from-indigo-50/90 via-sky-50/70 to-emerald-50/70 border-2 border-indigo-200/80 rounded-3xl space-y-4 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
                <Sparkles size={24} />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-800 text-[11px] font-black rounded-full mb-1">
                  <span>Preview & Test Sandbox Mode ({cashfreeMode})</span>
                </div>
                <h4 className="text-base font-black text-slate-900">Cashfree Simulation Active</h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Cashfree live credentials are not configured in this preview environment. You can simulate the verified payment flow to test end-to-end booking confirmation without errors.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleFinalSuccess(activeOrderId || `ORDER_SIM_${Date.now()}`, 'Cashfree Simulation')}
                  className="w-full sm:w-auto px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Zap size={15} />
                  <span>{isProcessing ? 'Processing...' : `Simulate Successful Payment (₹${finalPayable})`}</span>
                </button>
              </div>
            </div>
          )}

          {/* Payment Success View */}
          {paymentSuccess ? (
            <div className="py-10 px-4 text-center space-y-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} className="stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-900">Payment Completed!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Cashfree Transaction Reference: <span className="font-mono font-bold text-slate-700">{activeOrderId}</span>
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs font-bold">
                <Sparkles size={14} className="text-emerald-600" />
                Confirmed ₹{totalBill} • Updating Booking...
              </div>
            </div>
          ) : (
            <>
              {/* Wallet Deduction Option */}
              {walletBalance > 0 && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-50/60 to-teal-50/60 border border-emerald-200/80 rounded-2xl flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">Zomindia Wallet</p>
                      <p className="text-[11px] text-emerald-700 font-medium">
                        Available Balance: ₹{walletBalance}
                      </p>
                    </div>
                  </div>

                  {canPayEntirelyWithWallet ? (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleFullWalletPayment}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isProcessing ? 'Processing...' : 'Pay Full ₹' + totalBill}
                    </button>
                  ) : (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={useWalletPartial}
                        onChange={(e) => setUseWalletPartial(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 border-emerald-300 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700">Apply ₹{Math.min(walletBalance, totalBill)}</span>
                    </label>
                  )}
                </div>
              )}

              {/* Pay After Service (COD) Alternative */}
              {booking.paymentStatus !== 'paid' && booking.paymentMethod !== 'cash' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Banknote size={18} className="text-slate-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Pay After Service</p>
                      <p className="text-[11px] text-slate-500 font-normal">Pay cash or UPI to partner on completion</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleSwitchToCOD}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Select COD
                  </button>
                </div>
              )}

              {/* Loading State when fetching session */}
              {isInitializing && (
                <div className="min-h-[220px] w-full rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center p-6 text-center space-y-3 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center animate-bounce shadow-sm">
                    <CreditCard size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900">Loading Cashfree Checkout</h4>
                    <p className="text-xs text-slate-500">Connecting securely to payment gateway ({cashfreeMode})...</p>
                  </div>
                  <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-indigo-600 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Active Session Card - Clean popup trigger without premature inline iframes */}
              {paymentSessionId && !isSimulation && !errorMessage && (
                <div className="p-5 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-white border border-indigo-100 rounded-2xl space-y-4 text-center shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <CreditCard size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900">Payment Window Ready</h4>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                      Cashfree payment session is active ({cashfreeMode} mode). Choose your preferred checkout display below to pay with UPI, Credit/Debit Card, or NetBanking.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleLaunchCheckout('_modal')}
                      className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                    >
                      <Zap size={14} />
                      <span>Open Cashfree Checkout • ₹{finalPayable}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLaunchCheckout('_self')}
                      className="w-full sm:w-auto px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink size={13} />
                      <span>Full Page</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Polling Notice */}
              {isPollingActive && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between text-xs text-indigo-900">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={13} className="animate-spin text-indigo-600 shrink-0" />
                    <span className="font-medium">
                      Verifying payment status in real-time... ({pollingCountdown}s)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => activeOrderId && checkOrderStatusOnce(activeOrderId)}
                    className="font-bold text-indigo-600 hover:text-indigo-800 underline text-[11px] cursor-pointer"
                  >
                    Check Now
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with Security Badges */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium shrink-0">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
            <Lock size={12} className="text-emerald-600" />
            <span>256-bit Encrypted</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Powered by Cashfree Payments</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
