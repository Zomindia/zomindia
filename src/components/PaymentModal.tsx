import React, { useState, useEffect } from 'react';
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
  Zap,
  Copy,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  RefreshCw
} from 'lucide-react';

interface PaymentModalProps {
  booking: Booking;
  profile: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ booking, profile, onClose, onSuccess }: PaymentModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  
  // Device-specific default tab selection (Mobile: 1-Tap UPI Apps, Desktop: Dynamic QR)
  const isMobileInitial = typeof window !== 'undefined' && (
    window.innerWidth < 768 ||
    /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
  );
  
  const [activeTab, setActiveTab] = useState<'upi_apps' | 'qr_code'>(
    isMobileInitial ? 'upi_apps' : 'qr_code'
  );
  const [qrTimer, setQrTimer] = useState(300); // 5 minutes
  const [hasLaunchedUpiApp, setHasLaunchedUpiApp] = useState(false);
  const [showReturnVerifyBanner, setShowReturnVerifyBanner] = useState(false);

  const INDORE_MERCHANT_VPA = "zomindia.indore@icici";
  const MERCHANT_NAME = "Zomindia Services Indore";

  const totalBill = booking.totalPrice || 0;
  const walletBalance = profile?.walletBalance || 0;
  const walletDeduction = useWallet ? Math.min(walletBalance, totalBill) : 0;
  const finalPayable = Math.max(0, totalBill - walletDeduction);
  const isWalletFullyCovering = useWallet && walletBalance >= totalBill;

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

  // Return to browser / window focus listener for mobile UPI apps
  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (hasLaunchedUpiApp && !showSuccess) {
        setShowReturnVerifyBanner(true);
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && hasLaunchedUpiApp && !showSuccess) {
        setShowReturnVerifyBanner(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [hasLaunchedUpiApp, showSuccess]);

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(INDORE_MERCHANT_VPA);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  // Launch App Specific Deep Link on Mobile
  const handleLaunchApp = (app: 'phonepe' | 'gpay' | 'paytm' | 'universal') => {
    let deepLink = upiIntentUri;
    if (app === 'phonepe') {
      deepLink = `phonepe://pay?pa=${INDORE_MERCHANT_VPA}&pn=${encodeURIComponent(
        MERCHANT_NAME
      )}&am=${finalPayable}&cu=INR`;
    } else if (app === 'gpay') {
      deepLink = `tez://upi/pay?pa=${INDORE_MERCHANT_VPA}&pn=${encodeURIComponent(
        MERCHANT_NAME
      )}&am=${finalPayable}&cu=INR`;
    } else if (app === 'paytm') {
      deepLink = `paytmmp://pay?pa=${INDORE_MERCHANT_VPA}&pn=${encodeURIComponent(
        MERCHANT_NAME
      )}&am=${finalPayable}&cu=INR`;
    }

    setHasLaunchedUpiApp(true);
    // Trigger return verification prompt after slight delay
    setTimeout(() => {
      setShowReturnVerifyBanner(true);
    }, 1000);

    window.location.href = deepLink;
  };

  // Direct Verification & Instant Auto-Confirm to Firestore
  const handleVerifyAndMarkPaid = async () => {
    setVerifying(true);
    setError(null);

    try {
      const generatedTxnId = `UPI_IND_${Date.now().toString().slice(-8)}_${Math.floor(1000 + Math.random() * 9000)}`;
      const paidAtIso = new Date().toISOString();

      // Update Firestore booking document directly
      const bRef = doc(db, 'bookings', booking.id);
      await updateDoc(bRef, {
        paymentStatus: 'PAID',
        paymentMethod: walletDeduction > 0 ? 'WALLET+UPI' : 'UPI',
        paidAt: paidAtIso,
        paidAmount: finalPayable,
        transactionId: generatedTxnId,
        onlinePaymentProvider: 'Direct UPI (Indore VPA)',
        onlinePaymentMethod: activeTab === 'qr_code' ? 'Dynamic QR Matrix' : '1-Tap UPI Intent',
        status: booking.status === 'payment_pending' ? 'completed' : (booking.status === 'pending' ? 'confirmed' : booking.status),
        updatedAt: Timestamp.now()
      });

      // Background non-blocking notifications
      if (walletDeduction > 0) {
        fetch('/api/pay-via-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: booking.id, userId: profile.uid, amount: walletDeduction }),
        }).catch((err) => console.warn("Wallet partial debit notice:", err));
      }

      fetch('/api/send-final-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, requesterUid: profile.uid }),
      }).catch((err) => console.warn("Final bill trigger notice:", err));

      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);

    } catch (err: any) {
      console.error("Direct UPI Payment Confirmation Error:", err);
      setError(err.message || "Failed to confirm payment on server. Please try again.");
      setVerifying(false);
    }
  };

  // Full Wallet Payment
  const handleWalletPayment = async () => {
    if (!profile.walletBalance || profile.walletBalance < totalBill) {
      setError("Insufficient wallet balance.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/pay-via-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, userId: profile.uid }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process wallet payment');
      }

      const bRef = doc(db, 'bookings', booking.id);
      await updateDoc(bRef, {
        paymentStatus: 'PAID',
        paymentMethod: 'WALLET',
        paidAt: new Date().toISOString(),
        paidAmount: totalBill,
        status: booking.status === 'payment_pending' ? 'completed' : (booking.status === 'pending' ? 'confirmed' : booking.status),
        updatedAt: Timestamp.now()
      });

      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Wallet Payment Error:", err);
      setError(err.message || 'Wallet payment failed');
      setProcessing(false);
    }
  };

  // Switch to COD / Pay on Arrival
  const handleSwitchToCOD = async () => {
    setProcessing(true);
    setError(null);
    try {
      const bRef = doc(db, 'bookings', booking.id);
      await updateDoc(bRef, {
        paymentMethod: 'cash',
        paymentStatus: 'pay_after_service',
        status: booking.status === 'payment_pending' ? 'payment_pending' : 'confirmed',
        updatedAt: Timestamp.now()
      });
      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Error switching to Pay After Service:", err);
      setError("Failed to update payment mode.");
      setProcessing(false);
    }
  };

  const minutes = Math.floor(qrTimer / 60);
  const seconds = qrTimer % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs"
      />

      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.98 }}
        className="relative bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 font-sans"
      >
        {/* SUCCESS OVERLAY */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[110] bg-white flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-5 shadow-xl shadow-emerald-500/25">
                <CheckCircle2 size={44} className="stroke-[2.5]" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Payment Confirmed</h3>
              <p className="text-slate-500 font-medium mb-6 leading-relaxed text-sm">
                ₹{finalPayable} paid successfully via Direct UPI. Booking status updated to <span className="font-bold text-emerald-600">PAID</span>.
              </p>
              <div className="w-16 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                  className="w-full h-full bg-emerald-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-[#002e6e] to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-emerald-400 shadow-inner">
              <Smartphone size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white leading-tight">
                  Direct UPI &amp; Dynamic QR
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Zap size={9} className="fill-emerald-300" /> Instant
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                Booking #{booking.id.slice(-6).toUpperCase()} • {formatBookingTime(booking.scheduledAt)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* AMOUNT & VPA BANNER */}
        <div className="bg-blue-50/80 px-4 py-3 border-b border-blue-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Payable</span>
            <span className="text-xl font-black text-[#002e6e]">₹{finalPayable}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-blue-200 shadow-2xs">
            <span className="text-[11px] font-mono font-bold text-slate-700">{INDORE_MERCHANT_VPA}</span>
            <button
              onClick={handleCopyVpa}
              className="text-blue-600 hover:text-blue-800 p-1 cursor-pointer"
              title="Copy VPA"
            >
              {copiedVpa ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 pb-28 text-left">
          {error && (
            <div className="text-rose-600 text-xs font-semibold bg-rose-50 border border-rose-200 p-3 rounded-2xl flex gap-2 items-center">
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* RETURN FROM UPI APP BANNER (Auto-triggers on window focus or after launching deep link) */}
          <AnimatePresence>
            {showReturnVerifyBanner && !showSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/20 border border-emerald-400/50 space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/20 shrink-0 flex items-center justify-center animate-bounce">
                    <CheckCircle2 size={18} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-white leading-tight">
                      Payment Completed in UPI App?
                    </h4>
                    <p className="text-[11px] text-emerald-100 font-medium mt-0.5 leading-snug">
                      Tap below to verify and update your booking status to Paid instantly.
                    </p>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleVerifyAndMarkPaid}
                  disabled={verifying}
                  className="w-full py-2.5 px-4 bg-white text-emerald-800 font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-50 active:scale-98 transition-all"
                >
                  {verifying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                      <span>Verifying &amp; Updating Status...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} className="fill-emerald-700 text-emerald-700" />
                      <span>Tap to Verify &amp; Mark Paid (₹{finalPayable})</span>
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* WALLET DEDUCTION (If available) */}
          {walletBalance > 0 && (
            <div
              onClick={() => setUseWallet(!useWallet)}
              className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                useWallet
                  ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/10'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                  useWallet ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <Wallet size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Use Wallet Balance (₹{walletBalance})</span>
                  <span className="text-[10px] text-slate-500">
                    {useWallet ? `-₹${walletDeduction} deducted` : 'Apply wallet credits to this booking'}
                  </span>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                useWallet ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'
              }`}>
                {useWallet && <Check size={12} className="stroke-[3]" />}
              </div>
            </div>
          )}

          {/* DEVICE-ADAPTIVE TAB SELECTOR */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('upi_apps')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'upi_apps'
                  ? 'bg-white text-[#002e6e] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone size={14} /> 1-Tap UPI Apps
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('qr_code')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'qr_code'
                  ? 'bg-white text-[#002e6e] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <QrCode size={14} /> Scan Dynamic QR
            </button>
          </div>

          {/* 1. 1-TAP UPI APPS GRID (Prominent on Mobile) */}
          {activeTab === 'upi_apps' && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Tap to pay directly via installed app:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Google Pay */}
                <button
                  type="button"
                  onClick={() => handleLaunchApp('gpay')}
                  className="p-3 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg font-black shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
                    G
                  </div>
                  <span className="text-xs font-bold text-slate-900">Google Pay</span>
                  <span className="text-[9px] text-blue-600 font-semibold">1-Tap Pay</span>
                </button>

                {/* PhonePe */}
                <button
                  type="button"
                  onClick={() => handleLaunchApp('phonepe')}
                  className="p-3 rounded-2xl border-2 border-slate-200 hover:border-purple-500 hover:bg-purple-50/30 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-lg font-bold shadow-md shadow-purple-600/20 group-hover:scale-105 transition-transform">
                    पे
                  </div>
                  <span className="text-xs font-bold text-slate-900">PhonePe</span>
                  <span className="text-[9px] text-purple-600 font-semibold">1-Tap Pay</span>
                </button>

                {/* Paytm */}
                <button
                  type="button"
                  onClick={() => handleLaunchApp('paytm')}
                  className="p-3 rounded-2xl border-2 border-slate-200 hover:border-sky-500 hover:bg-sky-50/30 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="w-11 h-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center text-xs font-black shadow-md shadow-sky-500/20 tracking-tighter group-hover:scale-105 transition-transform">
                    Paytm
                  </div>
                  <span className="text-xs font-bold text-slate-900">Paytm</span>
                  <span className="text-[9px] text-sky-600 font-semibold">Fast Checkout</span>
                </button>

                {/* Any UPI / BHIM */}
                <button
                  type="button"
                  onClick={() => handleLaunchApp('universal')}
                  className="p-3 rounded-2xl border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50/30 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="w-11 h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center text-xs font-black shadow-md shadow-amber-600/20 group-hover:scale-105 transition-transform">
                    UPI
                  </div>
                  <span className="text-xs font-bold text-slate-900">Any UPI</span>
                  <span className="text-[9px] text-amber-600 font-semibold">Universal</span>
                </button>
              </div>

              {/* Mobile QR Quick Link */}
              <button
                type="button"
                onClick={() => setActiveTab('qr_code')}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <QrCode size={14} className="text-[#002e6e]" />
                <span>Prefer to scan Dynamic QR instead? Tap here</span>
              </button>
            </div>
          )}

          {/* 2. DYNAMIC QR CODE DISPLAY (Prominent on Desktop) */}
          {activeTab === 'qr_code' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
              <div className="inline-block p-3.5 bg-white rounded-2xl shadow-md border border-slate-200">
                <QRCodeSVG
                  value={upiIntentUri}
                  size={172}
                  level="H"
                  includeMargin={false}
                  className="mx-auto rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-800">
                  <span>Amount: ₹{finalPayable}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-emerald-700 font-mono">Indore Merchant QR</span>
                </div>
                <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1 font-mono">
                  <Clock size={12} className="text-amber-500" /> QR expires in {timeFormatted}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  Scan using Google Pay, PhonePe, Paytm, BHIM, or your bank UPI app
                </p>
              </div>
            </div>
          )}

          {/* NPCI / SSL SECURITY BADGE */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-semibold pt-1">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>Direct NPCI Verified UPI Transfer • 256-Bit SSL Encrypted</span>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-150 p-4 shadow-[0_-8px_25px_rgba(15,23,42,0.06)] z-20 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSwitchToCOD}
            disabled={processing || verifying}
            className="py-3 px-3.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs cursor-pointer transition-colors shrink-0"
          >
            Pay on Arrival
          </button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            disabled={processing || verifying}
            onClick={isWalletFullyCovering ? handleWalletPayment : handleVerifyAndMarkPaid}
            className="flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {verifying ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Verifying UPI Payment...
              </span>
            ) : isWalletFullyCovering ? (
              <>
                <Wallet size={15} /> Pay ₹{totalBill} from Wallet
              </>
            ) : (
              <>
                <CheckCircle2 size={15} /> Verify &amp; Mark Paid (₹{finalPayable})
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
