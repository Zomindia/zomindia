import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, UserProfile } from '../types';
import { formatBookingTime } from '../utils/formatTime';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  ShieldCheck,
  Smartphone,
  Wallet,
  CheckCircle2,
  Check,
  QrCode,
  Copy,
  AlertCircle,
  CreditCard,
  Landmark,
  Lock,
  ArrowRight,
  HelpCircle,
  Banknote
} from 'lucide-react';

interface PaymentModalProps {
  booking: Booking;
  profile: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export type PaymentMethodId = 
  | 'phonepe'
  | 'gpay'
  | 'paytm'
  | 'other_upi'
  | 'qr_code'
  | 'card'
  | 'netbanking'
  | 'wallet_full'
  | 'cod';

const POPULAR_BANKS = [
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC' },
  { id: 'sbi', name: 'SBI', code: 'SBI' },
  { id: 'icici', name: 'ICICI Bank', code: 'ICICI' },
  { id: 'axis', name: 'Axis Bank', code: 'AXIS' },
  { id: 'kotak', name: 'Kotak Mahindra', code: 'KOTAK' },
  { id: 'pnb', name: 'Punjab National', code: 'PNB' }
];

const UPI_HANDLE_SUGGESTIONS = [
  '@okhdfcbank',
  '@oksbi',
  '@okaxis',
  '@ybl',
  '@paytm'
];

export default function PaymentModal({ booking, profile, onClose, onSuccess }: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>('phonepe');
  const [useWalletPartial, setUseWalletPartial] = useState(false);

  // Specific method states
  const [customUpiId, setCustomUpiId] = useState('');
  const [upiIdError, setUpiIdError] = useState('');
  const [selectedBank, setSelectedBank] = useState('hdfc');

  // Card details
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardError, setCardError] = useState('');

  // QR Code state
  const [qrTimer, setQrTimer] = useState(300);
  const [copiedVpa, setCopiedVpa] = useState(false);

  // UTR & Manual verification
  const [utrInput, setUtrInput] = useState('');
  const [utrError, setUtrError] = useState<string | null>(null);
  const [showUtrHelp, setShowUtrHelp] = useState(false);

  // Flow states
  const [isProcessing, setIsProcessing] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [activeTxnId, setActiveTxnId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const INDORE_MERCHANT_VPA = (import.meta.env.VITE_MERCHANT_UPI_ID as string) || 'zomindia.indore@icici';
  const MERCHANT_NAME = (import.meta.env.VITE_MERCHANT_NAME as string) || 'Zomindia Services Indore';

  const totalBill = booking.totalPrice || 0;
  const walletBalance = profile?.walletBalance || 0;
  const walletDeduction = useWalletPartial ? Math.min(walletBalance, totalBill) : 0;
  const finalPayable = Math.max(0, totalBill - walletDeduction);
  const canPayEntirelyWithWallet = walletBalance >= totalBill;

  // Dynamic UPI Intent URI
  const upiIntentUri = `upi://pay?pa=${INDORE_MERCHANT_VPA}&pn=${encodeURIComponent(
    MERCHANT_NAME
  )}&am=${finalPayable}&cu=INR&tn=Booking_${booking.id.slice(-6).toUpperCase()}`;

  // QR Timer Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setQrTimer((prev) => (prev > 0 ? prev - 1 : 300));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(INDORE_MERCHANT_VPA);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const formatCardNumber = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < clean.length; i += 4) {
      parts.push(clean.substring(i, i + 4));
    }
    return parts.join(' ');
  };

  const formatExpiry = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 3) {
      return `${clean.slice(0, 2)}/${clean.slice(2)}`;
    }
    return clean;
  };

  const getMethodLabel = (id: PaymentMethodId): string => {
    switch (id) {
      case 'phonepe': return 'PhonePe';
      case 'gpay': return 'Google Pay';
      case 'paytm': return 'Paytm UPI';
      case 'other_upi': return 'Other UPI';
      case 'qr_code': return 'UPI QR';
      case 'card': return 'Credit/Debit Card';
      case 'netbanking': return `${selectedBank.toUpperCase()} Net Banking`;
      case 'wallet_full': return 'Zomindia Wallet';
      case 'cod': return 'Pay After Service';
      default: return 'Online Payment';
    }
  };

  // Start status polling
  const startStatusPolling = (txnId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    let attempts = 0;
    const maxAttempts = 50;

    pollingRef.current = setInterval(async () => {
      attempts += 1;
      if (attempts > maxAttempts) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        return;
      }

      try {
        const res = await fetch('/api/phonepe/status-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchantTransactionId: txnId })
        });
        const data = await res.json();
        if (data.success && (data.code === 'PAYMENT_SUCCESS' || data.status === 'PAYMENT_SUCCESS')) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          handleFinalSuccess(txnId, 'PhonePe Gateway');
        }
      } catch (err) {
        console.warn('[PaymentModal Polling Notice]:', err);
      }
    }, 3000);
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

  // Handle Primary "Pay ₹XX" CTA Click
  const handleProceedToPay = async () => {
    setErrorMessage(null);
    setCardError('');
    setUpiIdError('');

    if (selectedMethod === 'wallet_full') {
      await handleFullWalletPayment();
      return;
    }

    if (selectedMethod === 'cod') {
      await handleSwitchToCOD();
      return;
    }

    if (selectedMethod === 'other_upi') {
      if (!customUpiId.trim() || !customUpiId.includes('@')) {
        setUpiIdError('Please enter a valid UPI ID (e.g. name@okhdfcbank)');
        return;
      }
    }

    if (selectedMethod === 'card') {
      const cleanCard = cardNumber.replace(/\D/g, '');
      if (cleanCard.length < 15) {
        setCardError('Enter a valid 16-digit card number');
        return;
      }
      if (!cardExpiry || cardExpiry.length < 5) {
        setCardError('Enter expiry MM/YY');
        return;
      }
      if (!cardCvv || cardCvv.length < 3) {
        setCardError('Enter 3-digit CVV');
        return;
      }
    }

    setIsProcessing(true);
    setStatusMessage('Initiating secure payment session...');

    try {
      // 1. Process partial wallet debit if active
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

      // 2. Call /api/phonepe/pay
      const response = await fetch('/api/phonepe/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalPayable,
          bookingId: booking.id,
          customerUid: profile.uid,
          customerPhone: profile.phoneNumber || profile.mobile || '',
          customerEmail: profile.email || '',
          serviceName: booking.serviceName || 'Home Service',
          redirectOrigin: window.location.origin
        })
      });

      const data = await response.json();
      const generatedTxn = data.merchantTransactionId || `TXN_${Date.now()}`;
      setActiveTxnId(generatedTxn);

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      // Handle PhonePe primary button: prioritize official PhonePe Gateway checkout URL
      if (selectedMethod === 'phonepe' && data.success && (data.checkoutUrl || data.redirectUrl)) {
        const checkoutUrl = data.checkoutUrl || data.redirectUrl;
        if (isMobile) {
          // On mobile devices, direct window navigation launches PhonePe App / Web checkout seamlessly
          window.location.href = checkoutUrl;
        } else {
          window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
        }
        setIsProcessing(false);
        setAwaitingConfirmation(true);
        setStatusMessage('Redirecting to secure PhonePe Gateway checkout...');
        startStatusPolling(generatedTxn);
        return;
      }

      // Handle Other UPI Apps on Mobile (GPay, Paytm, etc.)
      if (['phonepe', 'gpay', 'paytm'].includes(selectedMethod) && isMobile) {
        let deepLink = upiIntentUri;
        if (selectedMethod === 'phonepe') {
          deepLink = `phonepe://pay?pa=${INDORE_MERCHANT_VPA}&pn=${encodeURIComponent(
            MERCHANT_NAME
          )}&am=${finalPayable}&cu=INR`;
        } else if (selectedMethod === 'gpay') {
          deepLink = `tez://upi/pay?pa=${INDORE_MERCHANT_VPA}&pn=${encodeURIComponent(
            MERCHANT_NAME
          )}&am=${finalPayable}&cu=INR`;
        } else if (selectedMethod === 'paytm') {
          deepLink = `paytmmp://pay?pa=${INDORE_MERCHANT_VPA}&pn=${encodeURIComponent(
            MERCHANT_NAME
          )}&am=${finalPayable}&cu=INR`;
        }

        window.location.href = deepLink;

        setIsProcessing(false);
        setAwaitingConfirmation(true);
        setStatusMessage(`Awaiting confirmation from ${getMethodLabel(selectedMethod)}...`);
        startStatusPolling(generatedTxn);
        return;
      }

      // Handle PhonePe Gateway Web Flow (Cards, Net Banking, or Desktop)
      if (data.success && (data.checkoutUrl || data.redirectUrl)) {
        const checkoutUrl = data.checkoutUrl || data.redirectUrl;
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
        setIsProcessing(false);
        setAwaitingConfirmation(true);
        setStatusMessage('Complete payment on the PhonePe secure gateway tab...');
        startStatusPolling(generatedTxn);
        return;
      }

      // Simulated / Fallback flow
      setIsProcessing(false);
      setAwaitingConfirmation(true);
      setStatusMessage('Please complete payment and confirm reference number below');
    } catch (err: any) {
      console.warn('[PaymentModal] Error:', err);
      const fallbackTxn = `UPI_${Date.now()}`;
      setActiveTxnId(fallbackTxn);
      setIsProcessing(false);
      setAwaitingConfirmation(true);
      setStatusMessage('Please complete payment via UPI and enter reference number below');
    }
  };

  // Final confirmation to server
  const handleFinalSuccess = async (txnId: string, provider: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setIsProcessing(true);

    try {
      const targetStatus = booking.status === 'payment_pending' 
        ? 'completed' 
        : (booking.status === 'pending' ? 'confirmed' : booking.status);

      await fetch('/api/phonepe/verify-and-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          customerUid: profile.uid,
          merchantTransactionId: txnId,
          amount: totalBill,
          paymentMethod: walletDeduction > 0 ? 'wallet_online' : 'upi',
          walletDeductAmount: walletDeduction > 0 ? walletDeduction : (booking.walletDeductAmount || 0),
          onlinePaymentProvider: provider,
          onlinePaymentMethod: getMethodLabel(selectedMethod),
          status: targetStatus
        })
      });
    } catch (e) {
      console.warn('Server verify notice:', e);
    }

    setShowSuccess(true);
    setIsProcessing(false);
    setAwaitingConfirmation(false);

    setTimeout(() => {
      onSuccess();
      onClose();
    }, 1200);
  };

  // Manual UTR Verification
  const handleManualUtrVerify = () => {
    const cleanUtr = utrInput.trim().replace(/\s+/g, '');
    if (!cleanUtr || cleanUtr.length < 6) {
      setUtrError('Please enter a valid 12-digit UPI Reference / UTR Number');
      return;
    }

    setUtrError(null);
    handleFinalSuccess(cleanUtr, getMethodLabel(selectedMethod));
  };

  const minutes = Math.floor(qrTimer / 60);
  const seconds = qrTimer % 60;
  const formattedQrTimer = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

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
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Payment Options
              </h3>
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck size={12} className="text-emerald-600" />
                100% Safe
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Booking #{booking.id.slice(-6).toUpperCase()} • {formatBookingTime(booking.scheduledAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
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
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-semibold text-rose-700">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SUCCESS OVERLAY */}
          {showSuccess ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 animate-bounce">
                <CheckCircle2 size={36} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Payment Confirmed!</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  ₹{finalPayable} paid successfully. Booking updated to <strong className="text-emerald-600">PAID</strong>.
                </p>
              </div>
            </div>
          ) : awaitingConfirmation ? (
            /* AWAITING CONFIRMATION SCREEN */
            <div className="py-4 space-y-4">
              <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl text-center space-y-3">
                <div className="relative w-12 h-12 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-200 animate-ping opacity-75" />
                  <div className="relative w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                    <Smartphone size={22} />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    {statusMessage || 'Awaiting Payment Confirmation'}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Complete the payment of <span className="font-bold text-slate-900">₹{finalPayable}</span>.
                  </p>
                </div>
              </div>

              {/* UTR Input */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Enter 12-digit UPI Ref / UTR Number
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUtrHelp(!showUtrHelp)}
                    className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <HelpCircle size={12} /> Where to find?
                  </button>
                </div>

                {showUtrHelp && (
                  <p className="text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200 leading-relaxed">
                    Look for the 12-digit number next to <span className="font-bold text-slate-700">"UPI Ref No"</span> on your payment receipt.
                  </p>
                )}

                <div className="space-y-2">
                  <input
                    type="text"
                    maxLength={22}
                    placeholder="e.g. 423589124501"
                    value={utrInput}
                    onChange={(e) => {
                      setUtrInput(e.target.value);
                      if (utrError) setUtrError(null);
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                  {utrError && (
                    <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                      <AlertCircle size={12} /> {utrError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleManualUtrVerify}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck size={14} />
                    Verify & Confirm Payment
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAwaitingConfirmation(false)}
                className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 py-1.5 cursor-pointer"
              >
                ← Select another payment method
              </button>
            </div>
          ) : (
            /* PAYMENT OPTIONS */
            <div className="space-y-4">
              {/* Wallet Partial Toggle */}
              {walletBalance > 0 && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Wallet size={16} className="text-emerald-700" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Use Wallet Balance</p>
                      <p className="text-[10px] text-slate-500">₹{walletBalance} available in your wallet</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseWalletPartial(!useWalletPartial)}
                    className={`w-10 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                      useWalletPartial ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      useWalletPartial ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              )}

              {/* UPI APPS */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block px-1">
                  UPI Options (Fastest)
                </span>

                {/* Google Pay */}
                <div
                  onClick={() => setSelectedMethod('gpay')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    selectedMethod === 'gpay'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
                      <span className="text-lg font-black text-[#1A73E8] tracking-tighter">G</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-slate-900">Google Pay</h4>
                        <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                          Instant
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">Pay directly via GPay UPI</p>
                    </div>
                  </div>

                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selectedMethod === 'gpay' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                  }`}>
                    {selectedMethod === 'gpay' && <Check size={12} className="stroke-[3]" />}
                  </div>
                </div>

                {/* PhonePe */}
                <div
                  onClick={() => setSelectedMethod('phonepe')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    selectedMethod === 'phonepe'
                      ? 'border-[#5F259F] bg-purple-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#5F259F] text-white shadow-xs flex items-center justify-center text-lg font-black shrink-0">
                      पे
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-slate-900">PhonePe</h4>
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-700 font-medium">1-tap checkout via PhonePe Gateway</p>
                    </div>
                  </div>

                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selectedMethod === 'phonepe' ? 'border-[#5F259F] bg-[#5F259F] text-white' : 'border-slate-300'
                  }`}>
                    {selectedMethod === 'phonepe' && <Check size={12} className="stroke-[3]" />}
                  </div>
                </div>

                {/* Paytm */}
                <div
                  onClick={() => setSelectedMethod('paytm')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    selectedMethod === 'paytm'
                      ? 'border-[#00BAF2] bg-sky-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#002970] text-[#00BAF2] shadow-xs flex items-center justify-center text-[10px] font-black tracking-tighter shrink-0">
                      Paytm
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">Paytm UPI</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Fast payment via Paytm</p>
                    </div>
                  </div>

                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selectedMethod === 'paytm' ? 'border-[#00BAF2] bg-[#00BAF2] text-white' : 'border-slate-300'
                  }`}>
                    {selectedMethod === 'paytm' && <Check size={12} className="stroke-[3]" />}
                  </div>
                </div>

                {/* Other UPI */}
                <div
                  onClick={() => setSelectedMethod('other_upi')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    selectedMethod === 'other_upi'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-xs flex items-center justify-center text-xs font-black shrink-0">
                        UPI
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">Other UPI / Enter UPI ID</h4>
                        <p className="text-[11px] text-slate-500 font-medium">BHIM, Cred, Amazon Pay or VPA</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedMethod === 'other_upi' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                    }`}>
                      {selectedMethod === 'other_upi' && <Check size={12} className="stroke-[3]" />}
                    </div>
                  </div>

                  {selectedMethod === 'other_upi' && (
                    <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="e.g. 9876543210@paytm"
                        value={customUpiId}
                        onChange={(e) => {
                          setCustomUpiId(e.target.value);
                          if (upiIdError) setUpiIdError('');
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {UPI_HANDLE_SUGGESTIONS.map((suffix) => (
                          <button
                            key={suffix}
                            type="button"
                            onClick={() => {
                              const prefix = customUpiId.split('@')[0] || '';
                              setCustomUpiId(`${prefix}${suffix}`);
                            }}
                            className="px-2 py-0.5 bg-white border border-slate-200 hover:border-blue-400 rounded-lg text-[10px] font-bold text-slate-600"
                          >
                            {suffix}
                          </button>
                        ))}
                      </div>
                      {upiIdError && <p className="text-[10px] text-rose-600 font-bold">{upiIdError}</p>}
                    </div>
                  )}
                </div>

                {/* Scan QR */}
                <div
                  onClick={() => setSelectedMethod('qr_code')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    selectedMethod === 'qr_code'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white shadow-xs flex items-center justify-center shrink-0">
                        <QrCode size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">Scan QR Code</h4>
                        <p className="text-[11px] text-slate-500 font-medium">Scan using any UPI app</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedMethod === 'qr_code' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                    }`}>
                      {selectedMethod === 'qr_code' && <Check size={12} className="stroke-[3]" />}
                    </div>
                  </div>

                  {selectedMethod === 'qr_code' && (
                    <div className="mt-3 pt-3 border-t border-blue-200/60 flex flex-col items-center text-center space-y-3" onClick={(e) => e.stopPropagation()}>
                      <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-sm inline-block">
                        <QRCodeSVG
                          value={upiIntentUri}
                          size={160}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <span>Timer: <strong className="text-slate-800 font-mono">{formattedQrTimer}</strong></span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={handleCopyVpa}
                          className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Copy size={12} /> {copiedVpa ? 'Copied VPA!' : 'Copy UPI ID'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CARDS & NET BANKING */}
              <div className="space-y-2.5 pt-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block px-1">
                  Cards &amp; Net Banking
                </span>

                {/* Cards */}
                <div
                  onClick={() => setSelectedMethod('card')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    selectedMethod === 'card'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs flex items-center justify-center shrink-0">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">Credit or Debit Card</h4>
                        <p className="text-[11px] text-slate-500 font-medium">Visa, Mastercard, RuPay</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedMethod === 'card' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                    }`}>
                      {selectedMethod === 'card' && <Check size={12} className="stroke-[3]" />}
                    </div>
                  </div>

                  {selectedMethod === 'card' && (
                    <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        maxLength={19}
                        placeholder="Card Number"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          maxLength={5}
                          placeholder="MM / YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                          className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                        />
                        <input
                          type="password"
                          maxLength={4}
                          placeholder="CVV"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                        />
                      </div>
                      {cardError && <p className="text-[10px] text-rose-600 font-bold">{cardError}</p>}
                    </div>
                  )}
                </div>

                {/* Net Banking */}
                <div
                  onClick={() => setSelectedMethod('netbanking')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    selectedMethod === 'netbanking'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-xs flex items-center justify-center shrink-0">
                        <Landmark size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">Net Banking</h4>
                        <p className="text-[11px] text-slate-500 font-medium">All major banks supported</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedMethod === 'netbanking' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                    }`}>
                      {selectedMethod === 'netbanking' && <Check size={12} className="stroke-[3]" />}
                    </div>
                  </div>

                  {selectedMethod === 'netbanking' && (
                    <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-3 gap-1.5">
                        {POPULAR_BANKS.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelectedBank(b.id)}
                            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-center transition-all ${
                              selectedBank === b.id
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {b.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional COD switch if booking is eligible */}
                {booking.status !== 'completed' && booking.status !== 'finalized' && (
                  <div
                    onClick={() => setSelectedMethod('cod')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                      selectedMethod === 'cod'
                        ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 shadow-xs flex items-center justify-center shrink-0">
                        <Banknote size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">Pay After Service</h4>
                        <p className="text-[11px] text-slate-500 font-medium">Pay via Cash / UPI directly to technician</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedMethod === 'cod' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                    }`}>
                      {selectedMethod === 'cod' && <Check size={12} className="stroke-[3]" />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* STICKY BOTTOM ACTION BAR */}
        {!showSuccess && !awaitingConfirmation && (
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between gap-4 shadow-lg">
            <div className="text-left shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">
                TO PAY
              </span>
              <span className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                ₹{selectedMethod === 'cod' ? totalBill : finalPayable}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold block leading-none mt-0.5">
                100% Secured
              </span>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleProceedToPay}
              className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider text-white transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg active:scale-98 ${
                selectedMethod === 'phonepe'
                  ? 'bg-gradient-to-r from-[#5F259F] to-[#7B33C7] shadow-purple-600/25 hover:brightness-105'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-600/25 hover:brightness-105'
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : selectedMethod === 'cod' ? (
                <>
                  <Banknote size={16} />
                  <span>Confirm Pay on Arrival</span>
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  <Lock size={15} />
                  <span>Pay ₹{finalPayable}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
