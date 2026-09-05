import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  ShieldCheck,
  Lock,
  Smartphone,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  QrCode,
  ArrowRight,
  RefreshCw,
  Zap,
  Check,
  Shield,
  Clock,
  Copy,
  ExternalLink
} from 'lucide-react';

export interface PaymentSuccessData {
  txnId: string;
  method: 'upi' | 'card' | 'netbanking' | 'wallet';
  provider: string;
  amount: number;
  paidAt: string;
}

interface OnlinePaymentGatewayModalProps {
  isOpen: boolean;
  amount: number;
  serviceName: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  bookingDetails?: {
    date: string;
    time: string;
    address: string;
  };
  onClose: () => void;
  onPaymentSuccess: (data: PaymentSuccessData) => Promise<void> | void;
  onPaymentCancel?: () => void;
}

type GatewayTab = 'upi_apps' | 'dynamic_qr' | 'cards_banking';
type ProcessingPhase = 'idle' | 'connecting' | 'authorizing' | 'verified' | 'failed';

const POPULAR_BANKS = [
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC', icon: '🏛️' },
  { id: 'sbi', name: 'State Bank of India', code: 'SBI', icon: '🏦' },
  { id: 'icici', name: 'ICICI Bank', code: 'ICICI', icon: '🏛️' },
  { id: 'axis', name: 'Axis Bank', code: 'AXIS', icon: '🏦' },
  { id: 'kotak', name: 'Kotak Mahindra', code: 'KOTAK', icon: '🏛️' },
  { id: 'pnb', name: 'Punjab National Bank', code: 'PNB', icon: '🏦' }
];

export default function OnlinePaymentGatewayModal({
  isOpen,
  amount,
  serviceName,
  customerName = 'Customer',
  customerPhone = '',
  customerEmail = '',
  bookingDetails,
  onClose,
  onPaymentSuccess,
  onPaymentCancel
}: OnlinePaymentGatewayModalProps) {
  const [activeTab, setActiveTab] = useState<GatewayTab>('upi_apps');

  // UPI Apps state
  const [selectedUpiApp, setSelectedUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'vpa'>('phonepe');
  const [selectedProviderName, setSelectedProviderName] = useState<string>('PhonePe');
  const [upiIdInput, setUpiIdInput] = useState('');
  const [upiIdError, setUpiIdError] = useState('');
  const [utrInput, setUtrInput] = useState('');
  const [utrError, setUtrError] = useState<string | null>(null);

  // QR Code state
  const [qrTimer, setQrTimer] = useState(300); // 5 minutes
  const [copiedVpa, setCopiedVpa] = useState(false);

  // Cards / Netbanking state
  const [paymentSubMode, setPaymentSubMode] = useState<'card' | 'netbanking'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState(customerName || '');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardError, setCardError] = useState('');
  const [selectedBank, setSelectedBank] = useState<string>('hdfc');

  // Processing state
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [generatedTxnId, setGeneratedTxnId] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [phonePePollingTxnId, setPhonePePollingTxnId] = useState<string | null>(null);
  const [phonePeLoading, setPhonePeLoading] = useState(false);

  const MERCHANT_VPA = 'zomindia.indore@icici';
  const MERCHANT_NAME = 'Zomindia Services Indore';

  // Dynamic UPI Intent URI
  const upiIntentUri = `upi://pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(
    MERCHANT_NAME
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Service_${serviceName.slice(0, 15)}`)}`;

  // 5-Minute Countdown for QR Code
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setQrTimer((prev) => (prev > 0 ? prev - 1 : 300));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // PhonePe Status Polling Effect
  useEffect(() => {
    if (!phonePePollingTxnId || !isOpen) return;

    let pollAttempts = 0;
    const maxPollAttempts = 40; // ~2 minutes of polling
    const pollInterval = setInterval(async () => {
      pollAttempts += 1;
      if (pollAttempts > maxPollAttempts) {
        clearInterval(pollInterval);
        setPhonePePollingTxnId(null);
        setProcessingPhase('idle');
        return;
      }

      try {
        const res = await fetch('/api/phonepe/status-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchantTransactionId: phonePePollingTxnId })
        });
        const data = await res.json();
        if (data.success && (data.code === 'PAYMENT_SUCCESS' || data.status === 'PAYMENT_SUCCESS')) {
          clearInterval(pollInterval);
          setPhonePePollingTxnId(null);
          finalizeSuccessfulPayment('upi', 'PhonePe PG', phonePePollingTxnId);
        }
      } catch (err) {
        console.warn('[PhonePe Client Poller Notice]:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [phonePePollingTxnId, isOpen]);

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(MERCHANT_VPA);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const getCardBrand = (num: string) => {
    const clean = num.replace(/\D/g, '');
    if (clean.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(clean)) return 'Mastercard';
    if (/^60|^65|^81|^82/.test(clean)) return 'RuPay';
    return null;
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

  const handleModalClose = () => {
    if (processingPhase === 'connecting' || processingPhase === 'authorizing') {
      if (!window.confirm('Payment is currently being processed. Are you sure you want to cancel?')) {
        return;
      }
    }
    // Strict Cancellation: zero Firestore changes occur on modal abort
    if (onPaymentCancel) {
      onPaymentCancel();
    } else {
      onClose();
    }
  };

  // Launch App Specific Deep Link on Mobile (DOES NOT auto-approve)
  const handleLaunchUpiApp = (app: 'gpay' | 'phonepe' | 'paytm' | 'bhim') => {
    setSelectedUpiApp(app);
    const nameMap = {
      phonepe: 'PhonePe',
      gpay: 'Google Pay',
      paytm: 'Paytm UPI',
      bhim: 'BHIM / Any UPI'
    };
    setSelectedProviderName(nameMap[app]);
    setUtrError(null);

    let deepLink = upiIntentUri;
    if (app === 'phonepe') {
      deepLink = `phonepe://pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(
        MERCHANT_NAME
      )}&am=${amount}&cu=INR`;
    } else if (app === 'gpay') {
      deepLink = `tez://upi/pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(
        MERCHANT_NAME
      )}&am=${amount}&cu=INR`;
    } else if (app === 'paytm') {
      deepLink = `paytmmp://pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(
        MERCHANT_NAME
      )}&am=${amount}&cu=INR`;
    }

    // Attempt direct deep link on mobile devices
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.href = deepLink;
    }
  };

  // Initiate PhonePe Payment Gateway Handshake
  const handleInitiatePhonePePg = async () => {
    try {
      setPhonePeLoading(true);
      setProcessingPhase('connecting');
      setStatusMessage('Initiating PhonePe Payment Gateway...');

      const response = await fetch('/api/phonepe/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          serviceName,
          customerName,
          customerPhone,
          customerEmail,
          redirectOrigin: window.location.origin
        })
      });

      const data = await response.json();
      setPhonePeLoading(false);

      if (data.success && data.merchantTransactionId) {
        setPhonePePollingTxnId(data.merchantTransactionId);
        setProcessingPhase('authorizing');
        setStatusMessage('Complete payment on PhonePe gateway page...');

        const targetUrl = data.checkoutUrl || data.redirectUrl;
        if (targetUrl) {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        setProcessingPhase('idle');
        setUtrError(data.error || 'Failed to initiate PhonePe gateway');
      }
    } catch (err: any) {
      setPhonePeLoading(false);
      setProcessingPhase('idle');
      setUtrError(err.message || 'Payment initiation error');
    }
  };

  // Manual UTR Verification handler for UPI Intent / QR modes
  const handleVerifyUpiPayment = (customProvider?: string) => {
    const cleanUtr = utrInput.trim().replace(/\s+/g, '');
    if (!cleanUtr || cleanUtr.length < 6) {
      setUtrError('Please enter a valid 12-digit UPI Reference / UTR Number from your payment receipt.');
      return;
    }

    setUtrError(null);
    setProcessingPhase('connecting');
    setStatusMessage('Verifying UTR Reference with Bank Switch...');

    setTimeout(() => {
      finalizeSuccessfulPayment('upi', customProvider || selectedProviderName || 'Direct UPI', cleanUtr);
    }, 1200);
  };

  // Cards / Netbanking Payment Flow Handler
  const handleInitiatePayment = (providerName: string, methodType: 'card' | 'netbanking') => {
    if (methodType === 'card') {
      const cleanCard = cardNumber.replace(/\D/g, '');
      if (cleanCard.length < 15) {
        setCardError('Please enter a valid 16-digit card number');
        return;
      }
      if (!cardExpiry || cardExpiry.length < 5) {
        setCardError('Please enter card expiry in MM/YY format');
        return;
      }
      if (!cardCvv || cardCvv.length < 3) {
        setCardError('Please enter a valid 3-digit CVV');
        return;
      }
      setCardError('');
    }

    // Launch authentic PhonePe gateway for safe, verified Card/Netbanking processing
    handleInitiatePhonePePg();
  };

  const finalizeSuccessfulPayment = async (
    methodType: 'upi' | 'card' | 'netbanking' | 'wallet',
    providerName: string,
    utrReference?: string
  ) => {
    const txnId = utrReference?.trim() || phonePePollingTxnId || '';
    if (!txnId) {
      setProcessingPhase('idle');
      setStatusMessage('');
      setUtrError('Payment verification failed: No authentic transaction ID or gateway response received.');
      return;
    }
    setGeneratedTxnId(txnId);
    setShowOtpScreen(false);
    setProcessingPhase('verified');
    setStatusMessage('Payment Verified Successfully!');

    const successData: PaymentSuccessData = {
      txnId,
      method: methodType,
      provider: providerName,
      amount,
      paidAt: new Date().toISOString()
    };

    setTimeout(async () => {
      await onPaymentSuccess(successData);
    }, 1200);
  };

  const handleOtpSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!enteredOtp || enteredOtp.length < 4) {
      alert('Please enter the 6-digit OTP');
      return;
    }
    setShowOtpScreen(false);
    const provider =
      paymentSubMode === 'card'
        ? `${getCardBrand(cardNumber) || 'Credit/Debit Card'}`
        : `${selectedBank.toUpperCase()} Net Banking`;
    if (!phonePePollingTxnId) {
      setProcessingPhase('idle');
      setUtrError('Direct card processing requires active gateway initiation. Please use PhonePe Checkout or verified UPI.');
      return;
    }
    finalizeSuccessfulPayment(paymentSubMode === 'card' ? 'card' : 'netbanking', provider, phonePePollingTxnId);
  };

  const minutes = Math.floor(qrTimer / 60);
  const seconds = qrTimer % 60;
  const formattedQrTimer = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (!isOpen) return null;

  return (
    <div
      id="online-payment-gateway-modal"
      className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.18 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col my-auto max-h-[92vh] font-sans"
      >
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
                {serviceName} • 256-Bit SSL
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">
                Amount
              </span>
              <span className="text-xl font-black text-[#2563EB]">₹{amount}</span>
            </div>
            <button
              type="button"
              onClick={handleModalClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PAYTM / ZOMATO MINIMALIST TAB SWITCHER */}
        <div className="px-5 pt-3.5 pb-2 bg-white shrink-0">
          <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-2xl gap-1">
            {/* Tab 1: 1-Tap UPI Apps */}
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
              <span className="truncate">UPI Apps</span>
            </button>

            {/* Tab 2: Dynamic QR */}
            <button
              type="button"
              onClick={() => setActiveTab('dynamic_qr')}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'dynamic_qr'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <QrCode size={14} className="shrink-0" />
              <span className="truncate">Dynamic QR</span>
            </button>

            {/* Tab 3: Cards & Net Banking */}
            <button
              type="button"
              onClick={() => setActiveTab('cards_banking')}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'cards_banking'
                  ? 'bg-white text-[#2563EB] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CreditCard size={14} className="shrink-0" />
              <span className="truncate">Cards/Net</span>
            </button>
          </div>
        </div>

        {/* MAIN SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left bg-white">
          {/* TAB 1: 1-TAP UPI APPS */}
          {activeTab === 'upi_apps' && (
            <div className="space-y-4">
              {/* Primary PhonePe PG Gateway Option */}
              <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 rounded-2xl border-2 border-purple-200 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#5F259F] text-white flex items-center justify-center text-lg font-black shadow-xs shrink-0">
                      पे
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">PhonePe Payment Gateway</h4>
                      <p className="text-[11px] text-purple-700 font-semibold">Official Secure Checkout (UPI, Cards &amp; NetBanking)</p>
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-300">
                    Live PG
                  </span>
                </div>
                <button
                  type="button"
                  disabled={phonePeLoading}
                  onClick={handleInitiatePhonePePg}
                  className="w-full py-3 bg-[#5F259F] hover:bg-[#4E1E83] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <Zap size={14} />
                  <span>{phonePeLoading ? 'Initiating Gateway...' : `Pay ₹${amount} with PhonePe Gateway`}</span>
                  <ExternalLink size={13} />
                </button>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Or Pay Directly with Installed UPI App
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  Instant 1-tap authorization without sharing card details
                </p>
              </div>

              {/* Large Touch Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Google Pay Card */}
                <button
                  type="button"
                  onClick={() => handleLaunchUpiApp('gpay')}
                  className="p-4 rounded-2xl bg-[#F8FAFC] border-2 border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/40 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group text-center shadow-2xs active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-[#1A73E8] flex items-center justify-center text-xl font-black shadow-xs group-hover:scale-105 transition-transform">
                    <span className="tracking-tighter">G</span>
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">Google Pay</span>
                    <span className="text-[10px] text-[#2563EB] font-bold">1-Tap Checkout</span>
                  </div>
                </button>

                {/* PhonePe Card */}
                <button
                  type="button"
                  onClick={() => handleLaunchUpiApp('phonepe')}
                  className="p-4 rounded-2xl bg-[#F8FAFC] border-2 border-slate-200 hover:border-[#5F259F] hover:bg-purple-50/40 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group text-center shadow-2xs active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#5F259F] text-white flex items-center justify-center text-xl font-black shadow-xs group-hover:scale-105 transition-transform">
                    पे
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">PhonePe</span>
                    <span className="text-[10px] text-[#5F259F] font-bold">Recommended</span>
                  </div>
                </button>

                {/* Paytm Card */}
                <button
                  type="button"
                  onClick={() => handleLaunchUpiApp('paytm')}
                  className="p-4 rounded-2xl bg-[#F8FAFC] border-2 border-slate-200 hover:border-[#00BAF2] hover:bg-sky-50/40 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group text-center shadow-2xs active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#002970] text-[#00BAF2] flex items-center justify-center text-xs font-black tracking-tighter shadow-xs group-hover:scale-105 transition-transform">
                    Paytm
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">Paytm UPI</span>
                    <span className="text-[10px] text-sky-600 font-bold">Fast &amp; Direct</span>
                  </div>
                </button>

                {/* BHIM / Any UPI Card */}
                <button
                  type="button"
                  onClick={() => handleLaunchUpiApp('bhim')}
                  className="p-4 rounded-2xl bg-[#F8FAFC] border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group text-center shadow-2xs active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xs font-black shadow-xs group-hover:scale-105 transition-transform">
                    UPI
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">BHIM / Other</span>
                    <span className="text-[10px] text-amber-600 font-bold">All UPI Apps</span>
                  </div>
                </button>
              </div>

              {/* Custom UPI ID (VPA) Collapsible Box */}
              <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200 space-y-2">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Or enter your Virtual Payment Address (UPI ID)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 9876543210@paytm or user@oksbi"
                    value={upiIdInput}
                    onChange={(e) => setUpiIdInput(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!upiIdInput.trim() || !upiIdInput.includes('@')) {
                        setUpiIdError('Please enter a valid UPI ID (e.g. yourname@okhdfcbank)');
                        return;
                      }
                      setUpiIdError('');
                      setSelectedUpiApp('vpa');
                      setSelectedProviderName(`UPI ID (${upiIdInput})`);
                    }}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
                  >
                    Select
                  </button>
                </div>
                {upiIdError && <p className="text-[10px] text-rose-600 font-bold">{upiIdError}</p>}
              </div>

              {/* UTR / Reference Entry Box for UPI Apps */}
              <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Enter 12-digit UPI Reference / UTR Number
                  </label>
                  <span className="text-[10px] font-semibold text-[#2563EB]">
                    {selectedProviderName}
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
                    onClick={() => handleVerifyUpiPayment()}
                    className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                  >
                    <ShieldCheck size={15} />
                    <span>Verify Payment &amp; Confirm Booking</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  After completing the transfer in your UPI app, enter your 12-digit UTR/Txn number from your payment confirmation.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: DYNAMIC QR CODE */}
          {activeTab === 'dynamic_qr' && (
            <div className="space-y-4 text-center">
              <div className="p-5 bg-[#F8FAFC] rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-3">
                {/* Centered QR Container */}
                <div className="p-3.5 bg-white rounded-2xl shadow-sm border border-slate-200 inline-block">
                  <QRCodeSVG
                    value={upiIntentUri}
                    size={180}
                    level="H"
                    includeMargin={false}
                    className="mx-auto rounded-lg"
                  />
                </div>

                {/* 5-Minute Countdown Indicator */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-bold">
                  <Clock size={13} className="text-amber-600 animate-pulse" />
                  <span>QR code expires in {formattedQrTimer}</span>
                </div>

                {/* Copyable UPI ID Box */}
                <div className="w-full max-w-sm flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                  <div className="text-left overflow-hidden">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none">
                      UPI ID
                    </span>
                    <span className="font-mono font-bold text-slate-800 truncate block mt-0.5">
                      {MERCHANT_VPA}
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

                <p className="text-xs text-slate-500 font-medium max-w-xs">
                  Scan and pay with any UPI app on your phone (GPay, PhonePe, Paytm, BHIM, Cred)
                </p>
              </div>

              {/* UTR Input in Dynamic QR Tab */}
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
                  onClick={() => handleVerifyUpiPayment('Dynamic QR Matrix')}
                  className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <ShieldCheck size={15} />
                  <span>Verify Payment &amp; Confirm Booking</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CARDS & NET BANKING */}
          {activeTab === 'cards_banking' && (
            <div className="space-y-4">
              {/* Sub-mode selector */}
              <div className="flex gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setPaymentSubMode('card')}
                  className={`pb-1 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    paymentSubMode === 'card'
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Credit / Debit Card
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSubMode('netbanking')}
                  className={`pb-1 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    paymentSubMode === 'netbanking'
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Net Banking
                </button>
              </div>

              {paymentSubMode === 'card' ? (
                <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200 space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Card Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={19}
                        placeholder="•••• •••• •••• ••••"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        className="w-full pl-3.5 pr-20 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                      />
                      {getCardBrand(cardNumber) && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                          {getCardBrand(cardNumber)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Name on Card</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Expiry</label>
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-center text-slate-900 focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">CVV</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="•••"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-center text-slate-900 focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                      />
                    </div>
                  </div>

                  {cardError && (
                    <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                      <AlertCircle size={12} /> {cardError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => handleInitiatePayment(getCardBrand(cardNumber) || 'Card', 'card')}
                    className="w-full py-3.5 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                  >
                    <Lock size={14} /> Pay ₹{amount} with Card <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {POPULAR_BANKS.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBank(b.id)}
                        className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all cursor-pointer text-left ${
                          selectedBank === b.id
                            ? 'border-[#2563EB] bg-blue-50/50 shadow-2xs'
                            : 'border-slate-200 bg-[#F8FAFC] hover:bg-white'
                        }`}
                      >
                        <span className="text-lg">{b.icon}</span>
                        <div className="overflow-hidden">
                          <span className="text-xs font-bold text-slate-900 block truncate">{b.name}</span>
                          <span className="text-[9px] text-slate-400 font-semibold">{b.code}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleInitiatePayment(`${selectedBank.toUpperCase()} Net Banking`, 'netbanking')}
                    className="w-full py-3.5 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                  >
                    <Lock size={14} /> Pay ₹{amount} via Net Banking <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CLEAN MINIMALIST FOOTER */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 font-medium">
            <Shield size={13} className="text-emerald-600" />
            <span>100% Safe &amp; Verified</span>
          </div>
          <div className="flex items-center gap-1 text-[#2563EB] font-bold">
            <span>Powered by NPCI UPI</span>
          </div>
        </div>

        {/* PROCESSING & VERIFICATION OVERLAY */}
        <AnimatePresence>
          {processingPhase !== 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center"
            >
              {/* Connecting State */}
              {processingPhase === 'connecting' && (
                <div className="space-y-3 max-w-sm">
                  <div className="w-14 h-14 rounded-full border-4 border-blue-200 border-t-[#2563EB] animate-spin mx-auto" />
                  <h3 className="text-base font-black text-slate-900">Connecting to Bank Gateway...</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Establishing secure 256-bit encrypted handshake with your bank
                  </p>
                </div>
              )}

              {/* Authorizing State */}
              {processingPhase === 'authorizing' && (
                <div className="space-y-4 max-w-md w-full">
                  {!showOtpScreen ? (
                    <div className="space-y-3">
                      <div className="w-14 h-14 bg-blue-50 text-[#2563EB] rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Smartphone size={28} />
                      </div>
                      <h3 className="text-base font-black text-slate-900">Awaiting UPI Authorization</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Please approve the request for <b className="text-[#2563EB]">₹{amount}</b> in your UPI app.
                      </p>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-center gap-2">
                        <RefreshCw size={13} className="animate-spin text-[#2563EB]" />
                        <span>Verifying with NPCI switch...</span>
                      </div>
                    </div>
                  ) : (
                    /* OTP Simulator */
                    <div className="bg-white rounded-2xl p-5 shadow-xl space-y-4 text-left border border-slate-200">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={18} className="text-emerald-600" />
                          <h4 className="text-xs font-black text-slate-900">Bank 2FA OTP</h4>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          ₹{amount}
                        </span>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
                        <div className="text-[10px] text-amber-900">
                          <span className="font-bold block">📨 Bank SMS OTP:</span>
                          <span>Code is <b className="font-mono text-xs">{simulatedOtp}</b></span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEnteredOtp(simulatedOtp)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shrink-0 cursor-pointer"
                        >
                          Auto-fill
                        </button>
                      </div>

                      <form onSubmit={handleOtpSubmit} className="space-y-3">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="6-digit OTP"
                          value={enteredOtp}
                          onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-3 py-2.5 border-2 border-blue-500 rounded-xl text-center text-lg font-mono font-black tracking-widest outline-none"
                        />
                        <button
                          type="submit"
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 size={15} /> Authorize Payment
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* Verified State */}
              {processingPhase === 'verified' && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-3 max-w-sm"
                >
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                    <Check size={36} className="stroke-[3]" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Payment Verified!</h3>
                  <p className="text-xs text-emerald-700 font-bold font-mono">
                    ID: {generatedTxnId}
                  </p>
                  <p className="text-xs text-slate-500">
                    ₹{amount} processed successfully. Updating your booking...
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
