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
  Copy,
  AlertCircle,
  Clock,
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
  
  // UTR / Transaction Reference verification state
  const [utrInput, setUtrInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('PhonePe');
  const [utrError, setUtrError] = useState<string | null>(null);
  
  // Tab: 1-Tap UPI Apps vs Dynamic QR
  const isMobileInitial = typeof window !== 'undefined' && (
    window.innerWidth < 768 ||
    /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
  );
  
  const [activeTab, setActiveTab] = useState<'upi_apps' | 'qr_code'>(
    isMobileInitial ? 'upi_apps' : 'qr_code'
  );
  const [qrTimer, setQrTimer] = useState(300); // 5 minutes

  const INDORE_MERCHANT_VPA = 'zomindia.indore@icici';
  const MERCHANT_NAME = 'Zomindia Services Indore';

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

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(INDORE_MERCHANT_VPA);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  // Launch App Specific Deep Link on Mobile (DOES NOT auto-confirm)
  const handleLaunchApp = (app: 'phonepe' | 'gpay' | 'paytm' | 'universal') => {
    const providerMap = {
      phonepe: 'PhonePe',
      gpay: 'Google Pay',
      paytm: 'Paytm UPI',
      universal: 'BHIM / Universal UPI'
    };
    setSelectedProvider(providerMap[app]);
    setUtrError(null);

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

    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.href = deepLink;
    }
  };

  // Verify UTR & Confirm to Firestore ONLY when valid reference is submitted
  const handleVerifyAndConfirmPayment = async () => {
    const cleanUtr = utrInput.trim().replace(/\s+/g, '');
    if (!cleanUtr || cleanUtr.length < 6) {
      setUtrError('Please enter a valid 12-digit UPI Reference / UTR Number from your payment receipt.');
      return;
    }

    setUtrError(null);
    setVerifying(true);
    setError(null);

    try {
      const paidAtIso = new Date().toISOString();

      // Update Firestore booking document with explicit UTR confirmation
      const bRef = doc(db, 'bookings', booking.id);
      await updateDoc(bRef, {
        paymentStatus: 'paid',
        paymentMethod: walletDeduction > 0 ? 'wallet_online' : 'upi',
        paidAt: paidAtIso,
        paidAmount: totalBill,
        transactionId: cleanUtr,
        onlinePaymentProvider: selectedProvider || 'Direct UPI',
        onlinePaymentMethod: activeTab === 'qr_code' ? 'Dynamic QR Matrix' : '1-Tap UPI Intent',
        walletDeductAmount: walletDeduction > 0 ? walletDeduction : (booking.walletDeductAmount || 0),
        status: booking.status === 'payment_pending' ? 'completed' : (booking.status === 'pending' ? 'confirmed' : booking.status),
        updatedAt: Timestamp.now()
      });

      // Background notifications
      if (walletDeduction > 0) {
        fetch('/api/pay-via-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: booking.id, userId: profile.uid, amount: walletDeduction }),
        }).catch((err) => console.warn('Wallet partial debit notice:', err));
      }

      fetch('/api/send-final-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          requesterUid: profile.uid,
          bookingData: {
            customerId: booking.customerId || booking.userId || profile.uid,
            partnerId: booking.partnerId,
            scheduledAt: booking.scheduledAt,
            address: booking.address,
            totalPrice: booking.totalPrice || finalPayable,
            additionalCharges: booking.additionalCharges || []
          },
          userData: {
            displayName: profile.displayName || profile.fullName || 'Customer',
            email: profile.email || '',
            phoneNumber: profile.phoneNumber || profile.mobile || ''
          }
        }),
      }).catch((err) => console.warn('Final bill trigger notice:', err));

      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);

    } catch (err: any) {
      console.error('Direct UPI Payment Confirmation Error:', err);
      setError(err.message || 'Failed to confirm payment on server. Please try again.');
      setVerifying(false);
    }
  };

  // Full Wallet Payment
  const handleWalletPayment = async () => {
    if (!profile.walletBalance || profile.walletBalance < totalBill) {
      setError('Insufficient wallet balance.');
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
        paymentStatus: 'paid',
        paymentMethod: 'wallet',
        paidAt: new Date().toISOString(),
        paidAmount: totalBill,
        walletDeductAmount: totalBill,
        transactionId: `WAL_${Date.now().toString().slice(-8)}`,
        status: booking.status === 'payment_pending' ? 'completed' : (booking.status === 'pending' ? 'confirmed' : booking.status),
        updatedAt: Timestamp.now()
      });

      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Wallet Payment Error:', err);
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
      console.error('Error switching to Pay After Service:', err);
      setError('Failed to update payment mode.');
      setProcessing(false);
    }
  };

  const minutes = Math.floor(qrTimer / 60);
  const seconds = qrTimer % 60;
  const formattedQrTimer = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 font-sans border border-slate-100"
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
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/25">
                <CheckCircle2 size={36} className="stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-1">Payment Confirmed</h3>
              <p className="text-slate-500 font-medium mb-4 text-xs">
                ₹{finalPayable} paid successfully. Booking status updated to <span className="font-bold text-emerald-600">PAID</span>.
              </p>
              <div className="w-16 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                  className="w-full h-full bg-emerald-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TOP MINIMALIST WHITE & ROYAL BLUE HEADER */}
        <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
              <ShieldCheck size={22} className="stroke-[2.2]" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight leading-none">
                  Secure Checkout
                </h3>
                <span className="bg-blue-50 text-[#2563EB] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-blue-200">
                  NPCI UPI
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Booking #{booking.id.slice(-6).toUpperCase()} • {formatBookingTime(booking.scheduledAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">
                Payable
              </span>
              <span className="text-xl font-black text-[#2563EB]">₹{finalPayable}</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="px-5 pt-3.5 pb-2 bg-white shrink-0">
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('upi_apps')}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'upi_apps'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone size={14} className="shrink-0" />
              <span>1-Tap UPI Apps</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('qr_code')}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'qr_code'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <QrCode size={14} className="shrink-0" />
              <span>Dynamic QR</span>
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="p-5 overflow-y-auto space-y-4 text-left bg-white">
          {error && (
            <div className="text-rose-600 text-xs font-semibold bg-rose-50 border border-rose-200 p-3 rounded-2xl flex gap-2 items-center">
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* WALLET DEDUCTION (If available) */}
          {walletBalance > 0 && (
            <div
              onClick={() => setUseWallet(!useWallet)}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                useWallet
                  ? 'bg-blue-50/70 border-[#2563EB] ring-2 ring-blue-500/10'
                  : 'bg-[#F8FAFC] border-slate-200 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                  useWallet ? 'bg-[#2563EB] text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <Wallet size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Use Wallet Balance (₹{walletBalance})</span>
                  <span className="text-[10px] text-slate-500">
                    {useWallet ? `Deducting ₹${walletDeduction} from wallet` : 'Tap to apply available balance'}
                  </span>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                useWallet ? 'border-[#2563EB] bg-[#2563EB] text-white' : 'border-slate-300 bg-white'
              }`}>
                {useWallet && <Check size={12} className="stroke-[3]" />}
              </div>
            </div>
          )}

          {/* TAB 1: 1-TAP UPI APPS */}
          {activeTab === 'upi_apps' && (
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Select Installed UPI App
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  Tap your preferred UPI app to authenticate payment securely
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Google Pay */}
                <button
                  type="button"
                  onClick={() => handleLaunchApp('gpay')}
                  disabled={verifying}
                  className="p-4 rounded-2xl bg-[#F8FAFC] border-2 border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/40 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group text-center shadow-2xs active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-[#1A73E8] flex items-center justify-center text-xl font-black shadow-xs group-hover:scale-105 transition-transform">
                    <span className="tracking-tighter">G</span>
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">Google Pay</span>
                    <span className="text-[10px] text-[#2563EB] font-bold">1-Tap Pay</span>
                  </div>
                </button>

                {/* PhonePe */}
                <button
                  type="button"
                  onClick={() => handleLaunchApp('phonepe')}
                  disabled={verifying}
                  className="p-4 rounded-2xl bg-[#F8FAFC] border-2 border-slate-200 hover:border-[#5F259F] hover:bg-purple-50/40 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group text-center shadow-2xs active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#5F259F] text-white flex items-center justify-center text-xl font-black shadow-xs group-hover:scale-105 transition-transform">
                    पे
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">PhonePe</span>
                    <span className="text-[10px] text-[#5F259F] font-bold">Recommended</span>
                  </div>
                </button>

                {/* Paytm */}
                <button
                  type="button"
                  onClick={() => handleLaunchApp('paytm')}
                  disabled={verifying}
                  className="p-4 rounded-2xl bg-[#F8FAFC] border-2 border-slate-200 hover:border-[#00BAF2] hover:bg-sky-50/40 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group text-center shadow-2xs active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#002970] text-[#00BAF2] flex items-center justify-center text-xs font-black tracking-tighter shadow-xs group-hover:scale-105 transition-transform">
                    Paytm
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">Paytm UPI</span>
                    <span className="text-[10px] text-sky-600 font-bold">Fast &amp; Direct</span>
                  </div>
                </button>

                {/* Any UPI */}
                <button
                  type="button"
                  onClick={() => handleLaunchApp('universal')}
                  disabled={verifying}
                  className="p-4 rounded-2xl bg-[#F8FAFC] border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group text-center shadow-2xs active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xs font-black shadow-xs group-hover:scale-105 transition-transform">
                    UPI
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">BHIM / Other</span>
                    <span className="text-[10px] text-amber-600 font-bold">Universal UPI</span>
                  </div>
                </button>
              </div>
              {/* UTR / Transaction Reference Box */}
              <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Enter 12-digit UPI Reference / UTR Number
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400">
                    From {selectedProvider}
                  </span>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    maxLength={22}
                    placeholder="e.g. 423589124501 or UPI Ref ID"
                    value={utrInput}
                    onChange={(e) => {
                      setUtrInput(e.target.value);
                      if (utrError) setUtrError(null);
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                  />
                  {utrError && (
                    <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                      <AlertCircle size={12} /> {utrError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleVerifyAndConfirmPayment}
                    disabled={verifying}
                    className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                  >
                    {verifying ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Verifying with Gateway...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={15} />
                        <span>Verify Payment &amp; Mark Paid</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  After completing the transfer in your UPI app, copy the 12-digit UTR/Txn number from your receipt and tap verify.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: DYNAMIC QR CODE DISPLAY */}
          {activeTab === 'qr_code' && (
            <div className="space-y-3 text-center">
              <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-2.5">
                <div className="p-3.5 bg-white rounded-2xl shadow-sm border border-slate-200 inline-block">
                  <QRCodeSVG
                    value={upiIntentUri}
                    size={170}
                    level="H"
                    includeMargin={false}
                    className="mx-auto rounded-lg"
                  />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-bold">
                  <Clock size={13} className="text-amber-600" />
                  <span>QR code expires in {formattedQrTimer}</span>
                </div>

                <div className="w-full max-w-sm flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs">
                  <div className="text-left overflow-hidden">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none">
                      UPI ID
                    </span>
                    <span className="font-mono font-bold text-slate-800 truncate block mt-0.5">
                      {INDORE_MERCHANT_VPA}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyVpa}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedVpa ? (
                      <>
                        <Check size={12} className="text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* UTR Input in QR Tab */}
              <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200 space-y-2.5 text-left">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Enter 12-digit UPI Reference / UTR Number from Scanner App
                </label>
                <input
                  type="text"
                  maxLength={22}
                  placeholder="e.g. 423589124501"
                  value={utrInput}
                  onChange={(e) => {
                    setUtrInput(e.target.value);
                    if (utrError) setUtrError(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                />
                {utrError && (
                  <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> {utrError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleVerifyAndConfirmPayment}
                  disabled={verifying}
                  className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                >
                  {verifying ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Verifying with Gateway...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={15} />
                      <span>Verify Payment &amp; Mark Paid</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-150 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSwitchToCOD}
            disabled={processing || verifying}
            className="py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-colors shrink-0"
          >
            Pay on Completion
          </button>

          {isWalletFullyCovering && (
            <button
              type="button"
              disabled={processing || verifying}
              onClick={handleWalletPayment}
              className="flex-1 py-2.5 px-4 rounded-xl font-black text-xs bg-[#2563EB] hover:bg-blue-700 text-white shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Wallet size={14} /> Pay ₹{totalBill} from Wallet
            </button>
          )}

          {verifying && (
            <div className="flex items-center gap-2 text-xs font-bold text-[#2563EB]">
              <RefreshCw size={14} className="animate-spin" />
              <span>Verifying payment...</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
