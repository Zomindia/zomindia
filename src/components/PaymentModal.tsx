import React, { useState, useEffect, useRef } from 'react';
import { Booking, UserProfile } from '../types';
import { formatBookingTime } from '../utils/formatTime';
import { motion, AnimatePresence } from 'motion/react';
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
  Banknote,
  MapPin,
  Calendar
} from 'lucide-react';
import { playSuccessChime } from '../lib/audio';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import confetti from 'canvas-confetti';

export interface PaymentSuccessData {
  txnId: string;
  method: 'upi' | 'card' | 'netbanking' | 'wallet' | 'online' | 'razorpay';
  provider: string;
  amount: number;
  paidAt: string;
}

export interface PaymentModalProps {
  // Existing booking settlement mode (CustomerHome, CustomerDashboard)
  booking?: Booking;
  profile?: UserProfile | null;
  onSuccess?: () => void;

  // Direct checkout mode (BookingModal, etc.)
  isOpen?: boolean;
  amount?: number;
  serviceName?: string;
  bookingId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  bookingDetails?: {
    date: string;
    time: string;
    address: string;
  };
  onPaymentSuccess?: (data: PaymentSuccessData) => Promise<void> | void;
  onPaymentCancel?: () => void;

  // Shared
  onClose: () => void;
}

// Backwards compatibility alias
export type OnlinePaymentGatewayModalProps = PaymentModalProps;

export default function PaymentModal({
  booking,
  profile,
  onClose,
  onSuccess,
  isOpen,
  amount,
  serviceName,
  bookingId,
  customerName,
  customerPhone,
  customerEmail,
  bookingDetails,
  onPaymentSuccess,
  onPaymentCancel
}: PaymentModalProps) {
  // If isOpen is explicitly passed as false, do not render
  if (isOpen === false) return null;

  const [useWalletPartial, setUseWalletPartial] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
  const [orderAmountPaise, setOrderAmountPaise] = useState<number>(0);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const isMountedRef = useRef<boolean>(true);

  // Unified data resolution
  const totalBill = typeof amount === 'number' && amount > 0 
    ? amount 
    : (booking?.totalPrice || 0);

  const resolvedBookingId = booking?.id || bookingId || `bk_${Date.now()}`;
  const resolvedServiceName = serviceName || booking?.serviceName || 'Zomindia Doorstep Service';
  const resolvedCustomerName = customerName || profile?.displayName || profile?.fullName || 'Valued Customer';
  const resolvedCustomerPhone = customerPhone || profile?.phoneNumber || profile?.mobile || '';
  const resolvedCustomerEmail = customerEmail || profile?.email || '';

  const walletBalance = profile?.walletBalance || 0;
  const walletDeduction = useWalletPartial ? Math.min(walletBalance, totalBill) : 0;
  const finalPayable = Math.max(0, totalBill - walletDeduction);
  const canPayEntirelyWithWallet = Boolean(profile && walletBalance >= totalBill && totalBill > 0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize Razorpay order when payable amount > 0
  useEffect(() => {
    if (finalPayable > 0) {
      initiateRazorpayOrder();
    } else {
      setActiveOrderId(null);
    }
  }, [finalPayable, resolvedBookingId]);

  // Handle terminal success confirmation
  const handleFinalSuccess = async (txnId: string, provider: string = 'Razorpay') => {
    if (!isMountedRef.current || paymentSuccess) return;

    playSuccessChime();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {}
    }

    try {
      confetti({
        particleCount: 90,
        spread: 65,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    // Update Firestore booking document if booking is available
    if (booking?.id) {
      try {
        const bRef = doc(db, 'bookings', booking.id);
        const targetStatus = booking.status === 'payment_pending'
          ? 'completed'
          : (booking.status === 'pending' ? 'confirmed' : booking.status);

        await updateDoc(bRef, {
          paymentStatus: 'paid',
          status: targetStatus,
          transactionId: txnId,
          paymentMethod: provider.toLowerCase().includes('wallet') ? 'wallet' : 'razorpay',
          paidAmount: finalPayable,
          updatedAt: Timestamp.now()
        });
      } catch (writeErr) {
        console.warn('[PaymentModal] Direct Firestore booking payment update notice:', writeErr);
      }
    }

    setPaymentSuccess(true);
    setIsProcessing(false);

    const successData: PaymentSuccessData = {
      txnId,
      method: provider.toLowerCase().includes('wallet') ? 'wallet' : 'razorpay',
      provider,
      amount: finalPayable,
      paidAt: new Date().toISOString()
    };

    setTimeout(async () => {
      if (isMountedRef.current) {
        try {
          if (onPaymentSuccess) {
            await onPaymentSuccess(successData);
          }
          if (onSuccess) {
            onSuccess();
          }
        } catch (cbErr) {
          console.warn('[PaymentModal] Success callback notice:', cbErr);
        }
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
    if (!profile?.uid) {
      setErrorMessage('User session required for wallet deduction.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/pay-via-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookingId: resolvedBookingId, 
          userId: profile.uid, 
          debitAmount: totalBill,
          isFullSettlement: true
        }),
      });

      const rawWalletText = await response.text();
      let data: any = null;
      try {
        data = rawWalletText ? JSON.parse(rawWalletText) : null;
      } catch {
        data = null;
      }
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to process wallet payment');
      }

      handleFinalSuccess(`WALLET_${Date.now()}`, 'Zomindia Wallet');
    } catch (err: any) {
      setErrorMessage(err.message || 'Wallet payment failed');
      setIsProcessing(false);
    }
  };

  // Switch to COD / Pay After Service
  const handleSwitchToCOD = async () => {
    if (!booking?.id) {
      if (onPaymentCancel) onPaymentCancel();
      onClose();
      return;
    }

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
      setErrorMessage('Failed to update payment mode.');
      setIsProcessing(false);
    }
  };

  // Initialize Razorpay Order from backend
  const initiateRazorpayOrder = async () => {
    if (finalPayable <= 0) return;

    setIsInitializing(true);
    setErrorMessage(null);

    try {
      // Partial wallet deduction if enabled
      if (useWalletPartial && walletDeduction > 0 && profile?.uid) {
        const walletRes = await fetch('/api/pay-via-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            bookingId: resolvedBookingId, 
            userId: profile.uid, 
            debitAmount: walletDeduction,
            isFullSettlement: false
          }),
        });
        const walletRaw = await walletRes.text();
        let walletData: any = null;
        try {
          walletData = walletRaw ? JSON.parse(walletRaw) : null;
        } catch {
          walletData = null;
        }
        if (!walletRes.ok || !walletData?.success) {
          throw new Error(walletData?.error || 'Failed to process partial wallet deduction');
        }
      }

      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalPayable,
          currency: 'INR',
          bookingId: resolvedBookingId,
          customerPhone: resolvedCustomerPhone || '9999999999',
          customerEmail: (resolvedCustomerEmail && !resolvedCustomerEmail.includes('customer@zomindia.com'))
            ? resolvedCustomerEmail
            : (resolvedCustomerPhone ? `${resolvedCustomerPhone.replace(/\D/g, '')}@phone.zomindia.com` : 'customer@phone.zomindia.com'),
          customerName: resolvedCustomerName,
          serviceName: resolvedServiceName
        })
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (!res.ok || !data?.success) {
        setIsInitializing(false);
        const errMsg = data?.error || 'Online payment gateway is not configured. Please contact support or pay via cash.';
        setErrorMessage(errMsg);
        return;
      }

      const clientKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;
      const effectiveKey = (data.keyId && !data.keyId.includes('placeholder'))
        ? data.keyId
        : (clientKey && !clientKey.includes('placeholder') ? clientKey : '');

      if (!effectiveKey || !data.orderId) {
        setIsInitializing(false);
        setErrorMessage('Online payment gateway is not configured. Please contact support or pay via cash.');
        return;
      }

      setActiveOrderId(data.orderId);
      setActiveKeyId(effectiveKey);
      setOrderAmountPaise(data.amount || Math.round(finalPayable * 100));
      setIsInitializing(false);
    } catch (err: any) {
      setIsInitializing(false);
      setErrorMessage('Online payment gateway is not configured. Please contact support or pay via cash.');
    }
  };

  // Verify payment status with backend
  const verifyPayment = async (orderId: string, paymentId: string, signature: string) => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const verifyRes = await fetch('/api/razorpay/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          bookingId: resolvedBookingId,
          customerUid: profile?.uid || (booking as any)?.customerId || 'customer',
          amount: finalPayable,
          walletDeductAmount: walletDeduction,
          isMock: false,
          status: booking?.status === 'payment_pending' ? 'completed' : 'confirmed'
        })
      });

      const verifyRaw = await verifyRes.text();
      let verifyData: any = null;
      try {
        verifyData = verifyRaw ? JSON.parse(verifyRaw) : null;
      } catch {
        verifyData = null;
      }

      if (verifyRes.ok && verifyData?.success) {
        handleFinalSuccess(paymentId, 'Razorpay');
      } else {
        setErrorMessage(verifyData?.error || 'Payment signature verification failed.');
        setIsProcessing(false);
      }
    } catch (err: any) {
      setErrorMessage('Network error while verifying payment status.');
      setIsProcessing(false);
    }
  };

  // Dynamic SDK checkout launcher
  const openRazorpayCheckout = (keyToUse: string) => {
    const RazorpayConstructor = (window as any).Razorpay;
    if (typeof RazorpayConstructor !== 'function') {
      setErrorMessage('Online payment gateway is not configured. Please contact support or pay via cash.');
      return;
    }

    try {
      const options = {
        key: keyToUse,
        amount: orderAmountPaise,
        currency: 'INR',
        name: 'Zomindia Services',
        description: `${resolvedServiceName} • #${resolvedBookingId.slice(-6).toUpperCase()}`,
        order_id: activeOrderId,
        handler: function (response: any) {
          verifyPayment(
            response.razorpay_order_id || activeOrderId || '',
            response.razorpay_payment_id,
            response.razorpay_signature
          );
        },
        prefill: {
          name: resolvedCustomerName,
          contact: resolvedCustomerPhone,
          email: resolvedCustomerEmail
        },
        theme: {
          color: '#dc2626'
        },
        modal: {
          ondismiss: function () {
            console.log('[Razorpay] Checkout modal dismissed by user');
          }
        }
      };

      const rzp = new RazorpayConstructor(options);
      rzp.on('payment.failed', function (response: any) {
        console.warn('[Razorpay Payment Failed]:', response.error);
        setErrorMessage(response.error?.description || 'Payment was declined or cancelled.');
      });
      rzp.open();
    } catch (sdkErr: any) {
      console.error('[Razorpay Launch Error]:', sdkErr);
      setErrorMessage('Online payment gateway is not configured. Please contact support or pay via cash.');
    }
  };

  // Launch official Razorpay Checkout modal
  const handleProceedToPay = () => {
    if (!activeOrderId) {
      initiateRazorpayOrder();
      return;
    }

    if (!activeKeyId || activeKeyId.includes('placeholder')) {
      setErrorMessage('Online payment gateway is not configured. Please contact support or pay via cash.');
      return;
    }

    if (typeof (window as any).Razorpay === 'function') {
      openRazorpayCheckout(activeKeyId);
    } else {
      // Dynamically load checkout.js and launch
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        openRazorpayCheckout(activeKeyId);
      };
      script.onerror = () => {
        setErrorMessage('Unable to load Razorpay payment gateway. Please check your connection or pay via cash.');
      };
      document.body.appendChild(script);
    }
  };

  const handleModalClose = () => {
    if (onPaymentCancel) onPaymentCancel();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end sm:items-center sm:justify-end overflow-hidden">
      {/* Backdrop */}
      <motion.div
        key="payment-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleModalClose}
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity"
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
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
              RZP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Razorpay Checkout
                </h3>
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck size={11} className="text-emerald-600" />
                  PCI-DSS 256-Bit
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {resolvedServiceName} • #{resolvedBookingId.slice(-6).toUpperCase()}
                {booking?.scheduledAt ? ` • ${formatBookingTime(booking.scheduledAt)}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleModalClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close payment modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Booking Details Pill (if provided) */}
        {bookingDetails && (
          <div className="px-5 py-2.5 bg-slate-50/90 border-b border-slate-100 grid grid-cols-2 gap-2 text-xs shrink-0">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800 truncate">{bookingDetails.date} • {bookingDetails.time}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <MapPin size={13} className="text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800 truncate">{bookingDetails.address}</span>
            </div>
          </div>
        )}

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
          {/* Error Banner */}
          {errorMessage && (
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
                  onClick={initiateRazorpayOrder}
                  className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold shrink-0 shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw size={11} />
                  Retry
                </button>
                {booking && booking.paymentStatus !== 'paid' && booking.paymentMethod !== 'cash' && (
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

          {/* Payment Success View */}
          {paymentSuccess ? (
            <div className="py-10 px-4 text-center space-y-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} className="stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-900">Payment Completed!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Razorpay Transaction Reference: <span className="font-mono font-bold text-slate-700">{activeOrderId}</span>
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs font-bold">
                <Sparkles size={14} className="text-emerald-600" />
                Confirmed ₹{totalBill} • Updating Booking...
              </div>
            </div>
          ) : (
            <>
              {/* Wallet Deduction Option (if profile available) */}
              {profile && walletBalance > 0 && (
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

              {/* Pay After Service (COD) Alternative (for booking mode) */}
              {booking && booking.paymentStatus !== 'paid' && booking.paymentMethod !== 'cash' && (
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

              {/* Loading State when initializing order */}
              {isInitializing && (
                <div className="min-h-[180px] w-full rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center p-6 text-center space-y-3 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center animate-bounce shadow-sm">
                    <CreditCard size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900">Connecting to Razorpay</h4>
                    <p className="text-xs text-slate-500">Generating secure transaction order...</p>
                  </div>
                  <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-red-600 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Primary Action Button for Online Checkout */}
              {finalPayable > 0 && !isInitializing && (
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={handleProceedToPay}
                    disabled={isProcessing || !activeOrderId}
                    className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-black text-sm rounded-2xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Payment...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>PROCEED TO PAY • ₹{finalPayable}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
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
            <span>Powered by Razorpay Payments</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
